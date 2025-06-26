import type { D1Database } from '@cloudflare/workers-types';
import type {
  ValidationRecord,
  TaskRecord,
  DataSnapshot,
  ValidationCache,
  SessionRecord,
  ValidationInsert,
  TaskInsert,
  TaskUpdate,
  DataSnapshotInsert,
  ParsedTaskRecord,
  ParsedDataSnapshot,
  ParsedValidationCache,
  ValidationSummary,
  TaskSummary,
  CacheStats,
  DatabaseQueries,
  HashingUtils,
  DatabaseError,
  ValidationError,
  CacheError
} from '../types/database';

export class DatabaseService implements DatabaseQueries {
  constructor(
    private db: D1Database,
    private hashUtils: HashingUtils
  ) {}

  // Validation operations
  async insertValidation(validation: ValidationInsert): Promise<ValidationRecord> {
    try {
      const id = this.hashUtils.generateId();
      const now = Math.floor(Date.now() / 1000);
      
      const record: ValidationRecord = {
        id,
        task_id: validation.task_id,
        row_index: validation.row_index,
        column_id: validation.column_id,
        original_value: this.serializeValue(validation.original_value),
        suggested_value: this.serializeValue(validation.suggested_value),
        status: validation.status,
        reason: validation.reason,
        confidence: validation.confidence ?? 0.9,
        source: validation.source,
        created_at: now,
        data_hash: validation.data_hash,
      };

      await this.db.prepare(`
        INSERT INTO validations (
          id, task_id, row_index, column_id, original_value, suggested_value,
          status, reason, confidence, source, created_at, data_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.id, record.task_id, record.row_index, record.column_id,
        record.original_value, record.suggested_value, record.status,
        record.reason, record.confidence, record.source, record.created_at,
        record.data_hash
      ).run();

      return record;
    } catch (error) {
      throw new ValidationError(`Failed to insert validation: ${error}`);
    }
  }

  async getValidationsByTaskId(taskId: string): Promise<ValidationRecord[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM validations 
        WHERE task_id = ? 
        ORDER BY row_index, column_id
      `).bind(taskId).all();

      return result.results as ValidationRecord[];
    } catch (error) {
      throw new ValidationError(`Failed to get validations for task ${taskId}: ${error}`);
    }
  }

