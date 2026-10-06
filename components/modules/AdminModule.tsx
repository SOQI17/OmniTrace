import React, { useState, useEffect, useMemo, memo } from 'react';
import { 
  User, 
  UserRole, 
  AuditLogEntry 
} from '../../types';
import { auth, db } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  collection, doc, onSnapshot, writeBatch, updateDoc, setDoc 
} from 'firebase/firestore';
import { 
  Shield, 
  Plus, 
  AlertTriangle, 
  Users, 
  Loader2, 
  ToggleRight, 
  ToggleLeft, 
  Edit3, 
  RotateCcw, 
  CheckCircle, 
  X,
  Search,
  Check,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  KeyRound,
  LayoutDashboard,
  FileText,
  Truck,
  FileCheck,
  Warehouse,
  QrCode,
  Package,
  Layers,
  Sparkles,
  UserCheck,
  UserX,
  Mail,
  UserPlus
} from 'lucide-react';
import { generateUUID } from '../../utils/helpers';

// Definición exhaustiva de módulos de la plataforma OmniTrace
export interface ModuleAccessDef {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: any;
  color: string;
  badgeBg: string;
  category: 'Operaciones' | 'Inventario y Almacén' | 'Documentación' | 'Sistema';
}

export const SYSTEM_MODULES: ModuleAccessDef[] = [
  {
    key: 'modulo_dashboard',
    label: 'Dashboard General',
    shortLabel: 'Dashboard',
    description: 'Métricas, KPIs ejecutivos, gráficos de importaciones y estado global.',
    icon: LayoutDashboard,
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
    category: 'Sistema'
  },
  {
    key: 'modulo_solicitudes',
    label: '1. Solicitud',
    shortLabel: 'Solicitudes',
    description: 'Creación de órdenes de repuestos, equipos médicos y préstamos.',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    category: 'Operaciones'
  },
  {
    key: 'modulo_logistica',
    label: '2. Logística e Importación',
    shortLabel: 'Logística',
    description: 'Tracking aduanero, costos, fletes, liquidaciones en Excel y reportar a bodega.',
    icon: Truck,
    color: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300',
    category: 'Operaciones'
  },
  {
    key: 'modulo_documentos',
    label: 'Documentos',
    shortLabel: 'Documentos',
    description: 'Expediente documental digital, órdenes de compra y facturas adjuntas.',
    icon: FileCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    category: 'Documentación'
  },
  {
    key: 'modulo_bodega',
    label: '3. Bodega e Inventario',
    shortLabel: 'Bodega',
    description: 'Recepción de activos, control de stock, movimientos e inventario físico.',
    icon: Warehouse,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    category: 'Inventario y Almacén'
  },
  {
    key: 'modulo_egreso_qr',
    label: '4. Egreso QR',
    shortLabel: 'Egreso QR',
    description: 'Escáner QR, lista de egresos digitales y reportes en PDF.',
    icon: QrCode,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    category: 'Inventario y Almacén'
  },
  {
    key: 'modulo_retornos',
    label: '5. Retornos y Garantías',
    shortLabel: 'Retornos',
    description: 'Gestión de retornos a fábrica, garantías activas y control de préstamos.',
    icon: RotateCcw,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    category: 'Operaciones'
  },
  {
    key: 'modulo_repuestos',
    label: '6. Repuestos (Base Instalada)',
    shortLabel: 'Repuestos',
    description: 'Catálogo de repuestos, vinculación por equipo y generación de egresos.',
    icon: Package,
    color: 'text-teal-600 dark:text-teal-400',
    badgeBg: 'bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 text-teal-700 dark:text-teal-300',
    category: 'Inventario y Almacén'
  },
  {
    key: 'modulo_admin',
    label: 'Usuarios y Accesos (Admin)',
    shortLabel: 'Usuarios / Admin',
    description: 'Administración de usuarios, roles del sistema y permisos de módulos.',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800 text-red-700 dark:text-red-300',
    category: 'Sistema'
  }
];

