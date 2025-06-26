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
  // Don't render if only one version
  if (dataHistory.length <= 1) return null;

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg shadow-sm px-4 py-2 mb-4">
      {/* Compact navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onNavigate('back')}
          disabled={currentIndex <= 0}
          className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed rounded transition-colors"
          title="Previous version (Ctrl+Z)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button
          onClick={() => onNavigate('forward')}
          disabled={currentIndex >= dataHistory.length - 1}
          className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed rounded transition-colors"
          title="Next version (Ctrl+Y)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="h-4 w-px bg-gray-200" />
      
      {/* Minimalist timeline */}
      <div className="flex-1 flex items-center gap-0 overflow-hidden">
        <div className="flex items-center relative">
          {/* Background line */}
          <div className="absolute h-0.5 bg-gray-200" style={{
            width: `${(dataHistory.length - 1) * 16}px`,
            left: '4px'
          }} />
          
          {/* Progress line */}
          <div className="absolute h-0.5 bg-blue-400 transition-all duration-200" style={{
            width: `${currentIndex * 16}px`,
            left: '4px'
          }} />
          
          {/* Dots */}
          {dataHistory.map((_, index) => (
            <div
              key={index}
              className="relative z-10"
              style={{ marginRight: index < dataHistory.length - 1 ? '12px' : '0' }}
            >
              <div
                className={`w-2 h-2 rounded-full transition-all duration-200 cursor-pointer hover:scale-150 ${
                  index === currentIndex
                    ? 'bg-blue-500 ring-2 ring-blue-200 ring-offset-1'
                    : index < currentIndex
                    ? 'bg-blue-400'
                    : 'bg-gray-300'
                }`}
                onClick={() => {
                  if (index < currentIndex) {
                    for (let i = 0; i < currentIndex - index; i++) {
                      onNavigate('back');
                    }
                  } else if (index > currentIndex) {
                    for (let i = 0; i < index - currentIndex; i++) {
                      onNavigate('forward');
                    }
                  }
                }}
                title={`Version ${index + 1}${index === 0 ? ' (Initial)' : ''}${index === currentIndex ? ' (Current)' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Version indicator */}
      <div className="text-xs text-gray-500 whitespace-nowrap">
        v{currentIndex + 1}
        <span className="text-gray-400">/{dataHistory.length}</span>
      </div>
    </div>
  );
};