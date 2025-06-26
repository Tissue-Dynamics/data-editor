import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface ValidationMessage {
  rowIndex: number;
  columnId: string;
  status: 'valid' | 'warning' | 'error' | 'conflict';
  message: string;
  suggestedValue?: any;
  isEstimate?: boolean;
}

interface ValidationSummaryProps {
  analysis?: string;
  validationMessages: ValidationMessage[];
  onApplyValue: (rowIndex: number, columnId: string, value: any) => void;
  onDismiss: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  analysis,
  validationMessages,
  onApplyValue,
  onDismiss
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [appliedValues, setAppliedValues] = useState<Set<string>>(new Set());

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

  const validCount = validationMessages.filter(m => m.status === 'valid').length;
  const warningCount = validationMessages.filter(m => m.status === 'warning').length;
  const errorCount = validationMessages.filter(m => m.status === 'error').length;

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
            {validationMessages.map((msg, index) => {
              const cellKey = `${msg.rowIndex}-${msg.columnId}`;
              const isApplied = appliedValues.has(cellKey);
              
              return (
                <div key={index} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(msg.status)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">
                          Row {msg.rowIndex + 1}, {msg.columnId}
                        </span>
                        {msg.isEstimate && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                            Estimate
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-0.5">{msg.message}</p>
                      
                      {msg.suggestedValue !== undefined && !msg.isEstimate && !isApplied && (
                        <button
                          onClick={() => handleApplyValue(msg)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Apply suggested value: {String(msg.suggestedValue)}
                        </button>
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
        </div>
      )}
    </div>
  );
};