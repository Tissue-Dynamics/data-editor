import React from 'react';
import { Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import type { ValidationState } from '../../types/validation';

interface ValidationIndicatorProps {
  state: ValidationState;
}

export const ValidationIndicator: React.FC<ValidationIndicatorProps> = ({ state }) => {
  if (!state.status) return null;

  const getIcon = () => {
    switch (state.status) {
      case 'validated':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getTooltip = () => {
    let content = `Status: ${state.status}`;
    if (state.source) content += `\nSource: ${state.source}`;
    if (state.notes) content += `\nNotes: ${state.notes}`;
    if (state.confidence) content += `\nConfidence: ${(state.confidence * 100).toFixed(0)}%`;
    return content;
  };

  return (
    <div className="inline-flex" title={getTooltip()}>
      {getIcon()}
    </div>
  );
};