// Permisos funcionales adicionales granulares
export const ALL_PERMISSIONS = [
  // Módulos generales
  { key: 'modulo_dashboard',     label: 'Módulo: Dashboard',        description: 'Acceso a métricas y KPIs',                  group: 'Módulos' },
  { key: 'modulo_solicitudes',   label: 'Módulo: 1. Solicitud',     description: 'Acceso a crear solicitudes',                group: 'Módulos' },
  { key: 'modulo_logistica',     label: 'Módulo: 2. Logística',     description: 'Acceso a gestión logística',                group: 'Módulos' },
  { key: 'modulo_documentos',    label: 'Módulo: Documentos',       description: 'Acceso a expediente documental',            group: 'Módulos' },
  { key: 'modulo_bodega',        label: 'Módulo: 3. Bodega',        description: 'Acceso a almacén e inventario',             group: 'Módulos' },
  { key: 'modulo_egreso_qr',     label: 'Módulo: 4. Egreso QR',     description: 'Acceso al escáner y egresos QR',            group: 'Módulos' },
  { key: 'modulo_retornos',      label: 'Módulo: 5. Retornos',      description: 'Acceso a retornos y garantías',             group: 'Módulos' },
  { key: 'modulo_repuestos',     label: 'Módulo: 6. Repuestos',     description: 'Acceso a catálogo de repuestos',            group: 'Módulos' },
  { key: 'modulo_admin',         label: 'Módulo: Usuarios & Admin', description: 'Acceso a administración de accesos',        group: 'Módulos' },
  
  // Operaciones Granulares Solicitud
  { key: 'crear_solicitudes',    label: 'Crear Solicitudes',        description: 'Crear órdenes de repuestos y equipos',      group: 'Solicitud' },
  { key: 'prestamo_herramientas',label: 'Préstamo Herramientas',    description: 'Crear solicitudes de préstamo',             group: 'Solicitud' },
  
  // Operaciones Granulares Logística
  { key: 'editar_logistica',     label: 'Editar Logística',         description: 'Modificar tracking, costos y liquidación',  group: 'Logística' },
  { key: 'cerrar_importacion',   label: 'Cerrar Importación',       description: 'Marcar importaciones como cerradas',        group: 'Logística' },
  { key: 'exportar_excel',       label: 'Exportar Excel',          description: 'Descargar liquidaciones en Excel',          group: 'Logística' },
  
  // Operaciones Granulares Bodega
  { key: 'recibir_bodega',       label: 'Recibir en Bodega',        description: 'Ingresar activos a bodega',                 group: 'Bodega' },
  { key: 'despachar',            label: 'Despachar',                description: 'Realizar despachos de inventario',          group: 'Bodega' },
  { key: 'ajustar_inventario',   label: 'Ajustar Inventario',       description: 'Modificar stock e información',             group: 'Bodega' },
  
  // Operaciones Granulares Documentos
  { key: 'subir_documentos',     label: 'Subir Documentos',         description: 'Adjuntar archivos a las órdenes',           group: 'Documentos' },
  { key: 'eliminar_documentos',  label: 'Eliminar Documentos',      description: 'Borrar documentos adjuntos',                group: 'Documentos' },
  
  // Operaciones Granulares Retornos
  { key: 'gestionar_retornos',   label: 'Gestionar Retornos',       description: 'Procesar devoluciones y retornos',          group: 'Retornos' },
];

export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  REQUESTER: { 
    modulo_dashboard: true, modulo_solicitudes: true, modulo_logistica: false, modulo_documentos: false, modulo_bodega: false, modulo_egreso_qr: false, modulo_retornos: false, modulo_repuestos: false, modulo_admin: false,
    crear_solicitudes: true, prestamo_herramientas: true, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, recibir_bodega: false, despachar: false, ajustar_inventario: false, subir_documentos: false, eliminar_documentos: false, gestionar_retornos: false 
  },
  IMPORTER: { 
    modulo_dashboard: true, modulo_solicitudes: true, modulo_logistica: true, modulo_documentos: true, modulo_bodega: false, modulo_egreso_qr: false, modulo_retornos: true, modulo_repuestos: false, modulo_admin: false,
    crear_solicitudes: true, prestamo_herramientas: true, editar_logistica: true, cerrar_importacion: true, exportar_excel: true, recibir_bodega: false, despachar: false, ajustar_inventario: false, subir_documentos: true, eliminar_documentos: true, gestionar_retornos: false 
  },
  WAREHOUSE: { 
    modulo_dashboard: true, modulo_solicitudes: false, modulo_logistica: false, modulo_documentos: true, modulo_bodega: true, modulo_egreso_qr: true, modulo_retornos: true, modulo_repuestos: true, modulo_admin: false,
    crear_solicitudes: false, prestamo_herramientas: false, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, recibir_bodega: true, despachar: true, ajustar_inventario: true, subir_documentos: true, eliminar_documentos: false, gestionar_retornos: true 
  },
  ADMIN: { 
    modulo_dashboard: true, modulo_solicitudes: true, modulo_logistica: true, modulo_documentos: true, modulo_bodega: true, modulo_egreso_qr: true, modulo_retornos: true, modulo_repuestos: true, modulo_admin: true,
    crear_solicitudes: true, prestamo_herramientas: true, editar_logistica: true, cerrar_importacion: true, exportar_excel: true, recibir_bodega: true, despachar: true, ajustar_inventario: true, subir_documentos: true, eliminar_documentos: true, gestionar_retornos: true 
  },
};

