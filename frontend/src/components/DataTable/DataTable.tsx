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

interface DataTableProps {
  data: DataRow[];
  validations?: Map<string, ValidationState>;
  onSelectionChange?: (selection: Selection) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  validations = new Map(),
  onSelectionChange 
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
                      <td key={cell.id} className="px-4 py-2 data-table-cell relative">
                        <div className="flex items-center gap-2">
                          <span>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                          {validation && (
                            <span className="flex-shrink-0">
                              {validation.status === 'validated' && (
                                <span className="text-green-600 text-xs" title={`✓ ${validation.notes || 'Valid'}`}>
                                  ✓
                                </span>
                              )}
                              {validation.status === 'warning' && (
                                <span className="text-yellow-600 text-xs" title={`⚠ ${validation.notes || 'Warning'}`}>
                                  ⚠️
                                </span>
                              )}
                              {validation.status === 'error' && (
                                <span className="text-red-600 text-xs" title={`✗ ${validation.notes || 'Error'}`}>
                                  ❌
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {validation && validation.validatedValue !== undefined && validation.validatedValue !== validation.originalValue && (
                          <div className="text-xs text-gray-500 mt-1">
                            Suggested: {String(validation.validatedValue)}
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