import React, { ReactNode, useCallback } from 'react';
import { DataProvider, useData } from './DataContext';
import { SessionProvider } from './SessionContext';
import { ValidationProvider } from './ValidationContext';
import { HistoryProvider, useHistoryContext } from './HistoryContext';
import { TaskProvider } from './TaskContext';

// Component that provides validation with history
function ValidationWithHistory({ children }: { children: ReactNode }) {
  const { createVersion } = useHistoryContext();
  
  return (
    <ValidationProvider createVersion={createVersion}>
      <TaskProvider>
        {children}
      </TaskProvider>
    </ValidationProvider>
  );
}

// Inner component that has access to DataContext
function ProvidersWithData({ children }: { children: ReactNode }) {
  const { data, setData } = useData();
  
  return (
    <HistoryProvider data={data} setData={setData}>
      <ValidationWithHistory>
        {children}
      </ValidationWithHistory>
    </HistoryProvider>
  );
}

// Main providers component
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DataProvider>
        <ProvidersWithData>
          {children}
        </ProvidersWithData>
      </DataProvider>
    </SessionProvider>
  );
}

// Export all hooks for convenience
export { useData } from './DataContext';
export { useSession } from './SessionContext';
export { useValidationContext } from './ValidationContext';
export { useHistoryContext } from './HistoryContext';
export { useTask } from './TaskContext';