import { useState } from 'react';
import type { CellHistoryEntry } from '../../types/cellHistory';

interface CellHistoryProps {
  cellKey: string;
  currentValue: any;
  history: CellHistoryEntry[];
  onClose: () => void;
  position: { x: number; y: number };
}

export function CellHistory({ cellKey, currentValue, history, onClose, position }: CellHistoryProps) {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  
  const [rowIndex, columnId] = cellKey.split('-');
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-700 bg-green-100';
      case 'warning':
        return 'text-yellow-700 bg-yellow-100';
      case 'error':
      case 'conflict':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
      case 'conflict':
        return '✗';
      default:
        return '•';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div 
        className="fixed z-50 bg-white rounded-lg shadow-xl border max-w-md w-80 max-h-96 overflow-hidden"
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Cell History: Row {parseInt(rowIndex) + 1}, {columnId}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Current value: <span className="font-mono bg-gray-100 px-1 rounded">{String(currentValue)}</span>
          </p>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No task history for this cell
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {history.map((entry) => (
                <div 
                  key={entry.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedEntry === entry.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                          {getStatusIcon(entry.status)} {entry.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-900 font-medium truncate">
                        {entry.taskPrompt}
                      </p>
                      
                      {entry.originalValue !== entry.newValue && (
                        <div className="text-xs text-gray-600 mt-1">
                          <span className="bg-red-100 text-red-800 px-1 rounded">{String(entry.originalValue)}</span>
                          {' → '}
                          <span className="bg-green-100 text-green-800 px-1 rounded">{String(entry.newValue)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedEntry === entry.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {entry.reason}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">Source:</span> {entry.source}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}