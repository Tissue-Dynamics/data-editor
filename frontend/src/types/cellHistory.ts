export interface CellHistoryEntry {
  id: string;
  taskId: string;
  taskPrompt: string;
  originalValue: any;
  newValue: any;
  reason: string;
  timestamp: Date;
  status: 'valid' | 'warning' | 'error' | 'conflict';
  source: string;
}

export interface CellHistory {
  cellKey: string; // format: "rowIndex-columnId"
  entries: CellHistoryEntry[];
}