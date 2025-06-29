import { memo } from 'react';
import { XCircle } from 'lucide-react';

export interface RowDeletion {
  rowIndex: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface RowDeletionsListProps {
  deletions: RowDeletion[];
  onDeleteRow?: (rowIndex: number) => void;
  onDeleteRows?: (rowIndexes: number[]) => void;
}

export const RowDeletionsList = memo<RowDeletionsListProps>(({
  deletions,
  onDeleteRow,
  onDeleteRows
}) => {
  if (deletions.length === 0) {
    return null;
  }

  const getConfidenceStyles = (confidence: RowDeletion['confidence']) => {
    switch (confidence) {
      case 'high':
        return 'text-red-700 bg-red-100';
      case 'medium':
        return 'text-orange-700 bg-orange-100';
      case 'low':
        return 'text-yellow-700 bg-yellow-100';
    }
  };

  return (
    <div className="border-t border-gray-200 mt-2 pt-2">
      <div className="px-3 py-2 bg-red-50 border-b border-red-100">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-red-800 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Row Deletion Suggestions ({deletions.length})
            </h4>
            <p className="text-xs text-red-600 mt-1">
              Claude recommends deleting these rows from the dataset
            </p>
          </div>
          
          {deletions.length > 1 && onDeleteRows && (
            <button
              onClick={() => onDeleteRows(deletions.map(d => d.rowIndex))}
              className="text-xs text-red-600 hover:text-red-700 font-medium bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors"
            >
              Delete All {deletions.length} Rows
            </button>
          )}
        </div>
      </div>
      
      {deletions.map((deletion, index) => (
        <div key={index} className="p-3 hover:bg-gray-50 transition-colors border-l-4 border-red-300">
          <div className="flex items-start gap-3">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">
                  Row {deletion.rowIndex + 1}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceStyles(deletion.confidence)}`}>
                  {deletion.confidence} confidence
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mt-0.5">{deletion.reason}</p>
              
              {onDeleteRow && (
                <button
                  onClick={() => onDeleteRow(deletion.rowIndex)}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium border border-red-300 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Delete Row {deletion.rowIndex + 1}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

RowDeletionsList.displayName = 'RowDeletionsList';