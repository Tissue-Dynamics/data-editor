import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import type { DataRow, Selection } from '../../types/data';
import type { ValidationState } from '../../types/validation';
import { ValidationIndicator } from './ValidationIndicator';

// Constants for virtualization
const ROW_HEIGHT = 32; // Height of each row in pixels
const OVERSCAN = 5; // Number of rows to render outside viewport

// Memoized cell component
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
      className="flex items-center gap-1 px-2 h-8 cursor-pointer hover:bg-gray-50"
      onClick={handleClick}
    >
      <span className="flex-1 truncate">{value ?? ''}</span>
      {validation && (
        <div onClick={(e) => { e.stopPropagation(); handleValidationClick(); }}>
          <ValidationIndicator state={validation} />
        </div>
      )}
    </div>
  );
});

DataCell.displayName = 'DataCell';

// Memoized row component
const VirtualRow = memo<{
  row: DataRow;
  rowIndex: number;
  columns: string[];
  isSelected: boolean;
  validations: Map<string, ValidationState>;
  onToggleRow: (rowIndex: number) => void;
  onCellClick?: (rowIndex: number, columnId: string, event: React.MouseEvent) => void;
  onApplyValidation?: (rowIndex: number, columnId: string) => void;
  onConfirmValidation?: (rowIndex: number, columnId: string) => void;
  style: React.CSSProperties;
}>(({ 
  row, 
  rowIndex, 
  columns, 
  isSelected, 
  validations, 
  onToggleRow, 
  onCellClick, 
  onApplyValidation, 
  onConfirmValidation,
  style 
}) => {
  return (
    <tr 
      className={`flex ${isSelected ? 'bg-blue-50' : ''}`}
      style={style}
    >
      <td className="flex items-center justify-center w-12 border-r">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleRow(rowIndex)}
          className="cursor-pointer"
        />
      </td>
      {columns.map((column) => (
        <td key={column} className="flex-1 border-r last:border-r-0">
          <DataCell
            value={row[column] as string | number | null}
            validation={validations.get(`${rowIndex}-${column}`)}
            rowIndex={rowIndex}
            columnId={column}
            onCellClick={onCellClick}
            onApplyValidation={onApplyValidation}
            onConfirmValidation={onConfirmValidation}
          />
        </td>
      ))}
    </tr>
  );
});

VirtualRow.displayName = 'VirtualRow';

interface VirtualDataTableProps {
  data: DataRow[];
  validations?: Map<string, ValidationState>;
  onSelectionChange?: (selection: Selection) => void;
  onApplyValidation?: (rowIndex: number, columnId: string) => void;
  onConfirmValidation?: (rowIndex: number, columnId: string) => void;
  onCellClick?: (rowIndex: number, columnId: string, event: React.MouseEvent) => void;
}

export const VirtualDataTable = memo<VirtualDataTableProps>(({
  data,
  validations = new Map(),
  onSelectionChange,
  onApplyValidation,
  onConfirmValidation,
  onCellClick
}) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Get columns from first row
  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Toggle row selection
  const toggleRow = useCallback((rowIndex: number) => {
    setSelectedRows(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(rowIndex)) {
        newSelection.delete(rowIndex);
      } else {
        newSelection.add(rowIndex);
      }
      return newSelection;
    });
  }, []);

  // Toggle column selection
  const toggleColumn = useCallback((columnId: string) => {
    setSelectedColumns(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(columnId)) {
        newSelection.delete(columnId);
      } else {
        newSelection.add(columnId);
      }
      return newSelection;
    });
  }, []);

  // Toggle all rows
  const toggleAllRows = useCallback(() => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map((_, i) => i)));
    }
  }, [selectedRows.size, data.length]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      data.length - 1,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, data.length]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (scrollContainerRef.current) {
        setContainerHeight(scrollContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Report selection changes
  useEffect(() => {
    onSelectionChange?.({
      rows: Array.from(selectedRows),
      columns: Array.from(selectedColumns),
      cells: [],
    });
  }, [selectedRows, selectedColumns, onSelectionChange]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available
      </div>
    );
  }

  const totalHeight = data.length * ROW_HEIGHT;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Fixed header */}
      <div className="flex-shrink-0 border-b bg-gray-50">
        <div className="flex">
          <div className="w-12 px-2 py-2 border-r">
            <input
              type="checkbox"
              checked={selectedRows.size === data.length}
              onChange={toggleAllRows}
              className="cursor-pointer"
            />
          </div>
          {columns.map((column) => (
            <div
              key={column}
              className={`flex-1 px-2 py-2 font-medium text-gray-700 cursor-pointer border-r last:border-r-0 ${
                selectedColumns.has(column) ? 'bg-blue-100' : ''
              }`}
              onClick={() => toggleColumn(column)}
            >
              {column}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
        style={{ height: '600px' }}
      >
        {/* Total height container */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Render only visible rows */}
          <table className="w-full">
            <tbody>
              {Array.from(
                { length: visibleRange.endIndex - visibleRange.startIndex + 1 },
                (_, i) => {
                  const rowIndex = visibleRange.startIndex + i;
                  const row = data[rowIndex];
                  if (!row) return null;

                  return (
                    <VirtualRow
                      key={rowIndex}
                      row={row}
                      rowIndex={rowIndex}
                      columns={columns}
                      isSelected={selectedRows.has(rowIndex)}
                      validations={validations}
                      onToggleRow={toggleRow}
                      onCellClick={onCellClick}
                      onApplyValidation={onApplyValidation}
                      onConfirmValidation={onConfirmValidation}
                      style={{
                        position: 'absolute',
                        top: rowIndex * ROW_HEIGHT,
                        width: '100%',
                        height: ROW_HEIGHT,
                      }}
                    />
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="flex-shrink-0 border-t px-4 py-2 text-sm text-gray-600">
        Showing {visibleRange.startIndex + 1} - {Math.min(visibleRange.endIndex + 1, data.length)} of {data.length} rows
        {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
      </div>
    </div>
  );
});

VirtualDataTable.displayName = 'VirtualDataTable';