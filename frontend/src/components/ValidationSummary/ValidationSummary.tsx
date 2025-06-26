import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import type { CellValue } from '../../types/values';

interface ValidationMessage {
  rowIndex: number;
  columnId: string;
  status: 'valid' | 'warning' | 'error' | 'conflict';
  message: string;
  originalValue?: CellValue;
  suggestedValue?: CellValue;
  isEstimate?: boolean;
}

interface ValidationSummaryProps {
  analysis?: string;
  validationMessages: ValidationMessage[];
  rowDeletions?: Array<{
    rowIndex: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  onApplyValue: (rowIndex: number, columnId: string, value: CellValue) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onDeleteRows?: (rowIndexes: number[]) => void;
  onDismiss: () => void;
}

interface GroupedValidation {
  key: string;
  suggestedValue: CellValue;
  originalValue: CellValue;
  status: ValidationMessage['status'];
  message: string;
  isEstimate: boolean;
  items: ValidationMessage[];
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group identical validation suggestions
  const groupedValidations = React.useMemo(() => {
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

  const getStatusIcon = (status: ValidationMessage['status']) => {
    switch (status) {
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

  const handleApplyValue = (msg: ValidationMessage) => {
    if (msg.suggestedValue !== undefined && !msg.isEstimate) {
      onApplyValue(msg.rowIndex, msg.columnId, msg.suggestedValue);
      setAppliedValues(prev => new Set(prev).add(`${msg.rowIndex}-${msg.columnId}`));
    }
  };

  const handleApplyBatch = (group: GroupedValidation) => {
    if (group.suggestedValue !== undefined && !group.isEstimate) {
      group.items.forEach(msg => {
        const cellKey = `${msg.rowIndex}-${msg.columnId}`;
        if (!appliedValues.has(cellKey)) {
          onApplyValue(msg.rowIndex, msg.columnId, msg.suggestedValue);
          setAppliedValues(prev => new Set(prev).add(cellKey));
        }
      });
    }
  };

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
            <div className="flex items-center gap-2 text-xs">
              {validCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {validCount} valid
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="w-3 h-3" />
                  {warningCount} warnings
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-3 h-3" />
                  {errorCount} errors
                </span>
              )}
              {deletionCount > 0 && (
                <span className="flex items-center gap-1 text-red-700">
                  <XCircle className="w-3 h-3" />
                  {deletionCount} deletion{deletionCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
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
          {analysis && (
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis}</p>
            </div>
          )}
          
          <div className="divide-y divide-gray-100">
            {groupedValidations.map((group, groupIndex) => {
              const isGrouped = group.items.length > 1;
              const isGroupExpanded = expandedGroups.has(group.key);
              const appliedCount = group.items.filter(item => 
                appliedValues.has(`${item.rowIndex}-${item.columnId}`)
              ).length;
              const allApplied = appliedCount === group.items.length;
              const someApplied = appliedCount > 0;
              
              if (isGrouped) {
                return (
                  <div key={groupIndex} className="border-l-4 border-blue-200">
                    {/* Group Header */}
                    <div className="p-3 hover:bg-gray-50 transition-colors bg-blue-50">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setExpandedGroups(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(group.key)) {
                              newSet.delete(group.key);
                            } else {
                              newSet.add(group.key);
                            }
                            return newSet;
                          })}
                          className="mt-0.5 hover:bg-blue-100 rounded p-0.5 transition-colors"
                        >
                          {isGroupExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                        
                        {getStatusIcon(group.status)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900">
                              {group.items.length} cells with identical changes
                            </span>
                            
                            <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              Batch
                            </span>
                            
                            {group.isEstimate && (
                              <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                Estimate
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-0.5">{group.message}</p>
                          
                          <div className="mt-1 text-xs text-gray-500">
                            Columns: {Array.from(new Set(group.items.map(item => item.columnId))).join(', ')}
                          </div>
                          
                          {group.suggestedValue !== undefined && !group.isEstimate && !allApplied && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">
                                <span className="font-mono">
                                  <span className="bg-red-100 text-red-800 px-1 rounded">{String(group.originalValue)}</span>
                                  {' → '}
                                  <span className="bg-green-100 text-green-800 px-1 rounded">{String(group.suggestedValue)}</span>
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApplyBatch(group)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
                                >
                                  Apply to all {group.items.length} cells
                                </button>
                                {someApplied && (
                                  <span className="text-xs text-gray-500">
                                    ({appliedCount}/{group.items.length} applied)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {allApplied && (
                            <span className="mt-2 text-xs text-green-600 font-medium inline-block">
                              ✓ All {group.items.length} applied
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Individual Items (when expanded) */}
                    {isGroupExpanded && (
                      <div className="ml-6 border-l border-blue-200">
                        {group.items.map((item, itemIndex) => {
                          const cellKey = `${item.rowIndex}-${item.columnId}`;
                          const isApplied = appliedValues.has(cellKey);
                          
                          return (
                            <div key={itemIndex} className="p-3 hover:bg-gray-50 transition-colors border-l-2 border-transparent hover:border-blue-300">
                              <div className="flex items-start gap-3">
                                {getStatusIcon(item.status)}
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-gray-900">
                                      Row {item.rowIndex + 1}, {item.columnId}
                                    </span>
                                  </div>
                                  
                                  {item.suggestedValue !== undefined && !item.isEstimate && !isApplied && (
                                    <div className="mt-2">
                                      <button
                                        onClick={() => handleApplyValue(item)}
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              } else {
                // Single item display
                const item = group.items[0];
                const cellKey = `${item.rowIndex}-${item.columnId}`;
                const isApplied = appliedValues.has(cellKey);
                
                return (
                  <div key={groupIndex} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(group.status)}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">
                            Row {item.rowIndex + 1}, {item.columnId}
                          </span>
                          
                          {group.isEstimate && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                              Estimate
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mt-0.5">{group.message}</p>
                        
                        {group.suggestedValue !== undefined && !group.isEstimate && !isApplied && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">
                              <span className="font-mono">
                                <span className="bg-red-100 text-red-800 px-1 rounded">{String(group.originalValue)}</span>
                                {' → '}
                                <span className="bg-green-100 text-green-800 px-1 rounded">{String(group.suggestedValue)}</span>
                              </span>
                            </div>
                            <button
                              onClick={() => handleApplyValue(item)}
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
                  </div>
                );
              }
            })}
            
            {/* Row Deletion Suggestions */}
            {rowDeletions.length > 0 && (
              <div className="border-t border-gray-200 mt-2 pt-2">
                <div className="px-3 py-2 bg-red-50 border-b border-red-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-800 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Row Deletion Suggestions ({rowDeletions.length})
                      </h4>
                      <p className="text-xs text-red-600 mt-1">
                        Claude recommends deleting these rows from the dataset
                      </p>
                    </div>
                    
                    {rowDeletions.length > 1 && onDeleteRows && (
                      <button
                        onClick={() => onDeleteRows(rowDeletions.map(d => d.rowIndex))}
                        className="text-xs text-red-600 hover:text-red-700 font-medium bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors"
                      >
                        Delete All {rowDeletions.length} Rows
                      </button>
                    )}
                  </div>
                </div>
                
                {rowDeletions.map((deletion, index) => (
                  <div key={index} className="p-3 hover:bg-gray-50 transition-colors border-l-4 border-red-300">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">
                            Row {deletion.rowIndex + 1}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            deletion.confidence === 'high' ? 'text-red-700 bg-red-100' :
                            deletion.confidence === 'medium' ? 'text-orange-700 bg-orange-100' :
                            'text-yellow-700 bg-yellow-100'
                          }`}>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};