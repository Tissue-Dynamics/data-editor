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

export interface TaskResult {
  success: boolean;
  message?: string;
  validations?: Map<string, ValidationResult>;
  error?: string;
}

export interface ValidationResult {
  cellKey: string; // "rowIndex-columnId"
  status: 'validated' | 'warning' | 'error';
  originalValue: string | number | null;
  validatedValue?: string | number | null;
  confidence?: number;
  source?: string;
  notes?: string;
}

export interface TaskExample {
  label: string;
  prompt: string;
  requiresRowSelection?: boolean;
  requiresColumnSelection?: boolean;
  icon?: string;
}