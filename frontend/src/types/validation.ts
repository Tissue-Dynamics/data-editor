import type { CellValue } from './values';

export type ValidationStatus = 'auto_updated' | 'confirmed' | 'conflict' | 'unchecked' | 'pending' | null;

export interface ValidationState {
  cellKey: string; // "rowIndex-columnId"
  status: ValidationStatus;
  timestamp: Date;
  source?: string;
  notes?: string;
  confidence?: number;
  originalValue?: CellValue;
  validatedValue?: CellValue;
  applied?: boolean; // Whether the suggested value has been applied to the data
  confirmed?: boolean; // Whether the user has confirmed this validation
}

export interface CellValidation extends ValidationState {
  rowIndex: number;
  columnId: string;
}

// Validation from task results
export interface ValidationResult {
  rowIndex: number;
  columnId: string;
  status: string;
  reason: string;
  originalValue?: CellValue;
  suggestedValue?: CellValue;
  confidence?: number;
  isEstimate?: boolean;
}