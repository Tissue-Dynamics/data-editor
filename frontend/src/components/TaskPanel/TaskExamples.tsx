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
    prompt: 'Fill in the missing values in these rows',
    requiresRowSelection: true,
    icon: 'Search'
  },
  {
    label: 'Validate Data',
    prompt: 'Check if these values are correct and flag any issues',
    requiresRowSelection: true,
    icon: 'CheckCircle'
  },
  {
    label: 'Find Duplicates',
    prompt: 'Find and highlight any duplicate entries in this data',
    requiresRowSelection: true,
    icon: 'FileSearch'
  },
  {
    label: 'Standardize Format',
    prompt: 'Standardize the format of values in this column',
    requiresColumnSelection: true,
    icon: 'TestTube'
  },
  {
    label: 'Calculate Statistics',
    prompt: 'Calculate mean, median, and standard deviation for this column',
    requiresColumnSelection: true,
    icon: 'Calculator'
  },
  {
    label: 'Clean Data',
    prompt: 'Clean and normalize the data in these cells',
    requiresRowSelection: true,
    icon: 'Lightbulb'
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
        {availableExamples.slice(0, 4).map((example, index) => {
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