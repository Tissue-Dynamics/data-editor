import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from './database';
import { HashingUtilsImpl } from '../utils/hashing';
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { ValidationInsert, TaskInsert, TaskUpdate, DataSnapshotInsert } from '../types/database';

// Mock D1 Database
const mockD1Database = (): D1Database => {
  const mockPreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true, changes: 1 } as D1Result),
    all: vi.fn().mockResolvedValue({ results: [], success: true } as D1Result),
    first: vi.fn().mockResolvedValue(null),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockPreparedStatement),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
};

describe('DatabaseService', () => {
  let db: D1Database;
  let hashUtils: HashingUtilsImpl;
  let dbService: DatabaseService;
  let mockPreparedStatement: any;

  beforeEach(() => {
    db = mockD1Database();
    hashUtils = new HashingUtilsImpl();
    dbService = new DatabaseService(db, hashUtils);
    
    // Get the mocked prepared statement for easier access
    mockPreparedStatement = (db.prepare as any)().bind().run;
    
    // Mock ID generation for consistent tests
    vi.spyOn(hashUtils, 'generateId').mockReturnValue('test-id-123');
    
    // Mock current time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Validation Operations', () => {
    describe('insertValidation', () => {
      it('should insert validation record with all fields', async () => {
        const validation: ValidationInsert = {
          task_id: 'task-123',
          row_index: 1,
          column_id: 'email',
          original_value: 'invalid-email',
          suggested_value: 'invalid-email@example.com',
          status: 'error',
          reason: 'Missing @ symbol and domain',
          confidence: 0.95,
          source: 'anthropic-api',
          data_hash: 'data-hash-456',
        };

        const result = await dbService.insertValidation(validation);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO validations'));
        expect(result).toMatchObject({
          id: 'test-id-123',
          task_id: 'task-123',
          row_index: 1,
          column_id: 'email',
          status: 'error',
          confidence: 0.95,
          source: 'anthropic-api',
        });
        expect(result.created_at).toBe(1704103200); // Unix timestamp for 2024-01-01T10:00:00Z
      });

      it('should handle null values correctly', async () => {
        const validation: ValidationInsert = {
          task_id: 'task-123',
          row_index: 0,
          column_id: 'name',
          original_value: null,
          status: 'valid',
          reason: 'Value is correctly null',
          source: 'anthropic-api',
          data_hash: 'data-hash-456',
        };

        const result = await dbService.insertValidation(validation);

        expect(result.original_value).toBeNull();
        expect(result.suggested_value).toBeNull();
        expect(result.confidence).toBe(0.9); // Default value
      });

      it('should serialize complex values to JSON', async () => {
        const validation: ValidationInsert = {
          task_id: 'task-123',
          row_index: 0,
          column_id: 'metadata',
          original_value: { complex: 'object', array: [1, 2, 3] },
          suggested_value: { fixed: 'object' },
          status: 'warning',
          reason: 'Complex object validation',
          source: 'bash-execution',
          data_hash: 'data-hash-456',
        };

        const result = await dbService.insertValidation(validation);

        expect(result.original_value).toBe('{"complex":"object","array":[1,2,3]}');
        expect(result.suggested_value).toBe('{"fixed":"object"}');
      });
    });

    describe('getValidationsByTaskId', () => {
      it('should retrieve validations for a task', async () => {
        const mockValidations = [
          {
            id: 'val-1',
            task_id: 'task-123',
            row_index: 0,
            column_id: 'email',
            status: 'error',
            reason: 'Invalid format',
          },
          {
            id: 'val-2', 
            task_id: 'task-123',
            row_index: 1,
            column_id: 'name',
            status: 'valid',
            reason: 'Valid name',
          },
        ];

        (db.prepare as any)().bind().all.mockResolvedValue({
          results: mockValidations,
          success: true,
        });

        const result = await dbService.getValidationsByTaskId('task-123');

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE task_id = ?'));
        expect(result).toEqual(mockValidations);
      });

      it('should return empty array when no validations found', async () => {
        (db.prepare as any)().bind().all.mockResolvedValue({
          results: [],
          success: true,
        });

        const result = await dbService.getValidationsByTaskId('nonexistent-task');

        expect(result).toEqual([]);
      });
    });

    describe('getValidationSummary', () => {
      it('should calculate validation summary correctly', async () => {
        const mockSummary = {
          task_id: 'task-123',
          total_validations: 10,
          valid_count: 7,
          warning_count: 2,
          error_count: 1,
          completion_percentage: 70.0,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockSummary);

        const result = await dbService.getValidationSummary('task-123');

        expect(result).toEqual(mockSummary);
      });

      it('should return zero summary when no validations exist', async () => {
        (db.prepare as any)().bind().first.mockResolvedValue(null);

        const result = await dbService.getValidationSummary('task-123');

        expect(result).toEqual({
          task_id: 'task-123',
          total_validations: 0,
          valid_count: 0,
          warning_count: 0,
          error_count: 0,
          completion_percentage: 0,
        });
      });
    });
  });

  describe('Task Operations', () => {
    describe('insertTask', () => {
      it('should insert task with all required fields', async () => {
        const task: TaskInsert = {
          id: 'task-123',
          prompt: 'Validate email addresses',
          data_hash: 'data-hash-456',
          selected_rows: [0, 1, 2],
          selected_columns: ['email', 'name'],
          session_id: 'session-789',
          user_id: 'user-456',
        };

        const result = await dbService.insertTask(task);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tasks'));
        expect(result).toMatchObject({
          id: 'task-123',
          prompt: 'Validate email addresses',
          data_hash: 'data-hash-456',
          status: 'pending',
          created_at: 1704103200,
        });
        expect(result.selected_rows).toBe('[0,1,2]');
        expect(result.selected_columns).toBe('["email","name"]');
      });

      it('should handle optional fields correctly', async () => {
        const task: TaskInsert = {
          id: 'task-123',
          prompt: 'Simple validation',
          data_hash: 'data-hash-456',
        };

        const result = await dbService.insertTask(task);

        expect(result.selected_rows).toBe('null');
        expect(result.selected_columns).toBe('null');
        expect(result.user_id).toBeNull();
        expect(result.session_id).toBeNull();
      });
    });

    describe('updateTask', () => {
      it('should update task status and completion time', async () => {
        const updates: TaskUpdate = {
          status: 'completed',
          method: 'anthropic-api',
          analysis: 'Analysis completed successfully',
          execution_time_ms: 2500,
        };

        await dbService.updateTask('task-123', updates);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks'));
        const bindCall = (db.prepare as any)().bind;
        expect(bindCall).toHaveBeenCalledWith(
          'completed',
          'anthropic-api', 
          'Analysis completed successfully',
          2500,
          1704103200, // completed_at timestamp
          'task-123'
        );
      });

      it('should update only provided fields', async () => {
        const updates: TaskUpdate = {
          status: 'failed',
          error_message: 'Analysis failed due to network error',
        };

        await dbService.updateTask('task-123', updates);

        const sqlCall = (db.prepare as any).mock.calls[0][0];
        expect(sqlCall).toContain('status = ?');
        expect(sqlCall).toContain('error_message = ?');
        expect(sqlCall).toContain('completed_at = ?');
        expect(sqlCall).not.toContain('method = ?');
        expect(sqlCall).not.toContain('analysis = ?');
      });

      it('should handle empty updates gracefully', async () => {
        await dbService.updateTask('task-123', {});

        expect(db.prepare).not.toHaveBeenCalled();
      });
    });

    describe('getTask', () => {
      it('should retrieve and parse task correctly', async () => {
        const mockTask = {
          id: 'task-123',
          prompt: 'Test prompt',
          selected_rows: '[0,1,2]',
          selected_columns: '["email","name"]',
          status: 'completed',
          created_at: 1704103200,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockTask);

        const result = await dbService.getTask('task-123');

        expect(result).toMatchObject({
          id: 'task-123',
          prompt: 'Test prompt',
          selected_rows: [0, 1, 2],
          selected_columns: ['email', 'name'],
          status: 'completed',
        });
      });

      it('should return null for non-existent task', async () => {
        (db.prepare as any)().bind().first.mockResolvedValue(null);

        const result = await dbService.getTask('nonexistent-task');

        expect(result).toBeNull();
      });

      it('should handle null JSON fields correctly', async () => {
        const mockTask = {
          id: 'task-123',
          selected_rows: null,
          selected_columns: null,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockTask);

        const result = await dbService.getTask('task-123');

        expect(result?.selected_rows).toBeNull();
        expect(result?.selected_columns).toBeNull();
      });
    });
  });

  describe('Data Snapshot Operations', () => {
    describe('insertDataSnapshot', () => {
      it('should insert data snapshot with serialized JSON', async () => {
        const snapshot: DataSnapshotInsert = {
          hash: 'data-hash-123',
          row_count: 100,
          column_count: 5,
          column_names: ['id', 'name', 'email', 'age', 'city'],
          sample_data: [
            { id: 1, name: 'John', email: 'john@example.com' },
            { id: 2, name: 'Jane', email: 'jane@example.com' },
          ],
          schema_fingerprint: 'schema-hash-456',
        };

        const result = await dbService.insertDataSnapshot(snapshot);

        expect(result.hash).toBe('data-hash-123');
        expect(result.column_names).toBe('["id","name","email","age","city"]');
        expect(result.sample_data).toContain('"John"');
        expect(result.created_at).toBe(1704103200);
        expect(result.last_accessed_at).toBe(1704103200);
      });
    });

    describe('getDataSnapshot', () => {
      it('should retrieve and parse data snapshot', async () => {
        const mockSnapshot = {
          hash: 'data-hash-123',
          column_names: '["id","name","email"]',
          sample_data: '[{"id":1,"name":"John"},{"id":2,"name":"Jane"}]',
          created_at: 1704103200,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockSnapshot);

        const result = await dbService.getDataSnapshot('data-hash-123');

        expect(result?.column_names).toEqual(['id', 'name', 'email']);
        expect(result?.sample_data).toEqual([
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ]);
      });
    });
  });

  describe('Cache Operations', () => {
    describe('getCachedValidation', () => {
      it('should retrieve and parse cached validation', async () => {
        const mockCache = {
          id: 'cache-123',
          validations: '[{"row_index":0,"status":"valid"}]',
          access_count: 5,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockCache);

        const result = await dbService.getCachedValidation('pattern-hash', 'prompt-hash');

        expect(result?.validations).toEqual([{ row_index: 0, status: 'valid' }]);
        expect(result?.access_count).toBe(5);
      });

      it('should return null when cache miss', async () => {
        (db.prepare as any)().bind().first.mockResolvedValue(null);

        const result = await dbService.getCachedValidation('pattern-hash', 'prompt-hash');

        expect(result).toBeNull();
      });
    });

    describe('setCachedValidation', () => {
      it('should insert or replace cache entry', async () => {
        const cache = {
          data_pattern_hash: 'pattern-123',
          prompt_hash: 'prompt-456', 
          result_hash: 'result-789',
          validations: '[{"status":"valid"}]',
          access_count: 1,
        };

        await dbService.setCachedValidation(cache);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO validation_cache'));
      });
    });

    describe('getCacheStats', () => {
      it('should calculate cache statistics', async () => {
        const mockStats = {
          total_entries: 150,
          average_access_count: 3.2,
          oldest_entry_age_hours: 48.5,
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockStats);

        const result = await dbService.getCacheStats();

        expect(result.total_entries).toBe(150);
        expect(result.average_access_count).toBe(3.2);
        expect(result.oldest_entry_age_hours).toBe(48.5);
        expect(result.hit_rate).toBeGreaterThan(0);
        expect(result.hit_rate).toBeLessThan(1);
      });
    });
  });

  describe('Session Operations', () => {
    describe('createSession', () => {
      it('should create session with expiration', async () => {
        const result = await dbService.createSession('user-fingerprint-123');

        expect(result.id).toBe('test-id-123');
        expect(result.user_fingerprint).toBe('user-fingerprint-123');
        expect(result.created_at).toBe(1704103200);
        expect(result.expires_at).toBe(1704103200 + 24 * 60 * 60); // 24 hours later
      });

      it('should handle anonymous sessions', async () => {
        const result = await dbService.createSession();

        expect(result.user_fingerprint).toBeNull();
      });
    });

    describe('getSession', () => {
      it('should retrieve non-expired session', async () => {
        const mockSession = {
          id: 'session-123',
          user_fingerprint: 'user-123',
          expires_at: 1704103200 + 3600, // 1 hour from now
        };

        (db.prepare as any)().bind().first.mockResolvedValue(mockSession);

        const result = await dbService.getSession('session-123');

        expect(result).toEqual(mockSession);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('expires_at > unixepoch()'));
      });
    });
  });

  describe('Maintenance Operations', () => {
    describe('cleanupOldValidations', () => {
      it('should delete validations older than specified days', async () => {
        const mockResult = { changes: 25 };
        (db.prepare as any)().bind().run.mockResolvedValue(mockResult);

        const deletedCount = await dbService.cleanupOldValidations(30);

        expect(deletedCount).toBe(25);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM validations WHERE created_at < ?'));
      });
    });

    describe('vacuum', () => {
      it('should execute VACUUM command', async () => {
        await dbService.vacuum();

        expect(db.prepare).toHaveBeenCalledWith('VACUUM');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw ValidationError on validation insert failure', async () => {
      (db.prepare as any)().bind().run.mockRejectedValue(new Error('Database error'));

      const validation: ValidationInsert = {
        task_id: 'task-123',
        row_index: 0,
        column_id: 'test',
        status: 'valid',
        reason: 'test',
        source: 'anthropic-api',
        data_hash: 'hash-123',
      };

      await expect(dbService.insertValidation(validation)).rejects.toThrow('Failed to insert validation');
    });

    it('should throw DatabaseError on task operations failure', async () => {
      (db.prepare as any)().bind().run.mockRejectedValue(new Error('Database error'));

      const task: TaskInsert = {
        id: 'task-123',
        prompt: 'test',
        data_hash: 'hash-123',
      };

      await expect(dbService.insertTask(task)).rejects.toThrow('Failed to insert task');
    });

    it('should throw CacheError on cache operations failure', async () => {
      (db.prepare as any)().bind().first.mockRejectedValue(new Error('Database error'));

      await expect(dbService.getCachedValidation('pattern', 'prompt')).rejects.toThrow('Failed to get cached validation');
    });
  });
});