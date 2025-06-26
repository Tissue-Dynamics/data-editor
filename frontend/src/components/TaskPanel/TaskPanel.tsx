import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import type { Selection } from '../../types/data';
import type { TaskExample } from '../../types/tasks';
import { TaskExamples } from './TaskExamples';

interface TaskPanelProps {
  selection: Selection;
  onExecuteTask: (prompt: string) => void;
  isProcessing?: boolean;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  selection,
  onExecuteTask,
  isProcessing = false
}) => {
  const [prompt, setPrompt] = useState('');

  const hasSelection = selection.rows.length > 0 || selection.columns.length > 0;
  
  const handleExecute = () => {
    if (!prompt.trim() || !hasSelection) return;
    onExecuteTask(prompt);
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
    <div className="bg-white rounded-lg shadow p-4 space-y-4 h-full max-h-[600px] overflow-y-auto">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold">AI Assistant</h3>
      </div>

      {!hasSelection && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Select rows or columns to run AI tasks</span>
        </div>
      )}

      {hasSelection && (
        <div className="text-sm text-gray-600">
          Selected: {selection.rows.length} rows, {selection.columns.length} columns
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
          disabled={!hasSelection || isProcessing}
        />
        <button
          onClick={handleExecute}
          disabled={!hasSelection || !prompt.trim() || isProcessing}
          className={`absolute bottom-3 right-3 p-2 rounded-md transition-colors ${
            hasSelection && prompt.trim() && !isProcessing
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <TaskExamples 
        onExampleClick={handleExampleClick}
        currentSelection={selection}
      />
    </div>
  );
};
