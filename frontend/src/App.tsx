import { useState, useCallback } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { TaskPanel } from './components/TaskPanel/TaskPanel';
import { SessionsList, type SessionInfo } from './components/SessionsList/SessionsList';
import { TaskHistory } from './components/TaskHistory/TaskHistory';
import { DataEditor } from './components/DataEditor/DataEditor';
import type { DataRow, Selection } from './types/data';
import type { ValidationResult } from './types/validation';
import { api } from './services/api';
import { useValidation } from './hooks/useValidation';
import { useTaskManagement } from './hooks/useTaskManagement';
import { useHistory } from './hooks/useHistory';
import type { ClaudeAnalysisResult, TaskWithValidations } from './types/tasks';
import { ErrorBoundary, DataTableErrorBoundary } from './components/Common/ErrorBoundary';

function App() {
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [showSessionsList, setShowSessionsList] = useState(true);
  const [data, setData] = useState<DataRow[]>([]);
  const [originalData, setOriginalData] = useState<DataRow[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({
    rows: [],
    columns: [],
    cells: [],
  });

  // Use custom hooks
  const {
    dataHistory,
    historyIndex,
    pendingChanges,
    saveToHistory,
    createVersion,
    navigateHistory,
    initializeHistory,
    clearHistory,
  } = useHistory(currentSession);

  const {
    validations,
    validationSummary,
    setValidationSummary,
    applyValidationValue,
    confirmValidation,
    confirmAllValidations,
    dismissAllValidations,
    applyValidation,
    parseClaudeValidations,
    getCellHistory,
    clearValidations,
  } = useValidation(data, setData, createVersion);

  const {
    currentTask,
    isTaskRunning,
    taskError,
    taskSteps,
    taskHistoryRefreshKey,
    handleExecuteTask,
    clearTaskState,
  } = useTaskManagement(data, selection, currentSession, parseClaudeValidations);

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
      initializeHistory(loadedData);
      setFilename(fileName);
      clearValidations();
      clearTaskState();
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
      
      // Load version history if available
      initializeHistory(response.data, response.snapshots);
      
      setFilename(response.session.file_name || 'Session Data');
      clearValidations();
      clearTaskState();
      setValidationSummary(null);
      setShowSessionsList(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session. Please try again.');
    }
  };


  const handleNavigateHistory = useCallback((direction: 'back' | 'forward') => {
    navigateHistory(direction, data, setData);
  }, [navigateHistory, data]);





  const handleApplyValidation = useCallback((validation: ValidationResult) => {
    if (!validation.suggestedValue) return;

    const newData = [...data];
    newData[validation.rowIndex] = {
      ...newData[validation.rowIndex],
      [validation.columnId]: validation.suggestedValue
    };

    setData(newData);
    applyValidation(validation, newData);
  }, [data, applyValidation]);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    createVersion(newData, `Deleted row ${rowIndex + 1}`);
  }, [data, createVersion]);

  const handleDeleteRows = useCallback((rowIndexes: number[]) => {
    // Sort in descending order to delete from end to start (preserves indices)
    const sortedIndexes = [...rowIndexes].sort((a, b) => b - a);
    let newData = [...data];
    
    sortedIndexes.forEach(index => {
      newData = newData.filter((_, i) => i !== index);
    });
    
    setData(newData);
    createVersion(newData, `Deleted ${rowIndexes.length} rows`);
  }, [data, createVersion]);

  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setSelection(newSelection);
  }, []);






  const handleApplyTaskResults = useCallback((task: TaskWithValidations) => {
    if (!task.result?.validations) return;
    
    console.log(`Applying ${task.result.validations.length} validations from task`);
    
    // Create a copy of current data
    const newData = [...data];
    let changesCount = 0;
    
    // Apply all validations
    task.result.validations.forEach((validation) => {
      if (validation.suggestedValue !== undefined) {
        newData[validation.rowIndex] = {
          ...newData[validation.rowIndex],
          [validation.columnId]: validation.suggestedValue
        };
        changesCount++;
      }
    });
    
    if (changesCount > 0) {
      // Update data and create version
      setData(newData);
      createVersion(newData, `Applied ${changesCount} changes from task: ${task.prompt}`);
      
      // Show validation summary
      setValidationSummary({
        analysis: task.result.analysis || `Applied ${changesCount} validations from completed task`,
        messages: task.result.validations.map((v) => ({
          rowIndex: v.rowIndex,
          columnId: v.columnId,
          status: v.status,
          message: v.reason,
          originalValue: v.originalValue,
          suggestedValue: v.suggestedValue,
          isEstimate: false
        }))
      });
      
      // Update validation states
      const newValidations = new Map(validations);
      task.result.validations.forEach((validation) => {
        const cellKey = `${validation.rowIndex}-${validation.columnId}`;
        newValidations.set(cellKey, {
          cellKey,
          status: 'confirmed',
          originalValue: validation.originalValue,
          validatedValue: validation.suggestedValue,
          confidence: 0.9,
          source: 'Applied from task history',
          notes: validation.reason,
          timestamp: new Date(),
          applied: true,
          confirmed: true,
        });
      });
      setValidations(newValidations);
    }
  }, [data, validations, saveToHistory]);

  const handleRunTask = async (prompt: string, options?: { batchMode?: boolean }) => {
    setValidationSummary(null); // Clear previous validation summary
    await handleExecuteTask(prompt, options);
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
            <DataTableErrorBoundary
              onError={(error) => {
                console.error('DataEditor error:', error);
                // Could show a toast notification here
              }}
            >
              <DataEditor
                data={data}
                filename={filename}
                dataHistory={dataHistory}
                historyIndex={historyIndex}
                validations={validations}
                validationSummary={validationSummary}
                getCellHistory={getCellHistory}
                onNavigateHistory={handleNavigateHistory}
                onSelectionChange={handleSelectionChange}
                onConfirmValidation={confirmValidation}
                onApplyValidation={handleApplyValidation}
                onApplyValidationValue={applyValidationValue}
                onDeleteRow={handleDeleteRow}
                onDeleteRows={handleDeleteRows}
                onDismissValidationSummary={() => setValidationSummary(null)}
                onReset={() => {
                  setData([]);
                  setOriginalData([]);
                  clearHistory();
                  setFilename('');
                  setSelection({ rows: [], columns: [], cells: [] });
                  clearValidations();
                }}
              />
            </DataTableErrorBoundary>
            
            <div className="xl:col-span-1 xl:sticky xl:top-4 h-fit space-y-4">
              <ErrorBoundary>
                <TaskPanel 
                  selection={selection}
                  onExecuteTask={handleRunTask}
                  isLoading={isTaskRunning}
                  currentTask={currentTask}
                  error={taskError}
                />
              </ErrorBoundary>
              
              {currentSession && (
                <div className="bg-white rounded-lg shadow p-4">
                  <TaskHistory 
                    key={taskHistoryRefreshKey}
                    sessionId={currentSession.id}
                    currentTask={currentTask}
                    isTaskRunning={isTaskRunning}
                    taskSteps={taskSteps}
                    pendingValidations={Array.from(validations.values()).filter(v => v.status === 'auto_updated' && !v.confirmed).length}
                    onConfirmAll={confirmAllValidations}
                    onDismissAll={dismissAllValidations}
                    onApplyTaskResults={handleApplyTaskResults}
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