/**
 * Type definitions for data structures
 */

// Basic cell value type
export type CellValue = string | number | null;

// Data row structure
export interface DataRow {
  [key: string]: CellValue;
}

// Validation result from Claude
export interface ValidationResult {
  rowIndex: number;
  columnId: string;
  status: 'valid' | 'warning' | 'error' | 'conflict';
  reason: string;
  originalValue?: CellValue;
  suggestedValue?: CellValue;
  confidence?: number;
  isEstimate?: boolean;
}

// Claude analysis result
export interface ClaudeAnalysisResult {
  analysis: string;
  method: 'claude-desktop' | 'anthropic-api' | 'mock';
  validations?: ValidationResult[];
  rowDeletions?: Array<{
    rowIndex: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

// Task event data
export interface TaskEventData {
  type?: string;
  description?: string;
  [key: string]: unknown;
}