import type { ValidationResult } from './validation';

export interface Task {
  id: string;
  prompt: string;
  selection: {
    rows: number[];
    columns: string[];
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: TaskResult;
}

// Extended task interface with validation results
export interface TaskWithValidations extends Task {
  result?: TaskResult & {
    validations?: ValidationResult[];
  };
}

export interface TaskResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface TaskExample {
  label: string;
  prompt: string;
  requiresRowSelection?: boolean;
  requiresColumnSelection?: boolean;
  icon?: string;
}

// API types
export interface TaskRequest {
  prompt: string;
  selectedRows?: number[];
  selectedColumns?: string[];
  data?: Record<string, unknown>[];
  sessionId?: string;
  batchMode?: boolean;
}

export interface ClaudeAnalysisResult {
  analysis: string;
  method: 'claude-desktop' | 'anthropic-api' | 'mock';
  validations?: Array<{
    rowIndex: number;
    columnId: string;
    status: 'valid' | 'warning' | 'error';
    originalValue: unknown;
    suggestedValue?: unknown;
    reason: string;
  }>;
  rowDeletions?: Array<{
    rowIndex: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export interface TaskEvent {
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: string;
}

export interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  result?: ClaudeAnalysisResult | string;
  error?: string;
  selectedRowsCount?: number;
  selectedColumnsCount?: number;
  events?: TaskEvent[];
  createdAt?: string;
  completedAt?: string;
}

export interface BatchTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  result?: ClaudeAnalysisResult;
}