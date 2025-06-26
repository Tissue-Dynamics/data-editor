import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const ValidationLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 rounded"
        title="Validation Status Legend"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-lg border p-4 w-64">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Validation Status</h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium">Auto-updated</div>
                  <div className="text-gray-600">AI applied changes - click to confirm</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium">Confirmed</div>
                  <div className="text-gray-600">User validated this value</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium">Conflict</div>
                  <div className="text-gray-600">AI found conflicting information</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium">Unchecked</div>
                  <div className="text-gray-600">Never validated - click to confirm</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};