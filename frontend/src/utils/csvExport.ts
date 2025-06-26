import type { DataRow } from '../types/data';

export function downloadAsCSV(data: DataRow[], filename: string) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get all unique column names from the data
  const columnNames = Array.from(
    new Set(data.flatMap(row => Object.keys(row)))
  );

  // Create CSV header
  const csvHeader = columnNames.map(col => `"${col}"`).join(',');

  // Create CSV rows
  const csvRows = data.map(row => {
    return columnNames.map(col => {
      const value = row[col];
      if (value === null || value === undefined) {
        return '""';
      }
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });

  // Combine header and rows
  const csvContent = [csvHeader, ...csvRows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with timestamp if no extension
    const baseFilename = filename.replace(/\.[^/.]+$/, ''); // Remove existing extension
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const downloadFilename = `${baseFilename}_${timestamp}.csv`;
    
    link.setAttribute('download', downloadFilename);
    link.style.visibility = 'hidden';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
  }
}