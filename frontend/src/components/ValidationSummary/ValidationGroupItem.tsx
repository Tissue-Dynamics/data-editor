import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CellValue } from '../../types/values';
import { ValidationItemDisplay } from './ValidationItemDisplay';

export interface ValidationMessage {
  rowIndex: number;
  columnId: string;
  status: 'valid' | 'warning' | 'error' | 'conflict';
  message: string;
  originalValue?: CellValue;
  suggestedValue?: CellValue;
  isEstimate?: boolean;
}

export interface GroupedValidation {
  key: string;
  suggestedValue: CellValue;
  originalValue: CellValue;
  status: ValidationMessage['status'];
  message: string;
  isEstimate: boolean;
  items: ValidationMessage[];
}

interface ValidationGroupItemProps {
  group: GroupedValidation;
  appliedValues: Set<string>;
  onApplyValue: (rowIndex: number, columnId: string, value: CellValue) => void;
  onApplyBatch: (group: GroupedValidation) => void;
}

export const ValidationGroupItem = memo<ValidationGroupItemProps>(({
  group,
  appliedValues,
  onApplyValue,
  onApplyBatch
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isGrouped = group.items.length > 1;
  
  const appliedCount = group.items.filter(item => 
    appliedValues.has(`${item.rowIndex}-${item.columnId}`)
  ).length;
  const allApplied = appliedCount === group.items.length;
  const someApplied = appliedCount > 0;

  if (!isGrouped) {
    // Single item display
    const item = group.items[0];
    return (
      <ValidationItemDisplay
        item={item}
        message={group.message}
        isEstimate={group.isEstimate}
        originalValue={group.originalValue}
        suggestedValue={group.suggestedValue}
        isApplied={appliedValues.has(`${item.rowIndex}-${item.columnId}`)}
        onApplyValue={onApplyValue}
      />
    );
  }

  // Grouped items display
  return (
    <div className="border-l-4 border-blue-200">
      {/* Group Header */}
      <div className="p-3 hover:bg-gray-50 transition-colors bg-blue-50">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-0.5 hover:bg-blue-100 rounded p-0.5 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-blue-600" />
            )}
          </button>
          
          <ValidationItemDisplay
            status={group.status}
            title={`${group.items.length} cells with identical changes`}
            message={group.message}
            isEstimate={group.isEstimate}
            originalValue={group.originalValue}
            suggestedValue={group.suggestedValue}
            showBatchBadge
            additionalInfo={
              <div className="mt-1 text-xs text-gray-500">
                Columns: {Array.from(new Set(group.items.map(item => item.columnId))).join(', ')}
              </div>
            }
            onApplyBatch={() => onApplyBatch(group)}
            batchCount={group.items.length}
            appliedCount={allApplied ? group.items.length : someApplied ? appliedCount : undefined}
            totalCount={group.items.length}
          />
        </div>
      </div>
      
      {/* Individual Items (when expanded) */}
      {isExpanded && (
        <div className="ml-6 border-l border-blue-200">
          {group.items.map((item, itemIndex) => {
            const cellKey = `${item.rowIndex}-${item.columnId}`;
            const isApplied = appliedValues.has(cellKey);
            
            return (
              <div key={itemIndex} className="p-3 hover:bg-gray-50 transition-colors border-l-2 border-transparent hover:border-blue-300">
                <ValidationItemDisplay
                  item={item}
                  isApplied={isApplied}
                  onApplyValue={onApplyValue}
                  showSimple
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

ValidationGroupItem.displayName = 'ValidationGroupItem';