import { useState, useCallback } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { DataTable } from './components/DataTable/DataTable';
import { TaskPanel } from './components/TaskPanel/TaskPanel';
import { TaskProgress } from './components/TaskProgress/TaskProgress';
import { VersionHistory } from './components/VersionHistory/VersionHistory';
import { ValidationLegend } from './components/ValidationLegend/ValidationLegend';
import type { DataRow, Selection } from './types/data';
import type { ValidationState } from './types/validation';
import type { Task, ClaudeAnalysisResult } from './types/tasks';
import { api } from './services/api';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

function App() {
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

  const handleDataLoad = (loadedData: DataRow[], fileName: string) => {
    setData(loadedData);
    setOriginalData(loadedData); // Keep original
    setDataHistory([loadedData]); // Initialize history
    setHistoryIndex(0);
    setFilename(fileName);
    // Clear previous validations when new data is loaded
    setValidations(new Map());
    setCurrentTask(null);
    setTaskError(null);
    setTaskSteps([]);
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
    const newValidations = new Map(validations);
    const newData = [...data];
    let hasChanges = false;
    
    claudeResult.validations.forEach((validation, index) => {
      const cellKey = `${validation.rowIndex}-${validation.columnId}`;
      console.log(`Processing validation ${index + 1}: ${cellKey} = ${validation.status}`);
      
      // Map Claude statuses to our new system
      let mappedStatus: ValidationState['status'];
      switch (validation.status) {
        case 'valid':
          mappedStatus = validation.suggestedValue !== undefined ? 'auto_updated' : 'unchecked';
          break;
        case 'warning':
          mappedStatus = validation.suggestedValue !== undefined ? 'auto_updated' : 'unchecked';
          break;
        case 'error':
          mappedStatus = 'conflict';
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
        confirmed: false,
      };
      
      // Auto-apply suggestions (making them orange)
      if (validation.suggestedValue !== undefined && validation.suggestedValue !== validation.originalValue) {
        newData[validation.rowIndex] = {
          ...newData[validation.rowIndex],
          [validation.columnId]: validation.suggestedValue
        };
        validationState.applied = true;
        hasChanges = true;
        console.log(`Auto-applied suggestion for ${cellKey}: ${validation.originalValue} → ${validation.suggestedValue}`);
      }
      
      newValidations.set(cellKey, validationState);
      console.log(`Added validation for ${cellKey}:`, validationState);
    });
    
    console.log('Setting new validations map with', newValidations.size, 'entries');
    setValidations(newValidations);
    
    // Update data with auto-applied changes and save to history
    if (hasChanges) {
      setData(newData);
      saveToHistory(newData);
      console.log('Auto-applied', claudeResult.validations.filter(v => v.suggestedValue !== undefined).length, 'suggestions');
    }
  }, [validations, data, saveToHistory]);

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
    const stepTypeMap = {
      'analysis_start': 'analysis',
      'tool_start': event.tool === 'web_search' ? 'search' : event.tool === 'bash' ? 'code' : 'validation',
      'tool_complete': event.tool === 'web_search' ? 'search' : event.tool === 'bash' ? 'code' : 'validation'
    };

    if (event.type === 'analysis_start' || event.type === 'tool_start') {
      const stepId = addTaskStep({
        type: stepTypeMap[event.type] || 'analysis',
        description: event.description,
        status: 'running',
        details: event.details
      });
      
      // Store step ID for later completion
      setTaskSteps(prev => prev.map(step => 
        step.description === event.description 
          ? { ...step, id: stepId }
          : step
      ));
    } 
    else if (event.type === 'tool_complete' || event.type === 'analysis_complete') {
      // Find and complete the corresponding step
      setTaskSteps(prev => prev.map(step => 
        step.description.includes(event.description.split(' ')[0]) && step.status === 'running'
          ? { ...step, status: 'completed', details: event.data ? JSON.stringify(event.data) : step.details }
          : step
      ));
    }
    else if (event.type === 'tool_error') {
      setTaskSteps(prev => prev.map(step => 
        step.description.includes(event.description.split(' ')[0]) && step.status === 'running'
          ? { ...step, status: 'error', details: event.details }
          : step
      ));
    }
  }, [addTaskStep]);

  const handleExecuteTask = async (prompt: string) => {
    setIsTaskRunning(true);
    setTaskError(null);
    setTaskSteps([]); // Clear previous steps
    
    try {
      // Create the task
      const response = await api.executeTask({
        prompt,
        selectedRows: selection.rows,
        selectedColumns: selection.columns,
        data: data.filter((_, index) => selection.rows.includes(index)),
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
      setTaskError(error instanceof Error ? error.message : 'Failed to execute task');
      setIsTaskRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-full">
        <h1 className="text-3xl font-bold mb-8">Data Analysis Tool</h1>
        
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
              {(isTaskRunning || taskSteps.length > 0 || validations.size > 0) && (
                <TaskProgress
                  taskId={currentTask?.id || ''}
                  prompt={currentTask?.prompt || ''}
                  steps={taskSteps}
                  isRunning={isTaskRunning}
                  validationCount={Array.from(validations.values()).filter(v => v.status === 'auto_updated' || v.status === 'conflict').length}
                  onConfirmAll={confirmAllValidations}
                  onDismissAll={dismissAllValidations}
                />
              )}
            </div>
            
            <div className="xl:col-span-1 xl:sticky xl:top-4 h-fit">
              <TaskPanel 
                selection={selection}
                onExecuteTask={handleExecuteTask}
                isLoading={isTaskRunning}
                currentTask={currentTask}
                error={taskError}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;