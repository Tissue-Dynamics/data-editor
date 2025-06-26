import { useState, useCallback } from 'react';
import type { DataRow } from '../types/data';
import { api } from '../services/api';

export function useHistory(currentSession: { id: string } | null) {
  const [dataHistory, setDataHistory] = useState<DataRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingChanges, setPendingChanges] = useState<DataRow[] | null>(null);

  const saveToHistory = useCallback((newData: DataRow[], changeDescription?: string, forceVersion = false) => {
    if (forceVersion) {
      // Create a new version immediately
      setDataHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1); // Remove future history
        newHistory.push(newData);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
      setPendingChanges(null);
      
      // Save snapshot to database if we have a session
      if (currentSession) {
        api.saveSnapshot(
          currentSession.id,
          newData,
          changeDescription || 'Data updated'
        ).catch(error => {
          console.error('Failed to save snapshot:', error);
        });
      }
    } else {
      // Just track pending changes without creating a version
      setPendingChanges(newData);
    }
  }, [historyIndex, currentSession]);

  const createVersion = useCallback((data: DataRow[], description: string) => {
    setDataHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1); // Remove future history
      newHistory.push(data);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
    setPendingChanges(null);
    
    // Save snapshot to database if we have a session
    if (currentSession) {
      api.saveSnapshot(
        currentSession.id,
        data,
        description
      ).catch(error => {
        console.error('Failed to save snapshot:', error);
      });
    }
  }, [historyIndex, currentSession]);

  const navigateHistory = useCallback((direction: 'back' | 'forward', currentData: DataRow[], setData: (data: DataRow[]) => void) => {
    if (direction === 'back' && historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setData(dataHistory[historyIndex - 1]);
    } else if (direction === 'forward' && historyIndex < dataHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setData(dataHistory[historyIndex + 1]);
    }
  }, [historyIndex, dataHistory]);

  const initializeHistory = useCallback((data: DataRow[], snapshots?: any[]) => {
    if (snapshots && snapshots.length > 0) {
      const history = snapshots.map(s => s.data);
      setDataHistory(history);
      setHistoryIndex(history.length - 1);
    } else {
      setDataHistory([data]);
      setHistoryIndex(0);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setDataHistory([]);
    setHistoryIndex(-1);
  }, []);

  return {
    dataHistory,
    historyIndex,
    pendingChanges,
    saveToHistory,
    createVersion,
    navigateHistory,
    initializeHistory,
    clearHistory,
  };
}