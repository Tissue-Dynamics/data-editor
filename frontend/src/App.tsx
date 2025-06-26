import { useState, useCallback } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { DataTable } from './components/DataTable/DataTable';
import { TaskPanel } from './components/TaskPanel/TaskPanel';
import { TaskProgress } from './components/TaskProgress/TaskProgress';
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
    setFilename(fileName);
    // Clear previous validations when new data is loaded
    setValidations(new Map());
    setCurrentTask(null);
    setTaskError(null);
    setTaskSteps([]);
  };

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
    
    claudeResult.validations.forEach((validation, index) => {
      const cellKey = `${validation.rowIndex}-${validation.columnId}`;
      console.log(`Processing validation ${index + 1}: ${cellKey} = ${validation.status}`);
      
      const validationState: ValidationState = {
        cellKey,
        status: validation.status === 'valid' ? 'validated' : validation.status === 'warning' ? 'warning' : 'error',
        originalValue: validation.originalValue,
        validatedValue: validation.suggestedValue,
        confidence: 0.9, // Default confidence
        source: 'Claude AI',
        notes: validation.reason,
      };
      
      newValidations.set(cellKey, validationState);
      console.log(`Added validation for ${cellKey}:`, validationState);
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

  const simulateStreamingSteps = useCallback(async (taskId: string) => {
    // Step 1: Initialize task
    const step1Id = addTaskStep({
      type: 'analysis',
      description: 'Initializing data analysis',
      status: 'running'
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    updateTaskStep(step1Id, { status: 'completed' });

    // Step 2: Web search (if applicable)
    const step2Id = addTaskStep({
      type: 'search',
      description: 'Searching scientific databases for compound validation',
      status: 'running',
      details: 'Accessing PubChem, ChEMBL, and literature databases'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateTaskStep(step2Id, { status: 'completed' });

    // Step 3: Code execution
    const step3Id = addTaskStep({
      type: 'code',
      description: 'Running molecular property calculations',
      status: 'running',
      details: 'Calculating descriptors and validating SMILES structures'
    });
    
    await new Promise(resolve => setTimeout(resolve, 800));
    updateTaskStep(step3Id, { status: 'completed' });

    // Step 4: Final validation
    const step4Id = addTaskStep({
      type: 'validation',
      description: 'Generating validation results',
      status: 'running',
      details: 'Analyzing patterns and formatting structured output'
    });
    
    await new Promise(resolve => setTimeout(resolve, 600));
    updateTaskStep(step4Id, { status: 'completed' });
  }, [addTaskStep, updateTaskStep]);

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
      
      // Start streaming simulation
      simulateStreamingSteps(response.taskId);
      
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
          } else {
            // Still processing, poll again
            setTimeout(pollForCompletion, 1000);
          }
        } catch (error) {
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
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                  <h2 className="text-xl font-semibold truncate">{filename}</h2>
                  <button
                    onClick={() => {
                      setData([]);
                      setFilename('');
                      setSelection({ rows: [], columns: [], cells: [] });
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
                  />
                </div>
              </div>
              
              {/* Task Progress Container */}
              {(isTaskRunning || taskSteps.length > 0) && (
                <TaskProgress
                  taskId={currentTask?.id || ''}
                  prompt={currentTask?.prompt || ''}
                  steps={taskSteps}
                  isRunning={isTaskRunning}
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