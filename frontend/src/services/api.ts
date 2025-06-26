import type { TaskRequest, TaskResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.text();
    console.error(`API Error: ${response.status} ${response.statusText}`, error);
    throw new ApiError(response.status, error || response.statusText);
  }
  return response.json();
}

export const api = {
  async executeTask(request: TaskRequest): Promise<TaskResponse> {
    try {
      console.log(`Making API request to: ${API_URL}/api/tasks/execute`);
      const response = await fetch(`${API_URL}/api/tasks/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      return handleResponse<TaskResponse>(response);
    } catch (error) {
      console.error('Network error in executeTask:', error);
      throw error;
    }
  },

  async getTaskStatus(taskId: string): Promise<TaskResponse> {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<TaskResponse>(response);
  },

  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
    });
    return handleResponse(response);
  },
};