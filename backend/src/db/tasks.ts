import type { D1Database } from '@cloudflare/workers-types';
import { generateId } from '../utils/id';

export interface Task {
  id: string;
  prompt: string;
  data_hash: string;
  selected_rows?: string; // JSON array
  selected_columns?: string; // JSON array
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method?: string;
  analysis?: string;
  error_message?: string;
  created_at: number;
  completed_at?: number;
  execution_time_ms?: number;
  user_id?: string;
  session_id?: string;
  batch_id?: string; // For batch processing
  result?: string; // JSON string of the full result
}

export class TaskService {
  constructor(private db: D1Database) {}

  async createTask(params: {
    prompt: string;
    data_hash: string;
    selected_rows?: number[];
    selected_columns?: string[];
    session_id?: string;
    batch_id?: string;
  }): Promise<Task> {
    const id = generateId();
    const now = Date.now();
    
    const task: Task = {
      id,
      prompt: params.prompt,
      data_hash: params.data_hash,
      selected_rows: params.selected_rows ? JSON.stringify(params.selected_rows) : undefined,
      selected_columns: params.selected_columns ? JSON.stringify(params.selected_columns) : undefined,
      status: 'pending',
      created_at: now,
      session_id: params.session_id,
      batch_id: params.batch_id,
    };
    
    await this.db.prepare(`
      INSERT INTO tasks (
        id, prompt, data_hash, selected_rows, selected_columns,
        status, created_at, session_id, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      task.id,
      task.prompt,
      task.data_hash,
      task.selected_rows || null,
      task.selected_columns || null,
      task.status,
      task.created_at,
      task.session_id || null,
      task.batch_id || null
    ).run();
    
    return task;
  }

  async updateTask(
    taskId: string,
    updates: Partial<Pick<Task, 'status' | 'analysis' | 'error_message' | 'method' | 'result'>>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    
    if (updates.analysis !== undefined) {
      setClauses.push('analysis = ?');
      values.push(updates.analysis);
    }
    
    if (updates.error_message !== undefined) {
      setClauses.push('error_message = ?');
      values.push(updates.error_message);
    }
    
    if (updates.method !== undefined) {
      setClauses.push('method = ?');
      values.push(updates.method);
    }
    
    if (updates.result !== undefined) {
      setClauses.push('result = ?');
      values.push(updates.result);
    }
    
    // Handle completion
    if (updates.status === 'completed' || updates.status === 'failed') {
      const completedAt = Date.now();
      setClauses.push('completed_at = ?');
      values.push(completedAt);
      
      // Calculate execution time
      const task = await this.getTask(taskId);
      if (task) {
        setClauses.push('execution_time_ms = ?');
        values.push(completedAt - task.created_at);
      }
    }
    
    if (setClauses.length === 0) return;
    
    values.push(taskId);
    
    await this.db.prepare(`
      UPDATE tasks 
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
  }

  async getTask(taskId: string): Promise<Task | null> {
    const result = await this.db.prepare(
      'SELECT * FROM tasks WHERE id = ?'
    ).bind(taskId).first();
    
    return result as Task | null;
  }

  async getTasksBySessionId(sessionId: string): Promise<Task[]> {
    const result = await this.db.prepare(`
      SELECT * FROM tasks 
      WHERE session_id = ?
      ORDER BY created_at DESC
    `).bind(sessionId).all();
    
    return (result.results || []) as Task[];
  }

  async getTasksByBatchId(batchId: string): Promise<Task[]> {
    const result = await this.db.prepare(`
      SELECT * FROM tasks 
      WHERE batch_id = ?
      ORDER BY created_at DESC
    `).bind(batchId).all();
    
    return (result.results || []) as Task[];
  }

  async getPendingTasks(limit: number = 10): Promise<Task[]> {
    const result = await this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(limit).all();
    
    return (result.results || []) as Task[];
  }

  async getRecentTasks(sessionId?: string, limit: number = 20): Promise<Task[]> {
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];
    
    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const result = await this.db.prepare(query).bind(...params).all();
    
    return (result.results || []) as Task[];
  }

  async createBatch(taskIds: string[]): Promise<string> {
    const batchId = generateId();
    
    // Update all tasks with the batch ID
    await this.db.prepare(`
      UPDATE tasks 
      SET batch_id = ?
      WHERE id IN (${taskIds.map(() => '?').join(',')})
    `).bind(batchId, ...taskIds).run();
    
    return batchId;
  }

  async getBatchStatus(batchId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM tasks
      WHERE batch_id = ?
    `).bind(batchId).first();
    
    return result as any;
  }
}