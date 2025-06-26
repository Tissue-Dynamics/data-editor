import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import type { DataRow } from '../../types/data';

interface FileUploaderProps {
  onDataLoad: (data: DataRow[], filename: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoad }) => {
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (result) => {
          if (result.data && result.data.length > 0) {
            const headers = result.data[0] as string[];
            const rows = result.data.slice(1).map((row: unknown) => {
              const dataRow: DataRow = {};
              const rowArray = row as string[];
              headers.forEach((header, index) => {
                dataRow[header] = rowArray[index] || null;
              });
              return dataRow;
            }).filter(row => Object.keys(row).length > 0);
            
            onDataLoad(rows, file.name);
          }
        },
        header: false,
        skipEmptyLines: true,
      });
    } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const rows = Array.isArray(data) ? data : [data];
          onDataLoad(rows, file.name);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          alert('Error parsing JSON file');
        }
      };
      reader.readAsText(file);
    }
  }, [onDataLoad]);

  return (
    <div className="w-full">
      <label htmlFor="file-upload" className="block">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500">CSV or JSON files up to 100MB</p>
        </div>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept=".csv,.json"
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
};