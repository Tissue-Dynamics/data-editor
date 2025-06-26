import { useCallback } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { TaskPanel } from './components/TaskPanel/TaskPanel';
import { SessionsList } from './components/SessionsList/SessionsList';
import { TaskHistory } from './components/TaskHistory/TaskHistory';
import { DataEditor } from './components/DataEditor/DataEditor';
import { api } from './services/api';
import { ErrorBoundary, DataTableErrorBoundary } from './components/Common/ErrorBoundary';
import { 
  AppProviders, 
  useData, 
  useSession, 
  useValidationContext, 
  useHistoryContext,
  useTask 
} from './contexts/AppProviders';

function AppContent() {
  const { 
    data, 
    setData, 
    setOriginalData, 
    setFilename,
    resetData
  } = useData();
  
  const { 
    currentSession, 
    setCurrentSession, 
    showSessionsList, 
    setShowSessionsList 
  } = useSession();
  
  const {
    validations,
    setValidationSummary,
    clearValidations
  } = useValidationContext();
  
  const {
    createVersion,
    clearHistory
  } = useHistoryContext();
  
  const {
    taskHistoryRefreshKey,
    handleExecuteTask
  } = useTask();

  const handleDataLoad = async (loadedData: DataRow[], loadedFilename: string) => {
    setData(loadedData);
    setOriginalData(loadedData);
    setFilename(loadedFilename);
    
    try {
      const columnNames = Object.keys(loadedData[0] || {});
      const response = await api.createSession({
        name: loadedFilename,
        description: `Uploaded ${loadedFilename} with ${loadedData.length} rows`,
        file_name: loadedFilename,
        file_type: loadedFilename.endsWith('.csv') ? 'csv' : 'json',
        data: loadedData,
        column_names: columnNames,
      });
      
      setCurrentSession(response.session);
      setShowSessionsList(false);
      
      createVersion(loadedData, 'Initial data load');
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.getSession(sessionId);
      
      if (response.data && response.data.length > 0) {
        setData(response.data);
        setOriginalData(response.data);
        createVersion(response.data, 'Session loaded');
      }
      
      setFilename(response.session.file_name || 'Untitled');
      setCurrentSession(response.session);
      setShowSessionsList(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };


  const handleApplyTaskResults = useCallback((task: TaskWithValidations) => {
    if (!task.result?.validations) return;
    
    const newData = [...data];
    let changesCount = 0;
    
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
      setData(newData);
      createVersion(newData, `Applied ${changesCount} changes from task: ${task.prompt}`);
      
      setValidationSummary({
        analysis: `Applied ${changesCount} validations from completed task`,
        messages: task.result.validations.map((v) => ({
          rowIndex: v.rowIndex,
          columnId: v.columnId,
          status: v.status as 'valid' | 'warning' | 'error' | 'conflict',
          message: v.reason,
          originalValue: v.originalValue,
          suggestedValue: v.suggestedValue,
          isEstimate: false
        }))
      });
    }
  }, [data, setData, createVersion, setValidationSummary]);


  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4 max-w-7xl">
        {showSessionsList ? (
          <SessionsList 
            onSessionSelect={loadSession}
            onNewSession={() => setShowSessionsList(false)}
          />
        ) : (
          <>
            <div className="mb-4">
              {currentSession && (
                <button
                  onClick={() => setShowSessionsList(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to sessions
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
                  }}
                >
                  <DataEditor />
                </DataTableErrorBoundary>
                
                <div className="xl:col-span-1 xl:sticky xl:top-4 h-fit space-y-4">
                  <ErrorBoundary>
                    <TaskPanel />
                  </ErrorBoundary>
                  
                  {currentSession && (
                    <ErrorBoundary>
                      <div className="bg-white rounded-lg shadow p-4">
                        <TaskHistory 
                          key={taskHistoryRefreshKey}
                          onApplyTask={handleApplyTaskResults}
                        />
                      </div>
                    </ErrorBoundary>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import type { DataRow } from './types/data';
import type { ValidationResult } from './types/validation';
import type { TaskWithValidations } from './types/tasks';

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

export default App;