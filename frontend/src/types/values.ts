/**
 * Type-safe value types for data cells and validations
 */

// Basic cell value type that matches our DataRow definition
export type CellValue = string | number | null;

// Extended value type that includes boolean for certain operations
export type ExtendedCellValue = CellValue | boolean;

// Validation-specific value interface
export interface ValidationValue {
  value: CellValue;
  formattedValue?: string;
  dataType?: 'string' | 'number' | 'boolean' | 'null';
}

// Streaming event from backend
export interface StreamingEvent {
  taskId: string;
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'analysis_start' | 'analysis_complete';
  tool?: 'web_search' | 'bash' | 'structured_output';
  description: string;
  details?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Task result data structure
export interface TaskResultData {
  validations?: Array<{
    rowIndex: number;
    columnId: string;
    status: string;
    reason: string;
    originalValue?: CellValue;
    suggestedValue?: CellValue;
    confidence?: number;
  }>;
  analysis?: string;
  method?: string;
}