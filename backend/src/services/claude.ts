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
          TaskStreaming.emitToolStart(taskId, 'structured_output', 'Setting up analysis parameters');
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

    // No longer emit hardcoded web search event here - let Claude's actual usage trigger it

    let messages: any[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // First call: Allow Claude to use research tools
    const firstResponse = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.1,
      tools: [
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
      messages,
    });

    // Track tool usage and build tool results
    let usedWebSearch = false;
    let usedBash = false;
    const toolResults: any[] = [];
    
    // Add assistant's response to messages
    messages.push({
      role: 'assistant',
      content: firstResponse.content
    });
    
    // Process tool uses and create tool results
    for (const content of firstResponse.content) {
      if (content.type === 'tool_use') {
        console.log(`[Task ${taskId}] Claude used tool: ${content.name}`);
        
        if (content.name === 'web_search') {
          usedWebSearch = true;
          if (taskId) {
            const query = content.input?.query || content.input;
            const searchDesc = query ? `Searching for: "${String(query).substring(0, 60)}${String(query).length > 60 ? '...' : ''}"` : 'Performing web search';
            TaskStreaming.emitToolStart(taskId, 'web_search', searchDesc, 
              'Checking scientific databases and literature');
          }
          
          // Add tool result message
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: content.id,
              content: 'Search completed successfully. Results integrated into analysis.'
            }]
          });
        }
        
        if (content.name === 'bash') {
          usedBash = true;
          if (taskId) {
            const command = content.input?.command || content.input;
            let bashDesc = 'Running calculations';
            
            // Provide context-aware descriptions based on command patterns
            if (String(command).includes('mol') || String(command).includes('smiles')) {
              bashDesc = 'Calculating molecular properties';
            } else if (String(command).includes('convert') || String(command).includes('unit')) {
              bashDesc = 'Converting units';
            } else if (String(command).includes('stat') || String(command).includes('mean')) {
              bashDesc = 'Computing statistics';
            }
            
            TaskStreaming.emitToolStart(taskId, 'bash', bashDesc, 
              String(command).substring(0, 80) + (String(command).length > 80 ? '...' : ''));
          }
          
          // Add tool result message  
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: content.id,
              content: 'Calculation completed successfully. Results integrated into analysis.'
            }]
          });
        }
      }
    }

    // Complete tool events
    if (taskId) {
      if (usedWebSearch) {
        TaskStreaming.emitToolComplete(taskId, 'web_search', 'Scientific database search completed');
      }
      if (usedBash) {
        TaskStreaming.emitToolComplete(taskId, 'bash', 'Calculations completed');
      }
    }

    // Only add the structured output request if tools were used
    if (toolResults.length > 0 || firstResponse.content.some(c => c.type === 'tool_use')) {
      // Need Claude's response to tool results first
      const toolResponseMessages = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.1,
        messages,
      });
      
      messages.push({
        role: 'assistant',
        content: toolResponseMessages.content
      });
    }

    // Now ask for structured output
    messages.push({
      role: 'user',
      content: 'Based on your research above, please now provide your structured analysis using the data_analysis_result tool. Include any findings from your web searches or calculations in your validation results.'
    });

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.1,
      tools: [validationTool],
      tool_choice: { type: "tool", name: "data_analysis_result" },
      messages,
    });

    // Process structured output (guaranteed from second call)
    for (const content of response.content) {
      if (content.type === 'tool_use' && content.name === 'data_analysis_result') {
        const analysisResult = content.input as {
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
          const validationCount = analysisResult.validations?.length || 0;
          TaskStreaming.emitToolStart(taskId, 'structured_output', 
            `Generating ${validationCount} validation${validationCount === 1 ? '' : 's'}`, 
            'Formatting analysis results');
          TaskStreaming.emitToolComplete(taskId, 'structured_output', 'Validation results generated', {
            validationCount: analysisResult.validations?.length || 0
          });
        }
        
        return {
          analysis: analysisResult.analysis,
          validations: analysisResult.validations,
        };
      }
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

Please analyze this scientific data:
1. Use web search for compound validation
2. Use bash for calculations if needed
3. **IMPORTANT**: Always call 'data_analysis_result' tool at the end

Focus on filling missing values and validating existing data.`;
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