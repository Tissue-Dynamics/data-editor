import Anthropic from '@anthropic-ai/sdk';
// import { query, type SDKMessage } from '@anthropic-ai/claude-code'; // Not compatible with Cloudflare Workers
import type { Env } from '../types';
import { TaskStreaming } from '../utils/streaming';

interface ClaudeConfig {
  apiKey?: string;
  preferClaudeDesktop?: boolean;
}

export class ClaudeService {
  private anthropic?: Anthropic;
  private preferClaudeDesktop: boolean;

  constructor(config: ClaudeConfig = {}) {
    this.preferClaudeDesktop = config.preferClaudeDesktop ?? true;
    
    if (config.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
      });
    }
  }

  async analyzeData(
    prompt: string,
    data: Record<string, any>[],
    selectedRows?: number[],
    selectedColumns?: string[],
    taskId?: string
  ): Promise<{
    analysis: string;
    validations?: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      originalValue: any;
      suggestedValue?: any;
      reason: string;
    }>;
    method: 'anthropic-api' | 'mock';
  }> {
    // Filter data based on selection
    const selectedData = selectedRows 
      ? data.filter((_, index) => selectedRows.includes(index))
      : data;

    const relevantData = selectedColumns && selectedColumns.length > 0
      ? selectedData.map(row => {
          const filteredRow: Record<string, any> = {};
          selectedColumns.forEach(col => {
            filteredRow[col] = row[col];
          });
          return filteredRow;
        })
      : selectedData;

    // Use Anthropic API (Claude Code SDK not compatible with Workers)
    if (this.anthropic) {
      try {
        if (taskId) {
          TaskStreaming.emitToolStart(taskId, 'structured_output', 'Preparing Claude-4 analysis with tools');
        }
        const result = await this.useAnthropicAPI(prompt, relevantData, selectedRows, selectedColumns, taskId);
        if (taskId) {
          TaskStreaming.emitAnalysisComplete(taskId, 'Claude analysis completed successfully', { 
            validationCount: result.validations?.length || 0,
            method: 'anthropic-api'
          });
        }
        return { ...result, method: 'anthropic-api' };
      } catch (error) {
        if (taskId) {
          TaskStreaming.emitToolError(taskId, 'structured_output', 'Claude analysis failed', 
            error instanceof Error ? error.message : 'Unknown error');
        }
        console.error('Anthropic API error:', error);
        throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Final fallback to mock response (for development)
    return this.getMockResponse(prompt, relevantData, selectedRows, selectedColumns);
  }


  private async useAnthropicAPI(
    prompt: string,
    data: Record<string, any>[],
    selectedRows?: number[],
    selectedColumns?: string[],
    taskId?: string
  ): Promise<{
    analysis: string;
    validations?: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      originalValue: any;
      suggestedValue?: any;
      reason: string;
    }>;
  }> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    // Define the structured output schema for validations
    const validationTool = {
      name: "data_analysis_result",
      description: "Provide structured data analysis and validation results",
      input_schema: {
        type: "object",
        properties: {
          analysis: {
            type: "string",
            description: "Overall analysis and summary of the data"
          },
          validations: {
            type: "array",
            description: "List of specific validation results for individual data points",
            items: {
              type: "object",
              properties: {
                rowIndex: {
                  type: "number",
                  description: "Zero-based index of the row being validated"
                },
                columnId: {
                  type: "string", 
                  description: "Name of the column being validated"
                },
                status: {
                  type: "string",
                  enum: ["valid", "warning", "error", "conflict"],
                  description: "Validation status of this data point"
                },
                originalValue: {
                  description: "The original value from the data"
                },
                suggestedValue: {
                  description: "Suggested corrected value (optional)"
                },
                reason: {
                  type: "string",
                  description: "Explanation of why this validation status was assigned"
                }
              },
              required: ["rowIndex", "columnId", "status", "originalValue", "reason"]
            }
          }
        },
        required: ["analysis"]
      }
    };

    const userMessage = this.buildAnalysisPrompt(prompt, data, selectedRows, selectedColumns);

    if (taskId) {
      TaskStreaming.emitToolStart(taskId, 'web_search', 'Searching scientific databases for compound validation', 
        'Accessing PubChem, ChEMBL, and literature databases');
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-4-sonnet-20250514',
      max_tokens: 4000,
      temperature: 0.1,
      tools: [
        validationTool,
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3
        },
        {
          type: "bash_20250124",
          name: "bash"
        }
      ],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Process Claude's response and track tool usage
    let usedWebSearch = false;
    let usedBash = false;
    let analysisResult: any = null;
    
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        console.log(`[Task ${taskId}] Claude used tool: ${content.name}`);
        
        if (content.name === 'web_search' && taskId) {
          usedWebSearch = true;
          TaskStreaming.emitToolStart(taskId, 'web_search', 'Searching scientific databases', 
            `Query: ${JSON.stringify(content.input).substring(0, 100)}...`);
        }
        
        if (content.name === 'bash' && taskId) {
          usedBash = true;
          TaskStreaming.emitToolStart(taskId, 'bash', 'Running calculations', 
            `Command: ${JSON.stringify(content.input).substring(0, 100)}...`);
        }
        
        if (content.name === 'data_analysis_result') {
          analysisResult = content.input as {
            analysis: string;
            validations?: Array<{
              rowIndex: number;
              columnId: string;
              status: 'valid' | 'warning' | 'error' | 'conflict';
              originalValue: any;
              suggestedValue?: any;
              reason: string;
            }>;
          };
          
          if (taskId) {
            TaskStreaming.emitToolStart(taskId, 'structured_output', 'Generating validation results', 
              'Analyzing patterns and formatting structured output');
          }
        }
      }
    }
    
    // Complete any started tool events
    if (taskId) {
      if (usedWebSearch) {
        TaskStreaming.emitToolComplete(taskId, 'web_search', 'Scientific database search completed');
      }
      if (usedBash) {
        TaskStreaming.emitToolComplete(taskId, 'bash', 'Calculations completed');
      }
      if (analysisResult) {
        TaskStreaming.emitToolComplete(taskId, 'structured_output', 'Validation results generated', {
          validationCount: analysisResult.validations?.length || 0
        });
      }
    }
    
    if (analysisResult) {
      return {
        analysis: analysisResult.analysis,
        validations: analysisResult.validations,
      };
    }

    throw new Error('Claude did not provide structured output');
  }

  private getMockResponse(
    prompt: string,
    data: Record<string, any>[],
    selectedRows?: number[],
    selectedColumns?: string[]
  ): {
    analysis: string;
    validations?: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      originalValue: any;
      suggestedValue?: any;
      reason: string;
    }>;
    method: 'mock';
  } {
    const mockAnalysis = `MOCK ANALYSIS: "${prompt}"

I would analyze ${data.length} rows of data${selectedRows ? ` (${selectedRows.length} selected)` : ''}${selectedColumns ? ` focusing on columns: ${selectedColumns.join(', ')}` : ''}.

Since neither Claude Desktop Bridge nor Anthropic API key are available, this is a mock response. 

To get real AI analysis:
1. Use Claude Desktop app (preferred - uses your Claude subscription)
2. Or set ANTHROPIC_API_KEY environment variable

Data preview: ${JSON.stringify(data.slice(0, 2), null, 2)}`;

    // Generate mock validations for testing
    const mockValidations: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      originalValue: any;
      suggestedValue?: any;
      reason: string;
    }> = [];

    // If we have email data, create some mock validations
    data.forEach((row, index) => {
      Object.keys(row).forEach(columnId => {
        const value = row[columnId];
        if (columnId === 'email' && value) {
          if (!value.includes('@')) {
            mockValidations.push({
              rowIndex: index,
              columnId,
              status: 'error',
              originalValue: value,
              suggestedValue: `${value}@example.com`,
              reason: 'Missing @ symbol in email address'
            });
          } else if (!value.includes('.')) {
            mockValidations.push({
              rowIndex: index,
              columnId,
              status: 'warning',
              originalValue: value,
              reason: 'Email domain might be incomplete'
            });
          } else {
            mockValidations.push({
              rowIndex: index,
              columnId,
              status: 'valid',
              originalValue: value,
              reason: 'Valid email format'
            });
          }
        }
      });
    });

    return {
      analysis: mockAnalysis,
      validations: mockValidations.length > 0 ? mockValidations : undefined,
      method: 'mock',
    };
  }

  private buildAnalysisPrompt(
    prompt: string,
    data: Record<string, any>[],
    selectedRows?: number[],
    selectedColumns?: string[]
  ): string {
    return `
User Request: ${prompt}

Data to analyze:
${JSON.stringify(data, null, 2)}

${selectedRows ? `Selected rows: ${selectedRows.join(', ')}` : 'All rows selected'}
${selectedColumns ? `Selected columns: ${selectedColumns.join(', ')}` : 'All columns selected'}

IMPORTANT: This appears to be scientific/pharmaceutical data. Please:
1. Use web search to verify compound names, molecular weights, IC50 values, and other scientific data
2. Look up missing values in scientific databases like PubChem, ChEMBL, or literature
3. Use bash calculations if needed for unit conversions or molecular property calculations
4. ALWAYS end by calling the data_analysis_result tool with your structured findings

Please thoroughly validate this data using web search and provide specific suggestions for any missing or incorrect values. Focus on scientific accuracy and cite sources when possible.`;
  }

  private parseValidations(
    analysisText: string,
    selectedRows: number[],
    selectedColumns: string[]
  ): Array<{
    rowIndex: number;
    columnId: string;
    status: 'valid' | 'warning' | 'error';
    originalValue: any;
    suggestedValue?: any;
    reason: string;
  }> {
    const validations: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      originalValue: any;
      suggestedValue?: any;
      reason: string;
    }> = [];

    // Look for validation section in the response
    const validationSection = analysisText.match(/VALIDATIONS?:(.*?)(?=\n\n|\n[A-Z]+:|$)/is);
    if (!validationSection) return validations;

    const validationText = validationSection[1];
    
    // Parse individual validation entries
    // Pattern: "Row X, Column Y: [status] - [original] → [suggested] - [reason]"
    const validationPattern = /Row (\d+), Column (\w+):\s*(valid|warning|error)\s*-\s*(.+?)(?:\s*→\s*(.+?))?\s*-\s*(.+?)(?=\n|$)/gi;
    
    let match;
    while ((match = validationPattern.exec(validationText)) !== null) {
      const [, rowStr, columnId, status, originalValue, suggestedValue, reason] = match;
      const rowIndex = parseInt(rowStr, 10);
      
      validations.push({
        rowIndex,
        columnId,
        status: status as 'valid' | 'warning' | 'error',
        originalValue: originalValue.trim(),
        suggestedValue: suggestedValue?.trim(),
        reason: reason.trim(),
      });
    }

    return validations;
  }
}

export function createClaudeService(env: Env): ClaudeService {
  console.log('Creating Claude service...');
  console.log('API key available:', !!env.ANTHROPIC_API_KEY);
  console.log('API key preview:', env.ANTHROPIC_API_KEY ? `${env.ANTHROPIC_API_KEY.substring(0, 10)}...` : 'none');
  
  return new ClaudeService({
    apiKey: env.ANTHROPIC_API_KEY,
    preferClaudeDesktop: false, // Claude Code SDK not compatible with Workers runtime
  });
}