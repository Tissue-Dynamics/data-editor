import { memo, useCallback } from 'react';
import { SessionsList } from '../SessionsList/SessionsList';
import { FileUploader } from '../Upload/FileUploader';
import { api } from '../../services/api';
import { useData, useSession, useHistoryContext } from '../../contexts/AppProviders';
import type { DataRow } from '../../types/data';

export const SessionManager = memo(() => {
  const { setData, setOriginalData, setFilename } = useData();
  const { currentSession, setCurrentSession, showSessionsList, setShowSessionsList } = useSession();
  const { createVersion } = useHistoryContext();

  const handleDataLoad = useCallback(async (loadedData: DataRow[], loadedFilename: string) => {
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
  }, [setData, setOriginalData, setFilename, setCurrentSession, setShowSessionsList, createVersion]);

  const loadSession = useCallback(async (sessionId: string) => {
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
  }, [setData, setOriginalData, setFilename, setCurrentSession, setShowSessionsList, createVersion]);

  if (showSessionsList) {
    return (
      <SessionsList 
        onSessionSelect={loadSession}
        onNewSession={() => setShowSessionsList(false)}
      />
    );
  }

  if (!currentSession) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <FileUploader onDataLoad={handleDataLoad} />
      </div>
    );
  }

  return null;
});

SessionManager.displayName = 'SessionManager';