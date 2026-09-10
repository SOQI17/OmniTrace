import React, { useState, memo } from 'react';
import { 
  Asset, 
  AssetCondition, 
  AssetStatus, 
  RequestDraftItem, 
  User 
} from '../../types';
import { db } from '../../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { 
  Cpu, Monitor, Wrench, ArrowRight, ArrowLeft, Trash2, 
  Plus, ShoppingCart 
} from 'lucide-react';
import { generateUUID, normalizeSparePartCondition } from '../../utils/helpers';
import { EditableField } from '../ui/EditableField';

interface RequestsModuleProps {
  assets: Asset[];
  currentUser: User | null;
  canCreateRequest: boolean;
  onSuccessNavigate: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const RequestsModule: React.FC<RequestsModuleProps> = memo(({
  assets,
  currentUser,
  canCreateRequest,
  onSuccessNavigate,
  showToast
}) => {
  const [requestMode, setRequestMode] = useState<'MENU' | 'PARTS' | 'EQUIPMENT' | 'TOOLS'>('MENU');
  const [requestItems, setRequestItems] = useState<RequestDraftItem[]>([]);
  const [reqPn, setReqPn] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqQty, setReqQty] = useState(1);
  const [reqCost, setReqCost] = useState('');
  const [reqCostoDia, setReqCostoDia] = useState('');

  const handleAddRequestItem = () => {
    if (!reqPn || !reqDesc) return;
    setRequestItems(prev => [...prev, { 
      id: generateUUID(), 
      pn: reqPn, 
      description: reqDesc, 
      cantidad: Number(reqQty), 
      cost: Number(reqCost) || 0
    }]);
    setReqPn(''); 
    setReqDesc(''); 
    setReqQty(1); 
    setReqCost('');
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || requestItems.length === 0) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const batch = writeBatch(db);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fechaPedidoFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const mesNombre = now.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMes = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

    requestItems.forEach(item => {
      const id = generateUUID();
      const asset: Asset = { 
        id, 
        current_status: AssetStatus.DRAFT, 
        lifecycle_lock: false, 
        metadata: { 
          workflow_id: formData.get('workflow_id') as string, 
          provider: formData.get('provider') as string, 
          cliente_final: formData.get('cliente_final') as string, 
          equipo_destino: formData.get('equipo_destino') as string, 
          condicion: formData.get('condicion') as AssetCondition, 
          numero_orden_ge: formData.get('numero_orden_ge') as string, 
          fecha_solicitud: new Date().toISOString(), 
          pn: item.pn, 
          description: item.description, 
          cantidad: item.cantidad, 
          cost: item.cost, 
          serial_ge: 'PENDIENTE' 
        }, 
        logistics: { documents: {}, extra_docs: [] }, 
        warehouse: {} 
      };
      batch.set(doc(db, "assets", id), asset);

      // Registro vinculado automáticamente a la Base de Repuestos
      const spId = generateUUID();
      const spRecord: any = {
        id: spId,
        pn: item.pn,
        descripcion: item.description,
        cantidad: item.cantidad,
        cliente: (formData.get('cliente_final') as string) || '',
        mod: (formData.get('equipo_destino') as string) || '',
        equipo: (formData.get('equipo_destino') as string) || '',
        workflow_id: (formData.get('workflow_id') as string) || '',
        orden_ge: (formData.get('numero_orden_ge') as string) || '',
        condicion: normalizeSparePartCondition((formData.get('condicion') as string) || '', item.cost ? Number(item.cost) : undefined),
        observacion: `Creado desde Solicitud (${currentUser.name})`,
        mes: capitalizedMes,
        anio: now.getFullYear(),
        fecha_pedido: fechaPedidoFormatted,
        fecha_llegada: '',
        fecha_despacho: '',
        fecha_egreso: '',
        fecha_instalacion: '',
        fecha_llegada_tentativa: '',
        asset_id: id,
        created_by: currentUser.name || currentUser.id,
        created_at: now.toISOString(),
        source: 'SOLICITUD'
      };
      if (item.cost && item.cost > 0) {
        spRecord.precio = Number(item.cost);
      }
      batch.set(doc(db, "spare_parts", spId), spRecord);
    });

    await batch.commit();
    showToast('Solicitud creada y registrada en Repuestos.', 'success');
    setRequestItems([]);
    setRequestMode('MENU');
    onSuccessNavigate();
  };

