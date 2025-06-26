export interface Env {
  // Cloudflare bindings
  ANTHROPIC_API_KEY?: string; // Optional - will try Claude Desktop first
  // Future bindings:
  // DB: D1Database;
  // R2_BUCKET: R2Bucket;
}

export interface TaskRequest {
  prompt: string;
  selectedRows?: number[];
  selectedColumns?: string[];
  data?: Record<string, any>[];
}

export interface TaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  result?: any;
  error?: string;
}