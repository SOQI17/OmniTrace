import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Lock, AlertCircle, Eye, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export const LoginScreen = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Reset password flow
  const [mode, setMode]             = useState<'login' | 'reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas. Verifique correo y contraseña.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intente más tarde.');
      } else {
        setError('Error al iniciar sesión: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetError('No existe una cuenta con ese correo.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('El correo ingresado no es válido.');
      } else {
        setResetError('Error al enviar correo: ' + err.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

  const goBack = () => {
    setMode('login');
    setResetSent(false);
    setResetError(null);
    setResetEmail('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm border border-white/10 shadow-sm">
                {!logoError ? (
                  <img src="./logo.png" alt="OmniTrace Logo" className="w-12 h-12 object-contain" onError={() => setLogoError(true)} />
                ) : (
                  <Eye className="w-12 h-12 text-white opacity-90" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">OmniTrace</h1>
            </div>
            <p className="text-blue-100 text-sm font-medium tracking-wide opacity-90">Gestión de Activos Médicos</p>
          </div>
        </div>

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <div className="p-8 pt-10">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Iniciar Sesión</h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Correo Corporativo</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@orimec.com.ec" required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-700 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contraseña</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-700"
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Lock size={18} /> Acceder al Sistema</>
                }
              </button>
            </form>

            {/* Forgot password link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => { setMode('reset'); setResetEmail(email); }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-slate-400">Sistema restringido. El acceso no autorizado será auditado.</p>
            </div>
          </div>
        )}

        {/* ── RESET PASSWORD ── */}
        {mode === 'reset' && (
          <div className="p-8 pt-10">
            <button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-semibold mb-6 transition-colors">
              <ArrowLeft size={16} /> Volver al inicio de sesión
            </button>

            {!resetSent ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Recuperar contraseña</h2>
                  <p className="text-sm text-slate-500">Ingresa tu correo corporativo y te enviaremos un enlace para restablecer tu contraseña.</p>
                </div>

                {resetError && (
                  <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3 text-red-700 text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{resetError}</p>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Correo Corporativo</label>
                    <input
                      type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="usuario@orimec.com.ec" required
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="submit" disabled={resetLoading}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {resetLoading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Mail size={18} /> Enviar correo de recuperación</>
                    }
                  </button>
                </form>
              </>
            ) : (
              /* Success state */
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Correo enviado</h2>
                <p className="text-sm text-slate-500 mb-2">
                  Revisá tu bandeja de entrada en:
                </p>
                <p className="text-sm font-bold text-blue-600 mb-6">{resetEmail}</p>
                <p className="text-xs text-slate-400 mb-8">
                  Si no ves el correo, revisa la carpeta de spam. El enlace expira en 1 hora.
                </p>
                <button
                  onClick={goBack}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} /> Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};