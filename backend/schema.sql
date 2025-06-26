-- D1 Database Schema for Data Editor Validation System
-- Cloudflare D1 uses SQLite syntax

-- Validation Results Table
-- Stores all validation results from Claude analysis
CREATE TABLE validations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  column_id TEXT NOT NULL,
  original_value TEXT,
  suggested_value TEXT,
  status TEXT NOT NULL CHECK (status IN ('valid', 'warning', 'error')),
  reason TEXT,
  confidence REAL DEFAULT 0.9,
  source TEXT NOT NULL CHECK (source IN ('anthropic-api', 'web-search', 'bash-execution', 'mock')),
  created_at INTEGER NOT NULL,
  data_hash TEXT NOT NULL,
  
  -- Indexes for performance
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task Execution History Table
-- Tracks all analysis tasks and their metadata
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  selected_rows TEXT, -- JSON array of row indices
  selected_columns TEXT, -- JSON array of column names
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  method TEXT, -- 'anthropic-api', 'mock', etc.
  analysis TEXT, -- Full Claude analysis text
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  execution_time_ms INTEGER,
  
  -- Metadata
  user_id TEXT, -- For future multi-user support
  session_id TEXT -- For tracking user sessions
);

-- Data Snapshots Table
-- Stores version history of data for each session
CREATE TABLE data_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL, -- Full data as JSON
  data_hash TEXT NOT NULL,
  column_names TEXT NOT NULL, -- JSON array of column names
  change_description TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT, -- 'user' or 'ai'
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, version)
);

-- Validation Cache Table
-- Caches validation results for identical data patterns
CREATE TABLE validation_cache (
  id TEXT PRIMARY KEY,
  data_pattern_hash TEXT NOT NULL, -- Hash of data pattern (structure + sample values)
  prompt_hash TEXT NOT NULL, -- Hash of the analysis prompt
  result_hash TEXT NOT NULL, -- Hash of the validation results
  validations TEXT NOT NULL, -- JSON array of cached validations
  created_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 1,
  last_accessed_at INTEGER NOT NULL,
  
  UNIQUE(data_pattern_hash, prompt_hash)
);

-- Session Management Table
-- Tracks user sessions for data continuity
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- User-provided session name
  description TEXT,
  file_name TEXT,
  file_type TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  current_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);

-- Performance Indexes
CREATE INDEX idx_validations_task_id ON validations(task_id);
CREATE INDEX idx_validations_data_hash ON validations(data_hash);
CREATE INDEX idx_validations_created_at ON validations(created_at);
CREATE INDEX idx_validations_row_column ON validations(row_index, column_id);

CREATE INDEX idx_tasks_data_hash ON tasks(data_hash);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_user_session ON tasks(user_id, session_id);

CREATE INDEX idx_data_snapshots_created_at ON data_snapshots(created_at);
CREATE INDEX idx_data_snapshots_session ON data_snapshots(session_id);

CREATE INDEX idx_validation_cache_pattern ON validation_cache(data_pattern_hash);
CREATE INDEX idx_validation_cache_prompt ON validation_cache(prompt_hash);
CREATE INDEX idx_validation_cache_accessed ON validation_cache(last_accessed_at);

CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_activity ON sessions(last_activity_at);

-- Cleanup triggers for old data
-- Automatically clean up old sessions and cache entries

-- Trigger to update session activity
CREATE TRIGGER update_session_activity
  AFTER INSERT ON tasks
  BEGIN
    UPDATE sessions 
    SET last_activity_at = unixepoch(),
        updated_at = unixepoch()
    WHERE id = NEW.session_id;
  END;