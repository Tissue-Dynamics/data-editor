import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { createClaudeService } from './services/claude';
import { createClaudeBatchService } from './services/claude-batch';
import { TaskStreaming } from './utils/streaming';
import { SessionService } from './db/sessions';
import { TaskService } from './db/tasks';
import { createHash } from './utils/hash';

const app = new Hono<{ Bindings: Env }>();

// In-memory task cache for quick access during streaming
const taskCache = new Map<string, {
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

// Session endpoints
app.get('/api/sessions', async (c) => {
  try {
    const sessionService = new SessionService(c.env.DB, c.env.R2_BUCKET);
    const sessions = await sessionService.listSessions();
    return c.json({ sessions });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return c.json({ error: 'Failed to list sessions' }, 500);
  }
});

app.post('/api/sessions', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, file_name, file_type, data, column_names } = body;
    
    if (!name || !data || !column_names) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const sessionService = new SessionService(c.env.DB, c.env.R2_BUCKET);
    const session = await sessionService.createSession({
      name,
      description,
      file_name,
      file_type,
      data,
      column_names
    });
    
    return c.json({ session });
  } catch (error) {
    console.error('Failed to create session:', error);
    return c.json({ error: 'Failed to create session' }, 500);
  }
});

app.get('/api/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB, c.env.R2_BUCKET);
    
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    
    const snapshot = await sessionService.getSessionData(sessionId);
    if (!snapshot) {
      return c.json({ error: 'Session data not found' }, 404);
    }
    
    return c.json({
      session,
      data: JSON.parse(snapshot.data),
      column_names: JSON.parse(snapshot.column_names)
    });
  } catch (error) {
    console.error('Failed to get session:', error);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

app.delete('/api/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionService = new SessionService(c.env.DB, c.env.R2_BUCKET);
    
    await sessionService.deleteSession(sessionId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return c.json({ error: 'Failed to delete session' }, 500);
  }
});

// Streaming endpoint for real-time task updates
app.get('/api/tasks/:taskId/stream', async (c) => {
  const taskId = c.req.param('taskId');
  
  // Set up Server-Sent Events headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  // Create a readable stream for SSE
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(c) {
      controller = c;
      
      // Send connection confirmation
      const connectionMsg = `data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`;
      controller.enqueue(encoder.encode(connectionMsg));

      // Register for real-time events
      const unsubscribe = TaskStreaming.addStream(taskId, (event) => {
        try {
          const eventMsg = `data: ${JSON.stringify({
            type: 'task_event',
            event: event
          })}\n\n`;
          controller.enqueue(encoder.encode(eventMsg));
        } catch (error) {
          console.error('Stream write error:', error);
        }
      });

      // Monitor task completion
      const pollCompletion = setInterval(async () => {
        const task = taskCache.get(taskId);
        if (!task) {
          // Check database if not in cache
          const taskService = new TaskService(c.env.DB);
          const dbTask = await taskService.getTask(taskId);
          if (!dbTask) {
            try {
              const errorMsg = `data: ${JSON.stringify({ type: 'error', message: 'Task not found' })}\n\n`;
              controller.enqueue(encoder.encode(errorMsg));
            } catch (error) {
              console.error('Stream write error:', error);
            }
            clearInterval(pollCompletion);
            unsubscribe();
            controller.close();
            return;
          }
        }

        if (task.status === 'completed' || task.status === 'failed') {
          try {
            const completeMsg = `data: ${JSON.stringify({
              type: 'task_complete',
              status: task.status,
              result: task.result,
              taskId: taskId
            })}\n\n`;
            controller.enqueue(encoder.encode(completeMsg));
          } catch (error) {
            console.error('Stream write error:', error);
          }
          clearInterval(pollCompletion);
          unsubscribe();
          TaskStreaming.removeTask(taskId);
          controller.close();
        }
      }, 1000);

      // Store cleanup function for potential later use
      (c as any).cleanup = () => {
        clearInterval(pollCompletion);
        unsubscribe();
        try {
          controller.close();
        } catch (error) {
          // Stream already closed
        }
      };
    },
    cancel() {
      // Cleanup when client disconnects
      console.log(`Stream cancelled for task ${taskId}`);
    }
  });

  return new Response(stream, { headers });
});

