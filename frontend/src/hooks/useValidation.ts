import { useState, useCallback } from 'react';
import type { ValidationState } from '../types/validation';
import type { ClaudeAnalysisResult } from '../types/tasks';
import type { DataRow } from '../types/data';
import type { CellHistoryEntry } from '../types/cellHistory';
import type { CellValue } from '../types/values';

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

export function useValidation(data: DataRow[], updateData: (newData: DataRow[]) => void, createVersion: (newData: DataRow[], description: string) => void) {
  const [validations, setValidations] = useState<Map<string, ValidationState>>(new Map());
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [cellHistory, setCellHistory] = useState<Map<string, CellHistoryEntry[]>>(new Map());

  const addCellHistoryEntry = useCallback((
    cellKey: string,
    taskId: string,
    taskPrompt: string,
    originalValue: CellValue,
    newValue: CellValue,
    reason: string,
    status: 'valid' | 'warning' | 'error' | 'conflict',
    source: string = 'Claude AI'
  ) => {
    const entry: CellHistoryEntry = {
      id: `${taskId}-${Date.now()}`,
      taskId,
      taskPrompt,
      originalValue,
      newValue,
      reason,
      timestamp: new Date(),
      status,
      source
    };

    setCellHistory(prev => {
      const newHistory = new Map(prev);
      const existing = newHistory.get(cellKey) || [];
      newHistory.set(cellKey, [...existing, entry]);
      return newHistory;
    });
  }, []);

  const getCellHistory = useCallback((cellKey: string): CellHistoryEntry[] => {
    return cellHistory.get(cellKey) || [];
  }, [cellHistory]);

  const applyValidationValue = useCallback((rowIndex: number, columnId: string, value: CellValue) => {
    const newData = [...data];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [columnId]: value
    };
    
    // Just update data without creating a version
    updateData(newData);
    
    // Update validation state
    const cellKey = `${rowIndex}-${columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'auto_updated',
          applied: true,
          timestamp: new Date(),
        });
      }
      return newValidations;
    });
  }, [data, updateData]);

  const confirmValidation = useCallback((rowIndex: number, columnId: string) => {
    const cellKey = `${rowIndex}-${columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'confirmed',
          confirmed: true,
          timestamp: new Date(),
        });
        console.log(`Confirmed validation for ${cellKey}`);
      }
      return newValidations;
    });
  }, []);

  const confirmAllValidations = useCallback(() => {
    let confirmedCount = 0;
    setValidations(prev => {
      const newValidations = new Map(prev);
      
      for (const [cellKey, validation] of newValidations) {
        if (validation.status === 'auto_updated') {
          newValidations.set(cellKey, {
            ...validation,
            status: 'confirmed',
            confirmed: true,
            timestamp: new Date(),
          });
          confirmedCount++;
        }
      }
      
      console.log(`Confirmed ${confirmedCount} auto-updated validations`);
      return newValidations;
    });
    
    // Create a version when confirming all validations
    if (confirmedCount > 0) {
      createVersion(data, `Confirmed ${confirmedCount} validation${confirmedCount > 1 ? 's' : ''}`);
    }
  }, [data, createVersion]);

  const dismissAllValidations = useCallback(() => {
    setValidations(prev => {
      const newValidations = new Map();
      let dismissedCount = 0;
      
      for (const [cellKey, validation] of prev) {
        if (validation.status !== 'auto_updated' && validation.status !== 'conflict') {
          newValidations.set(cellKey, validation);
        } else {
          dismissedCount++;
        }
      }
      
      console.log(`Dismissed ${dismissedCount} validations`);
      return newValidations;
    });
  }, []);

  const applyValidation = useCallback((validation: ClaudeAnalysisResult['validations'][0], newData: DataRow[]) => {
    if (!validation.suggestedValue) return;

    // Update validation state to mark as applied
    const cellKey = `${validation.rowIndex}-${validation.columnId}`;
    setValidations(prev => {
      const newValidations = new Map(prev);
      const existing = newValidations.get(cellKey);
      if (existing) {
        newValidations.set(cellKey, {
          ...existing,
          status: 'auto_updated',
          applied: true,
          timestamp: new Date(),
        });
      }
      return newValidations;
    });
  }, []);

  const parseClaudeValidations = useCallback((claudeResult: ClaudeAnalysisResult, taskId?: string, taskPrompt?: string) => {
    console.log('parseClaudeValidations called with:', claudeResult);
    
    if (!claudeResult.validations) {
      console.log('No validations found in Claude result');
      return;
    }

    console.log(`Found ${claudeResult.validations.length} validations from Claude`);
    
    // Create validation messages for summary
    const messages = claudeResult.validations.map(validation => {
      // Check if this is an estimate based on keywords in the reason
      const isEstimate = validation.reason.toLowerCase().includes('estimat') || 
                        validation.reason.toLowerCase().includes('typical') ||
                        validation.reason.toLowerCase().includes('based on peer') ||
                        validation.reason.toLowerCase().includes('based on similar');
      
      return {
        rowIndex: validation.rowIndex,
        columnId: validation.columnId,
        status: validation.status,
        message: validation.reason,
        originalValue: validation.originalValue,
        suggestedValue: validation.suggestedValue,
        isEstimate
      };
    });
    
    // Set validation summary for display
    setValidationSummary({
      analysis: claudeResult.analysis,
      messages,
      rowDeletions: claudeResult.rowDeletions
    });
    
    // Only create validation states for cells, no auto-applying
    const newValidations = new Map(validations);
    
    claudeResult.validations.forEach((validation) => {
      const cellKey = `${validation.rowIndex}-${validation.columnId}`;
      
      // Add to cell history if we have task info
      if (taskId && taskPrompt) {
        addCellHistoryEntry(
          cellKey,
          taskId,
          taskPrompt,
          validation.originalValue,
          validation.suggestedValue,
          validation.reason,
          validation.status,
          'Claude AI'
        );
      }
      
      // Map Claude statuses to our new system
      let mappedStatus: ValidationState['status'];
      switch (validation.status) {
        case 'valid':
          mappedStatus = 'confirmed'; // Valid means confirmed by research
          break;
        case 'warning':
          mappedStatus = 'auto_updated'; // Warning means needs user review
          break;
        case 'error':
          mappedStatus = 'conflict'; // Error means missing or problematic
          break;
        case 'conflict':
          mappedStatus = 'conflict';
          break;
        default:
          mappedStatus = 'unchecked';
      }
      
      const validationState: ValidationState = {
        cellKey,
        status: mappedStatus,
        originalValue: validation.originalValue,
        validatedValue: validation.suggestedValue,
        confidence: 0.9,
        source: 'Claude AI',
        notes: validation.reason,
        timestamp: new Date(),
        applied: false,
        confirmed: validation.status === 'valid',
      };
      
      newValidations.set(cellKey, validationState);
    });
    
    console.log('Setting new validations map with', newValidations.size, 'entries');
    setValidations(newValidations);
  }, [validations, addCellHistoryEntry]);

  const clearValidations = useCallback(() => {
    setValidations(new Map());
    setValidationSummary(null);
    setCellHistory(new Map());
  }, []);

  return {
    validations,
    validationSummary,
    cellHistory,
    setValidationSummary,
    applyValidationValue,
    confirmValidation,
    confirmAllValidations,
    dismissAllValidations,
    applyValidation,
    parseClaudeValidations,
    getCellHistory,
    clearValidations,
  };
}