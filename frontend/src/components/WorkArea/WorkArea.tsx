import { memo, useCallback } from 'react';
import { DataEditor } from '../DataEditor/DataEditor';
import { TaskPanel } from '../TaskPanel/TaskPanel';
import { TaskHistory } from '../TaskHistory/TaskHistory';
import { ErrorBoundary, DataTableErrorBoundary } from '../Common/ErrorBoundary';
import { useData, useSession, useValidationContext, useHistoryContext, useTask } from '../../contexts/AppProviders';
import type { TaskWithValidations } from '../../types/tasks';

export const WorkArea = memo(() => {
  const { data, setData } = useData();
  const { currentSession } = useSession();
  const { setValidationSummary } = useValidationContext();
  const { createVersion } = useHistoryContext();
  const { taskHistoryRefreshKey } = useTask();

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
  );
});

WorkArea.displayName = 'WorkArea';