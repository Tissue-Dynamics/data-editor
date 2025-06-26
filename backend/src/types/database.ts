// Database types for D1 integration

export interface ValidationRecord {
  id: string;
  task_id: string;
  row_index: number;
  column_id: string;
  original_value: string | null;
  suggested_value: string | null;
  status: 'valid' | 'warning' | 'error';
  reason: string | null;
  confidence: number;
  source: 'anthropic-api' | 'web-search' | 'bash-execution' | 'mock';
  created_at: number; // Unix timestamp
  data_hash: string;
}

export interface TaskRecord {
  id: string;
  prompt: string;
  data_hash: string;
  selected_rows: string | null; // JSON array
  selected_columns: string | null; // JSON array
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: string | null;
  analysis: string | null;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
  execution_time_ms: number | null;
  user_id: string | null;
  session_id: string | null;
}

export interface DataSnapshot {
  hash: string;
  row_count: number;
  column_count: number;
  column_names: string; // JSON array
  sample_data: string; // JSON array of first 3 rows
  schema_fingerprint: string;
  created_at: number;
  last_accessed_at: number;
}

export interface ValidationCache {
  id: string;
  data_pattern_hash: string;
  prompt_hash: string;
  result_hash: string;
  validations: string; // JSON array
  created_at: number;
  access_count: number;
  last_accessed_at: number;
}

export interface SessionRecord {
  id: string;
  user_fingerprint: string | null;
  current_data_hash: string | null;
  current_filename: string | null;
  created_at: number;
  last_activity_at: number;
  expires_at: number;
}

// Helper types for working with parsed JSON fields
export interface ParsedTaskRecord extends Omit<TaskRecord, 'selected_rows' | 'selected_columns'> {
  selected_rows: number[] | null;
  selected_columns: string[] | null;
}

export interface ParsedDataSnapshot extends Omit<DataSnapshot, 'column_names' | 'sample_data'> {
  column_names: string[];
  sample_data: Record<string, unknown>[];
}

export interface ParsedValidationCache extends Omit<ValidationCache, 'validations'> {
  validations: ValidationRecord[];
}

// Database operations interfaces
export interface ValidationInsert {
  task_id: string;
  row_index: number;
  column_id: string;
  original_value: unknown;
  suggested_value?: unknown;
  status: 'valid' | 'warning' | 'error';
  reason: string;
  confidence?: number;
  source: ValidationRecord['source'];
  data_hash: string;
}

export interface TaskInsert {
  id: string;
  prompt: string;
  data_hash: string;
  selected_rows?: number[];
  selected_columns?: string[];
  session_id?: string;
  user_id?: string;
}

export interface TaskUpdate {
  status: TaskRecord['status'];
  method?: string;
  analysis?: string;
  error_message?: string;
  execution_time_ms?: number;
}

export interface DataSnapshotInsert {
  hash: string;
  row_count: number;
  column_count: number;
  column_names: string[];
  sample_data: Record<string, unknown>[];
  schema_fingerprint: string;
}

// Query result types
export interface ValidationSummary {
  task_id: string;
  total_validations: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  completion_percentage: number;
}

export interface TaskSummary {
  id: string;
  prompt: string;
  status: TaskRecord['status'];
  created_at: number;
  execution_time_ms: number | null;
  validation_count: number;
  data_hash: string;
}

export interface CacheStats {
  total_entries: number;
  hit_rate: number;
  average_access_count: number;
  oldest_entry_age_hours: number;
}

// Database query builders
export interface DatabaseQueries {
  // Validation operations
  insertValidation(validation: ValidationInsert): Promise<ValidationRecord>;
  getValidationsByTaskId(taskId: string): Promise<ValidationRecord[]>;
  getValidationsByDataHash(dataHash: string): Promise<ValidationRecord[]>;
  getValidationSummary(taskId: string): Promise<ValidationSummary>;

  // Task operations
  insertTask(task: TaskInsert): Promise<TaskRecord>;
  updateTask(taskId: string, updates: TaskUpdate): Promise<void>;
  getTask(taskId: string): Promise<ParsedTaskRecord | null>;
  getTasksByDataHash(dataHash: string): Promise<TaskSummary[]>;
  getRecentTasks(limit?: number): Promise<TaskSummary[]>;

  // Data snapshot operations
  insertDataSnapshot(snapshot: DataSnapshotInsert): Promise<DataSnapshot>;
  getDataSnapshot(hash: string): Promise<ParsedDataSnapshot | null>;
  updateSnapshotAccess(hash: string): Promise<void>;

  // Cache operations
  getCachedValidation(dataPatternHash: string, promptHash: string): Promise<ParsedValidationCache | null>;
  setCachedValidation(cache: Omit<ValidationCache, 'id' | 'created_at' | 'last_accessed_at'>): Promise<void>;
  updateCacheAccess(cacheId: string): Promise<void>;
  getCacheStats(): Promise<CacheStats>;

  // Session operations
  createSession(userFingerprint?: string): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  updateSessionData(sessionId: string, dataHash: string, filename: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;

  // Maintenance operations
  cleanupOldValidations(olderThanDays: number): Promise<number>;
  cleanupOldCache(olderThanDays: number): Promise<number>;
  vacuum(): Promise<void>;
}

// Utility functions for hashing and serialization
export interface HashingUtils {
  hashData(data: Record<string, unknown>[]): string;
  hashPrompt(prompt: string): string;
  hashDataPattern(data: Record<string, unknown>[], selectedColumns?: string[]): string;
  hashSchema(columnNames: string[], sampleData: Record<string, unknown>[]): string;
  generateId(): string;
}

// Error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public validationId?: string) {
    super(message, 'VALIDATION_ERROR', 'validation');
  }
}

export class CacheError extends DatabaseError {
  constructor(message: string) {
    super(message, 'CACHE_ERROR', 'cache');
  }
}