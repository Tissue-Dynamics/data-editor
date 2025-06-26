import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle, Loader2, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import type { Selection } from '../../types/data';
import type { TaskExample, Task, ClaudeAnalysisResult } from '../../types/tasks';
import { TaskExamples } from './TaskExamples';

interface TaskPanelProps {
  selection: Selection;
  onExecuteTask: (prompt: string, options?: { batchMode?: boolean }) => void;
  isLoading?: boolean;
  currentTask?: Task | null;
  error?: string | null;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  selection,
  onExecuteTask,
  isLoading = false,
  currentTask,
  error
}) => {
  const [prompt, setPrompt] = useState('');
  const [batchMode, setBatchMode] = useState(false);

  const hasSelection = selection.rows.length > 0 || selection.columns.length > 0;
  
  const handleExecute = () => {
    if (!prompt.trim() || !hasSelection) return;
    onExecuteTask(prompt, { batchMode });
    setPrompt('');
  };

  const handleExampleClick = (example: TaskExample) => {
    setPrompt(example.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4 h-full max-h-[80vh] xl:max-h-[600px] overflow-y-auto">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0" />
        <h3 className="text-lg font-semibold truncate">AI Assistant</h3>
      </div>

      {!hasSelection && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Select rows or columns to run AI tasks</span>
        </div>
      )}

      {hasSelection && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Selected: {selection.rows.length} rows, {selection.columns.length} columns
          </div>
          
          {/* Batch Mode Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(e) => setBatchMode(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Cost-saving mode</span>
            </label>
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Cheaper</span>
            </div>
          </div>
          
          {batchMode && (
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
              Uses faster model with limited tools to reduce costs. Best for simple validation tasks.
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to do with the selected data... Claude will figure out the best approach!"
          className="w-full p-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          rows={3}
          disabled={!hasSelection || isLoading}
        />
        <button
          onClick={handleExecute}
          disabled={!hasSelection || !prompt.trim() || isLoading}
          className={`absolute bottom-3 right-3 p-2 rounded-md transition-colors ${
            hasSelection && prompt.trim() && !isLoading
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Task Status Display */}
      {isLoading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-md text-sm">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Running task...</span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {currentTask && currentTask.status === 'completed' && (
        <div className="p-3 bg-green-50 rounded-md text-sm">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Task completed</span>
          </div>
          {currentTask.result && typeof currentTask.result === 'object' && 'analysis' in currentTask.result && (
            <div className="text-green-600">
              <p className="text-xs text-green-500 mb-1">
                Analysis method: {(currentTask.result as ClaudeAnalysisResult).method}
              </p>
              <pre className="whitespace-pre-wrap text-sm bg-green-100 p-2 rounded">
                {(currentTask.result as ClaudeAnalysisResult).analysis}
              </pre>
              {(currentTask.result as ClaudeAnalysisResult).validations && (
                <div className="mt-2">
                  <p className="text-xs text-green-500 mb-1">Validations found:</p>
                  <div className="space-y-1">
                    {(currentTask.result as ClaudeAnalysisResult).validations!.map((validation, index) => (
                      <div key={index} className="text-xs bg-green-100 p-1 rounded">
                        <span className="font-medium">Row {validation.rowIndex}, {validation.columnId}:</span>{' '}
                        <span className={validation.status === 'error' ? 'text-red-600' : validation.status === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
                          {validation.status}
                        </span>
                        {validation.reason && <span> - {validation.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {currentTask.result && typeof currentTask.result === 'string' && (
            <p className="text-green-600">{currentTask.result}</p>
          )}
        </div>
      )}
      
      {currentTask && currentTask.status === 'failed' && (
        <div className="p-3 bg-red-50 rounded-md text-sm">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Task failed</span>
          </div>
          {currentTask.result && typeof currentTask.result === 'object' && 'error' in currentTask.result && (
            <p className="text-red-600">{currentTask.result.error}</p>
          )}
          {typeof currentTask.result === 'string' && (
            <p className="text-red-600">{currentTask.result}</p>
          )}
        </div>
      )}

      <TaskExamples 
        onExampleClick={handleExampleClick}
        currentSelection={selection}
      />
    </div>
  );
};
