export type ValidationStatus = 'auto_updated' | 'confirmed' | 'conflict' | 'unchecked' | 'pending' | null;

export interface ValidationState {
  cellKey: string; // "rowIndex-columnId"
  status: ValidationStatus;
  timestamp: Date;
  source?: string;
  notes?: string;
  confidence?: number;
  originalValue?: string | number | null;
  validatedValue?: string | number | null;
  applied?: boolean; // Whether the suggested value has been applied to the data
  confirmed?: boolean; // Whether the user has confirmed this validation
}

export interface CellValidation extends ValidationState {
  rowIndex: number;
  columnId: string;
}