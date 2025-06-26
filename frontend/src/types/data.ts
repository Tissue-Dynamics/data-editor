export interface DataRow {
  [key: string]: string | number | null;
}

export interface DataColumn {
  id: string;
  header: string;
  accessorKey: string;
}

export interface Dataset {
  id: string;
  name: string;
  rows: DataRow[];
  columns: DataColumn[];
  rowCount: number;
  columnCount: number;
  createdAt: Date;
}

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface Selection {
  rows: number[];
  columns: string[];
  cells: CellPosition[];
}