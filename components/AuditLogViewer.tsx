import React from 'react';
import { AuditLogEntry } from '../types';
import { History, ShieldCheck } from 'lucide-react';

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-600" />
          Registro de Auditoría (Caja Negra)
        </h3>
        <span className="text-xs text-slate-500 uppercase tracking-wider">Lectura</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No hay registros de auditoría.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2">Fecha/Hora</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Acción</th>
                <th className="px-4 py-2">Cambio (Diff)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.actor_id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                      ${log.action === 'STATUS_CHANGE' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 truncate max-w-xs">
                    {JSON.stringify(log.new_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};