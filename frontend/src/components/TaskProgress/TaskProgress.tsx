import React from 'react';
import { CheckCircle, AlertCircle, Clock, Search, Code, FileText } from 'lucide-react';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

interface TaskProgressProps {
  taskId: string;
  prompt: string;
  steps: TaskStep[];
  isRunning: boolean;
  validationCount?: number;
  onConfirmAll?: () => void;
  onDismissAll?: () => void;
}

const stepIcons = {
  search: Search,
  analysis: FileText,
  code: Code,
  validation: CheckCircle,
};

const statusColors = {
  pending: 'text-gray-400',
  running: 'text-blue-500 animate-spin',
  completed: 'text-green-500',
  error: 'text-red-500',
};

export const TaskProgress: React.FC<TaskProgressProps> = ({
  taskId,
  prompt,
  steps,
  isRunning,
  validationCount = 0,
  onConfirmAll,
  onDismissAll,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-gray-500" />
        <h3 className="font-medium text-gray-900">Task Progress</h3>
        {isRunning && (
          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
            Running
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">
        "{prompt}"
      </p>
      
      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = stepIcons[step.type];
          return (
            <div key={step.id} className="flex items-start gap-3">
              <Icon 
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  statusColors[step.status]
                }`} 
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {step.description}
                  </span>
                  <span className="text-xs text-gray-500">
                    {step.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {step.details && (
                  <p className="text-xs text-gray-600 mt-1">
                    {step.details}
                  </p>
                )}
                {step.status === 'running' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No active tasks
        </p>
      )}
      
      {/* Batch Actions for Validations */}
      {!isRunning && validationCount > 0 && (onConfirmAll || onDismissAll) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {validationCount} validation{validationCount === 1 ? '' : 's'} pending
            </span>
            <div className="flex gap-2">
              {onConfirmAll && (
                <button
                  onClick={onConfirmAll}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                >
                  Confirm All
                </button>
              )}
              {onDismissAll && (
                <button
                  onClick={onDismissAll}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  Dismiss All
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};