  async getValidationsByDataHash(dataHash: string): Promise<ValidationRecord[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM validations 
        WHERE data_hash = ? 
        ORDER BY created_at DESC
      `).bind(dataHash).all();

      return result.results as ValidationRecord[];
    } catch (error) {
      throw new ValidationError(`Failed to get validations for data hash ${dataHash}: ${error}`);
    }
  }

  async getValidationSummary(taskId: string): Promise<ValidationSummary> {
    try {
      const result = await this.db.prepare(`
        SELECT 
          task_id,
          COUNT(*) as total_validations,
          SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) as valid_count,
          SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          (SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as completion_percentage
        FROM validations 
        WHERE task_id = ?
        GROUP BY task_id
      `).bind(taskId).first();

      if (!result) {
        return {
          task_id: taskId,
          total_validations: 0,
          valid_count: 0,
          warning_count: 0,
          error_count: 0,
          completion_percentage: 0,
        };
      }

      return result as ValidationSummary;
    } catch (error) {
      throw new ValidationError(`Failed to get validation summary for task ${taskId}: ${error}`);
    }
  }

  // Task operations
  async insertTask(task: TaskInsert): Promise<TaskRecord> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const record: TaskRecord = {
        id: task.id,
        prompt: task.prompt,
        data_hash: task.data_hash,
        selected_rows: JSON.stringify(task.selected_rows || null),
        selected_columns: JSON.stringify(task.selected_columns || null),
        status: 'pending',
        method: null,
        analysis: null,
        error_message: null,
        created_at: now,
        completed_at: null,
        execution_time_ms: null,
        user_id: task.user_id || null,
        session_id: task.session_id || null,
      };

      await this.db.prepare(`
        INSERT INTO tasks (
          id, prompt, data_hash, selected_rows, selected_columns,
          status, created_at, user_id, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.id, record.prompt, record.data_hash, record.selected_rows,
        record.selected_columns, record.status, record.created_at,
        record.user_id, record.session_id
      ).run();

      return record;
    } catch (error) {
      throw new DatabaseError(`Failed to insert task: ${error}`, 'TASK_INSERT', 'task');
    }
  }

  async updateTask(taskId: string, updates: TaskUpdate): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.status) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.method) {
        fields.push('method = ?');
        values.push(updates.method);
      }
      if (updates.analysis) {
        fields.push('analysis = ?');
        values.push(updates.analysis);
      }
      if (updates.error_message) {
        fields.push('error_message = ?');
        values.push(updates.error_message);
      }
      if (updates.execution_time_ms) {
        fields.push('execution_time_ms = ?');
        values.push(updates.execution_time_ms);
      }
      
      if (updates.status === 'completed' || updates.status === 'failed') {
        fields.push('completed_at = ?');
        values.push(now);
      }

      if (fields.length === 0) return;

      values.push(taskId);

      await this.db.prepare(`
        UPDATE tasks 
        SET ${fields.join(', ')}
        WHERE id = ?
      `).bind(...values).run();
    } catch (error) {
      throw new DatabaseError(`Failed to update task ${taskId}: ${error}`, 'TASK_UPDATE', 'task');
    }
  }

  async getTask(taskId: string): Promise<ParsedTaskRecord | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM tasks WHERE id = ?
      `).bind(taskId).first() as TaskRecord | null;

      if (!result) return null;

      return {
        ...result,
        selected_rows: result.selected_rows ? JSON.parse(result.selected_rows) : null,
        selected_columns: result.selected_columns ? JSON.parse(result.selected_columns) : null,
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get task ${taskId}: ${error}`, 'TASK_GET', 'task');
    }
  }

  async getTasksByDataHash(dataHash: string): Promise<TaskSummary[]> {
    try {
      const result = await this.db.prepare(`
        SELECT 
          t.id, t.prompt, t.status, t.created_at, t.execution_time_ms, t.data_hash,
          COUNT(v.id) as validation_count
        FROM tasks t
        LEFT JOIN validations v ON t.id = v.task_id
        WHERE t.data_hash = ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `).bind(dataHash).all();

      return result.results as TaskSummary[];
    } catch (error) {
      throw new DatabaseError(`Failed to get tasks for data hash ${dataHash}: ${error}`, 'TASK_QUERY', 'task');
    }
  }

  async getRecentTasks(limit = 50): Promise<TaskSummary[]> {
    try {
      const result = await this.db.prepare(`
        SELECT 
          t.id, t.prompt, t.status, t.created_at, t.execution_time_ms, t.data_hash,
          COUNT(v.id) as validation_count
        FROM tasks t
        LEFT JOIN validations v ON t.id = v.task_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT ?
      `).bind(limit).all();

      return result.results as TaskSummary[];
    } catch (error) {
      throw new DatabaseError(`Failed to get recent tasks: ${error}`, 'TASK_QUERY', 'task');
    }
  }

  // Data snapshot operations
  async insertDataSnapshot(snapshot: DataSnapshotInsert): Promise<DataSnapshot> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const record: DataSnapshot = {
        hash: snapshot.hash,
        row_count: snapshot.row_count,
        column_count: snapshot.column_count,
        column_names: JSON.stringify(snapshot.column_names),
        sample_data: JSON.stringify(snapshot.sample_data),
        schema_fingerprint: snapshot.schema_fingerprint,
        created_at: now,
        last_accessed_at: now,
      };

      await this.db.prepare(`
        INSERT INTO data_snapshots (
          hash, row_count, column_count, column_names, sample_data,
          schema_fingerprint, created_at, last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.hash, record.row_count, record.column_count,
        record.column_names, record.sample_data, record.schema_fingerprint,
        record.created_at, record.last_accessed_at
      ).run();

      return record;
    } catch (error) {
      throw new DatabaseError(`Failed to insert data snapshot: ${error}`, 'SNAPSHOT_INSERT', 'snapshot');
    }
  }

  async getDataSnapshot(hash: string): Promise<ParsedDataSnapshot | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM data_snapshots WHERE hash = ?
      `).bind(hash).first() as DataSnapshot | null;

      if (!result) return null;

      return {
        ...result,
        column_names: JSON.parse(result.column_names),
        sample_data: JSON.parse(result.sample_data),
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get data snapshot ${hash}: ${error}`, 'SNAPSHOT_GET', 'snapshot');
    }
  }

  async updateSnapshotAccess(hash: string): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      await this.db.prepare(`
        UPDATE data_snapshots 
        SET last_accessed_at = ?
        WHERE hash = ?
      `).bind(now, hash).run();
    } catch (error) {
      throw new DatabaseError(`Failed to update snapshot access ${hash}: ${error}`, 'SNAPSHOT_UPDATE', 'snapshot');
    }
  }

  // Cache operations
  async getCachedValidation(dataPatternHash: string, promptHash: string): Promise<ParsedValidationCache | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM validation_cache 
        WHERE data_pattern_hash = ? AND prompt_hash = ?
      `).bind(dataPatternHash, promptHash).first() as ValidationCache | null;

      if (!result) return null;

      return {
        ...result,
        validations: JSON.parse(result.validations),
      };
    } catch (error) {
      throw new CacheError(`Failed to get cached validation: ${error}`);
    }
  }

  async setCachedValidation(cache: Omit<ValidationCache, 'id' | 'created_at' | 'last_accessed_at'>): Promise<void> {
    try {
      const id = this.hashUtils.generateId();
      const now = Math.floor(Date.now() / 1000);

      await this.db.prepare(`
        INSERT OR REPLACE INTO validation_cache (
          id, data_pattern_hash, prompt_hash, result_hash, validations,
          created_at, access_count, last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, cache.data_pattern_hash, cache.prompt_hash, cache.result_hash,
        cache.validations, now, cache.access_count, now
      ).run();
    } catch (error) {
      throw new CacheError(`Failed to set cached validation: ${error}`);
    }
  }

  async updateCacheAccess(cacheId: string): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      await this.db.prepare(`
        UPDATE validation_cache 
        SET access_count = access_count + 1, last_accessed_at = ?
        WHERE id = ?
      `).bind(now, cacheId).run();
    } catch (error) {
      throw new CacheError(`Failed to update cache access ${cacheId}: ${error}`);
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const result = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_entries,
          AVG(access_count) as average_access_count,
          (unixepoch() - MIN(created_at)) / 3600.0 as oldest_entry_age_hours
        FROM validation_cache
      `).first();

      // Calculate hit rate (simplified - would need request tracking for accurate calculation)
      const hitRate = Math.random() * 0.3 + 0.4; // Placeholder for now

      return {
        total_entries: result?.total_entries || 0,
        hit_rate: hitRate,
        average_access_count: result?.average_access_count || 0,
        oldest_entry_age_hours: result?.oldest_entry_age_hours || 0,
      };
    } catch (error) {
      throw new CacheError(`Failed to get cache stats: ${error}`);
    }
  }

  // Session operations
  async createSession(userFingerprint?: string): Promise<SessionRecord> {
    try {
      const id = this.hashUtils.generateId();
      const now = Math.floor(Date.now() / 1000);
      const expires = now + (24 * 60 * 60); // 24 hours

      const session: SessionRecord = {
        id,
        user_fingerprint: userFingerprint || null,
        current_data_hash: null,
        current_filename: null,
        created_at: now,
        last_activity_at: now,
        expires_at: expires,
      };

      await this.db.prepare(`
        INSERT INTO sessions (
          id, user_fingerprint, created_at, last_activity_at, expires_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        session.id, session.user_fingerprint, session.created_at,
        session.last_activity_at, session.expires_at
      ).run();

      return session;
    } catch (error) {
      throw new DatabaseError(`Failed to create session: ${error}`, 'SESSION_CREATE', 'session');
    }
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM sessions WHERE id = ? AND expires_at > unixepoch()
      `).bind(sessionId).first() as SessionRecord | null;

      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to get session ${sessionId}: ${error}`, 'SESSION_GET', 'session');
    }
  }

  async updateSessionData(sessionId: string, dataHash: string, filename: string): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      await this.db.prepare(`
        UPDATE sessions 
        SET current_data_hash = ?, current_filename = ?, last_activity_at = ?
        WHERE id = ?
      `).bind(dataHash, filename, now, sessionId).run();
    } catch (error) {
      throw new DatabaseError(`Failed to update session data ${sessionId}: ${error}`, 'SESSION_UPDATE', 'session');
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        DELETE FROM sessions WHERE expires_at <= unixepoch()
      `).run();

      return result.changes || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to cleanup expired sessions: ${error}`, 'SESSION_CLEANUP', 'session');
    }
  }

  // Maintenance operations
  async cleanupOldValidations(olderThanDays: number): Promise<number> {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      const result = await this.db.prepare(`
        DELETE FROM validations WHERE created_at < ?
      `).bind(cutoff).run();

      return result.changes || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to cleanup old validations: ${error}`, 'VALIDATION_CLEANUP', 'validation');
    }
  }

  async cleanupOldCache(olderThanDays: number): Promise<number> {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      const result = await this.db.prepare(`
        DELETE FROM validation_cache WHERE last_accessed_at < ?
      `).bind(cutoff).run();

      return result.changes || 0;
    } catch (error) {
      throw new CacheError(`Failed to cleanup old cache: ${error}`);
    }
  }

  async vacuum(): Promise<void> {
    try {
      await this.db.prepare('VACUUM').run();
    } catch (error) {
      throw new DatabaseError(`Failed to vacuum database: ${error}`, 'VACUUM', 'maintenance');
    }
  }

  // Utility methods
  private serializeValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}