// Batch task execution endpoint (for rate limit handling)
app.post('/api/tasks/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { tasks, sessionId } = body; // Array of task requests and optional sessionId
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return c.json({ error: 'Tasks array is required' }, 400);
    }
    
    const taskService = new TaskService(c.env.DB);
    
    // Create tasks in database
    const createdTasks = [];
    
    for (const task of tasks) {
      const dataHash = createHash(JSON.stringify(task.data));
      
      // Create task in database
      const createdTask = await taskService.createTask({
        prompt: task.prompt,
        data_hash: dataHash,
        selected_rows: task.selectedRows,
        selected_columns: task.selectedColumns,
        session_id: sessionId
      });
      
      createdTasks.push(createdTask);
      
      // Also cache for quick access
      const cachedTask = {
        id: createdTask.id,
        status: 'pending' as const,
        prompt: task.prompt,
        createdAt: new Date(),
      };
      taskCache.set(createdTask.id, cachedTask);
    }
    
    // Link tasks to batch
    const batchId = await taskService.createBatch(createdTasks.map(t => t.id));
    
    // Process tasks with delay to avoid rate limits
    let delay = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const createdTask = createdTasks[i];
      
      // Process each task with a 2 second delay between them
      setTimeout(() => {
        c.executionCtx.waitUntil(
          processTask(
            createdTask.id,
            task.prompt,
            task.data,
            task.selectedRows,
            task.selectedColumns,
            c.env,
            sessionId
          )
        );
      }, delay);
      
      delay += 2000; // 2 seconds between tasks
    }
    
    return c.json({
      batchId,
      taskIds: createdTasks.map(t => t.id),
      taskCount: tasks.length,
      message: 'Batch created successfully. Tasks will be processed with delays to avoid rate limits.'
    });
  } catch (error) {
    console.error('Failed to create batch:', error);
    return c.json({ error: 'Failed to create batch' }, 500);
  }
});

// Get batch status
app.get('/api/batches/:batchId', async (c) => {
  try {
    const batchId = c.req.param('batchId');
    const taskService = new TaskService(c.env.DB);
    
    // Get batch status from database
    const batchStatus = await taskService.getBatchStatus(batchId);
    const tasks = await taskService.getTasksByBatchId(batchId);
    
    // Map tasks to include parsed results
    const tasksWithResults = tasks.map(task => ({
      ...task,
      result: task.result ? JSON.parse(task.result) : null
    }));
    
    return c.json({
      batchId,
      status: batchStatus.pending > 0 || batchStatus.processing > 0 ? 'processing' : 'completed',
      counts: batchStatus,
      tasks: tasksWithResults
    });
  } catch (error) {
    console.error('Failed to get batch status:', error);
    return c.json({ error: 'Failed to get batch status' }, 500);
  }
});

