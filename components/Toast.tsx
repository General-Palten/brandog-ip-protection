import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useDashboard();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map((note) => (
        <div 
          key={note.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-full duration-300
            ${note.type === 'success' ? 'bg-white border-green-200 text-green-800' : ''}
            ${note.type === 'error' ? 'bg-white border-red-200 text-red-800' : ''}
            ${note.type === 'info' ? 'bg-white border-gray-200 text-gray-800' : ''}
          `}
        >
          {note.type === 'success' && <CheckCircle size={18} className="text-green-500" />}
          {note.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
          {note.type === 'info' && <Info size={18} className="text-white" />}
          
          <span className="text-sm font-medium">{note.message}</span>
          
          <button 
            onClick={() => removeNotification(note.id)}
            className="ml-2 hover:opacity-70"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
