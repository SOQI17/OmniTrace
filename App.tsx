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
  SparePart,
  DigitalEgressRecord,
  DigitalEgressItem
} from './types';
import { AssetLifecycleService } from './services/AssetLifecycleService';
import { AssetLabelPDF } from './components/AssetLabelPDF';
import { DigitalEgressModal } from './components/DigitalEgressModal';
import { SparePartsModule } from './components/modules/SparePartsModule';
import { WarehouseModule } from './components/modules/WarehouseModule';
import { DashboardModule } from './components/modules/DashboardModule';
import { AdminModule } from './components/modules/AdminModule';
import { DocsModule } from './components/modules/DocsModule';
import { ReturnsModule } from './components/modules/ReturnsModule';
import { ScannerModule } from './components/modules/ScannerModule';
import { RequestsModule } from './components/modules/RequestsModule';
import { LogisticsModule } from './components/modules/LogisticsModule';
import { LoginScreen } from './components/LoginScreen';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import {
  collection, doc, onSnapshot, writeBatch,
  query, orderBy, updateDoc, deleteDoc, setDoc, getDocs, where, addDoc
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

// ─── Normalización Inteligente de Condiciones de Repuestos ───────────────────
// Agrupa variaciones de texto en categorías estándar:
// 1. CONTRATO DE SERVICIOS (si contiene 'contrato', 'service contract', 'cs')
// 2. GARANTÍAS (si contiene 'garantía', 'garantia', 'warranty', 'wty')
// 3. DOA (si contiene 'doa', 'foa', 'foi')
// 4. WRONG SHIPMENT (si contiene 'wrong shipment', 'wrong shippment')
// 5. CONCESIÓN COMERCIAL (si contiene 'concesion comercial', 'conseción comercial', 'concesión', 'concession')
// 6. VENTAS (si contiene 'venta', 'compra', 'purchase', 'with payment', 'payment', o si solo contiene valor numérico de precio)
function normalizeSparePartCondition(cond: string | undefined | null, precio?: number): string {
  const str = (cond || '').trim();
  const lower = str.toLowerCase();

  // 1. Contrato de servicios (cualquier variación que mencione contrato o CS)
  if (/contrato|service\s*contract|\bcs\b/i.test(lower)) {
    return 'CONTRATO DE SERVICIOS';
  }

  // 2. Garantías (garantía, garantía extendida, warranty, wty)
  if (/garant[ií]a|warranty|\bwty\b/i.test(lower)) {
    return 'GARANTÍAS';
  }

  // 3. DOA / FOA / FOI (Dead on Arrival, FOA)
  if (/\b(doa|foa|foi)\b/i.test(lower)) {
    return 'DOA';
  }

  // 4. Wrong shipment (wrong shipment, wrong shippment)
  if (/wrong\s*ship+ment/i.test(lower)) {
    return 'WRONG SHIPMENT';
  }

  // 5. Concesión comercial (concesion comercial, conseción comercial, concession)
  if (/con[sc]e[cs]i[oó]n|concession/i.test(lower)) {
    return 'CONCESIÓN COMERCIAL';
  }

  // 6. Ventas / Compra / With payment / Payment / Símbolo de dólar ($) o USD
  if (/ventas?|compras?|purchase|sales?|with\s*payment|payment|\$|\busd\b/i.test(lower)) {
    return 'VENTAS';
  }

  // 7. Si el texto de la condición contiene $ o es puramente un precio (ej: "$", "5233.06", "13887,20$", "$450")
  if (str.includes('$')) {
    return 'VENTAS';
  }
  const isOnlyPriceString = /^[\$€£]?\s*\d+(?:[.,]\d{1,2})?\s*(?:usd|\$)?$/i.test(str.replace(/\s+/g, ''));
  if (isOnlyPriceString) {
    return 'VENTAS';
  }

  if (precio !== undefined && precio > 0 && (!str || str === '—' || str === '-' || str === 'MANUAL')) {
    return 'VENTAS';
  }

  if (!str || str === '—' || str === '-') {
    return precio !== undefined && precio > 0 ? 'VENTAS' : '—';
  }

  return str.toUpperCase();
}

// ─── FILTER SELECT ──────────────────────────────────────────────────────────
// Dropdown tipo "pill" profesional para los filtros de tabla
// (FilterSelect modularizado en components/ui/FilterSelect.tsx)

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
  // Estabilizados con useCallback: se pasan como props a módulos memo() y una
  // referencia nueva en cada render de App rompería su memoización.
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = generateUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    if (type !== 'confirm') setTimeout(() => dismissToast(id), duration);
    return id;
  }, [dismissToast]);

  const showConfirm = useCallback((message: string): Promise<boolean> =>
    new Promise(resolve => {
      const id = generateUUID();
      setToasts(prev => [...prev, {
        id, type: 'confirm', message,
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      }]);
    }), []);

  // Backward-compat helper (replaces showError calls)
  const showError = useCallback((msg: string) => showToast(msg, 'error', 5000), [showToast]);

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
  const [warehouseSubTab, setWarehouseSubTab] = useState<'ENTRY' | 'MOVEMENTS' | 'INVENTORY'>('INVENTORY');
  
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
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const [docSearchTerm, setDocSearchTerm] = useState('');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);

  // ─── Repuestos — Base Instalada ───────────────────────────────────────────
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [sparePartsLoading, setSparePartsLoading] = useState(true);
  // ─── Egreso Digital (Repuestos & Bodega) ──────────────────────────────────
  const [digitalEgressModalOpen, setDigitalEgressModalOpen] = useState(false);
  const [digitalEgressItems, setDigitalEgressItems] = useState<DigitalEgressItem[]>([]);
  const [digitalEgressInitialClient, setDigitalEgressInitialClient] = useState('');
  const [digitalEgressOrigin, setDigitalEgressOrigin] = useState<'REPUESTOS' | 'BODEGA'>('REPUESTOS');
  const [digitalEgresses, setDigitalEgresses] = useState<DigitalEgressRecord[]>([]);
  const [selectedSparePartIds, setSelectedSparePartIds] = useState<Set<string>>(new Set());
  const [logoError, setLogoError] = useState(false);