// Main task execution endpoint (single task)
app.post('/api/tasks/execute', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, selectedRows, selectedColumns, data } = body;

    if (!prompt?.trim()) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    // Create task record in database
    const dataHash = createHash(JSON.stringify(data));
    
    // Get session ID from body if provided
    const sessionId = body.sessionId;
    
    // Create task in database
    const taskService = new TaskService(c.env.DB);
    const createdTask = await taskService.createTask({
      prompt,
      data_hash: dataHash,
      selected_rows: selectedRows,
      selected_columns: selectedColumns,
      session_id: sessionId
    });
    
    const taskId = createdTask.id;
    
    // Also cache for quick access
    const task = {
      id: taskId,
      status: 'pending' as const,
      prompt,
      createdAt: new Date(),
    };
    taskCache.set(taskId, task);

    // Start background processing
    c.executionCtx.waitUntil(processTask(taskId, prompt, data, selectedRows, selectedColumns, c.env, sessionId));

    return c.json({
      taskId,
      status: 'pending',
      message: `Task created: "${prompt}"`,
      selectedRowsCount: selectedRows?.length || 0,
      selectedColumnsCount: selectedColumns?.length || 0,
    });
  } catch (error) {
    console.error('Task execution error:', error);
    if (error instanceof Error) {
      return c.json({ error: `Invalid request: ${error.message}` }, 400);
    }
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
  env?: Env,
  sessionId?: string
) {
  const task = taskCache.get(taskId);
  if (!task) return;
  
  const taskService = new TaskService(env?.DB!);

  try {
    console.log(`[Task ${taskId}] Starting analysis...`);
    console.log(`[Task ${taskId}] Prompt: "${prompt}"`);
    console.log(`[Task ${taskId}] Data rows: ${data?.length || 0}`);
    console.log(`[Task ${taskId}] Selected rows: ${selectedRows?.length || 0}`);
    console.log(`[Task ${taskId}] Selected columns: ${selectedColumns?.join(', ') || 'none'}`);

    // Emit analysis start event with context
    TaskStreaming.emitAnalysisStart(taskId, `Processing request: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

    // Update status to processing
    task.status = 'processing';
    taskCache.set(taskId, task);
    await taskService.updateTask(taskId, { status: 'processing' });

    // Create Claude service
    const claudeService = createClaudeService(env || {} as Env);

    // Analyze data with Claude
    console.log(`[Task ${taskId}] Calling Claude...`);
    TaskStreaming.emitAnalysisStart(taskId, `Analyzing ${data?.length || 0} rows${selectedColumns?.length ? ` across ${selectedColumns.length} columns` : ''}`);
    
    let result;
    try {
      result = await claudeService.analyzeData(
        prompt,
        data || [],
        selectedRows,
        selectedColumns,
        taskId // Pass taskId for streaming
      );
      console.log(`[Task ${taskId}] Claude analysis completed!`);
    } catch (claudeError) {
      console.error(`[Task ${taskId}] Claude analysis failed:`, claudeError);
      throw claudeError;
    }
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
    taskCache.set(taskId, task);
    
    // Persist to database
    await taskService.updateTask(taskId, {
      status: 'completed',
      analysis: result.analysis,
      method: result.method,
      result: JSON.stringify(result)
    });
    
    console.log(`[Task ${taskId}] Task completed successfully`);

  } catch (error) {
    console.error(`[Task ${taskId}] Error:`, error);
    // Update task with error
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.completedAt = new Date();
    taskCache.set(taskId, task);
    
    // Persist to database
    await taskService.updateTask(taskId, {
      status: 'failed',
      error_message: task.error
    });
  }
}

// Get tasks by session ID
app.get('/api/sessions/:sessionId/tasks', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const taskService = new TaskService(c.env.DB);
    
    const tasks = await taskService.getTasksBySessionId(sessionId);
    
    return c.json({
      tasks: tasks.map(task => ({
        id: task.id,
        prompt: task.prompt,
        status: task.status,
        created_at: new Date(task.created_at).toISOString(),
        completed_at: task.completed_at ? new Date(task.completed_at).toISOString() : undefined,
        execution_time_ms: task.execution_time_ms,
        analysis: task.analysis,
        error_message: task.error_message
      }))
    });
  } catch (error) {
    console.error('Failed to get session tasks:', error);
    return c.json({ error: 'Failed to get session tasks' }, 500);
  }
});

// Get task status endpoint
app.get('/api/tasks/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  
  // First check cache
  const cachedTask = taskCache.get(taskId);
  if (cachedTask) {
    return c.json({
      taskId: cachedTask.id,
      status: cachedTask.status,
      result: cachedTask.result,
      error: cachedTask.error,
      createdAt: cachedTask.createdAt.toISOString(),
      completedAt: cachedTask.completedAt?.toISOString(),
    });
  }
  
  // Fall back to database
  const taskService = new TaskService(c.env.DB);
  const task = await taskService.getTask(taskId);
  
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }
  
  return c.json({
    taskId: task.id,
    status: task.status,
    result: task.result ? JSON.parse(task.result) : undefined,
    error: task.error_message,
    createdAt: new Date(task.created_at).toISOString(),
    completedAt: task.completed_at ? new Date(task.completed_at).toISOString() : undefined,
  });
});

export default app;