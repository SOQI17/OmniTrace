import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Save, X, Plus, Trash2, Building2
} from 'lucide-react';
import { DigitalEgressRecord, DigitalEgressItem, SparePart } from '../types';
import { downloadDigitalEgressPDF, ORIMEC_STAMP_BASE64 } from '../services/DigitalEgressPDF';

interface DigitalEgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems: DigitalEgressItem[];
  initialClient?: string;
  initialOrigin: 'REPUESTOS' | 'BODEGA';
  currentUserName?: string;
  nextEgressNumber: number;
  onConfirmEgress: (egress: DigitalEgressRecord) => Promise<void>;
  availableSpareParts?: SparePart[];
  availableInventory?: { pn: string; description: string; stock: number }[];
}

export const DigitalEgressModal: React.FC<DigitalEgressModalProps> = ({
  isOpen,
  onClose,
  initialItems,
  initialClient = '',
  initialOrigin,
  currentUserName = '',
  nextEgressNumber,
  onConfirmEgress,
  availableSpareParts = [],
  availableInventory = []
}) => {
  const getInitialDate = () => {
    try {
      const now = new Date();
      return now.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return new Date().toLocaleDateString();
    }
  };

  const [numero, setNumero] = useState<number>(nextEgressNumber || 1);
  const [cliente, setCliente] = useState<string>(initialClient || '');
  const [fecha, setFecha] = useState<string>(getInitialDate());
  const [responsable, setResponsable] = useState<string>(currentUserName || '');
  const [direccion, setDireccion] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [items, setItems] = useState<DigitalEgressItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [selectedAddPartPn, setSelectedAddPartPn] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setNumero(nextEgressNumber || 1);
      setCliente(initialClient || '');
      setFecha(getInitialDate());
      setResponsable(currentUserName || '');
      setDireccion('');
      setObservaciones('');
      setItems(
        initialItems.length > 0
          ? initialItems.map(it => ({ ...it, serial_number: it.serial_number || '' }))
          : [{ codigo: '', cantidad: 1, descripcion: '', serial_number: '' }]
      );
    }
  }, [isOpen, nextEgressNumber, initialClient, initialItems, currentUserName]);

  if (!isOpen) return null;

  const currentRecord: DigitalEgressRecord = {
    id: `EG_${numero}_${Date.now()}`,
    numero: Number(numero) || 1,
    titulo: `EGRESO DIGITAL ${Number(numero) || 1}`,
    cliente: (cliente || '').trim(),
    fecha: (fecha || '').trim(),
    fecha_iso: new Date().toISOString(),
    responsable: (responsable || '').trim(),
    direccion: (direccion || '').trim(),
    items: items.filter(it => it.codigo.trim() || it.descripcion.trim()),
    observaciones: (observaciones || '').trim(),
    origen: initialOrigin,
    created_by: currentUserName || 'ADMIN',
    created_at: new Date().toISOString()
  };

  const handleItemChange = (index: number, field: keyof DigitalEgressItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    setItems(prev => [...prev, { codigo: '', cantidad: 1, descripcion: '', serial_number: '' }]);
  };

  const handleSelectPredefinedPart = (pn: string) => {
    if (!pn) return;
    if (initialOrigin === 'REPUESTOS') {
      const found = availableSpareParts.find(sp => sp.pn === pn);
      if (found) {
        if (!cliente && found.cliente && found.cliente.trim() !== '' && found.cliente.trim().toUpperCase() !== 'STOCK') {
          setCliente(found.cliente.trim());
        }
        setItems(prev => [
          ...prev.filter(it => it.codigo.trim() !== ''),
          {
            codigo: found.pn,
            cantidad: Number(found.cantidad) || 1,
            descripcion: found.descripcion || '',
            serial_number: '',
            spare_part_id: found.id
          }
        ]);
        setSelectedAddPartPn('');
      }
    } else {
      const found = availableInventory.find(inv => inv.pn === pn);
      if (found) {
        setItems(prev => [
          ...prev.filter(it => it.codigo.trim() !== ''),
          {
            codigo: found.pn,
            cantidad: 1,
            descripcion: found.description || '',
            serial_number: ''
          }
        ]);
        setSelectedAddPartPn('');
      }
    }
  };

  const handleSaveAndConfirm = async () => {
    if (items.length === 0 || !items.some(it => it.codigo.trim())) {
      alert('Debes incluir al menos un repuesto o ítem con código o descripción.');
      return;
    }
    setSaving(true);
    try {
      await onConfirmEgress(currentRecord);
      onClose();
    } catch (err: any) {
      alert('Error al guardar el egreso digital: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    downloadDigitalEgressPDF(currentRecord);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black tracking-tight text-base sm:text-lg">
                  EGRESO DIGITAL #{numero}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {initialOrigin}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Plantilla oficial institucional de entrega y salida de repuestos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('EDIT')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'EDIT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setViewMode('PREVIEW')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  viewMode === 'PREVIEW'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vista Previa
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {viewMode === 'EDIT' ? (
            <div className="space-y-6">
              {/* Document Metadata Form */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    N° Egreso Digital *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numero}
                    onChange={(e) => setNumero(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full font-mono font-bold text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Código / Cliente / Hospital *
                  </label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Ej. Hospital de la Policía"
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Fecha *
                  </label>
                  <input
                    type="text"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    placeholder="martes, 08 de septiembre de 2026"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Responsable / Custodio *
                  </label>
                  <input
                    type="text"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Francisco Sotomayor"
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Dirección / Ciudad *
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Quito"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Building2 size={14} className="text-emerald-500" />
                    Ítems y Repuestos del Egreso ({items.length})
                  </h4>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(availableSpareParts.length > 0 || availableInventory.length > 0) && (
                      <select
                        value={selectedAddPartPn}
                        onChange={(e) => handleSelectPredefinedPart(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="">+ Seleccionar repuesto existente...</option>
                        {initialOrigin === 'REPUESTOS'
                          ? availableSpareParts.map(sp => (
                              <option key={sp.id} value={sp.pn}>
                                {sp.pn} - {sp.descripcion.slice(0, 30)}
                              </option>
                            ))
                          : availableInventory.map(inv => (
                              <option key={inv.pn} value={inv.pn}>
                                {inv.pn} - {inv.description.slice(0, 30)} (Stock: {inv.stock})
                              </option>
                            ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={handleAddNewItem}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus size={13} /> Agregar Fila
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5 w-[22%]">Código (P/N)</th>
                        <th className="px-3 py-2.5 w-[12%] text-center">Cantidad</th>
                        <th className="px-3 py-2.5 w-[42%]">Descripción</th>
                        <th className="px-3 py-2.5 w-[18%]">S/N (Serie)</th>
                        <th className="px-2 py-2.5 w-[6%] text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.codigo}
                              onChange={(e) => handleItemChange(idx, 'codigo', e.target.value)}
                              placeholder="5264644"
                              className="w-full font-mono font-bold text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(idx, 'cantidad', parseInt(e.target.value) || 1)}
                              className="w-16 font-bold text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center outline-none mx-auto"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                              placeholder="Adsorber, Sumitono F-50"
                              className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.serial_number || ''}
                              onChange={(e) => handleItemChange(idx, 'serial_number', e.target.value)}
                              placeholder="Opcional..."
                              className="w-full font-mono text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Observaciones:
                </label>
                <textarea
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalles de entrega, instalación, etc..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
          ) : (
            /* PREVIEW MODE */
            <div className="max-w-2xl mx-auto bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-300 font-sans">
              <h2 className="text-center font-bold text-base tracking-tight mb-4 uppercase">
                EGRESO DIGITAL {numero}
              </h2>

              <div className="border border-slate-400 text-xs mb-4">
                <div className="grid grid-cols-4 border-b border-slate-400">
                  <div className="font-bold p-2 border-r border-slate-400 uppercase bg-slate-50">CODIGO</div>
                  <div className="col-span-3 p-2 font-semibold text-center">{cliente || '—'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-slate-400">
                  <div className="font-bold p-2 border-r border-slate-400 uppercase bg-slate-50">FECHA:</div>
                  <div className="col-span-3 p-2 text-center">{fecha || '—'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-slate-400">
                  <div className="font-bold p-2 border-r border-slate-400 uppercase bg-slate-50">RESPONSABLE:</div>
                  <div className="col-span-3 p-2 font-semibold text-center">{responsable || '—'}</div>
                </div>
                <div className="grid grid-cols-4">
                  <div className="font-bold p-2 border-r border-slate-400 uppercase bg-slate-50">DIRECCION:</div>
                  <div className="col-span-3 p-2 text-center">{direccion || '—'}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-400 text-xs mb-4 overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 font-bold bg-slate-50">
                      <th className="p-2 border-r border-slate-400 w-[20%]">CODIGO</th>
                      <th className="p-2 border-r border-slate-400 w-[15%]">CANTIDAD</th>
                      <th className="p-2 border-r border-slate-400 w-[50%]">DESCRIPCION</th>
                      <th className="p-2 w-[15%]">S/N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-300">
                        <td className="p-2 border-r border-slate-300 font-mono font-bold">{it.codigo || '—'}</td>
                        <td className="p-2 border-r border-slate-300">{it.cantidad || 1}</td>
                        <td className="p-2 border-r border-slate-300 text-left">{it.descripcion || '—'}</td>
                        <td className="p-2 font-mono">{it.serial_number || '—'}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                      <tr key={`filler-${i}`} className="border-b border-slate-200 h-8">
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Observaciones */}
              <div className="text-xs mb-6">
                <p className="font-bold uppercase mb-1">OBSERVACIONES:</p>
                <div className="border border-slate-300 p-2 min-h-[50px] rounded-sm text-slate-700">
                  {observaciones || 'Sin observaciones registradas.'}
                </div>
              </div>

              {/* Stamp & signature */}
              <div className="pt-2">
                <img
                  src={ORIMEC_STAMP_BASE64}
                  alt="Sello Orimec"
                  className="w-48 object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se generará el acta oficial con numeración correlativa y sello ORIMEC.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <Download size={14} /> Guardar PDF
            </button>

            <button
              type="button"
              onClick={handleSaveAndConfirm}
              disabled={saving}
              className="flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Guardando...' : 'Confirmar Egreso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
