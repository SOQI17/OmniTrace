import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  Asset,
  AssetStatus,
  ImportationCosts,
  ImportItem,
  User,
  AuditLogEntry,
  DigitalEgressItem
} from '../../types';
import { db } from '../../firebase';
import { collection, doc, writeBatch, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  MessageSquare,
  Layers,
  CheckSquare,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Truck,
  DollarSign,
  Download,
  FileText,
  History,
  Lock,
  CheckCircle,
  Save,
  Send,
  ShoppingCart,
  Plus,
  Trash2,
  X,
  ExternalLink,
  RotateCcw,
  Loader2,
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FilterSelect } from '../ui/FilterSelect';
import { StatusBadge } from '../ui/StatusBadge';
import { EditableField } from '../ui/EditableField';
import { generateUUID, sanitizeCell, sanitizeRow } from '../../utils/helpers';

interface LogisticsModuleProps {
  assets: Asset[];
  assetsByOrder: Record<string, Asset[]>;
  currentUser: User | null;
  canEditLogistics: boolean;
  canCloseImport: boolean;
  canExportExcel: boolean;
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  logs?: AuditLogEntry[];
  onNavigateToWarehouse?: () => void;
  onOpenDigitalEgress: (origin: 'REPUESTOS' | 'BODEGA', client: string, items: DigitalEgressItem[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showError: (msg: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;
}

// ─── LocalExpenseInput ────────────────────────────────────────────────────────
const LocalExpenseInput: React.FC<{ 
  label: string; 
  val: number; 
  onChange: (v: number) => void 
}> = ({ label, val, onChange }) => {
  const [display, setDisplay] = useState(val === 0 ? '' : String(val));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplay(val === 0 ? '' : String(val));
  }, [val]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const allInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-expense-field="true"]')
    );
    const currentIndex = allInputs.indexOf(inputRef.current!);
    const next = allInputs[currentIndex + 1];
    if (next) {
      next.focus();
      next.select();
    }
  };

  return (
    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-2 uppercase tracking-wide">{label}</label>
      <div className="flex items-center">
        <span className="text-xs text-slate-400 mr-1 font-bold">$</span>
        <input
          ref={inputRef}
          data-expense-field="true"
          type="number"
          step="0.01"
          value={display}
          placeholder="0"
          onChange={(e) => {
            setDisplay(e.target.value);
            onChange(Number(e.target.value) || 0);
          }}
          onBlur={() => {
            const num = Number(display);
            setDisplay(num === 0 ? '' : String(num));
          }}
          onKeyDown={handleKeyDown}
          className="w-24 text-right text-xs font-mono p-1 outline-none focus:bg-slate-100 dark:focus:bg-slate-700 rounded bg-transparent dark:text-white font-bold placeholder:text-slate-400"
        />
      </div>
    </div>
  );
};


const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700 text-xs">
    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{label}</span>
    <div className="font-bold text-slate-800 dark:text-slate-200 uppercase">{value || '-'}</div>
  </div>
);

