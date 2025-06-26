import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Database, ChevronRight, Plus, Trash2 } from 'lucide-react';

export interface SessionInfo {
  id: string;
  name: string;
  description?: string;
  file_name?: string;
  file_type?: string;
  row_count: number;
  column_count: number;
  current_version: number;
  created_at: number;
  updated_at: number;
  last_activity_at: number;
}

interface SessionsListProps {
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
}

export const SessionsList: React.FC<SessionsListProps> = ({ 
  onSessionSelect, 
  onNewSession 
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/sessions`);
      
      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
      
      // Reload sessions
      loadSessions();
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Data Editor Sessions</h1>
          <p className="text-gray-600">Continue working on your data analysis projects</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading sessions...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <button
              onClick={onNewSession}
              className="mb-6 w-full bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div className="flex flex-col items-center text-gray-500 group-hover:text-blue-600">
                <Plus className="w-12 h-12 mb-2" />
                <span className="text-lg font-medium">Create New Session</span>
                <span className="text-sm mt-1">Upload a CSV or JSON file to start</span>
              </div>
            </button>

            {sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No sessions yet. Create your first session to get started!
              </div>
            ) : (
              <div className="grid gap-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onSessionSelect(session.id)}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <h3 className="text-lg font-semibold group-hover:text-blue-600">
                            {session.name}
                          </h3>
                        </div>
                        
                        {session.description && (
                          <p className="text-sm text-gray-600 mb-3">{session.description}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          {session.file_name && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              <span>{session.file_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Database className="w-4 h-4" />
                            <span>{session.row_count} rows × {session.column_count} columns</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span title={formatDate(session.created_at)}>
                              Created {formatRelativeTime(session.created_at)}
                            </span>
                          </div>
                          
                          <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                            v{session.current_version}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};