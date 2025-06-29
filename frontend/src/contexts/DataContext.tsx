import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { DataRow, Selection } from '../types/data';

interface DataContextType {
  // Data state
  data: DataRow[];
  setData: (data: DataRow[]) => void;
  updateData: (newData: DataRow[]) => void;
  
  // Original data for reset
  originalData: DataRow[];
  setOriginalData: (data: DataRow[]) => void;
  
  // File info
  filename: string;
  setFilename: (filename: string) => void;
  
  // Selection state
  selection: Selection;
  setSelection: (selection: Selection) => void;
  handleSelectionChange: (selection: Selection) => void;
  
  // Data operations
  handleDeleteRow: (rowIndex: number) => void;
  handleDeleteRows: (rowIndexes: number[]) => void;
  resetData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataRow[]>([]);
  const [originalData, setOriginalData] = useState<DataRow[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({
    rows: [],
    columns: [],
    cells: [],
  });

  const updateData = useCallback((newData: DataRow[]) => {
    setData(newData);
  }, []);

  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setSelection(newSelection);
  }, []);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    
    // Clear selection if deleted row was selected
    setSelection(prev => ({
      rows: prev.rows.filter(idx => idx !== rowIndex).map(idx => idx > rowIndex ? idx - 1 : idx),
      columns: prev.columns,
      cells: prev.cells.filter(cell => cell.rowIndex !== rowIndex).map(cell => ({
        ...cell,
        rowIndex: cell.rowIndex > rowIndex ? cell.rowIndex - 1 : cell.rowIndex
      }))
    }));
  }, [data]);

  const handleDeleteRows = useCallback((rowIndexes: number[]) => {
    const sortedIndexes = [...rowIndexes].sort((a, b) => b - a);
    let newData = [...data];
    
    sortedIndexes.forEach(index => {
      newData = newData.filter((_, idx) => idx !== index);
    });
    
    setData(newData);
    
    // Clear selection for deleted rows
    const deletedSet = new Set(rowIndexes);
    setSelection(prev => {
      const remainingRows = prev.rows.filter(idx => !deletedSet.has(idx));
      const indexMap = new Map<number, number>();
      let newIndex = 0;
      
      for (let i = 0; i < data.length; i++) {
        if (!deletedSet.has(i)) {
          indexMap.set(i, newIndex++);
        }
      }
      
      return {
        rows: remainingRows.map(idx => indexMap.get(idx) ?? idx),
        columns: prev.columns,
        cells: prev.cells
          .filter(cell => !deletedSet.has(cell.rowIndex))
          .map(cell => ({
            ...cell,
            rowIndex: indexMap.get(cell.rowIndex) ?? cell.rowIndex
          }))
      };
    });
  }, [data]);

  const resetData = useCallback(() => {
    setData([]);
    setOriginalData([]);
    setFilename('');
    setSelection({ rows: [], columns: [], cells: [] });
  }, []);

  const value: DataContextType = {
    data,
    setData,
    updateData,
    originalData,
    setOriginalData,
    filename,
    setFilename,
    selection,
    setSelection,
    handleSelectionChange,
    handleDeleteRow,
    handleDeleteRows,
    resetData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}