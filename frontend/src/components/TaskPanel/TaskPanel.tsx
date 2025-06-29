import React, { useState } from 'react';
import { TaskExamples } from './TaskExamples';
import { TaskProgress } from '../TaskProgress/TaskProgress';
import { AlertCircle } from 'lucide-react';
import { useData, useTask } from '../../contexts/AppProviders';

export function TaskPanel() {
  const { selection } = useData();
  const { 
    currentTask,
    isTaskRunning: isLoading,
    taskError: error,
    taskSteps,
    handleExecuteTask: onExecuteTask
  } = useTask();
  
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedExample, setSelectedExample] = useState<{ label: string; prompt: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onExecuteTask(prompt.trim());
  };

  const handleSelectExample = (example: { label: string; prompt: string }) => {
    setSelectedExample(example);
    setPrompt(example.prompt);
  };

  const rowCount = selection.rows.length;
  const columnCount = selection.columns.length;
  const cellCount = selection.cells?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">AI Data Assistant</h3>
      
      {/* Selection info */}
      <div className="mb-3 text-sm text-gray-600">
        {rowCount > 0 || columnCount > 0 || cellCount > 0 ? (
          <div>
            Selected: 
            {rowCount > 0 && ` ${rowCount} row${rowCount !== 1 ? 's' : ''}`}
            {columnCount > 0 && ` ${columnCount} column${columnCount !== 1 ? 's' : ''}`}
            {cellCount > 0 && ` ${cellCount} cell${cellCount !== 1 ? 's' : ''}`}
          </div>
        ) : (
          <div>No selection - AI will analyze all data</div>
        )}
      </div>

      {/* Task form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to do with the data..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            disabled={isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Run Task'}
        </button>
      </form>

      {/* Error display */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Task Progress */}
      {(currentTask || taskSteps.length > 0) && (
        <div className="mt-4">
          <TaskProgress steps={taskSteps} />
        </div>
      )}

      {/* Examples section */}
      <div className="mt-4 border-t pt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>Example Tasks</span>
          <span className="text-gray-400">{isExpanded ? '−' : '+'}</span>
        </button>
        
        {isExpanded && (
          <div className="mt-2">
            <TaskExamples 
              onExampleClick={handleSelectExample}
              currentSelection={selection}
            />
          </div>
        )}
      </div>
    </div>
  );
}