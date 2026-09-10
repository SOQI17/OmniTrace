import React, { memo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Asset, 
  AssetStatus, 
  AuditLogEntry 
} from '../../types';
import { 
  DollarSign, 
  Warehouse, 
  Truck, 
  AlertTriangle, 
  Activity, 
  Layers, 
  History, 
  ShoppingCart, 
  Database, 
  Printer 
} from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, color, subtext }: { title: string; value: string | number; icon: any; color: string; subtext?: string }) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
      {subtext && <p className="text-[10px] text-slate-400 mt-1 font-medium">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color.includes('bg-') ? color : `bg-slate-100 text-slate-600`} dark:bg-opacity-20`}>
      <Icon size={20} className={color.includes('text-') ? '' : 'text-slate-600'}/>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-slate-200 dark:bg-slate-800 h-28 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-slate-200 dark:bg-slate-800 h-64 rounded-xl" />
      <div className="bg-slate-200 dark:bg-slate-800 h-64 rounded-xl" />
    </div>
  </div>
);

export interface DashboardModuleProps {
  assets: Asset[];
  logs: AuditLogEntry[];
  dataLoading: boolean;
  setActiveTab: (tab: any) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = memo(({
  assets,
  logs,
  dataLoading,
  setActiveTab
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Panel de Control</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">Estado general del inventario y operaciones logísticas.</p>
        </div>
        <div className="text-right hidden sm:block text-slate-400 font-medium text-xs">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <button
          onClick={() => window.print()}
          className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg transition-colors"
          aria-label="Imprimir reporte"
        >
          <Printer size={14}/> Imprimir
        </button>
      </div>

      {dataLoading ? <DashboardSkeleton /> : (() => {
        const monthlyData = (() => {
          const months: Record<string, number> = {};
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
            months[key] = 0;
          }
          assets.forEach(a => {
            const d = new Date(a.metadata.fecha_solicitud);
            const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
            if (months[key] !== undefined) months[key]++;
          });
          return Object.entries(months).map(([mes, total]) => ({ mes, total }));
        })();

        const statusData = Object.values(AssetStatus).map(s => ({
          name: s.replace(/_/g, ' '),
          value: assets.filter(a => a.current_status === s).length,
          status: s,
        })).filter(d => d.value > 0);

        const PIE_COLORS: Record<string, string> = {
          [AssetStatus.DRAFT]:        '#94a3b8',
          [AssetStatus.ORDERED]:      '#f59e0b',
          [AssetStatus.IN_TRANSIT]:   '#3b82f6',
          [AssetStatus.CUSTOMS]:      '#8b5cf6',
          [AssetStatus.RECEIVED_WH]:  '#10b981',
          [AssetStatus.DISPATCHED]:   '#1e293b',
        };

        const today = new Date();
        const loansOverdue = assets.filter(a => {
          if (a.metadata.workflow_id !== 'PRESTAMO-HERRAMIENTA') return false;
          const meta = a.metadata as any;
          if (!meta.fecha_devolucion) return false;
          return new Date(meta.fecha_devolucion) < today && a.current_status !== AssetStatus.DISPATCHED;
        });
        const noTracking = assets.filter(a =>
          [AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(a.current_status) &&
          !a.logistics?.documents?.tracking_number
        );
        const noSerial = assets.filter(a =>
          a.current_status === AssetStatus.RECEIVED_WH &&
          (!a.metadata.serial_ge || a.metadata.serial_ge === 'PENDIENTE')
        );

        return (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Valor Inventario" value={`$${assets.filter(a => a.current_status === AssetStatus.RECEIVED_WH).reduce((acc, curr) => acc + (curr.metadata.cost * (curr.metadata.cantidad || 1)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="bg-emerald-600 text-white" subtext="Costo en Bodega" />
              <KPICard title="Items Stock" value={assets.filter(a => a.current_status === AssetStatus.RECEIVED_WH).reduce((acc, curr) => acc + (curr.metadata.cantidad || 1), 0)} icon={Warehouse} color="bg-blue-600 text-white" subtext="Unidades disponibles" />
              <KPICard title="En Tránsito" value={assets.filter(a => [AssetStatus.ORDERED, AssetStatus.IN_TRANSIT, AssetStatus.CUSTOMS].includes(a.current_status)).length} icon={Truck} color="bg-amber-500 text-white" subtext="Órdenes activas" />
              <KPICard title="Pendientes" value={assets.filter(a => a.current_status === AssetStatus.DRAFT).length} icon={AlertTriangle} color="bg-slate-600 text-white" subtext="Por procesar" />
            </div>

            {/* Alertas activas */}
            {(loansOverdue.length > 0 || noTracking.length > 0 || noSerial.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {loansOverdue.length > 0 && (
                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('RETURNS')}>
                    <div className="bg-red-500 text-white p-2 rounded-lg shrink-0"><AlertTriangle size={18}/></div>
                    <div>
                      <p className="font-black text-red-700 dark:text-red-400 text-xs uppercase tracking-wide">Préstamos Vencidos</p>
                      <p className="text-red-600 dark:text-red-300 text-xl font-black">{loansOverdue.length}</p>
                      <p className="text-red-500 text-[10px]">Ver en Retornos →</p>
                    </div>
                  </div>
                )}
                {noTracking.length > 0 && (
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('LOGISTICS')}>
                    <div className="bg-amber-500 text-white p-2 rounded-lg shrink-0"><Truck size={18}/></div>
                    <div>
                      <p className="font-black text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wide">Sin Tracking</p>
                      <p className="text-amber-600 dark:text-amber-300 text-xl font-black">{noTracking.length}</p>
                      <p className="text-amber-500 text-[10px]">Ver en Logística →</p>
                    </div>
                  </div>
                )}
                {noSerial.length > 0 && (
                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('WAREHOUSE')}>
                    <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0"><Database size={18}/></div>
                    <div>
                      <p className="font-black text-blue-700 dark:text-blue-400 text-xs uppercase tracking-wide">Sin Serial</p>
                      <p className="text-blue-600 dark:text-blue-300 text-xl font-black">{noSerial.length}</p>
                      <p className="text-blue-500 text-[10px]">Ver en Bodega →</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <Activity size={18} className="text-blue-500"/> Órdenes por Mes
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barSize={28}>
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false}/>
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28}/>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff' }} cursor={{ fill: 'rgba(99,102,241,0.06)' }}/>
                    <Bar dataKey="total" fill="#3b82f6" radius={[6,6,0,0]} name="Órdenes"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <Layers size={18} className="text-purple-500"/> Por Estado
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={PIE_COLORS[entry.status] || '#94a3b8'}/>
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff' }}/>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontWeight: 700 }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Actividad reciente + Top proveedores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                  <h3 className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <History size={16} className="text-slate-500"/> Últimos Movimientos
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto max-h-72">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">Sin registros</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {logs.slice(0, 8).map(log => {
                        const a = assets.find(x => x.id === log.asset_id);
                        return (
                          <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{log.action}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a ? a.metadata.pn : 'Item'}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{log.user_name} — {log.details?.slice(0,50)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
                  <ShoppingCart size={16} className="text-emerald-500"/> Top Proveedores
                </h3>
                {(() => {
                  const provMap: Record<string, number> = {};
                  assets.forEach(a => {
                    const p = a.metadata.provider || 'Sin proveedor';
                    provMap[p] = (provMap[p] || 0) + 1;
                  });
                  const sorted = Object.entries(provMap).sort((a,b) => b[1]-a[1]).slice(0,6);
                  const max = sorted[0]?.[1] || 1;
                  return (
                    <div className="space-y-3">
                      {sorted.map(([prov, count]) => (
                        <div key={prov}>
                          <div className="flex justify-between text-[10px] font-bold mb-1 text-slate-600 dark:text-slate-300">
                            <span className="truncate max-w-[70%]">{prov}</span>
                            <span className="text-slate-800 dark:text-white">{count}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(count/max)*100}%`, transition: 'width 0.6s ease' }}/>
                          </div>
                        </div>
                      ))}
                      {sorted.length === 0 && <p className="text-slate-400 text-xs italic text-center py-8">Sin datos</p>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
});
DashboardModule.displayName = 'DashboardModule';
