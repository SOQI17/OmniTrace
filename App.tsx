import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { 
  Asset, 
  AssetStatus, 
  User, 
  AuditLogEntry, 
  AssetCondition,
  UserRole,
  ImportationCosts,
  ImportItem,
  StoredDocument,
  SparePart
} from './types';
import { AssetLifecycleService } from './services/AssetLifecycleService';
import { AssetLabelPDF } from './components/AssetLabelPDF';
import { LoginScreen } from './components/LoginScreen';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import {
  collection, doc, onSnapshot, writeBatch,
  query, orderBy, updateDoc, deleteDoc, setDoc, getDocs, where
} from 'firebase/firestore';
import { 
  Truck, 
  Warehouse, 
  QrCode, 
  FileText, 
  AlertTriangle,
  Save,
  UploadCloud,
  Download,
  LogOut,
  Plus,
  Trash2,
  Layers,
  CheckSquare,
  ArrowRight,
  FileCheck,
  Paperclip,
  FolderOpen,
  ChevronLeft,
  X,
  Minus,
  ShoppingCart,
  Eye,
  PackageCheck,
  History,
  ChevronDown,
  RefreshCw,
  CheckCircle,
  Clock,
  ChevronRight,
  Search,
  Edit3,
  ScanLine,
  Database,
  Loader2,
  LayoutDashboard,
  DollarSign,
  Activity,
  User as UserIcon,
  Cpu,
  Monitor,
  ArrowLeft,
  Sun,
  Moon,
  RotateCcw,
  Wrench,
  Bell,
  Wifi,
  WifiOff,
  Keyboard,
  MessageSquare,
  Send,
  Users,
  Shield,
  ToggleLeft,
  ToggleRight,
  Printer,
  Kanban,
  FilePlus,
  Upload,
  Package,
  ArrowUpDown,
  Calendar,
  TrendingUp,
  BarChart3,
  Award,
  Building2
} from 'lucide-react';

// ─── PERMISOS DISPONIBLES ────────────────────────────────────────────────────
// Cada permiso puede sobreescribir el comportamiento del rol base.
const ALL_PERMISSIONS: { key: string; label: string; description: string; group: string }[] = [
  // Solicitud
  { key: 'crear_solicitudes',    label: 'Crear Solicitudes',       description: 'Crear órdenes de repuestos y equipos',      group: 'Solicitud' },
  { key: 'prestamo_herramientas',label: 'Préstamo Herramientas',   description: 'Crear solicitudes de préstamo',              group: 'Solicitud' },
  // Logística
  { key: 'ver_logistica',        label: 'Ver Logística',           description: 'Acceder al módulo de logística',             group: 'Logística' },
  { key: 'editar_logistica',     label: 'Editar Logística',        description: 'Modificar tracking, costos y liquidación',   group: 'Logística' },
  { key: 'cerrar_importacion',   label: 'Cerrar Importación',      description: 'Marcar importaciones como cerradas',         group: 'Logística' },
  { key: 'exportar_excel',       label: 'Exportar Excel',          description: 'Descargar liquidaciones en Excel',           group: 'Logística' },
  // Bodega
  { key: 'ver_bodega',           label: 'Ver Bodega',              description: 'Acceder al módulo de bodega',                group: 'Bodega' },
  { key: 'recibir_bodega',       label: 'Recibir en Bodega',       description: 'Ingresar activos a bodega',                  group: 'Bodega' },
  { key: 'despachar',            label: 'Despachar',               description: 'Realizar despachos de inventario',           group: 'Bodega' },
  { key: 'ajustar_inventario',   label: 'Ajustar Inventario',      description: 'Modificar stock e información de productos',  group: 'Bodega' },
  // Documentos
  { key: 'ver_documentos',       label: 'Ver Documentos',          description: 'Acceder al expediente documental',           group: 'Documentos' },
  { key: 'subir_documentos',     label: 'Subir Documentos',        description: 'Adjuntar archivos a las órdenes',            group: 'Documentos' },
  { key: 'eliminar_documentos',  label: 'Eliminar Documentos',     description: 'Borrar documentos adjuntos',                 group: 'Documentos' },
  // Retornos
  { key: 'ver_retornos',         label: 'Ver Retornos',            description: 'Ver garantías y préstamos activos',          group: 'Retornos' },
  { key: 'gestionar_retornos',   label: 'Gestionar Retornos',      description: 'Procesar devoluciones y retornos',           group: 'Retornos' },
];

// Permisos predeterminados por rol
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  REQUESTER: { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: false, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, ver_bodega: false, recibir_bodega: false, despachar: false, ajustar_inventario: false, ver_documentos: false, subir_documentos: false, eliminar_documentos: false, ver_retornos: false, gestionar_retornos: false },
  IMPORTER:  { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: true,  editar_logistica: true,  cerrar_importacion: true,  exportar_excel: true,  ver_bodega: false, recibir_bodega: false, despachar: false, ajustar_inventario: false, ver_documentos: true,  subir_documentos: true,  eliminar_documentos: true,  ver_retornos: true,  gestionar_retornos: false },
  WAREHOUSE: { crear_solicitudes: false, prestamo_herramientas: false, ver_logistica: false, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, ver_bodega: true,  recibir_bodega: true,  despachar: true,  ajustar_inventario: true,  ver_documentos: true,  subir_documentos: true,  eliminar_documentos: false, ver_retornos: true,  gestionar_retornos: true  },
  ADMIN:     { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: true,  editar_logistica: true,  cerrar_importacion: true,  exportar_excel: true,  ver_bodega: true,  recibir_bodega: true,  despachar: true,  ajustar_inventario: true,  ver_documentos: true,  subir_documentos: true,  eliminar_documentos: true,  ver_retornos: true,  gestionar_retornos: true  },
};

// ─── TOAST ──────────────────────────────────────────────────────────────────
type ToastType = 'error' | 'success' | 'info' | 'confirm';
interface ToastConfig {
  id: string;
  type: ToastType;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ─── TIPOS LOCALES ───────────────────────────────────────────────────────────
// Interfaz local para la lista temporal de solicitud
interface RequestDraftItem {
    id: string;
    pn: string;
    description: string;
    cantidad: number;
    cost: number;
    costo_dia?: number;
}

// Interface for Inventory View
interface InventoryItem {
    pn: string;
    description: string;
    stock: number;
    cost: number;
    category: string;
    last_updated: string; // For sorting
    assets: Asset[];
}

// Helper Component for Info Display
const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 py-3 last:border-0">
        <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">{label}</span>
        <span className="text-slate-900 dark:text-slate-100 text-sm text-right font-semibold">{value || '-'}</span>
    </div>
);

// --- HELPER FUNCTIONS ---
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch (_e) { /* fallback below */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const INITIAL_INVENTORY_DATA = [
  { "sku": "001-004", "desc": "ECHOLIGTH DEDICATED MEDEICAL PC TOCUH", "cost": 2038.11, "qty": 2 },
  { "sku": "001-010", "desc": "ECHOLIGHT ECHOGRAPHICS MAIN UNIT", "cost": 8741.54, "qty": 2 },
  { "sku": "UPX898", "desc": "SONY UPX898MD HYBRID PRINTER", "cost": 885.04, "qty": 3 }
];

// ─── Cloudinary helpers (nivel módulo) ───────────────────────────────────────
// Servicio gratuito: 25 GB storage, sin backend requerido.
// Configura VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en .env.local
const CLOUDINARY_CONFIG = {
  cloudName:    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string,
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string,
};

async function uploadDocToStorage(
  file: File,
  _docId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', 'omnitrace/documents');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url); // URL HTTPS pública permanente
      } else {
        reject(new Error(`Cloudinary error ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(formData);
  });
}

// Cloudinary permite eliminar assets solo desde el servidor (con API secret).
// En cliente dejamos la referencia en Firestore marcada; la limpieza se hace
// manualmente desde el dashboard de Cloudinary si se requiere.
async function deleteDocFromStorage(_url: string): Promise<void> {
  // No-op en cliente: Cloudinary no permite delete sin API secret por seguridad.
  // El documento se elimina de Firestore; el archivo en Cloudinary expira o se
  // limpia manualmente desde cloudinary.com → Media Library.
}

// ─── Sanitización Anti-Formula Injection (CSV/Excel) ─────────────────────────
// Previene ataques de inyección de comandos o fórmulas (DDE/CSV Injection)
// ante caracteres de control: =, +, -, @, \t, \r al abrir en Excel / Calc.
function sanitizeForExport<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    const trimmed = val.trimStart();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${val}` as unknown as T;
    }
    return val;
  }
  return val;
}

function sanitizeRow<T extends Record<string, any>>(row: T): T {
  const clean: any = {};
  for (const [k, v] of Object.entries(row)) {
    clean[k] = sanitizeForExport(v);
  }
  return clean as T;
}

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
                                className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                            >
                                <div>{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-slate-400 mt-0.5">{opt.subLabel}</div>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── FILTER SELECT ──────────────────────────────────────────────────────────
// Dropdown tipo "pill" profesional para los filtros de tabla
const FilterSelect = ({
    value, onChange, placeholder, options
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    options: { value: string; label: string }[];
}) => {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target as Node) &&
                panelRef.current && !panelRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Recalcular posición al hacer scroll o resize
    useEffect(() => {
        if (!open) return;
        const update = () => {
            if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open]);

    const handleOpen = () => {
        if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
        setOpen(o => !o);
    };

    const selected = options.find(o => o.value === value);
    const isActive = !!value;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider
                    border transition-all duration-200 whitespace-nowrap select-none
                    ${isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }
                `}
            >
                <span>{selected ? selected.label.replace(/_/g,' ') : placeholder}</span>
                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/80' : 'text-slate-400'}`}
                />
            </button>

            {open && rect && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        top: rect.bottom + 8,
                        left: rect.left,
                        zIndex: 9999,
                        minWidth: Math.max(rect.width, 200),
                    }}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
                >
                    {/* Opción "todos" */}
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors
                            ${!value
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        {placeholder}
                    </button>
                    <div className="border-t border-slate-100 dark:border-slate-700 max-h-56 overflow-y-auto">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-[11px] uppercase tracking-wider transition-colors
                                    ${value === opt.value
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold'
                                    }`}
                            >
                                {opt.label.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

// ─── TOAST COMPONENT ─────────────────────────────────────────────────────────
const Toast: React.FC<{ config: ToastConfig; onDismiss: (id: string) => void }> = ({ config, onDismiss }) => {
    const colorMap: Record<ToastType, string> = {
        error:   'bg-red-600 border-red-700',
        success: 'bg-emerald-600 border-emerald-700',
        info:    'bg-slate-800 border-slate-700',
        confirm: 'bg-slate-900 border-slate-700',
    };
    const iconMap: Record<ToastType, React.ReactNode> = {
        error:   <AlertTriangle size={18} />,
        success: <CheckCircle size={18} />,
        info:    <Clock size={18} />,
        confirm: <AlertTriangle size={18} />,
    };
    return (
        <div className={`flex flex-col gap-3 text-white px-5 py-4 rounded-xl shadow-2xl border text-sm font-bold max-w-sm w-full animate-fadeIn ${colorMap[config.type]}`}>
            <div className="flex items-start gap-3">
                {iconMap[config.type]}
                <span className="leading-snug">{config.message}</span>
                {!config.onConfirm && (
                    <button onClick={() => onDismiss(config.id)} className="ml-auto text-white/70 hover:text-white transition-colors" aria-label="Cerrar notificación">
                        <X size={16} />
                    </button>
                )}
            </div>
            {config.onConfirm && (
                <div className="flex gap-2 justify-end mt-1">
                    <button
                        onClick={() => { onDismiss(config.id); config.onCancel?.(); }}
                        className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black uppercase tracking-wider transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { onDismiss(config.id); config.onConfirm?.(); }}
                        className="px-4 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-black uppercase tracking-wider hover:bg-white/90 transition-colors"
                    >
                        Confirmar
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="lg:col-span-2 h-80" />
      <Skeleton className="h-80" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  </div>
);

const NavButton = ({ active, onClick, icon, label, disabled, mobileMode = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean; mobileMode?: boolean }) => {
    if (mobileMode) {
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${
                  active ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'
                } ${disabled ? 'opacity-30' : ''}`}
            >
                <div className={`${active ? 'bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full mb-1' : 'mb-1'}`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
                </div>
                <span className="text-[10px] font-medium truncate max-w-full px-1">{label}</span>
            </button>
        );
    }

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-200 ${
          active 
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-r-4 border-slate-900 dark:border-slate-100' 
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { 
            size: 18, 
            className: active ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-slate-600' 
        })}
        {label}
      </button>
    );
};

const EditableField = ({ label, name, value, disabled }: { label: string; name: string; value?: string | number; disabled?: boolean }) => (
  <div className="flex flex-col">
    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input
      type="text"
      name={name}
      defaultValue={value}
      disabled={disabled}
      className={`border rounded-lg p-2.5 text-sm transition-all ${disabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-200 outline-none border-slate-300 dark:border-slate-600 focus:border-slate-400'}`}
    />
  </div>
);

