import React, { useState, useMemo } from 'react';
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
const getStatusOrbColor = (status: ValidationState['status']): string => {
  switch (status) {
    case 'auto_updated': return 'bg-orange-500'; // Orange for auto-updated values
    case 'confirmed': return 'bg-green-500';     // Green for user-confirmed values  
    case 'conflict': return 'bg-red-500';        // Red for conflicts/unconfirmable data
    case 'unchecked': return 'bg-gray-300';      // Grey for never checked
    case 'pending': return 'bg-gray-400 animate-pulse'; // Loading state
    default: return 'bg-gray-300';               // Default grey
  }
};

const getStatusTooltip = (validation: ValidationState): string => {
  switch (validation.status) {
    case 'auto_updated':
      return `Auto-updated: ${validation.notes || 'Value updated by AI'}\nClick to confirm`;
    case 'confirmed':
      return `Confirmed: ${validation.notes || 'User validated this value'}`;
    case 'conflict':
      return `Conflict: ${validation.notes || 'AI found conflicting information'}`;
    case 'unchecked':
      return `Unchecked: Click to mark as confirmed`;
    case 'pending':
      return 'Analyzing...';
    default:
      return validation.notes || 'No validation data';
  }
};

interface DataTableProps {
  data: DataRow[];
  validations?: Map<string, ValidationState>;
  onSelectionChange?: (selection: Selection) => void;
  onApplyValidation?: (rowIndex: number, columnId: string) => void;
  onConfirmValidation?: (rowIndex: number, columnId: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  validations = new Map(),
  onSelectionChange,
  onApplyValidation,
  onConfirmValidation 
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSelection, setColumnSelection] = useState<Set<string>>(new Set());

  const columns = useMemo<ColumnDef<DataRow>[]>(() => {
    if (data.length === 0) return [];

    const firstRow = data[0];
    const cols: ColumnDef<DataRow>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        size: 40,
      },
    ];

    Object.keys(firstRow).forEach((key) => {
      cols.push({
        id: key,
        accessorKey: key,
        header: () => (
          <div
            className={`cursor-pointer select-none ${
              columnSelection.has(key) ? 'bg-blue-100' : ''
            }`}
            onClick={() => {
              const newSelection = new Set(columnSelection);
              if (newSelection.has(key)) {
                newSelection.delete(key);
              } else {
                newSelection.add(key);
              }
              setColumnSelection(newSelection);
            }}
          >
            {key}
          </div>
        ),
        cell: ({ row, column }) => {
          const value = row.getValue(column.id) as string | number | null;
          const cellKey = `${row.index}-${column.id}`;
          const validation = validations.get(cellKey);

          return (
            <div className="flex items-center gap-1">
              <span>{value ?? ''}</span>
              {validation && <ValidationIndicator state={validation} />}
            </div>
          );
        },
      });
    });

    return cols;
  }, [data, columnSelection, validations]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  React.useEffect(() => {
    const selectedRows = Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(key => parseInt(key));
    
    const selectedColumns = Array.from(columnSelection);
    
    onSelectionChange({
      rows: selectedRows,
      columns: selectedColumns,
      cells: [],
    });
  }, [rowSelection, columnSelection, onSelectionChange]);

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
                      className="px-4 py-2 text-left font-medium whitespace-nowrap min-w-[100px]"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={row.getIsSelected() ? 'bg-blue-50' : ''}>
                  {row.getVisibleCells().map((cell) => {
                    const cellKey = `${row.index}-${cell.column.id}`;
                    const validation = validations.get(cellKey);
                    
                    return (
                      <td key={cell.id} className="px-4 py-2 data-table-cell relative group">
                        <div className="flex items-center gap-2">
                          {/* Status Orb */}
                          <div className="flex-shrink-0">
                            {validation ? (
                              <div 
                                className={`w-2 h-2 rounded-full ${getStatusOrbColor(validation.status)} ${
                                  (validation.status === 'auto_updated' || validation.status === 'unchecked') ? 'cursor-pointer hover:scale-125 transition-transform' : ''
                                }`}
                                title={getStatusTooltip(validation)}
                                onClick={() => {
                                  if (validation.status === 'auto_updated' && onConfirmValidation) {
                                    onConfirmValidation(row.index, cell.column.id);
                                  } else if (validation.status === 'unchecked' && onConfirmValidation) {
                                    onConfirmValidation(row.index, cell.column.id);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-300" title="No validation data" />
                            )}
                          </div>
                          
                          {/* Cell Value */}
                          <span className="flex-1">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                        </div>
                        
                        {/* Action Tooltip on Hover */}
                        {validation && validation.status === 'auto_updated' && (
                          <div className="absolute z-10 left-0 top-full mt-1 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            Click to confirm: {String(validation.validatedValue)}
                            <br />
                            {validation.notes}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-gray-700">
          {Object.keys(rowSelection).length} of {data.length} row(s) selected.
          {columnSelection.size > 0 && ` ${columnSelection.size} column(s) selected.`}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 border rounded hover:bg-gray-100"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};