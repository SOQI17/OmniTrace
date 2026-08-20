import React from 'react';
import { LogOut, User } from 'lucide-react';
import { auth } from '../firebase';

export const Header = () => {
  const userEmail = auth.currentUser?.email || 'Usuario';

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <header className="bg-[#0f172a] text-white h-16 flex items-center justify-between px-6 border-b border-slate-800 shadow-lg">
      <div className="flex items-center gap-4">
        {/* LOGO CORREGIDO: Usamos inicio.png directamente */}
        <div className="flex items-center gap-2">
          <img 
            src="inicio.png" 
            alt="Logo" 
            className="h-9 w-auto object-contain"
            onError={(e) => {
              // Si falla la ruta directa, intentamos con la barra
              (e.target as HTMLImageElement).src = "/app.ico";
            }}
          />
          <span className="text-xl font-bold tracking-tight">
            OmniTrace <span className="text-blue-500 text-xs">ERP</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700">
          <User size={16} className="text-blue-400" />
          <span className="text-xs font-medium text-slate-300">
            {userEmail.split('@')[0]} <span className="text-[10px] opacity-50">(ADMIN)</span>
          </span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors group"
          title="Cerrar Sesión"
        >
          <LogOut size={20} className="text-slate-400 group-hover:text-red-400" />
        </button>
      </div>
    </header>
  );
};