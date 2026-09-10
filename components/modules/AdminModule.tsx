import React, { useState, useEffect, memo } from 'react';
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
  X 
} from 'lucide-react';
import { generateUUID } from '../../utils/helpers';

export const ALL_PERMISSIONS: { key: string; label: string; description: string; group: string }[] = [
  { key: 'crear_solicitudes',    label: 'Crear Solicitudes',       description: 'Crear órdenes de repuestos y equipos',      group: 'Solicitud' },
  { key: 'prestamo_herramientas',label: 'Préstamo Herramientas',   description: 'Crear solicitudes de préstamo',              group: 'Solicitud' },
  { key: 'ver_logistica',        label: 'Ver Logística',           description: 'Acceder al módulo de logística',             group: 'Logística' },
  { key: 'editar_logistica',     label: 'Editar Logística',        description: 'Modificar tracking, costos y liquidación',   group: 'Logística' },
  { key: 'cerrar_importacion',   label: 'Cerrar Importación',      description: 'Marcar importaciones como cerradas',         group: 'Logística' },
  { key: 'exportar_excel',       label: 'Exportar Excel',          description: 'Descargar liquidaciones en Excel',           group: 'Logística' },
  { key: 'ver_bodega',           label: 'Ver Bodega',              description: 'Acceder al módulo de bodega',                group: 'Bodega' },
  { key: 'recibir_bodega',       label: 'Recibir en Bodega',       description: 'Ingresar activos a bodega',                  group: 'Bodega' },
  { key: 'despachar',            label: 'Despachar',               description: 'Realizar despachos de inventario',           group: 'Bodega' },
  { key: 'ajustar_inventario',   label: 'Ajustar Inventario',      description: 'Modificar stock e información de productos',  group: 'Bodega' },
  { key: 'ver_documentos',       label: 'Ver Documentos',          description: 'Acceder al expediente documental',           group: 'Documentos' },
  { key: 'subir_documentos',     label: 'Subir Documentos',        description: 'Adjuntar archivos a las órdenes',            group: 'Documentos' },
  { key: 'eliminar_documentos',  label: 'Eliminar Documentos',     description: 'Borrar documentos adjuntos',                 group: 'Documentos' },
  { key: 'ver_retornos',         label: 'Ver Retornos',            description: 'Ver garantías y préstamos activos',          group: 'Retornos' },
  { key: 'gestionar_retornos',   label: 'Gestionar Retornos',      description: 'Procesar devoluciones y retornos',           group: 'Retornos' },
];

export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  REQUESTER: { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: false, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, ver_bodega: false, recibir_bodega: false, despachar: false, ajustar_inventario: false, ver_documentos: false, subir_documentos: false, eliminar_documentos: false, ver_retornos: false, gestionar_retornos: false },
  IMPORTER:  { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: true,  editar_logistica: true,  cerrar_importacion: true,  exportar_excel: true,  ver_bodega: false, recibir_bodega: false, despachar: false, ajustar_inventario: false, ver_documentos: true,  subir_documentos: true,  eliminar_documentos: true,  ver_retornos: true,  gestionar_retornos: false },
  WAREHOUSE: { crear_solicitudes: false, prestamo_herramientas: false, ver_logistica: false, editar_logistica: false, cerrar_importacion: false, exportar_excel: false, ver_bodega: true,  recibir_bodega: true,  despachar: true,  ajustar_inventario: true,  ver_documentos: true,  subir_documentos: true,  eliminar_documentos: false, ver_retornos: true,  gestionar_retornos: true  },
  ADMIN:     { crear_solicitudes: true,  prestamo_herramientas: true,  ver_logistica: true,  editar_logistica: true,  cerrar_importacion: true,  exportar_excel: true,  ver_bodega: true,  recibir_bodega: true,  despachar: true,  ajustar_inventario: true,  ver_documentos: true,  subir_documentos: true,  eliminar_documentos: true,  ver_retornos: true,  gestionar_retornos: true  },
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
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      showToast(`Rol actualizado a ${role}.`, 'success');
      setEditingUserMgmt(null);
    } catch (e: any) { showError(e.message); }
  };

  const handleUpdateUserPermission = async (uid: string, perm: string, value: boolean) => {
    try {
      const user = firestoreUsers.find(u => u.uid === uid);
      const currentPerms = user?.permissions || {};
      await updateDoc(doc(db, 'users', uid), {
        permissions: { ...currentPerms, [perm]: value }
      });
    } catch (e: any) { showError(e.message); }
  };

  const handleToggleUserActive = async (uid: string, currentActive: boolean) => {
    if (uid === currentUser?.id) {
      showToast('No puedes desactivar tu propia cuenta.', 'error');
      return;
    }
    const confirmed = await showConfirm(`¿${currentActive ? 'Desactivar' : 'Activar'} este usuario?`);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'users', uid), { active: !currentActive });
      showToast(`Usuario ${currentActive ? 'desactivado' : 'activado'}.`, 'success');
    } catch (e: any) { showError(e.message); }
  };

  const handleRegisterUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim()) return;
    const confirmed = await showConfirm(`Registrar ${newUserEmail} con rol ${newUserRole}?\n\nEl usuario deberá iniciar sesión con este email en Firebase Authentication.`);
    if (!confirmed) return;
    try {
      const tempId = `pending_${generateUUID()}`;
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        email: newUserEmail.trim().toLowerCase(),
        displayName: newUserName.trim(),
        role: newUserRole,
        active: true,
        createdAt: new Date().toISOString(),
        pending: true,
      });
      showToast(`Usuario ${newUserName} registrado. Ahora crea su acceso en Firebase Auth.`, 'success', 6000);
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUser(false);
    } catch (e: any) { showError(e.message); }
  };

  const handleResetPasswordForUser = async (email: string) => {
    const confirmed = await showConfirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`);
    if (!confirmed) return;
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Correo enviado a ${email}.`, 'success');
    } catch (e: any) {
      showError(`Error al enviar reset: ${e.message}`);
    }
  };

  return (
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
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{u.displayName}</div>
                        {isSelf && <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-black uppercase">Tú</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">{u.email}</td>
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

                    {/* Panel de permisos granulares */}
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
  );
});
AdminModule.displayName = 'AdminModule';
