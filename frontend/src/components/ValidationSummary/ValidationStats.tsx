import { memo } from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface ValidationStatsProps {
  validCount: number;
  warningCount: number;
  errorCount: number;
  deletionCount: number;
}

export const ValidationStats = memo<ValidationStatsProps>(({
  validCount,
  warningCount,
  errorCount,
  deletionCount
}) => {
  return (
    <div className="flex items-center gap-2 text-xs">
      {validCount > 0 && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="w-3 h-3" />
          {validCount} valid
        </span>
      )}
      {warningCount > 0 && (
        <span className="flex items-center gap-1 text-yellow-600">
          <AlertCircle className="w-3 h-3" />
          {warningCount} warnings
        </span>
      )}
      {errorCount > 0 && (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="w-3 h-3" />
          {errorCount} errors
        </span>
      )}
      {deletionCount > 0 && (
        <span className="flex items-center gap-1 text-red-700">
          <XCircle className="w-3 h-3" />
          {deletionCount} deletion{deletionCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
});

ValidationStats.displayName = 'ValidationStats';