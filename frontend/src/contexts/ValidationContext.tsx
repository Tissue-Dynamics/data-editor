import React, { createContext, useContext, ReactNode } from 'react';
import type { ValidationState } from '../types/validation';
import type { CellHistoryEntry } from '../types/cellHistory';
import type { ClaudeAnalysisResult } from '../types/tasks';
import type { DataRow } from '../types/data';
import { useValidation } from '../hooks/useValidation';
import { useData } from './DataContext';

interface ValidationSummary {
  analysis?: string;
  messages: Array<{
    rowIndex: number;
    columnId: string;
    status: 'valid' | 'warning' | 'error' | 'conflict';
    message: string;
    originalValue?: CellValue;
    suggestedValue?: CellValue;
    isEstimate?: boolean;
  }>;
  rowDeletions?: Array<{
    rowIndex: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

interface ValidationContextType {
  // Validation state
  validations: Map<string, ValidationState>;
  setValidations: (validations: Map<string, ValidationState>) => void;
  
  // Validation summary
  validationSummary: ValidationSummary | null;
  setValidationSummary: (summary: ValidationSummary | null) => void;
  
  // Cell history
  cellHistory: Map<string, CellHistoryEntry[]>;
  getCellHistory: (cellKey: string) => CellHistoryEntry[];
  
  // Validation operations
  confirmValidation: (cellKey: string) => void;
  applyValidationValue: (rowIndex: number, columnId: string, value: CellValue) => void;
  clearValidations: () => void;
  parseClaudeValidations: (result: ClaudeAnalysisResult, taskId?: string, taskPrompt?: string) => void;
}

import type { CellValue } from '../types/values';

const ValidationContext = createContext<ValidationContextType | undefined>(undefined);

export function ValidationProvider({ 
  children,
  createVersion 
}: { 
  children: ReactNode;
  createVersion: (data: DataRow[], description: string) => void;
}) {
  const { data, updateData } = useData();
  
  const {
    validations,
    setValidations,
    validationSummary,
    setValidationSummary,
    cellHistory,
    getCellHistory,
    confirmValidation,
    applyValidationValue,
    clearValidations,
    parseClaudeValidations,
  } = useValidation(data, updateData, createVersion);

  const value: ValidationContextType = {
    validations,
    setValidations,
    validationSummary,
    setValidationSummary,
    cellHistory,
    getCellHistory,
    confirmValidation,
    applyValidationValue,
    clearValidations,
    parseClaudeValidations,
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidationContext() {
  const context = useContext(ValidationContext);
  if (context === undefined) {
    throw new Error('useValidationContext must be used within a ValidationProvider');
  }
  return context;
}