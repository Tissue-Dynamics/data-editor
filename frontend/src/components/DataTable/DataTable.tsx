import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { DataRow, Selection } from '../../types/data';
import type { ValidationState } from '../../types/validation';
import { ValidationIndicator } from './ValidationIndicator';

// Helper functions for status orbs - new color scheme per user specs
// const getStatusOrbColor = (status: ValidationState['status']): string => {
//   switch (status) {
//     case 'auto_updated': return 'bg-orange-500'; // Orange for auto-updated values
//     case 'confirmed': return 'bg-green-500';     // Green for user-confirmed values  
//     case 'conflict': return 'bg-red-500';        // Red for conflicts/unconfirmable data
//     case 'unchecked': return 'bg-gray-300';      // Grey for never checked
//     case 'pending': return 'bg-gray-400 animate-pulse'; // Loading state
//     default: return 'bg-gray-300';               // Default grey
//   }
// };

// const getStatusTooltip = (validation: ValidationState): string => {
//   switch (validation.status) {
//     case 'auto_updated':
//       return `Auto-updated: ${validation.notes || 'Value updated by AI'}\nClick to confirm`;
//     case 'confirmed':
//       return `Confirmed: ${validation.notes || 'User validated this value'}`;
//     case 'conflict':
//       return `Conflict: ${validation.notes || 'AI found conflicting information'}`;
//     case 'unchecked':
//       return `Unchecked: Click to mark as confirmed`;
//     case 'pending':
//       return 'Analyzing...';
//     default:
//       return validation.notes || 'No validation data';
//   }
// };

// Memoized cell component to prevent re-renders
const DataCell = memo<{
  value: string | number | null;
  validation: ValidationState | undefined;
  rowIndex: number;
  columnId: string;
  onCellClick?: (rowIndex: number, columnId: string, event: React.MouseEvent) => void;
  onApplyValidation?: (rowIndex: number, columnId: string) => void;
  onConfirmValidation?: (rowIndex: number, columnId: string) => void;
}>(({ value, validation, rowIndex, columnId, onCellClick, onApplyValidation, onConfirmValidation }) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    onCellClick?.(rowIndex, columnId, e);
  }, [rowIndex, columnId, onCellClick]);

  const handleValidationClick = useCallback(() => {
    if (!validation) return;
    
    if (validation.status === 'auto_updated' && onConfirmValidation) {
      onConfirmValidation(rowIndex, columnId);
    } else if (validation.status === 'unchecked' && onApplyValidation) {
      onApplyValidation(rowIndex, columnId);
    }
  }, [validation, rowIndex, columnId, onConfirmValidation, onApplyValidation]);

  return (
    <div 
      className="flex items-start gap-1 px-2 py-1 cursor-pointer hover:bg-gray-50 max-h-16 overflow-y-auto"
      onClick={handleClick}
    >
      <span className="flex-1 break-words min-w-0" title={String(value ?? '')}>{value ?? ''}</span>
      {validation && (
        <div className="flex-shrink-0 mt-0.5" onClick={(e) => { e.stopPropagation(); handleValidationClick(); }}>
          <ValidationIndicator state={validation} />
        </div>
      )}
    </div>
  );
});

DataCell.displayName = 'DataCell';

// Memoized column header component
const ColumnHeader = memo<{
  columnId: string;
  isSelected: boolean;
  onToggleSelection: (columnId: string) => void;
}>(({ columnId, isSelected, onToggleSelection }) => {
  const handleClick = useCallback(() => {
    onToggleSelection(columnId);
  }, [columnId, onToggleSelection]);

  return (
    <div
      className={`cursor-pointer select-none px-2 py-1 ${
        isSelected ? 'bg-blue-100' : ''
      }`}
      onClick={handleClick}
    >
      {columnId}
    </div>
  );
});

ColumnHeader.displayName = 'ColumnHeader';

interface DataTableProps {
  data: DataRow[];
  validations?: Map<string, ValidationState>;
  onSelectionChange?: (selection: Selection) => void;
  onApplyValidation?: (rowIndex: number, columnId: string) => void;
  onConfirmValidation?: (rowIndex: number, columnId: string) => void;
  onCellClick?: (rowIndex: number, columnId: string, event: React.MouseEvent) => void;
}

export const DataTable = memo<DataTableProps>(({
  data,
  validations = new Map(),
  onSelectionChange,
  onApplyValidation,
  onConfirmValidation,
  onCellClick
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSelection, setColumnSelection] = useState<Set<string>>(new Set());

  const toggleColumnSelection = useCallback((columnId: string) => {
    setColumnSelection(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(columnId)) {
        newSelection.delete(columnId);
      } else {
        newSelection.add(columnId);
      }
      return newSelection;
    });
  }, []);

  // Memoize columns based only on data structure
  const columns = useMemo<ColumnDef<DataRow>[]>(() => {
    if (data.length === 0) return [];

    const firstRow = data[0];
    const cols: ColumnDef<DataRow>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center justify-center h-full px-2">
            <input
              type="checkbox"
              checked={table.getIsAllRowsSelected()}
              onChange={table.getToggleAllRowsSelectedHandler()}
              className="cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center h-full px-2">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              className="cursor-pointer"
            />
          </div>
        ),
        size: 40,
      },
    ];

    Object.keys(firstRow).forEach((key) => {
      cols.push({
        id: key,
        accessorKey: key,
        header: () => null, // We'll render this separately
        cell: () => null,   // We'll render this separately
      });
    });

    return cols;
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Handle selection changes
  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(key => parseInt(key));
    
    const selectedColumns = Array.from(columnSelection);
    
    onSelectionChange?.({
      rows: selectedRows,
      columns: selectedColumns,
      cells: [],
    });
  }, [rowSelection, columnSelection, onSelectionChange]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-sm min-w-full">
            <thead className="border-b bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left font-medium text-gray-700"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        header.column.id === 'select' ? (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        ) : (
                          <ColumnHeader
                            columnId={header.column.id}
                            isSelected={columnSelection.has(header.column.id)}
                            onToggleSelection={toggleColumnSelection}
                          />
                        )
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id}
                  className={`${row.getIsSelected() ? 'bg-blue-50' : ''} h-16`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="text-sm h-16 p-0">
                      {cell.column.id === 'select' ? (
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      ) : (
                        <DataCell
                          value={row.getValue(cell.column.id) as string | number | null}
                          validation={validations.get(`${row.index}-${cell.column.id}`)}
                          rowIndex={row.index}
                          columnId={cell.column.id}
                          onCellClick={onCellClick}
                          onApplyValidation={onApplyValidation}
                          onConfirmValidation={onConfirmValidation}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination controls */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
        <span className="text-sm text-gray-700">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
      </div>
    </div>
  );
});

DataTable.displayName = 'DataTable';