export interface AdminModuleProps {
  currentUser: User | null;
  logs: AuditLogEntry[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  showError: (titleOrMsg: string, msg?: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;
}

export const AdminModule: React.FC<AdminModuleProps> = memo(({
  currentUser,
  logs,
  showToast,
  showError,
  showConfirm
}) => {
  const [firestoreUsers, setFirestoreUsers] = useState<{
    uid: string; email: string; displayName: string;
    role: UserRole; active: boolean; lastLogin?: string; createdAt?: string;
    permissions?: Record<string, boolean>;
    pending?: boolean;
  }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | UserRole>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  
  // Modales y Edición
  const [editingUserPerms, setEditingUserPerms] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // Formulario nuevo usuario
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('REQUESTER');
  const [newUserName, setNewUserName] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Carga de usuarios en tiempo real desde Firestore
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    setUsersLoading(true);
    const unsub = onSnapshot(collection(db, 'users'),
      async (snap) => {
        const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
        setFirestoreUsers(users);
        setUsersLoading(false);

        // Pre-carga de usuarios fundadores si la colección está vacía
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
              permissions: DEFAULT_PERMISSIONS[u.role] || {}
            });
          });
          await batch.commit().catch(() => {});
        }
      },
      (err) => {
        console.error('Error cargando usuarios:', err);
        setUsersLoading(false);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Modificar rol de usuario
  const handleUpdateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 
        role: newRole 
      });
      showToast(`Rol actualizado a ${newRole} con éxito.`, 'success');
      setEditingUserRole(null);
    } catch (e: any) { 
      showError(`Error al actualizar rol: ${e.message}`); 
    }
  };

  // Modificar permiso individual o acceso a módulo
  const handleUpdateUserPermission = async (uid: string, permKey: string, newValue: boolean) => {
    try {
      const user = firestoreUsers.find(u => u.uid === uid);
      const defaults = DEFAULT_PERMISSIONS[user?.role || 'REQUESTER'] || {};
      const currentPerms = user?.permissions || { ...defaults };
      
      const updatedPerms = { ...currentPerms, [permKey]: newValue };

      await updateDoc(doc(db, 'users', uid), {
        permissions: updatedPerms
      });
      showToast(`Permiso "${permKey}" actualizado.`, 'success', 2000);
    } catch (e: any) { 
      showError(`Error al actualizar permiso: ${e.message}`); 
    }
  };

  // Conceder / Denegar todos los módulos a un usuario
  const handleBatchToggleModules = async (uid: string, enableAll: boolean) => {
    try {
      const user = firestoreUsers.find(u => u.uid === uid);
      const defaults = DEFAULT_PERMISSIONS[user?.role || 'REQUESTER'] || {};
      const currentPerms = { ...(user?.permissions || defaults) };
      
      SYSTEM_MODULES.forEach(mod => {
        // No auto-asignar admin si se activan todos a menos que sea explícito
        if (mod.key === 'modulo_admin' && enableAll && user?.role !== 'ADMIN') return;
        currentPerms[mod.key] = enableAll;
      });

      await updateDoc(doc(db, 'users', uid), { permissions: currentPerms });
      showToast(enableAll ? 'Todos los módulos habilitados.' : 'Todos los módulos deshabilitados.', 'info');
    } catch (e: any) {
      showError(`Error: ${e.message}`);
    }
  };

  // Resetear permisos a los predeterminados del rol
  const handleResetToRoleDefaults = async (uid: string, role: UserRole) => {
    const confirmed = await showConfirm(`¿Resetear todos los accesos de este usuario a los valores predeterminados del rol ${role}?`);
    if (!confirmed) return;
    try {
      const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.REQUESTER;
      await updateDoc(doc(db, 'users', uid), { permissions: defaults });
      showToast(`Permisos restablecidos al rol ${role}.`, 'success');
    } catch (e: any) {
      showError(`Error al resetear: ${e.message}`);
    }
  };

  // Activar o desactivar cuenta de usuario
  const handleToggleUserActive = async (uid: string, currentActive: boolean, userName: string) => {
    if (uid === currentUser?.id) {
      showToast('Por seguridad, no puedes desactivar tu propia cuenta activa.', 'error');
      return;
    }
    const confirmed = await showConfirm(`¿Estás seguro de que deseas ${currentActive ? 'DESACTIVAR' : 'ACTIVAR'} el acceso de "${userName}"?`);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'users', uid), { active: !currentActive });
      showToast(`Usuario ${currentActive ? 'desactivado' : 'activado'} correctamente.`, 'success');
    } catch (e: any) { 
      showError(`Error al cambiar estado: ${e.message}`); 
    }
  };

  // Registro de nuevo usuario
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) {
      showToast('Por favor completa el nombre y el correo electrónico.', 'error');
      return;
    }
    setSubmittingUser(true);
    try {
      const tempId = `user_${Date.now()}_${generateUUID().slice(0, 6)}`;
      const roleDefaults = DEFAULT_PERMISSIONS[newUserRole] || DEFAULT_PERMISSIONS.REQUESTER;
      
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        email: newUserEmail.trim().toLowerCase(),
        displayName: newUserName.trim(),
        role: newUserRole,
        active: true,
        createdAt: new Date().toISOString(),
        pending: true,
        permissions: roleDefaults
      });
      
      showToast(`Usuario ${newUserName} registrado con rol ${newUserRole}. Recuerda invitarlo o agregarlo en Firebase Authentication.`, 'success', 7000);
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUserModal(false);
    } catch (e: any) { 
      showError(`Error al registrar usuario: ${e.message}`); 
    } finally {
      setSubmittingUser(false);
    }
  };

  // Enviar correo de restablecimiento de contraseña
  const handleResetPasswordForUser = async (email: string) => {
    if (!email || email.includes('pending')) {
      showToast('Correo no válido para restablecimiento.', 'error');
      return;
    }
    const confirmed = await showConfirm(`¿Enviar correo de restablecimiento de contraseña a "${email}"?`);
    if (!confirmed) return;
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Correo de restablecimiento enviado a ${email}.`, 'success');
    } catch (e: any) {
      showError(`Error al enviar correo de reset: ${e.message}`);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return firestoreUsers.filter(u => {
      const matchesSearch = 
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'ALL' || u.role === filterRole;
      const matchesStatus = 
        filterStatus === 'ALL' || 
        (filterStatus === 'ACTIVE' && u.active) || 
        (filterStatus === 'INACTIVE' && !u.active);

      return matchesSearch && matchesRole && matchesStatus;
    }).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  }, [firestoreUsers, searchQuery, filterRole, filterStatus]);

  // Métricas del equipo
  const stats = useMemo(() => {
    const total = firestoreUsers.length;
    const active = firestoreUsers.filter(u => u.active).length;
    const admins = firestoreUsers.filter(u => u.role === 'ADMIN').length;
    const customized = firestoreUsers.filter(u => {
      if (!u.permissions) return false;
      const defaults = DEFAULT_PERMISSIONS[u.role] || {};
      return Object.keys(u.permissions).some(k => u.permissions![k] !== defaults[k]);
    }).length;
    return { total, active, admins, customized };
  }, [firestoreUsers]);

  // Color de badge de rol
  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
      case 'IMPORTER':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'WAREHOUSE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'REQUESTER':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full max-w-7xl mx-auto pb-12">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
              <Users size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Control de Usuarios y Accesos
                </h1>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                  Panel Administrativo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Gestiona roles, accesos modulares granulares (Dashboard, Solicitudes, Logística, Bodega, QR, Repuestos) y credenciales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-600/20 shrink-0"
            >
              <UserPlus size={16} /> Agregar Usuario
            </button>
          </div>
        </div>

        {/* ── TARJETAS DE MÉTRICAS RÁPIDAS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Usuarios</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
            <span className="text-[10px] text-slate-500">Cuentas registradas</span>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Usuarios Activos</span>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.active}</div>
            <span className="text-[10px] text-emerald-600/80">Con acceso permitido</span>
          </div>

          <div className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-4 border border-red-100 dark:border-red-900/30">
            <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest block mb-1">Administradores</span>
            <div className="text-2xl font-black text-red-700 dark:text-red-300">{stats.admins}</div>
            <span className="text-[10px] text-red-600/80">Acceso irrestricto</span>
          </div>

          <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-1">Accesos Custom</span>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">{stats.customized}</div>
            <span className="text-[10px] text-purple-600/80">Con módulos personalizados</span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o rol..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-bold outline-none cursor-pointer"
          >
            <option value="ALL">Todos los Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="IMPORTER">IMPORTER</option>
            <option value="WAREHOUSE">WAREHOUSE</option>
            <option value="REQUESTER">REQUESTER</option>
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-bold outline-none cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Solo Activos</option>
            <option value="INACTIVE">Solo Inactivos</option>
          </select>

          <button
            onClick={() => { setSearchQuery(''); setFilterRole('ALL'); setFilterStatus('ALL'); }}
            className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Limpiar filtros"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* ── TABLA PRINCIPAL DE USUARIOS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Listado de Usuarios ({filteredUsers.length})
            </span>
          </div>
          {usersLoading && (
            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold">
              <Loader2 size={14} className="animate-spin" /> Sincronizando...
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol en Sistema</th>
                <th className="px-6 py-4">Accesos a Módulos</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4">Último Acceso</th>
                <th className="px-6 py-4 text-center">Gestión & Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredUsers.length === 0 && !usersLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Users size={36} className="mx-auto mb-2 opacity-30" />
                    No se encontraron usuarios coincidentes con la búsqueda.
                  </td>
                </tr>
              )}

              {filteredUsers.map(u => {
                const isSelf = u.uid === currentUser?.id;
                const defaults = DEFAULT_PERMISSIONS[u.role] || DEFAULT_PERMISSIONS.REQUESTER;
                const userPerms = u.permissions || defaults;
                
                // Conteo de módulos accesibles
                const accessibleModulesCount = SYSTEM_MODULES.filter(m => {
                  if (u.role === 'ADMIN') return true;
                  return userPerms[m.key] ?? defaults[m.key] ?? false;
                }).length;

                return (
                  <React.Fragment key={u.uid}>
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Avatar e Identificación */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs uppercase shadow-sm ${
                            u.active 
                              ? 'bg-gradient-to-tr from-slate-800 to-slate-700 text-white dark:from-slate-700 dark:to-slate-600' 
                              : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                          }`}>
                            {(u.displayName || u.email || 'U').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {u.displayName || 'Sin nombre'}
                              {isSelf && (
                                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                                  Tú
                                </span>
                              )}
                              {u.pending && (
                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                                  Pendiente Auth
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        {editingUserRole === u.uid ? (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue={u.role}
                              onChange={e => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                              className="text-xs font-black uppercase border border-blue-400 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 dark:text-white outline-none shadow-sm"
                              autoFocus
                            >
                              <option value="REQUESTER">REQUESTER</option>
                              <option value="IMPORTER">IMPORTER</option>
                              <option value="WAREHOUSE">WAREHOUSE</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                            <button
                              onClick={() => setEditingUserRole(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${getRoleBadgeClass(u.role)}`}>
                              {u.role}
                            </span>
                            <button
                              onClick={() => setEditingUserRole(u.uid)}
                              disabled={isSelf && u.role === 'ADMIN'}
                              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-20"
                              title="Cambiar rol base"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Resumen de Módulos */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingUserPerms(editingUserPerms === u.uid ? null : u.uid)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all ${
                              editingUserPerms === u.uid
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                            }`}
                          >
                            <Shield size={14} className={editingUserPerms === u.uid ? 'text-white' : 'text-blue-600 dark:text-blue-400'} />
                            <span>{accessibleModulesCount} / {SYSTEM_MODULES.length} Módulos</span>
                          </button>
                        </div>
                      </td>

                      {/* Estado Activo / Inactivo */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleUserActive(u.uid, u.active, u.displayName)}
                          disabled={isSelf}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                          }`}
                          title={isSelf ? 'No puedes desactivarte a ti mismo' : u.active ? 'Clic para desactivar' : 'Clic para activar'}
                        >
                          {u.active ? (
                            <>
                              <ToggleRight size={15} className="text-emerald-600 dark:text-emerald-400" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={15} className="text-slate-400" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Último Login */}
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                        {u.lastLogin ? (
                          new Date(u.lastLogin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        ) : (
                          <span className="italic text-slate-300 dark:text-slate-600">Nunca</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingUserPerms(editingUserPerms === u.uid ? null : u.uid)}
                            className={`p-2 rounded-xl transition-all ${
                              editingUserPerms === u.uid
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                            }`}
                            title="Configurar accesos a módulos"
                          >
                            <Shield size={16} />
                          </button>

                          {!u.email.includes('pending') && (
                            <button
                              onClick={() => handleResetPasswordForUser(u.email)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all"
                              title="Enviar correo de restablecimiento de contraseña"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── PANEL DESPLEGABLE: MATRIZ DE ACCESOS Y MÓDULOS ── */}
                    {editingUserPerms === u.uid && (
                      <tr>
                        <td colSpan={6} className="px-6 py-0 bg-slate-50/70 dark:bg-slate-900/60 border-y border-blue-200 dark:border-blue-900/50">
                          <div className="py-6 px-4 sm:px-6 space-y-6">
                            {/* Cabecera del Panel */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                              <div>
                                <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                                  <Shield size={18} className="text-blue-600" />
                                  Matriz de Accesos a Módulos: {u.displayName}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Define exactamente a qué pantallas y herramientas tiene acceso este usuario en OmniTrace.
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleBatchToggleModules(u.uid, true)}
                                  className="px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                  Activar Todos
                                </button>
                                <button
                                  onClick={() => handleBatchToggleModules(u.uid, false)}
                                  className="px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                  Desactivar Todos
                                </button>
                                <button
                                  onClick={() => handleResetToRoleDefaults(u.uid, u.role)}
                                  className="px-3 py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                >
                                  <RotateCcw size={12} /> Resetear a Rol ({u.role})
                                </button>
                                <button
                                  onClick={() => setEditingUserPerms(null)}
                                  className="px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm"
                                >
                                  Listo
                                </button>
                              </div>
                            </div>

                            {/* 1. MÓDULOS DE NAVEGACIÓN PRINCIPAL */}
                            <div>
                              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <Layers size={14} className="text-blue-600" />
                                Módulos Principales de la Barra de Navegación
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {SYSTEM_MODULES.map(module => {
                                  const IconComponent = module.icon;
                                  const isEnabled = u.role === 'ADMIN' ? true : (userPerms[module.key] ?? defaults[module.key] ?? false);
                                  const isDefault = defaults[module.key] ?? false;
                                  const isCustomized = u.role !== 'ADMIN' && u.permissions && module.key in u.permissions && u.permissions[module.key] !== isDefault;

                                  return (
                                    <div
                                      key={module.key}
                                      onClick={() => {
                                        if (u.role === 'ADMIN') {
                                          showToast('Los usuarios con rol ADMIN poseen acceso total a todos los módulos.', 'info');
                                          return;
                                        }
                                        handleUpdateUserPermission(u.uid, module.key, !isEnabled);
                                      }}
                                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                                        isEnabled
                                          ? 'bg-white dark:bg-slate-800 border-blue-500/40 shadow-sm'
                                          : 'bg-slate-100/60 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isEnabled ? module.badgeBg : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                                              <IconComponent size={16} />
                                            </div>
                                            <span className="font-black text-xs text-slate-800 dark:text-white">
                                              {module.label}
                                            </span>
                                          </div>

                                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                                            isEnabled ? 'bg-blue-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'
                                          }`}>
                                            <Check size={12} strokeWidth={3} />
                                          </div>
                                        </div>

                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                          {module.description}
                                        </p>
                                      </div>

                                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400 font-medium">
                                          Categoría: {module.category}
                                        </span>
                                        {isCustomized && (
                                          <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold uppercase text-[9px]">
                                            Personalizado
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. PERMISOS DE ACCIONES GRANULARES */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <KeyRound size={14} className="text-indigo-600" />
                                Permisos Granulares de Operación
                              </h4>

                              {['Solicitud', 'Logística', 'Bodega', 'Documentos', 'Retornos'].map(group => {
                                const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                                return (
                                  <div key={group} className="mb-4 last:mb-0">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                      <span className="w-2.5 h-px bg-slate-300 dark:bg-slate-700 inline-block" />
                                      {group}
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {groupPerms.map(perm => {
                                        const isEnabled = u.role === 'ADMIN' ? true : (userPerms[perm.key] ?? defaults[perm.key] ?? false);
                                        const isDefault = defaults[perm.key] ?? false;
                                        const isCustomized = u.role !== 'ADMIN' && u.permissions && perm.key in u.permissions && u.permissions[perm.key] !== isDefault;

                                        return (
                                          <button
                                            key={perm.key}
                                            type="button"
                                            disabled={u.role === 'ADMIN'}
                                            onClick={() => handleUpdateUserPermission(u.uid, perm.key, !isEnabled)}
                                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                              isEnabled
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 text-slate-500'
                                            }`}
                                          >
                                            <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 ${
                                              isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700'
                                            }`}>
                                              {isEnabled && <Check size={10} strokeWidth={3} />}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-[11px]">{perm.label}</span>
                                                {isCustomized && (
                                                  <span className="text-[8px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded font-black uppercase">
                                                    Custom
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                                                {perm.description}
                                              </p>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
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

      {/* ── GUÍA DE ROLES PREDETERMINADOS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Shield size={18} className="text-blue-600" />
          Guía de Roles y Plantillas Predeterminadas
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Cada rol asigna accesos por omisión, los cuales puedes afinar de forma individual en cualquier momento desde la columna de acciones.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              role: 'REQUESTER',
              title: 'Solicitante Técnico',
              description: 'Enfocado en apertura de requerimientos técnicos y solicitud de partes.',
              icon: FileText,
              badgeColor: 'border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
              modules: ['Dashboard', '1. Solicitud']
            },
            {
              role: 'IMPORTER',
              title: 'Gestión Logística & Compras',
              description: 'Seguimiento de compras internacionales, aduanas, fletes y liquidación.',
              icon: Truck,
              badgeColor: 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
              modules: ['Dashboard', '1. Solicitud', '2. Logística', 'Documentos', 'Retornos']
            },
            {
              role: 'WAREHOUSE',
              title: 'Operador de Bodega',
              description: 'Recepción física, control de existencias, egresos QR y repuestos.',
              icon: Warehouse,
              badgeColor: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
              modules: ['Dashboard', '3. Bodega', '4. Egreso QR', 'Documentos', 'Retornos', '6. Repuestos']
            },
            {
              role: 'ADMIN',
              title: 'Super Administrador',
              description: 'Control global, configuración de usuarios, auditoría y todos los módulos.',
              icon: Shield,
              badgeColor: 'border-red-200 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
              modules: ['Todos los 9 módulos habilitados sin restricción']
            }
          ].map(card => {
            const IconC = card.icon;
            return (
              <div key={card.role} className={`rounded-2xl border p-5 flex flex-col justify-between ${card.badgeColor}`}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <IconC size={18} />
                    <span className="font-black text-xs uppercase tracking-widest">{card.role}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{card.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Módulos por defecto:</span>
                  <div className="flex flex-wrap gap-1">
                    {card.modules.map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700/70 border border-slate-200 dark:border-slate-600 text-[10px] font-bold">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL AGREGAR USUARIO ── */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">
                  Registrar Nuevo Usuario
                </h3>
                <p className="text-xs text-slate-500">
                  Agrega los datos para dar acceso a OmniTrace.
                </p>
              </div>
            </div>

            <form onSubmit={handleRegisterUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Carlos Pérez"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Correo Electrónico Corporativo
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@orimec.com.ec"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rol Inicial
                </label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="REQUESTER">REQUESTER — Solicitante Técnico</option>
                  <option value="IMPORTER">IMPORTER — Logística e Importaciones</option>
                  <option value="WAREHOUSE">WAREHOUSE — Bodega e Inventario</option>
                  <option value="ADMIN">ADMIN — Super Administrador</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  Una vez creado en este módulo, si el usuario no tiene contraseña en Firebase Auth, créale su acceso en <strong>Firebase Console → Authentication → Users</strong> o invítalo para que inicie sesión con este correo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingUser ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Registrar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

AdminModule.displayName = 'AdminModule';
