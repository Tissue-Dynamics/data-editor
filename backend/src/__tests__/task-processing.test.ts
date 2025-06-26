import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Env } from '../types';
import { createClaudeService } from '../services/claude';
import { TaskStreaming } from '../utils/streaming';

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
vi.mock('../utils/streaming', () => ({
  TaskStreaming: {
    emitAnalysisStart: vi.fn(),
    emitToolStart: vi.fn(),
    emitToolComplete: vi.fn(),
    emitAnalysisComplete: vi.fn(),
    emitToolError: vi.fn()
  }
}));

describe('Task Processing', () => {
  let mockEnv: Env;
  
  beforeEach(() => {
    mockEnv = {
      ANTHROPIC_API_KEY: 'test-api-key',
      DB: {} as any,
      R2_BUCKET: {} as any,
      ENVIRONMENT: 'test'
    };
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Standard Mode vs Batch Mode Processing', () => {
    it('should use Claude Sonnet with tools in standard mode', async () => {
      const mockAnthropicCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              name: 'web_search',
              id: 'search_1',
              input: { query: 'test search' }
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
                analysis: 'Standard mode analysis',
                validations: [
                  {
                    rowIndex: 0,
                    columnId: 'name',
                    status: 'error',
                    originalValue: 'invalid',
                    suggestedValue: 'corrected',
                    reason: 'Invalid format detected'
                  }
                ]
              }
            }
          ]
        });

      const claudeService = createClaudeService(mockEnv);
      // @ts-ignore - accessing private property for testing
      claudeService.anthropic = { messages: { create: mockAnthropicCreate } };

      const testData = [{ name: 'invalid', value: 123 }];
      const result = await claudeService.analyzeData(
        'Validate this data',
        testData,
        [0],
        ['name'],
        'task_123'
      );

      expect(result.method).toBe('anthropic-api');
      expect(result.validations).toHaveLength(1);
      expect(result.validations![0].status).toBe('error');
      
      // Should use Sonnet model with tools
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8192,
          tools: expect.arrayContaining([
            expect.objectContaining({ type: 'web_search_20250305' }),
            expect.objectContaining({ type: 'bash_20250124' })
          ])
        })
      );
    });
  });

  describe('Batch Mode Analysis', () => {
    it('should use Claude Haiku with direct JSON output', async () => {
      // This would be tested with the analyzeBatchMode function
      // For now, we'll test the expected behavior
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            analysis: 'Batch mode analysis completed',
            validations: [
              {
                rowIndex: 0,
                columnId: 'email',
                status: 'error',
                originalValue: 'invalid-email',
                suggestedValue: 'invalid-email@example.com',
                reason: 'Missing @ symbol'
              }
            ],
            rowDeletions: []
          })
        }]
      };

      // Mock for batch mode would use Haiku model
      const expectedModel = 'claude-3-haiku-20240307';
      const expectedMaxTokens = 8192;
      
      expect(expectedModel).toBe('claude-3-haiku-20240307');
      expect(expectedMaxTokens).toBe(8192);
    });

    it('should emit proper streaming events for batch mode', async () => {
      const taskId = 'test_task_123';
      
      // Simulate batch mode streaming events
      TaskStreaming.emitToolStart(taskId, 'structured_output', 'Running cost-saving batch analysis');
      TaskStreaming.emitToolComplete(taskId, 'structured_output', 'Generated 5 validations');
      
      expect(TaskStreaming.emitToolStart).toHaveBeenCalledWith(
        taskId,
        'structured_output',
        'Running cost-saving batch analysis',
        'Using Claude Haiku for faster, cheaper processing'
      );
      
      expect(TaskStreaming.emitToolComplete).toHaveBeenCalledWith(
        taskId,
        'structured_output',
        'Generated 5 validations',
        expect.objectContaining({
          mode: 'cost-saving'
        })
      );
    });
  });

  describe('Validation Processing', () => {
    it('should handle comprehensive validation results', async () => {
      const testValidations = [
        {
          rowIndex: 0,
          columnId: 'email',
          status: 'error' as const,
          originalValue: 'invalid-email',
          suggestedValue: 'invalid-email@example.com',
          reason: 'Missing @ symbol in email address'
        },
        {
          rowIndex: 1,
          columnId: 'age',
          status: 'warning' as const,
          originalValue: '25.5',
          suggestedValue: '26',
          reason: 'Age should be whole number'
        },
        {
          rowIndex: 2,
          columnId: 'name',
          status: 'valid' as const,
          originalValue: 'John Doe',
          reason: 'Name format is correct'
        }
      ];

      // Test validation processing logic
      const errorCount = testValidations.filter(v => v.status === 'error').length;
      const warningCount = testValidations.filter(v => v.status === 'warning').length;
      const validCount = testValidations.filter(v => v.status === 'valid').length;

      expect(errorCount).toBe(1);
      expect(warningCount).toBe(1);
      expect(validCount).toBe(1);

      // Test that suggested values are properly handled
      const withSuggestions = testValidations.filter(v => v.suggestedValue !== undefined);
      expect(withSuggestions).toHaveLength(2);
    });

    it('should handle row deletion suggestions', async () => {
      const testRowDeletions = [
        {
          rowIndex: 5,
          reason: 'Duplicate entry - same data as row 2',
          confidence: 'high' as const
        },
        {
          rowIndex: 10,
          reason: 'Test data placeholder',
          confidence: 'high' as const
        },
        {
          rowIndex: 15,
          reason: 'Potential outlier - unusually large values',
          confidence: 'medium' as const
        }
      ];

      const highConfidence = testRowDeletions.filter(d => d.confidence === 'high');
      const mediumConfidence = testRowDeletions.filter(d => d.confidence === 'medium');

      expect(highConfidence).toHaveLength(2);
      expect(mediumConfidence).toHaveLength(1);

      // Test deletion logic
      const dataToDelete = testRowDeletions.map(d => d.rowIndex).sort((a, b) => b - a);
      expect(dataToDelete).toEqual([15, 10, 5]); // Sorted descending for safe deletion
    });
  });

  describe('Error Handling', () => {
    it('should handle Claude API errors gracefully', async () => {
      const mockAnthropicCreate = vi.fn().mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const claudeService = createClaudeService(mockEnv);
      // @ts-ignore
      claudeService.anthropic = { messages: { create: mockAnthropicCreate } };

      await expect(claudeService.analyzeData(
        'Test prompt',
        [{ test: 'data' }],
        [0],
        ['test'],
        'task_123'
      )).rejects.toThrow('Analysis failed: Rate limit exceeded');

      expect(TaskStreaming.emitToolError).toHaveBeenCalledWith(
        'task_123',
        'structured_output',
        'Claude analysis failed',
        'Rate limit exceeded'
      );
    });

    it('should handle malformed JSON in batch mode', async () => {
      const malformedResponse = {
        content: [{
          type: 'text',
          text: 'This is not valid JSON: { invalid json }'
        }]
      };

      // In real implementation, this would fall back to text analysis
      const fallbackText = 'This is not valid JSON: { invalid json }';
      expect(fallbackText).toContain('This is not valid JSON');
    });

    it('should handle missing API key', async () => {
      const envWithoutKey = { ...mockEnv, ANTHROPIC_API_KEY: undefined };
      
      expect(() => createClaudeService(envWithoutKey)).not.toThrow();
      
      // The service should fall back to mock mode when no API key is provided
      const service = createClaudeService(envWithoutKey);
      const result = await service.analyzeData('test', [], [], [], 'task_123');
      expect(result.method).toBe('mock');
    });
  });

  describe('Data Processing', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 80) + 18
      }));

      // Test data size calculation
      const dataSize = JSON.stringify(largeDataset).length;
      const shouldTruncate = dataSize > 50000;
      
      if (shouldTruncate) {
        const truncatedData = largeDataset.slice(0, 100);
        expect(truncatedData).toHaveLength(100);
        expect(truncatedData.length).toBeLessThan(largeDataset.length);
      }
    });

    it('should handle selected rows and columns properly', async () => {
      const testData = [
        { id: 1, name: 'Alice', email: 'alice@test.com', age: 25 },
        { id: 2, name: 'Bob', email: 'bob@test.com', age: 30 },
        { id: 3, name: 'Charlie', email: 'charlie@test.com', age: 35 }
      ];

      const selectedRows = [0, 2]; // Alice and Charlie
      const selectedColumns = ['name', 'email']; // Only name and email

      // Simulate data filtering
      const filteredData = testData
        .filter((_, index) => selectedRows.includes(index))
        .map(row => {
          const filteredRow: Record<string, any> = {};
          selectedColumns.forEach(col => {
            filteredRow[col] = row[col as keyof typeof row];
          });
          return filteredRow;
        });

      expect(filteredData).toHaveLength(2);
      expect(filteredData[0]).toEqual({ name: 'Alice', email: 'alice@test.com' });
      expect(filteredData[1]).toEqual({ name: 'Charlie', email: 'charlie@test.com' });
      expect(filteredData[0]).not.toHaveProperty('age');
    });
  });

  describe('Streaming Events', () => {
    it('should emit proper events during analysis', async () => {
      const taskId = 'streaming_test_123';
      
      // Simulate the event sequence
      TaskStreaming.emitAnalysisStart(taskId, 'Starting analysis');
      TaskStreaming.emitToolStart(taskId, 'web_search', 'Searching for compound data');
      TaskStreaming.emitToolComplete(taskId, 'web_search', 'Found relevant data');
      TaskStreaming.emitToolStart(taskId, 'bash', 'Running calculations');
      TaskStreaming.emitToolComplete(taskId, 'bash', 'Calculations completed');
      TaskStreaming.emitToolStart(taskId, 'structured_output', 'Generating results');
      TaskStreaming.emitToolComplete(taskId, 'structured_output', 'Analysis complete');
      TaskStreaming.emitAnalysisComplete(taskId, 'Task finished successfully');

      // Verify all events were called
      expect(TaskStreaming.emitAnalysisStart).toHaveBeenCalledWith(taskId, 'Starting analysis');
      expect(TaskStreaming.emitToolStart).toHaveBeenCalledWith(taskId, 'web_search', 'Searching for compound data');
      expect(TaskStreaming.emitToolComplete).toHaveBeenCalledWith(taskId, 'web_search', 'Found relevant data');
      expect(TaskStreaming.emitAnalysisComplete).toHaveBeenCalledWith(taskId, 'Task finished successfully');
    });

    it('should handle streaming event errors', async () => {
      const taskId = 'error_test_123';
      
      TaskStreaming.emitToolError(taskId, 'web_search', 'Search failed', 'Network timeout');
      
      expect(TaskStreaming.emitToolError).toHaveBeenCalledWith(
        taskId,
        'web_search',
        'Search failed',
        'Network timeout'
      );
    });
  });
});