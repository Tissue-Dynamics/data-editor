export type ValidationStatus = 'validated' | 'warning' | 'error' | 'pending' | null;

export interface ValidationState {
  status: ValidationStatus;
  timestamp: Date;
  source?: string;
  notes?: string;
  confidence?: number;
  originalValue?: string | number | null;
  validatedValue?: string | number | null;
}

export interface CellValidation extends ValidationState {
  rowIndex: number;
  columnId: string;
}