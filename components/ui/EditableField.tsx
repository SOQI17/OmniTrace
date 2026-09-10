import React from 'react';

interface EditableFieldProps {
  label: string;
  name: string;
  value?: string | number;
  disabled?: boolean;
}

export const EditableField: React.FC<EditableFieldProps> = ({ label, name, value, disabled }) => (
  <div className="flex flex-col">
    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input 
      defaultValue={value} 
      name={name} 
      disabled={disabled} 
      className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-200 outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 dark:bg-slate-700 dark:text-white" 
    />
  </div>
);
