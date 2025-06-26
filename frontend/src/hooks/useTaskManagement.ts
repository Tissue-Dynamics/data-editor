import { useState, useCallback, useRef } from 'react';
import type { Task, ClaudeAnalysisResult } from '../types/tasks';
import type { Selection, DataRow } from '../types/data';
import type { StreamingEvent } from '../types/values';
import { api, ApiError } from '../services/api';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

export function useTaskManagement(
  data: DataRow[],
  selection: Selection,
  currentSession: { id: string } | null,
  parseClaudeValidations: (result: ClaudeAnalysisResult, taskId?: string, taskPrompt?: string) => void
) {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [taskHistoryRefreshKey, setTaskHistoryRefreshKey] = useState(0);
  
  // Use ref to store step mappings instead of window object
  const stepMappingRef = useRef<Map<string, string>>(new Map());

  const addTaskStep = useCallback((step: Omit<TaskStep, 'id' | 'timestamp'>) => {
    const newStep: TaskStep = {
      ...step,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setTaskSteps(prev => [...prev, newStep]);
    return newStep.id;
  }, []);

  const updateTaskStep = useCallback((stepId: string, updates: Partial<TaskStep>) => {
    setTaskSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  const handleStreamingEvent = useCallback((event: StreamingEvent) => {
    console.log('Streaming event:', event);
    
    const getStepType = (event: StreamingEvent) => {
      if (event.tool === 'web_search') return 'search';
      if (event.tool === 'bash') return 'code';
      if (event.tool === 'structured_output') return 'validation';
      if (event.type.includes('analysis')) return 'analysis';
      return 'validation';
    };

    if (event.type === 'analysis_start' || event.type === 'tool_start') {
      const stepId = addTaskStep({
        type: getStepType(event),
        description: event.description,
        status: 'running',
        details: event.details
      });
      
      // Store mapping of tool to step ID for completion
      if (event.tool) {
        stepMappingRef.current.set(`step_${event.tool}`, stepId);
      }
    } 
    else if (event.type === 'tool_complete' || event.type === 'analysis_complete') {
      // Use tool type to find the right step
      const stepId = event.tool ? stepMappingRef.current.get(`step_${event.tool}`) : null;
      
      setTaskSteps(prev => prev.map(step => {
        // Match by tool type or by description pattern
        const shouldComplete = stepId ? step.id === stepId : 
          (event.tool === 'web_search' && step.type === 'search' && step.status === 'running') ||
          (event.tool === 'bash' && step.type === 'code' && step.status === 'running') ||
          (event.tool === 'structured_output' && step.type === 'validation' && step.status === 'running') ||
          (event.type === 'analysis_complete' && step.type === 'analysis' && step.status === 'running');
          
        return shouldComplete
          ? { ...step, status: 'completed', details: event.data ? JSON.stringify(event.data) : step.details }
          : step;
      }));
      
      // Clean up mapping
      if (event.tool && stepId) {
        stepMappingRef.current.delete(`step_${event.tool}`);
      }
    }
    else if (event.type === 'tool_error') {
      setTaskSteps(prev => prev.map(step => 
        (event.tool && step.type === getStepType(event) && step.status === 'running')
          ? { ...step, status: 'error', details: event.details }
          : step
      ));
    }
  }, [addTaskStep]);

  const connectToTaskStream = useCallback((taskId: string) => {
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/tasks/${taskId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('Connected to task stream:', data.taskId);
            break;
            
          case 'task_event':
            handleStreamingEvent(data.event);
            break;
            
          case 'task_complete':
            console.log('Task completed via stream:', data.status);
            eventSource.close();
            break;
            
          case 'error':
            console.error('Stream error:', data.message);
            eventSource.close();
            break;
        }
      } catch (error) {
        console.error('Failed to parse streaming data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };

    return eventSource;
  }, [handleStreamingEvent]);

  const handleExecuteTask = async (prompt: string, options?: { batchMode?: boolean }) => {
    setIsTaskRunning(true);
    setTaskError(null);
    setTaskSteps([]); // Clear previous steps
    
    // Create a placeholder task object immediately for UI
    const placeholderTask: Task = {
      id: 'pending',
      prompt,
      selection: {
        rows: selection.rows,
        columns: selection.columns,
      },
      status: 'pending',
      createdAt: new Date(),
    };
    
    setCurrentTask(placeholderTask);
    
    // Add an immediate step to show task is starting
    addTaskStep({
      type: 'analysis',
      description: 'Starting analysis...',
      status: 'running',
      details: 'Preparing request'
    });
    
    try {
      // Create the task
      const response = await api.executeTask({
        prompt,
        selectedRows: selection.rows,
        selectedColumns: selection.columns,
        data: data.filter((_, index) => selection.rows.includes(index)),
        sessionId: currentSession?.id,
        batchMode: options?.batchMode,
      });
      
      // Create a task object for UI with real ID
      const newTask: Task = {
        id: response.taskId,
        prompt,
        selection: {
          rows: selection.rows,
          columns: selection.columns,
        },
        status: 'running',
        createdAt: new Date(),
      };
      
      setCurrentTask(newTask);
      
      // Update the initial step to show we're connected
      setTaskSteps(prev => prev.map(step => 
        step.description === 'Starting analysis...' 
          ? { ...step, status: 'completed', details: `Task created: ${response.taskId}` }
          : step
      ));
      
      // Connect to real-time streaming
      const eventSource = connectToTaskStream(response.taskId);
      
      // Poll for task completion
      const pollForCompletion = async () => {
        try {
          const statusResponse = await api.getTaskStatus(response.taskId);
          
          if (statusResponse.status === 'completed') {
            console.log('Task completed! Full response:', statusResponse);
            console.log('Result type:', typeof statusResponse.result);
            console.log('Result:', statusResponse.result);
            
            // Parse Claude results and update table validations
            if (statusResponse.result && typeof statusResponse.result === 'object' && 'analysis' in statusResponse.result) {
              console.log('Parsing Claude validations...');
              parseClaudeValidations(statusResponse.result as ClaudeAnalysisResult, newTask.id, newTask.prompt);
            } else {
              console.log('No analysis object found in result');
            }
            
            setCurrentTask({
              ...newTask,
              status: 'completed',
              completedAt: new Date(),
              result: {
                success: true,
                message: typeof statusResponse.result === 'string' ? statusResponse.result : 'Analysis completed',
              },
            });
            setIsTaskRunning(false);
            
            // Refresh task history
            setTaskHistoryRefreshKey(prev => prev + 1);
            
            // Don't automatically clear task steps - they should persist until next task
          } else if (statusResponse.status === 'failed') {
            setCurrentTask({
              ...newTask,
              status: 'failed',
              completedAt: new Date(),
              result: {
                success: false,
                error: statusResponse.error || 'Task failed',
              },
            });
            setIsTaskRunning(false);
            eventSource.close();
            
            // Refresh task history
            setTaskHistoryRefreshKey(prev => prev + 1);
          } else {
            // Still processing, poll again
            setTimeout(pollForCompletion, 1000);
          }
        } catch (error) {
          eventSource.close();
          setCurrentTask({
            ...newTask,
            status: 'failed',
            completedAt: new Date(),
            result: {
              success: false,
              error: error instanceof Error ? error.message : 'Task failed',
            },
          });
          setIsTaskRunning(false);
        }
      };
      
      // Start polling after a short delay
      setTimeout(pollForCompletion, 1000);
      
    } catch (error) {
      // Check if it's a rate limit error
      const isRateLimit = (error instanceof ApiError && error.status === 429) || 
                         (error instanceof Error && error.message.includes('429'));
      
      if (isRateLimit) {
        console.log('Rate limit hit, falling back to batch processing...');
        
        try {
          // Create a batch with single task
          const batchResponse = await api.createBatch({
            tasks: [{
              prompt,
              selectedRows: selection.rows,
              selectedColumns: selection.columns,
              data: data.filter((_, index) => selection.rows.includes(index)),
            }],
            sessionId: currentSession?.id,
          });
          
          // Show batch processing UI
          setCurrentTask({
            id: batchResponse.taskIds[0],
            prompt,
            selection: {
              rows: selection.rows,
              columns: selection.columns,
            },
            status: 'running',
            createdAt: new Date(),
          });
          
          // Add batch processing step
          const batchStepId = addTaskStep({
            type: 'analysis',
            description: 'Processing via Message Batches API (may take a few minutes)',
            status: 'running',
            details: `Batch ID: ${batchResponse.batchId}`
          });
          
          // Poll batch status
          let pollCount = 0;
          const pollBatch = async () => {
            try {
              const batchStatus = await api.getBatchStatus(batchResponse.batchId);
              pollCount++;
              
              // Update progress details
              updateTaskStep(batchStepId, {
                details: `Batch ID: ${batchResponse.batchId} | Status: ${batchStatus.counts.completed}/${batchStatus.counts.total} completed | Poll #${pollCount}`
              });
              
              if (batchStatus.status === 'completed') {
                // Get the completed task
                const completedTask = batchStatus.tasks.find(t => t.status === 'completed');
                if (completedTask && completedTask.result) {
                  console.log('Batch task completed, parsing results:', completedTask.result);
                  
                  // Ensure we have the validations
                  if (completedTask.result.validations && completedTask.result.validations.length > 0) {
                    console.log(`Found ${completedTask.result.validations.length} validations in batch result`);
                    parseClaudeValidations(completedTask.result, batchResponse.taskIds[0], prompt);
                  } else {
                    console.warn('No validations found in batch result');
                  }
                  
                  setCurrentTask(prev => prev ? {
                    ...prev,
                    status: 'completed',
                    completedAt: new Date(),
                    result: {
                      success: true,
                      message: 'Batch processing completed',
                    },
                  } : null);
                  
                  // Update task step to completed
                  updateTaskStep(batchStepId, {
                    status: 'completed',
                    details: `Batch completed successfully after ${pollCount} polls`
                  });
                } else {
                  // Task failed
                  const failedTask = batchStatus.tasks.find(t => t.status === 'failed');
                  setTaskError(failedTask?.error_message || 'Batch task failed');
                  
                  updateTaskStep(batchStepId, {
                    status: 'error',
                    details: failedTask?.error_message || 'Batch task failed'
                  });
                }
                
                setIsTaskRunning(false);
                setTaskHistoryRefreshKey(prev => prev + 1);
              } else {
                // Continue polling - show progress
                console.log(`Batch status: ${batchStatus.counts.completed}/${batchStatus.counts.total} tasks completed`);
                setTimeout(pollBatch, 5000); // Check every 5 seconds
              }
            } catch (pollError) {
              console.error('Batch polling error:', pollError);
              setTaskError('Failed to check batch status');
              setIsTaskRunning(false);
              
              updateTaskStep(batchStepId, {
                status: 'error',
                details: 'Failed to poll batch status'
              });
            }
          };
          
          // Start polling after 2 seconds
          setTimeout(pollBatch, 2000);
          
        } catch (batchError) {
          console.error('Batch creation error:', batchError);
          setTaskError('Failed to create batch task');
          setIsTaskRunning(false);
        }
      } else {
        setTaskError(error instanceof Error ? error.message : 'Failed to execute task');
        setIsTaskRunning(false);
        
        // Update the current task to show it failed
        setCurrentTask(prev => prev ? {
          ...prev,
          status: 'failed',
          completedAt: new Date(),
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute task',
          },
        } : null);
        
        // Update the initial step to show failure
        setTaskSteps(prev => prev.map(step => 
          step.description === 'Starting analysis...' 
            ? { ...step, status: 'error', details: error instanceof Error ? error.message : 'Failed to start task' }
            : step
        ));
      }
    }
  };

  const clearTaskState = useCallback(() => {
    setCurrentTask(null);
    setTaskError(null);
    setTaskSteps([]);
    // Clear step mappings to prevent memory leak
    stepMappingRef.current.clear();
  }, []);

  return {
    currentTask,
    isTaskRunning,
    taskError,
    taskSteps,
    taskHistoryRefreshKey,
    handleExecuteTask,
    clearTaskState,
  };
}