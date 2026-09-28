import React, { useState } from 'react';
import { 
  Mail, X, Copy, Check, ExternalLink, Send, FileSpreadsheet, Sparkles 
} from 'lucide-react';
import { 
  EmailSparePartItem, 
  PAUL_OROZCO_EMAIL, 
  DEFAULT_EMAIL_GREETING, 
  generateEmailPlainText, 
  copyEmailTableToClipboard, 
  openEmailCompose,
  formatCurrency
} from '../utils/emailDispatcher';

interface EmailNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: EmailSparePartItem[];
  defaultSubject?: string;
  defaultClient?: string;
  defaultOrderGe?: string;
  senderName?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EmailNotificationModal: React.FC<EmailNotificationModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultSubject,
  defaultClient = '',
  defaultOrderGe = '',
  senderName = 'Alexis Guerra',
  showToast
}) => {
  if (!isOpen || items.length === 0) return null;

  const firstClient = defaultClient || items[0]?.cliente || '';
  const firstOrder = defaultOrderGe || items[0]?.orden_ge || items[0]?.pn || '';

  const initialSubject = defaultSubject || (
    firstClient 
      ? `Repuesto ${firstClient}${firstOrder ? ` - ${firstOrder}` : ''}`
      : `Solicitud de Repuesto${firstOrder ? ` - ${firstOrder}` : ''}`
  );

  const [toEmail, setToEmail] = useState(PAUL_OROZCO_EMAIL);
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [greeting, setGreeting] = useState(DEFAULT_EMAIL_GREETING);
  const [copiedTable, setCopiedTable] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const handleCopyTable = async () => {
    const success = await copyEmailTableToClipboard(items, greeting, senderName);
    if (success) {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2500);
      showToast?.('¡Tabla copiada al portapapeles! Puedes pegarla con Ctrl + V en tu correo.', 'success');
    } else {
      showToast?.('No se pudo copiar automáticamente al portapapeles.', 'error');
    }
  };

  const handleCopyPlainText = async () => {
    const text = generateEmailPlainText(items, greeting, senderName);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
      showToast?.('Texto copiado al portapapeles.', 'success');
    } catch {
      showToast?.('Error al copiar texto.', 'error');
    }
  };

  const handleOpenClient = async (mode: 'mailto' | 'outlook-web') => {
    // Primero copiamos la tabla enriquecida al portapapeles para que al abrir el correo,
    // el usuario pueda hacer Ctrl + V si desea la tabla visualmente perfecta
    await copyEmailTableToClipboard(items, greeting, senderName);
    
    const body = generateEmailPlainText(items, greeting, senderName);
    openEmailCompose({
      to: toEmail,
      cc: ccEmail,
      subject,
      body,
      mode
    });

    showToast?.('Abriendo correo. ¡La tabla también se copió al portapapeles para pegar con Ctrl + V!', 'info');
  };

  const totalCost = items.reduce((sum, item) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl">
              <Mail size={22} className="text-white"/>
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">
                Enviar Requerimiento a Paul Orozco
                <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </h3>
              <p className="text-[11px] text-blue-100 font-mono mt-0.5">
                Destinatario: {toEmail}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar ventana"
          >
            <X size={20}/>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          
          {/* Campos de Correo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                Para (Destinatario Principal)
              </label>
              <input 
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                Con Copia (CC) <span className="text-slate-400 font-normal lowercase">(opcional)</span>
              </label>
              <input 
                type="text"
                placeholder="ejemplo@orimec.com.ec"
                value={ccEmail}
                onChange={e => setCcEmail(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                Asunto del Correo
              </label>
              <input 
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none font-semibold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                Mensaje / Saludo
              </label>
              <textarea 
                rows={2}
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 outline-none resize-none"
              />
            </div>
          </div>

          {/* Vista Previa de la Tabla */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={13} className="text-blue-500"/> Vista Previa de la Tabla a Enviar
              </span>
              {totalCost > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Total Estimado: {formatCurrency(totalCost)}
                </span>
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="p-3">P/N</th>
                      <th className="p-3">Descripción</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-center">MOD</th>
                      <th className="p-3">Equipo</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-center">Condición</th>
                      <th className="p-3 text-right">Precio (USD)</th>
                      <th className="p-3 text-center">Orden GE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-3 font-bold font-mono text-slate-800 dark:text-slate-100 whitespace-nowrap">{item.pn}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{item.descripcion}</td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{item.cliente || '—'}</td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white font-mono uppercase">
                            {item.mod || '—'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{item.equipo || '—'}</td>
                        <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">{item.cantidad ?? 1}</td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 uppercase">
                            {item.condicion || '—'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                          {formatCurrency(item.precio)}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                          {item.orden_ge || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic flex items-center gap-1.5">
              💡 <span>Al presionar <strong>Abrir en Outlook</strong>, la tabla se copiará automáticamente al portapapeles para que la pegues con <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">Ctrl + V</kbd> con el diseño visual exacto.</span>
            </p>
          </div>
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyTable}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                copiedTable
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300 dark:border-emerald-700'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-blue-400'
              }`}
              title="Copiar tabla en formato enriquecido para pegar en Outlook"
            >
              {copiedTable ? <Check size={14} className="text-emerald-600"/> : <Copy size={14}/>}
              {copiedTable ? '¡Tabla Copiada!' : 'Copiar Tabla'}
            </button>

            <button
              type="button"
              onClick={handleCopyPlainText}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                copiedText
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300 dark:border-emerald-700'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-blue-400'
              }`}
              title="Copiar mensaje completo como texto plano"
            >
              {copiedText ? <Check size={14} className="text-emerald-600"/> : <FileSpreadsheet size={14}/>}
              {copiedText ? '¡Texto Copiado!' : 'Copiar Texto'}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenClient('outlook-web')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm"
              title="Abrir en Outlook Web (Office 365 en el navegador)"
            >
              <ExternalLink size={14}/> Outlook Web
            </button>

            <button
              type="button"
              onClick={() => handleOpenClient('mailto')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md active:scale-95"
              title="Abrir en la aplicación predeterminada de Outlook / Correo"
            >
              <Send size={14}/> Abrir en Outlook
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
