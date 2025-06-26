import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService, createClaudeService } from '../claude';
import { TaskStreaming } from '../../utils/streaming';
import type { Env } from '../../types';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn()
      }
    }))
  };
});

// Mock TaskStreaming
vi.mock('../../utils/streaming', () => ({
  TaskStreaming: {
    emitToolStart: vi.fn(),
    emitToolComplete: vi.fn(),
    emitToolError: vi.fn(),
    emitAnalysisStart: vi.fn(),
    emitAnalysisComplete: vi.fn()
  }
}));

describe('ClaudeService Analysis', () => {
  let service: ClaudeService;
  let mockAnthropicInstance: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      ANTHROPIC_API_KEY: 'test-api-key',
      DB: {} as any,
      R2_BUCKET: {} as any,
      ENVIRONMENT: 'test'
    };

    service = createClaudeService(mockEnv);
    
    // Mock the anthropic instance
    mockAnthropicInstance = {
      messages: {
        create: vi.fn()
      }
    };
    
    // @ts-ignore - accessing private property for testing
    service.anthropic = mockAnthropicInstance;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeData', () => {
    it('should perform two-phase analysis with tools', async () => {
      // Phase 1: Research with tools
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'web_search',
              id: 'search_1',
              input: { query: 'validate compound data' }
            }
          ]
        })
        // Tool response
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Research completed' }]
        })
        // Phase 2: Structured output
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Comprehensive analysis completed',
                validations: [
                  {
                    rowIndex: 0,
                    columnId: 'compound_name',
                    status: 'error',
                    originalValue: 'H2O2',
                    suggestedValue: 'Hydrogen Peroxide',
                    reason: 'Scientific name should use full chemical name'
                  },
                  {
                    rowIndex: 1,
                    columnId: 'molecular_weight',
                    status: 'warning',
                    originalValue: '34.01',
                    suggestedValue: '34.014',
                    reason: 'Molecular weight precision should include more decimal places'
                  }
                ],
                rowDeletions: [
                  {
                    rowIndex: 2,
                    reason: 'Duplicate entry with identical molecular formula',
                    confidence: 'high'
                  }
                ]
              }
            }
          ]
        });

      const testData = [
        { compound_name: 'H2O2', molecular_weight: '34.01' },
        { compound_name: 'NaCl', molecular_weight: '58.44' },
        { compound_name: 'NaCl', molecular_weight: '58.44' } // Duplicate
      ];

      const result = await service.analyzeData(
        'Validate this chemical compound data',
        testData,
        [0, 1, 2],
        ['compound_name', 'molecular_weight'],
        'task_123'
      );

      // Verify results
      expect(result.method).toBe('anthropic-api');
      expect(result.analysis).toBe('Comprehensive analysis completed');
      expect(result.validations).toHaveLength(2);
      expect(result.rowDeletions).toHaveLength(1);

      // Verify tool usage
      expect(result.validations![0]).toEqual({
        rowIndex: 0,
        columnId: 'compound_name',
        status: 'error',
        originalValue: 'H2O2',
        suggestedValue: 'Hydrogen Peroxide',
        reason: 'Scientific name should use full chemical name'
      });

      expect(result.rowDeletions![0]).toEqual({
        rowIndex: 2,
        reason: 'Duplicate entry with identical molecular formula',
        confidence: 'high'
      });

      // Verify streaming events
      expect(TaskStreaming.emitToolStart).toHaveBeenCalledWith(
        'task_123',
        'web_search',
        expect.stringContaining('Searching for'),
        expect.any(String)
      );
    });

    it('should handle web search tool usage', async () => {
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'web_search',
              id: 'search_1',
              input: { query: 'caffeine molecular formula C8H10N4O2' }
            }
          ]
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Search results processed' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Molecular formula validated against scientific databases',
                validations: [
                  {
                    rowIndex: 0,
                    columnId: 'formula',
                    status: 'valid',
                    originalValue: 'C8H10N4O2',
                    reason: 'Formula confirmed in scientific literature'
                  }
                ]
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Verify molecular formulas',
        [{ compound: 'Caffeine', formula: 'C8H10N4O2' }],
        [0],
        ['formula'],
        'task_456'
      );

      expect(result.validations![0].status).toBe('valid');
      expect(TaskStreaming.emitToolStart).toHaveBeenCalledWith(
        'task_456',
        'web_search',
        expect.stringContaining('Searching for'),
        expect.any(String)
      );
      expect(TaskStreaming.emitToolComplete).toHaveBeenCalledWith(
        'task_456',
        'web_search',
        'Scientific database search completed'
      );
    });

    it('should handle bash tool usage for calculations', async () => {
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'bash',
              id: 'calc_1',
              input: { command: 'echo "scale=3; 18.015 + 32.065" | bc' }
            }
          ]
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Calculation completed' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Molecular weight calculations verified',
                validations: [
                  {
                    rowIndex: 0,
                    columnId: 'molecular_weight',
                    status: 'error',
                    originalValue: '50.0',
                    suggestedValue: '50.080',
                    reason: 'Calculated molecular weight differs from provided value'
                  }
                ]
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Verify molecular weight calculations',
        [{ compound: 'H2O + O2', molecular_weight: '50.0' }],
        [0],
        ['molecular_weight'],
        'task_789'
      );

      expect(result.validations![0].suggestedValue).toBe('50.080');
      expect(TaskStreaming.emitToolStart).toHaveBeenCalledWith(
        'task_789',
        'bash',
        'Running calculations',
        expect.stringContaining('echo')
      );
    });

    it('should handle comprehensive validation prompt', async () => {
      const mockCreate = mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'No tools needed' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Comprehensive validation completed',
                validations: Array.from({ length: 25 }, (_, i) => ({
                  rowIndex: i,
                  columnId: 'test_column',
                  status: 'warning',
                  originalValue: `value_${i}`,
                  suggestedValue: `corrected_${i}`,
                  reason: `Issue found in row ${i}`
                }))
              }
            }
          ]
        });

      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        test_column: `value_${i}`,
        other_column: `other_${i}`
      }));

      const result = await service.analyzeData(
        'Perform comprehensive validation',
        largeDataset,
        Array.from({ length: 50 }, (_, i) => i),
        ['test_column'],
        'task_comprehensive'
      );

      // Should generate many validations (increased token limit allows this)
      expect(result.validations).toHaveLength(25);
      
      // Verify the prompt includes comprehensive instructions
      const call = mockCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContain('COMPREHENSIVE analysis');
      expect(call.messages[0].content).toContain('Examine EVERY row and column');
      expect(call.messages[0].content).toContain('50+ validations if needed');
      expect(call.max_tokens).toBe(8192); // Increased token limit
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limits', async () => {
      mockAnthropicInstance.messages.create.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(service.analyzeData(
        'Test prompt',
        [{ test: 'data' }],
        [0],
        ['test'],
        'task_rate_limit'
      )).rejects.toThrow('Analysis failed: Rate limit exceeded');

      expect(TaskStreaming.emitToolError).toHaveBeenCalledWith(
        'task_rate_limit',
        'structured_output',
        'Claude analysis failed',
        'Rate limit exceeded'
      );
    });

    it('should handle malformed tool responses', async () => {
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'No tools' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                // Missing required fields
                analysis: 'Incomplete analysis'
                // validations field missing
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Test prompt',
        [{ test: 'data' }],
        [0],
        ['test'],
        'task_malformed'
      );

      expect(result.analysis).toBe('Incomplete analysis');
      expect(result.validations).toBeUndefined();
    });

    it('should handle network timeouts', async () => {
      mockAnthropicInstance.messages.create.mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(service.analyzeData(
        'Test prompt',
        [{ test: 'data' }],
        [0],
        ['test'],
        'task_timeout'
      )).rejects.toThrow('Analysis failed: Request timeout');
    });
  });

  describe('Data Processing Edge Cases', () => {
    it('should handle empty datasets', async () => {
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'No data to analyze' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'No data provided for analysis'
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Analyze empty dataset',
        [],
        [],
        [],
        'task_empty'
      );

      expect(result.analysis).toBe('No data provided for analysis');
      expect(result.validations).toBeUndefined();
    });

    it('should handle datasets with null values', async () => {
      const dataWithNulls = [
        { name: null, value: 123 },
        { name: 'test', value: null },
        { name: undefined, value: 456 }
      ];

      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Analyzing null values' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Found missing values that need attention',
                validations: [
                  {
                    rowIndex: 0,
                    columnId: 'name',
                    status: 'error',
                    originalValue: null,
                    suggestedValue: 'Unknown',
                    reason: 'Missing name field'
                  }
                ]
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Handle missing values',
        dataWithNulls,
        [0, 1, 2],
        ['name', 'value'],
        'task_nulls'
      );

      expect(result.validations![0].originalValue).toBeNull();
      expect(result.validations![0].suggestedValue).toBe('Unknown');
    });

    it('should handle very large data truncation', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `very_long_string_${'x'.repeat(100)}_${i}`
      }));

      // Create a mock that checks if data was truncated
      mockAnthropicInstance.messages.create
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Processing large dataset' }]
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'data_analysis_result',
              id: 'analysis_1',
              input: {
                analysis: 'Analyzed large dataset with truncation'
              }
            }
          ]
        });

      const result = await service.analyzeData(
        'Analyze large dataset',
        largeDataset,
        Array.from({ length: 1000 }, (_, i) => i),
        ['data'],
        'task_large'
      );

      // Check if the prompt mentions truncation for large datasets
      const call = mockAnthropicInstance.messages.create.mock.calls[0][0];
      const dataSize = JSON.stringify(largeDataset).length;
      
      if (dataSize > 50000) {
        expect(call.messages[0].content).toContain('Showing first');
        expect(call.messages[0].content).toContain('total rows');
      }
    });
  });

  describe('Mock Mode Fallback', () => {
    it('should fall back to mock mode when no API key provided', async () => {
      const envWithoutKey = { ...mockEnv, ANTHROPIC_API_KEY: undefined };
      const mockService = createClaudeService(envWithoutKey);

      const result = await mockService.analyzeData(
        'Test analysis',
        [{ email: 'invalid-email' }],
        [0],
        ['email'],
        'task_mock'
      );

      expect(result.method).toBe('mock');
      expect(result.analysis).toContain('MOCK ANALYSIS');
      expect(result.validations).toBeDefined();
    });

    it('should generate mock validations for email data', async () => {
      const envWithoutKey = { ...mockEnv, ANTHROPIC_API_KEY: undefined };
      const mockService = createClaudeService(envWithoutKey);

      const testData = [
        { email: 'invalid-email' },
        { email: 'test@example' },
        { email: 'valid@example.com' }
      ];

      const result = await mockService.analyzeData(
        'Validate emails',
        testData,
        [0, 1, 2],
        ['email'],
        'task_mock_email'
      );

      expect(result.validations).toHaveLength(3);
      expect(result.validations![0].status).toBe('error'); // Missing @
      expect(result.validations![1].status).toBe('warning'); // Missing .
      expect(result.validations![2].status).toBe('valid'); // Valid format
    });
  });
});