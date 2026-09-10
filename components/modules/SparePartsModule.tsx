import React, { useState, useRef, useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { 
  Asset, 
  AssetStatus, 
  User, 
  SparePart,
  DigitalEgressItem
} from '../../types';
import { db } from '../../firebase';
import {
  doc, writeBatch, updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { 
  Upload,
  RefreshCw,
  CheckSquare,
  Trash2,
  Download,
  FileText,
  Plus,
  Database,
  BarChart3,
  Package,
  Users,
  Cpu,
  Search,
  ArrowUpDown,
  Calendar,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  TrendingUp,
  Award,
  Building2,
  DollarSign,
  Wrench
} from 'lucide-react';
import { FilterSelect } from '../ui/FilterSelect';
import { generateUUID, sanitizeRow, normalizeSparePartCondition } from '../../utils/helpers';

export interface SparePartsModuleProps {
  spareParts: SparePart[];
  sparePartsLoading: boolean;
  assets: Asset[];
  currentUser: User | null;
  canManageSpareParts: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  showError: (titleOrMsg: string, msg?: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;
  setSelectedAssetId: (id: string | null) => void;
  setActiveTab: (tab: any) => void;
  selectedSparePartIds: Set<string>;
  setSelectedSparePartIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenDigitalEgress: (origin: 'REPUESTOS' | 'BODEGA', client: string, items: DigitalEgressItem[]) => void;
}

export const SparePartsModule: React.FC<SparePartsModuleProps> = memo(({
  spareParts,
  sparePartsLoading,
  assets,
  currentUser,
  canManageSpareParts,
  showToast,
  showError,
  showConfirm,
  setSelectedAssetId,
  setActiveTab,
  selectedSparePartIds,
  setSelectedSparePartIds,
  onOpenDigitalEgress
}) => {
  // ─── Estados Locales de Repuestos ───────────────────────────────────────────
  const [sparePartsSearch, setSparePartsSearch] = useState('');
  const [sparePartsDebouncedSearch, setSparePartsDebouncedSearch] = useState('');
  const [sparePartsFilterAnio, setSparePartsFilterAnio] = useState('');
  const [sparePartsFilterMes, setSparePartsFilterMes] = useState('');
  const [sparePartsFilterDia, setSparePartsFilterDia] = useState('');
  const [sparePartsFilterMod, setSparePartsFilterMod] = useState('');
  const [sparePartsFilterCondicion, setSparePartsFilterCondicion] = useState('');
  const [sparePartsFilterOrigen, setSparePartsFilterOrigen] = useState('');
  const [sparePartsSort, setSparePartsSort] = useState<'newest' | 'oldest' | 'ge_newest' | 'ge_oldest' | 'pn_az' | 'pn_za' | 'cliente_az'>('newest');
  const [showSparePartModal, setShowSparePartModal] = useState(false);
  const [editingSparePart, setEditingSparePart] = useState<SparePart | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [sparePartsViewMode, setSparePartsViewMode] = useState<'TABLE' | 'ANALYTICS'>('TABLE');
  const [sparePartsAnalyticsScope, setSparePartsAnalyticsScope] = useState<'GLOBAL' | 'FILTERED'>('GLOBAL');

  const [sparePartsPage, setSparePartsPage] = useState(1);
  const [sparePartsPageSize, setSparePartsPageSize] = useState(50);

  const sparePartsSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSparePartsSearchChange = (value: string) => {
    setSparePartsSearch(value);
    setSparePartsPage(1);
    if (sparePartsSearchTimerRef.current) clearTimeout(sparePartsSearchTimerRef.current);
    sparePartsSearchTimerRef.current = setTimeout(() => setSparePartsDebouncedSearch(value), 250);
  };

  const getSparePartDateParts = (sp: SparePart): { anio: string; mes: string; dia: string } => {
    const raw = sp.fecha_pedido || sp.created_at || '';
    if (raw) {
      const num = Number(raw);
      if (!isNaN(num) && num > 20000 && num < 80000 && !String(raw).includes('/') && !String(raw).includes('-')) {
        const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
        return {
          anio: String(d.getUTCFullYear()),
          mes: String(d.getUTCMonth() + 1).padStart(2, '0'),
          dia: String(d.getUTCDate()).padStart(2, '0')
        };
      }
      const separator = raw.includes('/') ? '/' : raw.includes('-') ? '-' : null;
      if (separator) {
        const clean = raw.split('T')[0];
        const p = clean.split(separator);
        if (p.length === 3) {
          const p0 = p[0].trim();
          const p1 = p[1].trim();
          const p2 = p[2].trim();

          if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
            let y = p0.length === 2 ? `20${p0}` : p0;
            return {
              anio: y,
              mes: p1.padStart(2, '0'),
              dia: p2.padStart(2, '0')
            };
          }

          let y = p2;
          if (y.length === 2) y = `20${y}`;
          return {
            anio: y,
            mes: p1.padStart(2, '0'),
            dia: p0.padStart(2, '0')
          };
        }
      }
    }
    let fallbackAnio = sp.anio ? String(sp.anio) : '';
    if (fallbackAnio.length === 2) fallbackAnio = `20${fallbackAnio}`;
    return {
      anio: fallbackAnio,
      mes: '',
      dia: ''
    };
  };

  const filteredSpareParts = useMemo(() => {
    const search = sparePartsDebouncedSearch.toLowerCase();
    const filtered = spareParts.filter(sp => {
      const matchSearch = !search ||
        sp.pn?.toLowerCase().includes(search) ||
        sp.descripcion?.toLowerCase().includes(search) ||
        sp.cliente?.toLowerCase().includes(search) ||
        sp.orden_ge?.toLowerCase().includes(search);

      const dp = getSparePartDateParts(sp);
      const matchAnio = !sparePartsFilterAnio || dp.anio === sparePartsFilterAnio;
      const matchMes = !sparePartsFilterMes || dp.mes === sparePartsFilterMes;
      const matchDia = !sparePartsFilterDia || dp.dia === sparePartsFilterDia;

      const matchMod = !sparePartsFilterMod || sp.mod === sparePartsFilterMod;
      const matchCondicion = !sparePartsFilterCondicion || normalizeSparePartCondition(sp.condicion, sp.precio) === sparePartsFilterCondicion;
      const matchOrigen = !sparePartsFilterOrigen || sp.source === sparePartsFilterOrigen;
      return matchSearch && matchAnio && matchMes && matchDia && matchMod && matchCondicion && matchOrigen;
    });

    const parseDateValue = (sp: SparePart): number => {
      const dateStr = sp.fecha_pedido || sp.fecha_instalacion || sp.created_at || '';
      if (dateStr) {
        const num = Number(dateStr);
        if (!isNaN(num) && num > 20000 && num < 80000 && !String(dateStr).includes('/') && !String(dateStr).includes('-')) {
          return new Date(Date.UTC(1899, 11, 30)).getTime() + num * 86400000;
        }
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              return new Date(year, month, day).getTime();
            }
          }
        }
        const parsed = Date.parse(dateStr);
        if (!isNaN(parsed)) return parsed;
      }
      if (sp.anio) {
        return new Date(Number(sp.anio) || 2026, 0, 1).getTime();
      }
      return 0;
    };

    return [...filtered].sort((a, b) => {
      switch (sparePartsSort) {
        case 'newest':
          return parseDateValue(b) - parseDateValue(a);
        case 'oldest':
          return parseDateValue(a) - parseDateValue(b);
        case 'ge_newest':
          return (b.orden_ge || '').localeCompare(a.orden_ge || '', undefined, { numeric: true, sensitivity: 'base' });
        case 'ge_oldest':
          return (a.orden_ge || '').localeCompare(b.orden_ge || '', undefined, { numeric: true, sensitivity: 'base' });
        case 'pn_az':
          return (a.pn || '').localeCompare(b.pn || '');
        case 'pn_za':
          return (b.pn || '').localeCompare(a.pn || '');
        case 'cliente_az':
          return (a.cliente || '').localeCompare(b.cliente || '');
        default:
          return 0;
      }
    });
  }, [spareParts, sparePartsDebouncedSearch, sparePartsFilterAnio, sparePartsFilterMes, sparePartsFilterDia, sparePartsFilterMod, sparePartsFilterCondicion, sparePartsFilterOrigen, sparePartsSort]);

  const totalSparePartsPages = Math.max(1, Math.ceil(filteredSpareParts.length / sparePartsPageSize));

  const paginatedSpareParts = useMemo(() => {
    const start = (sparePartsPage - 1) * sparePartsPageSize;
    return filteredSpareParts.slice(start, start + sparePartsPageSize);
  }, [filteredSpareParts, sparePartsPage, sparePartsPageSize]);

  const sparePartsAnalytics = useMemo(() => {
    const dataset = sparePartsAnalyticsScope === 'FILTERED' ? filteredSpareParts : spareParts;
    
    const clienteMap = new Map<string, { cliente: string; totalUnidades: number; pedidos: number; pns: Set<string>; inversion: number }>();
    const repuestoMap = new Map<string, { pn: string; descripcion: string; totalUnidades: number; veces: number; clientes: Set<string>; inversion: number }>();
    const modMap = new Map<string, number>();
    const equipoMap = new Map<string, number>();

    let totalPiezas = 0;
    let totalInversion = 0;

    for (const sp of dataset) {
      const cant = Number(sp.cantidad) || 1;
      const precio = Number(sp.precio) || 0;
      const inv = precio * cant;
      totalPiezas += cant;
      totalInversion += inv;

      const rawCliente = (sp.cliente || '').trim();
      const cName = rawCliente ? rawCliente.toUpperCase() : 'NO ESPECIFICADO';
      const cData = clienteMap.get(cName) || { cliente: cName, totalUnidades: 0, pedidos: 0, pns: new Set<string>(), inversion: 0 };
      cData.totalUnidades += cant;
      cData.pedidos += 1;
      if (sp.pn) cData.pns.add(sp.pn.trim().toUpperCase());
      cData.inversion += inv;
      clienteMap.set(cName, cData);

      const rawPn = (sp.pn || '').trim();
      const pnKey = rawPn ? rawPn.toUpperCase() : 'SIN P/N';
      const rData = repuestoMap.get(pnKey) || { pn: pnKey, descripcion: sp.descripcion || 'Sin descripción', totalUnidades: 0, veces: 0, clientes: new Set<string>(), inversion: 0 };
      rData.totalUnidades += cant;
      rData.veces += 1;
      if (sp.descripcion && (rData.descripcion === 'Sin descripción' || rData.descripcion.length < sp.descripcion.length)) {
        rData.descripcion = sp.descripcion;
      }
      if (rawCliente) rData.clientes.add(rawCliente.toUpperCase());
      rData.inversion += inv;
      repuestoMap.set(pnKey, rData);

      const rawMod = (sp.mod || '').trim();
      const modKey = rawMod ? rawMod.toUpperCase() : 'OTROS';
      modMap.set(modKey, (modMap.get(modKey) || 0) + cant);

      const rawEq = (sp.equipo || '').trim();
      const eqKey = rawEq ? rawEq : 'No Especificado';
      equipoMap.set(eqKey, (equipoMap.get(eqKey) || 0) + cant);
    }

    const topClientes = Array.from(clienteMap.values())
      .filter(c => c.cliente !== 'NO ESPECIFICADO')
      .sort((a, b) => b.totalUnidades - a.totalUnidades);

    const topRepuestos = Array.from(repuestoMap.values())
      .filter(r => r.pn !== 'SIN P/N')
      .sort((a, b) => b.totalUnidades - a.totalUnidades);

    const modalidadesList = Array.from(modMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const equiposList = Array.from(equipoMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const MOD_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316'];

    return {
      totalRegistros: dataset.length,
      totalPiezas,
      totalInversion,
      topClientes,
      topRepuestos,
      modalidadesList,
      equiposList,
      MOD_COLORS,
      topCliente: topClientes[0] || null,
      topRepuesto: topRepuestos[0] || null,
      topModalidad: modalidadesList[0] || null,
    };
  }, [spareParts, filteredSpareParts, sparePartsAnalyticsScope]);

  const formatSparePartDisplayDate = (val: any): string => {
    if (!val && val !== 0) return '—';
    const num = Number(val);
    if (!isNaN(num) && num > 20000 && num < 80000 && !String(val).includes('/') && !String(val).includes('-')) {
      const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
      if (!isNaN(d.getTime())) {
        return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
      }
    }
    const str = String(val).trim();
    if (!str) return '—';
    const sep = str.includes('/') ? '/' : str.includes('-') ? '-' : null;
    if (sep) {
      const p = str.split('T')[0].split(sep);
      if (p.length === 3) {
        const p0 = p[0].trim();
        const p1 = p[1].trim();
        const p2 = p[2].trim();
        if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
          const y = p0.length === 2 ? `20${p0}` : p0;
          return `${p2.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
        }
        let y = p2;
        if (y.length === 2) y = `20${y}`;
        return `${p0.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
      }
    }
    return str;
  };

  const uniqueAnios = useMemo(() => {
    const set = new Set<string>();
    spareParts.forEach(sp => {
      const { anio } = getSparePartDateParts(sp);
      if (anio) set.add(anio);
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [spareParts]);

  const uniqueMeses = useMemo(() => {
    const MESES_MAP: Record<string, string> = {
      '01': '01 - Enero', '02': '02 - Febrero', '03': '03 - Marzo', '04': '04 - Abril',
      '05': '05 - Mayo', '06': '06 - Junio', '07': '07 - Julio', '08': '08 - Agosto',
      '09': '09 - Septiembre', '10': '10 - Octubre', '11': '11 - Noviembre', '12': '12 - Diciembre'
    };
    const set = new Set<string>();
    spareParts.forEach(sp => {
      const { anio, mes } = getSparePartDateParts(sp);
      if (mes && (!sparePartsFilterAnio || anio === sparePartsFilterAnio)) {
        set.add(mes);
      }
    });
    return [...set].sort().map(m => ({ value: m, label: MESES_MAP[m] || m }));
  }, [spareParts, sparePartsFilterAnio]);

  const uniqueDias = useMemo(() => {
    const set = new Set<string>();
    spareParts.forEach(sp => {
      const { anio, mes, dia } = getSparePartDateParts(sp);
      if (dia) {
        const matchA = !sparePartsFilterAnio || anio === sparePartsFilterAnio;
        const matchM = !sparePartsFilterMes || mes === sparePartsFilterMes;
        if (matchA && matchM) set.add(dia);
      }
    });
    return [...set].sort().map(d => ({ value: d, label: `Día ${d}` }));
  }, [spareParts, sparePartsFilterAnio, sparePartsFilterMes]);

  const uniqueClientes = useMemo(() => [...new Set(spareParts.map(sp => sp.cliente).filter(Boolean))], [spareParts]);
  const uniqueMods = useMemo(() => [...new Set(spareParts.map(sp => sp.mod).filter(Boolean))], [spareParts]);
  const uniqueCondiciones = useMemo(() => {
    const set = new Set<string>();
    spareParts.forEach(sp => {
      const norm = normalizeSparePartCondition(sp.condicion, sp.precio);
      if (norm && norm !== '—') set.add(norm);
    });
    return Array.from(set).sort();
  }, [spareParts]);
  const totalUnidades = useMemo(() => spareParts.reduce((acc, sp) => acc + (Number(sp.cantidad) || 1), 0), [spareParts]);

// ── Importar CSV / Excel ───────────────────────────────────
                const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!e.target.files?.[0] || !currentUser) return;
                    const file = e.target.files[0];
                    setCsvImporting(true);
                    try {
                        const arrayBuffer = await file.arrayBuffer();
                        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

                        if (rows.length === 0) { showToast('El archivo está vacío.', 'error'); return; }

                        const confirmed = await showConfirm(`¿Importar ${rows.length} registros al catálogo de repuestos?\n\nSi ya existen registros anteriores, se recomienda limpiar antes o se añadirán estos nuevos registros.`);
                        if (!confirmed) return;

                        // Convierte fechas de Excel (números seriales como 46196), Date objects o strings
                        const formatDate = (val: any): string => {
                            if (!val && val !== 0) return '';
                            if (val instanceof Date) {
                                if (isNaN(val.getTime())) return '';
                                const d = String(val.getDate()).padStart(2, '0');
                                const m = String(val.getMonth() + 1).padStart(2, '0');
                                const y = val.getFullYear();
                                return `${d}/${m}/${y}`;
                            }
                            // Número serial de Excel (ej. 46196 -> 2026-06-23)
                            if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('/') && !String(val).includes('-') && Number(val) > 20000 && Number(val) < 80000)) {
                                const serial = Number(val);
                                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                                const dateObj = new Date(excelEpoch.getTime() + serial * 86400000);
                                if (!isNaN(dateObj.getTime())) {
                                    const d = String(dateObj.getUTCDate()).padStart(2, '0');
                                    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                                    const y = dateObj.getUTCFullYear();
                                    return `${d}/${m}/${y}`;
                                }
                            }
                            const str = String(val).trim();
                            // Separar partes si usa '/' o '-'
                            const separator = str.includes('/') ? '/' : str.includes('-') ? '-' : null;
                            if (separator) {
                                const clean = str.split('T')[0];
                                const parts = clean.split(separator);
                                if (parts.length === 3) {
                                    const p0 = parts[0].trim();
                                    const p1 = parts[1].trim();
                                    const p2 = parts[2].trim();

                                    // Caso 1: YYYY-MM-DD (primer elemento es de 4 dígitos o > 31)
                                    if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
                                        const y = p0.length === 2 ? `20${p0}` : p0;
                                        const m = p1.padStart(2, '0');
                                        const d = p2.padStart(2, '0');
                                        return `${d}/${m}/${y}`;
                                    }

                                    // Caso 2: DD-MM-YYYY o DD/MM/YY (tercer elemento es el año)
                                    let y = p2;
                                    if (y.length === 2) y = `20${y}`;
                                    const d = p0.padStart(2, '0');
                                    const m = p1.padStart(2, '0');
                                    return `${d}/${m}/${y}`;
                                }
                            }
                            return str;
                        };

                        const batch = writeBatch(db);
                        rows.forEach(row => {
                            const id = generateUUID();
                            const rawCond = String(row['CONDICION'] || row['Condicion'] || row['CONDICIÓN'] || row['Condición'] || row['OBSERVACION'] || row['Observacion'] || '').trim();
                            const rawPrecioCol = String(row['PRECIO'] || row['Precio'] || row['VALOR'] || row['Valor'] || '').trim();
                            
                            // Extraer precio si viene en columna dedicada o dentro de la condición (ej: "$5233.06", "13887,20$", "$ 450", "421.4")
                            let extractedPrice: number | undefined = undefined;
                            if (rawPrecioCol) {
                                const numDirect = parseFloat(rawPrecioCol.replace(/[^\d.,]/g, '').replace(',', '.'));
                                if (!isNaN(numDirect) && numDirect > 0) extractedPrice = numDirect;
                            }
                            if (extractedPrice === undefined && (rawCond.includes('$') || /\d/.test(rawCond))) {
                                const priceMatch = rawCond.match(/(?:[\$€£]|USD)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?)\s*(?:[\$€£]|USD)?/i);
                                if (priceMatch) {
                                    let cleanNumStr = priceMatch[1];
                                    if (cleanNumStr.includes('.') && cleanNumStr.includes(',')) {
                                        cleanNumStr = cleanNumStr.replace(/\./g, '').replace(',', '.');
                                    } else if (cleanNumStr.includes(',')) {
                                        cleanNumStr = cleanNumStr.replace(',', '.');
                                    }
                                    const numCandidate = parseFloat(cleanNumStr);
                                    if (!isNaN(numCandidate) && numCandidate > 0) {
                                        extractedPrice = numCandidate;
                                    }
                                }
                            }

                            // Normalizar condición agrupando en: Contrato de Servicios, Garantías, DOA, Wrong Shipment, Concesión Comercial, Ventas
                            const cleanCondition = normalizeSparePartCondition(rawCond, extractedPrice);

                            const sp: any = {
                                pn:          String(row['P/N'] || row['PN'] || row['pn'] || '').trim(),
                                descripcion: String(row['DESCRIPCIÓN'] || row['DESCRIPCION'] || row['Descripción'] || '').trim(),
                                cantidad:    Number(row['CANTIDAD'] || row['Cantidad'] || 1),
                                cliente:     String(row['CLIENTE'] || row['Cliente'] || '').trim(),
                                mod:         String(row['MOD'] || row['Mod'] || '').trim(),
                                equipo:      String(row['Equipo'] || row['EQUIPO'] || '').trim(),
                                workflow_id: String(row['WF'] || row['Wf'] || '').trim(),
                                orden_ge:    String(row['ORDEN'] || row['Orden'] || '').trim(),
                                condicion:   cleanCondition,
                                observacion: rawCond,
                                mes:         String(row['MES'] || row['Mes'] || '').trim(),
                                anio:        Number(row['Año'] || row['AÑO'] || row['anio'] || new Date().getFullYear()),
                                fecha_pedido:            formatDate(row['Fecha pedido'] || row['FECHA PEDIDO']),
                                fecha_llegada:           formatDate(row['Fecha llegada'] || row['FECHA LLEGADA']),
                                fecha_despacho:          formatDate(row['Fecha Despacho Instalada'] || row['FECHA DESPACHO']),
                                fecha_egreso:            formatDate(row['Egreso'] || row['EGRESO']),
                                fecha_instalacion:       formatDate(row['Fecha de instalación'] || row['FECHA INSTALACION']),
                                fecha_llegada_tentativa: formatDate(row['Fecha Llegada tentativa'] || row['FECHA LLEGADA TENTATIVA']),
                                created_by: currentUser.name,
                                created_at: new Date().toISOString(),
                                source: 'CSV_IMPORT',
                            };
                            if (extractedPrice !== undefined) {
                                sp.precio = extractedPrice;
                            }
                            batch.set(doc(db, 'spare_parts', id), sp);
                        });
                        await batch.commit();
                        showToast(`✅ ${rows.length} repuestos importados con fechas corregidas.`, 'success', 6000);
                    } catch (err: any) {
                        showError(`Error al importar: ${err.message}`);
                    } finally {
                        setCsvImporting(false);
                        e.target.value = '';
                    }
                };

                // ── Vaciar base de repuestos (solo Admin / Alexis) ────────
                const handleClearSpareParts = async () => {
                    if (!canManageSpareParts || spareParts.length === 0 || !currentUser) return;
                    const confirmed = await showConfirm(`⚠ ¿Eliminar TODOS los ${spareParts.length} registros de repuestos actuales para volver a subir el archivo limpio? Esta acción no se puede deshacer.`);
                    if (!confirmed) return;

                    try {
                        const BATCH_SIZE = 400;
                        for (let i = 0; i < spareParts.length; i += BATCH_SIZE) {
                            const chunk = spareParts.slice(i, i + BATCH_SIZE);
                            const batch = writeBatch(db);
                            chunk.forEach(sp => {
                                batch.delete(doc(db, 'spare_parts', sp.id));
                            });
                            await batch.commit();
                        }
                        showToast('Base de repuestos vaciada. Ahora puedes importar el archivo limpio.', 'info', 5000);
                    } catch (err: any) {
                        showError(`Error al vaciar: ${err.message}`);
                    }
                };

                // ── Agrupar y normalizar condiciones en base de datos (Admin / Alexis) ──
                const handleBatchNormalizeConditions = async () => {
                    if (!canManageSpareParts || spareParts.length === 0 || !currentUser) return;

                    const needsUpdate = spareParts.filter(sp => {
                        const normalized = normalizeSparePartCondition(sp.condicion, sp.precio);
                        return sp.condicion !== normalized;
                    });

                    if (needsUpdate.length === 0) {
                        showToast('Todas las condiciones de los repuestos ya se encuentran agrupadas y normalizadas.', 'info', 4000);
                        return;
                    }

                    const confirmed = await showConfirm(
                        `¿Deseas agrupar y actualizar ${needsUpdate.length} repuestos a las categorías estándar?\n\n` +
                        `• CONTRATO DE SERVICIOS\n• GARANTÍAS\n• DOA\n• WRONG SHIPMENT\n• CONCESIÓN COMERCIAL\n• VENTAS\n\n` +
                        `Esta acción actualizará los registros directamente en la base de datos.`
                    );
                    if (!confirmed) return;

                    try {
                        const BATCH_SIZE = 400;
                        let updatedCount = 0;
                        for (let i = 0; i < needsUpdate.length; i += BATCH_SIZE) {
                            const chunk = needsUpdate.slice(i, i + BATCH_SIZE);
                            const batch = writeBatch(db);
                            chunk.forEach(sp => {
                                const targetCond = normalizeSparePartCondition(sp.condicion, sp.precio);
                                batch.update(doc(db, 'spare_parts', sp.id), {
                                    condicion: targetCond
                                });
                            });
                            await batch.commit();
                            updatedCount += chunk.length;
                        }
                        showToast(`✅ ${updatedCount} repuestos agrupados y normalizados con éxito.`, 'success', 5000);
                    } catch (err: any) {
                        showError(`Error al normalizar condiciones: ${err.message}`);
                    }
                };

                // ── Eliminar un repuesto individual (Admin / Alexis) ───────
                const handleDeleteSparePart = async (sp: SparePart) => {
                    if (!canManageSpareParts || !currentUser) return;
                    const confirmed = await showConfirm(`¿Eliminar el repuesto "${sp.pn} - ${sp.descripcion}" del catálogo?\n\nEsta acción no se puede deshacer.`);
                    if (!confirmed) return;
                    try {
                        await deleteDoc(doc(db, 'spare_parts', sp.id));
                        showToast('Repuesto eliminado correctamente.', 'success');
                    } catch (err: any) {
                        showError(`Error al eliminar: ${err.message}`);
                    }
                };

                // ── Actualizar repuesto editado ────────────────────────────
                const handleUpdateSparePart = async (e: React.FormEvent) => {
                    e.preventDefault();
                    if (!editingSparePart || !currentUser) return;
                    const fd = new FormData(e.target as HTMLFormElement);
                    const rawPrecio = (fd.get('precio') as string || '').trim();
                    const numPrecio = rawPrecio ? parseFloat(rawPrecio) : undefined;
                    const fechaPed = (fd.get('fecha_pedido') as string || '').trim();

                    // Recalcular mes y año automáticamente si fecha_pedido está presente
                    let anioVal = editingSparePart.anio;
                    let mesVal = editingSparePart.mes;
                    if (fechaPed) {
                        const dp = getSparePartDateParts({ ...editingSparePart, fecha_pedido: fechaPed });
                        if (dp.anio) anioVal = Number(dp.anio);
                        if (dp.mes) {
                            const mesIdx = Number(dp.mes) - 1;
                            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                            if (mesIdx >= 0 && mesIdx < 12) mesVal = monthNames[mesIdx];
                        }
                    }

                    const updatedData: any = {
                        pn: (fd.get('pn') as string || '').trim(),
                        cantidad: Number(fd.get('cantidad')) || 1,
                        descripcion: (fd.get('descripcion') as string || '').trim(),
                        cliente: (fd.get('cliente') as string || '').trim(),
                        mod: (fd.get('mod') as string || '').trim(),
                        equipo: (fd.get('equipo') as string || '').trim(),
                        condicion: normalizeSparePartCondition((fd.get('condicion') as string || '').trim(), numPrecio),
                        orden_ge: (fd.get('orden_ge') as string || '').trim(),
                        workflow_id: (fd.get('workflow_id') as string || '').trim(),
                        fecha_pedido: fechaPed,
                        fecha_instalacion: (fd.get('fecha_instalacion') as string || '').trim(),
                        fecha_llegada: (fd.get('fecha_llegada') as string || '').trim(),
                        observacion: (fd.get('observacion') as string || '').trim(),
                        anio: anioVal,
                        mes: mesVal,
                    };
                    if (numPrecio !== undefined && !isNaN(numPrecio)) {
                        updatedData.precio = numPrecio;
                    }

                    try {
                        await updateDoc(doc(db, 'spare_parts', editingSparePart.id), updatedData);
                        showToast('Repuesto actualizado con éxito.', 'success');
                        setEditingSparePart(null);
                    } catch (err: any) {
                        showError(`Error al actualizar: ${err.message}`);
                    }
                };

                // ── Sincronizar solicitudes y activos existentes a Repuestos 
                const handleSyncFromRequests = async () => {
                    if (!currentUser || assets.length === 0) return;
                    const existingAssetIds = new Set(spareParts.map(sp => sp.asset_id).filter(Boolean));
                    const pendingAssets = assets.filter(a => !existingAssetIds.has(a.id));
                    if (pendingAssets.length === 0) {
                        showToast('Todas las solicitudes existentes ya se encuentran en Repuestos.', 'info');
                        return;
                    }
                    const confirmed = await showConfirm(`¿Sincronizar ${pendingAssets.length} solicitudes/activos existentes a la Base de Repuestos?`);
                    if (!confirmed) return;

                    try {
                        const batch = writeBatch(db);
                        const now = new Date();
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const defaultFecha = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
                        const mesNombre = now.toLocaleString('es-ES', { month: 'long' });
                        const capitalizedMes = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

                        pendingAssets.forEach(a => {
                            const spId = generateUUID();
                            let fechaPed = defaultFecha;
                            let anioVal = now.getFullYear();
                            let mesVal = capitalizedMes;

                            if (a.metadata.fecha_solicitud) {
                                const d = new Date(a.metadata.fecha_solicitud);
                                if (!isNaN(d.getTime())) {
                                    fechaPed = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                    anioVal = d.getFullYear();
                                    const mName = d.toLocaleString('es-ES', { month: 'long' });
                                    mesVal = mName.charAt(0).toUpperCase() + mName.slice(1);
                                }
                            }

                            const spRecord: any = {
                                id: spId,
                                pn: a.metadata.pn || '',
                                descripcion: a.metadata.description || '',
                                cantidad: a.metadata.cantidad || 1,
                                cliente: a.metadata.cliente_final || '',
                                mod: a.metadata.equipo_destino || '',
                                equipo: a.metadata.equipo_destino || '',
                                workflow_id: a.metadata.workflow_id || '',
                                orden_ge: a.metadata.numero_orden_ge || '',
                                condicion: normalizeSparePartCondition(a.metadata.condicion, a.metadata.cost),
                                observacion: `Sincronizado desde Solicitud (${a.current_status})`,
                                mes: mesVal,
                                anio: anioVal,
                                fecha_pedido: fechaPed,
                                fecha_llegada: '',
                                fecha_despacho: a.current_status === AssetStatus.DISPATCHED ? fechaPed : '',
                                fecha_egreso: '',
                                fecha_instalacion: '',
                                fecha_llegada_tentativa: '',
                                asset_id: a.id,
                                created_by: currentUser.name || currentUser.id,
                                created_at: a.metadata.fecha_solicitud || now.toISOString(),
                                source: 'SOLICITUD'
                            };
                            if (a.metadata.cost && a.metadata.cost > 0) {
                                spRecord.precio = a.metadata.cost;
                            }
                            batch.set(doc(db, "spare_parts", spId), spRecord);
                        });
                        await batch.commit();
                        showToast(`✅ ${pendingAssets.length} solicitudes sincronizadas a Repuestos.`, 'success');
                    } catch (err: any) {
                        showError(`Error al sincronizar solicitudes: ${err.message}`);
                    }
                };

                // Helper para formatear fechas de exportación en formato DD/MM/AAAA
                const formatExportDate = (val: any): string => {
                    if (!val && val !== 0) return '';
                    const num = Number(val);
                    if (!isNaN(num) && num > 20000 && num < 80000 && !String(val).includes('/') && !String(val).includes('-')) {
                        const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
                        if (!isNaN(d.getTime())) {
                            return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
                        }
                    }
                    const str = String(val).trim();
                    const sep = str.includes('/') ? '/' : str.includes('-') ? '-' : null;
                    if (sep) {
                        const p = str.split('T')[0].split(sep);
                        if (p.length === 3) {
                            const p0 = p[0].trim();
                            const p1 = p[1].trim();
                            const p2 = p[2].trim();
                            if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
                                const y = p0.length === 2 ? `20${p0}` : p0;
                                return `${p2.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
                            }
                            let y = p2;
                            if (y.length === 2) y = `20${y}`;
                            return `${p0.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
                        }
                    }
                    return str;
                };

                // ── Exportar Excel (con Anti-Formula Injection y Auditoría DLP) ──
                const handleExportSpareParts = async () => {
                    const rows = filteredSpareParts.map(sp => sanitizeRow({
                        'P/N': sp.pn,
                        'DESCRIPCIÓN': sp.descripcion,
                        'CANTIDAD': sp.cantidad,
                        'CLIENTE': sp.cliente,
                        'MOD': sp.mod,
                        'EQUIPO': sp.equipo,
                        'WF': sp.workflow_id,
                        'ORDEN GE': sp.orden_ge,
                        'CONDICIÓN': normalizeSparePartCondition(sp.condicion, sp.precio),
                        'PRECIO': sp.precio !== undefined ? sp.precio : '',
                        'OBSERVACIÓN': sp.observacion,
                        'MES': sp.mes,
                        'AÑO': sp.anio,
                        'FECHA PEDIDO': formatExportDate(sp.fecha_pedido),
                        'FECHA LLEGADA': formatExportDate(sp.fecha_llegada),
                        'FECHA DESPACHO': formatExportDate(sp.fecha_despacho),
                        'EGRESO': formatExportDate(sp.fecha_egreso),
                        'FECHA INSTALACIÓN': formatExportDate(sp.fecha_instalacion),
                        'LLEGADA TENTATIVA': formatExportDate(sp.fecha_llegada_tentativa),
                        'ORIGEN': sp.source === 'CSV_IMPORT' ? 'CSV' : sp.source === 'SOLICITUD' ? 'SOLICITUD' : 'MANUAL',
                    }));
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, 'REPUESTOS');
                    XLSX.writeFile(wb, `BASE_REPUESTOS_${new Date().toISOString().slice(0,10)}.xlsx`);
                    showToast(`Excel con ${rows.length} repuestos exportado correctamente.`, 'success');

                    // Trazabilidad Forense / Auditoría DLP (Prevención de fuga de datos)
                    try {
                        const logId = generateUUID();
                        await setDoc(doc(db, 'audit_log', logId), {
                            id: logId,
                            asset_id: 'EXPORT_REPUESTOS',
                            actor_id: currentUser?.name || currentUser?.id || 'DESCONOCIDO',
                            action: 'EXPORT_DATA',
                            prev_value: null,
                            new_value: {
                                total_records: rows.length,
                                exported_at: new Date().toISOString(),
                                module: 'REPUESTOS',
                                actor_role: currentUser?.role || 'DESCONOCIDO'
                            },
                            timestamp: new Date().toISOString()
                        });
                    } catch (auditErr) {
                        console.warn('No se pudo registrar la auditoría de exportación:', auditErr);
                    }
                };

                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* ── Header ── */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                    <Package size={28} className="text-emerald-500"/> Base Instalada de Repuestos
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                    Historial de repuestos instalados en clientes. Se actualiza automáticamente con cada solicitud.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Importar CSV */}
                                <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer transition-all border ${csvImporting ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>
                                    {csvImporting ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                                    {csvImporting ? 'Importando...' : 'Importar CSV/Excel'}
                                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleCsvImport} disabled={csvImporting}/>
                                </label>

                                {/* Sincronizar desde Solicitudes existentes */}
                                {assets.length > 0 && (
                                    <button 
                                        onClick={handleSyncFromRequests}
                                        title="Sincronizar repuestos provenientes de solicitudes y activos del sistema"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all"
                                    >
                                        <RefreshCw size={13}/> Sincronizar Solicitudes
                                    </button>
                                )}

                                {/* Agrupar y normalizar condiciones en base de datos (solo Admin / Alexis) */}
                                {canManageSpareParts && spareParts.length > 0 && (
                                    <button 
                                        onClick={handleBatchNormalizeConditions}
                                        title="Agrupa y normaliza las condiciones de los repuestos en las 4 categorías estándar (Contrato de Servicios, Garantías, DOA, Ventas)"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 transition-all"
                                    >
                                        <CheckSquare size={13}/> Agrupar Condiciones
                                    </button>
                                )}

                                {/* Limpiar catálogo actual (solo Admin / Alexis) */}
                                {canManageSpareParts && spareParts.length > 0 && (
                                    <button 
                                        onClick={handleClearSpareParts}
                                        title="Eliminar todos los registros para volver a subir el archivo limpio"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 hover:bg-red-100 transition-all"
                                    >
                                        <Trash2 size={13}/> Vaciar base
                                    </button>
                                )}

                                {/* Exportar */}
                                <button onClick={handleExportSpareParts} disabled={filteredSpareParts.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-40">
                                    <Download size={14}/> Exportar Excel
                                </button>

                                {/* Egreso Digital */}
                                <button 
                                    onClick={() => {
                                        if (selectedSparePartIds.size > 0) {
    const selParts = spareParts.filter(p => selectedSparePartIds.has(p.id));
    const firstClient = selParts.map(p => {
      if (p.cliente && p.cliente.trim() !== '' && p.cliente.trim().toUpperCase() !== 'STOCK') return p.cliente.trim();
      const a = p.asset_id ? assets.find(x => x.id === p.asset_id) : undefined;
      if (a?.metadata?.cliente_final && a.metadata.cliente_final.trim().toUpperCase() !== 'STOCK') return a.metadata.cliente_final.trim();
      return '';
    }).find(c => Boolean(c)) || '';
    const items = selParts.map(sp => ({
      codigo: sp.pn || '',
      cantidad: Number(sp.cantidad) || 1,
      descripcion: sp.descripcion || '',
      serial_number: '',
      spare_part_id: sp.id
    }));
    onOpenDigitalEgress('REPUESTOS', firstClient, items);
  } else {
    onOpenDigitalEgress('REPUESTOS', '', []);
  }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-all shadow-sm"
                                    title="Generar documento oficial de Egreso Digital con firma y sello ORIMEC"
                                >
                                    <FileText size={14}/> Egreso Digital
                                    {selectedSparePartIds.size > 0 && (
                                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                                            {selectedSparePartIds.size}
                                        </span>
                                    )}
                                </button>

                                {/* Nuevo manual */}
                                <button onClick={() => setShowSparePartModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm">
                                    <Plus size={14}/> Nuevo registro
                                </button>
                            </div>
                        </div>

                        {/* ── Switcher de Vistas: Catálogo vs Métricas ── */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setSparePartsViewMode('TABLE')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                        sparePartsViewMode === 'TABLE'
                                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Database size={14}/> Catálogo e Inventario
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-bold text-slate-700 dark:text-slate-300">
                                        {spareParts.length.toLocaleString()}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setSparePartsViewMode('ANALYTICS')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                        sparePartsViewMode === 'ANALYTICS'
                                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <BarChart3 size={14}/> Métricas y Analítica
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                        Executive
                                    </span>
                                </button>
                            </div>

                            {sparePartsViewMode === 'ANALYTICS' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Alcance:</span>
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={() => setSparePartsAnalyticsScope('GLOBAL')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
                                                sparePartsAnalyticsScope === 'GLOBAL'
                                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Base Completa ({spareParts.length.toLocaleString()})
                                        </button>
                                        <button
                                            onClick={() => setSparePartsAnalyticsScope('FILTERED')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
                                                sparePartsAnalyticsScope === 'FILTERED'
                                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            Filtro Activo ({filteredSpareParts.length.toLocaleString()})
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {sparePartsViewMode === 'TABLE' ? (
                            <>
                        {/* ── KPIs ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Registros</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{spareParts.length.toLocaleString()}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">{totalUnidades.toLocaleString()} unidades</p>
                                </div>
                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><Package size={20} className="text-emerald-500"/></div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Clientes</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{uniqueClientes.length}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">únicos en base</p>
                                </div>
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Users size={20} className="text-blue-500"/></div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Modalidades</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{uniqueMods.length}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">{uniqueMods.slice(0,3).join(', ')}</p>
                                </div>
                                <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><Cpu size={20} className="text-purple-500"/></div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mostrando</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{filteredSpareParts.length.toLocaleString()}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">con filtros actuales</p>
                                </div>
                                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><Database size={20} className="text-amber-500"/></div>
                            </div>
                        </div>

                        {/* ── Filtros ── */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 items-center">
                                {/* Búsqueda */}
                                <div className="relative flex-1 min-w-[220px]">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                                    <input
                                        type="text"
                                        placeholder="Buscar P/N, descripción, cliente, orden..."
                                        value={sparePartsSearch}
                                        onChange={e => handleSparePartsSearchChange(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
                                    />
                                    {sparePartsSearch && (
                                        <button onClick={() => { setSparePartsSearch(''); setSparePartsDebouncedSearch(''); }} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                            <X size={14}/>
                                        </button>
                                    )}
                                </div>
                                {/* Ordenamiento */}
                                <div className="flex items-center gap-1.5">
                                    <ArrowUpDown size={14} className="text-slate-400" />
                                    <select
                                        value={sparePartsSort}
                                        onChange={e => setSparePartsSort(e.target.value as any)}
                                        className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-400"
                                    >
                                        <option value="newest">📅 F. Pedido más reciente</option>
                                        <option value="oldest">📅 F. Pedido más antigua</option>
                                        <option value="ge_newest">🔢 Orden GE más reciente</option>
                                        <option value="ge_oldest">🔢 Orden GE más antigua</option>
                                        <option value="pn_az">🔤 P/N (A - Z)</option>
                                        <option value="pn_za">🔤 P/N (Z - A)</option>
                                        <option value="cliente_az">🏢 Cliente (A - Z)</option>
                                    </select>
                                </div>
                                {/* Filtro Jerárquico: Año -> Mes -> Día */}
                                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
                                        <Calendar size={12} className="text-emerald-500" /> Fecha:
                                    </span>
                                    {/* Año */}
                                    <FilterSelect 
                                        value={sparePartsFilterAnio} 
                                        onChange={(v) => { setSparePartsFilterAnio(v); setSparePartsFilterMes(''); setSparePartsFilterDia(''); setSparePartsPage(1); }} 
                                        placeholder="Todos los Años"
                                        options={(uniqueAnios as string[]).map(a => ({ value: a, label: `Año ${a}` }))} 
                                    />
                                    {/* Mes (disponible siempre o dependiente del año) */}
                                    <FilterSelect 
                                        value={sparePartsFilterMes} 
                                        onChange={(v) => { setSparePartsFilterMes(v); setSparePartsFilterDia(''); setSparePartsPage(1); }} 
                                        placeholder="Todos los Meses"
                                        options={uniqueMeses} 
                                    />
                                    {/* Día (disponible dinámicamente) */}
                                    <FilterSelect 
                                        value={sparePartsFilterDia} 
                                        onChange={(v) => { setSparePartsFilterDia(v); setSparePartsPage(1); }} 
                                        placeholder="Todos los Días"
                                        options={uniqueDias} 
                                    />
                                </div>
                                {/* MOD */}
                                <FilterSelect value={sparePartsFilterMod} onChange={(v) => { setSparePartsFilterMod(v); setSparePartsPage(1); }} placeholder="Todas las MOD"
                                    options={(uniqueMods as string[]).sort().map(m => ({ value: m, label: m }))} />
                                {/* Condición */}
                                <FilterSelect value={sparePartsFilterCondicion} onChange={(v) => { setSparePartsFilterCondicion(v); setSparePartsPage(1); }} placeholder="Todas las condiciones"
                                    options={(uniqueCondiciones as string[]).sort().map(c => ({ value: c, label: c }))} />
                                {/* Origen (Excel vs Solicitud vs Manual) */}
                                <FilterSelect value={sparePartsFilterOrigen} onChange={(v) => { setSparePartsFilterOrigen(v); setSparePartsPage(1); }} placeholder="Todos los orígenes"
                                    options={[
                                        { value: 'SOLICITUD', label: 'Origen: Solicitud' },
                                        { value: 'CSV_IMPORT', label: 'Origen: Excel / CSV' },
                                        { value: 'MANUAL', label: 'Origen: Manual' }
                                    ]} />
                                {(sparePartsSearch || sparePartsFilterAnio || sparePartsFilterMes || sparePartsFilterDia || sparePartsFilterMod || sparePartsFilterCondicion || sparePartsFilterOrigen || sparePartsSort !== 'newest') && (
                                    <button onClick={() => { 
                                        setSparePartsSearch(''); 
                                        setSparePartsDebouncedSearch(''); 
                                        setSparePartsFilterAnio(''); 
                                        setSparePartsFilterMes(''); 
                                        setSparePartsFilterDia(''); 
                                        setSparePartsFilterMod(''); 
                                        setSparePartsFilterCondicion(''); 
                                        setSparePartsFilterOrigen('');
                                        setSparePartsSort('newest'); 
                                        setSparePartsPage(1);
                                    }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                        <X size={11}/> Limpiar
                                    </button>
                                )}
                            </div>

                            {/* ── Tabla ── */}
                            <div className="overflow-x-auto">
                                {sparePartsLoading ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <Loader2 size={32} className="animate-spin mx-auto mb-3 text-emerald-400"/>
                                        <p className="text-xs font-black uppercase tracking-widest">Cargando base de repuestos...</p>
                                    </div>
                                ) : filteredSpareParts.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <Package size={48} className="mx-auto mb-4 opacity-20"/>
                                        <p className="font-black uppercase text-xs tracking-widest mb-2">
                                            {spareParts.length === 0 ? 'No hay repuestos registrados' : 'Sin resultados para los filtros aplicados'}
                                        </p>
                                        {spareParts.length === 0 && (
                                            <p className="text-[11px] text-slate-500 mt-2 max-w-xs mx-auto">
                                                Importa tu base de datos desde un archivo Excel/CSV usando el botón "Importar CSV/Excel"
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left min-w-[1100px]">
                                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest text-[10px] border-b border-slate-100 dark:border-slate-700 select-none">
                                            <tr>
                                                <th className="w-10 px-3 py-3 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={paginatedSpareParts.length > 0 && paginatedSpareParts.every(sp => selectedSparePartIds.has(sp.id))}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedSparePartIds);
                                                            if (e.target.checked) {
                                                                paginatedSpareParts.forEach(sp => next.add(sp.id));
                                                            } else {
                                                                paginatedSpareParts.forEach(sp => next.delete(sp.id));
                                                            }
                                                            setSelectedSparePartIds(next);
                                                        }}
                                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        title="Seleccionar todos los de esta página"
                                                    />
                                                </th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:text-emerald-500 transition-colors"
                                                    onClick={() => setSparePartsSort(s => s === 'pn_az' ? 'pn_za' : 'pn_az')}
                                                    title="Ordenar por P/N"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        P/N {sparePartsSort === 'pn_az' ? '▲' : sparePartsSort === 'pn_za' ? '▼' : ''}
                                                    </span>
                                                </th>
                                                <th className="px-4 py-3">Descripción</th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:text-emerald-500 transition-colors"
                                                    onClick={() => setSparePartsSort(s => s === 'cliente_az' ? 'newest' : 'cliente_az')}
                                                    title="Ordenar por Cliente"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        Cliente {sparePartsSort === 'cliente_az' ? '▲' : ''}
                                                    </span>
                                                </th>
                                                <th className="px-4 py-3 text-center">MOD</th>
                                                <th className="px-4 py-3">Equipo</th>
                                                <th className="px-4 py-3 text-center">Cant.</th>
                                                <th className="px-4 py-3">Condición</th>
                                                <th className="px-4 py-3 text-right">Precio (USD)</th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:text-emerald-500 transition-colors"
                                                    onClick={() => setSparePartsSort(s => s === 'ge_newest' ? 'ge_oldest' : 'ge_newest')}
                                                    title="Ordenar por Orden GE"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        Orden GE {sparePartsSort === 'ge_newest' ? '▼' : sparePartsSort === 'ge_oldest' ? '▲' : ''}
                                                    </span>
                                                </th>
                                                <th 
                                                    className="px-4 py-3 cursor-pointer hover:text-emerald-500 transition-colors"
                                                    onClick={() => setSparePartsSort(s => s === 'newest' ? 'oldest' : 'newest')}
                                                    title="Ordenar por Fecha"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        F. Pedido {sparePartsSort === 'newest' ? '▼' : sparePartsSort === 'oldest' ? '▲' : ''}
                                                    </span>
                                                </th>
                                                <th className="px-4 py-3">F. Instalación</th>
                                                <th className="px-4 py-3 text-center">Origen</th>
                                                {canManageSpareParts && (
                                                    <th className="px-4 py-3 text-right">Acciones</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {paginatedSpareParts.map(sp => {
                                                const linkedAsset = sp.asset_id ? assets.find(a => a.id === sp.asset_id) : undefined;
                                                const isSelected = selectedSparePartIds.has(sp.id);
                                                return (
                                                    <tr key={sp.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
                                                        <td className="w-10 px-3 py-3 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    const next = new Set(selectedSparePartIds);
                                                                    if (e.target.checked) {
                                                                        next.add(sp.id);
                                                                    } else {
                                                                        next.delete(sp.id);
                                                                    }
                                                                    setSelectedSparePartIds(next);
                                                                }}
                                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">{sp.pn || '—'}</span>
                                                                {sp.fecha_egreso && (
                                                                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 w-fit">
                                                                        Egreso: {sp.fecha_egreso}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[200px]">
                                                            <span className="text-slate-700 dark:text-slate-300 line-clamp-2" title={sp.descripcion}>{sp.descripcion || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px] block" title={sp.cliente}>{sp.cliente || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                                                {sp.mod || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px] block" title={sp.equipo}>{sp.equipo || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{sp.cantidad ?? 1}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {(() => {
                                                                const condNorm = normalizeSparePartCondition(sp.condicion, sp.precio);
                                                                return (
                                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                        condNorm === 'CONTRATO DE SERVICIOS'
                                                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                                            : condNorm === 'GARANTÍAS'
                                                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                                            : condNorm === 'DOA'
                                                                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                                            : condNorm === 'WRONG SHIPMENT'
                                                                            ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                                                                            : condNorm === 'CONCESIÓN COMERCIAL'
                                                                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                                                            : condNorm === 'VENTAS'
                                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                                    }`}>
                                                                        {condNorm}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {sp.precio !== undefined ? (
                                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                                    ${sp.precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-[10px]">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{sp.orden_ge || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                            {formatSparePartDisplayDate(sp.fecha_pedido)}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                            {formatSparePartDisplayDate(sp.fecha_instalacion)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                    sp.source === 'CSV_IMPORT' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                                                    : sp.source === 'SOLICITUD' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                                    : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {sp.source === 'CSV_IMPORT' ? 'Excel' : sp.source === 'SOLICITUD' ? 'Solicitud' : 'Manual'}
                                                                </span>
                                                                {linkedAsset && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedAssetId(linkedAsset.id);
                                                                            setActiveTab('LOGISTICS');
                                                                        }}
                                                                        title={`Ver en Logística: Estado ${linkedAsset.current_status}`}
                                                                        className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors uppercase tracking-wider"
                                                                    >
                                                                        {linkedAsset.current_status === 'SOLICITADO' || linkedAsset.current_status === 'DRAFT' ? 'En Solicitud' :
                                                                         linkedAsset.current_status === 'ORDERED' || linkedAsset.current_status === 'IN_TRANSIT' ? 'En Logística' :
                                                                         linkedAsset.current_status === 'CUSTOMS' ? 'En Aduana' :
                                                                         linkedAsset.current_status === 'RECEIVED_WH' ? 'En Bodega' :
                                                                         linkedAsset.current_status === 'DISPATCHED' ? 'Despachado' : linkedAsset.current_status}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {canManageSpareParts && (
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (selectedSparePartIds.size > 0) {
    const selParts = spareParts.filter(p => selectedSparePartIds.has(p.id));
    const firstClient = selParts.map(p => {
      if (p.cliente && p.cliente.trim() !== '' && p.cliente.trim().toUpperCase() !== 'STOCK') return p.cliente.trim();
      const a = p.asset_id ? assets.find(x => x.id === p.asset_id) : undefined;
      if (a?.metadata?.cliente_final && a.metadata.cliente_final.trim().toUpperCase() !== 'STOCK') return a.metadata.cliente_final.trim();
      return '';
    }).find(c => Boolean(c)) || '';
    const items = selParts.map(sp => ({
      codigo: sp.pn || '',
      cantidad: Number(sp.cantidad) || 1,
      descripcion: sp.descripcion || '',
      serial_number: '',
      spare_part_id: sp.id
    }));
    onOpenDigitalEgress('REPUESTOS', firstClient, items);
  } else {
    onOpenDigitalEgress('REPUESTOS', '', []);
  }
                                                                        }} 
                                                                        title="Generar Egreso Digital para este repuesto"
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all"
                                                                    >
                                                                        <FileText size={15}/>
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setEditingSparePart(sp)} 
                                                                        title="Editar repuesto"
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                                                    >
                                                                        <Edit3 size={15}/>
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleDeleteSparePart(sp)} 
                                                                        title="Eliminar repuesto"
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                                                                    >
                                                                        <Trash2 size={15}/>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Footer con Paginación de Alto Rendimiento */}
                            {filteredSpareParts.length > 0 && (
                                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                                            Mostrando <span className="text-slate-800 dark:text-slate-200">{(sparePartsPage - 1) * sparePartsPageSize + 1}</span> - <span className="text-slate-800 dark:text-slate-200">{Math.min(sparePartsPage * sparePartsPageSize, filteredSpareParts.length)}</span> de <span className="text-slate-800 dark:text-slate-200 font-black">{filteredSpareParts.length}</span> repuestos {filteredSpareParts.length !== spareParts.length && `(filtrados de ${spareParts.length})`}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <span className="text-[10px] uppercase font-bold">Por pág:</span>
                                            <select 
                                                value={sparePartsPageSize} 
                                                onChange={e => { setSparePartsPageSize(Number(e.target.value)); setSparePartsPage(1); }}
                                                className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
                                            >
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                                <option value={200}>200</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Controles de Navegación */}
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            disabled={sparePartsPage <= 1}
                                            onClick={() => setSparePartsPage(1)}
                                            title="Primera página"
                                            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs font-bold"
                                        >
                                            &laquo;
                                        </button>
                                        <button 
                                            disabled={sparePartsPage <= 1}
                                            onClick={() => setSparePartsPage(p => Math.max(1, p - 1))}
                                            title="Página anterior"
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs font-bold"
                                        >
                                            <ChevronLeft size={14}/> Anterior
                                        </button>
                                        <div className="px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                                            {sparePartsPage} / {totalSparePartsPages}
                                        </div>
                                        <button 
                                            disabled={sparePartsPage >= totalSparePartsPages}
                                            onClick={() => setSparePartsPage(p => Math.min(totalSparePartsPages, p + 1))}
                                            title="Página siguiente"
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs font-bold"
                                        >
                                            Siguiente <ChevronRight size={14}/>
                                        </button>
                                        <button 
                                            disabled={sparePartsPage >= totalSparePartsPages}
                                            onClick={() => setSparePartsPage(totalSparePartsPages)}
                                            title="Última página"
                                            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all text-xs font-bold"
                                        >
                                            &raquo;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                            </>
                        ) : (
                            /* ── PANEL DE MÉTRICAS Y ANALÍTICA EJECUTIVA ── */
                            <div className="space-y-6 animate-fadeIn">
                                {/* ── Resumen de Alcance ── */}
                                <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-emerald-200/50 dark:border-emerald-800/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-sm">
                                            <TrendingUp size={20}/>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                                Inteligencia de Repuestos & Demanda de Clientes
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {sparePartsAnalyticsScope === 'GLOBAL'
                                                    ? `Analizando el histórico completo de ${sparePartsAnalytics.totalRegistros.toLocaleString()} registros (${sparePartsAnalytics.totalPiezas.toLocaleString()} piezas)`
                                                    : `Analizando segmento filtrado de ${sparePartsAnalytics.totalRegistros.toLocaleString()} registros (${sparePartsAnalytics.totalPiezas.toLocaleString()} piezas)`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Actualizado en tiempo real
                                    </div>
                                </div>

                                {/* ── KPIs Ejecutivos ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Top Cliente */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cliente #1 (Mayor Demanda)</p>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[200px]" title={sparePartsAnalytics.topCliente?.cliente || 'Sin datos'}>
                                                    {sparePartsAnalytics.topCliente?.cliente || 'Sin datos'}
                                                </h3>
                                            </div>
                                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                <Award size={22}/>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                {sparePartsAnalytics.topCliente?.totalUnidades.toLocaleString() || 0} unidades
                                            </span>
                                            <span className="text-slate-400">
                                                {sparePartsAnalytics.topCliente?.pns.size || 0} P/Ns distintos
                                            </span>
                                        </div>
                                    </div>

                                    {/* Top Repuesto */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-400 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Repuesto Más Solicitado</p>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[200px]" title={sparePartsAnalytics.topRepuesto?.pn || 'Sin datos'}>
                                                    {sparePartsAnalytics.topRepuesto?.pn || 'Sin datos'}
                                                </h3>
                                            </div>
                                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                                <Package size={22}/>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                            <span className="font-black text-blue-600 dark:text-blue-400">
                                                {sparePartsAnalytics.topRepuesto?.totalUnidades.toLocaleString() || 0} unidades
                                            </span>
                                            <span className="text-slate-400 truncate max-w-[130px]" title={sparePartsAnalytics.topRepuesto?.descripcion}>
                                                {sparePartsAnalytics.topRepuesto?.descripcion || '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Inversión Registrada */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Inversión Contabilizada</p>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                                    ${sparePartsAnalytics.totalInversion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </h3>
                                            </div>
                                            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
                                                <DollarSign size={22}/>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                            <span className="font-black text-amber-600 dark:text-amber-400">
                                                {sparePartsAnalytics.totalPiezas.toLocaleString()} unidades
                                            </span>
                                            <span className="text-slate-400">
                                                ${sparePartsAnalytics.totalPiezas > 0 ? (sparePartsAnalytics.totalInversion / sparePartsAnalytics.totalPiezas).toFixed(2) : '0.00'} prom/u
                                            </span>
                                        </div>
                                    </div>

                                    {/* Modalidad Principal */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-purple-400 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Modalidad con Mayor Cuota</p>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[200px]">
                                                    {sparePartsAnalytics.topModalidad?.name || 'N/A'}
                                                </h3>
                                            </div>
                                            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl">
                                                <Cpu size={22}/>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                            <span className="font-black text-purple-600 dark:text-purple-400">
                                                {sparePartsAnalytics.topModalidad?.value.toLocaleString() || 0} piezas
                                            </span>
                                            <span className="text-slate-400">
                                                {sparePartsAnalytics.totalPiezas > 0 ? Math.round(((sparePartsAnalytics.topModalidad?.value || 0) / sparePartsAnalytics.totalPiezas) * 100) : 0}% del total
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Gráficos Principales (2x2) ── */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Gráfico 1: Top Clientes */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                    <Building2 size={16} className="text-emerald-500"/> Top 10 Clientes que Más Piden Repuestos
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ranking por cantidad de unidades instaladas/requeridas</p>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                                Demanda
                                            </span>
                                        </div>
                                        {sparePartsAnalytics.topClientes.length === 0 ? (
                                            <p className="text-center py-12 text-slate-400 text-xs font-medium">No hay datos de clientes registrados para este período.</p>
                                        ) : (
                                            <div className="h-[320px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={sparePartsAnalytics.topClientes.slice(0, 10)}
                                                        layout="vertical"
                                                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                                    >
                                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                        <YAxis
                                                            type="category"
                                                            dataKey="cliente"
                                                            width={140}
                                                            stroke="#94a3b8"
                                                            fontSize={10}
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                                                            formatter={(val: any, _name: any, item: any) => [
                                                                `${val} unidades (${item.payload.pns?.size || 0} P/Ns distintos)`,
                                                                item.payload.cliente
                                                            ]}
                                                        />
                                                        <Bar dataKey="totalUnidades" name="Unidades" fill="#10b981" radius={[0, 6, 6, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>

                                    {/* Gráfico 2: Top Repuestos */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                    <Package size={16} className="text-blue-500"/> Top 10 Repuestos Más Frecuentes (P/N)
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Componentes con mayor rotación o tasa de recambio</p>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800">
                                                Frecuencia
                                            </span>
                                        </div>
                                        {sparePartsAnalytics.topRepuestos.length === 0 ? (
                                            <p className="text-center py-12 text-slate-400 text-xs font-medium">No hay repuestos registrados para este período.</p>
                                        ) : (
                                            <div className="h-[320px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={sparePartsAnalytics.topRepuestos.slice(0, 10)}
                                                        margin={{ top: 10, right: 20, left: -10, bottom: 45 }}
                                                    >
                                                        <XAxis
                                                            dataKey="pn"
                                                            stroke="#94a3b8"
                                                            fontSize={10}
                                                            angle={-30}
                                                            textAnchor="end"
                                                            interval={0}
                                                            tickLine={false}
                                                        />
                                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                                                            formatter={(val: any, _name: any, item: any) => [
                                                                `${val} unidades (${item.payload.clientes?.size || 0} clientes)`,
                                                                `${item.payload.pn}: ${item.payload.descripcion}`
                                                            ]}
                                                        />
                                                        <Bar dataKey="totalUnidades" name="Unidades" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>

                                    {/* Gráfico 3: Modalidad Médica (Donut) */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                    <Cpu size={16} className="text-purple-500"/> Distribución por Modalidad Médica
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Participación de repuestos por tipo de tecnología</p>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-800">
                                                Tecnología
                                            </span>
                                        </div>
                                        {sparePartsAnalytics.modalidadesList.length === 0 ? (
                                            <p className="text-center py-12 text-slate-400 text-xs font-medium">No hay modalidades registradas.</p>
                                        ) : (
                                            <div className="h-[280px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={sparePartsAnalytics.modalidadesList}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={95}
                                                            paddingAngle={3}
                                                        >
                                                            {sparePartsAnalytics.modalidadesList.map((entry, idx) => (
                                                                <Cell key={`mod-${idx}`} fill={sparePartsAnalytics.MOD_COLORS[idx % sparePartsAnalytics.MOD_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                                                            formatter={(val: any) => [
                                                                `${val} piezas (${sparePartsAnalytics.totalPiezas > 0 ? ((Number(val) / sparePartsAnalytics.totalPiezas) * 100).toFixed(1) : 0}%)`,
                                                                'Volumen'
                                                            ]}
                                                        />
                                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>

                                    {/* Gráfico 4: Equipos Médicos */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                    <Wrench size={16} className="text-amber-500"/> Equipos Médicos con Mayor Demanda
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Modelos de equipos que más componentes han requerido</p>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800">
                                                Modelos
                                            </span>
                                        </div>
                                        {sparePartsAnalytics.equiposList.filter(e => e.name !== 'No Especificado').length === 0 ? (
                                            <p className="text-center py-12 text-slate-400 text-xs font-medium">No hay equipos especificados en los registros.</p>
                                        ) : (
                                            <div className="h-[280px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={sparePartsAnalytics.equiposList.filter(e => e.name !== 'No Especificado').slice(0, 8)}
                                                        layout="vertical"
                                                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                                    >
                                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                        <YAxis
                                                            type="category"
                                                            dataKey="name"
                                                            width={140}
                                                            stroke="#94a3b8"
                                                            fontSize={10}
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
                                                            formatter={(val: any) => [`${val} repuestos instalados`, 'Equipo']}
                                                        />
                                                        <Bar dataKey="value" name="Repuestos" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Tablas de Ranking Detallado ── */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Ranking Clientes Clave */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                <Building2 size={15} className="text-emerald-500"/> Ranking Clientes Clave
                                            </h4>
                                            <span className="text-[10px] text-slate-400 font-bold">Top 8</span>
                                        </div>
                                        <div className="space-y-3">
                                            {sparePartsAnalytics.topClientes.slice(0, 8).map((c, i) => {
                                                const maxQty = sparePartsAnalytics.topClientes[0]?.totalUnidades || 1;
                                                const pct = Math.round((c.totalUnidades / maxQty) * 100);
                                                return (
                                                    <div key={c.cliente} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2.5">
                                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                                    i === 0 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                                                                    i === 1 ? 'bg-slate-300 text-slate-800' :
                                                                    i === 2 ? 'bg-amber-600 text-white' :
                                                                    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                                }`}>
                                                                    {i + 1}
                                                                </span>
                                                                <div>
                                                                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">{c.cliente}</p>
                                                                    <p className="text-[10px] text-slate-400">{c.pedidos} pedidos · {c.pns.size} repuestos únicos</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{c.totalUnidades.toLocaleString()} u.</p>
                                                                <p className="text-[10px] text-slate-400">{sparePartsAnalytics.totalPiezas > 0 ? ((c.totalUnidades / sparePartsAnalytics.totalPiezas) * 100).toFixed(1) : 0}% de cuota</p>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Ranking Repuestos Críticos */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                <Package size={15} className="text-blue-500"/> Ranking Repuestos Críticos
                                            </h4>
                                            <span className="text-[10px] text-slate-400 font-bold">Top 8</span>
                                        </div>
                                        <div className="space-y-3">
                                            {sparePartsAnalytics.topRepuestos.slice(0, 8).map((r, i) => {
                                                const maxQty = sparePartsAnalytics.topRepuestos[0]?.totalUnidades || 1;
                                                const pct = Math.round((r.totalUnidades / maxQty) * 100);
                                                return (
                                                    <div key={r.pn} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2.5">
                                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                                    i === 0 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                                                                    i === 1 ? 'bg-slate-300 text-slate-800' :
                                                                    i === 2 ? 'bg-amber-600 text-white' :
                                                                    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                                }`}>
                                                                    {i + 1}
                                                                </span>
                                                                <div>
                                                                    <p className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">{r.pn}</p>
                                                                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={r.descripcion}>{r.descripcion}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-blue-600 dark:text-blue-400">{r.totalUnidades.toLocaleString()} u.</p>
                                                                <p className="text-[10px] text-slate-400">En {r.clientes.size} clientes</p>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Modal Nuevo Registro Manual ── */}
                        {showSparePartModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn">
                                    <div className="bg-emerald-600 p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Package size={22} className="text-white"/>
                                            <h3 className="font-black text-white uppercase tracking-wider text-sm">Nuevo Repuesto Manual</h3>
                                        </div>
                                        <button onClick={() => setShowSparePartModal(false)} className="text-white/70 hover:text-white"><X size={20}/></button>
                                    </div>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!currentUser) return;
                                        const fd = new FormData(e.target as HTMLFormElement);
                                        const id = generateUUID();
                                        const rawPrecio = (fd.get('precio') as string || '').trim();
                                        const numPrecio = rawPrecio ? parseFloat(rawPrecio) : undefined;
                                        const condInput = (fd.get('condicion') as string || '').trim();

                                        const sp: any = {
                                            id,
                                            pn: (fd.get('pn') as string || '').trim(),
                                            descripcion: (fd.get('descripcion') as string || '').trim(),
                                            cantidad: Number(fd.get('cantidad')) || 1,
                                            cliente: (fd.get('cliente') as string || '').trim(),
                                            mod: (fd.get('mod') as string || '').trim(),
                                            equipo: (fd.get('equipo') as string || '').trim(),
                                            workflow_id: (fd.get('workflow_id') as string || '').trim(),
                                            orden_ge: (fd.get('orden_ge') as string || '').trim(),
                                            condicion: normalizeSparePartCondition(condInput, numPrecio),
                                            observacion: (fd.get('observacion') as string || '').trim(),
                                            mes: new Date().toLocaleString('es-ES', { month: 'long' }),
                                            anio: new Date().getFullYear(),
                                            fecha_pedido: (fd.get('fecha_pedido') as string || '').trim(),
                                            fecha_llegada: '',
                                            fecha_despacho: (fd.get('fecha_instalacion') as string || '').trim(),
                                            fecha_egreso: '',
                                            fecha_instalacion: (fd.get('fecha_instalacion') as string || '').trim(),
                                            fecha_llegada_tentativa: '',
                                            created_by: currentUser.name || currentUser.id,
                                            created_at: new Date().toISOString(),
                                            source: 'MANUAL',
                                        };
                                        if (numPrecio !== undefined && !isNaN(numPrecio)) {
                                            sp.precio = numPrecio;
                                        }
                                        await setDoc(doc(db, 'spare_parts', id), sp);
                                        showToast('Repuesto registrado correctamente.', 'success');
                                        setShowSparePartModal(false);
                                    }} className="p-6 grid grid-cols-2 gap-4">
                                        <div className="col-span-2 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">P/N *</label>
                                                <input required name="pn" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="5796592-60"/>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cantidad</label>
                                                <input name="cantidad" type="number" min="1" defaultValue="1" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none"/>
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Descripción *</label>
                                            <input required name="descripcion" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="ORPG-60 PWA"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cliente *</label>
                                            <input required name="cliente" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="Hospital José Carrasco"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">MOD (Modalidad)</label>
                                            <select name="mod" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none">
                                                <option value="">Seleccionar...</option>
                                                {['CT','MR','XR','Surgery','OEC','VCT','NMR'].map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Equipo / Modelo</label>
                                            <input name="equipo" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="Signa Creator, D387T..."/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Condición</label>
                                            <select name="condicion" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none">
                                                <option value="CONTRATO DE SERVICIOS">Contrato de Servicios</option>
                                                <option value="GARANTÍAS">Garantías</option>
                                                <option value="DOA">DOA (o FOA)</option>
                                                <option value="WRONG SHIPMENT">Wrong Shipment</option>
                                                <option value="CONCESIÓN COMERCIAL">Concesión Comercial</option>
                                                <option value="VENTAS">Ventas</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Precio (USD)</label>
                                            <input name="precio" type="number" step="0.01" placeholder="0.00" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Orden GE</label>
                                            <input name="orden_ge" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="GE-0915"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha Pedido</label>
                                            <input name="fecha_pedido" type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha Instalación</label>
                                            <input name="fecha_instalacion" type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Observación</label>
                                            <input name="observacion" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="Notas adicionales..."/>
                                        </div>
                                        <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                            <button type="button" onClick={() => setShowSparePartModal(false)}
                                                className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                Cancelar
                                            </button>
                                            <button type="submit"
                                                className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2">
                                                <Save size={14}/> Guardar Repuesto
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* ── Modal Editar Repuesto (Admin / Alexis) ── */}
                        {editingSparePart && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn">
                                    <div className="bg-blue-600 p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Edit3 size={22} className="text-white"/>
                                            <div>
                                                <h3 className="font-black text-white uppercase tracking-wider text-sm">Editar Repuesto</h3>
                                                <p className="text-[11px] text-blue-100 font-mono mt-0.5">P/N: {editingSparePart.pn} &bull; ID: {editingSparePart.id}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingSparePart(null)} className="text-white/70 hover:text-white"><X size={20}/></button>
                                    </div>
                                    <form onSubmit={handleUpdateSparePart} className="p-6 grid grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
                                        <div className="col-span-2 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">P/N (Part Number) *</label>
                                                <input required name="pn" defaultValue={editingSparePart.pn} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cantidad *</label>
                                                <input required name="cantidad" type="number" min="1" defaultValue={editingSparePart.cantidad || 1} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Descripción *</label>
                                            <input required name="descripcion" defaultValue={editingSparePart.descripcion} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cliente *</label>
                                            <input required name="cliente" defaultValue={editingSparePart.cliente} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">MOD (Modalidad)</label>
                                            <input name="mod" defaultValue={editingSparePart.mod} placeholder="CT, MR, XR..." className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Equipo / Modelo</label>
                                            <input name="equipo" defaultValue={editingSparePart.equipo} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Condición</label>
                                            <input name="condicion" defaultValue={editingSparePart.condicion} placeholder="COMPRA, GARANTIA..." className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Precio (USD)</label>
                                            <input name="precio" type="number" step="0.01" defaultValue={editingSparePart.precio !== undefined ? editingSparePart.precio : ''} placeholder="0.00" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Orden GE</label>
                                            <input name="orden_ge" defaultValue={editingSparePart.orden_ge} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Workflow ID</label>
                                            <input name="workflow_id" defaultValue={editingSparePart.workflow_id} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha Pedido</label>
                                            <input name="fecha_pedido" defaultValue={editingSparePart.fecha_pedido} placeholder="DD/MM/AAAA" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha Instalación</label>
                                            <input name="fecha_instalacion" defaultValue={editingSparePart.fecha_instalacion} placeholder="DD/MM/AAAA" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fecha Llegada</label>
                                            <input name="fecha_llegada" defaultValue={editingSparePart.fecha_llegada} placeholder="DD/MM/AAAA" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Observación</label>
                                            <textarea name="observacion" rows={2} defaultValue={editingSparePart.observacion} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none resize-none" placeholder="Notas adicionales..."/>
                                        </div>
                                        <div className="col-span-2 flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                            <button type="button" onClick={() => setEditingSparePart(null)}
                                                className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                Cancelar
                                            </button>
                                            <button type="submit"
                                                className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
                                                <Save size={14}/> Guardar Cambios
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                );
});
SparePartsModule.displayName = "SparePartsModule";
