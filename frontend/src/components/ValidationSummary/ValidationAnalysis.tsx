import { memo } from 'react';

interface ValidationAnalysisProps {
  analysis: string;
}

export const ValidationAnalysis = memo<ValidationAnalysisProps>(({ analysis }) => {
  if (!analysis) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-100 bg-gray-50">
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis}</p>
    </div>
  );
});

ValidationAnalysis.displayName = 'ValidationAnalysis';