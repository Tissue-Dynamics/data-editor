import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types';

// Mock all external dependencies
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() }
  }))
}));

vi.mock('../utils/streaming', () => ({
  TaskStreaming: {
    emitAnalysisStart: vi.fn(),
    emitToolStart: vi.fn(),
    emitToolComplete: vi.fn(),
    emitAnalysisComplete: vi.fn(),
    emitToolError: vi.fn(),
    addStream: vi.fn(),
    removeTask: vi.fn(),
    getEvents: vi.fn(() => [])
  }
}));

vi.mock('../db/tasks', () => ({
  TaskService: vi.fn().mockImplementation(() => ({
    createTask: vi.fn().mockResolvedValue({ id: 'task_123' }),
    updateTask: vi.fn().mockResolvedValue({}),
    getTask: vi.fn().mockResolvedValue(null),
    addTaskEvent: vi.fn().mockResolvedValue({})
  }))
}));

vi.mock('../db/sessions', () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    createSession: vi.fn().mockResolvedValue({ id: 'session_123' }),
    getSession: vi.fn().mockResolvedValue(null),
    getSessionData: vi.fn().mockResolvedValue(null)
  }))
}));

describe('Integration Tests - Complete Task Flow', () => {
  let app: Hono;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      ANTHROPIC_API_KEY: 'test-api-key',
      DB: {} as any,
      R2_BUCKET: {} as any,
      ENVIRONMENT: 'test'
    };

    // Import app after mocks are set up
    const { default: appModule } = require('../index');
    app = appModule;

    vi.clearAllMocks();
  });

  describe('End-to-End Task Execution', () => {
    it('should handle complete standard mode task flow', async () => {
      const testData = [
        { compound: 'Caffeine', formula: 'C8H10N4O2', mol_weight: 194.19 },
        { compound: 'Aspirin', formula: 'C9H8O4', mol_weight: 180.16 },
        { compound: 'Invalid', formula: 'INVALID', mol_weight: null }
      ];

      // Mock Claude response for standard mode
      const mockClaudeResponse = {
        content: [
          {
            type: 'tool_use',
            name: 'data_analysis_result',
            input: {
              analysis: 'Comprehensive chemical compound validation completed',
              validations: [
                {
                  rowIndex: 2,
                  columnId: 'formula',
                  status: 'error',
                  originalValue: 'INVALID',
                  suggestedValue: 'Unknown',
                  reason: 'Invalid chemical formula format'
                },
                {
                  rowIndex: 2,
                  columnId: 'mol_weight',
                  status: 'error',
                  originalValue: null,
                  suggestedValue: 'Unknown',
                  reason: 'Missing molecular weight'
                }
              ],
              rowDeletions: []
            }
          }
        ]
      };

      // Set up Claude mock
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'No tools needed' }] })
        .mockResolvedValueOnce(mockClaudeResponse);

      // Mock the service creation
      vi.doMock('../services/claude', () => ({
        createClaudeService: () => ({
          analyzeData: vi.fn().mockResolvedValue({
            analysis: mockClaudeResponse.content[0].input.analysis,
            validations: mockClaudeResponse.content[0].input.validations,
            rowDeletions: mockClaudeResponse.content[0].input.rowDeletions,
            method: 'anthropic-api'
          })
        })
      }));

      // Create task request
      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Validate chemical compound data and check for errors',
          selectedRows: [0, 1, 2],
          selectedColumns: ['compound', 'formula', 'mol_weight'],
          data: testData,
          sessionId: 'session_123',
          batchMode: false
        })
      });

      const response = await app.fetch(request, mockEnv);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toMatchObject({
        taskId: expect.any(String),
        status: 'pending',
        message: expect.stringContaining('Validate chemical compound data'),
        selectedRowsCount: 3,
        selectedColumnsCount: 3
      });
    });

    it('should handle complete batch mode task flow', async () => {
      const testData = [
        { email: 'invalid-email', name: 'John' },
        { email: 'test@example', name: 'Jane' },
        { email: 'valid@example.com', name: 'Bob' }
      ];

      // Mock batch mode response (Claude Haiku)
      const mockBatchResponse = {
        analysis: 'Batch mode email validation completed',
        validations: [
          {
            rowIndex: 0,
            columnId: 'email',
            status: 'error',
            originalValue: 'invalid-email',
            suggestedValue: 'invalid-email@example.com',
            reason: 'Missing @ symbol in email address'
          },
          {
            rowIndex: 1,
            columnId: 'email',
            status: 'warning',
            originalValue: 'test@example',
            suggestedValue: 'test@example.com',
            reason: 'Email domain might be incomplete'
          }
        ],
        method: 'haiku-batch'
      };

      // Mock the batch mode function
      vi.doMock('../services/claude', () => ({
        createClaudeService: () => ({
          analyzeData: vi.fn().mockResolvedValue(mockBatchResponse)
        })
      }));

      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Validate email addresses quickly',
          selectedRows: [0, 1, 2],
          selectedColumns: ['email'],
          data: testData,
          sessionId: 'session_123',
          batchMode: true // Enable batch mode
        })
      });

      const response = await app.fetch(request, mockEnv);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.taskId).toBeDefined();
      expect(result.status).toBe('pending');
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle missing API key gracefully', async () => {
      const envWithoutKey = { ...mockEnv, ANTHROPIC_API_KEY: undefined };

      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test without API key',
          selectedRows: [0],
          selectedColumns: ['test'],
          data: [{ test: 'data' }]
        })
      });

      const response = await app.fetch(request, envWithoutKey);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.taskId).toBeDefined();
      // Should fall back to mock mode
    });

    it('should handle malformed request data', async () => {
      const malformedRequests = [
        {}, // Empty request
        { prompt: '' }, // Empty prompt
        { prompt: 'test', data: 'not-array' }, // Invalid data type
        { prompt: 'test', selectedRows: 'not-array' }, // Invalid selection
        { prompt: null }, // Null prompt
      ];

      for (const body of malformedRequests) {
        const request = new Request('http://localhost/api/tasks/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const response = await app.fetch(request, mockEnv);
        
        if (body.prompt === '' || body.prompt === null || !body.prompt) {
          expect(response.status).toBe(400);
        } else {
          // Other malformed data should still create a task
          expect(response.status).toBe(200);
        }
      }
    });

    it('should handle database errors', async () => {
      // Mock database failure
      vi.doMock('../db/tasks', () => ({
        TaskService: vi.fn().mockImplementation(() => ({
          createTask: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        }))
      }));

      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test with DB error',
          data: [{ test: 'data' }]
        })
      });

      // Should handle database errors gracefully
      const response = await app.fetch(request, mockEnv);
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Streaming Integration', () => {
    it('should establish SSE connection for task streaming', async () => {
      const taskId = 'streaming_test_task';
      
      const request = new Request(`http://localhost/api/tasks/${taskId}/stream`, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      });

      const response = await app.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should handle streaming for non-existent task', async () => {
      const nonExistentTaskId = 'non_existent_task_123';
      
      const request = new Request(`http://localhost/api/tasks/${nonExistentTaskId}/stream`, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      });

      const response = await app.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      // Should still establish connection, then send error event
    });
  });

  describe('Session Management Integration', () => {
    it('should create session and link tasks properly', async () => {
      // First create a session
      const sessionRequest = new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Session',
          description: 'Integration test session',
          file_name: 'test.csv',
          file_type: 'csv',
          data: [{ test: 'data' }],
          column_names: ['test']
        })
      });

      // Mock session creation
      vi.doMock('../db/sessions', () => ({
        SessionService: vi.fn().mockImplementation(() => ({
          createSession: vi.fn().mockResolvedValue({
            session: { id: 'session_integration_123', name: 'Test Session' }
          })
        }))
      }));

      const sessionResponse = await app.fetch(sessionRequest, mockEnv);
      expect(sessionResponse.status).toBe(200);

      const sessionResult = await sessionResponse.json();
      const sessionId = sessionResult.session?.id || 'session_integration_123';

      // Then create a task linked to the session
      const taskRequest = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Task linked to session',
          data: [{ test: 'data' }],
          sessionId: sessionId
        })
      });

      const taskResponse = await app.fetch(taskRequest, mockEnv);
      expect(taskResponse.status).toBe(200);

      const taskResult = await taskResponse.json();
      expect(taskResult.taskId).toBeDefined();
    });

    it('should handle session retrieval with tasks', async () => {
      const sessionId = 'session_with_tasks_123';

      // Mock session service to return session with tasks
      vi.doMock('../db/sessions', () => ({
        SessionService: vi.fn().mockImplementation(() => ({
          getSession: vi.fn().mockResolvedValue({
            id: sessionId,
            name: 'Session with tasks'
          }),
          getSessionData: vi.fn().mockResolvedValue({
            data: JSON.stringify([{ test: 'data' }]),
            column_names: JSON.stringify(['test'])
          }),
          getAllSnapshots: vi.fn().mockResolvedValue([])
        }))
      }));

      const request = new Request(`http://localhost/api/sessions/${sessionId}`, {
        method: 'GET'
      });

      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.session.id).toBe(sessionId);
    });
  });

  describe('Batch Processing Integration', () => {
    it('should handle batch task creation', async () => {
      const batchTasks = [
        {
          prompt: 'Validate batch task 1',
          data: [{ name: 'Test 1' }],
          selectedRows: [0],
          selectedColumns: ['name']
        },
        {
          prompt: 'Validate batch task 2',
          data: [{ name: 'Test 2' }],
          selectedRows: [0],
          selectedColumns: ['name']
        }
      ];

      const request = new Request('http://localhost/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: batchTasks,
          sessionId: 'batch_session_123'
        })
      });

      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.batchId).toBeDefined();
      expect(result.taskIds).toHaveLength(2);
      expect(result.taskCount).toBe(2);
    });

    it('should retrieve batch status', async () => {
      const batchId = 'batch_status_test_123';

      // Mock task service for batch status
      vi.doMock('../db/tasks', () => ({
        TaskService: vi.fn().mockImplementation(() => ({
          getBatchStatus: vi.fn().mockResolvedValue({
            pending: 0,
            processing: 1,
            completed: 1,
            failed: 0
          }),
          getTasksByBatchId: vi.fn().mockResolvedValue([
            {
              id: 'task_1',
              status: 'completed',
              result: JSON.stringify({ analysis: 'Batch task 1 completed' })
            },
            {
              id: 'task_2',
              status: 'processing',
              result: null
            }
          ])
        }))
      }));

      const request = new Request(`http://localhost/api/batches/${batchId}`, {
        method: 'GET'
      });

      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.batchId).toBe(batchId);
      expect(result.status).toBe('processing');
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent task submissions', async () => {
      const concurrentTasks = 10;
      const requests = Array.from({ length: concurrentTasks }, (_, i) => 
        new Request('http://localhost/api/tasks/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Concurrent task ${i}`,
            data: [{ index: i }],
            selectedRows: [0],
            selectedColumns: ['index']
          })
        })
      );

      const startTime = performance.now();
      const responses = await Promise.all(
        requests.map(request => app.fetch(request, mockEnv))
      );
      const endTime = performance.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle large dataset processing', async () => {
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        data: `large_dataset_item_${i}`,
        value: Math.random() * 1000
      }));

      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Process large dataset',
          data: largeDataset,
          selectedRows: Array.from({ length: 5000 }, (_, i) => i),
          selectedColumns: ['data', 'value']
        })
      });

      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.taskId).toBeDefined();
      expect(result.selectedRowsCount).toBe(5000);
    });
  });

  describe('CORS and Security', () => {
    it('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost/api/tasks/execute', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should handle requests from allowed origins', async () => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175'
      ];

      for (const origin of allowedOrigins) {
        const request = new Request('http://localhost/health', {
          method: 'GET',
          headers: { 'Origin': origin }
        });

        const response = await app.fetch(request, mockEnv);
        expect(response.status).toBe(200);
      }
    });
  });
});