import type { TaskRequest, TaskResponse } from '../types';
import type { SessionInfo } from '../components/SessionsList/SessionsList';

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
    
    // Try to parse as JSON for structured errors
    let errorMessage = error || response.statusText;
    try {
      const errorObj = JSON.parse(error);
      if (errorObj.error) {
        errorMessage = typeof errorObj.error === 'string' ? errorObj.error : JSON.stringify(errorObj.error);
      }
    } catch (e) {
      // Keep original error text
    }
    
    throw new ApiError(response.status, errorMessage);
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

  // Session management
  async listSessions(): Promise<{ sessions: SessionInfo[] }> {
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  async createSession(params: {
    name: string;
    description?: string;
    file_name?: string;
    file_type?: string;
    data: any[];
    column_names: string[];
  }): Promise<{ session: SessionInfo }> {
    const response = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return handleResponse(response);
  },

  async getSession(sessionId: string): Promise<{
    session: SessionInfo;
    data: any[];
    column_names: string[];
  }> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
  
  async getSessionTasks(sessionId: string): Promise<{
    tasks: Array<{
      id: string;
      prompt: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      created_at: string;
      completed_at?: string;
      execution_time_ms?: number;
      analysis?: string;
      error_message?: string;
    }>;
  }> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tasks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
  
  async createBatch(params: {
    tasks: Array<{
      prompt: string;
      selectedRows?: number[];
      selectedColumns?: string[];
      data: any[];
    }>;
    sessionId?: string;
  }): Promise<{
    batchId: string;
    claudeBatchId: string;
    taskIds: string[];
    taskCount: number;
    message: string;
  }> {
    const response = await fetch(`${API_URL}/api/tasks/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return handleResponse(response);
  },
  
  async getBatchStatus(batchId: string): Promise<{
    batchId: string;
    status: string;
    counts: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    tasks: any[];
  }> {
    const response = await fetch(`${API_URL}/api/batches/${batchId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },
};