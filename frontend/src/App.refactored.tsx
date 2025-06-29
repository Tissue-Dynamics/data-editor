import { memo } from 'react';
import { SessionManager } from './components/SessionManager/SessionManager';
import { WorkArea } from './components/WorkArea/WorkArea';
import { AppProviders, useData, useSession } from './contexts/AppProviders';

const AppContent = memo(() => {
  const { data } = useData();
  const { currentSession, showSessionsList, setShowSessionsList } = useSession();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Back to sessions button */}
        {!showSessionsList && currentSession && (
          <div className="mb-4">
            <button
              onClick={() => setShowSessionsList(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to sessions
            </button>
          </div>
        )}

        {/* Main content */}
        <SessionManager />
        
        {/* Work area - only show if we have data and not showing sessions list */}
        {!showSessionsList && data.length > 0 && <WorkArea />}
      </div>
    </div>
  );
});

AppContent.displayName = 'AppContent';

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

export default App;