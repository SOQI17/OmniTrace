import React from 'react';
import { AssetStatus } from '../../types';

export const StatusBadge: React.FC<{ status: AssetStatus }> = ({ status }) => {
  let colorClass = 'bg-slate-100 text-slate-600 border border-slate-200';
  let label: string = status;

  if (status === AssetStatus.DRAFT) {
    colorClass = 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 animate-pulse font-black';
    label = 'SOLICITADO';
  } else if (status === AssetStatus.ORDERED) {
    colorClass = 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900 font-bold';
    label = 'ORDENADO';
  } else if (status === AssetStatus.IN_TRANSIT) {
    colorClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900 font-bold';
    label = 'EN TRÁNSITO';
  } else if (status === AssetStatus.CUSTOMS) {
    colorClass = 'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900 font-bold';
    label = 'ADUANAS';
  } else if (status === AssetStatus.RECEIVED_WH) {
    colorClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900 font-black';
    label = 'EN BODEGA';
  } else if (status === AssetStatus.QUALITY_CHECK) {
    colorClass = 'bg-cyan-50 text-cyan-800 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-900 font-bold';
    label = 'CONTROL CALIDAD';
  } else if (status === AssetStatus.DISPATCHED) {
    colorClass = 'bg-slate-800 text-white border border-slate-900 dark:bg-slate-600 dark:text-slate-100 font-bold';
    label = 'DESPACHADO';
  }
  
  return <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shadow-sm ${colorClass}`}>{label}</span>;
};