  const handleCreateToolsRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || requestItems.length === 0) return;
    const formData = new FormData(e.target as HTMLFormElement);

    const existingLoans = assets.filter(a =>
      a.metadata.numero_orden_ge?.startsWith('LOAN-ORI-')
    );
    const maxNum = existingLoans.reduce((max, a) => {
      const num = parseInt(a.metadata.numero_orden_ge.replace('LOAN-ORI-', '')) || 0;
      return num > max ? num : max;
    }, 0);
    const loanOrderId = `LOAN-ORI-${String(maxNum + 1).padStart(4, '0')}`;

    const batch = writeBatch(db);
    requestItems.forEach(item => {
      const id = generateUUID();
      const asset: Asset = {
        id,
        current_status: AssetStatus.DRAFT,
        lifecycle_lock: false,
        metadata: {
          workflow_id: 'PRESTAMO-HERRAMIENTA',
          provider: 'INTERNO',
          cliente_final: formData.get('solicitante') as string || '',
          equipo_destino: formData.get('equipo_destino') as string || '',
          condicion: 'PRESTAMO' as any,
          numero_orden_ge: loanOrderId,
          fecha_solicitud: new Date().toISOString(),
          pn: item.pn,
          description: item.description,
          cantidad: item.cantidad,
          cost: item.cost || 0,
          serial_ge: 'PRESTAMO',
          fecha_devolucion: formData.get('fecha_devolucion') as string || '',
          motivo_prestamo:  formData.get('motivo') as string || '',
          departamento:     formData.get('departamento') as string || '',
          costo_dia:        item.costo_dia ?? 0,
        } as any,
        logistics: { documents: {}, extra_docs: [] },
        warehouse: {}
      };
      batch.set(doc(db, "assets", id), asset);
    });

    await batch.commit();
    showToast(`Solicitud ${loanOrderId} creada correctamente.`, 'success');
    setRequestItems([]);
    setRequestMode('MENU');
  };

  return (
    <div className="animate-fadeIn">
      {requestMode === 'MENU' && (
        <div className="max-w-5xl mx-auto mt-4 md:mt-10">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-black text-slate-800 dark:text-slate-100 mb-3">Nuevo Requerimiento</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">Seleccione una categoría para iniciar el flujo de aprobación y trazabilidad.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
            <button onClick={() => setRequestMode('PARTS')} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-all group text-left flex flex-col h-64 justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-700 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>
              <div className="relative z-10">
                <div className="bg-slate-900 w-14 h-14 rounded-lg flex items-center justify-center mb-6 shadow-md">
                  <Cpu size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Solicitud de Repuestos</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Partes, piezas y consumibles para mantenimiento preventivo o stock.</p>
              </div>
              <div className="relative z-10 flex items-center text-slate-700 dark:text-slate-300 font-bold text-sm group-hover:translate-x-2 transition-transform uppercase tracking-widest">
                Iniciar <ArrowRight size={16} className="ml-2"/>
              </div>
            </button>
            <button onClick={() => setRequestMode('EQUIPMENT')} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-all group text-left flex flex-col h-64 justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-700 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>
              <div className="relative z-10">
                <div className="bg-slate-900 w-14 h-14 rounded-lg flex items-center justify-center mb-6 shadow-md">
                  <Monitor size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Solicitud de Equipos</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Nuevos equipos médicos, maquinaria industrial o activos fijos.</p>
              </div>
              <div className="relative z-10 flex items-center text-slate-700 dark:text-slate-300 font-bold text-sm group-hover:translate-x-2 transition-transform uppercase tracking-widest">
                Iniciar <ArrowRight size={16} className="ml-2"/>
              </div>
            </button>
            <button onClick={() => setRequestMode('TOOLS')} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600 transition-all group text-left flex flex-col h-64 justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/20 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>
              <div className="relative z-10">
                <div className="bg-amber-600 w-14 h-14 rounded-lg flex items-center justify-center mb-6 shadow-md">
                  <Wrench size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Préstamo de Herramientas</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Solicitud de préstamo temporal de herramientas e instrumentos.</p>
              </div>
              <div className="relative z-10 flex items-center text-amber-700 dark:text-amber-400 font-bold text-sm group-hover:translate-x-2 transition-transform uppercase tracking-widest">
                Iniciar <ArrowRight size={16} className="ml-2"/>
              </div>
            </button>
          </div>
        </div>
      )}

      {(requestMode === 'PARTS' || requestMode === 'EQUIPMENT') && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn border border-slate-200 dark:border-slate-700">
          <div className="bg-slate-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => setRequestMode('MENU')} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-lg font-bold">Detalle de Solicitud</h2>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                  Categoría: {requestMode === 'PARTS' ? 'Repuestos' : 'Equipos Médicos'}
                </p>
              </div>
            </div>
            {!canCreateRequest && <span className="bg-slate-700 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Lectura</span>}
          </div>
          <form onSubmit={handleCreateRequest} className="p-6 md:p-10 space-y-8">
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div> 1. Información General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EditableField label="Workflow ID" name="workflow_id" disabled={!canCreateRequest}/>
                <EditableField label="Orden GE" name="numero_orden_ge" disabled={!canCreateRequest}/>
                <EditableField label="Proveedor" name="provider" disabled={!canCreateRequest}/>
                <EditableField label="Cliente Final" name="cliente_final" disabled={!canCreateRequest}/>
                <EditableField label="Equipo Destino" name="equipo_destino" disabled={!canCreateRequest}/>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Condición</label>
                  <select name="condicion" className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-slate-200 outline-none" disabled={!canCreateRequest}>
                    {Object.values(AssetCondition).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div> 2. Items Seleccionados ({requestItems.length})
                </div>
              </h3>
              <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black">
                      <tr><th className="p-4">P/N</th><th className="p-4">Descripción</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Total Est.</th><th className="p-4 w-10"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {requestItems.length === 0 ? ( 
                        <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-xs italic">Agregue repuestos a la lista usando el panel inferior.</td></tr> 
                      ) : ( 
                        requestItems.map(item => ( 
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{item.pn}</td>
                            <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{item.description}</td>
                            <td className="p-4 text-center font-mono dark:text-slate-300">{item.cantidad}</td>
                            <td className="p-4 text-right font-bold dark:text-slate-200">${(item.cantidad * item.cost).toFixed(2)}</td>
                            <td className="p-4 text-center">
                              <button type="button" aria-label="Eliminar item" onClick={() => setRequestItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16}/>
                              </button>
                            </td>
                          </tr> 
                        )) 
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {canCreateRequest && (
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">P/N</label>
                    <input value={reqPn} onChange={e => setReqPn(e.target.value)} type="text" placeholder="Ej. 5406622" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-200 dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="flex-[2] w-full">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Descripción</label>
                    <input value={reqDesc} onChange={e => setReqDesc(e.target.value)} type="text" placeholder="Ej. BOARD, MAIN SYSTEM" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-200 dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <div className="w-20">
                      <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Cant.</label>
                      <input value={reqQty} onChange={e => setReqQty(Number(e.target.value))} type="number" min="1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-center dark:bg-slate-800 dark:text-white"/>
                    </div>
                    <div className="w-32">
                      <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo ($)</label>
                      <input value={reqCost} onChange={e => setReqCost(e.target.value)} type="number" min="0" step="0.01" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/>
                    </div>
                    <button type="button" onClick={handleAddRequestItem} className="bg-slate-900 text-white p-3 rounded-lg hover:bg-slate-800 transition-all shadow-md"><Plus size={24} /></button>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-6 border-t dark:border-slate-700 flex justify-end">
              <button type="submit" disabled={requestItems.length === 0} className="bg-slate-900 dark:bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-30 flex items-center gap-3 transition-all active:scale-95 shadow-md">
                <ShoppingCart size={18} /> Crear Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {requestMode === 'TOOLS' && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn border border-slate-200 dark:border-slate-700">
          <div className="bg-amber-600 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => setRequestMode('MENU')} className="bg-amber-700 hover:bg-amber-800 p-2 rounded-lg transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-lg font-bold">Solicitud de Préstamo de Herramientas</h2>
                <p className="text-amber-100 text-[10px] uppercase font-bold tracking-widest mt-0.5">Control de Préstamo Interno</p>
              </div>
            </div>
            {!canCreateRequest && <span className="bg-amber-800 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Lectura</span>}
          </div>
          <form onSubmit={handleCreateToolsRequest} className="p-6 md:p-10 space-y-8">
            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-lg border border-amber-200 dark:border-amber-800">
              <h3 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase mb-6 tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div> 1. Datos del Solicitante y Préstamo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EditableField label="Solicitante" name="solicitante" disabled={!canCreateRequest}/>
                <EditableField label="Departamento / Área" name="departamento" disabled={!canCreateRequest}/>
                <EditableField label="Equipo / Proyecto Destino" name="equipo_destino" disabled={!canCreateRequest}/>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Fecha Prevista de Devolución</label>
                  <input type="date" name="fecha_devolucion" disabled={!canCreateRequest} required className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 outline-none dark:bg-slate-800 dark:text-white"/>
                </div>
                <div className="md:col-span-2 flex flex-col">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Motivo del Préstamo</label>
                  <input type="text" name="motivo" placeholder="Ej. Calibración de equipo en Clínica Alemana" disabled={!canCreateRequest} className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 outline-none dark:bg-slate-800 dark:text-white"/>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div> 2. Herramientas a Prestar ({requestItems.length})
                </div>
              </h3>
              <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[650px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black">
                      <tr>
                        <th className="p-4">Código / ID</th>
                        <th className="p-4">Herramienta / Instrumento</th>
                        <th className="p-4 text-center">Cant.</th>
                        <th className="p-4 text-right">Costo Herramienta</th>
                        <th className="p-4 text-right">Costo / Día</th>
                        <th className="p-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {requestItems.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 text-xs italic">Agregue herramientas usando el panel inferior.</td></tr>
                      ) : (
                        requestItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-200 font-mono">{item.pn}</td>
                            <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{item.description}</td>
                            <td className="p-4 text-center font-mono dark:text-slate-300">{item.cantidad}</td>
                            <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-200">${item.cost.toFixed(2)}</td>
                            <td className="p-4 text-right font-mono text-amber-600 dark:text-amber-400">${(item.costo_dia ?? 0).toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">/día</span></td>
                            <td className="p-4 text-center">
                              <button type="button" aria-label="Eliminar" onClick={() => setRequestItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {canCreateRequest && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-lg border border-amber-200 dark:border-amber-800 flex flex-col md:flex-row flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Código / ID</label>
                    <input value={reqPn} onChange={e => setReqPn(e.target.value)} type="text" placeholder="Ej. TOOL-001" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="flex-[2] min-w-[180px]">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Nombre de la Herramienta</label>
                    <input value={reqDesc} onChange={e => setReqDesc(e.target.value)} type="text" placeholder="Ej. Multímetro digital Fluke 117" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="w-20">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Cant.</label>
                    <input value={reqQty} onChange={e => setReqQty(Number(e.target.value))} type="number" min="1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-center dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="w-32">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo Herramienta ($)</label>
                    <input value={reqCost} onChange={e => setReqCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <div className="w-32">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo / Día ($)</label>
                    <input value={reqCostoDia} onChange={e => setReqCostoDia(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!reqPn || !reqDesc) return;
                      setRequestItems(prev => [...prev, {
                        id: generateUUID(),
                        pn: reqPn,
                        description: reqDesc,
                        cantidad: Number(reqQty),
                        cost: Number(reqCost) || 0,
                        costo_dia: Number(reqCostoDia) || 0,
                      }]);
                      setReqPn(''); setReqDesc(''); setReqQty(1); setReqCost(''); setReqCostoDia('');
                    }}
                    className="bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 transition-all shadow-md"
                  >
                    <Plus size={24}/>
                  </button>
                </div>
              )}
            </div>

            <div className="pt-6 border-t dark:border-slate-700 flex justify-end">
              <button type="submit" disabled={requestItems.length === 0} className="bg-amber-600 text-white px-10 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 disabled:opacity-30 flex items-center gap-3 transition-all active:scale-95 shadow-md">
                <Wrench size={18}/> Crear Solicitud de Préstamo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});
RequestsModule.displayName = 'RequestsModule';
