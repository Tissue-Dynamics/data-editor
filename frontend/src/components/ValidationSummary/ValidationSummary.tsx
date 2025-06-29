import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CellValue } from '../../types/values';
import { ValidationStats } from './ValidationStats';
import { ValidationAnalysis } from './ValidationAnalysis';
import { ValidationGroupItem } from './ValidationGroupItem';
import { RowDeletionsList } from './RowDeletionsList';
import type { ValidationMessage, GroupedValidation } from './ValidationGroupItem';
import type { RowDeletion } from './RowDeletionsList';

interface ValidationSummaryProps {
  analysis?: string;
  validationMessages: ValidationMessage[];
  rowDeletions?: RowDeletion[];
  onApplyValue: (rowIndex: number, columnId: string, value: CellValue) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onDeleteRows?: (rowIndexes: number[]) => void;
  onDismiss: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  analysis,
  validationMessages,
  rowDeletions = [],
  onApplyValue,
  onDeleteRow,
  onDeleteRows,
  onDismiss
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [appliedValues, setAppliedValues] = useState<Set<string>>(new Set());

  // Group identical validation suggestions
  const groupedValidations = useMemo(() => {
    const groups = new Map<string, GroupedValidation>();
    
    validationMessages.forEach(msg => {
      // Create a key based on the change being suggested
      const groupKey = `${msg.originalValue}->${msg.suggestedValue}-${msg.status}-${msg.message}-${msg.isEstimate}`;
      
      if (groups.has(groupKey)) {
        groups.get(groupKey)!.items.push(msg);
      } else {
        groups.set(groupKey, {
          key: groupKey,
          suggestedValue: msg.suggestedValue,
          originalValue: msg.originalValue,
          status: msg.status,
          message: msg.message,
          isEstimate: msg.isEstimate || false,
          items: [msg]
        });
      }
    });
    
    return Array.from(groups.values());
  }, [validationMessages]);

  const handleApplyValue = useCallback((rowIndex: number, columnId: string, value: CellValue) => {
    onApplyValue(rowIndex, columnId, value);
    setAppliedValues(prev => new Set(prev).add(`${rowIndex}-${columnId}`));
  }, [onApplyValue]);

  const handleApplyBatch = useCallback((group: GroupedValidation) => {
    if (group.suggestedValue !== undefined && !group.isEstimate) {
      group.items.forEach(msg => {
        const cellKey = `${msg.rowIndex}-${msg.columnId}`;
        if (!appliedValues.has(cellKey)) {
          onApplyValue(msg.rowIndex, msg.columnId, msg.suggestedValue);
          setAppliedValues(prev => new Set(prev).add(cellKey));
        }
      });
    }
  }, [appliedValues, onApplyValue]);

  // Calculate counts
  const validCount = validationMessages.filter(m => m.status === 'valid').length;
  const warningCount = validationMessages.filter(m => m.status === 'warning').length;
  const errorCount = validationMessages.filter(m => m.status === 'error').length;
  const deletionCount = rowDeletions.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-900">Validation Results</h3>
            <ValidationStats
              validCount={validCount}
              warningCount={warningCount}
              errorCount={errorCount}
              deletionCount={deletionCount}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={onDismiss}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          <ValidationAnalysis analysis={analysis} />
          
          <div className="divide-y divide-gray-100">
            {groupedValidations.map((group, index) => (
              <ValidationGroupItem
                key={index}
                group={group}
                appliedValues={appliedValues}
                onApplyValue={handleApplyValue}
                onApplyBatch={handleApplyBatch}
              />
            ))}
            
            <RowDeletionsList
              deletions={rowDeletions}
              onDeleteRow={onDeleteRow}
              onDeleteRows={onDeleteRows}
            />
          </div>
        </div>
      )}
    </div>
  );
};