import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSession, useTask } from '../../contexts/AppProviders';
import type { ClaudeAnalysisResult, TaskWithValidations } from '../../types/tasks';

interface TaskHistoryItem {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  execution_time_ms?: number;
  analysis?: string;
  error_message?: string;
  result?: ClaudeAnalysisResult;
}

interface TaskHistoryProps {
  onApplyTask: (task: TaskWithValidations) => void;
}

export function TaskHistory({ onApplyTask }: TaskHistoryProps) {
  const { currentSession } = useSession();
  const { 
    currentTask,
    isTaskRunning,
    taskSteps,
    taskHistoryRefreshKey 
  } = useTask();
  
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSession?.id) return;
    
    const loadTasks = async () => {
      try {
        setLoading(true);
        const response = await api.getSessionTasks(currentSession.id);
        setTasks(response.tasks.reverse());
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [currentSession?.id, taskHistoryRefreshKey]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Task History</h4>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (tasks.length === 0 && !currentTask) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Task History</h4>
        <p className="text-sm text-gray-500">No tasks yet</p>
      </div>
    );
  }

  const allTasks = [
    ...(currentTask && isTaskRunning ? [{
      id: currentTask.id,
      prompt: currentTask.prompt,
      status: 'processing' as const,
      created_at: currentTask.createdAt.toISOString(),
      steps: taskSteps
    }] : []),
    ...tasks
  ];

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">Task History</h4>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {allTasks.map((task) => (
          <div 
            key={task.id} 
            className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start mb-1">
              <p className="text-sm font-medium text-gray-900 flex-1 pr-2">
                {task.prompt}
              </p>
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                task.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                task.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {task.status}
              </span>
            </div>
            
            <p className="text-xs text-gray-500">
              {new Date(task.created_at).toLocaleString()}
              {task.execution_time_ms && ` • ${(task.execution_time_ms / 1000).toFixed(1)}s`}
            </p>
            
            {task.status === 'processing' && task.steps && task.steps.length > 0 && (
              <div className="mt-2 space-y-1">
                {task.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center text-xs text-gray-600">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      step.status === 'error' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`} />
                    <span>{step.description}</span>
                  </div>
                ))}
              </div>
            )}
            
            {task.status === 'completed' && task.result && task.result.validations && task.result.validations.length > 0 && (
              <button
                onClick={() => onApplyTask({
                  id: task.id,
                  prompt: task.prompt,
                  selection: { rows: [], columns: [] },
                  status: 'completed',
                  createdAt: new Date(task.created_at),
                  completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
                  result: {
                    success: true,
                    message: task.analysis,
                    validations: task.result.validations,
                    analysis: task.result.analysis
                  }
                } as TaskWithValidations)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Apply {task.result.validations.length} validations
              </button>
            )}
            
            {task.error_message && (
              <p className="mt-1 text-xs text-red-600">{task.error_message}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}