const LocalExpenseInput = ({ label, val, onChange }: { label: string; val: number; onChange: (v: number) => void }) => {
  const [display, setDisplay] = React.useState(val === 0 ? '' : String(val));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync cuando el valor externo cambia (ej: al recargar desde Firestore)
  React.useEffect(() => {
    setDisplay(val === 0 ? '' : String(val));
  }, [val]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Busca todos los inputs numéricos del panel de costos y salta al siguiente
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

const StatusBadge = ({ status }: { status: AssetStatus }) => {
    let colorClass = 'bg-slate-100 text-slate-600 border border-slate-200';
    if (status === AssetStatus.DRAFT) colorClass = 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 animate-pulse font-black';
    if (status === AssetStatus.ORDERED) colorClass = 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900';
    if (status === AssetStatus.IN_TRANSIT) colorClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900';
    if (status === AssetStatus.CUSTOMS) colorClass = 'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900';
    if (status === AssetStatus.RECEIVED_WH) colorClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900';
    if (status === AssetStatus.DISPATCHED) colorClass = 'bg-slate-800 text-white border border-slate-900 dark:bg-slate-600 dark:text-slate-100';
    
    return <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shadow-sm ${colorClass}`}>{status}</span>;
};

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

// ─── Error Boundary ──────────────────────────────────────────────────────────
// Captura errores de render y los muestra en pantalla (útil en desarrollo)
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-red-950 border border-red-800 rounded-2xl p-8">
            <h1 className="text-red-400 font-black text-xl uppercase tracking-widest mb-4">
              ⚠ Error de Aplicación
            </h1>
            <p className="text-red-300 font-bold text-sm mb-2">{this.state.error.message}</p>
            <pre className="text-red-400/70 text-[11px] bg-black/40 p-4 rounded-lg overflow-auto max-h-64 mt-4 leading-relaxed">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-colors"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  // ─── Zoom con Ctrl+Scroll ────────────────────────────────────────────────
  // Usa CSS zoom en <html> — no rompe el layout ni el flexbox
  const [appZoom, setAppZoom] = useState<number>(() => {
    const saved = localStorage.getItem('app_zoom');
    return saved ? parseFloat(saved) : 1;
  });

  useEffect(() => {
    // Aplicar zoom guardado al iniciar
    document.documentElement.style.zoom = String(appZoom);
  }, [appZoom]);

  useEffect(() => {
    const handleZoom = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setAppZoom(prev => {
        const step = e.deltaY < 0 ? 0.05 : -0.05;
        const next = Math.min(Math.max(0.5, prev + step), 1.5);
        const rounded = Math.round(next * 100) / 100;
        localStorage.setItem('app_zoom', String(rounded));
        document.documentElement.style.zoom = String(rounded);
        return rounded;
      });
    };
    window.addEventListener('wheel', handleZoom, { passive: false });
    return () => window.removeEventListener('wheel', handleZoom);
  }, []);

  // ─── Toast helpers ───────────────────────────────────────────────────────
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const showToast = (message: string, type: ToastType = 'info', duration = 4000) => {
    const id = generateUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    if (type !== 'confirm') setTimeout(() => dismissToast(id), duration);
    return id;
  };

  const showConfirm = (message: string): Promise<boolean> =>
    new Promise(resolve => {
      const id = generateUUID();
      setToasts(prev => [...prev, {
        id, type: 'confirm', message,
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      }]);
    });

  // Backward-compat helper (replaces showError calls)
  const showError = (msg: string) => showToast(msg, 'error', 5000);

  useEffect(() => {
    if (darkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#020617';
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#f8fafc';
        localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Limpiar zoom residual del body (versiones anteriores usaban body.style.zoom)
  useEffect(() => {
    const s = document.body.style as any;
    s.zoom   = '';
    s.width  = '';
    s.height = '';
    s.overflow = '';

    // Inject print + utility styles
    const style = document.createElement('style');
    style.id = 'omnitrace-print';
    style.textContent = `
      @media print {
        nav, header, button, .no-print { display: none !important; }
        body { background: white !important; color: black !important; }
        main { padding: 0 !important; overflow: visible !important; }
        .fixed.inset-0 { position: relative !important; }
      }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    if (!document.getElementById('omnitrace-print')) document.head.appendChild(style);
  }, []);
  
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'REQUEST' | 'LOGISTICS' | 'WAREHOUSE' | 'SCANNER' | 'DOCS' | 'RETURNS' | 'ADMIN' | 'SPAREPARTS'>('DASHBOARD');
  const [requestMode, setRequestMode] = useState<'MENU' | 'PARTS' | 'EQUIPMENT' | 'TOOLS'>('MENU');
  const [logisticsSubTab, setLogisticsSubTab] = useState<'INITIAL' | 'FINAL' | 'HISTORY'>('INITIAL');
  const [warehouseSubTab, setWarehouseSubTab] = useState<'ENTRY' | 'MOVEMENTS' | 'INVENTORY' | 'REPORTS'>('INVENTORY');
  
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [receivingAsset, setReceivingAsset] = useState<Asset | null>(null); 
  const [importing, setImporting] = useState(false); 
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingAssetsItem, setViewingAssetsItem] = useState<InventoryItem | null>(null);

  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchData, setDispatchData] = useState({
      quantity: 1,
      reason: 'Venta',
      destination: '',
      employee: ''
  });

  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [docSearchTerm, setDocSearchTerm] = useState('');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);

  // ─── Repuestos — Base Instalada ───────────────────────────────────────────
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [sparePartsLoading, setSparePartsLoading] = useState(true);
  const [sparePartsSearch, setSparePartsSearch] = useState('');
  const [sparePartsDebouncedSearch, setSparePartsDebouncedSearch] = useState('');
  // Filtro jerárquico por fecha de pedido
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

  // Paginación de alto rendimiento para evitar lentitud con miles de registros
  const [sparePartsPage, setSparePartsPage] = useState(1);
  const [sparePartsPageSize, setSparePartsPageSize] = useState(50);

  // Debounce del buscador — actualiza solo 250ms después de que el usuario deja de escribir
  const sparePartsSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSparePartsSearchChange = (value: string) => {
    setSparePartsSearch(value);
    setSparePartsPage(1);
    if (sparePartsSearchTimerRef.current) clearTimeout(sparePartsSearchTimerRef.current);
    sparePartsSearchTimerRef.current = setTimeout(() => setSparePartsDebouncedSearch(value), 250);
  };

  // Helper para descomponer cualquier fecha de repuesto en { anio, mes, dia }
  const getSparePartDateParts = (sp: SparePart): { anio: string; mes: string; dia: string } => {
    const raw = sp.fecha_pedido || sp.created_at || '';
    if (raw) {
      // Formato serial Excel
      const num = Number(raw);
      if (!isNaN(num) && num > 20000 && num < 80000 && !String(raw).includes('/') && !String(raw).includes('-')) {
        const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
        return {
          anio: String(d.getUTCFullYear()),
          mes: String(d.getUTCMonth() + 1).padStart(2, '0'),
          dia: String(d.getUTCDate()).padStart(2, '0')
        };
      }
      // Formato con '/' o con '-'
      const separator = raw.includes('/') ? '/' : raw.includes('-') ? '-' : null;
      if (separator) {
        const clean = raw.split('T')[0];
        const p = clean.split(separator);
        if (p.length === 3) {
          const p0 = p[0].trim();
          const p1 = p[1].trim();
          const p2 = p[2].trim();

          // Si el primer componente es de 4 dígitos o > 31, es YYYY-MM-DD
          if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
            let y = p0.length === 2 ? `20${p0}` : p0;
            return {
              anio: y,
              mes: p1.padStart(2, '0'),
              dia: p2.padStart(2, '0')
            };
          }

          // Si no, es DD-MM-YYYY o DD/MM/YYYY
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

  // ─── Repuestos: Lógica de filtrado + ordenamiento (a nivel superior del componente) ───
  const filteredSpareParts = React.useMemo(() => {
    const search = sparePartsDebouncedSearch.toLowerCase();
    const filtered = spareParts.filter(sp => {
      const matchSearch = !search ||
        sp.pn?.toLowerCase().includes(search) ||
        sp.descripcion?.toLowerCase().includes(search) ||
        sp.cliente?.toLowerCase().includes(search) ||
        sp.orden_ge?.toLowerCase().includes(search);

      // Filtro jerárquico por fecha
      const dp = getSparePartDateParts(sp);
      const matchAnio = !sparePartsFilterAnio || dp.anio === sparePartsFilterAnio;
      const matchMes = !sparePartsFilterMes || dp.mes === sparePartsFilterMes;
      const matchDia = !sparePartsFilterDia || dp.dia === sparePartsFilterDia;

      const matchMod = !sparePartsFilterMod || sp.mod === sparePartsFilterMod;
      const matchCondicion = !sparePartsFilterCondicion || sp.condicion === sparePartsFilterCondicion;
      const matchOrigen = !sparePartsFilterOrigen || sp.source === sparePartsFilterOrigen;
      return matchSearch && matchAnio && matchMes && matchDia && matchMod && matchCondicion && matchOrigen;
    });

    const parseDateValue = (sp: SparePart): number => {
      const dateStr = sp.fecha_pedido || sp.fecha_instalacion || sp.created_at || '';
      if (dateStr) {
        // Soporte a número serial de Excel (ej: 46196)
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

  // Paginación calculada de alto rendimiento
  const totalSparePartsPages = Math.max(1, Math.ceil(filteredSpareParts.length / sparePartsPageSize));

  const paginatedSpareParts = React.useMemo(() => {
    const start = (sparePartsPage - 1) * sparePartsPageSize;
    return filteredSpareParts.slice(start, start + sparePartsPageSize);
  }, [filteredSpareParts, sparePartsPage, sparePartsPageSize]);

  // ─── Analítica y Métricas Ejecutivas de Repuestos ─────────────────────────
  const sparePartsAnalytics = useMemo(() => {
    const dataset = sparePartsAnalyticsScope === 'FILTERED' ? filteredSpareParts : spareParts;
    
    // 1. Clientes
    const clienteMap = new Map<string, { cliente: string; totalUnidades: number; pedidos: number; pns: Set<string>; inversion: number }>();
    // 2. Repuestos
    const repuestoMap = new Map<string, { pn: string; descripcion: string; totalUnidades: number; veces: number; clientes: Set<string>; inversion: number }>();
    // 3. Modalidades
    const modMap = new Map<string, number>();
    // 4. Equipos
    const equipoMap = new Map<string, number>();

    let totalPiezas = 0;
    let totalInversion = 0;

    for (const sp of dataset) {
      const cant = Number(sp.cantidad) || 1;
      const precio = Number(sp.precio) || 0;
      const inv = precio * cant;
      totalPiezas += cant;
      totalInversion += inv;

      // Clientes
      const rawCliente = (sp.cliente || '').trim();
      const cName = rawCliente ? rawCliente.toUpperCase() : 'NO ESPECIFICADO';
      const cData = clienteMap.get(cName) || { cliente: cName, totalUnidades: 0, pedidos: 0, pns: new Set<string>(), inversion: 0 };
      cData.totalUnidades += cant;
      cData.pedidos += 1;
      if (sp.pn) cData.pns.add(sp.pn.trim().toUpperCase());
      cData.inversion += inv;
      clienteMap.set(cName, cData);

      // Repuestos
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

      // Modalidad
      const rawMod = (sp.mod || '').trim();
      const modKey = rawMod ? rawMod.toUpperCase() : 'OTROS';
      modMap.set(modKey, (modMap.get(modKey) || 0) + cant);

      // Equipo
      const rawEq = (sp.equipo || '').trim();
      const eqKey = rawEq ? rawEq : 'No Especificado';
      equipoMap.set(eqKey, (equipoMap.get(eqKey) || 0) + cant);
    }

    // Listas ordenadas
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

    // Paleta ejecutiva para Donut Chart
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

  // Formateador de fecha optimizado y rápido para la tabla
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

  // Opciones jerárquicas dinámicas para Año, Mes y Día
  const uniqueAnios = React.useMemo(() => {
    const set = new Set<string>();
    spareParts.forEach(sp => {
      const { anio } = getSparePartDateParts(sp);
      if (anio) set.add(anio);
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [spareParts]);

  const uniqueMeses = React.useMemo(() => {
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

  const uniqueDias = React.useMemo(() => {
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

  const uniqueClientes = React.useMemo(() => [...new Set(spareParts.map(sp => sp.cliente).filter(Boolean))], [spareParts]);
  const uniqueMods = React.useMemo(() => [...new Set(spareParts.map(sp => sp.mod).filter(Boolean))], [spareParts]);
  const uniqueCondiciones = React.useMemo(() => [...new Set(spareParts.map(sp => sp.condicion).filter(Boolean))], [spareParts]);
  const totalUnidades = React.useMemo(() => spareParts.reduce((acc, sp) => acc + (Number(sp.cantidad) || 1), 0), [spareParts]);


  const [managingReturnAsset, setManagingReturnAsset] = useState<Asset | null>(null);
  const [logisticsFilter, setLogisticsFilter] = useState<{ status: string; condicion: string; proveedor: string }>({ status: '', condicion: '', proveedor: '' });
  const [returnsSubTab, setReturnsSubTab] = useState<'RETURNS' | 'LOANS'>('RETURNS');
  const [returnRequestedByProvider, setReturnRequestedByProvider] = useState(false);
  const [returnLocation, setReturnLocation] = useState('');
  const [returnDocFile, setReturnDocFile] = useState<File | null>(null);

  // Estados de Consolidación Activa / Modal
  const [isSelectingConsolidation, setIsSelectingConsolidation] = useState(false);
  const [showConsolidationModal, setShowConsolidationModal] = useState(false);
  const [consolidationModalAssets, setConsolidationModalAssets] = useState<Asset[]>([]);
  const [consolidationModalSelected, setConsolidationModalSelected] = useState<string[]>([]);
  
  const [isConsolidationMode, setIsConsolidationMode] = useState(false);
  const [consolidationList, setConsolidationList] = useState<string[]>([]);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]); // Almacena IDs de assets seleccionados

  // Modal para cerrar importación masiva
  const [showCloseImportModal, setShowCloseImportModal] = useState(false);
  const [assetsToClose, setAssetsToClose] = useState<Asset[]>([]);
  const [selectedAssetsToClose, setSelectedAssetsToClose] = useState<string[]>([]);

  const [requestItems, setRequestItems] = useState<RequestDraftItem[]>([]);
  const [reqPn, setReqPn] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqQty, setReqQty] = useState(1);
  const [reqCost, setReqCost] = useState('');
  const [reqCostoDia, setReqCostoDia] = useState('');

  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<StoredDocument | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [itemsState, setItemsState] = useState<ImportItem[]>([]);
  const [localExpenses, setLocalExpenses] = useState({
      manejo_carga: 0, costo_cc: 0, almacenaje: 0, asesoria_gestion_riesgo: 0, transporte_local: 0, agenciamiento_aduana: 0
  });

  // Valores para Aduana (FOB + Flete + Seguro → CIF global)
  const [aduanaValues, setAduanaValues] = useState({
      costo_fob: 0, flete: 0, seguro: 0
  });
  const totalCifGlobal = aduanaValues.costo_fob + aduanaValues.flete + aduanaValues.seguro;

  // Auto-guardado
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculo de gastos locales seguro asegurando valores numéricos
  const totalLocal = (Object.values(localExpenses) as number[]).reduce((acc, val) => Number(acc) + Number(val), 0);
  const proratedLocalPerItem = itemsState.length > 0 ? (totalLocal / itemsState.length) : 0;

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
    if (!isSelectingConsolidation) return; // Bloqueo si no está en modo selección

    if (group.length === 1) {
      const assetId = group[0].id;
      setPendingSelection(prev => 
        prev.includes(assetId) 
          ? prev.filter(id => id !== assetId) 
          : [...prev, assetId]
      );
    } else {
      setConsolidationModalAssets(group);
      // Pre-select items that are already in pendingSelection
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
        setIsSelectingConsolidation(false);
    }
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  const assetsByOrder = assets.reduce<Record<string, Asset[]>>((acc, asset) => {
      const orderId = asset.metadata.numero_orden_ge || 'SIN_ORDEN';
      if (!acc[orderId]) acc[orderId] = [];
      acc[orderId].push(asset);
      return acc;
  }, {});

  const inventoryStats = assets.reduce<Record<string, InventoryItem>>((acc, asset) => {
      const pn = asset.metadata.pn;
      if (!acc[pn]) {
          acc[pn] = {
              pn: pn, description: asset.metadata.description, stock: 0, cost: asset.metadata.cost, category: 'General', last_updated: asset.metadata.fecha_solicitud, assets: []
          };
      }
      if (new Date(asset.metadata.fecha_solicitud) > new Date(acc[pn].last_updated)) acc[pn].last_updated = asset.metadata.fecha_solicitud;
      acc[pn].assets.push(asset);
      if ([AssetStatus.RECEIVED_WH, AssetStatus.QUALITY_CHECK].includes(asset.current_status)) acc[pn].stock += (asset.metadata.cantidad || 1); 
      return acc;
  }, {});

  const inventoryList: InventoryItem[] = (Object.values(inventoryStats) as InventoryItem[])
      .filter(i => (i.pn.toLowerCase().includes(inventorySearch.toLowerCase()) || i.description.toLowerCase().includes(inventorySearch.toLowerCase())))
      .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());

  const availableInventoryList = inventoryList.filter(i => i.stock > 0);

  const canEditLogistics = currentUser?.role === 'IMPORTER' || currentUser?.role === 'ADMIN';
  const canEditWarehouse = currentUser?.role === 'WAREHOUSE' || currentUser?.role === 'ADMIN';
  const canCreateRequest = currentUser?.role === 'REQUESTER' || currentUser?.role === 'ADMIN';
  const canViewLogistics = currentUser?.role !== 'WAREHOUSE';

  const filteredGlobalAssets = globalSearchTerm.length < 2 ? [] : assets.filter(a => 
      a.metadata.pn.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
      a.metadata.description.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
      (a.metadata.numero_orden_ge && a.metadata.numero_orden_ge.toLowerCase().includes(globalSearchTerm.toLowerCase())) ||
      a.metadata.workflow_id.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
      a.metadata.serial_ge.toLowerCase().includes(globalSearchTerm.toLowerCase())
  ).slice(0, 10);

  const handleGlobalSearchSelect = (asset: Asset) => {
      setGlobalSearchTerm('');
      setShowSearchResults(false);
      if ([AssetStatus.RECEIVED_WH, AssetStatus.QUALITY_CHECK, AssetStatus.DISPATCHED].includes(asset.current_status)) {
          setWarehouseSubTab('INVENTORY');
          setInventorySearch(asset.metadata.pn);
          setActiveTab('WAREHOUSE');
          const item = inventoryStats[asset.metadata.pn];
          if(item) setViewingAssetsItem(item);
      } else {
          if (!canViewLogistics) {
              showToast("No tienes acceso a la vista de logística.", 'error');
              return;
          }
          setSelectedAssetId(asset.id);
          setActiveTab('LOGISTICS');
      }
  };

  useEffect(() => {
    if (!currentUser) return;
    const unsubAssets = onSnapshot(
        collection(db, "assets"),
        (snapshot) => {
            const data = snapshot.docs.map(d => d.data() as Asset);
            data.sort((a,b) => new Date(b.metadata.fecha_solicitud).getTime() - new Date(a.metadata.fecha_solicitud).getTime());
            setAssets(data);
            setDataLoading(false);
        },
        (err) => { showError(`Error al cargar activos: ${err.message}`); setDataLoading(false); }
    );
    const unsubLogs = onSnapshot(
        query(collection(db, "audit_log"), orderBy('timestamp', 'desc')),
        (snapshot) => {
            setLogs(snapshot.docs.map(d => d.data() as AuditLogEntry));
        },
        (err) => showError(`Error al cargar auditoría: ${err.message}`)
    );
    return () => { unsubAssets(); unsubLogs(); };
  }, [currentUser]);

  // ─── Listener Repuestos ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const unsubSpareParts = onSnapshot(
      query(collection(db, 'spare_parts'), orderBy('created_at', 'desc')),
      (snapshot) => {
        setSpareParts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SparePart)));
        setSparePartsLoading(false);
      },
      () => setSparePartsLoading(false)
    );
    return () => unsubSpareParts();
  }, [currentUser]);


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
    } else populateItemsFromAsset(selectedAsset);
  }, [selectedAssetId]); 

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

  // ── Exportar Liquidación a Excel (con Anti-Formula Injection y Auditoría DLP) ────
  const exportLiquidacion = async () => {
    if (!selectedAsset || itemsState.length === 0) return;
    const totalFobItems = itemsState.reduce((acc, it) => acc + (Number(it.cantidad)||0) * (Number(it.precio_uni)||0), 0);
    const cifFactor = totalCifGlobal > 0 && totalFobItems > 0 ? totalCifGlobal / totalFobItems : 1;

    const rows = itemsState.map((item, idx) => {
      const qty = Number(item.cantidad) || 0;
      const precioU = Number(item.precio_uni) || 0;
      const precioTotal = qty * precioU;
      const cifU = (item as any).cif_editado ? (Number(item.cif_unitario) || precioU * cifFactor) : precioU * cifFactor;
      const cifTotal = qty * cifU;
      const arancelManual = (item as any).arancel;
      const arancelVal = arancelManual !== undefined ? Number(arancelManual) : (item.aplica_arancel ? cifTotal * 0.05 : 0);
      const fodinfa = cifTotal * 0.005;
      const iva = (cifTotal + arancelVal + fodinfa) * 0.15;
      const liqTotal = arancelVal + fodinfa + iva;
      const costoFinal = cifTotal + arancelVal + fodinfa + proratedLocalPerItem;
      const landed = precioTotal > 0 ? costoFinal / precioTotal : 0;
      return sanitizeRow({
        '#': idx + 1, 'FACTURA': item.no_factura || '',
        'ITEM / P.N.': item.item_number || '', 'DESCRIPCIÓN': item.descripcion || '',
        'CANTIDAD': qty, 'PRECIO UNI': precioU, 'PRECIO TOTAL': precioTotal,
        'CIF UNITARIO': +cifU.toFixed(5), 'VALOR EN ADUANA (CIF)': +cifTotal.toFixed(2),
        'APLICA ARANCEL': item.aplica_arancel ? 'SÍ' : 'NO',
        'ARANCEL AD VALOREM': +arancelVal.toFixed(2),
        'FODINFA (0.5%)': +fodinfa.toFixed(5), 'IVA 15%': +iva.toFixed(2),
        'TOTAL LIQUIDACIÓN': +liqTotal.toFixed(2),
        'GASTOS LOCALES': +proratedLocalPerItem.toFixed(2),
        'COSTO FINAL': +costoFinal.toFixed(2), 'LANDED COST': +landed.toFixed(6),
      });
    });

    const resumen = [
      { CONCEPTO: 'COSTO FOB', VALOR: aduanaValues.costo_fob },
      { CONCEPTO: 'FLETE DECLARADO', VALOR: aduanaValues.flete },
      { CONCEPTO: 'SEGURO', VALOR: aduanaValues.seguro },
      { CONCEPTO: 'TOTAL CIF GLOBAL', VALOR: totalCifGlobal },
      { CONCEPTO: '', VALOR: '' },
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
    wsItems['!cols'] = [{wch:4},{wch:14},{wch:14},{wch:30},{wch:8},{wch:12},{wch:12},{wch:12},{wch:16},{wch:12},{wch:16},{wch:12},{wch:10},{wch:16},{wch:14},{wch:12},{wch:12}];
    wsResumen['!cols'] = [{wch:25},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsItems, 'LIQUIDACIÓN');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'ADUANA Y GASTOS');
    XLSX.writeFile(wb, `LIQUIDACION_${selectedAsset.metadata.numero_orden_ge}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Liquidación exportada correctamente.', 'success');

    // Trazabilidad Forense / DLP en audit_log
    try {
      const logId = generateUUID();
      await setDoc(doc(db, 'audit_log', logId), {
        id: logId,
        asset_id: selectedAsset.id,
        actor_id: currentUser?.name || currentUser?.id || 'DESCONOCIDO',
        action: 'EXPORT_DATA',
        prev_value: null,
        new_value: {
          tipo: 'LIQUIDACION',
          numero_orden_ge: selectedAsset.metadata.numero_orden_ge,
          total_items: rows.length,
          exported_at: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('Auditoría export liquidación:', auditErr);
    }
  };

  // ─── Offline detection ────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => { setIsOnline(true); showToast('Conexión restaurada.', 'success'); };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ─── Dynamic document title ───────────────────────────────────────────────
  useEffect(() => {
    const loansOverdue = assets.filter(a => {
      const meta = a.metadata as any;
      return a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA' &&
        meta.fecha_devolucion && new Date(meta.fecha_devolucion) < new Date() &&
        a.current_status !== AssetStatus.DISPATCHED;
    }).length;
    const noTracking = assets.filter(a =>
      [AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(a.current_status) &&
      !a.logistics?.documents?.tracking_number
    ).length;
    const total = loansOverdue + noTracking;
    document.title = total > 0 ? `(${total}) OmniTrace` : 'OmniTrace';
  }, [assets]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = ['INPUT','TEXTAREA','SELECT'].includes(tag);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchResults(true);
        // Focus the search input
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Buscar..."]');
          searchInput?.focus();
        }, 50);
      }
      if (e.key === 'Escape') {
        setShowSearchResults(false);
        setGlobalSearchTerm('');
        setPreviewDoc(null);
        setPreviewDataUrl(null);
        setReceivingAsset(null);
        setShowDispatchModal(false);
        setShowAddProductModal(false);
        setShowComments(false);
      }
      if (!typing && (e.ctrlKey || e.metaKey) && e.key === 's' && activeTab === 'LOGISTICS' && logisticsSubTab === 'FINAL') {
        e.preventDefault();
        handleUpdateLogisticsFinal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, logisticsSubTab]);

  // ─── Comments / notas por orden ───────────────────────────────────────────
  const [comments, setComments] = useState<Record<string, {id:string; text:string; user:string; ts:string}[]>>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsubComments = onSnapshot(
      collection(db, "order_comments"),
      (snap) => {
        const data: Record<string, any[]> = {};
        snap.docs.forEach(d => { data[d.id] = d.data().comments || []; });
        setComments(data);
      },
      () => {}
    );
    return () => unsubComments();
  }, [currentUser]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedAsset || !currentUser) return;
    const orderId = selectedAsset.metadata.numero_orden_ge;
    const existing = comments[orderId] || [];
    const entry = { id: generateUUID(), text: newComment.trim(), user: currentUser.name, ts: new Date().toISOString() };
    await setDoc(doc(db, "order_comments", orderId), { comments: [...existing, entry] });
    setNewComment('');
  };

  // ─── Gestión de Usuarios (solo ADMIN) ────────────────────────────────────
  const [firestoreUsers, setFirestoreUsers] = useState<{
    uid: string; email: string; displayName: string;
    role: UserRole; active: boolean; lastLogin?: string; createdAt?: string;
    permissions?: Record<string, boolean>;
  }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUserMgmt] = useState<string | null>(null);
  const [editingUserPerms, setEditingUserPerms] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('REQUESTER');
  const [newUserName, setNewUserName] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    setUsersLoading(true);
    const unsub = onSnapshot(collection(db, 'users'),
      async (snap) => {
        const users = snap.docs.map(d => d.data() as any);
        setFirestoreUsers(users);
        setUsersLoading(false);

        // Asegurar que todos los miembros del equipo estén registrados
        const seedUsers = [
          { key: 'alexis.guerra', email: 'alexis.guerra@orimec.com.ec', name: 'Alexis Guerra',   role: 'ADMIN'     },
          { key: 'paul.orozco',   email: 'paul.orozco@orimec.com.ec',   name: 'Paul Orozco',     role: 'IMPORTER'  },
          { key: 'vosorio',       email: 'vosorio@orimec.com.ec',        name: 'Virgilio Osorio', role: 'WAREHOUSE' },
        ];
        const existingEmails = users.map((u: any) => u.email?.toLowerCase());
        const missing = seedUsers.filter(s => !existingEmails.some((e: string) => e?.includes(s.key)));
        if (missing.length > 0) {
          const batch = writeBatch(db);
          missing.forEach(u => {
            const tempId = `seed_${u.key.replace('.', '_')}`;
            batch.set(doc(db, 'users', tempId), {
              uid: tempId, email: u.email, displayName: u.name,
              role: u.role, active: true,
              createdAt: new Date().toISOString(), pending: true,
            });
          });
          await batch.commit().catch(() => {});
        }
      },
      () => setUsersLoading(false)
    );
    return () => unsub();
  }, [currentUser]);

  const handleUpdateUserRole = async (uid: string, role: UserRole) => {
    await updateDoc(doc(db, 'users', uid), { role });
    showToast(`Rol actualizado a ${role}.`, 'success');
    setEditingUserMgmt(null);
  };

  const handleUpdateUserPermission = async (uid: string, perm: string, value: boolean) => {
    const user = firestoreUsers.find(u => u.uid === uid);
    const currentPerms = user?.permissions || {};
    await updateDoc(doc(db, 'users', uid), {
      permissions: { ...currentPerms, [perm]: value }
    });
  };

  const handleToggleUserActive = async (uid: string, currentActive: boolean) => {
    if (uid === currentUser?.id) {
      showToast('No puedes desactivar tu propia cuenta.', 'error');
      return;
    }
    const confirmed = await showConfirm(`¿${currentActive ? 'Desactivar' : 'Activar'} este usuario?`);
    if (!confirmed) return;
    await updateDoc(doc(db, 'users', uid), { active: !currentActive });
    showToast(`Usuario ${currentActive ? 'desactivado' : 'activado'}.`, 'success');
  };

  const handleRegisterUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim()) return;
    const confirmed = await showConfirm(`Registrar ${newUserEmail} con rol ${newUserRole}?\n\nEl usuario deberá iniciar sesión con este email en Firebase Authentication.`);
    if (!confirmed) return;
    // Crear placeholder en Firestore — el UID real se actualizará al primer login
    const tempId = `pending_${generateUUID()}`;
    await setDoc(doc(db, 'users', tempId), {
      uid: tempId,
      email: newUserEmail.trim().toLowerCase(),
      displayName: newUserName.trim(),
      role: newUserRole,
      active: true,
      createdAt: new Date().toISOString(),
      pending: true, // se reemplazará al primer login
    });
    showToast(`Usuario registrado. Debe crearse en Firebase Console → Authentication.`, 'success', 6000);
    setNewUserEmail(''); setNewUserName(''); setNewUserRole('REQUESTER'); setShowAddUser(false);
  };

  const handleResetPasswordForUser = async (email: string) => {
    const confirmed = await showConfirm(`¿Enviar correo de recuperación de contraseña a ${email}?`);
    if (!confirmed) return;
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Correo de recuperación enviado a ${email}.`, 'success');
    } catch (err: any) {
      showError(`Error: ${err.message}`);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageSpareParts = isAdmin || Boolean(currentUser?.name && currentUser.name.toLowerCase().includes('alexis'));

  // ── Auto-guardado de gastos locales y valores aduana ──────────────────────
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
    }, 1200); // 1.2s de debounce
  };

  const handleManualReloadItems = async () => {
      if (!selectedAsset) return;
      const confirmed = await showConfirm("¿Recargar items desde la orden actual? Esto borrará los datos ingresados en la tabla.");
      if (confirmed) populateItemsFromAsset(selectedAsset);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          // 1. Intentar leer rol desde Firestore (gestión centralizada)
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', firebaseUser.uid)));
          let role: UserRole;
          let displayName: string;

          if (!userDoc.empty) {
            const data = userDoc.docs[0].data();
            // Si el usuario está desactivado, cerrar sesión
            if (data.active === false) {
              await signOut(auth);
              showToast('Tu cuenta ha sido desactivada. Contacta al administrador.', 'error', 8000);
              setLoadingAuth(false);
              return;
            }
            // El rol viene de Firestore; si no está definido, mínimo privilegio
            role = (data.role as UserRole) || 'REQUESTER';
            displayName = data.displayName || firebaseUser.email.split('@')[0];
          } else {
            // 2. Usuario nuevo — asignar mínimo privilegio y auto-registrar en Firestore
            // Un ADMIN puede asignar el rol correcto desde el panel de administración.
            role = 'REQUESTER';
            displayName = firebaseUser.email.split('@')[0];
            // Auto-registrar en Firestore para futuras gestiones
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName,
              role,
              active: true,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            });
          }

          // Actualizar lastLogin
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            lastLogin: new Date().toISOString()
          }).catch(() => {});

          setCurrentUser({ id: firebaseUser.uid, name: displayName, role });
          setSessionExpired(false);
        } catch {
          // Fallback si Firestore falla — mínimo privilegio por seguridad
          setCurrentUser({ id: firebaseUser.uid, name: firebaseUser.email.split('@')[0], role: 'REQUESTER' });
          setSessionExpired(false);
        }
      } else {
        if (currentUser) setSessionExpired(true);
        setCurrentUser(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => signOut(auth);

  // ─── Control de Inactividad de Sesión (20 minutos) ─────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const INACTIVITY_LIMIT_MS = 20 * 60 * 1000; // 20 minutos
    let timer: any;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        showToast('Sesión cerrada automáticamente por inactividad (20 min). Por tu seguridad, vuelve a iniciar sesión.', 'warning', 10000);
        setSessionExpired(true);
        try {
          await signOut(auth);
        } catch (err) {
          console.error('Error al cerrar sesión por inactividad:', err);
        }
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [currentUser]);

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
              batch.set(doc(db,"assets",asset.id), updatedAsset);
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
                  batch.set(doc(db,"assets",newId), newAsset);
              }
          } else if (diff < 0) {
              activeAssets.slice(0, Math.abs(diff)).forEach(asset => {
                  const result = AssetLifecycleService.transitionStatus(asset, AssetStatus.DISPATCHED, currentUser);
                  batch.set(doc(db,"assets",result.updatedAsset.id), result.updatedAsset);
              });
          }
          await batch.commit();
          setEditingItem(null);
      } catch (err: any) { showError(err.message); }
  };

  const handleConfirmReception = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!receivingAsset || !currentUser) return;
      const formData = new FormData(e.target as HTMLFormElement);
      try {
          // Actualizar campos de bodega
          let updatedAsset = AssetLifecycleService.updateField(
              receivingAsset, 'warehouse',
              { aisle: formData.get('aisle'), bin: formData.get('bin') },
              currentUser
          ).updatedAsset;

          // Si el asset no tiene tracking (préstamos, herramientas, casos especiales),
          // hacer la transición directamente sin validar tracking
          let result;
          try {
              result = AssetLifecycleService.transitionStatus(updatedAsset, AssetStatus.RECEIVED_WH, currentUser);
          } catch (transitionErr: any) {
              if (transitionErr.message?.includes('Tracking') || transitionErr.message?.includes('tracking')) {
                  // Forzar la transición directo sin validación de tracking
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
                batch.set(doc(db,"assets",res.updatedAsset.id), res.updatedAsset);
                remaining -= assetQty;
            } else {
                batch.set(doc(db,"assets",asset.id), { ...asset, metadata: { ...asset.metadata, cantidad: assetQty - remaining } });
                const newDispatchId = generateUUID();
                const dispatched: Asset = { ...asset, id: newDispatchId, current_status: AssetStatus.RECEIVED_WH, metadata: { ...asset.metadata, cantidad: remaining, serial_ge: `${asset.metadata.serial_ge}-SPLIT` }, warehouse: { ...asset.warehouse, responsable_egreso: dispatchData.employee, destino_final: dispatchData.destination, motivo_salida: dispatchData.reason } };
                const res = AssetLifecycleService.transitionStatus(dispatched, AssetStatus.DISPATCHED, currentUser);
                batch.set(doc(db,"assets",res.updatedAsset.id), res.updatedAsset);
                remaining = 0;
            }
        }
        await batch.commit();
        setShowDispatchModal(false);
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
              batch.set(doc(db,"assets",id), newAsset);
          }
          await batch.commit();
          setShowAddProductModal(false);
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
              await setDoc(doc(db,"assets",id), newAsset);
          }
      } catch (err: any) { showError(err.message); } finally { setImporting(false); }
  };

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
        const asset: Asset = { id, current_status: AssetStatus.DRAFT, lifecycle_lock: false, metadata: { workflow_id: formData.get('workflow_id') as string, provider: formData.get('provider') as string, cliente_final: formData.get('cliente_final') as string, equipo_destino: formData.get('equipo_destino') as string, condicion: formData.get('condicion') as AssetCondition, numero_orden_ge: formData.get('numero_orden_ge') as string, fecha_solicitud: new Date().toISOString(), pn: item.pn, description: item.description, cantidad: item.cantidad, cost: item.cost, serial_ge: 'PENDIENTE' }, logistics: { documents: {}, extra_docs: [] }, warehouse: {} };
        batch.set(doc(db,"assets",id), asset);

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
            condicion: (formData.get('condicion') as string) || '',
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
    setActiveTab('LOGISTICS');
    setRequestItems([]);
    setRequestMode('MENU');
  };

  const handleCreateToolsRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || requestItems.length === 0) return;
    const formData = new FormData(e.target as HTMLFormElement);

    // Número secuencial: LOAN-ORI-0001, LOAN-ORI-0002, ...
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
                condicion: AssetCondition.LOAN ?? 'PRESTAMO' as any,
                numero_orden_ge: loanOrderId,
                fecha_solicitud: new Date().toISOString(),
                pn: item.pn,
                description: item.description,
                cantidad: item.cantidad,
                cost: item.cost || 0,
                serial_ge: 'PRESTAMO',
                // campos extra del préstamo
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

  const handleSidebarSelect = (id: string) => {
      setPendingSelection([]);
      setIsConsolidationMode(false);
      setIsSelectingConsolidation(false);
      setSelectedAssetId(id);
      if(activeTab === 'REQUEST') setActiveTab('LOGISTICS');
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
              
              batch.set(doc(db,"assets",asset.id), updated);
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
      const formData = new FormData(form);

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

              batch.set(doc(db,"assets",asset.id), updated);
          });

          await batch.commit();
          setShowCloseImportModal(false);

          showToast("Importación cerrada. Procede a recepción en bodega.", 'success');
          
          if (assetIdsToClose.includes(selectedAsset.id)) {
              setSelectedAssetId(null);
              setActiveTab('WAREHOUSE');
              setWarehouseSubTab('ENTRY');
          }
      } catch (err: any) {
          showError(err.message);
      }
  };

  const handleUpdateLogisticsFinal = async () => {
      if (!selectedAsset || !currentUser) return;
      
      const form = document.getElementById('final-logistics-form') as HTMLFormElement;
      const formData = new FormData(form);
      
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
              batch.set(doc(db,"assets",asset.id), updated);
          });

          await batch.commit();
          showToast("Costos guardados correctamente.", 'success');
      } catch (err: any) {
          showError(err.message);
      }
  };

  // Descarga usando la URL de Firebase Storage (funciona en cualquier dispositivo)
  const downloadDoc = async (doc: StoredDocument) => {
    const url = doc.url;
    if (!url || url === '' || url === '#') {
      showToast('Este documento no tiene archivo almacenado aún.', 'info');
      return;
    }
    try {
      // Fetch como blob para forzar descarga (evita que el browser lo abra en tab)
      const res  = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // Fallback: abrir directamente la URL de Storage
      window.open(url, '_blank');
    }
  };

  // Abre vista previa: retorna el dataUrl desde IDB o Firestore
  // Para preview: la URL de Storage ya es pública y directa
  const getDocDataUrl = async (doc: StoredDocument): Promise<string | null> => {
    if (!doc.url || doc.url === '' || doc.url === '#') return null;
    return doc.url;
  };

  const openPreview = async (doc: StoredDocument) => {
    setPreviewDoc(doc);
    setPreviewDataUrl(null);
    setPreviewLoading(true);
    try {
      const url = await getDocDataUrl(doc);
      setPreviewDataUrl(url);
    } catch {
      setPreviewDataUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewDataUrl(null);
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !currentUser || !docFile) return;
    setUploadingDoc(true);
    try {
      const ext           = docFile.name.includes('.') ? '.' + docFile.name.split('.').pop() : '';
      const baseName      = docFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\-_. ]/g, '').trim();
      const cleanFilename = (baseName || 'documento') + ext;
      const docId         = generateUUID();

      // 1. Subir a Firebase Storage → devuelve URL pública permanente
      const downloadURL = await uploadDocToStorage(docFile, docId, setUploadProgress);

      // 2. Guardar solo metadatos + URL en Firestore
      const newDoc: StoredDocument = {
        id: docId,
        name: docName,
        filename: cleanFilename,
        uploaded_by: currentUser.name,
        date: new Date().toISOString(),
        url: downloadURL,  // URL pública de Firebase Storage
      };
      await updateDoc(doc(db,"assets",selectedAsset.id), {
        "logistics.extra_docs": [...(selectedAsset.logistics.extra_docs || []), newDoc]
      });
      setDocName('');
      setDocFile(null);
      showToast('Documento adjuntado correctamente.', 'success');
    } catch (err: any) {
      showError(`Error al subir archivo: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedAsset) return;
    const confirmed = await showConfirm("¿Eliminar este documento? Esta acción no puede deshacerse.");
    if (!confirmed) return;
    const docToDelete = selectedAsset.logistics.extra_docs?.find(d => d.id === docId);
    if (docToDelete?.url) {
      await deleteDocFromStorage(docToDelete.url); // eliminar de Storage también
    }
    await updateDoc(doc(db,"assets",selectedAsset.id), {
      "logistics.extra_docs": selectedAsset.logistics.extra_docs?.filter(d => d.id !== docId)
    });
  };

  const handleOpenReturnManagement = (asset: Asset) => {
      setManagingReturnAsset(asset);
      setReturnRequestedByProvider(asset.logistics.solicitado_proveedor || false);
      setReturnLocation(asset.warehouse.ubicacion_retorno || '');
  };

  const handleSaveReturnManagement = async () => {
      if (!managingReturnAsset) return;
      try {
          await updateDoc(doc(db,"assets",managingReturnAsset.id), {
              "logistics.solicitado_proveedor": returnRequestedByProvider,
              "warehouse.ubicacion_retorno": returnLocation
          });
          setManagingReturnAsset(null);
      } catch (e: any) { showError(e.message); }
  };

  const handleUploadReturnDoc = async () => {
      if (!managingReturnAsset || !currentUser || !returnDocFile) return;
      try {
          const docId       = generateUUID();
          const downloadURL = await uploadDocToStorage(returnDocFile, docId);
          const newDoc: StoredDocument = { 
              id: docId, 
              name: "Doc Retorno", 
              filename: returnDocFile.name, 
              uploaded_by: currentUser.name, 
              date: new Date().toISOString(), 
              url: downloadURL,
          };
          await updateDoc(doc(db,"assets",managingReturnAsset.id), { 
              "logistics.extra_docs": [...(managingReturnAsset.logistics.extra_docs || []), newDoc] 
          });
          setReturnDocFile(null);
          showToast('Documento de retorno adjuntado.', 'success');
      } catch (err: any) {
          showError(`Error al subir archivo: ${err.message}`);
      }
  };

  const handleScanMock = () => setScannedAsset(assets[0]);

  if (loadingAuth) return <div className="p-10 text-slate-500 font-medium">Cargando OmniTrace...</div>;
  if (!currentUser) return <AppErrorBoundary><LoginScreen /></AppErrorBoundary>;

  const pendingAssets = assets.filter(a => a.current_status === AssetStatus.DRAFT);

  const relatedAssetsForClosing = selectedAsset 
    ? (isConsolidationMode && pendingSelection.length > 0
        ? assets.filter(a => pendingSelection.includes(a.id))
        : assets.filter(a => a.metadata.numero_orden_ge === selectedAsset.metadata.numero_orden_ge))
    : [];
  
  const hasOpenImports = relatedAssetsForClosing.some(a => 
      !a.logistics.importacion_procesada && 
      [AssetStatus.DRAFT, AssetStatus.ORDERED, AssetStatus.IN_TRANSIT].includes(a.current_status)
  );

  // --- ESTRUCTURA BASE TIPO "APP NATIVA" CON FIXED INSET-0 ---
  return (
    <AppErrorBoundary>
    <div className={`fixed inset-0 flex flex-col font-sans transition-colors duration-200 overflow-hidden ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER ESTÁTICO */}
      <header className="flex-none bg-slate-900 dark:bg-slate-950 text-white p-3 md:p-4 shadow-lg flex justify-between items-center z-50 h-[70px] border-b border-slate-800 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                {!logoError ? ( 
                    <img 
                        src="/inicio.png" 
                        alt="Logo" 
                        className="h-6 md:h-8 w-auto object-contain" 
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src.includes('inicio.png')) {
                                target.src = '/app.png';
                            } else {
                                setLogoError(true);
                            }
                        }} 
                    /> 
                ) : ( 
                    <Eye size={24} className="text-white opacity-80" /> 
                )}
                <h1 className="text-lg md:text-xl font-bold tracking-tight hidden sm:block">OmniTrace</h1>
            </div>
        </div>

        <div className="flex-1 max-w-xs md:max-w-xl mx-2 md:mx-4 relative">
            <div className="relative">
                <Search className="absolute left-3 top-2 md:top-2.5 text-slate-400" size={16} />
                <input 
                    type="text" placeholder="Buscar..." 
                    className="w-full bg-slate-800 border-none rounded-lg pl-9 pr-20 py-1.5 md:py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-500 text-slate-200 dark:bg-slate-900 dark:text-slate-200"
                    value={globalSearchTerm} onChange={(e) => { setGlobalSearchTerm(e.target.value); setShowSearchResults(true); }}
                />
                <kbd className="absolute right-3 top-1.5 md:top-2 hidden md:flex items-center gap-0.5 text-[9px] font-black text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded border border-slate-600">⌘K</kbd>
            </div>
            {showSearchResults && globalSearchTerm.length > 1 && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)}></div>
                    <div className="absolute top-[70px] left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-96 overflow-y-auto text-slate-800 dark:text-slate-200">
                        {filteredGlobalAssets.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">Sin resultados</div>
                        ) : (
                            <div>
                                <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700">Top Resultados</div>
                                {filteredGlobalAssets.map(asset => (
                                    <button
                                      key={asset.id}
                                      onClick={() => handleGlobalSearchSelect(asset)}
                                      className="w-full text-left px-4 py-3 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer group transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400">{asset.metadata.pn}</span>
                                            <StatusBadge status={asset.current_status} />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{asset.metadata.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>

        <div className="flex items-center gap-4">
             <button onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} className="text-slate-400 hover:text-white transition-colors">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             {/* Keyboard shortcuts hint */}
             <div className="group relative hidden md:block">
               <button className="text-slate-500 hover:text-slate-300 transition-colors" aria-label="Atajos de teclado">
                 <Keyboard size={16}/>
               </button>
               <div className="absolute right-0 top-8 bg-slate-900 border border-slate-700 rounded-xl p-4 w-56 shadow-2xl invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50 text-[10px] space-y-2">
                 <p className="font-black text-slate-300 uppercase tracking-widest mb-3">Atajos</p>
                 <div className="flex justify-between text-slate-400"><span>Búsqueda global</span><kbd className="bg-slate-800 px-1.5 rounded border border-slate-600 font-mono">⌘K</kbd></div>
                 <div className="flex justify-between text-slate-400"><span>Cerrar modales</span><kbd className="bg-slate-800 px-1.5 rounded border border-slate-600 font-mono">Esc</kbd></div>
                 <div className="flex justify-between text-slate-400"><span>Guardar costos</span><kbd className="bg-slate-800 px-1.5 rounded border border-slate-600 font-mono">⌘S</kbd></div>
               </div>
             </div>
             {appZoom !== 1 && (
               <button
                 onClick={() => {
                   setAppZoom(1);
                   localStorage.setItem('app_zoom', '1');
                   document.documentElement.style.zoom = '1';
                 }}
                 aria-label="Resetear zoom"
                 title="Resetear zoom al 100%"
                 className="text-[10px] font-black text-amber-400 hover:text-amber-300 border border-amber-700 px-2 py-1 rounded-md transition-colors"
               >
                 {Math.round(appZoom * 100)}%
               </button>
             )}
             <span className="text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-full text-slate-300 border border-slate-700 hidden md:block uppercase">{currentUser.name}</span>
             <button onClick={handleLogout} aria-label="Cerrar sesión" className="text-slate-400 hover:text-red-400 transition-colors"><LogOut size={20}/></button>
        </div>
      </header>

      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div className="flex-none bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest animate-pulse">
          <WifiOff size={14}/> Sin conexión — mostrando datos en caché. Los cambios se guardarán cuando vuelva la conexión.
        </div>
      )}

      {/* TOAST CONTAINER */}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-live="assertive"
          aria-label="Notificaciones"
          className="fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none"
        >
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast config={t} onDismiss={dismissToast} />
            </div>
          ))}
        </div>
      )}

      {/* CONTENEDOR FLEX PRINCIPAL (min-h-0 es la clave técnica de Flexbox para que no se rompa el scroll) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* SIDEBAR ESTÁTICO (su propio scroll independiente) */}
        <nav className="hidden sm:flex w-56 h-full flex-none bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col overflow-y-auto scrollbar-none">
            <div className="p-4 space-y-1">
                <NavButton active={activeTab==='DASHBOARD'} onClick={()=>setActiveTab('DASHBOARD')} icon={<LayoutDashboard size={18}/>} label="Dashboard" />
                <NavButton active={activeTab==='REQUEST'} onClick={()=>{setActiveTab('REQUEST'); setRequestMode('MENU');}} icon={<FileText size={18}/>} label="1. Solicitud" disabled={!canCreateRequest}/>
                <NavButton active={activeTab==='LOGISTICS'} onClick={()=>setActiveTab('LOGISTICS')} icon={<Truck size={18}/>} label="2. Logística" disabled={!canViewLogistics} />
                <NavButton active={activeTab==='DOCS'} onClick={()=>setActiveTab('DOCS')} icon={<FileCheck size={18}/>} label="Documentos" />
                <NavButton active={activeTab==='WAREHOUSE'} onClick={()=>setActiveTab('WAREHOUSE')} icon={<Warehouse size={18}/>} label="3. Bodega" />
                <NavButton active={activeTab==='SCANNER'} onClick={()=>setActiveTab('SCANNER')} icon={<QrCode size={18}/>} label="4. Escáner" />
                <NavButton active={activeTab==='RETURNS'} onClick={()=>setActiveTab('RETURNS')} icon={<RotateCcw size={18}/>} label="5. Retornos" />
                <NavButton active={activeTab==='SPAREPARTS'} onClick={()=>setActiveTab('SPAREPARTS')} icon={<Package size={18}/>} label="6. Repuestos" />
                {isAdmin && (
                  <NavButton active={activeTab==='ADMIN'} onClick={()=>setActiveTab('ADMIN')} icon={<Shield size={18}/>} label="Admin" />
                )}
            </div>
            <div className="mt-auto p-4 border-t bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Actividad Reciente</h4>
                <div className="space-y-2">
                    {logs.slice(0, 3).map(log => (
                        <div key={log.id} className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 border-l-2 border-slate-200 dark:border-slate-600 pl-2">
                            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">{log.action}</span> {new Date(log.timestamp).toLocaleDateString()}
                        </div>
                    ))}
                </div>
            </div>
        </nav>

        {/* CONTENIDO PRINCIPAL (su propio scroll vertical independiente) */}
        <main className="flex-1 h-full overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 pb-4 md:pb-12 relative">
            {activeTab === 'DASHBOARD' && (
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
                        // ── Datos para gráficas ────────────────────────────────────────
                        // Órdenes por mes (últimos 6 meses)
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

                        // Distribución por estado (para pie chart)
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

                        // Alertas activas
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
                            {/* Bar chart — órdenes por mes */}
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

                            {/* Pie chart — distribución por estado */}
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
                            {/* Últimos movimientos */}
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

                            {/* Top proveedores */}
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
            )}

            {activeTab === 'REQUEST' && (
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
                                                    {requestItems.length === 0 ? ( <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-xs italic">Agregue repuestos a la lista usando el panel inferior.</td></tr> ) : ( requestItems.map(item => ( <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700"><td className="p-4 font-bold text-slate-700 dark:text-slate-200">{item.pn}</td><td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{item.description}</td><td className="p-4 text-center font-mono dark:text-slate-300">{item.cantidad}</td><td className="p-4 text-right font-bold dark:text-slate-200">${(item.cantidad * item.cost).toFixed(2)}</td><td className="p-4 text-center"><button type="button" aria-label="Eliminar item" onClick={() => setRequestItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td></tr> )) )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {canCreateRequest && (
                                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 w-full"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">P/N</label><input value={reqPn} onChange={e => setReqPn(e.target.value)} type="text" placeholder="Ej. 5406622" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-200 dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="flex-[2] w-full"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Descripción</label><input value={reqDesc} onChange={e => setReqDesc(e.target.value)} type="text" placeholder="Ej. BOARD, MAIN SYSTEM" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-200 dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="flex gap-3 w-full md:w-auto">
                                                <div className="w-20"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Cant.</label><input value={reqQty} onChange={e => setReqQty(Number(e.target.value))} type="number" min="1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-center dark:bg-slate-800 dark:text-white"/></div>
                                                <div className="w-32"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo ($)</label><input value={reqCost} onChange={e => setReqCost(e.target.value)} type="number" min="0" step="0.01" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/></div>
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
                                        <h2 className="text-lg font-bold">Préstamo de Herramientas</h2>
                                        <p className="text-amber-100 text-[10px] uppercase font-bold tracking-widest mt-0.5">Solicitud de préstamo temporal</p>
                                    </div>
                                </div>
                                {!canCreateRequest && <span className="bg-amber-700 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Lectura</span>}
                            </div>
                            <form onSubmit={handleCreateToolsRequest} className="p-6 md:p-10 space-y-8">
                                {/* Información General */}
                                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div> 1. Información del Préstamo
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <EditableField label="Solicitante" name="solicitante" disabled={!canCreateRequest}/>
                                        <EditableField label="Departamento / Área" name="departamento" disabled={!canCreateRequest}/>
                                        <EditableField label="Equipo / Proyecto Destino" name="equipo_destino" disabled={!canCreateRequest}/>
                                        <div className="flex flex-col">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Fecha de Devolución</label>
                                            <input type="date" name="fecha_devolucion" required
                                                className="border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-amber-200 outline-none"
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex flex-col">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Motivo / Descripción del Uso</label>
                                            <textarea name="motivo" rows={2} required
                                                className="border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                                                placeholder="Describe el propósito del préstamo..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de herramientas */}
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div> 2. Herramientas Solicitadas ({requestItems.length})
                                        </div>
                                    </h3>
                                    <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
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
                                    {canCreateRequest && (
                                        <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-lg border border-amber-200 dark:border-amber-800 flex flex-col md:flex-row flex-wrap gap-4 items-end">
                                            <div className="flex-1 min-w-[120px]"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Código / ID</label><input value={reqPn} onChange={e => setReqPn(e.target.value)} type="text" placeholder="Ej. TOOL-001" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="flex-[2] min-w-[180px]"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Nombre de la Herramienta</label><input value={reqDesc} onChange={e => setReqDesc(e.target.value)} type="text" placeholder="Ej. Multímetro digital Fluke 117" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="w-20"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Cant.</label><input value={reqQty} onChange={e => setReqQty(Number(e.target.value))} type="number" min="1" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-center dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="w-32"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo Herramienta ($)</label><input value={reqCost} onChange={e => setReqCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/></div>
                                            <div className="w-32"><label className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase mb-2 block">Costo / Día ($)</label><input value={reqCostoDia} onChange={e => setReqCostoDia(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-right dark:bg-slate-800 dark:text-white"/></div>
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
            )}
            {activeTab === 'LOGISTICS' && ( 
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
            )}

            {activeTab === 'DOCS' && ( 
                <div className="max-w-5xl mx-auto space-y-6 flex flex-col min-h-0">
                    {!selectedAssetId ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 text-center border-b-8 border-slate-900 dark:border-slate-700">
                                <div className="bg-slate-100 dark:bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <FolderOpen size={40} className="text-slate-800 dark:text-slate-200"/>
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter">Repositorio Documental</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto font-medium">Gestione facturas, guías y certificados de cada Orden de Compra.</p>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-slate-800 transition-colors" size={20} />
                                <input type="text" placeholder="Buscar por número de orden..." value={docSearchTerm} onChange={(e) => setDocSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-0 focus:border-slate-900 outline-none bg-white dark:bg-slate-800 shadow-sm transition-all font-bold text-slate-700 dark:text-slate-200"/>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left min-w-[700px]">
                                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase tracking-widest">
                                            <tr><th className="p-5">Orden</th><th className="p-5">Proyecto / Equipo</th><th className="p-5">Solicitud</th><th className="p-5 text-center">Docs</th><th className="p-5 w-10"></th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {(Object.entries(assetsByOrder) as [string, Asset[]][])
                                                .filter(([id, g]) => id.toLowerCase().includes(docSearchTerm.toLowerCase()) || g[0].metadata.description.toLowerCase().includes(docSearchTerm.toLowerCase()))
                                                .map(([id, group]) => {
                                                    const main = group[0];
                                                    const docs = main.logistics.extra_docs?.length || 0;
                                                    return (
                                                    <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group">
                                                            <td className="p-5"><div className="font-black text-slate-800 dark:text-slate-200 text-sm">{id}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{main.metadata.workflow_id}</div></td>
                                                            <td className="p-5"><div className="text-slate-600 dark:text-slate-400 font-bold max-w-xs truncate">{main.metadata.description}</div><div className="text-[9px] text-blue-700 uppercase font-black mt-1 tracking-widest">{main.metadata.provider}</div></td>
                                                            <td className="p-5 text-slate-400 font-mono font-bold uppercase">{new Date(main.metadata.fecha_solicitud).toLocaleDateString()}</td>
                                                            <td className="p-5 text-center"><span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${docs > 0 ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{docs}</span></td>
                                                            <td className="p-5 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                                                                <button
                                                                  onClick={() => setSelectedAssetId(main.id)}
                                                                  aria-label={`Ver expediente ${id}`}
                                                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                                >
                                                                  <ChevronRight size={20}/>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col animate-fadeIn overflow-hidden min-h-0">
                            <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 md:p-8 flex justify-between items-center shadow-lg shrink-0">
                                <div>
                                    <button onClick={() => setSelectedAssetId(null)} className="text-[10px] uppercase font-black text-slate-400 hover:text-white flex items-center gap-2 mb-3 transition-colors tracking-widest"><ChevronLeft size={16}/> Volver</button>
                                    <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">Expediente: {selectedAsset?.metadata.numero_orden_ge}</h2>
                                </div>
                                <div className="bg-white/10 px-6 py-4 rounded-lg backdrop-blur-md border border-white/10 hidden md:block text-center">
                                    <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">Documentación Cargada</div>
                                    <div className="text-3xl font-black">{selectedAsset?.logistics.extra_docs?.length || 0}</div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-6 md:p-10 bg-slate-50 dark:bg-slate-900">
                                {(!selectedAsset?.logistics.extra_docs || selectedAsset.logistics.extra_docs.length === 0) && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border-4 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 m-4">
                                        <FileText size={80} className="mb-6 text-slate-200 dark:text-slate-700"/>
                                        <p className="font-black uppercase tracking-widest text-xs">Sin archivos adjuntos</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {selectedAsset?.logistics.extra_docs?.map((doc) => {
                                        const ext     = doc.filename.split('.').pop()?.toLowerCase() ?? '';
                                        const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
                                        const isPdf   = ext === 'pdf';
                                        const hasFile = !!doc.url && doc.url !== '' && doc.url !== '#';
                                        return (
                                        <div key={doc.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                                            {/* Thumbnail / preview strip */}
                                            <div
                                                className={`relative w-full h-36 flex items-center justify-center cursor-pointer overflow-hidden ${isImage ? '' : 'bg-slate-50 dark:bg-slate-900'}`}
                                                onClick={() => hasFile && openPreview(doc)}
                                                title="Clic para vista previa"
                                            >
                                                {isImage ? (
                                                    <img src={doc.url} alt={doc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-300 dark:text-slate-600">
                                                        <FileText size={48} className={isPdf ? 'text-red-400' : 'text-slate-300'}/>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{isPdf ? 'PDF' : doc.filename.split('.').pop()?.toUpperCase() ?? 'DOC'}</span>
                                                    </div>
                                                )}
                                                {hasFile && (
                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Eye size={28} className="text-white drop-shadow-lg"/>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="p-4 flex-1 flex flex-col">
                                                <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight mb-1 line-clamp-1">{doc.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-mono truncate mb-3">{doc.filename}</p>
                                                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-auto">
                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">{new Date(doc.date).toLocaleDateString()}</span>
                                                    <span className="text-[9px] text-blue-700 dark:text-blue-400 font-black uppercase">@{doc.uploaded_by}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex border-t border-slate-100 dark:border-slate-700">
                                                <button
                                                    onClick={() => hasFile && openPreview(doc)}
                                                    disabled={!hasFile}
                                                    aria-label="Vista previa"
                                                    className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
                                                >
                                                    <Eye size={14}/> Vista previa
                                                </button>
                                                <div className="w-px bg-slate-100 dark:bg-slate-700"/>
                                                <button
                                                    onClick={() => downloadDoc(doc)}
                                                    disabled={!hasFile}
                                                    aria-label="Descargar documento"
                                                    className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
                                                >
                                                    <Download size={14}/> Descargar
                                                </button>
                                                <div className="w-px bg-slate-100 dark:bg-slate-700"/>
                                                <button
                                                    onClick={() => handleDeleteDoc(doc.id)}
                                                    aria-label="Eliminar documento"
                                                    className="py-2.5 px-4 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-6 md:p-8 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
                                <form onSubmit={handleUploadDoc} className="flex flex-col gap-4">
                                    <div className="flex flex-col md:flex-row gap-6 items-end">
                                        <div className="flex-1 w-full"><label className="text-[9px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Descripción del Documento</label><input type="text" value={docName} onChange={(e)=>setDocName(e.target.value)} placeholder="Ej. Factura Comercial" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-bold focus:border-slate-800 outline-none transition-all dark:bg-slate-900 dark:text-white" required /></div>
                                        <div className="flex-1 w-full">
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Seleccionar Archivo</label>
                                            <div className="relative group/file">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                                                    onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    required
                                                />
                                                <div className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-3 group-hover/file:border-blue-400 group-hover/file:bg-blue-50/30 dark:group-hover/file:bg-blue-900/10 transition-all">
                                                    <Upload size={18} className="text-slate-400 group-hover/file:text-blue-500 transition-colors"/>
                                                    <span className="truncate font-medium">{docFile ? docFile.name : 'Arrastrar archivo o click para seleccionar'}</span>
                                                    {docFile && <span className="ml-auto text-[10px] text-slate-400">{(docFile.size / 1024).toFixed(0)} KB</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button type="submit" disabled={uploadingDoc} className="w-full md:w-auto bg-slate-900 dark:bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
                                            {uploadingDoc ? <Loader2 size={20} className="animate-spin"/> : <UploadCloud size={20}/>}
                                            {uploadingDoc ? `Subiendo ${uploadProgress}%` : 'Adjuntar'}
                                        </button>
                                    </div>
                                    {uploadingDoc && (
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'RETURNS' && (
                <div className="space-y-6 animate-fadeIn">
                    {!managingReturnAsset ? (
                    <div className="space-y-6">

                        {/* ── TABS ── */}
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

                        {/* ── RETORNOS GARANTÍA / SERVICIO ── */}
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
                                            <td className="p5">
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

                        {/* ── PRÉSTAMOS DE HERRAMIENTAS ── */}
                        {returnsSubTab === 'LOANS' && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="bg-amber-600 px-8 py-6 text-white">
                                <h3 className="font-black uppercase tracking-widest flex items-center gap-3">
                                    <Wrench size={24}/> Préstamos de Herramientas
                                </h3>
                                <p className="text-amber-100 text-[10px] uppercase font-bold mt-1 tracking-widest opacity-80">
                                    Control de herramientas prestadas y fechas de devolución
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left min-w-[1000px]">
                                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-black uppercase tracking-widest">
                                        <tr>
                                            <th className="p-5">No. Préstamo</th>
                                            <th className="p-5">Herramienta</th>
                                            <th className="p-5">Solicitante</th>
                                            <th className="p-5">Departamento</th>
                                            <th className="p-5 text-center">Cant.</th>
                                            <th className="p-5 text-right">Costo Herr.</th>
                                            <th className="p-5 text-right">Costo/Día</th>
                                            <th className="p-5 text-center">F. Devolución</th>
                                            <th className="p-5 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').length === 0 && (
                                            <tr><td colSpan={9} className="p-16 text-center text-slate-300 dark:text-slate-600 uppercase font-black text-xs italic tracking-widest">No hay préstamos registrados</td></tr>
                                        )}
                                        {assets.filter(a => a.metadata.workflow_id === 'PRESTAMO-HERRAMIENTA').map(asset => {
                                            const meta = asset.metadata as any;
                                            const fechaDev = meta.fecha_devolucion ? new Date(meta.fecha_devolucion) : null;
                                            const hoy = new Date();
                                            const vencido = fechaDev && fechaDev < hoy && asset.current_status !== AssetStatus.DISPATCHED;
                                            return (
                                                <tr key={asset.id} onClick={() => handleOpenReturnManagement(asset)} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors cursor-pointer group">
                                                    <td className="p-5 font-black text-amber-700 dark:text-amber-400 uppercase tracking-tighter">{asset.metadata.numero_orden_ge}</td>
                                                    <td className="p-5">
                                                        <div className="font-black text-slate-800 dark:text-slate-200 font-mono uppercase tracking-tighter text-[11px]">{asset.metadata.pn}</div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold max-w-xs truncate mt-0.5">{asset.metadata.description}</div>
                                                    </td>
                                                    <td className="p-5 font-bold text-slate-700 dark:text-slate-200 uppercase text-[11px]">{asset.metadata.cliente_final || '-'}</td>
                                                    <td className="p-5 text-slate-500 dark:text-slate-400 text-[11px]">{meta.departamento || '-'}</td>
                                                    <td className="p-5 text-center font-mono font-bold text-slate-700 dark:text-slate-200">{asset.metadata.cantidad}</td>
                                                    <td className="p-5 text-right font-mono text-slate-600 dark:text-slate-300">${(asset.metadata.cost || 0).toFixed(2)}</td>
                                                    <td className="p-5 text-right font-mono text-amber-600 dark:text-amber-400">${(meta.costo_dia || 0).toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">/día</span></td>
                                                    <td className="p-5 text-center">
                                                        {fechaDev ? (
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black ${vencido ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                                {fechaDev.toLocaleDateString('es-ES')}
                                                                {vencido && ' ⚠'}
                                                            </span>
                                                        ) : <span className="text-slate-300 italic text-[10px]">-</span>}
                                                    </td>
                                                    <td className="p-5 text-center"><StatusBadge status={asset.current_status}/></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )}

                    </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-fadeIn">
                            <div className="bg-slate-900 dark:bg-slate-950 p-6 md:p-8 text-white">
                                <button onClick={() => setManagingReturnAsset(null)} className="text-[10px] uppercase font-black text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors tracking-widest"><ArrowLeft size={16}/> Volver a la lista</button>
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
                                        {managingReturnAsset.logistics.extra_docs?.length === 0 && (
                                            <p className="text-center text-xs text-slate-400 italic py-4">Sin documentos adjuntos</p>
                                        )}
                                        {managingReturnAsset.logistics.extra_docs?.map((doc) => (
                                            <div key={doc.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500 dark:text-slate-300"><FileText size={16}/></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{doc.name}</div>
                                                    <div className="text-[9px] text-slate-400 truncate">{doc.filename}</div>
                                                </div>
                                                <button className="text-blue-600 hover:text-blue-800 p-2"><Download size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'WAREHOUSE' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                        <button onClick={() => setWarehouseSubTab('ENTRY')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'ENTRY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            <Truck size={18} /> <span>Recepción</span>
                            {assets.filter(a => a.current_status === AssetStatus.CUSTOMS).length > 0 && (
                                <span className="bg-white text-slate-900 w-5 h-5 flex items-center justify-center rounded-full font-black animate-pulse shadow-sm">{assets.filter(a => a.current_status === AssetStatus.CUSTOMS).length}</span>
                            )}
                        </button>
                        <button onClick={() => setWarehouseSubTab('INVENTORY')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'INVENTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            <Layers size={18} /> <span>Inventario</span>
                        </button>
                        <button onClick={() => setWarehouseSubTab('MOVEMENTS')} className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-3 transition-all ${warehouseSubTab === 'MOVEMENTS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            <ArrowRight size={18} /> <span>Salidas</span>
                        </button>
                    </div>

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

                    {warehouseSubTab === 'INVENTORY' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-6">
                                <div className="relative w-full md:max-w-md group">
                                    <Search className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-slate-800 transition-colors" size={20} />
                                    <input type="text" placeholder="Buscar por sku o descripción..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} className="w-full pl-12 pr-6 py-3.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-slate-800 focus:ring-0 outline-none font-bold text-sm bg-slate-50 dark:bg-slate-900 dark:text-white"/>
                                </div>
                                <div className="flex w-full md:w-auto gap-4">
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
                                                // Obtener condiciones únicas de todos los assets de este P/N
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
                                    <div className="flex justify-end">
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
                </div>
            )}

            {activeTab === 'SCANNER' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-12">
                    <div className="bg-white dark:bg-slate-800 p-12 rounded-[40px] shadow-2xl text-center max-w-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
                        <div className="bg-slate-50 dark:bg-slate-800 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:scale-110 transition-transform">
                            <ScanLine size={60} className="text-slate-800 dark:text-slate-200 animate-pulse"/>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-tighter">Motor de Escaneo</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-10">Capture códigos QR de etiquetas OmniTrace para auditoría instantánea.</p>
                        <button onClick={handleScanMock} className="bg-slate-900 dark:bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest w-full hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-2xl shadow-slate-200 dark:shadow-none active:scale-95">
                            Ejecutar Escáner
                        </button>
                    </div>
                    {scannedAsset && (
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl border-2 border-emerald-600 w-full max-w-md animate-fadeIn relative">
                            <div className="absolute -top-4 left-8 bg-emerald-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Resultado de Búsqueda</div>
                            <div className="flex justify-between items-start mb-8">
                                <h3 className="font-black text-emerald-900 dark:text-emerald-400 flex items-center gap-3 uppercase tracking-tighter text-xl"><CheckCircle size={24}/> Activo Válido</h3>
                                <button onClick={()=>setScannedAsset(null)} className="text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24}/></button>
                            </div>
                            <div className="space-y-3">
                                <InfoField label="Identificador" value={<span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{scannedAsset.id}</span>} />
                                <InfoField label="Part Number" value={<span className="font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{scannedAsset.metadata.pn}</span>} />
                                <InfoField label="Descripción" value={<span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-tight leading-none block pt-1">{scannedAsset.metadata.description}</span>} />
                                <InfoField label="Estado Actual" value={<StatusBadge status={scannedAsset.current_status}/>} />
                                <div className="pt-8 mt-6 border-t-2 border-dashed border-slate-100 dark:border-slate-700 flex gap-4">
                                    <div className="flex-1"><AssetLabelPDF asset={scannedAsset} /></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
                    {/* ── MÓDULO REPUESTOS ── */}
            {activeTab === 'SPAREPARTS' && (() => {


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
                            const rawObs = String(row['OBSERVACION'] || row['Observacion'] || '').trim();
                            
                            // Extraer precio si viene dentro de observación o condición (ej: "COMPRA 5233.06", "13887,20$", "CS 421.4", "544,74 GARANTÍA")
                            let extractedPrice: number | undefined = undefined;
                            const priceMatch = rawObs.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:\$|USD)?/);
                            if (priceMatch) {
                                const numCandidate = parseFloat(priceMatch[1].replace(',', '.'));
                                if (!isNaN(numCandidate) && numCandidate > 0) {
                                    extractedPrice = numCandidate;
                                }
                            }

                            // Limpiar la condición para que no quede con el número mezclado
                            let cleanCondition = rawObs;
                            if (extractedPrice !== undefined) {
                                cleanCondition = rawObs
                                    .replace(/[\d.,]+\s*\$?/g, '')
                                    .replace(/\bUSD\b/gi, '')
                                    .trim();
                                if (!cleanCondition) cleanCondition = 'COMPRA';
                            }

                            const sp: any = {
                                pn:          String(row['P/N'] || row['PN'] || row['pn'] || '').trim(),
                                descripcion: String(row['DESCRIPCIÓN'] || row['DESCRIPCION'] || row['Descripción'] || '').trim(),
                                cantidad:    Number(row['CANTIDAD'] || row['Cantidad'] || 1),
                                cliente:     String(row['CLIENTE'] || row['Cliente'] || '').trim(),
                                mod:         String(row['MOD'] || row['Mod'] || '').trim(),
                                equipo:      String(row['Equipo'] || row['EQUIPO'] || '').trim(),
                                workflow_id: String(row['WF'] || row['Wf'] || '').trim(),
                                orden_ge:    String(row['ORDEN'] || row['Orden'] || '').trim(),
                                condicion:   cleanCondition || '—',
                                observacion: rawObs,
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
                        const batch = writeBatch(db);
                        spareParts.forEach(sp => {
                            batch.delete(doc(db, 'spare_parts', sp.id));
                        });
                        await batch.commit();
                        showToast('Base de repuestos vaciada. Ahora puedes importar el archivo limpio.', 'info', 5000);
                    } catch (err: any) {
                        showError(`Error al vaciar: ${err.message}`);
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
                        condicion: (fd.get('condicion') as string || '').trim(),
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
                                condicion: a.metadata.condicion || '',
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
                        'CONDICIÓN': sp.condicion,
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
                                                return (
                                                    <tr key={sp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                        <td className="px-4 py-3">
                                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">{sp.pn || '—'}</span>
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
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                sp.condicion?.toLowerCase().includes('garantia') || sp.condicion?.toLowerCase().includes('garantía')
                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                                    : sp.condicion?.toLowerCase().includes('doa')
                                                                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                                                    : sp.condicion?.toLowerCase().includes('compra')
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                            }`}>{sp.condicion || '—'}</span>
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
                                        const sp: Omit<SparePart, 'id'> = {
                                            pn: fd.get('pn') as string,
                                            descripcion: fd.get('descripcion') as string,
                                            cantidad: Number(fd.get('cantidad')),
                                            cliente: fd.get('cliente') as string,
                                            mod: fd.get('mod') as string,
                                            equipo: fd.get('equipo') as string,
                                            workflow_id: fd.get('workflow_id') as string || '',
                                            orden_ge: fd.get('orden_ge') as string || '',
                                            condicion: fd.get('condicion') as string,
                                            observacion: fd.get('observacion') as string || '',
                                            mes: new Date().toLocaleString('es-ES', { month: 'long' }),
                                            anio: new Date().getFullYear(),
                                            fecha_pedido: fd.get('fecha_pedido') as string || '',
                                            fecha_llegada: '',
                                            fecha_despacho: fd.get('fecha_instalacion') as string || '',
                                            fecha_egreso: '',
                                            fecha_instalacion: fd.get('fecha_instalacion') as string || '',
                                            fecha_llegada_tentativa: '',
                                            created_by: currentUser.name,
                                            created_at: new Date().toISOString(),
                                            source: 'MANUAL',
                                        };
                                        await doc(db, 'spare_parts', id);
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
                                                <option value="COMPRA">Compra</option>
                                                <option value="GARANTIA">Garantía</option>
                                                <option value="DOA">DOA</option>
                                                <option value="FOI">FOI</option>
                                                <option value="CONTRATO_SERVICIO">Contrato Servicio</option>
                                            </select>
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
            })()}

                    {/* ── PANEL DE ADMINISTRACIÓN ── */}
            {activeTab === 'ADMIN' && isAdmin && (

                <div className="space-y-6 animate-fadeIn w-full">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                <Shield size={28} className="text-blue-600"/> Administración
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Gestión de usuarios, roles y permisos — Solo ADMIN</p>
                        </div>
                        <button
                            onClick={() => setShowAddUser(v => !v)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md w-full sm:w-auto justify-center"
                        >
                            <Plus size={16}/> Agregar Usuario
                        </button>
                    </div>

                    {/* Agregar usuario */}
                    {showAddUser && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg p-6 animate-fadeIn">
                            <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest mb-5 flex items-center gap-2">
                                <Plus size={16} className="text-blue-600"/> Registrar Nuevo Usuario
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nombre Completo</label>
                                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="ej. Juan García"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none dark:bg-slate-700 dark:text-white"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email Corporativo</label>
                                    <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="usuario@orimec.com.ec"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none dark:bg-slate-700 dark:text-white"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Rol Base</label>
                                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none dark:bg-slate-700 dark:text-white">
                                        <option value="REQUESTER">REQUESTER — Solo solicitudes</option>
                                        <option value="IMPORTER">IMPORTER — Logística</option>
                                        <option value="WAREHOUSE">WAREHOUSE — Bodega</option>
                                        <option value="ADMIN">ADMIN — Acceso total</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                                <p className="text-amber-800 dark:text-amber-300 text-xs font-bold flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                                    Después de registrar aquí, crea la cuenta en <strong>Firebase Console → Authentication → Agregar usuario</strong> con el mismo email.
                                </p>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setShowAddUser(false)} className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                                <button onClick={handleRegisterUser} disabled={!newUserEmail.trim() || !newUserName.trim()}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-40 flex items-center gap-2 transition-colors shadow-md">
                                    <Plus size={14}/> Registrar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabla de usuarios */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-black text-slate-700 dark:text-slate-200 text-xs uppercase tracking-widest flex items-center gap-2">
                                <Users size={16}/> Usuarios Registrados ({firestoreUsers.length})
                            </h3>
                            {usersLoading && <Loader2 size={16} className="animate-spin text-slate-400"/>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left min-w-[800px]">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4">Usuario</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Rol</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-center">Actividad</th>
                                        <th className="px-6 py-4">Último Acceso</th>
                                        <th className="px-6 py-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {firestoreUsers.length === 0 && !usersLoading && (
                                        <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-400 italic">Sin usuarios registrados</td></tr>
                                    )}
                                    {firestoreUsers.sort((a, b) => a.email.localeCompare(b.email)).map(u => {
                                        const isSelf = u.uid === currentUser?.id;
                                        const roleBadge: Record<string, string> = {
                                            ADMIN:     'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
                                            IMPORTER:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
                                            WAREHOUSE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
                                            REQUESTER: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
                                        };
                                        return (
                                            <React.Fragment key={u.uid}>
                                            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!u.active ? 'opacity-50' : ''} ${editingUserPerms === u.uid ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm ${
                                                            u.role === 'ADMIN' ? 'bg-red-600' : u.role === 'IMPORTER' ? 'bg-blue-600' : u.role === 'WAREHOUSE' ? 'bg-emerald-600' : 'bg-slate-500'
                                                        } ${!u.active ? 'opacity-50' : ''}`}>
                                                            {u.displayName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                                {u.displayName}
                                                                {isSelf && <span className="text-[9px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded font-black uppercase">Tú</span>}
                                                                {(u as any).pending && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase">Pendiente</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{u.email}</td>
                                                <td className="px-6 py-4">
                                                    {editingUser === u.uid ? (
                                                        <div className="flex items-center gap-2">
                                                            <select defaultValue={u.role} onChange={e => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                                                                className="text-[10px] font-black uppercase border border-blue-300 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-200" autoFocus>
                                                                <option value="REQUESTER">REQUESTER</option>
                                                                <option value="IMPORTER">IMPORTER</option>
                                                                <option value="WAREHOUSE">WAREHOUSE</option>
                                                                <option value="ADMIN">ADMIN</option>
                                                            </select>
                                                            <button onClick={() => setEditingUserMgmt(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${roleBadge[u.role] || roleBadge.REQUESTER}`}>
                                                            {u.role}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => handleToggleUserActive(u.uid, u.active)} disabled={isSelf}
                                                        title={u.active ? 'Click para desactivar' : 'Click para activar'}
                                                        className={`flex items-center gap-1.5 mx-auto text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all disabled:cursor-not-allowed ${u.active ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                                                        {u.active ? <><ToggleRight size={14}/> Activo</> : <><ToggleLeft size={14}/> Inactivo</>}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const n = logs.filter(l => l.user_name === u.displayName).length;
                                                        return <span className={`font-black text-sm ${n > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300'}`}>{n}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">
                                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => setEditingUserMgmt(editingUser === u.uid ? null : u.uid)} disabled={isSelf && u.role === 'ADMIN'}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all disabled:opacity-30" title="Cambiar rol">
                                                            <Edit3 size={15}/>
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingUserPerms(editingUserPerms === u.uid ? null : u.uid)}
                                                            className={`p-2 rounded-lg transition-all ${editingUserPerms === u.uid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
                                                            title="Editar permisos">
                                                            <Shield size={15}/>
                                                        </button>
                                                        {!u.email.includes('pending') && (
                                                            <button onClick={() => handleResetPasswordForUser(u.email)}
                                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all" title="Enviar reset de contraseña">
                                                                <RotateCcw size={15}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ── Panel de permisos granulares ── */}
                                            {editingUserPerms === u.uid && (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-0">
                                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 my-3 animate-fadeIn">
                                                            <div className="flex items-center justify-between mb-5">
                                                                <div>
                                                                    <h4 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                                                        <Shield size={16} className="text-blue-600"/> Permisos de {u.displayName}
                                                                    </h4>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">Los permisos sobreescriben el comportamiento del rol base. Activos = ✅</p>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={async () => {
                                                                            const defaults = DEFAULT_PERMISSIONS[u.role] || DEFAULT_PERMISSIONS.REQUESTER;
                                                                            await updateDoc(doc(db, 'users', u.uid), { permissions: defaults });
                                                                            showToast('Permisos reseteados al rol base.', 'info');
                                                                        }}
                                                                        className="text-[10px] font-black uppercase px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
                                                                    >
                                                                        <RotateCcw size={12}/> Reset al rol
                                                                    </button>
                                                                    <button onClick={() => setEditingUserPerms(null)}
                                                                        className="text-[10px] font-black uppercase px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition-colors">
                                                                        <CheckCircle size={12}/> Listo
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Grid de permisos por grupo */}
                                                            {['Solicitud','Logística','Bodega','Documentos','Retornos'].map(group => {
                                                                const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                                                                const defaults = DEFAULT_PERMISSIONS[u.role] || {};
                                                                const userPerms = u.permissions || defaults;
                                                                return (
                                                                    <div key={group} className="mb-5">
                                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                            <span className="w-4 h-px bg-slate-300 dark:bg-slate-600 inline-block"/>
                                                                            {group}
                                                                        </h5>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                            {groupPerms.map(perm => {
                                                                                const isEnabled = userPerms[perm.key] ?? defaults[perm.key] ?? false;
                                                                                const isDefault = defaults[perm.key] ?? false;
                                                                                const isCustomized = u.permissions && perm.key in u.permissions && u.permissions[perm.key] !== isDefault;
                                                                                return (
                                                                                    <button
                                                                                        key={perm.key}
                                                                                        type="button"
                                                                                        onClick={() => handleUpdateUserPermission(u.uid, perm.key, !isEnabled)}
                                                                                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                                                                            isEnabled
                                                                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                                                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                                                                                        }`}
                                                                                    >
                                                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all ${isEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                                                                            {isEnabled && <CheckCircle size={13} className="text-white"/>}
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <span className={`text-[11px] font-black ${isEnabled ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                                                    {perm.label}
                                                                                                </span>
                                                                                                {isCustomized && (
                                                                                                    <span className="text-[8px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1 py-0.5 rounded font-black uppercase">Custom</span>
                                                                                                )}
                                                                                            </div>
                                                                                            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{perm.description}</p>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Info de roles */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { role: 'REQUESTER', color: 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: '📋', perms: ['Ver Dashboard', 'Crear solicitudes', 'Préstamo herramientas'] },
                            { role: 'IMPORTER',  color: 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800',   icon: '🚢', perms: ['Gestionar logística', 'Costos y liquidación', 'Ver documentos'] },
                            { role: 'WAREHOUSE', color: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800', icon: '📦', perms: ['Recepción en bodega', 'Gestionar inventario', 'Despachos'] },
                            { role: 'ADMIN',     color: 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800',       icon: '🛡️', perms: ['Acceso total', 'Gestión de usuarios', 'Permisos granulares'] },
                        ].map(({ role, color, icon, perms }) => (
                            <div key={role} className={`rounded-xl border p-5 ${color}`}>
                                <div className="text-2xl mb-2">{icon}</div>
                                <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-widest mb-3">{role}</h4>
                                <ul className="space-y-1.5 mb-4">
                                    {perms.map(p => (
                                        <li key={p} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                            <CheckCircle size={11} className="text-emerald-500 shrink-0"/>{p}
                                        </li>
                                    ))}
                                </ul>
                                <div className="text-[9px] font-black text-slate-400 uppercase border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                                    {firestoreUsers.filter(u => u.role === role && u.active).length} activos
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
        
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center h-16 z-50 shadow-[0_-2px_20px_rgba(0,0,0,0.1)] pb-safe rounded-t-3xl">
            <NavButton mobileMode active={activeTab==='DASHBOARD'} onClick={()=>setActiveTab('DASHBOARD')} icon={<LayoutDashboard />} label="Dash" />
            <NavButton mobileMode active={activeTab==='REQUEST'} onClick={()=>{setActiveTab('REQUEST'); setRequestMode('MENU');}} icon={<Plus />} label="Nuevo" disabled={!canCreateRequest}/>
            <NavButton mobileMode active={activeTab==='LOGISTICS'} onClick={()=>setActiveTab('LOGISTICS')} icon={<Truck />} label="Logist" disabled={!canViewLogistics} />
            <NavButton mobileMode active={activeTab==='DOCS'} onClick={()=>setActiveTab('DOCS')} icon={<FileCheck />} label="Docs" />
            <NavButton mobileMode active={activeTab==='WAREHOUSE'} onClick={()=>setActiveTab('WAREHOUSE')} icon={<Warehouse />} label="Bodega" />
            <NavButton mobileMode active={activeTab==='SCANNER'} onClick={()=>setActiveTab('SCANNER')} icon={<QrCode />} label="Audit" />
            <NavButton mobileMode active={activeTab==='RETURNS'} onClick={()=>setActiveTab('RETURNS')} icon={<RotateCcw />} label="Retornos" />
        </nav>
      </div>

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

      {/* Modal para Seleccionar qué ítems cerrar (Multi-Item) */}
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

      {showDispatchModal && selectedInventoryItem && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
              <div role="dialog" aria-modal="true" aria-label="Tarjeta de Egreso" className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
                  {/* ... dispatch modal content ... */}
                  <div className="p-8 md:p-10 flex-1 overflow-y-auto">
                      <div className="flex justify-between items-start mb-10">
                          <div className="flex items-center gap-4">
                              <div className="bg-slate-900 p-3 rounded-2xl shadow-xl text-white"><ScanLine size={32} /></div>
                              <div>
                                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter leading-none">Tarjeta de Egreso</h3>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Disponibilidad Actual: <span className="text-blue-600 dark:text-blue-400">{inventoryStats[selectedInventoryItem].stock} UNI</span></p>
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
                              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cantidad</label><input type="number" min="1" max={inventoryStats[selectedInventoryItem].stock} value={dispatchData.quantity} onChange={(e) => setDispatchData({...dispatchData, quantity: parseInt(e.target.value) || 0})} className="w-full border-none bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 text-xl font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-slate-900 transition-all text-center"/></div>
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

      {showAddProductModal && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
              <div role="dialog" aria-modal="true" aria-label="Ajuste Manual de Stock" className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
                  {/* ... Add Product Modal ... */}
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

      {editingItem && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-xl md:rounded-[40px] shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
                  {/* ... Edit Product Modal ... */}
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

      {viewingAssetsItem && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-md">
              <div role="dialog" aria-modal="true" aria-label={`Audit Trail: ${viewingAssetsItem.pn}`} className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-w-3xl md:rounded-[40px] overflow-hidden animate-fadeIn flex flex-col md:max-h-[85vh] shadow-2xl">
                  {/* ... Viewing Assets Modal ... */}
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
      {/* Modal Vista Previa de Documento */}
      {previewDoc && (
          <div
              className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
              onClick={closePreview}
          >
              <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Vista previa: ${previewDoc.name}`}
                  className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                  onClick={e => e.stopPropagation()}
              >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
                      <div className="min-w-0">
                          <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate">{previewDoc.name}</h3>
                          <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{previewDoc.filename}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                          <button
                              onClick={() => downloadDoc(previewDoc)}
                              aria-label="Descargar"
                              className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow"
                          >
                              <Download size={14}/> Descargar
                          </button>
                          <button
                              onClick={closePreview}
                              aria-label="Cerrar vista previa"
                              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
                          >
                              <X size={18}/>
                          </button>
                      </div>
                  </div>

                  {/* Preview body */}
                  <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-0 p-4">
                      {previewLoading ? (
                          <div className="flex flex-col items-center gap-4 text-slate-400">
                              <Loader2 size={40} className="animate-spin"/>
                              <p className="text-xs font-black uppercase tracking-widest">Cargando archivo...</p>
                          </div>
                      ) : (() => {
                          if (!previewDataUrl) {
                              return (
                                  <div className="text-center text-slate-400 py-20">
                                      <FileText size={64} className="mx-auto mb-4 opacity-30"/>
                                      <p className="font-black uppercase text-xs tracking-widest mb-2">Archivo no disponible</p>
                                      <p className="text-[10px] mt-2 max-w-xs mx-auto">El archivo se almacena localmente en el navegador donde fue subido. Para compartirlo usa el botón Descargar y vuelve a adjuntarlo.</p>
                                  </div>
                              );
                          }
                          if (/^data:image\//i.test(previewDataUrl) || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(previewDoc.filename)) {
                              return (
                                  <img
                                      src={previewDataUrl}
                                      alt={previewDoc.name}
                                      className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                                  />
                              );
                          }
                          if (/\.pdf$/i.test(previewDoc.filename)) {
                              // Cloudinary convierte PDF a imagen automáticamente
                              // cambiando la extensión a .jpg en la URL
                              const isCloudinaryUrl = previewDataUrl.includes('cloudinary.com');
                              if (isCloudinaryUrl) {
                                  // Genera preview PNG de la primera página del PDF
                                  const previewImgUrl = previewDataUrl
                                      .replace('/upload/', '/upload/f_jpg,pg_1/')
                                      .replace(/\.pdf$/i, '.jpg');
                                  return (
                                      <div className="flex flex-col items-center gap-4 w-full h-full overflow-auto">
                                          <img
                                              src={previewImgUrl}
                                              alt={`Vista previa: ${previewDoc.name}`}
                                              className="max-w-full object-contain rounded-lg shadow-xl"
                                              onError={(e) => {
                                                  // Si falla la preview, mostrar fallback con botón abrir
                                                  const target = e.currentTarget;
                                                  target.style.display = 'none';
                                                  target.nextElementSibling?.classList.remove('hidden');
                                              }}
                                          />
                                          <div className="hidden text-center text-slate-500 dark:text-slate-400 py-10">
                                              <FileText size={48} className="mx-auto mb-3 text-red-400"/>
                                              <p className="font-black uppercase text-xs tracking-widest mb-4">Vista previa no disponible</p>
                                              <button
                                                  onClick={() => window.open(previewDataUrl, '_blank')}
                                                  className="px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2 mx-auto"
                                              >
                                                  <Eye size={16}/> Abrir PDF en nueva pestaña
                                              </button>
                                          </div>
                                          <button
                                              onClick={() => window.open(previewDataUrl, '_blank')}
                                              className="mb-4 px-5 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2"
                                          >
                                              <Eye size={14}/> Abrir PDF completo en nueva pestaña
                                          </button>
                                      </div>
                                  );
                              }
                              // Fallback para PDFs no-Cloudinary
                              return (
                                  <iframe
                                      src={previewDataUrl}
                                      title={previewDoc.name}
                                      className="w-full h-full min-h-[60vh] rounded-lg border-0"
                                  />
                              );
                          }
                          // Fallback: xlsx, docx, etc.
                          return (
                              <div className="text-center text-slate-500 dark:text-slate-400 py-20">
                                  <FileText size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600"/>
                                  <p className="font-black uppercase text-xs tracking-widest mb-2">Vista previa no disponible</p>
                                  <p className="text-[10px] mb-6 text-slate-400">Este tipo de archivo no puede previsualizarse en el navegador.</p>
                                  <button
                                      onClick={() => downloadDoc(previewDoc)}
                                      className="px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2 mx-auto"
                                  >
                                      <Download size={16}/> Descargar para abrir
                                  </button>
                              </div>
                          );
                      })()}
                  </div>

                  {/* Footer meta */}
                  <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">Subido por <span className="text-blue-600 dark:text-blue-400">@{previewDoc.uploaded_by}</span></span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(previewDoc.date).toLocaleString()}</span>
                  </div>
              </div>
          </div>
      )}

      {sessionExpired && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
              <div role="dialog" aria-modal="true" className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-fadeIn">
                  <div className="bg-red-600 p-6 text-white text-center">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                          <LogOut size={32} className="text-white"/>
                      </div>
                      <h3 className="font-black text-xl uppercase tracking-widest">Sesión Expirada</h3>
                      <p className="text-red-100 text-sm mt-1">Tu sesión ha expirado por inactividad</p>
                  </div>
                  <div className="p-8 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Vuelve a iniciar sesión para continuar usando OmniTrace.</p>
                      <button
                          onClick={() => { setSessionExpired(false); }}
                          className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                      >
                          <LogOut size={16}/> Volver al Login
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
    </AppErrorBoundary>
  );
}