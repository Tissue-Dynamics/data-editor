import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeBatchService } from '../claude-batch';
import Anthropic from '@anthropic-ai/sdk';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: {
        messages: {
          batches: {
            create: vi.fn(),
            retrieve: vi.fn(),
          }
        }
      }
    }))
  };
});

describe('ClaudeBatchService', () => {
  let service: ClaudeBatchService;
  let mockAnthropicInstance: any;
  
  beforeEach(() => {
    mockAnthropicInstance = new (Anthropic as any)();
    service = new ClaudeBatchService('test-api-key');
    // @ts-ignore - accessing private property for testing
    service.anthropic = mockAnthropicInstance;
  });
  
  describe('createBatch', () => {
    it('should create a batch with proper request format', async () => {
      const mockBatchId = 'batch_123';
      mockAnthropicInstance.beta.messages.batches.create.mockResolvedValue({
        id: mockBatchId
      });
      
      const requests = [
        {
          custom_id: 'task_1',
          params: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.1,
            tools: [],
            messages: [{ role: 'user', content: 'Test prompt 1' }]
          }
        },
        {
          custom_id: 'task_2',
          params: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.1,
            tools: [],
            messages: [{ role: 'user', content: 'Test prompt 2' }]
          }
        }
      ];
      
      const batchId = await service.createBatch(requests);
      
      expect(batchId).toBe(mockBatchId);
      expect(mockAnthropicInstance.beta.messages.batches.create).toHaveBeenCalledWith({
        requests: requests.map(req => ({
          custom_id: req.custom_id,
          params: req.params
        }))
      });
    });
    
    it('should handle API errors', async () => {
      mockAnthropicInstance.beta.messages.batches.create.mockRejectedValue(
        new Error('API Error')
      );
      
      await expect(service.createBatch([])).rejects.toThrow('API Error');
    });
  });
  
  describe('getBatchStatus', () => {
    it('should retrieve batch status', async () => {
      const mockStatus = {
        id: 'batch_123',
        processing_status: 'in_progress',
        request_counts: {
          processing: 2,
          succeeded: 0,
          errored: 0,
          canceled: 0,
          expired: 0
        }
      };
      
      mockAnthropicInstance.beta.messages.batches.retrieve.mockResolvedValue(mockStatus);
      
      const status = await service.getBatchStatus('batch_123');
      
      expect(status).toEqual(mockStatus);
      expect(mockAnthropicInstance.beta.messages.batches.retrieve).toHaveBeenCalledWith('batch_123');
    });
  });
  
  describe('prepareBatchRequests', () => {
    it('should prepare batch requests with proper format', async () => {
      const tasks = [
        {
          id: 'task_1',
          prompt: 'Validate this data',
          data: [{ name: 'Test', value: 123 }],
          selectedRows: [0],
          selectedColumns: ['value']
        }
      ];
      
      const requests = await service.prepareBatchRequests(tasks);
      
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        custom_id: 'task_1',
        params: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.1,
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'data_analysis_result' }),
            expect.objectContaining({ name: 'web_search' }),
            expect.objectContaining({ name: 'bash' })
          ]),
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('Validate this data')
            }
          ]
        }
      });
    });
    
    it('should include data context in prompts', async () => {
      const testData = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      
      const tasks = [{
        id: 'task_1',
        prompt: 'Check names',
        data: testData,
        selectedRows: [0, 1],
        selectedColumns: ['name']
      }];
      
      const requests = await service.prepareBatchRequests(tasks);
      const message = requests[0].params.messages[0].content;
      
      expect(message).toContain('Check names');
      expect(message).toContain(JSON.stringify(testData, null, 2));
      expect(message).toContain('Selected rows: 0, 1');
      expect(message).toContain('Selected columns: name');
    });
  });
  
  describe('getBatchResults', () => {
    it('should throw error if batch is still processing', async () => {
      mockAnthropicInstance.beta.messages.batches.retrieve.mockResolvedValue({
        processing_status: 'in_progress'
      });
      
      await expect(service.getBatchResults('batch_123')).rejects.toThrow(
        'Batch batch_123 is still processing'
      );
    });
    
    it('should handle completed batch', async () => {
      mockAnthropicInstance.beta.messages.batches.retrieve.mockResolvedValue({
        processing_status: 'ended'
      });
      
      // In real implementation, this would fetch from results_url
      const results = await service.getBatchResults('batch_123');
      expect(results).toEqual([]);
    });
  });
});