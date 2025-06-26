import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle, Search, TestTube, CheckCircle, Calculator } from 'lucide-react';
import type { Selection } from '../../types/data';
import type { TaskType, TaskExample } from '../../types/tasks';
import { TaskExamples } from './TaskExamples';
import { detectTaskType } from './taskTypeDetector';

interface TaskPanelProps {
  selection: Selection;
  onExecuteTask: (prompt: string, taskType: TaskType) => void;
  isProcessing?: boolean;
}

const taskTypes = [
  { 
    type: 'research' as TaskType, 
    label: 'Research', 
    icon: Search, 
    activeClass: 'bg-blue-100 text-blue-700 border-blue-300' 
  },
  { 
    type: 'column_test' as TaskType, 
    label: 'Test', 
    icon: TestTube, 
    activeClass: 'bg-green-100 text-green-700 border-green-300' 
  },
  { 
    type: 'validate_rows' as TaskType, 
    label: 'Validate', 
    icon: CheckCircle, 
    activeClass: 'bg-purple-100 text-purple-700 border-purple-300' 
  },
  { 
    type: 'transform' as TaskType, 
    label: 'Transform', 
    icon: Calculator, 
    activeClass: 'bg-orange-100 text-orange-700 border-orange-300' 
  },
];

export const TaskPanel: React.FC<TaskPanelProps> = ({
  selection,
  onExecuteTask,
  isProcessing = false
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [autoDetect, setAutoDetect] = useState(true);

  const hasSelection = selection.rows.length > 0 || selection.columns.length > 0;
  
  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // Only auto-detect if no type is manually selected
    if (autoDetect && value.trim()) {
      const detected = detectTaskType(value);
      if (detected !== 'general') {
        setSelectedType(detected);
      }
    }
  };

  const handleExecute = () => {
    if (!prompt.trim() || !hasSelection) return;
    const taskType = selectedType || detectTaskType(prompt);
    onExecuteTask(prompt, taskType);
    setPrompt('');
    if (autoDetect) {
      setSelectedType(null);
    }
  };

  const handleTypeSelect = (type: TaskType) => {
    setSelectedType(type);
    setAutoDetect(false);
  };

  const clearTypeSelection = () => {
    setSelectedType(null);
    setAutoDetect(true);
  };

  const handleExampleClick = (example: TaskExample) => {
    handlePromptChange(example.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold">AI Task Assistant</h3>
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

      <div className="flex gap-2 mb-3">
        {taskTypes.map(({ type, label, icon: Icon, activeClass }) => (
          <button
            key={type}
            onClick={() => handleTypeSelect(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border-2 ${
              selectedType === type
                ? activeClass
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        {selectedType && !autoDetect && (
          <button
            onClick={clearTypeSelection}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Auto-detect
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to do with the selected data..."
          className="w-full p-3 pr-12 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
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

      {selectedType && (
        <div className="text-xs text-gray-500">
          Task type: <span className="font-medium capitalize">{selectedType.replace('_', ' ')}</span>
          {autoDetect && <span className="italic"> (auto-detected)</span>}
        </div>
      )}

      <TaskExamples 
        onExampleClick={handleExampleClick}
        currentSelection={selection}
      />
    </div>
  );
};