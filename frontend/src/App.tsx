import { useState } from 'react';
import { FileUploader } from './components/Upload/FileUploader';
import { DataTable } from './components/DataTable/DataTable';
import type { DataRow, Selection } from './types/data';
import type { ValidationState } from './types/validation';

function App() {
  const [data, setData] = useState<DataRow[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({
    rows: [],
    columns: [],
    cells: [],
  });
  const [validations] = useState<Map<string, ValidationState>>(new Map());

  const handleDataLoad = (loadedData: DataRow[], fileName: string) => {
    setData(loadedData);
    setFilename(fileName);
  };

  const handleSelectionChange = (newSelection: Selection) => {
    setSelection(newSelection);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Data Analysis Tool</h1>
        
        {data.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8">
            <FileUploader onDataLoad={handleDataLoad} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{filename}</h2>
                <button
                  onClick={() => {
                    setData([]);
                    setFilename('');
                    setSelection({ rows: [], columns: [], cells: [] });
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Upload New File
                </button>
              </div>
              
              {selection.rows.length > 0 || selection.columns.length > 0 ? (
                <div className="mb-4 p-3 bg-blue-50 rounded">
                  <p className="text-sm">
                    Selected: {selection.rows.length} rows, {selection.columns.length} columns
                  </p>
                </div>
              ) : null}
              
              <DataTable 
                data={data} 
                validations={validations}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;