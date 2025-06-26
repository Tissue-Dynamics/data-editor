import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { createClaudeService } from './services/claude';
import { TaskStreaming } from './utils/streaming';

const app = new Hono<{ Bindings: Env }>();

// Simple in-memory task storage (will be replaced with D1 later)
const tasks = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}>();

// Configure CORS to allow requests from the frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], // Vite dev server ports
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Streaming endpoint for real-time task updates
app.get('/api/tasks/:taskId/stream', async (c) => {
  const taskId = c.req.param('taskId');
  
  // Set up Server-Sent Events
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  return c.streamText(async (stream) => {
    // Send connection confirmation
    stream.writeln(`data: ${JSON.stringify({ type: 'connected', taskId })}\n`);

    // Register for real-time events
    const unsubscribe = TaskStreaming.addStream(taskId, (event) => {
      stream.writeln(`data: ${JSON.stringify({
        type: 'task_event',
        event: event
      })}\n`);
    });

    // Also monitor task completion
    const pollCompletion = setInterval(async () => {
      const task = tasks.get(taskId);
      if (!task) {
        stream.writeln(`data: ${JSON.stringify({ type: 'error', message: 'Task not found' })}\n`);
        clearInterval(pollCompletion);
        unsubscribe();
        return;
      }

      if (task.status === 'completed' || task.status === 'failed') {
        stream.writeln(`data: ${JSON.stringify({
          type: 'task_complete',
          status: task.status,
          result: task.result,
          taskId: taskId
        })}\n`);
        clearInterval(pollCompletion);
        unsubscribe();
        TaskStreaming.removeTask(taskId);
      }
    }, 1000);

    // Clean up on stream close
    stream.onAbort(() => {
      clearInterval(pollCompletion);
      unsubscribe();
    });
  });
});

// Main task execution endpoint
app.post('/api/tasks/execute', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, selectedRows, selectedColumns, data } = body;

    if (!prompt?.trim()) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    // Create task record
    const taskId = crypto.randomUUID();
    const task = {
      id: taskId,
      status: 'pending' as const,
      prompt,
      createdAt: new Date(),
    };
    tasks.set(taskId, task);

    // Start background processing
    c.executionCtx.waitUntil(processTask(taskId, prompt, data, selectedRows, selectedColumns, c.env));

    return c.json({
      taskId,
      status: 'pending',
      message: `Task created: "${prompt}"`,
      selectedRowsCount: selectedRows?.length || 0,
      selectedColumnsCount: selectedColumns?.length || 0,
    });
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

// Background task processing function
async function processTask(
  taskId: string,
  prompt: string,
  data: Record<string, any>[],
  selectedRows?: number[],
  selectedColumns?: string[],
  env?: Env
) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    console.log(`[Task ${taskId}] Starting analysis...`);
    console.log(`[Task ${taskId}] Prompt: "${prompt}"`);
    console.log(`[Task ${taskId}] Data rows: ${data?.length || 0}`);
    console.log(`[Task ${taskId}] Selected rows: ${selectedRows?.length || 0}`);
    console.log(`[Task ${taskId}] Selected columns: ${selectedColumns?.join(', ') || 'none'}`);

    // Emit analysis start event
    TaskStreaming.emitAnalysisStart(taskId, 'Initializing data analysis');

    // Update status to processing
    task.status = 'processing';
    tasks.set(taskId, task);

    // Create Claude service
    const claudeService = createClaudeService(env || {} as Env);

    // Analyze data with Claude
    console.log(`[Task ${taskId}] Calling Claude...`);
    TaskStreaming.emitAnalysisStart(taskId, 'Starting Claude analysis with web search and code execution');
    
    const result = await claudeService.analyzeData(
      prompt,
      data || [],
      selectedRows,
      selectedColumns,
      taskId // Pass taskId for streaming
    );

    console.log(`[Task ${taskId}] Claude analysis completed!`);
    console.log(`[Task ${taskId}] Method used: ${result.method}`);
    console.log(`[Task ${taskId}] Analysis preview: ${result.analysis.substring(0, 200)}...`);
    
    if (result.validations && result.validations.length > 0) {
      console.log(`[Task ${taskId}] Found ${result.validations.length} validations:`);
      result.validations.forEach((v, i) => {
        console.log(`[Task ${taskId}]   ${i + 1}. Row ${v.rowIndex}, ${v.columnId}: ${v.status} - ${v.reason}`);
      });
    } else {
      console.log(`[Task ${taskId}] No structured validations found`);
    }

    // Update task with results
    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date();
    tasks.set(taskId, task);
    
    console.log(`[Task ${taskId}] Task completed successfully`);

  } catch (error) {
    console.error(`[Task ${taskId}] Error:`, error);
    // Update task with error
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.completedAt = new Date();
    tasks.set(taskId, task);
  }
}

// Get task status endpoint
app.get('/api/tasks/:taskId', (c) => {
  const taskId = c.req.param('taskId');
  const task = tasks.get(taskId);
  
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  return c.json({
    taskId: task.id,
    status: task.status,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString(),
  });
});

export default app;