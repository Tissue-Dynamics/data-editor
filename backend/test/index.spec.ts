import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Data Editor API', () => {
  let ctx: ExecutionContext;

  beforeEach(() => {
    ctx = createExecutionContext();
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const request = new IncomingRequest('http://localhost:8787/health');
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should have correct content type', async () => {
      const request = new IncomingRequest('http://localhost:8787/health');
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Task Execution Endpoint', () => {
    it('should create a task with valid request', async () => {
      const taskRequest = {
        prompt: 'Validate email addresses in the email column',
        selectedRows: [0, 1, 2],
        selectedColumns: ['email'],
        data: [
          { id: 1, email: 'test@example.com' },
          { id: 2, email: 'invalid-email' },
          { id: 3, email: 'user@domain.co' }
        ]
      };

      const request = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskRequest)
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('taskId');
      expect(typeof data.taskId).toBe('string');
      expect(data.taskId).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(data).toHaveProperty('status', 'pending');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Validate email addresses in the email column');
      expect(data).toHaveProperty('selectedRowsCount', 3);
      expect(data).toHaveProperty('selectedColumnsCount', 1);
    });

    it('should handle minimal request', async () => {
      const taskRequest = {
        prompt: 'Analyze this data'
      };

      const request = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskRequest)
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('taskId');
      expect(data).toHaveProperty('status', 'pending');
      expect(data).toHaveProperty('selectedRowsCount', 0);
      expect(data).toHaveProperty('selectedColumnsCount', 0);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json'
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid request body');
    });

    it('should return 400 for empty body', async () => {
      const request = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ''
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid request body');
    });
  });

  describe('Task Status Endpoint', () => {
    it('should return 404 for non-existent task ID', async () => {
      const taskId = 'non-existent-task-123';
      const request = new IncomingRequest(`http://localhost:8787/api/tasks/${taskId}`);
      
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Task not found');
    });

    it('should return 404 for UUID format task IDs that don\'t exist', async () => {
      const taskId = '123e4567-e89b-12d3-a456-426614174000';
      const request = new IncomingRequest(`http://localhost:8787/api/tasks/${taskId}`);
      
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Task not found');
    });

    it('should return task status for created task', async () => {
      // First create a task
      const taskRequest = {
        prompt: 'Test task for status check'
      };

      const createRequest = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskRequest)
      });

      const createResponse = await worker.fetch(createRequest, env, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(createResponse.status).toBe(200);
      const createData = await createResponse.json();
      const taskId = createData.taskId;

      // Then check its status
      const statusRequest = new IncomingRequest(`http://localhost:8787/api/tasks/${taskId}`);
      const statusResponse = await worker.fetch(statusRequest, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(statusResponse.status).toBe(200);
      const statusData = await statusResponse.json();
      expect(statusData).toHaveProperty('taskId', taskId);
      expect(statusData).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(statusData.status);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers for OPTIONS request', async () => {
      const request = new IncomingRequest('http://localhost:8787/api/tasks/execute', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:5173' }
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('should include CORS headers for actual requests', async () => {
      const request = new IncomingRequest('http://localhost:8787/health', {
        headers: { 'Origin': 'http://localhost:5173' }
      });

      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const request = new IncomingRequest('http://localhost:8787/unknown');
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it('should handle POST to health endpoint', async () => {
      const request = new IncomingRequest('http://localhost:8787/health', {
        method: 'POST'
      });
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404); // Hono returns 404 for unmatched routes
    });
  });
});