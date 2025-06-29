import { memo, ReactNode } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import type { CellValue } from '../../types/values';
import type { ValidationMessage } from './ValidationGroupItem';

interface ValidationItemDisplayProps {
  item?: ValidationMessage;
  status?: ValidationMessage['status'];
  title?: string;
  message?: string;
  isEstimate?: boolean;
  originalValue?: CellValue;
  suggestedValue?: CellValue;
  isApplied?: boolean;
  onApplyValue?: (rowIndex: number, columnId: string, value: CellValue) => void;
  showBatchBadge?: boolean;
  additionalInfo?: ReactNode;
  onApplyBatch?: () => void;
  batchCount?: number;
  appliedCount?: number;
  totalCount?: number;
  showSimple?: boolean;
}

export const ValidationItemDisplay = memo<ValidationItemDisplayProps>(({
  item,
  status,
  title,
  message,
  isEstimate,
  originalValue,
  suggestedValue,
  isApplied,
  onApplyValue,
  showBatchBadge,
  additionalInfo,
  onApplyBatch,
  batchCount,
  appliedCount,
  totalCount,
  showSimple
}) => {
  const displayStatus = status || item?.status || 'valid';
  const displayMessage = message || item?.message || '';
  const displayIsEstimate = isEstimate ?? item?.isEstimate ?? false;
  const displayOriginalValue = originalValue ?? item?.originalValue;
  const displaySuggestedValue = suggestedValue ?? item?.suggestedValue;

  const getStatusIcon = (s: ValidationMessage['status']) => {
    switch (s) {
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'conflict':
        return <Info className="w-4 h-4 text-orange-500" />;
    }
  };

  const handleApply = () => {
    if (item && onApplyValue && displaySuggestedValue !== undefined && !displayIsEstimate) {
      onApplyValue(item.rowIndex, item.columnId, displaySuggestedValue);
    }
  };

  if (showSimple && item) {
    return (
      <div className="flex items-start gap-3">
        {getStatusIcon(displayStatus)}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-900">
              Row {item.rowIndex + 1}, {item.columnId}
            </span>
          </div>
          
          {displaySuggestedValue !== undefined && !displayIsEstimate && !isApplied && (
            <div className="mt-2">
              <button
                onClick={handleApply}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Apply suggested value
              </button>
            </div>
          )}
          
          {isApplied && (
            <span className="mt-2 text-xs text-green-600 font-medium inline-block">
              ✓ Applied
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {!showBatchBadge && getStatusIcon(displayStatus)}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900">
            {title || (item && `Row ${item.rowIndex + 1}, ${item.columnId}`)}
          </span>
          
          {showBatchBadge && (
            <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
              Batch
            </span>
          )}
          
          {displayIsEstimate && (
            <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
              Estimate
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-600 mt-0.5">{displayMessage}</p>
        
        {additionalInfo}
        
        {displaySuggestedValue !== undefined && !displayIsEstimate && !isApplied && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">
              <span className="font-mono">
                <span className="bg-red-100 text-red-800 px-1 rounded">{String(displayOriginalValue)}</span>
                {' → '}
                <span className="bg-green-100 text-green-800 px-1 rounded">{String(displaySuggestedValue)}</span>
              </span>
            </div>
            
            {onApplyBatch ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onApplyBatch}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
                >
                  Apply to all {batchCount} cells
                </button>
                {appliedCount !== undefined && totalCount && appliedCount < totalCount && (
                  <span className="text-xs text-gray-500">
                    ({appliedCount}/{totalCount} applied)
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={handleApply}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Apply suggested value
              </button>
            )}
          </div>
        )}
        
        {isApplied && (
          <span className="mt-2 text-xs text-green-600 font-medium inline-block">
            ✓ {appliedCount !== undefined ? `All ${appliedCount} applied` : 'Applied'}
          </span>
        )}
      </div>
    </div>
  );
});

ValidationItemDisplay.displayName = 'ValidationItemDisplay';