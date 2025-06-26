import React, { createContext, useContext, ReactNode } from 'react';
import type { DataRow } from '../types/data';
import { useHistory } from '../hooks/useHistory';

interface HistoryContextType {
  // History state
  dataHistory: DataRow[][];
  historyIndex: number;
  
  // History operations
  createVersion: (data: DataRow[], description: string) => void;
  handleNavigateHistory: (index: number) => void;
  clearHistory: () => void;
  
  // Computed values
  historyData: DataRow[];
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ 
  children,
  data,
  setData 
}: { 
  children: ReactNode;
  data: DataRow[];
  setData: (data: DataRow[]) => void;
}) {
  const {
    dataHistory,
    historyIndex,
    createVersion,
    navigateToVersion: handleNavigateHistory,
    clearHistory,
  } = useHistory(data);
  
  // Use history data if navigating history, otherwise use current data
  const historyData = historyIndex !== -1 ? dataHistory[historyIndex] || [] : data;
  
  // Override setData when viewing history
  React.useEffect(() => {
    if (historyIndex !== -1 && dataHistory[historyIndex]) {
      setData(dataHistory[historyIndex]);
    }
  }, [historyIndex, dataHistory, setData]);

  const value: HistoryContextType = {
    dataHistory,
    historyIndex,
    createVersion,
    handleNavigateHistory,
    clearHistory,
    historyData,
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryContext() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return context;
}