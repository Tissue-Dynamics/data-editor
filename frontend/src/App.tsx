import { useState, useCallback } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { DataTable } from './components/DataTable/DataTable';
import { TaskPanel } from './components/TaskPanel/TaskPanel';
import { TaskProgress } from './components/TaskProgress/TaskProgress';
import { VersionHistory } from './components/VersionHistory/VersionHistory';
import { ValidationLegend } from './components/ValidationLegend/ValidationLegend';
import { ValidationSummary } from './components/ValidationSummary/ValidationSummary';
import { SessionsList, type SessionInfo } from './components/SessionsList/SessionsList';
import { TaskHistory } from './components/TaskHistory/TaskHistory';
import type { DataRow, Selection } from './types/data';
import type { ValidationState } from './types/validation';
import type { Task, ClaudeAnalysisResult } from './types/tasks';
import { api, ApiError } from './services/api';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

function App() {
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [showSessionsList, setShowSessionsList] = useState(true);
  const [data, setData] = useState<DataRow[]>([]);
  const [originalData, setOriginalData] = useState<DataRow[]>([]); // Keep original for history
  const [dataHistory, setDataHistory] = useState<DataRow[][]>([]); // Version history
  const [historyIndex, setHistoryIndex] = useState(-1); // Current position in history
  const [filename, setFilename] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({
    rows: [],
    columns: [],
    cells: [],
  });
  const [validations, setValidations] = useState<Map<string, ValidationState>>(new Map());
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [validationSummary, setValidationSummary] = useState<{
    analysis?: string;
    messages: Array<{
      rowIndex: number;
      columnId: string;
      status: 'valid' | 'warning' | 'error' | 'conflict';
      message: string;
      suggestedValue?: any;
      isEstimate?: boolean;
    }>;
  } | null>(null);
  const [taskHistoryRefreshKey, setTaskHistoryRefreshKey] = useState(0);

  const handleDataLoad = async (loadedData: DataRow[], fileName: string) => {
    // Create a new session when data is loaded
    try {
      const columnNames = Object.keys(loadedData[0] || {});
      const response = await api.createSession({
        name: fileName || 'Untitled Session',
        description: `Imported from ${fileName}`,
        file_name: fileName,
        file_type: fileName.split('.').pop() || 'unknown',
        data: loadedData,
        column_names: columnNames
      });
      
      setCurrentSession(response.session);
      setShowSessionsList(false);
      setData(loadedData);
      setOriginalData(loadedData);
      setDataHistory([loadedData]);
      setHistoryIndex(0);
      setFilename(fileName);
      setValidations(new Map());
      setCurrentTask(null);
      setTaskError(null);
      setTaskSteps([]);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session. Please try again.');
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.getSession(sessionId);
      
      setCurrentSession(response.session);
      setData(response.data);
      setOriginalData(response.data);
      setDataHistory([response.data]);
      setHistoryIndex(0);
      setFilename(response.session.file_name || 'Session Data');
      setValidations(new Map());
      setCurrentTask(null);
      setTaskError(null);
      setTaskSteps([]);
      setIsTaskRunning(false);
      setValidationSummary(null);
      setShowSessionsList(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session. Please try again.');
    }
  };

  const saveToHistory = useCallback((newData: DataRow[]) => {
    setDataHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1); // Remove future history
      newHistory.push(newData);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const navigateHistory = useCallback((direction: 'back' | 'forward') => {
    if (direction === 'back' && historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setData(dataHistory[historyIndex - 1]);
    } else if (direction === 'forward' && historyIndex < dataHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setData(dataHistory[historyIndex + 1]);
    }
  }, [historyIndex, dataHistory]);

  const applyValidationValue = useCallback((rowIndex: number, columnId: string, value: any) => {
    const newData = [...data];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [columnId]: value
    };
    
    setData(newData);
    saveToHistory(newData);
    
    // Update validation state
    const cellKey = `${rowIndex}-${columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'auto_updated',
          applied: true,
          timestamp: new Date(),
        });
      }
      return newValidations;
    });
  }, [data, saveToHistory]);

  const confirmValidation = useCallback((rowIndex: number, columnId: string) => {
    const cellKey = `${rowIndex}-${columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'confirmed',
          confirmed: true,
          timestamp: new Date(),
        });
        console.log(`Confirmed validation for ${cellKey}`);
      }
      return newValidations;
    });
  }, []);

  const confirmAllValidations = useCallback(() => {
    setValidations(prev => {
      const newValidations = new Map(prev);
      let confirmedCount = 0;
      
      for (const [cellKey, validation] of newValidations) {
        if (validation.status === 'auto_updated') {
          newValidations.set(cellKey, {
            ...validation,
            status: 'confirmed',
            confirmed: true,
            timestamp: new Date(),
          });
          confirmedCount++;
        }
      }
      
      console.log(`Confirmed ${confirmedCount} auto-updated validations`);
      return newValidations;
    });
  }, []);

  const dismissAllValidations = useCallback(() => {
    setValidations(prev => {
      const newValidations = new Map();
      let dismissedCount = 0;
      
      for (const [cellKey, validation] of prev) {
        if (validation.status !== 'auto_updated' && validation.status !== 'conflict') {
          newValidations.set(cellKey, validation);
        } else {
          dismissedCount++;
        }
      }
      
      console.log(`Dismissed ${dismissedCount} validations`);
      return newValidations;
    });
  }, []);

  const applyValidation = useCallback((validation: ClaudeAnalysisResult['validations'][0]) => {
    if (!validation.suggestedValue) return;

    const newData = [...data];
    newData[validation.rowIndex] = {
      ...newData[validation.rowIndex],
      [validation.columnId]: validation.suggestedValue
    };

    setData(newData);
    saveToHistory(newData);

    // Update validation state to mark as applied
    const cellKey = `${validation.rowIndex}-${validation.columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'auto_updated',
          applied: true,
          timestamp: new Date(),
        });
      }
      return newValidations;
    });
  }, [data, saveToHistory]);

  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setSelection(newSelection);
  }, []);

  const parseClaudeValidations = useCallback((claudeResult: ClaudeAnalysisResult) => {
    console.log('parseClaudeValidations called with:', claudeResult);
    
    if (!claudeResult.validations) {
      console.log('No validations found in Claude result');
      return;
    }

    console.log(`Found ${claudeResult.validations.length} validations from Claude`);
    
    // Create validation messages for summary
    const messages = claudeResult.validations.map(validation => {
      // Check if this is an estimate based on keywords in the reason
      const isEstimate = validation.reason.toLowerCase().includes('estimat') || 
                        validation.reason.toLowerCase().includes('typical') ||
                        validation.reason.toLowerCase().includes('based on peer') ||
                        validation.reason.toLowerCase().includes('based on similar');
      
      return {
        rowIndex: validation.rowIndex,
        columnId: validation.columnId,
        status: validation.status,
        message: validation.reason,
        suggestedValue: validation.suggestedValue,
        isEstimate
      };
    });
    
    // Set validation summary for display
    setValidationSummary({
      analysis: claudeResult.analysis,
      messages
    });
    
    // Only create validation states for cells, no auto-applying
    const newValidations = new Map(validations);
    
    claudeResult.validations.forEach((validation) => {
      const cellKey = `${validation.rowIndex}-${validation.columnId}`;
      
      // Map Claude statuses to our new system
      let mappedStatus: ValidationState['status'];
      switch (validation.status) {
        case 'valid':
          mappedStatus = 'confirmed'; // Valid means confirmed by research
          break;
        case 'warning':
          mappedStatus = 'auto_updated'; // Warning means needs user review
          break;
        case 'error':
          mappedStatus = 'conflict'; // Error means missing or problematic
          break;
        case 'conflict':
          mappedStatus = 'conflict';
          break;
        default:
          mappedStatus = 'unchecked';
      }
      
      const validationState: ValidationState = {
        cellKey,
        status: mappedStatus,
        originalValue: validation.originalValue,
        validatedValue: validation.suggestedValue,
        confidence: 0.9,
        source: 'Claude AI',
        notes: validation.reason,
        timestamp: new Date(),
        applied: false,
        confirmed: validation.status === 'valid',
      };
      
      newValidations.set(cellKey, validationState);
    });
    
    console.log('Setting new validations map with', newValidations.size, 'entries');
    setValidations(newValidations);
  }, [validations]);

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
  }, []);

  const handleStreamingEvent = useCallback((event: any) => {
    console.log('Streaming event:', event);
    
    const getStepType = (event: any) => {
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
        (window as any)[`step_${event.tool}`] = stepId;
      }
    } 
    else if (event.type === 'tool_complete' || event.type === 'analysis_complete') {
      // Use tool type to find the right step
      const stepId = event.tool ? (window as any)[`step_${event.tool}`] : null;
      
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
        delete (window as any)[`step_${event.tool}`];
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

  const handleExecuteTask = async (prompt: string) => {
    setIsTaskRunning(true);
    setTaskError(null);
    setTaskSteps([]); // Clear previous steps
    setValidationSummary(null); // Clear previous validation summary
    
    try {
      // Create the task
      const response = await api.executeTask({
        prompt,
        selectedRows: selection.rows,
        selectedColumns: selection.columns,
        data: data.filter((_, index) => selection.rows.includes(index)),
        sessionId: currentSession?.id,
      });
      
      // Create a task object for UI
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
              parseClaudeValidations(statusResponse.result as ClaudeAnalysisResult);
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
                    parseClaudeValidations(completedTask.result);
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
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showSessionsList ? (
        <SessionsList
          onSessionSelect={loadSession}
          onNewSession={() => setShowSessionsList(false)}
        />
      ) : (
        <div className="container mx-auto px-4 py-8 max-w-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Data Analysis Tool</h1>
            {currentSession && (
              <button
                onClick={() => {
                  setShowSessionsList(true);
                  setCurrentSession(null);
                  setData([]);
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ← Back to Sessions
              </button>
            )}
          </div>
          
          {data.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8">
              <FileUploader onDataLoad={handleDataLoad} />
            </div>
          ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3 space-y-4 min-w-0">
              {/* Version History Component */}
              {dataHistory.length > 1 && (
                <VersionHistory
                  dataHistory={dataHistory}
                  currentIndex={historyIndex}
                  onNavigate={navigateHistory}
                />
              )}
              
              {/* Validation Summary */}
              {validationSummary && (
                <ValidationSummary
                  analysis={validationSummary.analysis}
                  validationMessages={validationSummary.messages}
                  onApplyValue={applyValidationValue}
                  onDismiss={() => setValidationSummary(null)}
                />
              )}
              
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold truncate">{filename}</h2>
                    <ValidationLegend />
                  </div>
                  
                  <button
                    onClick={() => {
                      setData([]);
                      setOriginalData([]);
                      setDataHistory([]);
                      setHistoryIndex(-1);
                      setFilename('');
                      setSelection({ rows: [], columns: [], cells: [] });
                      setValidations(new Map());
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                  >
                    Upload New File
                  </button>
                </div>
                
                <div className="overflow-hidden">
                  <DataTable 
                    data={data} 
                    validations={validations}
                    onSelectionChange={handleSelectionChange}
                    onConfirmValidation={confirmValidation}
                    onApplyValidation={(rowIndex, columnId) => {
                      const cellKey = `${rowIndex}-${columnId}`;
                      const validation = validations.get(cellKey);
                      if (validation?.validatedValue !== undefined) {
                        applyValidation({
                          rowIndex,
                          columnId,
                          suggestedValue: validation.validatedValue,
                          originalValue: validation.originalValue,
                          status: validation.status as any,
                          reason: validation.notes || ''
                        });
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* Task Progress Container */}
              {(() => {
                const pendingValidations = Array.from(validations.values()).filter(v => v.status === 'auto_updated' && !v.confirmed).length;
                const hasActiveTask = isTaskRunning || (currentTask && currentTask.status === 'running');
                const hasSteps = taskSteps.length > 0;
                const hasPendingValidations = pendingValidations > 0;
                
                // Only show if we have actual content to display
                const showProgress = (hasActiveTask || hasSteps || hasPendingValidations) && 
                                   (currentTask?.prompt || hasSteps || hasPendingValidations);
                
                return showProgress ? (
                  <TaskProgress
                    taskId={currentTask?.id || ''}
                    prompt={currentTask?.prompt || ''}
                    steps={taskSteps}
                    isRunning={isTaskRunning}
                    validationCount={pendingValidations}
                    onConfirmAll={pendingValidations > 0 ? confirmAllValidations : undefined}
                    onDismissAll={pendingValidations > 0 ? dismissAllValidations : undefined}
                  />
                ) : null;
              })()}
            </div>
            
            <div className="xl:col-span-1 xl:sticky xl:top-4 h-fit space-y-4">
              <TaskPanel 
                selection={selection}
                onExecuteTask={handleExecuteTask}
                isLoading={isTaskRunning}
                currentTask={currentTask}
                error={taskError}
              />
              
              {currentSession && (
                <div className="bg-white rounded-lg shadow p-4">
                  <TaskHistory 
                    key={taskHistoryRefreshKey}
                    sessionId={currentSession.id}
                    onTaskSelect={(task) => {
                      console.log('Selected historical task:', task);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}
    </div>
  );
}

export default App;