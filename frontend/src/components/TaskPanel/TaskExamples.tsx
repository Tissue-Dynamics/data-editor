import React from 'react';
import { CheckCircle, Search, TestTube, Calculator, FileSearch, Lightbulb } from 'lucide-react';
import type { TaskExample } from '../../types/tasks';
import type { Selection } from '../../types/data';

interface TaskExamplesProps {
  onExampleClick: (example: TaskExample) => void;
  currentSelection: Selection;
}

const examples: TaskExample[] = [
  {
    label: 'Fill Missing Values',
    prompt: 'Fill in missing values for these rows',
    requiresRowSelection: true,
    icon: 'Search'
  },
  {
    label: 'Validate Data',
    prompt: 'Take 20 of these rows and double check that they are correct',
    requiresRowSelection: true,
    icon: 'CheckCircle'
  },
  {
    label: 'Column Test',
    prompt: 'Write a test to ensure that these values are between 0-100µM',
    requiresColumnSelection: true,
    icon: 'TestTube'
  },
  {
    label: 'Unit Conversion',
    prompt: 'Create a new column that converts ng/mL to µM based on molecular weight',
    requiresColumnSelection: true,
    icon: 'Calculator'
  },
  {
    label: 'Research Values',
    prompt: 'Research and verify the company names in these rows',
    requiresRowSelection: true,
    icon: 'FileSearch'
  }
];

const iconMap = {
  Search,
  CheckCircle,
  TestTube,
  Calculator,
  FileSearch,
  Lightbulb
};

export const TaskExamples: React.FC<TaskExamplesProps> = ({ 
  onExampleClick, 
  currentSelection 
}) => {
  const hasRows = currentSelection.rows.length > 0;
  const hasColumns = currentSelection.columns.length > 0;

  const availableExamples = examples.filter(example => {
    if (example.requiresRowSelection && !hasRows) return false;
    if (example.requiresColumnSelection && !hasColumns) return false;
    return true;
  });

  if (availableExamples.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide">Example Tasks</div>
      <div className="space-y-1">
        {availableExamples.slice(0, 3).map((example, index) => {
          const Icon = iconMap[example.icon as keyof typeof iconMap] || Lightbulb;
          
          return (
            <button
              key={index}
              onClick={() => onExampleClick(example)}
              className="flex items-center gap-2 p-2 w-full text-left rounded-md border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group"
            >
              <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 group-hover:text-purple-700 truncate">
                  {example.label}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {example.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};