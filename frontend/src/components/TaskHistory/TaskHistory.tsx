import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { TaskEvent } from '../../types/tasks';

interface TaskHistoryItem {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  execution_time_ms?: number;
  analysis?: string;
  error_message?: string;
}

interface TaskHistoryProps {
  sessionId: string;
  onTaskSelect?: (task: TaskHistoryItem) => void;
}

export function TaskHistory({ sessionId, onTaskSelect }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskEvents, setTaskEvents] = useState<Record<string, TaskEvent[]>>({});

  useEffect(() => {
    loadTasks();
  }, [sessionId]);

  const loadTasks = async (isInitialLoad = true) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
        setError(null);
      }
      const response = await api.getSessionTasks(sessionId);
      setTasks(response.tasks);
      
      // Check if any tasks are still running
      const hasRunningTasks = response.tasks.some(t => 
        t.status === 'pending' || t.status === 'processing'
      );
      
      // If there are running tasks, set up polling
      if (hasRunningTasks) {
        // Load events for running tasks
        const runningTasks = response.tasks.filter(t => 
          t.status === 'pending' || t.status === 'processing'
        );
        
        for (const task of runningTasks) {
          try {
            const taskResponse = await api.getTaskStatus(task.id);
            if (taskResponse.events) {
              setTaskEvents(prev => ({ ...prev, [task.id]: taskResponse.events! }));
            }
          } catch (error) {
            console.error(`Failed to load events for task ${task.id}:`, error);
          }
        }
        
        if (!isInitialLoad) {
          setTimeout(() => loadTasks(false), 5000); // Poll every 5 seconds
        }
      }
    } catch (error) {
      console.error('Failed to load task history:', error);
      if (isInitialLoad) {
        setError('Failed to load task history');
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading task history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No tasks yet. Run an analysis to get started!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Task History</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => {
              setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
              onTaskSelect?.(task);
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {task.prompt}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(task.created_at)}
                  </span>
                  {task.execution_time_ms && (
                    <span className="text-xs text-gray-500">
                      {formatDuration(task.execution_time_ms)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {expandedTaskId === task.id && (
              <div className="mt-3 pt-3 border-t">
                {/* Show events for running tasks */}
                {(task.status === 'pending' || task.status === 'processing') && taskEvents[task.id] && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Progress:</p>
                    <div className="space-y-1">
                      {taskEvents[task.id].map((event, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            event.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'error' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`} />
                          <span>{event.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {task.analysis && (
                  <div className="text-sm text-gray-700">
                    <p className="font-medium mb-1">Analysis:</p>
                    <p className="whitespace-pre-wrap">{task.analysis}</p>
                  </div>
                )}
                {task.error_message && (
                  <div className="text-sm text-red-600">
                    <p className="font-medium mb-1">Error:</p>
                    <p>{task.error_message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}