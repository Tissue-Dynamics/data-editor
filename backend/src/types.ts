import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { DataRow, ClaudeAnalysisResult } from './types/data';

export interface Env {
  // Cloudflare bindings
  ANTHROPIC_API_KEY?: string; // Optional - will try Claude Desktop first
  DB: D1Database; // D1 database for validation persistence
  R2_BUCKET: R2Bucket; // R2 storage for uploaded files
}

export interface TaskRequest {
  prompt: string;
  selectedRows?: number[];
  selectedColumns?: string[];
  data?: DataRow[];
}

export interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  result?: ClaudeAnalysisResult;
  error?: string;
}