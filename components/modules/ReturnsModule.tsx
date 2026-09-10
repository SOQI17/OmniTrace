import React, { useState, memo } from 'react';
import { Asset, AssetCondition, StoredDocument, User } from '../../types';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  RotateCcw, Wrench, User as UserIcon, ArrowLeft, Save, 
  UploadCloud, FileText, Download 
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { generateUUID } from '../../utils/helpers';
import { uploadDocToStorage } from '../../utils/storage';

interface ReturnsModuleProps {
  assets: Asset[];
  currentUser: User | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showError: (msg: string) => void;
}

export const ReturnsModule: React.FC<ReturnsModuleProps> = memo(({
  assets,
  currentUser,
  showToast,
  showError
}) => {
  const [returnsSubTab, setReturnsSubTab] = useState<'RETURNS' | 'LOANS'>('RETURNS');
  const [managingReturnAsset, setManagingReturnAsset] = useState<Asset | null>(null);
  const [returnRequestedByProvider, setReturnRequestedByProvider] = useState<boolean>(false);
  const [returnLocation, setReturnLocation] = useState<string>('');
  const [returnDocFile, setReturnDocFile] = useState<File | null>(null);

  const handleOpenReturnManagement = (asset: Asset) => {
    setManagingReturnAsset(asset);
    setReturnRequestedByProvider(asset.logistics.solicitado_proveedor || false);
    setReturnLocation(asset.warehouse.ubicacion_retorno || '');
  };

  const handleSaveReturnManagement = async () => {
    if (!managingReturnAsset) return;
    try {
      await updateDoc(doc(db, "assets", managingReturnAsset.id), {
        "logistics.solicitado_proveedor": returnRequestedByProvider,
        "warehouse.ubicacion_retorno": returnLocation
      });
      setManagingReturnAsset(null);
      showToast('Gestión de retorno guardada.', 'success');
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleUploadReturnDoc = async () => {
    if (!managingReturnAsset || !currentUser || !returnDocFile) return;
    try {
      const docId = generateUUID();
      const downloadURL = await uploadDocToStorage(returnDocFile, docId);
      const newDoc: StoredDocument = { 
        id: docId, 
        name: "Doc Retorno", 
        filename: returnDocFile.name, 
        uploaded_by: currentUser.name, 
        date: new Date().toISOString(), 
        url: downloadURL,
      };
      await updateDoc(doc(db, "assets", managingReturnAsset.id), { 
        "logistics.extra_docs": [...(managingReturnAsset.logistics.extra_docs || []), newDoc] 
      });
      setReturnDocFile(null);
      showToast('Documento de retorno adjuntado.', 'success');
    } catch (err: any) {
      showError(`Error al subir archivo: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {!managingReturnAsset ? (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex gap-2">
            <button
              onClick={() => setReturnsSubTab('RETURNS')}
              className={`flex-1 px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all ${returnsSubTab === 'RETURNS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <RotateCcw size={16}/> Retornos (Garantía / Servicio)
              {assets.filter(a => a.metadata.condicion === AssetCondition.WARRANTY || a.metadata.condicion === AssetCondition.SERVICE_CONTRACT).length > 0 && (
                <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {assets.filter(a => a.metadata.condicion === AssetCondition.WARRANTY || a.metadata.condicion === AssetCondition.SERVICE_CONTRACT).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setReturnsSubTab('LOANS')}
              className={`flex-1 px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-all ${returnsSubTab === 'LOANS' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <Wrench size={16}/> Préstamos de Herramientas
              {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').length > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').length}
                </span>
              )}
            </button>
          </div>

          {/* RETORNOS GARANTÍA / SERVICIO */}
          {returnsSubTab === 'RETURNS' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-900 px-8 py-6 text-white">
                <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
                  <RotateCcw size={24}/> Gestión de Retornos
                </h3>
                <p className="text-slate-400 text-[10px] uppercase font-bold mt-1 tracking-widest opacity-80">
                  Monitoreo de activos en Garantía y Contrato de Servicio
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-5">Tipo Retorno</th>
                      <th className="p-5">Orden GE</th>
                      <th className="p-5">P/N & Descripción</th>
                      <th className="p-5">Serial GE</th>
                      <th className="p-5 text-center">Estado Actual</th>
                      <th className="p-5">Cliente Final</th>
                      <th className="p-5">Responsable Salida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {assets.filter(a => 
                      a.metadata.condicion === AssetCondition.WARRANTY || 
                      a.metadata.condicion === AssetCondition.SERVICE_CONTRACT
                    ).map(asset => (
                      <tr key={asset.id} onClick={() => handleOpenReturnManagement(asset)} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                        <td className="p-5">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tight ${
                            asset.metadata.condicion === AssetCondition.WARRANTY 
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-100' 
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100'
                          }`}>
                            {asset.metadata.condicion}
                          </span>
                        </td>
                        <td className="p-5 font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">
                          {asset.metadata.numero_orden_ge || '-'}
                        </td>
                        <td className="p-5">
                          <div className="font-black text-slate-800 dark:text-slate-200 font-mono uppercase tracking-tighter group-hover:text-blue-700 transition-colors">{asset.metadata.pn}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold max-w-xs truncate mt-1">{asset.metadata.description}</div>
                        </td>
                        <td className="p-5 font-mono font-bold text-slate-600 dark:text-slate-300">{asset.metadata.serial_ge}</td>
                        <td className="p-5 text-center"><StatusBadge status={asset.current_status} /></td>
                        <td className="p-5">
                          <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{asset.metadata.cliente_final || '-'}</div>
                        </td>
                        <td className="p-5">
                          {asset.warehouse.responsable_egreso ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                              <UserIcon size={14} className="text-slate-300"/> {asset.warehouse.responsable_egreso}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {assets.filter(a => a.metadata.condicion === AssetCondition.WARRANTY || a.metadata.condicion === AssetCondition.SERVICE_CONTRACT).length === 0 && (
                      <tr><td colSpan={7} className="p-16 text-center text-slate-300 dark:text-slate-600 uppercase font-black text-xs italic tracking-widest">No hay retornos activos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PRÉSTAMOS DE HERRAMIENTAS */}
          {returnsSubTab === 'LOANS' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-amber-600 px-8 py-6 text-white">
                <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
                  <Wrench size={24}/> Control de Préstamos de Herramientas
                </h3>
                <p className="text-amber-100 text-[10px] uppercase font-bold mt-1 tracking-widest opacity-80">
                  Seguimiento de herramientas prestadas a técnicos y clientes
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-5">ID Préstamo</th>
                      <th className="p-5">Herramienta</th>
                      <th className="p-5">Solicitante</th>
                      <th className="p-5">F. Devolución</th>
                      <th className="p-5">Días</th>
                      <th className="p-5 text-right">Costo Acumulado</th>
                      <th className="p-5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').map(asset => {
                      const today = new Date();
                      const returnDate = (asset.metadata as any).fecha_devolucion ? new Date((asset.metadata as any).fecha_devolucion) : null;
                      const isOverdue = returnDate && returnDate < today;
                      const daysLoaned = Math.max(1, Math.ceil((today.getTime() - new Date(asset.metadata.fecha_solicitud).getTime()) / (1000 * 3600 * 24)));
                      const costoDia = (asset.metadata as any).costo_dia || 0;
                      const costoAcumulado = daysLoaned * costoDia;

                      return (
                        <tr key={asset.id} onClick={() => handleOpenReturnManagement(asset)} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors cursor-pointer group">
                          <td className="p-5 font-mono font-black text-slate-800 dark:text-slate-200 uppercase">{asset.metadata.numero_orden_ge || asset.id.slice(0, 8)}</td>
                          <td className="p-5">
                            <div className="font-black text-slate-800 dark:text-slate-200 uppercase">{asset.metadata.description}</div>
                            <div className="text-[10px] font-mono text-slate-400">{asset.metadata.pn}</div>
                          </td>
                          <td className="p-5 font-bold text-slate-700 dark:text-slate-300 uppercase">{asset.metadata.cliente_final || '-'}</td>
                          <td className="p-5">
                            <span className={`font-bold text-[11px] ${isOverdue ? 'text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded' : 'text-slate-600 dark:text-slate-400'}`}>
                              {(asset.metadata as any).fecha_devolucion || 'Sin fecha'}
                            </span>
                          </td>
                          <td className="p-5 font-mono text-slate-600 dark:text-slate-400">{daysLoaned} d</td>
                          <td className="p-5 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                            ${costoAcumulado.toFixed(2)}
                            {costoDia > 0 && <span className="text-[9px] text-slate-400 ml-1 block font-normal">(${costoDia}/d)</span>}
                          </td>
                          <td className="p-5 text-center"><StatusBadge status={asset.current_status} /></td>
                        </tr>
                      );
                    })}
                    {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').length === 0 && (
                      <tr><td colSpan={7} className="p-16 text-center text-slate-300 dark:text-slate-600 uppercase font-black text-xs italic tracking-widest">No hay préstamos activos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-fadeIn">
          <div className="bg-slate-900 dark:bg-slate-950 p-6 md:p-8 text-white">
            <button onClick={() => setManagingReturnAsset(null)} className="text-[10px] uppercase font-black text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors tracking-widest">
              <ArrowLeft size={16}/> Volver a la lista
            </button>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Gestionar Retorno: {managingReturnAsset.metadata.pn}</h2>
            <p className="text-xs text-slate-300 font-medium">{managingReturnAsset.metadata.description}</p>
          </div>
          <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <div className="space-y-8">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-4 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={returnRequestedByProvider} 
                    onChange={(e) => setReturnRequestedByProvider(e.target.checked)} 
                    className="w-6 h-6 text-slate-900 rounded border-2 border-slate-300 focus:ring-0 transition-all cursor-pointer"
                  />
                  <div>
                    <span className="block text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide group-hover:text-blue-700 transition-colors">Solicitado por Proveedor</span>
                    <span className="text-[10px] text-slate-400 font-medium">Marque si el proveedor ha iniciado el proceso de RMA</span>
                  </div>
                </label>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Ubicación Física del Repuesto</label>
                <input 
                  type="text" 
                  value={returnLocation} 
                  onChange={(e) => setReturnLocation(e.target.value)} 
                  placeholder="Ej. Estante A-4, Bodega Retornos" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-slate-800 outline-none transition-all"
                />
              </div>
              <div className="pt-6">
                <button onClick={handleSaveReturnManagement} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-3">
                  <Save size={18} /> Guardar Gestión
                </button>
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2">Documentación de Retorno</h4>
              
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                <input type="file" id="return-doc-upload" className="hidden" onChange={(e) => setReturnDocFile(e.target.files ? e.target.files[0] : null)} />
                <label htmlFor="return-doc-upload" className="cursor-pointer flex flex-col items-center gap-3 group">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <UploadCloud size={24} className="text-slate-500" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">{returnDocFile ? returnDocFile.name : 'Seleccionar Archivo'}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Click para examinar</span>
                  </div>
                </label>
                {returnDocFile && (
                  <button onClick={handleUploadReturnDoc} className="mt-4 px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg">
                    Adjuntar Ahora
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {(!managingReturnAsset.logistics.extra_docs || managingReturnAsset.logistics.extra_docs.length === 0) && (
                  <p className="text-center text-xs text-slate-400 italic py-4">Sin documentos adjuntos</p>
                )}
                {managingReturnAsset.logistics.extra_docs?.map((docItem) => (
                  <div key={docItem.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500 dark:text-slate-300"><FileText size={16}/></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{docItem.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{docItem.filename}</div>
                    </div>
                    <a href={docItem.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 p-2">
                      <Download size={14}/>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
ReturnsModule.displayName = 'ReturnsModule';
