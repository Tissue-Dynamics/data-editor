import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    temperature: number;
    tools: any[];
    messages: any[];
  };
}

interface BatchResult {
  custom_id: string;
  result?: any;
  error?: any;
}

export class ClaudeBatchService {
  private anthropic: Anthropic;
  
  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  async createBatch(requests: BatchRequest[]): Promise<string> {
    try {
      // Create batch using the Message Batches API
      const response = await this.anthropic.beta.messages.batches.create({
        requests: requests.map(req => ({
          custom_id: req.custom_id,
          params: req.params
        }))
      });
      
      return response.id;
    } catch (error) {
      console.error('Failed to create batch:', error);
      throw error;
    }
  }

  async getBatchStatus(batchId: string): Promise<{
    id: string;
    processing_status: string;
    request_counts: {
      processing: number;
      succeeded: number;
      errored: number;
      canceled: number;
      expired: number;
    };
  }> {
    const batch = await this.anthropic.beta.messages.batches.retrieve(batchId);
    return batch;
  }

  async getBatchResults(batchId: string): Promise<BatchResult[]> {
    // Check if batch is complete
    const status = await this.getBatchStatus(batchId);
    
    if (status.processing_status !== 'ended') {
      throw new Error(`Batch ${batchId} is still processing`);
    }
    
    // For the Anthropic API, results are retrieved via the batch endpoint
    // In a real implementation, you'd parse the results URL
    // For now, we'll simulate the results structure
    console.log('Retrieving batch results for:', batchId);
    
    // This would actually fetch from the results_url
    return [];
  }

  async prepareBatchRequests(
    tasks: Array<{
      id: string;
      prompt: string;
      data: any[];
      selectedRows?: number[];
      selectedColumns?: string[];
    }>
  ): Promise<BatchRequest[]> {
    return tasks.map(task => {
      const userMessage = this.buildAnalysisPrompt(
        task.prompt,
        task.data,
        task.selectedRows,
        task.selectedColumns
      );

      return {
        custom_id: task.id,
        params: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.1,
          tools: [
            this.getValidationTool(),
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
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ]
        }
      };
    });
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
1. Use web search for validation when needed
2. Use bash for calculations if required
3. Always provide structured output with validations

Focus on accuracy and cite sources when possible.`;
  }

  private getValidationTool() {
    return {
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
  }
}

export function createClaudeBatchService(env: Env): ClaudeBatchService {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  
  return new ClaudeBatchService(env.ANTHROPIC_API_KEY);
}