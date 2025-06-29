import { useState } from 'react';
import { Download } from 'lucide-react';
import { DataTable } from '../DataTable/DataTable';
import { VirtualDataTable } from '../DataTable/VirtualDataTable';
import { VersionHistory } from '../VersionHistory/VersionHistory';
import { ValidationLegend } from '../ValidationLegend/ValidationLegend';
import { ValidationSummary } from '../ValidationSummary/ValidationSummary';
import { CellHistory } from '../CellHistory/CellHistory';
import { downloadAsCSV } from '../../utils/csvExport';
import { DataTableErrorBoundary } from '../Common/ErrorBoundary';
import { useData, useValidationContext, useHistoryContext } from '../../contexts/AppProviders';
import type { CellHistoryEntry } from '../../types/cellHistory';
import type { CellValue } from '../../types/values';

export function DataEditor() {
  const { 
    data,
    filename,
    handleSelectionChange,
    handleDeleteRow,
    handleDeleteRows
  } = useData();
  
  const {
    validations,
    validationSummary,
    setValidationSummary,
    getCellHistory,
    confirmValidation,
    applyValidationValue,
  } = useValidationContext();
  
  const {
    dataHistory,
    historyIndex,
    handleNavigateHistory,
    historyData
  } = useHistoryContext();

  const [selectedCell, setSelectedCell] = useState<{
    cellKey: string;
    currentValue: string;
    history: CellHistoryEntry[];
    position: { x: number; y: number };
  } | null>(null);

  const handleDownloadCSV = () => {
    if (data.length === 0) return;
    downloadAsCSV(data, filename);
  };

  const handleCellClick = (rowIndex: number, columnId: string, event: React.MouseEvent) => {
    const cellKey = `${rowIndex}-${columnId}`;
    const history = getCellHistory(cellKey);
    
    if (history.length > 0) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setSelectedCell({
        cellKey,
        currentValue: String(data[rowIndex][columnId] || ''),
        history,
        position: {
          x: rect.left,
          y: rect.bottom + 5
        }
      });
    }
  };

  const handleApplyValidation = (rowIndex: number, columnId: string) => {
    const cellKey = `${rowIndex}-${columnId}`;
    const validation = validations.get(cellKey);
    if (validation?.validatedValue !== undefined) {
      applyValidationValue(rowIndex, columnId, validation.validatedValue);
    }
  };

  if (data.length === 0 && historyData.length === 0) {
    return null;
  }

  const displayData = historyData.length > 0 ? historyData : data;

  return (
    <div className="xl:col-span-3 space-y-4">
      {historyIndex !== -1 && (
        <VersionHistory
          dataHistory={dataHistory}
          currentIndex={historyIndex}
          onNavigate={(direction) => handleNavigateHistory(historyIndex + (direction === 'forward' ? 1 : -1))}
        />
      )}
      
      {validationSummary && (
        <ValidationSummary
          analysis={validationSummary.analysis}
          validationMessages={validationSummary.messages}
          rowDeletions={validationSummary.rowDeletions}
          onApplyValue={applyValidationValue}
          onDeleteRow={handleDeleteRow}
          onDeleteRows={handleDeleteRows}
          onDismiss={() => setValidationSummary(null)}
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
              onClick={resetData}
              className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title="Reset all data"
            >
              Reset
            </button>
          </div>
        </div>
        
        <div className="overflow-hidden">
          <DataTableErrorBoundary>
            {displayData.length > 1000 ? (
              <VirtualDataTable 
                data={displayData} 
                validations={validations}
                onSelectionChange={handleSelectionChange}
                onConfirmValidation={confirmValidation}
                onCellClick={handleCellClick}
                onApplyValidation={handleApplyValidation}
              />
            ) : (
              <DataTable 
                data={displayData} 
                validations={validations}
                onSelectionChange={handleSelectionChange}
                onConfirmValidation={confirmValidation}
                onCellClick={handleCellClick}
                onApplyValidation={handleApplyValidation}
              />
            )}
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