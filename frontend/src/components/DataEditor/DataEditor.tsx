import { useState } from 'react';
import { Download } from 'lucide-react';
import { DataTable } from '../DataTable/DataTable';
import { VersionHistory } from '../VersionHistory/VersionHistory';
import { ValidationLegend } from '../ValidationLegend/ValidationLegend';
import { ValidationSummary } from '../ValidationSummary/ValidationSummary';
import { CellHistory } from '../CellHistory/CellHistory';
import { downloadAsCSV } from '../../utils/csvExport';
import type { DataRow, Selection } from '../../types/data';
import type { ValidationState } from '../../types/validation';
import type { CellHistoryEntry } from '../../types/cellHistory';
import { DataTableErrorBoundary } from '../Common/ErrorBoundary';

interface DataEditorProps {
  data: DataRow[];
  filename: string;
  dataHistory: DataRow[][];
  historyIndex: number;
  validations: Map<string, ValidationState>;
  validationSummary: {
    analysis?: string;
    messages: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      message: string;
      suggestedValue?: any;
      isEstimate?: boolean;
    }>;
    rowDeletions?: Array<{
      rowIndex: number;
      reason: string;
      confidence: 'high' | 'medium' | 'low';
    }>;
  } | null;
  getCellHistory: (cellKey: string) => CellHistoryEntry[];
  onNavigateHistory: (direction: 'back' | 'forward') => void;
  onSelectionChange: (selection: Selection) => void;
  onConfirmValidation: (rowIndex: number, columnId: string) => void;
  onApplyValidation: (validation: {
    rowIndex: number;
    columnId: string;
    suggestedValue: any;
    originalValue: any;
    status: string;
    reason: string;
  }) => void;
  onApplyValidationValue: (rowIndex: number, columnId: string, value: any) => void;
  onDeleteRow: (rowIndex: number) => void;
  onDeleteRows: (rowIndexes: number[]) => void;
  onDismissValidationSummary: () => void;
  onReset: () => void;
}

export function DataEditor({
  data,
  filename,
  dataHistory,
  historyIndex,
  validations,
  validationSummary,
  getCellHistory,
  onNavigateHistory,
  onSelectionChange,
  onConfirmValidation,
  onApplyValidation,
  onApplyValidationValue,
  onDeleteRow,
  onDeleteRows,
  onDismissValidationSummary,
  onReset,
}: DataEditorProps) {
  const [selectedCell, setSelectedCell] = useState<{
    cellKey: string;
    position: { x: number; y: number };
    currentValue: any;
    history: CellHistoryEntry[];
  } | null>(null);

  const handleCellClick = (rowIndex: number, columnId: string, position: { x: number; y: number }) => {
    const cellKey = `${rowIndex}-${columnId}`;
    const currentValue = data[rowIndex]?.[columnId];
    const history = getCellHistory(cellKey);
    
    // Only show popup if there's history or if it's useful for UX
    if (history.length > 0) {
      setSelectedCell({
        cellKey,
        position,
        currentValue,
        history
      });
    }
  };

  const handleDownloadCSV = () => {
    downloadAsCSV(data, filename || 'data');
  };
  return (
    <div className="xl:col-span-3 space-y-4 min-w-0">
      {/* Version History Component */}
      {dataHistory.length > 1 && (
        <VersionHistory
          dataHistory={dataHistory}
          currentIndex={historyIndex}
          onNavigate={onNavigateHistory}
        />
      )}
      
      {/* Validation Summary */}
      {validationSummary && (
        <ValidationSummary
          analysis={validationSummary.analysis}
          validationMessages={validationSummary.messages}
          rowDeletions={validationSummary.rowDeletions}
          onApplyValue={onApplyValidationValue}
          onDeleteRow={onDeleteRow}
          onDeleteRows={onDeleteRows}
          onDismiss={onDismissValidationSummary}
        />
      )}
      
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold truncate">{filename}</h2>
            <ValidationLegend />
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors flex items-center gap-2"
              title="Download as CSV"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            
            <button
              onClick={onReset}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Upload New File
            </button>
          </div>
        </div>
        
        <div className="overflow-hidden">
          <DataTableErrorBoundary>
            <DataTable 
              data={data} 
              validations={validations}
              onSelectionChange={onSelectionChange}
              onConfirmValidation={onConfirmValidation}
              onCellClick={handleCellClick}
              onApplyValidation={(rowIndex, columnId) => {
                const cellKey = `${rowIndex}-${columnId}`;
                const validation = validations.get(cellKey);
                if (validation?.validatedValue !== undefined) {
                  onApplyValidation({
                    rowIndex,
                    columnId,
                    suggestedValue: validation.validatedValue,
                    originalValue: validation.originalValue,
                    status: validation.status as any,
                    reason: validation.notes || ''
                  });
                }
              }}
            />
          </DataTableErrorBoundary>
        </div>
      </div>
      
      {/* Cell History Popup */}
      {selectedCell && (
        <CellHistory
          cellKey={selectedCell.cellKey}
          currentValue={selectedCell.currentValue}
          history={selectedCell.history}
          position={selectedCell.position}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}