// (State modularizado en módulos independientes)


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
  const canCloseImport = currentUser?.role === 'IMPORTER' || currentUser?.role === 'ADMIN';
  const canExportExcel = currentUser?.role === 'IMPORTER' || currentUser?.role === 'ADMIN';

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
          setWarehouseSearchQuery(asset.metadata.pn);
          setActiveTab('WAREHOUSE');
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
    const unsubEgress = onSnapshot(
      collection(db, 'egresos_digitales'),
      (snapshot) => {
        const records: DigitalEgressRecord[] = [];
        snapshot.forEach(d => {
          records.push({ id: d.id, ...d.data() } as DigitalEgressRecord);
        });
        records.sort((a, b) => (b.numero || 0) - (a.numero || 0));
        setDigitalEgresses(records);
      },
      (err) => console.warn('Error al cargar egresos digitales:', err)
    );
    return () => { unsubSpareParts(); unsubEgress(); };
  }, [currentUser]);

  // Numeración correlativa automática para Egreso Digital que inicia en 1
  const nextEgressNumber = useMemo(() => {
    if (digitalEgresses.length === 0) return 1;
    const maxNum = Math.max(...digitalEgresses.map(e => Number(e.numero) || 0));
    return maxNum >= 1 ? maxNum + 1 : 1;
  }, [digitalEgresses]);

  // ─── Confirmar y Guardar Egreso Digital ──────────────────────────────────
  const handleConfirmDigitalEgress = async (egress: DigitalEgressRecord) => {
    if (!currentUser) return;
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const fechaEgresoStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

      // 1. Guardar documento en Firestore
      await setDoc(doc(db, 'egresos_digitales', egress.id), egress);

      // 2. Si proviene de REPUESTOS, actualizar fecha_egreso en spare_parts
      if (egress.origen === 'REPUESTOS') {
        const batch = writeBatch(db);
        let count = 0;
        egress.items.forEach(it => {
          if (it.spare_part_id) {
            batch.update(doc(db, 'spare_parts', it.spare_part_id), {
              fecha_egreso: fechaEgresoStr
            });
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
        }
        setSelectedSparePartIds(new Set());
      }

      // 3. Si proviene de BODEGA, actualizar custodio/despacho en los activos
      if (egress.origen === 'BODEGA') {
        for (const it of egress.items) {
          const matchingAssets = assets.filter(
            a => a.metadata.pn === it.codigo && a.current_status === AssetStatus.RECEIVED_WH
          );
          let remaining = it.cantidad;
          for (const a of matchingAssets) {
            if (remaining <= 0) break;
            const inStock = a.metadata.cantidad || 1;
            const updated = AssetLifecycleService.updateField(
              a,
              'warehouse',
              { 
                responsable_egreso: egress.responsable, 
                destino_final: egress.cliente, 
                motivo_salida: `Egreso Digital #${egress.numero}` 
              },
              currentUser
            ).updatedAsset;

            await updateDoc(doc(db, 'assets', a.id), {
              current_status: AssetStatus.DISPATCHED,
              warehouse: updated.warehouse
            });
            remaining -= inStock;
          }
        }
      }

      // 4. Auditoría
      try {
        await addDoc(collection(db, 'audit_log'), {
          asset_id: `EGRESO_${egress.numero}`,
          actor_id: currentUser.name || currentUser.id || 'ADMIN',
          action: 'DIGITAL_EGRESS',
          prev_value: null,
          new_value: {
            numero: egress.numero,
            cliente: egress.cliente,
            responsable: egress.responsable,
            total_items: egress.items.length,
            origen: egress.origen
          },
          timestamp: new Date().toISOString()
        });
      } catch (auditErr) {
        console.warn('Error en auditoría de egreso:', auditErr);
      }

      showToast(`✅ ${egress.titulo} registrado con éxito.`, 'success', 5000);
    } catch (err: any) {
      showError(`Error al registrar egreso digital: ${err.message}`);
      throw err;
    }
  };


// (Cálculo y exportación modularizados en LogisticsModule)

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
        // Modales de bodega, docs y logística se gestionan dentro de cada módulo
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Nota: los comentarios por orden se gestionan internamente en LogisticsModule
  // (su propio listener de 'order_comments'); ya no hay estado espejo aquí.

  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageSpareParts = isAdmin || Boolean(currentUser?.name && currentUser.name.toLowerCase().includes('alexis'));

  // (Auto-guardado modularizado en LogisticsModule)

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

  // (Handlers de solicitudes, logística, retornos, documentos y escáner modularizados)

  // Handlers estables (useCallback) para los módulos memo(): una función nueva
  // en cada render de App forzaría su re-render aunque sus props reales no cambien.
  const handleRequestSuccessNavigate = useCallback(() => setActiveTab('LOGISTICS'), []);

  const handleNavigateToWarehouse = useCallback(() => {
    setActiveTab('WAREHOUSE');
    setWarehouseSubTab('ENTRY');
  }, []);

  const handleOpenDigitalEgress = useCallback((origin: 'REPUESTOS' | 'BODEGA', client: string, items: DigitalEgressItem[]) => {
    setDigitalEgressOrigin(origin);
    setDigitalEgressInitialClient(client);
    setDigitalEgressItems(items);
    setDigitalEgressModalOpen(true);
  }, []);

  if (loadingAuth) return <div className="p-10 text-slate-500 font-medium">Cargando OmniTrace...</div>;
  if (!currentUser) return <AppErrorBoundary><LoginScreen /></AppErrorBoundary>;

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
              <DashboardModule
                assets={assets}
                logs={logs}
                dataLoading={dataLoading}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'REQUEST' && (
                <RequestsModule
                  assets={assets}
                  currentUser={currentUser}
                  canCreateRequest={canCreateRequest}
                  onSuccessNavigate={handleRequestSuccessNavigate}
                  showToast={showToast}
                />
            )}
            {activeTab === 'LOGISTICS' && (
                <LogisticsModule
                  assets={assets}
                  assetsByOrder={assetsByOrder}
                  currentUser={currentUser}
                  canEditLogistics={canEditLogistics}
                  canCloseImport={canCloseImport}
                  canExportExcel={canExportExcel}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={setSelectedAssetId}
                  logs={logs}
                  onNavigateToWarehouse={handleNavigateToWarehouse}
                  onOpenDigitalEgress={handleOpenDigitalEgress}
                  showToast={showToast}
                  showError={showError}
                  showConfirm={showConfirm}
                />
            )}

            {activeTab === 'DOCS' && (
                <DocsModule
                  assets={assets}
                  assetsByOrder={assetsByOrder}
                  currentUser={currentUser}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={setSelectedAssetId}
                  showToast={showToast}
                  showError={showError}
                />
            )}

            {activeTab === 'RETURNS' && (
                <ReturnsModule
                  assets={assets}
                  currentUser={currentUser}
                  showToast={showToast}
                  showError={showError}
                />
            )}

            {activeTab === 'WAREHOUSE' && (
              <WarehouseModule
                assets={assets}
                initialInventorySearch={warehouseSearchQuery}
                initialSubTab={warehouseSubTab}
                logs={logs}
                currentUser={currentUser}
                canEditWarehouse={canEditWarehouse}
                showToast={showToast}
                showError={showError}
                showConfirm={showConfirm}
                onOpenDigitalEgress={handleOpenDigitalEgress}
              />
            )}

            {activeTab === 'SCANNER' && (
                <ScannerModule assets={assets} />
            )}
                    {/* ── MÓDULO REPUESTOS ── */}
            {activeTab === 'SPAREPARTS' && (
              <SparePartsModule
                spareParts={spareParts}
                sparePartsLoading={sparePartsLoading}
                assets={assets}
                currentUser={currentUser}
                canManageSpareParts={canManageSpareParts}
                showToast={showToast}
                showError={showError}
                showConfirm={showConfirm}
                setSelectedAssetId={setSelectedAssetId}
                setActiveTab={setActiveTab}
                selectedSparePartIds={selectedSparePartIds}
                setSelectedSparePartIds={setSelectedSparePartIds}
                onOpenDigitalEgress={handleOpenDigitalEgress}
              />
            )}

                    {/* ── PANEL DE ADMINISTRACIÓN ── */}
            {activeTab === 'ADMIN' && isAdmin && (
              <AdminModule
                currentUser={currentUser}
                logs={logs}
                showToast={showToast}
                showError={showError}
                showConfirm={showConfirm}
              />
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

      {/* Vista previa gestionada dentro de DocsModule */}

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

      {/* Modal de Egreso Digital (Repuestos & Bodega) */}
      <DigitalEgressModal
        isOpen={digitalEgressModalOpen}
        onClose={() => setDigitalEgressModalOpen(false)}
        initialItems={digitalEgressItems}
        initialClient={digitalEgressInitialClient}
        initialOrigin={digitalEgressOrigin}
        currentUserName={currentUser?.name || currentUser?.id || 'Francisco Sotomayor'}
        nextEgressNumber={nextEgressNumber}
        onConfirmEgress={handleConfirmDigitalEgress}
        availableSpareParts={spareParts}
        availableInventory={availableInventoryList}
      />

    </div>
    </AppErrorBoundary>
  );
}