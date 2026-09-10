import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { 
  Asset, 
  AssetStatus, 
  User, 
  AuditLogEntry, 
  AssetCondition,
  DigitalEgressItem,
  InventoryItem
} from '../../types';
import { AssetLifecycleService } from '../../services/AssetLifecycleService';
import { AssetLabelPDF } from '../AssetLabelPDF';
import { db } from '../../firebase';
import { doc, writeBatch, setDoc } from 'firebase/firestore';
import { 
  Truck, 
  Layers, 
  ArrowRight, 
  PackageCheck, 
  CheckSquare, 
  Search, 
  FileText, 
  Database, 
  Plus, 
  Eye, 
  Edit3, 
  History, 
  User as UserIcon, 
  ChevronDown, 
  X, 
  ScanLine, 
  Loader2, 
  QrCode 
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { generateUUID } from '../../utils/helpers';

const INITIAL_INVENTORY_DATA = [
  { sku: "5796592-60", desc: "ORPG-60 PWA", qty: 1, cost: 5233.06 },
  { sku: "5427495-2", desc: "High voltage tank assy, GT 16/64", qty: 1, cost: 13887.20 },
  { sku: "5221081-3", desc: "PWA BIF3V", qty: 1, cost: 421.40 },
  { sku: "2392765-2", desc: "Assy Cable, T-Station/L-Stat to Inverter", qty: 1, cost: 110.00 },
  { sku: "5322960", desc: "DRIVE RACK LUBRICATION ASSY", qty: 1, cost: 35.00 },
  { sku: "5225883", desc: "COLLECTION CONTAINER OIL", qty: 1, cost: 35.00 },
  { sku: "5347313-10", desc: "Upper cover", qty: 1, cost: 150.00 },
  { sku: "5391585", desc: "Oil Collector CT Tube", qty: 1, cost: 35.00 },
  { sku: "5144605-2", desc: "TABLE RAIL KIT", qty: 1, cost: 450.00 },
  { sku: "2354907-2", desc: "FRONT COVER BRACKET RIGHT", qty: 1, cost: 35.00 },
  { sku: "2354907", desc: "BRACKET FRONT COVER LEFT", qty: 1, cost: 35.00 },
  { sku: "5183861-2", desc: "Front Display Overlay", qty: 1, cost: 35.00 },
  { sku: "5411700-2", desc: "ASSY TUBE LEAD COVER", qty: 1, cost: 150.00 },
  { sku: "2275688-2", desc: "ASSY, PEDAL, RH, WITH CABLE, EXTENDED", qty: 1, cost: 250.00 },
  { sku: "5729700-11", desc: "Collimator assy, 0.8mm", qty: 1, cost: 3500.00 },
  { sku: "5434444", desc: "KIT, 0.625MM COUPLER, REAR OIL", qty: 1, cost: 200.00 },
  { sku: "5128581-2", desc: "Side cover left lower", qty: 1, cost: 150.00 },
  { sku: "5329887", desc: "KNOB ASSY SCENIC", qty: 1, cost: 35.00 },
  { sku: "2223847", desc: "FUSE. 2A 500V", qty: 1, cost: 5.00 }
];

const SearchableSelect = ({ options, value, onChange, placeholder }: { 
    options: { value: string; label: string; subLabel?: string }[], 
    value: string | null, 
    onChange: (val: string) => void, 
    placeholder: string 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase()) || 
        opt.value.toLowerCase().includes(search.toLowerCase()) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm bg-white dark:bg-slate-800 cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-slate-400 hover:border-slate-400 transition-colors"
            >
                <span className={selectedOption ? "text-slate-900 dark:text-slate-100 font-medium" : "text-slate-500"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className="text-slate-400"/>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2">
                            <Search size={14} className="text-slate-400"/>
                            <input 
                                autoFocus
                                type="text"
                                className="w-full bg-transparent outline-none text-xs dark:text-slate-200 placeholder:text-slate-400"
                                placeholder="Filtrar opciones..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    {filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">No se encontraron resultados</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-none"
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-slate-400">{opt.subLabel}</div>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export interface WarehouseModuleProps {
  assets: Asset[];
  initialInventorySearch?: string;
  logs: AuditLogEntry[];
  currentUser: User | null;
  canEditWarehouse: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  showError: (titleOrMsg: string, msg?: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;
  onOpenDigitalEgress: (origin: 'REPUESTOS' | 'BODEGA', client: string, items: DigitalEgressItem[]) => void;
}

export const WarehouseModule: React.FC<WarehouseModuleProps> = memo(({
  assets,
  initialInventorySearch,
  logs,
  currentUser,
  canEditWarehouse,
  showToast,
  showError,
  showConfirm,
  onOpenDigitalEgress
}) => {
  const [warehouseSubTab, setWarehouseSubTab] = useState<'ENTRY' | 'INVENTORY' | 'MOVEMENTS'>('INVENTORY');
  const [receivingAsset, setReceivingAsset] = useState<Asset | null>(null);
  const [viewingAssetsItem, setViewingAssetsItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchData, setDispatchData] = useState({ quantity: 1, reason: '', destination: '', employee: '' });
  const [importing, setImporting] = useState(false);
  const [inventorySearch, setInventorySearch] = useState(initialInventorySearch || '');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);

  useEffect(() => {
    if (initialInventorySearch) {
      setInventorySearch(initialInventorySearch);
      setWarehouseSubTab('INVENTORY');
    }
  }, [initialInventorySearch]);

  // Computes inventory aggregated by P/N
  const inventoryStats = useMemo(() => {
    return assets.reduce<Record<string, InventoryItem>>((acc, asset) => {
      const pn = asset.metadata.pn;
      if (!acc[pn]) {
        acc[pn] = {
          pn,
          description: asset.metadata.description,
          category: asset.metadata.equipo_destino || 'General',
          stock: 0,
          cost: asset.metadata.cost || 0,
          assets: []
        };
      }
      if (asset.current_status === AssetStatus.RECEIVED_WH || asset.current_status === AssetStatus.QUALITY_CHECK) {
        acc[pn].stock += (asset.metadata.cantidad || 1);
      }
      acc[pn].assets.push(asset);
      return acc;
    }, {});
  }, [assets]);

  const inventoryList: InventoryItem[] = useMemo(() => {
    return (Object.values(inventoryStats) as InventoryItem[])
      .filter(i => (i.pn.toLowerCase().includes(inventorySearch.toLowerCase()) || i.description.toLowerCase().includes(inventorySearch.toLowerCase())));
  }, [inventoryStats, inventorySearch]);

  const availableInventoryList = useMemo(() => {
    return inventoryList.filter(i => i.stock > 0);
  }, [inventoryList]);

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !currentUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const newDesc = formData.get('description') as string;
    const newCost = Number(formData.get('cost'));
    const newStock = Number(formData.get('stock'));
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      editingItem.assets.forEach(asset => {
        const updatedAsset = { ...asset, metadata: { ...asset.metadata, description: newDesc, cost: newCost } };
        batch.set(doc(db, "assets", asset.id), updatedAsset);
      });
      const activeAssets = editingItem.assets.filter(a => a.current_status === AssetStatus.RECEIVED_WH || a.current_status === AssetStatus.QUALITY_CHECK);
      const diff = newStock - activeAssets.length;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const newId = generateUUID();
          const newAsset: Asset = {
            id: newId, current_status: AssetStatus.RECEIVED_WH, lifecycle_lock: false,
            metadata: { ...editingItem.assets[0].metadata, description: newDesc, cost: newCost, serial_ge: `ADJ-${Date.now()}-${i}`, cantidad: 1, fecha_solicitud: timestamp },
            logistics: { documents: {}, extra_docs: [], tracking_number: 'MANUAL_ADJ' },
            warehouse: { aisle: 'ADJUSTMENT', bin: 'MANUAL', qr_hash: `ADJ-${editingItem.pn}` }
          };
          batch.set(doc(db, "assets", newId), newAsset);
        }
      } else if (diff < 0) {
        activeAssets.slice(0, Math.abs(diff)).forEach(asset => {
          const result = AssetLifecycleService.transitionStatus(asset, AssetStatus.DISPATCHED, currentUser);
          batch.set(doc(db, "assets", result.updatedAsset.id), result.updatedAsset);
        });
      }
      await batch.commit();
      setEditingItem(null);
      showToast('Ficha técnica actualizada con éxito.', 'success');
    } catch (err: any) { showError(err.message); }
  };

  const handleConfirmReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingAsset || !currentUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      let updatedAsset = AssetLifecycleService.updateField(
        receivingAsset, 'warehouse',
        { aisle: formData.get('aisle'), bin: formData.get('bin') },
        currentUser
      ).updatedAsset;

      let result;
      try {
        result = AssetLifecycleService.transitionStatus(updatedAsset, AssetStatus.RECEIVED_WH, currentUser);
      } catch (transitionErr: any) {
        if (transitionErr.message?.includes('Tracking') || transitionErr.message?.includes('tracking')) {
          const now = new Date().toISOString();
          const auditEntry = {
            id: generateUUID(),
            asset_id: updatedAsset.id,
            timestamp: now,
            action: 'STATUS_TRANSITION',
            user_name: currentUser.name,
            user_role: currentUser.role,
            details: `Estado: ${updatedAsset.current_status} → ${AssetStatus.RECEIVED_WH} (sin tracking requerido)`,
          };
          updatedAsset = { ...updatedAsset, current_status: AssetStatus.RECEIVED_WH };
          const batch = writeBatch(db);
          batch.set(doc(db, "assets", updatedAsset.id), updatedAsset);
          batch.set(doc(db, "audit_log", auditEntry.id), auditEntry);
          await batch.commit();
          setReceivingAsset(null);
          showToast('Activo ingresado a bodega correctamente.', 'success');
          return;
        }
        throw transitionErr;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, "assets", result.updatedAsset.id), result.updatedAsset);
      batch.set(doc(db, "audit_log", result.auditLog.id), result.auditLog);
      await batch.commit();
      setReceivingAsset(null);
      showToast('Activo ingresado a bodega correctamente.', 'success');
    } catch (err: any) { showError(err.message); }
  };

  const handleOpenDispatchModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryItem) return;
    setShowDispatchModal(true);
    setDispatchData(prev => ({ ...prev, quantity: 1 }));
  };

  const handleExecuteDispatch = async () => {
    if (!selectedInventoryItem || !currentUser) return;
    const itemData = inventoryStats[selectedInventoryItem];
    if (!itemData || dispatchData.quantity > itemData.stock) return;
    try {
      const batch = writeBatch(db);
      let remaining = dispatchData.quantity;
      const available = itemData.assets.filter(a => a.current_status === AssetStatus.RECEIVED_WH || a.current_status === AssetStatus.QUALITY_CHECK);
      for (const asset of available) {
        if (remaining <= 0) break;
        const assetQty = asset.metadata.cantidad || 1;
        if (assetQty <= remaining) {
          let updated = AssetLifecycleService.updateField(asset, 'warehouse', { responsable_egreso: dispatchData.employee, destino_final: dispatchData.destination, motivo_salida: dispatchData.reason }, currentUser).updatedAsset;
          const res = AssetLifecycleService.transitionStatus(updated, AssetStatus.DISPATCHED, currentUser);
          batch.set(doc(db, "assets", res.updatedAsset.id), res.updatedAsset);
          remaining -= assetQty;
        } else {
          batch.set(doc(db, "assets", asset.id), { ...asset, metadata: { ...asset.metadata, cantidad: assetQty - remaining } });
          const newDispatchId = generateUUID();
          const dispatched: Asset = { ...asset, id: newDispatchId, current_status: AssetStatus.RECEIVED_WH, metadata: { ...asset.metadata, cantidad: remaining, serial_ge: `${asset.metadata.serial_ge}-SPLIT` }, warehouse: { ...asset.warehouse, responsable_egreso: dispatchData.employee, destino_final: dispatchData.destination, motivo_salida: dispatchData.reason } };
          const res = AssetLifecycleService.transitionStatus(dispatched, AssetStatus.DISPATCHED, currentUser);
          batch.set(doc(db, "assets", res.updatedAsset.id), res.updatedAsset);
          remaining = 0;
        }
      }
      await batch.commit();
      setShowDispatchModal(false);
      showToast('Salida registrada con éxito.', 'success');
    } catch (err: any) { showError(err.message); }
  };

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const pn = formData.get('pn');
    const stock = Number(formData.get('stock'));
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      for(let i=0; i < stock; i++) {
        const id = generateUUID();
        const newAsset: Asset = {
          id, current_status: AssetStatus.RECEIVED_WH, lifecycle_lock: false,
          metadata: { workflow_id: 'MANUAL', provider: 'GENERAL', cliente_final: 'STOCK', equipo_destino: 'BODEGA', condicion: AssetCondition.PURCHASE, numero_orden_ge: 'STOCK_INIT', fecha_solicitud: timestamp, pn: String(pn), description: String(formData.get('description')), cantidad: 1, cost: Number(formData.get('cost')), serial_ge: `GEN-${Date.now()}-${i}` },
          logistics: { documents: {}, extra_docs: [], tracking_number: 'MANUAL' },
          warehouse: { aisle: 'GEN', bin: '01', qr_hash: `MANUAL-${pn}` }
        };
        batch.set(doc(db, "assets", id), newAsset);
      }
      await batch.commit();
      setShowAddProductModal(false);
      showToast('Activo registrado con éxito.', 'success');
    } catch (err: any) { showError(err.message); }
  };

  const handleImportInitialInventory = async () => {
    if (!currentUser) return;
    const confirmed = await showConfirm("¿Cargar inventario inicial? Esta operación no puede deshacerse.");
    if (!confirmed) return;
    setImporting(true);
    try {
      const existingPNs = new Set(assets.map(a => a.metadata.pn));
      for (const item of INITIAL_INVENTORY_DATA) {
        if (existingPNs.has(item.sku)) continue;
        const id = generateUUID();
        const newAsset: Asset = {
          id, current_status: AssetStatus.RECEIVED_WH, lifecycle_lock: false,
          metadata: { workflow_id: 'IMPORT', provider: 'INITIAL', cliente_final: 'STOCK', equipo_destino: 'BODEGA', condicion: AssetCondition.PURCHASE, numero_orden_ge: 'INIT-2025', fecha_solicitud: new Date().toISOString(), pn: item.sku, description: item.desc, cantidad: item.qty, cost: item.cost, serial_ge: `INIT-${Date.now()}` },
          logistics: { documents: {}, extra_docs: [], tracking_number: 'INIT', importacion_procesada: true },
          warehouse: { aisle: 'BODEGA', bin: 'GENERAL', qr_hash: `INIT-${item.sku}` }
        };
        await setDoc(doc(db, "assets", id), newAsset);
      }
      showToast('Inventario inicial cargado correctamente.', 'success');
    } catch (err: any) { showError(err.message); } finally { setImporting(false); }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Subtab Nav ── */}
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
        <button onClick={() => setWarehouseSubTab('ENTRY')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'ENTRY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <Truck size={18} /> <span>Recepción</span>
          {assets.filter(a => a.current_status === AssetStatus.CUSTOMS).length > 0 && (
            <span className="bg-white text-slate-900 w-5 h-5 flex items-center justify-center rounded-full font-black animate-pulse shadow-sm">
              {assets.filter(a => a.current_status === AssetStatus.CUSTOMS).length}
            </span>
          )}
        </button>
        <button onClick={() => setWarehouseSubTab('INVENTORY')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'INVENTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <Layers size={18} /> <span>Inventario</span>
        </button>
        <button onClick={() => setWarehouseSubTab('MOVEMENTS')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'MOVEMENTS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <ArrowRight size={18} /> <span>Salidas</span>
        </button>
      </div>

      {/* ── SUBTAB RECEPCIÓN ── */}
      {warehouseSubTab === 'ENTRY' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-800 px-8 py-6 text-white">
            <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
              <PackageCheck size={24}/> Recepción de Mercadería
            </h3>
            <p className="text-slate-300 text-[10px] uppercase font-bold mt-1 tracking-widest opacity-80">Órdenes con Importación Cerrada listas para ingreso</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase tracking-widest">
                <tr>
                  <th className="p-5">P/N</th>
                  <th className="p-5">Descripción Técnica</th>
                  <th className="p-5">Control de Orden</th>
                  <th className="p-5">Condición</th>
                  <th className="p-5 text-center">Cant.</th>
                  <th className="p-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {assets.filter(a => a.current_status === AssetStatus.CUSTOMS).map(asset => {
                  const condicion = asset.metadata.condicion ?? '';
                  const condBadge = (() => {
                    const c = condicion.toLowerCase();
                    if (c.includes('warranty') || c.includes('garantia') || c.includes('garantía'))
                      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
                    if (c.includes('service') || c.includes('contrato') || c.includes('servicio'))
                      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
                    if (c.includes('loan') || c.includes('prestamo') || c.includes('préstamo'))
                      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
                    if (c.includes('purchase') || c.includes('compra'))
                      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
                    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
                  })();
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="p-5 font-black text-slate-800 dark:text-slate-200 font-mono uppercase tracking-tighter">{asset.metadata.pn}</td>
                      <td className="p-5 text-slate-500 dark:text-slate-400 font-bold max-w-xs truncate">{asset.metadata.description}</td>
                      <td className="p-5 font-black text-[10px] uppercase text-slate-400 tracking-widest">
                        <div className="text-slate-800 dark:text-slate-300">{asset.metadata.numero_orden_ge}</div>
                        <div className="mt-1">WF: {asset.metadata.workflow_id}</div>
                      </td>
                      <td className="p-5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${condBadge}`}>
                          {condicion || '-'}
                        </span>
                      </td>
                      <td className="p-5 text-center font-black text-sm text-amber-600">{asset.metadata.cantidad}</td>
                      <td className="p-5 text-center">
                        {canEditWarehouse && (
                          <button onClick={() => setReceivingAsset(asset)} className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-6 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 mx-auto border border-slate-200 dark:border-slate-600">
                            <CheckSquare size={16}/> Ingresar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {assets.filter(a => a.current_status === AssetStatus.CUSTOMS).length === 0 && (
                  <tr><td colSpan={6} className="p-16 text-center text-slate-300 uppercase font-black text-xs italic tracking-widest">Bandeja de entrada vacía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBTAB INVENTARIO ── */}
      {warehouseSubTab === 'INVENTORY' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-6">
            <div className="relative w-full md:max-w-md group">
              <Search className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-slate-800 transition-colors" size={20} />
              <input type="text" placeholder="Buscar por sku o descripción..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} className="w-full pl-12 pr-6 py-3.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-slate-800 focus:ring-0 outline-none font-bold text-sm bg-slate-50 dark:bg-slate-900 dark:text-white"/>
            </div>
            <div className="flex w-full md:w-auto gap-4">
              <button 
                onClick={() => onOpenDigitalEgress('BODEGA', '', [])}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-md active:scale-95"
                title="Crear un Egreso Digital oficial seleccionando repuestos o inventario"
              >
                <FileText size={18}/> Egreso Digital
              </button>
              {canEditWarehouse && (
                <button onClick={handleImportInitialInventory} disabled={importing} className={`flex-1 bg-slate-900 dark:bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md active:scale-95 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {importing ? <Loader2 size={18} className="animate-spin"/> : <Database size={18}/>} Importar PDF
                </button>
              )}
              {canEditWarehouse && (
                <button onClick={() => setShowAddProductModal(true)} className="flex-1 bg-white border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-700 dark:text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm active:scale-95">
                  <Plus size={18}/> Nuevo Item
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-5">sku / part number</th>
                    <th className="p-5">especificación técnica</th>
                    <th className="p-5">condición</th>
                    <th className="p-5 text-right">costo prom.</th>
                    <th className="p-5 text-center">stock real</th>
                    <th className="p-5 text-center">acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {inventoryList.map(item => {
                    const condiciones = [...new Set(item.assets.map(a => a.metadata.condicion).filter(Boolean))];
                    const condColor = (c: string) => {
                      const l = c.toLowerCase();
                      if (l.includes('warranty') || l.includes('garantia') || l.includes('garantía'))
                        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
                      if (l.includes('service') || l.includes('contrato') || l.includes('servicio'))
                        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
                      if (l.includes('loan') || l.includes('prestamo') || l.includes('préstamo'))
                        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
                      if (l.includes('purchase') || l.includes('compra'))
                        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
                      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
                    };
                    return (
                      <tr key={item.pn} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group">
                        <td className="p-5 font-black text-slate-800 dark:text-slate-200 font-mono uppercase tracking-tighter text-sm">{item.pn}</td>
                        <td className="p-5">
                          <div className="font-bold text-slate-600 dark:text-slate-300">{item.description}</div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-700 inline-block px-2 py-0.5 rounded-md mt-1.5">{item.category}</div>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-wrap gap-1.5">
                            {condiciones.length === 0
                              ? <span className="text-slate-300 italic text-[10px]">-</span>
                              : condiciones.map(c => (
                                <span key={c} className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${condColor(c)}`}>
                                  {c}
                                </span>
                              ))
                            }
                          </div>
                        </td>
                        <td className="p-5 text-right font-black font-mono text-slate-400">${item.cost.toFixed(2)}</td>
                        <td className="p-5 text-center">
                          <span className={`px-4 py-1.5 rounded-full font-black text-xs shadow-sm ${item.stock > 0 ? 'bg-emerald-600 text-white' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                            {item.stock}
                          </span>
                        </td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => {
                                const reqAsset = item.assets?.find(a => {
                                  const c = a.metadata?.cliente_final?.trim();
                                  return c && c.toUpperCase() !== 'STOCK';
                                });
                                const destClient = reqAsset ? reqAsset.metadata.cliente_final.trim() : (item.assets?.find(a => a.warehouse?.destino_final)?.warehouse?.destino_final || '');
                                onOpenDigitalEgress('BODEGA', destClient, [{
                                  codigo: item.pn,
                                  cantidad: 1,
                                  descripcion: item.description,
                                  serial_number: ''
                                }]);
                              }} 
                              className="p-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm active:scale-95" 
                              title="Generar Egreso Digital (PDF)"
                            >
                              <FileText size={18} />
                            </button>
                            <button onClick={() => setViewingAssetsItem(item)} className="p-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-950 hover:text-white transition-all shadow-sm active:scale-95" title="Listado Detallado">
                              <Eye size={18} />
                            </button>
                            {canEditWarehouse && (
                              <button onClick={() => setEditingItem(item)} className="p-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-950 hover:text-white transition-all shadow-sm active:scale-95" title="Ajustes Técnicos">
                                <Edit3 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBTAB SALIDAS / MOVIMIENTOS ── */}
      {warehouseSubTab === 'MOVEMENTS' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-4xl mx-auto">
            <h3 className="font-black text-slate-800 dark:text-slate-200 mb-8 flex items-center gap-3 uppercase tracking-tighter text-xl">
              <div className="bg-slate-900 p-2 rounded-lg"><ArrowRight size={24} className="text-white"/></div> Registro de Egresos
            </h3>
            <form onSubmit={handleOpenDispatchModal} className="space-y-8">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Selección de Producto en Stock</label>
                <SearchableSelect
                  options={availableInventoryList.map(i => ({ 
                    value: i.pn, label: `${i.pn} | ${i.description}`, subLabel: `Unidades físicas: ${i.stock}`
                  }))}
                  value={selectedInventoryItem} onChange={setSelectedInventoryItem}
                  placeholder="Busque por código o nombre del producto..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    if (selectedInventoryItem) {
                      const found = availableInventoryList.find(i => i.pn === selectedInventoryItem);
                      const reqAsset = found?.assets?.find(a => {
                        const c = a.metadata?.cliente_final?.trim();
                        return c && c.toUpperCase() !== 'STOCK';
                      });
                      const destClient = reqAsset ? reqAsset.metadata.cliente_final.trim() : (found?.assets?.find(a => a.warehouse?.destino_final)?.warehouse?.destino_final || '');
                      onOpenDigitalEgress('BODEGA', destClient, [{
                        codigo: selectedInventoryItem,
                        cantidad: 1,
                        descripcion: found ? found.description : '',
                        serial_number: ''
                      }]);
                    } else {
                      onOpenDigitalEgress('BODEGA', '', []);
                    }
                  }}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95"
                >
                  <FileText size={18}/> Egreso Digital (PDF)
                </button>
                <button type="submit" disabled={!selectedInventoryItem} className="bg-slate-900 dark:bg-blue-600 text-white px-12 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 disabled:opacity-30 transition-all shadow-lg flex items-center gap-3 active:scale-95">
                  Procesar Salida <ArrowRight size={20}/>
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-900 dark:bg-slate-950 px-8 py-6 text-white">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-3 text-sm">
                <History size={20} className="text-slate-400"/> Historial de Despachos Recientes
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest border-b dark:border-slate-700">
                  <tr><th className="p-5">timestamp</th><th className="p-5">ítem / especificación</th><th className="p-5 text-center">cant.</th><th className="p-5">trazabilidad destino</th><th className="p-5">responsable</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {logs.filter(l => l.action === 'STATUS_CHANGE' && l.new_value?.current_status === AssetStatus.DISPATCHED).slice(0, 20).map(log => {
                    const asset = assets.find(a => a.id === log.asset_id);
                    if (!asset) return null;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="p-5 font-mono text-slate-400 font-bold">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-5"><div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter text-sm">{asset.metadata.pn}</div><div className="text-[10px] text-slate-400 font-bold max-w-[250px] truncate uppercase tracking-widest mt-1">{asset.metadata.description}</div></td>
                        <td className="p-5 text-center"><span className="bg-slate-800 text-white px-3 py-1 rounded-full font-black text-xs shadow-sm">{asset.metadata.cantidad || 1}</span></td>
                        <td className="p-5"><div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{asset.warehouse.destino_final || '-'}</div><div className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-1">MOTIVO: {asset.warehouse.motivo_salida || '-'}</div></td>
                        <td className="p-5"><div className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest"><UserIcon size={14} className="text-slate-300"/> {asset.warehouse.responsable_egreso || '-'}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RECEPCIÓN EN BODEGA ── */}
      {receivingAsset && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-reception-title" className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-emerald-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="modal-reception-title" className="font-black uppercase tracking-widest flex items-center gap-2 text-lg">
                    <PackageCheck size={22}/> Ingresar a Bodega
                  </h3>
                  <p className="text-emerald-100 text-[10px] uppercase font-bold mt-1 tracking-widest">Asignar ubicación física</p>
                </div>
                <button onClick={() => setReceivingAsset(null)} aria-label="Cerrar" className="bg-emerald-700 hover:bg-emerald-800 p-2 rounded-lg transition-colors">
                  <X size={20}/>
                </button>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="font-black text-slate-800 dark:text-slate-200 font-mono uppercase tracking-tight">{receivingAsset.metadata.pn}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{receivingAsset.metadata.description}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase">{receivingAsset.metadata.numero_orden_ge}</span>
                <span className="text-[10px] font-black text-amber-600">Cant: {receivingAsset.metadata.cantidad}</span>
              </div>
            </div>
            <form onSubmit={handleConfirmReception} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Pasillo / Zona</label>
                <input type="text" name="aisle" required placeholder="Ej. A-3, ZONA-CRITICA"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-3.5 text-sm font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none dark:bg-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Bin / Posición</label>
                <input type="text" name="bin" required placeholder="Ej. B-12, ESTANTE-4"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-3.5 text-sm font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none dark:bg-slate-700 dark:text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setReceivingAsset(null)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-colors shadow-md">
                  <CheckSquare size={16}/> Confirmar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DESPACHO / SALIDA ── */}
      {showDispatchModal && selectedInventoryItem && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-label="Tarjeta de Egreso" className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
            <div className="p-8 md:p-10 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 p-3 rounded-2xl shadow-xl text-white"><ScanLine size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter leading-none">Tarjeta de Egreso</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Disponibilidad Actual: <span className="text-blue-600 dark:text-blue-400">{inventoryStats[selectedInventoryItem]?.stock || 0} UNI</span></p>
                  </div>
                </div>
                <button onClick={() => setShowDispatchModal(false)} aria-label="Cerrar modal" className="text-slate-300 hover:text-red-500 transition-colors bg-slate-50 dark:bg-slate-700 p-2 rounded-xl"><X size={28}/></button>
              </div>

              <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-1.5 flex mb-10">
                <div className="flex-1 text-center py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Auditoría IN</div>
                <div className="flex-1 text-center py-3 text-[10px] uppercase font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 shadow-sm rounded-lg tracking-widest">Validación OUT</div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cantidad</label><input type="number" min="1" max={inventoryStats[selectedInventoryItem]?.stock || 1} value={dispatchData.quantity} onChange={(e) => setDispatchData({...dispatchData, quantity: parseInt(e.target.value) || 0})} className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 text-xl font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900 transition-all text-center"/></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Motivo Legal</label><input list="dispatch-reasons" type="text" value={dispatchData.reason} onChange={(e) => setDispatchData({...dispatchData, reason: e.target.value})} className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900 transition-all" placeholder="Seleccione..."/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Destino Final</label><input type="text" value={dispatchData.destination} onChange={(e) => setDispatchData({...dispatchData, destination: e.target.value})} placeholder="Ej. Hospital Central" className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900 transition-all"/></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Custodio / Responsable</label><input type="text" value={dispatchData.employee} onChange={(e) => setDispatchData({...dispatchData, employee: e.target.value})} placeholder="Ej. Nombre del Técnico" className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900 transition-all"/></div>
                </div>
              </div>
              <datalist id="dispatch-reasons">
                <option value="Venta" /><option value="Consignación" /><option value="Garantía" /><option value="Demo" />
              </datalist>
            </div>
            
            <div className="p-8 md:p-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
              <button onClick={handleExecuteDispatch} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-4">
                Confirmar Salida <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR PRODUCTO MANUAL ── */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-label="Ajuste Manual de Stock" className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
            <div className="flex justify-between items-center p-8 border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter flex items-center gap-3"><Plus size={24} className="text-blue-600"/> Ajuste Manual de Stock</h3>
              <button onClick={() => setShowAddProductModal(false)} aria-label="Cerrar modal" className="text-slate-300 hover:text-red-500 transition-colors"><X size={28}/></button>
            </div>
            <form onSubmit={handleCreateNewProduct} className="p-8 md:p-10 space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">P/N (SKU)</label><input name="pn" type="text" required className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-black uppercase text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"/></div>
                <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cantidad</label><input name="stock" type="number" defaultValue="1" min="1" className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-center"/></div>
              </div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Descripción Técnica</label><input name="description" type="text" required className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"/></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Costo Unitario ($)</label><input name="cost" type="number" step="0.01" className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-right"/></div>
              <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-800 transition-all mt-6 shadow-xl">
                Registrar Activo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PRODUCTO / AJUSTE TÉCNICO ── */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
            <div className="flex justify-between items-center p-8 border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter flex items-center gap-3"><Edit3 size={24} className="text-slate-900 dark:text-slate-100"/> Ficha Técnica: {editingItem.pn}</h3>
              <button onClick={() => setEditingItem(null)} aria-label="Cerrar modal" className="text-slate-300 hover:text-red-500 transition-colors"><X size={28}/></button>
            </div>
            <form onSubmit={handleEditProduct} className="p-8 md:p-10 space-y-8 flex-1">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 text-[10px] font-black uppercase rounded-lg border border-amber-200 dark:border-amber-800 leading-normal tracking-wider shadow-sm">Este cambio es masivo y afectará a todos los activos vinculados a este Part Number.</div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Especificación</label><input name="description" type="text" defaultValue={editingItem.description} required className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-400 transition-all"/></div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Costo USD</label><input name="cost" type="number" step="0.01" defaultValue={editingItem.cost} className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-400 transition-all text-right"/></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Balance Stock</label><input name="stock" type="number" min="0" defaultValue={editingItem.stock} className="w-full border-none bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-400 transition-all text-center"/></div>
              </div>
              <div className="flex justify-end gap-4 mt-10 border-t dark:border-slate-700 pt-8">
                <button type="button" onClick={()=>setEditingItem(null)} className="px-10 py-4 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex-1">Anular</button>
                <button type="submit" className="px-10 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex-1">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AUDIT TRAIL / VISOR DE ASSETS DE ESTE P/N ── */}
      {viewingAssetsItem && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-label={`Audit Trail: ${viewingAssetsItem.pn}`} className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-3xl md:rounded-[40px] overflow-hidden animate-fadeIn flex flex-col md:max-h-[85vh] shadow-2xl">
            <div className="flex justify-between items-center p-8 border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter flex items-center gap-3"><QrCode size={28} className="text-blue-600"/> Audit Trail: {viewingAssetsItem.pn}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-none">{viewingAssetsItem.description}</p>
              </div>
              <button onClick={() => setViewingAssetsItem(null)} aria-label="Cerrar visor" className="text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700"><X size={28}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {viewingAssetsItem.assets.length === 0 ? (
                <div className="text-center text-slate-300 py-20 font-black uppercase text-xs tracking-widest italic">Sin unidades físicas vinculadas</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10">
                      <tr><th className="p-4">Serial Interno</th><th className="p-4">Estado</th><th className="p-4">Origen (OC)</th><th className="p-4 text-center">Etiqueta</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {viewingAssetsItem.assets.map(asset => (
                        <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <td className="p-4 font-black text-slate-800 dark:text-slate-200 font-mono tracking-tighter">{asset.metadata.serial_ge}</td>
                          <td className="p-4"><StatusBadge status={asset.current_status}/></td>
                          <td className="p-4 font-bold text-slate-400 uppercase text-[10px]">{asset.metadata.numero_orden_ge}</td>
                          <td className="p-4 text-center"><div className="scale-75 origin-center"><AssetLabelPDF asset={asset} /></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-8 border-t bg-slate-50 dark:bg-slate-900 dark:border-slate-700 flex justify-end">
              <button onClick={()=>setViewingAssetsItem(null)} className="w-full md:w-auto px-12 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl">Cerrar Visor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
WarehouseModule.displayName = 'WarehouseModule';
