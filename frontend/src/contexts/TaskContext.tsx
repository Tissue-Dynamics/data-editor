import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Task } from '../types/tasks';
import { useTaskManagement } from '../hooks/useTaskManagement';
import { useData } from './DataContext';
import { useSession } from './SessionContext';
import { useValidationContext } from './ValidationContext';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

interface TaskContextType {
  // Current task state
  currentTask: Task | null;
  isTaskRunning: boolean;
  taskError: string | null;
  taskSteps: TaskStep[];
  taskHistoryRefreshKey: number;
  
  // Task operations
  handleExecuteTask: (prompt: string, options?: { batchMode?: boolean }) => Promise<void>;
  clearTaskState: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const { data, selection } = useData();
  const { currentSession } = useSession();
  const { parseClaudeValidations } = useValidationContext();
  
  const {
    currentTask,
    isTaskRunning,
    taskError,
    taskSteps,
    taskHistoryRefreshKey,
    handleExecuteTask,
    clearTaskState,
  } = useTaskManagement(data, selection, currentSession, parseClaudeValidations);

  const value: TaskContextType = {
    currentTask,
    isTaskRunning,
    taskError,
    taskSteps,
    taskHistoryRefreshKey,
    handleExecuteTask,
    clearTaskState,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTask() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
}