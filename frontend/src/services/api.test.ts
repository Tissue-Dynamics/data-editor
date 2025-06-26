import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, ApiError } from './api';
import type { TaskRequest, TaskResponse } from '../types/tasks';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service', () => {
  const mockApiUrl = 'http://localhost:8787';
  const originalEnv = import.meta.env;

  beforeEach(() => {
    // Reset fetch mock
    mockFetch.mockReset();
    // Set test environment
    import.meta.env = { ...originalEnv, VITE_API_URL: mockApiUrl };
  });

  afterEach(() => {
    // Restore environment
    import.meta.env = originalEnv;
  });

  describe('executeTask', () => {
    const mockTaskRequest: TaskRequest = {
      prompt: 'Validate this data',
      selectedRows: [0, 1, 2],
      selectedColumns: ['email', 'name'],
      data: [
        { email: 'test@example.com', name: 'John' },
        { email: 'invalid-email', name: 'Jane' },
      ],
    };

    const mockTaskResponse: TaskResponse = {
      taskId: 'task-123',
      status: 'pending',
      message: 'Task created successfully',
      selectedRowsCount: 3,
      selectedColumnsCount: 2,
    };

    it('should make correct API call for task execution', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse),
      });

      const result = await api.executeTask(mockTaskRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/tasks/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockTaskRequest),
        }
      );
      expect(result).toEqual(mockTaskResponse);
    });

    it('should handle successful response with all fields', async () => {
      const fullResponse: TaskResponse = {
        ...mockTaskResponse,
        result: {
          analysis: 'Data validation complete',
          method: 'anthropic-api' as const,
          validations: [
            {
              rowIndex: 1,
              columnId: 'email',
              status: 'error',
              originalValue: 'invalid-email',
              suggestedValue: 'invalid-email@example.com',
              reason: 'Missing @ symbol and domain',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fullResponse),
      });

      const result = await api.executeTask(mockTaskRequest);
      expect(result).toEqual(fullResponse);
    });

    it('should throw ApiError for HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request body'),
      });

      await expect(api.executeTask(mockTaskRequest)).rejects.toThrow(ApiError);
      await expect(api.executeTask(mockTaskRequest)).rejects.toThrow('Invalid request body');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.executeTask(mockTaskRequest)).rejects.toThrow('Network error');
    });

    it('should handle empty error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      });

      await expect(api.executeTask(mockTaskRequest)).rejects.toThrow(ApiError);
      await expect(api.executeTask(mockTaskRequest)).rejects.toThrow('Internal Server Error');
    });
  });

  describe('getTaskStatus', () => {
    const mockTaskId = 'task-123';
    const mockStatusResponse: TaskResponse = {
      taskId: mockTaskId,
      status: 'completed',
      result: {
        analysis: 'Analysis complete',
        method: 'anthropic-api' as const,
      },
    };

    it('should make correct API call for task status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatusResponse),
      });

      const result = await api.getTaskStatus(mockTaskId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/tasks/${mockTaskId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockStatusResponse);
    });

    it('should handle different task statuses', async () => {
      const statuses: TaskResponse['status'][] = ['pending', 'processing', 'completed', 'failed'];

      for (const status of statuses) {
        const response: TaskResponse = {
          taskId: mockTaskId,
          status,
          message: `Task is ${status}`,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response),
        });

        const result = await api.getTaskStatus(mockTaskId);
        expect(result.status).toBe(status);
      }
    });

    it('should handle failed task with error message', async () => {
      const errorResponse: TaskResponse = {
        taskId: mockTaskId,
        status: 'failed',
        error: 'Analysis failed: Invalid SMILES structure',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      const result = await api.getTaskStatus(mockTaskId);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Analysis failed: Invalid SMILES structure');
    });

    it('should throw ApiError for 404 task not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Task not found'),
      });

      await expect(api.getTaskStatus(mockTaskId)).rejects.toThrow(ApiError);
      await expect(api.getTaskStatus(mockTaskId)).rejects.toThrow('Task not found');
    });
  });

  describe('checkHealth', () => {
    const mockHealthResponse = {
      status: 'ok',
      timestamp: '2024-01-01T10:00:00.000Z',
    };

    it('should make correct API call for health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthResponse),
      });

      const result = await api.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/health`,
        {
          method: 'GET',
        }
      );
      expect(result).toEqual(mockHealthResponse);
    });

    it('should handle unhealthy service response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('Service temporarily unavailable'),
      });

      await expect(api.checkHealth()).rejects.toThrow(ApiError);
      await expect(api.checkHealth()).rejects.toThrow('Service temporarily unavailable');
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with status and message', () => {
      const error = new ApiError(400, 'Bad Request');
      
      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Environment Configuration', () => {
    it('should use default API URL when VITE_API_URL is not set', async () => {
      import.meta.env = { ...originalEnv, VITE_API_URL: undefined };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() }),
      });

      await api.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/health',
        expect.any(Object)
      );
    });

    it('should use custom API URL when VITE_API_URL is set', async () => {
      const customUrl = 'https://custom-api.example.com';
      import.meta.env = { ...originalEnv, VITE_API_URL: customUrl };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() }),
      });

      await api.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        `${customUrl}/health`,
        expect.any(Object)
      );
    });
  });
});