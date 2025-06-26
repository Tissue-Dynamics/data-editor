import React from 'react';

interface VersionHistoryProps {
  dataHistory: any[][];
  currentIndex: number;
  onNavigate: (direction: 'back' | 'forward') => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  dataHistory,
  currentIndex,
  onNavigate
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Version History</h3>
      
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => onNavigate('back')}
          disabled={currentIndex <= 0}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed rounded"
          title="Go back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex-1 text-center">
          <span className="text-sm text-gray-600">
            {currentIndex + 1} / {dataHistory.length}
          </span>
        </div>
        
        <button
          onClick={() => onNavigate('forward')}
          disabled={currentIndex >= dataHistory.length - 1}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed rounded"
          title="Go forward"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      {/* Git-like visual representation */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {dataHistory.map((_, index) => (
          <React.Fragment key={index}>
            <div
              className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                index === currentIndex
                  ? 'bg-blue-500 border-blue-500'
                  : index < currentIndex
                  ? 'bg-gray-400 border-gray-400'
                  : 'bg-white border-gray-300'
              }`}
              title={`Version ${index + 1}${index === 0 ? ' (Initial)' : ''}`}
            />
            {index < dataHistory.length - 1 && (
              <div 
                className={`w-4 h-0.5 flex-shrink-0 ${
                  index < currentIndex ? 'bg-gray-400' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {currentIndex === 0 ? 'Initial version' : `${currentIndex} change${currentIndex === 1 ? '' : 's'} applied`}
      </div>
    </div>
  );
};