export const LogisticsModule: React.FC<LogisticsModuleProps> = memo(({
  assets,
  assetsByOrder,
  currentUser,
  canEditLogistics,
  canCloseImport,
  canExportExcel,
  selectedAssetId,
  onSelectAsset,
  logs = [],
  onNavigateToWarehouse,
  onOpenDigitalEgress,
  showToast,
  showError,
  showConfirm
}) => {
  const setSelectedAssetId = (id: string | null) => onSelectAsset(id);
  const setActiveTab = (tab: string) => {
    if (tab === 'WAREHOUSE' && onNavigateToWarehouse) onNavigateToWarehouse();
  };
  const setWarehouseSubTab = (_tab: string) => {};

  const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId) || null, [assets, selectedAssetId]);

  
  // Comments por orden
  const [comments, setComments] = useState<Record<string, {id:string; text:string; user:string; ts:string}[]>>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, "order_comments"), (snap) => {
      const data: Record<string, any[]> = {};
      snap.docs.forEach(d => { data[d.id] = d.data().comments || []; });
      setComments(data);
    }, () => {});
    return () => unsub();
  }, [currentUser]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedAsset || !currentUser) return;
    try {
      const orderId = selectedAsset.metadata.numero_orden_ge || selectedAsset.id;
      const existing = comments[orderId] || [];
      const updated = [...existing, {
        id: generateUUID(),
        text: newComment.trim(),
        user: currentUser.name || currentUser.id,
        ts: new Date().toISOString()
      }];
      await setDoc(doc(db, "order_comments", orderId), { comments: updated });
      setNewComment('');
    } catch (e: any) {
      showError(e.message);
    }
  };

  const [logisticsSubTab, setLogisticsSubTab] = useState<'INITIAL' | 'FINAL'>('INITIAL');
  const [logisticsFilter, setLogisticsFilter] = useState<{ status: string; condicion: string; proveedor: string }>({ status: '', condicion: '', proveedor: '' });

  // Consolidación
  const [isSelectingConsolidation, setIsSelectingConsolidation] = useState(false);
  const [isConsolidationMode, setIsConsolidationMode] = useState(false);
  const [consolidationList, setConsolidationList] = useState<string[]>([]);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const [showConsolidationModal, setShowConsolidationModal] = useState(false);
  const [consolidationModalAssets, setConsolidationModalAssets] = useState<Asset[]>([]);
  const [consolidationModalSelected, setConsolidationModalSelected] = useState<string[]>([]);

  // Modal para cerrar importación masiva
  const [showCloseImportModal, setShowCloseImportModal] = useState(false);
  const [assetsToClose, setAssetsToClose] = useState<Asset[]>([]);
  const [selectedAssetsToClose, setSelectedAssetsToClose] = useState<string[]>([]);

  // Estados de cálculo de liquidación
  const [itemsState, setItemsState] = useState<ImportItem[]>([]);
  const [localExpenses, setLocalExpenses] = useState({
    manejo_carga: 0, costo_cc: 0, almacenaje: 0, asesoria_gestion_riesgo: 0, transporte_local: 0, agenciamiento_aduana: 0
  });
  const [aduanaValues, setAduanaValues] = useState({
    costo_fob: 0, flete: 0, seguro: 0
  });

  const totalCifGlobal = useMemo(() => aduanaValues.costo_fob + aduanaValues.flete + aduanaValues.seguro, [aduanaValues]);
  const totalLocal = useMemo(() => (Object.values(localExpenses) as number[]).reduce((acc, val) => Number(acc) + Number(val), 0), [localExpenses]);
  const proratedLocalPerItem = useMemo(() => itemsState.length > 0 ? (totalLocal / itemsState.length) : 0, [itemsState.length, totalLocal]);

  // Auto-guardado
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const populateItemsFromAsset = (baseAsset: Asset) => {
    let assetsToImport: Asset[] = [];

    if (isConsolidationMode && pendingSelection.length > 0) {
      assetsToImport = assets.filter(a => pendingSelection.includes(a.id));
    } else {
      const currentConsolidationId = baseAsset.logistics.consolidation_id;
      if (currentConsolidationId) {
        assetsToImport = assets.filter(a => a.logistics.consolidation_id === currentConsolidationId);
      } else if (baseAsset.metadata.numero_orden_ge && baseAsset.metadata.numero_orden_ge !== 'SIN_ORDEN') {
        assetsToImport = assets.filter(a => a.metadata.numero_orden_ge === baseAsset.metadata.numero_orden_ge);
      } else {
        assetsToImport = [baseAsset];
      }
    }

    setItemsState(assetsToImport.map(asset => ({
      id: generateUUID(), 
      no_factura: '', 
      item_number: asset.metadata.pn, 
      descripcion: asset.metadata.description, 
      cantidad: asset.metadata.cantidad || 1, 
      precio_uni: asset.metadata.cost || 0, 
      cif_unitario: asset.metadata.cost || 0, 
      aplica_arancel: false
    } as ImportItem)));
    
    if (!baseAsset.metadata.cost_breakdown) {
      setLocalExpenses({ manejo_carga: 0, costo_cc: 0, almacenaje: 0, asesoria_gestion_riesgo: 0, transporte_local: 0, agenciamiento_aduana: 0 });
      setAduanaValues({ costo_fob: 0, flete: 0, seguro: 0 });
    }
  };

  useEffect(() => {
    if (!selectedAsset) return;
    if (selectedAsset.metadata.cost_breakdown && selectedAsset.metadata.cost_breakdown.items.length > 0) {
      setItemsState(selectedAsset.metadata.cost_breakdown.items);
      const bd = selectedAsset.metadata.cost_breakdown;
      setLocalExpenses({
        manejo_carga: bd.manejo_carga || 0, costo_cc: bd.costo_cc || 0, almacenaje: bd.almacenaje || 0, asesoria_gestion_riesgo: bd.asesoria_gestion_riesgo || 0, transporte_local: bd.transporte_local || 0, agenciamiento_aduana: bd.agenciamiento_aduana || 0
      });
      setAduanaValues({
        costo_fob: (bd as any).costo_fob || 0,
        flete:     (bd as any).flete     || 0,
        seguro:    (bd as any).seguro    || 0,
      });
    } else {
      populateItemsFromAsset(selectedAsset);
    }
  }, [selectedAssetId]);

  const triggerAutoSave = (
    newLocalExpenses: typeof localExpenses,
    newAduanaValues: typeof aduanaValues
  ) => {
    if (!selectedAsset || !currentUser) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus('saving');
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const totalLocal_ = (Object.values(newLocalExpenses) as number[]).reduce((a, v) => a + Number(v), 0);
        const totalCif_   = newAduanaValues.costo_fob + newAduanaValues.flete + newAduanaValues.seguro;
        const existing    = selectedAsset.metadata.cost_breakdown || {};
        const updated     = {
          ...existing,
          ...newLocalExpenses,
          ...newAduanaValues,
          total_gastos_locales: totalLocal_,
          total_cif_global: totalCif_,
          items: itemsState,
        };

        let relatedAssets: Asset[] = [];
        if (isConsolidationMode && pendingSelection.length > 0) {
          relatedAssets = assets.filter(a => pendingSelection.includes(a.id));
        } else {
          relatedAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
        }

        const batch = writeBatch(db);
        relatedAssets.forEach(asset => {
          batch.set(doc(db, "assets", asset.id), {
            ...asset,
            metadata: { ...asset.metadata, cost_breakdown: updated }
          });
        });
        await batch.commit();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err: any) {
        setSaveStatus('error');
        showError(`Error al guardar: ${err.message}`);
      }
    }, 1200);
  };

  const addItemRow = () => {
    setItemsState(prev => [...prev, {
      id: generateUUID(), no_factura: '', item_number: '', descripcion: '', cantidad: 1, precio_uni: 0, cif_unitario: 0, aplica_arancel: false, arancel: undefined
    } as ImportItem]);
  };

  const removeItemRow = (id: string) => setItemsState(prev => prev.filter(item => item.id !== id));

  const handleItemChange = (id: string, field: keyof ImportItem | 'arancel', value: string | number | boolean | undefined) => {
    setItemsState(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updates: Partial<ImportItem & { arancel?: number }> = { [field]: value };
      if (field === 'precio_uni') {
        const newPrice = Number(value);
        if (item.cif_unitario === 0 || item.cif_unitario === item.precio_uni) updates.cif_unitario = newPrice;
      }
      return { ...item, ...updates };
    }));
  };

  const handleToggleSelection = (group: Asset[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelectingConsolidation) return;

    if (group.length === 1) {
      const assetId = group[0].id;
      setPendingSelection(prev => 
        prev.includes(assetId) 
          ? prev.filter(id => id !== assetId) 
          : [...prev, assetId]
      );
    } else {
      setConsolidationModalAssets(group);
      setConsolidationModalSelected(group.filter(a => pendingSelection.includes(a.id)).map(a => a.id));
      setShowConsolidationModal(true);
    }
  };

  const handleConfirmModalSelection = () => {
    const currentGroupIds = consolidationModalAssets.map(a => a.id);
    const otherSelections = pendingSelection.filter(id => !currentGroupIds.includes(id));
    const newSelection = [...otherSelections, ...consolidationModalSelected];
    setPendingSelection(newSelection);
    setShowConsolidationModal(false);
    
    if (newSelection.length > 0) {
      setIsConsolidationMode(true);
      setSelectedAssetId(newSelection[0]);
      setConsolidationList(newSelection.slice(1));
    }
  };

  const handleSidebarSelect = (id: string) => {
    setPendingSelection([]);
    setIsConsolidationMode(false);
    setIsSelectingConsolidation(false);
    setSelectedAssetId(id);
  };

  const handleGoToClosing = () => { 
    if (!selectedAsset) return; 
    if (isConsolidationMode || !selectedAsset.metadata.cost_breakdown?.items || selectedAsset.metadata.cost_breakdown.items.length === 0) { 
      populateItemsFromAsset(selectedAsset); 
    } 
    setLogisticsSubTab('FINAL'); 
  };

  const handleUpdateLogisticsInitial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !currentUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const batch = writeBatch(db);
    
    let targetAssets: Asset[] = [];
    if (isConsolidationMode && pendingSelection.length > 0) {
      targetAssets = assets.filter(a => pendingSelection.includes(a.id));
    } else {
      targetAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
    }

    targetAssets.forEach(asset => {
      const tracking = formData.get(`tracking_${asset.id}`) as string;
      const courier = formData.get(`courier_${asset.id}`) as string;
      
      if (asset) {
        let updated = { 
          ...asset, 
          logistics: { 
            ...asset.logistics, 
            tracking_number: tracking !== null ? tracking : asset.logistics.tracking_number, 
            courier: courier !== null ? courier : asset.logistics.courier 
          } 
        };
        
        if (updated.current_status === AssetStatus.DRAFT) updated.current_status = AssetStatus.ORDERED;
        if (updated.current_status === AssetStatus.ORDERED && updated.logistics.tracking_number) updated.current_status = AssetStatus.IN_TRANSIT;
        
        batch.set(doc(db, "assets", asset.id), updated);
      }
    });
    
    await batch.commit();
    showToast("Tracking actualizado correctamente.", 'success');
  };

  const handleInitiateCloseImport = () => {
    if (!selectedAsset) return;

    let relatedAssets: Asset[] = [];
    if (isConsolidationMode && pendingSelection.length > 0) {
      relatedAssets = assets.filter(a => pendingSelection.includes(a.id));
    } else {
      relatedAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
    }

    const closableAssets = relatedAssets.filter(a => 
      !a.logistics.importacion_procesada && 
      [AssetStatus.DRAFT, AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(a.current_status)
    );

    if (closableAssets.length > 1) {
      setAssetsToClose(closableAssets);
      setSelectedAssetsToClose(closableAssets.map(a => a.id)); 
      setShowCloseImportModal(true);
    } else if (closableAssets.length === 1) {
      handleConfirmCloseImport([closableAssets[0].id]);
    } else {
      showToast("No hay ítems pendientes para cerrar importación en esta orden.", 'info');
    }
  };

  const handleConfirmCloseImport = async (assetIdsToClose: string[]) => {
    if (!selectedAsset || !currentUser) return;

    const form = document.getElementById('final-logistics-form') as HTMLFormElement;
    const formData = form ? new FormData(form) : new FormData();

    const costBreakdown: ImportationCosts = { 
      fecha_llegada_almacen: formData.get('fecha_llegada_almacen') as string || '', 
      no_liquidacion: formData.get('no_liquidacion') as string || '', 
      no_dai: formData.get('no_dai') as string || '', 
      ...localExpenses, ...aduanaValues,
      total_cif_global: totalCifGlobal,
      total_gastos_locales: totalLocal, 
      items: itemsState, 
      facturas_proveedores: [] 
    };

    try {
      const batch = writeBatch(db);

      let relatedAssets: Asset[] = [];
      if (isConsolidationMode && pendingSelection.length > 0) {
        relatedAssets = assets.filter(a => pendingSelection.includes(a.id));
      } else {
        relatedAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
      }

      relatedAssets.forEach(asset => {
        const isClosingThisAsset = assetIdsToClose.includes(asset.id);
        const importacionProcesada = asset.logistics.importacion_procesada || isClosingThisAsset;
        let newStatus = asset.current_status;

        if (isClosingThisAsset) {
          newStatus = AssetStatus.CUSTOMS;
        } else if (importacionProcesada && [AssetStatus.DRAFT, AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(asset.current_status)) {
          newStatus = AssetStatus.CUSTOMS;
        }

        let updated = { 
          ...asset, 
          metadata: { ...asset.metadata, cost_breakdown: costBreakdown }, 
          logistics: { ...asset.logistics, importacion_procesada: importacionProcesada },
          current_status: newStatus
        };

        batch.set(doc(db, "assets", asset.id), updated);
      });

      await batch.commit();
      setShowCloseImportModal(false);

      showToast("Importación cerrada. Procede a recepción en bodega.", 'success');
      
      if (assetIdsToClose.includes(selectedAsset.id)) {
        setSelectedAssetId(null);
        setActiveTab('WAREHOUSE');
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleUpdateLogisticsFinal = async () => {
    if (!selectedAsset || !currentUser) return;
    
    const form = document.getElementById('final-logistics-form') as HTMLFormElement;
    const formData = form ? new FormData(form) : new FormData();
    
    const costBreakdown: ImportationCosts = { 
      fecha_llegada_almacen: formData.get('fecha_llegada_almacen') as string || '', 
      no_liquidacion: formData.get('no_liquidacion') as string || '', 
      no_dai: formData.get('no_dai') as string || '', 
      ...localExpenses, ...aduanaValues,
      total_cif_global: totalCifGlobal,
      total_gastos_locales: totalLocal, 
      items: itemsState, 
      facturas_proveedores: [] 
    };
    
    try {
      const batch = writeBatch(db);
      let relatedAssets: Asset[] = [];
      if (isConsolidationMode && pendingSelection.length > 0) {
        relatedAssets = assets.filter(a => pendingSelection.includes(a.id));
      } else {
        relatedAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
      }

      relatedAssets.forEach(asset => {
        let updated = { 
          ...asset, 
          metadata: { ...asset.metadata, cost_breakdown: costBreakdown }
        };
        batch.set(doc(db, "assets", asset.id), updated);
      });

      await batch.commit();
      showToast("Liquidación guardada correctamente.", 'success');
    } catch (err: any) {
      showError(err.message);
    }
  };

  const exportLiquidacion = async () => {
    if (!selectedAsset || itemsState.length === 0) return;
    const totalFobItems = itemsState.reduce((acc, it) => acc + (Number(it.cantidad)||0) * (Number(it.precio_uni)||0), 0);
    const cifFactor = totalCifGlobal > 0 && totalFobItems > 0 ? totalCifGlobal / totalFobItems : 1;

    const rows = itemsState.map((item, idx) => {
      const qty = Number(item.cantidad) || 0;
      const unitFob = Number(item.precio_uni) || 0;
      const unitCif = totalCifGlobal > 0 ? unitFob * cifFactor : (Number(item.cif_unitario) || unitFob);
      const totalCif = qty * unitCif;
      const arancelPct = item.aplica_arancel ? (Number(item.arancel) || 0) : 0;
      const daiUnit = unitCif * (arancelPct / 100);
      const daiTotal = totalCif * (arancelPct / 100);
      const localUnit = proratedLocalPerItem;
      const costTotalUnit = unitCif + daiUnit + localUnit;
      const costTotalLine = costTotalUnit * qty;

      return sanitizeRow({
        '#': idx + 1,
        'N° FACTURA': item.no_factura || '',
        'ITEM NUMBER': item.item_number || '',
        'DESCRIPCIÓN': item.descripcion || '',
        'CANTIDAD': qty,
        'PRECIO UNIT. FOB ($)': unitFob.toFixed(2),
        'TOTAL FOB ($)': (qty * unitFob).toFixed(2),
        'CIF UNITARIO ($)': unitCif.toFixed(4),
        'TOTAL CIF ($)': totalCif.toFixed(2),
        '% ARANCEL': arancelPct,
        'DAI UNITARIO ($)': daiUnit.toFixed(4),
        'DAI TOTAL ($)': daiTotal.toFixed(2),
        'GASTOS LOCALES UNIT. ($)': localUnit.toFixed(4),
        'COSTO TOTAL UNITARIO ($)': costTotalUnit.toFixed(4),
        'COSTO TOTAL LÍNEA ($)': costTotalLine.toFixed(2),
      });
    });

    const resumen = [
      { CONCEPTO: 'COSTO FOB', VALOR: aduanaValues.costo_fob },
      { CONCEPTO: 'FLETE DECLARADO', VALOR: aduanaValues.flete },
      { CONCEPTO: 'SEGURO', VALOR: aduanaValues.seguro },
      { CONCEPTO: 'TOTAL CIF GLOBAL', VALOR: totalCifGlobal },
      { CONCEPTO: '---', VALOR: '---' },
      { CONCEPTO: 'MANEJO CARGA', VALOR: localExpenses.manejo_carga },
      { CONCEPTO: 'COSTO CC', VALOR: localExpenses.costo_cc },
      { CONCEPTO: 'ALMACENAJE', VALOR: localExpenses.almacenaje },
      { CONCEPTO: 'ASESORÍA', VALOR: localExpenses.asesoria_gestion_riesgo },
      { CONCEPTO: 'TRANSPORTE', VALOR: localExpenses.transporte_local },
      { CONCEPTO: 'AGENCIAMIENTO', VALOR: localExpenses.agenciamiento_aduana },
      { CONCEPTO: 'TOTAL GASTOS LOCALES', VALOR: totalLocal },
    ].map(r => sanitizeRow(r));

    const wb = XLSX.utils.book_new();
    const wsItems = XLSX.utils.json_to_sheet(rows);
    const wsResumen = XLSX.utils.json_to_sheet(resumen);

    XLSX.utils.book_append_sheet(wb, wsItems, 'LIQUIDACIÓN');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'ADUANA Y GASTOS');
    XLSX.writeFile(wb, `LIQUIDACION_${selectedAsset.metadata.numero_orden_ge || selectedAsset.id.slice(0,8)}.xlsx`);

    if (currentUser) {
      addDoc(collection(db, 'audit_log'), {
        action: 'EXPORT_EXCEL_LIQUIDACION',
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: new Date().toISOString(),
        details: `Liquidación exportada para orden ${selectedAsset.metadata.numero_orden_ge}`
      }).catch(console.error);
    }
    showToast('Liquidación descargada en Excel.', 'success');
  };

  const handleManualReloadItems = async () => {
    if (!selectedAsset) return;
    const confirmed = await showConfirm("¿Recargar items desde la orden actual? Esto borrará los datos ingresados en la tabla.");
    if (confirmed) populateItemsFromAsset(selectedAsset);
  };

  const handleRecalculate = () => {
    if (!selectedAsset) return;
    const form = document.getElementById('final-logistics-form') as HTMLFormElement;
    if (form) {
      const fd = new FormData(form);
      const fob = parseFloat(fd.get('costo_fob') as string) || 0;
      const flete = parseFloat(fd.get('flete') as string) || 0;
      const seguro = parseFloat(fd.get('seguro') as string) || 0;
      setAduanaValues({ costo_fob: fob, flete, seguro });
    }
  };

  const relatedAssetsForClosing = useMemo(() => {
    if (!selectedAsset) return [];
    return isConsolidationMode && pendingSelection.length > 0
      ? assets.filter(a => pendingSelection.includes(a.id))
      : assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
  }, [selectedAsset, isConsolidationMode, pendingSelection, assets]);

  const hasOpenImports = useMemo(() => {
    return relatedAssetsForClosing.some(a => 
      !a.logistics.importacion_procesada && 
      [AssetStatus.DRAFT, AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(a.current_status)
    );
  }, [relatedAssetsForClosing]);

  return (
    <>
                      <div className="space-y-6">
                    
                    {!selectedAsset && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn">
                            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-widest text-xs"><Layers size={20} className="text-slate-600 dark:text-slate-400"/> Tablero de Órdenes</h3>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">Listado general de requerimientos en curso</p>
                                </div>
                                {canEditLogistics && (
                                    <div>
                                        {!isSelectingConsolidation ? (
                                            <button onClick={() => { setIsSelectingConsolidation(true); setPendingSelection([]); }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all">
                                                <Layers size={14}/> Consolidar Órdenes
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    {pendingSelection.length} seleccionados
                                                </span>
                                                <button onClick={() => { setIsSelectingConsolidation(false); setPendingSelection([]); }} className="text-[9px] font-black text-slate-500 hover:text-red-500 uppercase tracking-widest transition-colors">
                                                    Cancelar
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(pendingSelection.length > 0) {
                                                            setIsSelectingConsolidation(false);
                                                            setIsConsolidationMode(true);
                                                            setSelectedAssetId(pendingSelection[0]);
                                                            setConsolidationList(pendingSelection.slice(1));
                                                        } else {
                                                            showToast("Seleccione al menos 1 ítem para continuar.", 'info');
                                                        }
                                                    }}
                                                    disabled={pendingSelection.length === 0}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
                                                >
                                                    <CheckSquare size={14}/> Procesar Consolidación
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Filtros avanzados ── */}
                            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap gap-2 items-center">
                                {/* Filter: Estado */}
                                <FilterSelect
                                    value={logisticsFilter.status}
                                    onChange={v => setLogisticsFilter(f => ({...f, status: v}))}
                                    placeholder="Todos los estados"
                                    options={Object.values(AssetStatus).map(s => ({ value: s, label: s.replace(/_/g,' ') }))}
                                />
                                {/* Filter: Condición */}
                                <FilterSelect
                                    value={logisticsFilter.condicion}
                                    onChange={v => setLogisticsFilter(f => ({...f, condicion: v}))}
                                    placeholder="Todas las condiciones"
                                    options={([...new Set(assets.map(a => a.metadata.condicion).filter(Boolean))] as string[]).map(c => ({ value: c, label: c }))}
                                />
                                {/* Filter: Proveedor */}
                                <FilterSelect
                                    value={logisticsFilter.proveedor}
                                    onChange={v => setLogisticsFilter(f => ({...f, proveedor: v}))}
                                    placeholder="Todos los proveedores"
                                    options={([...new Set(assets.map(a => a.metadata.provider).filter(Boolean))] as string[]).sort().map(p => ({ value: p, label: p }))}
                                />
                                {(logisticsFilter.status || logisticsFilter.condicion || logisticsFilter.proveedor) && (
                                    <button onClick={() => setLogisticsFilter({ status: '', condicion: '', proveedor: '' })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                        <X size={11}/> Limpiar filtros
                                    </button>
                                )}
                            </div>


                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left min-w-[1000px]">
                                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest">
    <tr>
        <th className="p-4">Orden GE</th>
        <th className="p-4">No. Parte</th>
        <th className="p-4">Descripción</th>
        <th className="p-4">Proveedor</th>
        <th className="p-4 text-center">Items</th>
        <th className="p-4 text-center">Estado</th>
        <th className="p-4">Progreso</th>
        <th className="p-4">Cliente Final</th>
        {/* La casilla se queda aquí, al final */}
        <th className="p-4 text-center">SEL</th> 
        <th className="p-4 text-center">Egreso</th>
        <th className="p-4 w-10"></th>
    </tr>
</thead>
                                    {/* ... dentro de la sección activeTab === 'LOGISTICS' ... */}
<tbody className="divide-y divide-slate-100 dark:divide-slate-700">
    {(Object.entries(assetsByOrder) as [string, Asset[]][]).filter(([, group]) => {
        const main = group[0];
        if (logisticsFilter.status && !group.some(a => a.current_status === logisticsFilter.status)) return false;
        if (logisticsFilter.condicion && main.metadata.condicion !== logisticsFilter.condicion) return false;
        if (logisticsFilter.proveedor && main.metadata.provider !== logisticsFilter.proveedor) return false;
        return true;
    }).map(([orderId, group]) => { 
        if (orderId === 'SIN_ORDEN') return null; 
        const mainAsset = group[0]; 
        const isImportClosed = mainAsset.logistics.importacion_procesada; 
        
        let statusColor = "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"; 
        let statusText = "Borrador"; 
        let icon = <Clock size={14}/>; 
        
        if (mainAsset.current_status === AssetStatus.DRAFT) {
            statusColor = "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 animate-pulse";
            statusText = "Por Iniciar";
            icon = <AlertTriangle size={14} />;
        } else if (isImportClosed) { 
            statusColor = "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900"; 
            statusText = "Cerrada"; 
            icon = <CheckCircle size={14}/>; 
        } else { 
            statusColor = "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900"; 
            statusText = "En Proceso"; 
            icon = <RefreshCw size={14} className="animate-spin-slow"/>; 
        } 

        const allSelected = group.every(a => pendingSelection.includes(a.id));
        const someSelected = group.some(a => pendingSelection.includes(a.id));
        const isGroupSelected = someSelected;

        return (
            <tr 
                key={orderId} 
                className={`transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 group ${allSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : someSelected ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`} 
                onClick={() => !isSelectingConsolidation && handleSidebarSelect(mainAsset.id)}
            >
                <td className="p-4 font-black text-slate-800 dark:text-slate-200">{orderId}</td>
                <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">{mainAsset.metadata.pn}</td>
                <td className="p-4 text-slate-500 dark:text-slate-400 max-w-[150px] truncate">{mainAsset.metadata.description}</td>
                <td className="p-4 text-slate-500 dark:text-slate-400 uppercase font-bold">{mainAsset.metadata.provider}</td>
                <td className="p-4 text-center">
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-black text-[9px] uppercase">
                        {group.length} {group.length === 1 ? 'item' : 'items'}
                    </span>
                </td>
                <td className="p-4 text-center"><StatusBadge status={mainAsset.current_status} /></td>
                <td className="p-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-md w-fit text-[9px] font-black uppercase tracking-widest shadow-sm ${statusColor}`}>
                        {icon} {statusText}
                    </div>
                </td>
                <td className="p-4 font-black text-slate-700 dark:text-slate-300 uppercase italic tracking-tighter">
                    {mainAsset.metadata.cliente_final || 'STOCK'}
                </td>

                {/* CASILLA A LA DERECHA - Con lógica de clic mejorada */}
                <td className={`p-4 text-center ${!isSelectingConsolidation ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`} onClick={(e) => handleToggleSelection(group, e)}>
                    <div className={`mx-auto w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all duration-200 ${
                        isGroupSelected 
                        ? 'bg-blue-600 border-blue-600 shadow-sm scale-110' 
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    }`}>
                        {allSelected ? (
                            <CheckSquare size={16} className="text-white"/>
                        ) : someSelected ? (
                            <div className="w-3 h-0.5 bg-white rounded-full" />
                        ) : null}
                    </div>
                </td>

                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            const reqClient = mainAsset.metadata.cliente_final && mainAsset.metadata.cliente_final.trim().toUpperCase() !== 'STOCK'
                                ? mainAsset.metadata.cliente_final.trim()
                                : '';
                            onOpenDigitalEgress('REPUESTOS', reqClient, group.map(a => ({
                                codigo: a.metadata.pn,
                                cantidad: Number(a.metadata.cantidad) || 1,
                                descripcion: a.metadata.description,
                                serial_number: a.metadata.serial_ge && a.metadata.serial_ge !== 'PENDIENTE' ? a.metadata.serial_ge : ''
                            })));
                        }}
                        title="Generar Egreso Digital para esta Solicitud"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                    >
                        <FileText size={16}/>
                    </button>
                </td>

                <td className="p-4 text-center text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    <ChevronRight size={18}/>
                </td>
            </tr>
        ) 
    })}
</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {selectedAsset && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                            {/* ... Content of Selected Asset (Logistics) ... */}
                            <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 md:p-8">
                                <button onClick={() => {
                                    setSelectedAssetId(null);
                                    setIsConsolidationMode(false);
                                    setPendingSelection([]);
                                }} className="text-[10px] uppercase font-black text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors tracking-widest"><ArrowLeft size={16}/> Volver al Tablero</button>
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div>
                                        {isConsolidationMode ? (
                                            <>
                                                <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-blue-400">
                                                    <Layers size={32} /> PROCESO DE CONSOLIDACIÓN
                                                </h2>
                                                <p className="text-slate-400 mt-2 flex flex-wrap items-center gap-3 text-xs uppercase font-black tracking-[0.2em]">
                                                    {pendingSelection.length} ÍTEMS SELECCIONADOS PARA IMPORTACIÓN
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3">ORDEN: {selectedAsset.metadata.numero_orden_ge}</h2>
                                                <p className="text-slate-400 mt-2 flex flex-wrap items-center gap-3 text-xs uppercase font-bold tracking-widest">
                                                    <Truck size={14} className="text-blue-400"/> {selectedAsset.metadata.provider} 
                                                    <span className="text-slate-600">|</span> 
                                                    WF: {selectedAsset.metadata.workflow_id}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
                                        <div className="mb-2"><StatusBadge status={selectedAsset.current_status} /></div>
                                        <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Creado: {new Date(selectedAsset.metadata.fecha_solicitud).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    const reqClient = selectedAsset.metadata.cliente_final && selectedAsset.metadata.cliente_final.trim().toUpperCase() !== 'STOCK'
                                                        ? selectedAsset.metadata.cliente_final.trim()
                                                        : '';
                                                    onOpenDigitalEgress('REPUESTOS', reqClient, [{
                                                        codigo: selectedAsset.metadata.pn,
                                                        cantidad: Number(selectedAsset.metadata.cantidad) || 1,
                                                        descripcion: selectedAsset.metadata.description,
                                                        serial_number: selectedAsset.metadata.serial_ge && selectedAsset.metadata.serial_ge !== 'PENDIENTE' ? selectedAsset.metadata.serial_ge : ''
                                                    }]);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
                                                title="Generar Egreso Digital para esta solicitud"
                                            >
                                                <FileText size={13}/> Egreso Digital
                                            </button>
                                            <button
                                                onClick={() => setShowComments(v => !v)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showComments ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                                            >
                                                <MessageSquare size={14}/>
                                                Notas
                                                {(comments[selectedAsset.metadata.numero_orden_ge] || []).length > 0 && (
                                                    <span className="bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">
                                                        {(comments[selectedAsset.metadata.numero_orden_ge] || []).length}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="-mt-6 mx-4 md:mx-8 space-y-6 pb-8">

                                {/* ── PANEL DE NOTAS / COMENTARIOS ── */}
                                {showComments && selectedAsset && (
                                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 overflow-hidden animate-fadeIn">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 px-5 py-3 border-b border-blue-100 dark:border-blue-800 flex items-center gap-2">
                                            <MessageSquare size={16} className="text-blue-600 dark:text-blue-400"/>
                                            <h4 className="font-black text-blue-800 dark:text-blue-300 text-[10px] uppercase tracking-widest">
                                                Notas del Equipo — {selectedAsset.metadata.numero_orden_ge}
                                            </h4>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                            {(comments[selectedAsset.metadata.numero_orden_ge] || []).length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs italic">Sin notas aún — sé el primero en agregar una.</div>
                                            ) : (
                                                (comments[selectedAsset.metadata.numero_orden_ge] || []).map(c => (
                                                    <div key={c.id} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">@{c.user}</span>
                                                            <span className="text-[9px] text-slate-400 font-mono">{new Date(c.ts).toLocaleString('es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300">{c.text}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                                            <input
                                                type="text"
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                                placeholder="Escribe una nota... (Enter para enviar)"
                                                className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-700 dark:text-white"
                                            />
                                            <button
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 transition-colors"
                                            >
                                                <Send size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                                            <ShoppingCart size={16} className="text-slate-600"/> 1. Origen del Requerimiento
                                        </h3>
                                    </div>
                                    <div className="p-6">
                                        {isConsolidationMode ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[10px] text-left">
                                                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest">
                                                        <tr>
                                                            <th className="p-3">Orden Origen</th>
                                                            <th className="p-3">P/N</th>
                                                            <th className="p-3">Descripción</th>
                                                            <th className="p-3">Cliente Final</th>
                                                            <th className="p-3">Condición</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                        {assets.filter(a => pendingSelection.includes(a.id)).map(asset => (
                                                            <tr key={asset.id}>
                                                                <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{asset.metadata.numero_orden_ge}</td>
                                                                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{asset.metadata.pn}</td>
                                                                <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{asset.metadata.description}</td>
                                                                <td className="p-3 font-bold uppercase italic">{asset.metadata.cliente_final || 'STOCK'}</td>
                                                                <td className="p-3"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">{asset.metadata.condicion}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                                                <InfoField label="Proveedor" value={selectedAsset.metadata.provider} />
                                                <InfoField label="Cliente Final" value={selectedAsset.metadata.cliente_final} />
                                                <InfoField label="Destino" value={selectedAsset.metadata.equipo_destino} />
                                                <InfoField label="Condición" value={selectedAsset.metadata.condicion} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
                                        <h3 className="font-black text-slate-800 dark:text-blue-400 flex items-center gap-2 text-[10px] uppercase tracking-widest"><Truck size={16} className="text-slate-600"/> 2. Control Logístico</h3>
                                        <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                            <button onClick={()=>setLogisticsSubTab('INITIAL')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${logisticsSubTab==='INITIAL'?'bg-slate-800 text-white shadow-sm':'text-slate-500 dark:text-slate-400 hover:text-slate-900'}`}>Tracking</button>
                                            <button onClick={handleGoToClosing} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${logisticsSubTab==='FINAL'?'bg-slate-800 text-white shadow-sm':'text-slate-500 dark:text-slate-400 hover:text-slate-900'}`}>Costos</button>
                                            <button onClick={()=>setLogisticsSubTab('HISTORY' as any)} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all flex items-center gap-1.5 ${logisticsSubTab===('HISTORY' as any)?'bg-slate-800 text-white shadow-sm':'text-slate-500 dark:text-slate-400 hover:text-slate-900'}`}>
                                                <History size={12}/> Historial
                                            </button>
                                        </div>
                                    </div>
                                    {logisticsSubTab === 'INITIAL' && (
                                        <form onSubmit={handleUpdateLogisticsInitial} className="p-8">
                                            {isConsolidationMode && (<div className="bg-blue-800 text-white p-4 rounded-lg mb-8 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-md"><Layers size={20} /> Consolidación Activa: {consolidationList.length + 1} órdenes</div>)}
                                            
                                            <div className="space-y-6">
                                              {(() => {
                                                  // Determine assets to display
                                                  let targetAssets: Asset[] = [];
                                                  if (isConsolidationMode && pendingSelection.length > 0) {
                                                      targetAssets = assets.filter(a => pendingSelection.includes(a.id));
                                                  } else {
                                                      targetAssets = assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge);
                                                  }
                                                  
                                                  return targetAssets.map(asset => (
                                                    <div key={asset.id} className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <div>
                                                                <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase">{asset.metadata.pn}</h4>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{asset.metadata.description}</p>
                                                            </div>
                                                            <div className="text-[9px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-600 text-slate-600 dark:text-slate-300">Qty: {asset.metadata.cantidad}</div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">No. Guía (Tracking)</label>
                                                                <input 
                                                                    type="text" 
                                                                    name={`tracking_${asset.id}`} 
                                                                    defaultValue={asset.logistics.tracking_number} 
                                                                    disabled={!canEditLogistics}
                                                                    className={`w-full border rounded p-2 text-sm ${!canEditLogistics ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-200 outline-none border-slate-300 dark:border-slate-600'}`}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Courier / Forwarder</label>
                                                                <input 
                                                                    type="text" 
                                                                    name={`courier_${asset.id}`} 
                                                                    defaultValue={asset.logistics.courier} 
                                                                    disabled={!canEditLogistics}
                                                                    className={`w-full border rounded p-2 text-sm ${!canEditLogistics ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-200 outline-none border-slate-300 dark:border-slate-600'}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                  ));
                                              })()}
                                            </div>

                                            {canEditLogistics && (
                                                <div className="flex justify-end border-t border-slate-100 dark:border-slate-700 pt-6 mt-6">
                                                    <button className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 flex items-center gap-2 shadow-md transition-all">
                                                        <Save size={16}/> Guardar Registro
                                                    </button>
                                                </div>
                                            )}
                                        </form>
                                    )}
                                    {logisticsSubTab === 'FINAL' && (
                                        <form id="final-logistics-form" className="p-4 md:p-8 text-sm">
                                            {/* ... Final Logistics Form Content ... */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="col-span-1 space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Llegada a Almacén</label><input type="date" name="fecha_llegada_almacen" defaultValue={selectedAsset.metadata.cost_breakdown?.fecha_llegada_almacen} className="border border-slate-300 dark:border-slate-600 p-2.5 w-full bg-white dark:bg-slate-800 dark:text-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-200"/></div>
                                                <div className="col-span-1 space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No. Liquidación</label><input name="no_liquidacion" defaultValue={selectedAsset.metadata.cost_breakdown?.no_liquidacion} className="border border-slate-300 dark:border-slate-600 p-2.5 w-full bg-white dark:bg-slate-800 dark:text-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-200"/></div>
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                                <div className="lg:col-span-3 space-y-3">

                                                    {/* ── VALORES PARA ADUANA ── */}
                                                    <div className="flex items-center justify-between mb-4 border-b-2 border-blue-100 dark:border-blue-900 pb-2">
                                                        <h4 className="font-black text-blue-800 dark:text-blue-400 text-[10px] uppercase tracking-widest">Valores para Aduana (USD)</h4>
                                                        {saveStatus === 'saving' && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                <Loader2 size={10} className="animate-spin"/> Guardando...
                                                            </span>
                                                        )}
                                                        {saveStatus === 'saved' && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                                                <CheckCircle size={10}/> Guardado
                                                            </span>
                                                        )}
                                                        {saveStatus === 'error' && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase tracking-widest">
                                                                <AlertTriangle size={10}/> Error
                                                            </span>
                                                        )}
                                                    </div>
                                                    <LocalExpenseInput label="Costo FOB" val={aduanaValues.costo_fob} onChange={(v)=>{ const n={...aduanaValues, costo_fob: v}; setAduanaValues(n); triggerAutoSave(localExpenses, n); }} />
                                                    <LocalExpenseInput label="Flete Declarado" val={aduanaValues.flete} onChange={(v)=>{ const n={...aduanaValues, flete: v}; setAduanaValues(n); triggerAutoSave(localExpenses, n); }} />
                                                    <LocalExpenseInput label="Seguro" val={aduanaValues.seguro} onChange={(v)=>{ const n={...aduanaValues, seguro: v}; setAduanaValues(n); triggerAutoSave(localExpenses, n); }} />
                                                    <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                                                        <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 ml-2 uppercase tracking-wide">Total CIF</span>
                                                        <span className="text-xs font-black font-mono text-blue-800 dark:text-blue-200 mr-2">${totalCifGlobal.toFixed(2)}</span>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700"/>

                                                    {/* ── GASTOS LOCALES ── */}
                                                    <h4 className="font-black text-amber-800 dark:text-amber-400 text-[10px] uppercase tracking-widest border-b-2 border-amber-100 dark:border-amber-900 pb-2 mb-4">Gastos Locales (USD)</h4>
                                                    <LocalExpenseInput label="Manejo Carga" val={localExpenses.manejo_carga} onChange={(v)=>{ const n={...localExpenses, manejo_carga: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />
                                                    <LocalExpenseInput label="Costo CC" val={localExpenses.costo_cc} onChange={(v)=>{ const n={...localExpenses, costo_cc: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />
                                                    <LocalExpenseInput label="Almacenaje" val={localExpenses.almacenaje} onChange={(v)=>{ const n={...localExpenses, almacenaje: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />
                                                    <LocalExpenseInput label="Asesoría" val={localExpenses.asesoria_gestion_riesgo} onChange={(v)=>{ const n={...localExpenses, asesoria_gestion_riesgo: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />
                                                    <LocalExpenseInput label="Transporte" val={localExpenses.transporte_local} onChange={(v)=>{ const n={...localExpenses, transporte_local: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />
                                                    <LocalExpenseInput label="Agenciamiento" val={localExpenses.agenciamiento_aduana} onChange={(v)=>{ const n={...localExpenses, agenciamiento_aduana: v}; setLocalExpenses(n); triggerAutoSave(n, aduanaValues); }} />

                                                    {/* Totales resumen */}
                                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                                                        <div className="flex justify-between items-center px-2">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Total Gastos Locales</span>
                                                            <span className="text-xs font-black font-mono text-amber-700 dark:text-amber-400">${totalLocal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center px-2">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Prorrateo / Ítem</span>
                                                            <span className="text-xs font-mono text-slate-500">${proratedLocalPerItem.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="lg:col-span-9">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h4 className="font-black text-blue-900 dark:text-blue-300 text-[10px] uppercase tracking-widest">DESGLOSE DE COSTOS (ITEMS)</h4>
                                                        <div className="flex gap-2">
                                                            {canEditLogistics && totalCifGlobal > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setItemsState(prev => prev.map(it => ({ ...it, cif_editado: false } as any)))}
                                                                    className="text-[9px] uppercase font-black bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-lg hover:bg-amber-100 flex items-center gap-2 shadow-sm"
                                                                    title="Resetea todos los CIF al valor automático calculado desde FOB+Flete+Seguro"
                                                                >
                                                                    <RefreshCw size={14}/> Recalcular CIF
                                                                </button>
                                                            )}
                                                            {canEditLogistics && (<button type="button" onClick={handleManualReloadItems} className="text-[9px] uppercase font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm"><RefreshCw size={14}/> Recargar desde Orden</button>)}
                                                            {canEditLogistics && (<button type="button" onClick={addItemRow} className="text-[9px] uppercase font-black bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 shadow-md"><Plus size={14}/> + Agregar Item</button>)}
                                                        </div>
                                                    </div>
                                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                        <div className="overflow-x-auto">
                                                            {/* TABLA ACTUALIZADA CON LAS COLUMNAS Y CÁLCULOS EXACTOS */}
                                                            <table className="w-full text-[10px] border-separate border-spacing-0 min-w-[1400px]">
                                                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase">
                                                                    <tr>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center w-8">#</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300">FACTURA</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 min-w-[140px]">ITEM / DESC</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center w-12">CANTIDAD</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right bg-amber-50/50 dark:bg-amber-900/20">PRECIO UNI.</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">PRECIO TOTAL</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right bg-amber-50/50 dark:bg-amber-900/20" title="Calculado automáticamente desde FOB×(CIF/FOB total). Editable manualmente. Doble click para resetear.">CIF (UNIT) ⚡</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right font-bold text-slate-700 dark:text-slate-300">VALOR EN ADUANA (CIF)</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-center w-8">ARAN?</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right text-blue-700 dark:text-blue-400">ARANCEL AD VALOREM</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">FODINFA</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right">IVA 15%</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right font-bold text-slate-700 dark:text-slate-300">TOTAL VALOR LIQ.</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right text-emerald-600 dark:text-emerald-400">VALOR PRORRATEADO GASTOS LOCALES</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right font-black text-blue-900 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/20 font-mono border-r border-slate-50 dark:border-slate-700">COSTO FINAL PRODUCTO</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-right font-black text-slate-800 dark:text-slate-200 bg-blue-100/30 dark:bg-blue-800/20 font-mono">LANDED</th>
                                                                        <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-8"></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                                                    {itemsState.map((item, idx) => { 
                                                                        // ── Fórmulas exactas del Excel de liquidación ──────────────────
                                                                        // Col D=cantidad, E=precioUni, F=precioTotal, G=cifTotal
                                                                        // H=arancel(G*5%), J=fodinfa(G*0.5%), K=iva((G+H+J)*15%)
                                                                        // L=liqTotal(H+J+K), M=gastos locales prorrateados
                                                                        // N=costoFinal(G+H+J+M)  ← base CIF, NO precio FOB
                                                                        // O=landed(N/F)

                                                                        const qty      = Number(item.cantidad)   || 0;
                                                                        const precioU  = Number(item.precio_uni) || 0;
                                                                        const precioTotal = qty * precioU;   // F = E*D

                                                                        // ── CIF automático desde valores de aduana ──────────────────────
                                                                        // Si hay FOB+Flete+Seguro globales: CIF_uni = precioFOB × (CIFTotal/FOBTotal)
                                                                        // El usuario puede sobreescribir el CIF_uni manualmente (campo editable)
                                                                        const totalFobItems = itemsState.reduce((acc, it) => acc + (Number(it.cantidad)||0) * (Number(it.precio_uni)||0), 0);
                                                                        const cifFactor    = totalCifGlobal > 0 && totalFobItems > 0 ? totalCifGlobal / totalFobItems : 1;
                                                                        const cifAutoU     = precioU * cifFactor; // CIF calculado automáticamente

                                                                        // Si el usuario editó manualmente cif_unitario → usarlo; si no → usar el automático
                                                                        const cifManuallyEdited = (item as any).cif_editado === true;
                                                                        const cifU = cifManuallyEdited
                                                                            ? (Number(item.cif_unitario) || cifAutoU)
                                                                            : (totalCifGlobal > 0 ? cifAutoU : (Number(item.cif_unitario) || precioU));
                                                                        const cifTotal = qty * cifU;          // G = CIF_uni * qty

                                                                        // Arancel: editable o calculado al 5% si aplica (col H)
                                                                        const arancelManual    = (item as any).arancel;
                                                                        const arancelCalculado = item.aplica_arancel ? cifTotal * 0.05 : 0;
                                                                        const arancelVal       = arancelManual !== undefined ? Number(arancelManual) : arancelCalculado;

                                                                        const fodinfa  = cifTotal * 0.005;               // J = G*0.5%
                                                                        const baseIva  = cifTotal + arancelVal + fodinfa; // base IVA = G+H+J
                                                                        const iva      = baseIva * 0.15;                  // K = (G+H+J)*15%
                                                                        const liqTotal = arancelVal + fodinfa + iva;      // L = H+J+K

                                                                        const prorrateoLocales = Number(proratedLocalPerItem) || 0; // M

                                                                        // N = G + H + J + M  (base CIF, exacto al Excel)
                                                                        const costoFinal = cifTotal + arancelVal + fodinfa + prorrateoLocales;

                                                                        // O = N / F  (landed sobre precio FOB total)
                                                                        const landed = precioTotal > 0 ? costoFinal / precioTotal : 0;
                                                                        
                                                                        return (
                                                                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700 group/row">
                                                                            <td className="p-2 text-center text-slate-400 dark:text-slate-600 font-black border-r border-slate-50 dark:border-slate-700">{idx + 1}</td>
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700"><input className="w-full bg-blue-50/30 dark:bg-blue-900/10 border-none rounded p-1.5 text-center focus:ring-1 focus:ring-blue-200 font-bold text-slate-700 dark:text-slate-200" value={item.no_factura} onChange={(e)=>handleItemChange(item.id, 'no_factura', e.target.value)}/></td>
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700"><input className="w-full bg-transparent font-black border-none p-0 mb-1 focus:ring-0 text-[10px] uppercase text-slate-800 dark:text-slate-200" value={item.item_number} onChange={(e)=>handleItemChange(item.id, 'item_number', e.target.value)}/><input className="w-full bg-blue-50/30 dark:bg-blue-900/10 text-[9px] text-slate-500 dark:text-slate-400 border-none rounded p-1 focus:ring-1 focus:ring-blue-200" value={item.descripcion} onChange={(e)=>handleItemChange(item.id, 'descripcion', e.target.value)}/></td>
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700"><input type="number" className="w-full text-center bg-transparent border-none p-0 focus:ring-0 font-mono text-slate-600 dark:text-slate-300" value={item.cantidad} onChange={(e)=>handleItemChange(item.id, 'cantidad', e.target.value)}/></td>
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700"><input type="number" step="0.01" className="w-full text-right bg-amber-50/50 dark:bg-amber-900/10 border-none rounded p-1.5 focus:ring-1 focus:ring-amber-200 font-mono font-bold dark:text-white" value={item.precio_uni} onChange={(e)=>handleItemChange(item.id, 'precio_uni', e.target.value)}/></td>
                                                                            <td className="p-2 text-right font-mono text-slate-400 border-r border-slate-50 dark:border-slate-700">{precioTotal.toFixed(2)}</td>
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700 relative">
                                                                                <input
                                                                                    type="number" step="0.01"
                                                                                    className={`w-full text-right border-none rounded p-1.5 focus:ring-1 font-mono font-bold dark:text-white ${
                                                                                        cifManuallyEdited
                                                                                            ? 'bg-orange-50/80 dark:bg-orange-900/20 focus:ring-orange-300 text-orange-700 dark:text-orange-300'
                                                                                            : 'bg-amber-50/50 dark:bg-amber-900/10 focus:ring-amber-200'
                                                                                    }`}
                                                                                    value={cifManuallyEdited ? Number(item.cif_unitario).toFixed(2) : cifAutoU.toFixed(2)}
                                                                                    title={cifManuallyEdited ? 'Valor editado manualmente — click para resetear al automático' : `Auto: precio × ${cifFactor.toFixed(5)}`}
                                                                                    onChange={(e) => {
                                                                                        handleItemChange(item.id, 'cif_unitario', Number(e.target.value));
                                                                                        handleItemChange(item.id, 'cif_editado' as any, true);
                                                                                    }}
                                                                                    onDoubleClick={() => {
                                                                                        // Doble click → resetea al valor automático
                                                                                        handleItemChange(item.id, 'cif_unitario', cifAutoU);
                                                                                        handleItemChange(item.id, 'cif_editado' as any, false);
                                                                                    }}
                                                                                />
                                                                                {cifManuallyEdited && (
                                                                                    <span className="absolute top-0.5 right-1 text-[8px] text-orange-400 font-black" title="Editado manualmente — doble click para resetear">✎</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-2 text-right font-mono font-bold text-slate-500 dark:text-slate-300 border-r border-slate-50 dark:border-slate-700">{cifTotal.toFixed(2)}</td>
                                                                            <td className="p-2 text-center border-r border-slate-50 dark:border-slate-700"><input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-0 border-slate-300 dark:border-slate-600" checked={item.aplica_arancel} onChange={(e)=>handleItemChange(item.id, 'aplica_arancel', e.target.checked)}/></td>
                                                                            {/* NUEVO CAMPO: ARANCEL EDITABLE */}
                                                                            <td className="p-2 border-r border-slate-50 dark:border-slate-700">
                                                                                <input 
                                                                                    type="number" step="0.01" 
                                                                                    className="w-full text-right bg-blue-50/30 dark:bg-blue-900/10 border-none rounded p-1.5 focus:ring-1 focus:ring-blue-300 font-mono font-bold text-blue-700 dark:text-blue-300" 
                                                                                    value={arancelManual !== undefined ? arancelManual : arancelCalculado.toFixed(2)} 
                                                                                    onChange={(e) => handleItemChange(item.id, 'arancel', e.target.value === '' ? undefined : Number(e.target.value))}
                                                                                />
                                                                            </td>
                                                                            <td className="p-2 text-right font-mono text-slate-400 border-r border-slate-50 dark:border-slate-700">{fodinfa.toFixed(2)}</td>
                                                                            <td className="p-2 text-right font-mono text-slate-400 border-r border-slate-50 dark:border-slate-700">{iva.toFixed(2)}</td>
                                                                            <td className="p-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300 border-r border-slate-50 dark:border-slate-700">{liqTotal.toFixed(2)}</td>
                                                                            <td className="p-2 text-right font-mono text-emerald-600 border-r border-slate-50 dark:border-slate-700">{prorrateoLocales.toFixed(2)}</td>
                                                                            <td className="p-2 text-right font-black text-blue-900 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/20 font-mono border-r border-slate-50 dark:border-slate-700">{costoFinal.toFixed(2)}</td>
                                                                            <td className="p-2 text-right font-black text-slate-800 dark:text-slate-200 bg-blue-100/30 dark:bg-blue-800/20 font-mono">{landed.toFixed(3)}</td>
                                                                            <td className="p-2 text-center"><button type="button" onClick={()=>removeItemRow(item.id)} className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors opacity-0 group-hover/row:opacity-100"><Trash2 size={14}/></button></td>
                                                                        </tr>
                                                                        ); 
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-10 flex flex-col md:flex-row justify-end items-center border-t border-slate-100 dark:border-slate-700 pt-8 gap-4">
                                                {/* BOTÓN: Cerrar Importación siempre visible si no está en Bodega/Despachado */}
                                                {canEditLogistics && hasOpenImports && (
                                                    <button 
                                                        type="button" 
                                                        onClick={handleInitiateCloseImport} 
                                                        className="w-full md:w-auto bg-emerald-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-3"
                                                    >
                                                        <CheckSquare size={20}/> Cerrar Importación
                                                    </button>
                                                )}
                                                {canEditLogistics && (
                                                    <button 
                                                        type="button" 
                                                        onClick={handleUpdateLogisticsFinal} 
                                                        className="w-full md:w-auto bg-slate-900 dark:bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-3"
                                                    >
                                                        <Save size={20}/> Guardar Cambios
                                                    </button>
                                                )}
                                                {itemsState.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={exportLiquidacion}
                                                        className="w-full md:w-auto bg-emerald-700 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-800 transition-all shadow-md flex items-center justify-center gap-3"
                                                    >
                                                        <Download size={20}/> Exportar Excel
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    )}

                                    {/* ── HISTORIAL ── */}
                                    {logisticsSubTab === 'HISTORY' && selectedAsset && (
                                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                                            {(() => {
                                                const assetIds = assets
                                                    .filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge)
                                                    .map(a => a.id);
                                                const assetLogs = logs
                                                    .filter(l => assetIds.includes(l.asset_id))
                                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                                                if (assetLogs.length === 0) return (
                                                    <div className="text-center py-16 text-slate-300 dark:text-slate-600">
                                                        <History size={48} className="mx-auto mb-4 opacity-40"/>
                                                        <p className="font-black uppercase text-xs tracking-widest">Sin historial disponible</p>
                                                    </div>
                                                );

                                                return (
                                                    <div className="relative">
                                                        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"/>
                                                        <div className="space-y-5">
                                                            {assetLogs.map((log, idx) => {
                                                                const isFirst = idx === 0;
                                                                const dotColor = log.action === 'CREATE' ? 'bg-emerald-500' : log.action === 'STATUS_TRANSITION' ? 'bg-blue-500' : 'bg-amber-500';
                                                                return (
                                                                    <div key={log.id} className="flex gap-4 pl-2">
                                                                        <div className={`w-7 h-7 rounded-full ${dotColor} flex items-center justify-center shrink-0 z-10 shadow-md ${isFirst ? 'ring-4 ring-white dark:ring-slate-800' : ''}`}>
                                                                            {log.action === 'CREATE' ? <Plus size={12} className="text-white"/> : log.action === 'STATUS_TRANSITION' ? <ArrowRight size={12} className="text-white"/> : <Edit3 size={12} className="text-white"/>}
                                                                        </div>
                                                                        <div className={`flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border ${isFirst ? 'border-blue-200 dark:border-blue-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : log.action === 'STATUS_TRANSITION' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                                                        {log.action === 'CREATE' ? 'Creado' : log.action === 'STATUS_TRANSITION' ? 'Transición' : 'Actualizado'}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">@{log.user_name}</span>
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString('es-ES', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                                                                            </div>
                                                                            {log.details && <p className="text-[11px] text-slate-500 dark:text-slate-400">{log.details}</p>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            {showCloseImportModal && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
              <div role="dialog" aria-modal="true" aria-labelledby="modal-close-import-title" className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[30px] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                      <h3 id="modal-close-import-title" className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                          <CheckSquare size={24} className="text-emerald-600"/> Cerrar Importación
                      </h3>
                      <button onClick={() => setShowCloseImportModal(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                          Hay múltiples ítems en esta orden. Seleccione cuáles desea cerrar para liberar su ingreso a Bodega:
                      </p>
                      
                      <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:border-emerald-500 transition-colors">
                          <input 
                              type="checkbox" 
                              checked={selectedAssetsToClose.length === assetsToClose.length}
                              onChange={(e) => {
                                  if(e.target.checked) setSelectedAssetsToClose(assetsToClose.map(a=>a.id));
                                  else setSelectedAssetsToClose([]);
                              }}
                              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800"
                          />
                          <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-widest">Seleccionar Todos los Ítems</span>
                      </label>

                      <div className="space-y-3 mt-4">
                          {assetsToClose.map(asset => (
                              <label key={asset.id} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedAssetsToClose.includes(asset.id) ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}>
                                  <input 
                                      type="checkbox"
                                      checked={selectedAssetsToClose.includes(asset.id)}
                                      onChange={(e) => {
                                          if(e.target.checked) setSelectedAssetsToClose([...selectedAssetsToClose, asset.id]);
                                          else setSelectedAssetsToClose(selectedAssetsToClose.filter(id => id !== asset.id));
                                      }}
                                      className="w-5 h-5 mt-1 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800"
                                  />
                                  <div className="flex-1">
                                      <div className="font-black text-slate-800 dark:text-slate-200 text-sm uppercase font-mono">{asset.metadata.pn}</div>
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold max-w-[300px] truncate mt-0.5">{asset.metadata.description}</div>
                                      <div className="text-[9px] mt-2 font-black uppercase tracking-widest text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded inline-block shadow-sm">
                                          Cant: <span className="text-slate-800 dark:text-slate-200">{asset.metadata.cantidad}</span>
                                      </div>
                                  </div>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4 bg-slate-50 dark:bg-slate-900">
                      <button onClick={() => setShowCloseImportModal(false)} className="px-8 py-3.5 rounded-xl text-[10px] font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors uppercase tracking-widest shadow-sm">Cancelar</button>
                      <button 
                          onClick={() => handleConfirmCloseImport(selectedAssetsToClose)}
                          disabled={selectedAssetsToClose.length === 0}
                          className="px-8 py-3.5 rounded-xl text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors uppercase tracking-widest flex items-center gap-2 shadow-md active:scale-95"
                      >
                          Confirmar Selección ({selectedAssetsToClose.length})
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showConsolidationModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
              {/* Modal Redimensionable */}
              <div role="dialog" aria-modal="true" aria-label="Selección de Ítems para Consolidación" className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col min-w-[400px] min-h-[500px] max-h-[90vh] resize both overflow-hidden relative">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                              <Layers size={24} className="text-blue-600"/> Selección de Ítems
                          </h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              Orden: {consolidationModalAssets[0]?.metadata.numero_orden_ge}
                          </p>
                      </div>
                      <button onClick={() => setShowConsolidationModal(false)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={28}/>
                      </button>
                  </div>

                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex justify-between items-center shrink-0">
                      <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                          {consolidationModalSelected.length} de {consolidationModalAssets.length} seleccionados
                      </span>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setConsolidationModalSelected(consolidationModalAssets.map(a => a.id))}
                              className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase hover:underline"
                          >
                              Seleccionar Todos
                          </button>
                          <button 
                              onClick={() => setConsolidationModalSelected([])}
                              className="text-[10px] font-black text-slate-400 uppercase hover:underline"
                          >
                              Limpiar
                          </button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {consolidationModalAssets.map(asset => {
                          const isSelected = consolidationModalSelected.includes(asset.id);
                          return (
                              <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => {
                                      setConsolidationModalSelected(prev =>
                                          prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]
                                      );
                                  }}
                                  aria-pressed={isSelected}
                                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                                      isSelected
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm'
                                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300'
                                  }`}
                              >
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${
                                      isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                                  }`}>
                                      {isSelected && <CheckSquare size={16} className="text-white"/>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                          <span className="font-black text-slate-900 dark:text-white text-sm">{asset.metadata.pn}</span>
                                          <StatusBadge status={asset.current_status} />
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{asset.metadata.description}</p>
                                  </div>
                              </button>
                          );
                      })}
                  </div>

                  <div className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 shrink-0">
                      <button 
                          onClick={handleConfirmModalSelection}
                          className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                      >
                          Confirmar Selección
                      </button>
                  </div>

                  {/* Indicador visual de redimensión */}
                  <div className="absolute bottom-1 right-1 pointer-events-none opacity-30">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="22" y1="14" x2="14" y2="22" />
                          <line x1="22" y1="18" x2="18" y2="22" />
                      </svg>
                  </div>
              </div>
          </div>
      )}
    </>
  );
});
LogisticsModule.displayName = 'LogisticsModule';
