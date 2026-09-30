import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Download, 
  FileText, 
  Calendar, 
  Building2, 
  User, 
  MapPin, 
  Package, 
  AlertTriangle,
  Layers
} from 'lucide-react';
import { DigitalEgressRecord, DigitalEgressItem, SparePart } from '../types';
import { downloadDigitalEgressPDF } from '../services/DigitalEgressPDF';

interface EditDigitalEgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  egress: DigitalEgressRecord | null;
  onSave: (updated: DigitalEgressRecord) => Promise<void>;
  onDelete?: (egressId: string) => Promise<void>;
  availableSpareParts?: SparePart[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EditDigitalEgressModal: React.FC<EditDigitalEgressModalProps> = ({
  isOpen,
  onClose,
  egress,
  onSave,
  onDelete,
  availableSpareParts = [],
  showToast
}) => {
  const [numero, setNumero] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [fecha, setFecha] = useState<string>('');
  const [responsable, setResponsable] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [origen, setOrigen] = useState<'REPUESTOS' | 'BODEGA'>('REPUESTOS');
  const [items, setItems] = useState<DigitalEgressItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAddPartPn, setSelectedAddPartPn] = useState<string>('');

  useEffect(() => {
    if (isOpen && egress) {
      setNumero(String(egress.numero || ''));
      setCliente(egress.cliente || '');
      setFecha(egress.fecha || '');
      setResponsable(egress.responsable || '');
      setDireccion(egress.direccion || '');
      setObservaciones(egress.observaciones || '');
      setOrigen(egress.origen || 'REPUESTOS');
      setItems(
        egress.items && egress.items.length > 0
          ? egress.items.map(it => ({ ...it, serial_number: it.serial_number || '' }))
          : [{ codigo: '', descripcion: '', cantidad: 1, serial_number: '' }]
      );
      setShowDeleteConfirm(false);
      setSelectedAddPartPn('');
    }
  }, [isOpen, egress]);

  if (!isOpen || !egress) return null;

  const handleItemChange = (index: number, field: keyof DigitalEgressItem, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { codigo: '', descripcion: '', cantidad: 1, serial_number: '' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddFromSpareParts = (partPn: string) => {
    if (!partPn) return;
    const part = availableSpareParts.find(p => p.pn === partPn || p.id === partPn);
    if (!part) return;

    setItems(prev => [
      ...prev,
      {
        codigo: part.pn,
        descripcion: part.descripcion || `${part.mod || ''} ${part.equipo || ''}`.trim(),
        cantidad: Number(part.cantidad) || 1,
        serial_number: '',
        spare_part_id: part.id
      }
    ]);
    setSelectedAddPartPn('');
  };

  const buildUpdatedRecord = (): DigitalEgressRecord => {
    const cleanNumStr = String(numero).trim();
    const parsedNum = parseInt(cleanNumStr.replace(/[^\d]/g, ''), 10);
    const finalNumero = !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : (cleanNumStr || egress.numero);
    const displayNum = cleanNumStr || String(finalNumero);

    return {
      ...egress,
      numero: finalNumero,
      titulo: `EGRESO DIGITAL #${displayNum}`,
      cliente: cliente.trim(),
      fecha: fecha.trim(),
      responsable: responsable.trim(),
      direccion: direccion.trim(),
      observaciones: observaciones.trim(),
      origen,
      items: items.filter(it => it.codigo.trim() || it.descripcion.trim())
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) {
      showToast?.('Por favor ingresa el número de egreso.', 'error');
      return;
    }
    if (!cliente.trim()) {
      showToast?.('Por favor ingresa el cliente u hospital.', 'error');
      return;
    }
    if (items.length === 0 || !items.some(it => it.codigo.trim() || it.descripcion.trim())) {
      showToast?.('El egreso debe contener al menos un repuesto o ítem con código/descripción.', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = buildUpdatedRecord();
      await onSave(updated);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar egreso editado:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !egress.id) return;
    setDeleting(true);
    try {
      await onDelete(egress.id);
      onClose();
    } catch (err: any) {
      console.error('Error al eliminar egreso:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPreviewPDF = () => {
    try {
      const updated = buildUpdatedRecord();
      downloadDigitalEgressPDF(updated);
      showToast?.('Descargando PDF actualizado...', 'info');
    } catch (err) {
      console.error(err);
      showToast?.('Error al generar PDF.', 'error');
    }
  };

  const totalUnits = items.reduce((sum, it) => sum + (Number(it.cantidad) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Editar Egreso Digital #{egress.numero}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  origen === 'REPUESTOS'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                }`}>
                  {origen}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modifica los datos del egreso, cliente, fechas y la lista de repuestos despachados.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Seccion 1: Cabecera del Egreso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            {/* Numero de Egreso */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                N° Egreso Digital *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ej: 1200"
                  className="w-full pl-3 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Fecha del Egreso *
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  placeholder="Ej: 30/9/2026 o martes, 30 de..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Origen */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Módulo de Origen
              </label>
              <div className="relative">
                <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as 'REPUESTOS' | 'BODEGA')}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="REPUESTOS">REPUESTOS</option>
                  <option value="BODEGA">BODEGA</option>
                </select>
              </div>
            </div>

            {/* Cliente / Hospital */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Cliente / Hospital *
              </label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ej: HOSPITAL METROPOLITANO"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Responsable / Custodio */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Responsable / Custodio *
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  placeholder="Ej: ALEXIS GUERRA"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Dirección / Ciudad */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Dirección / Ciudad
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Quito"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seccion 2: Lista de Repuestos Despachados */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-emerald-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Repuestos Despachados ({items.length} ítems, {totalUnits} u.)
                </h3>
              </div>

              {/* Selector para agregar repuestos desde la base instalada */}
              {availableSpareParts.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAddPartPn}
                    onChange={(e) => handleAddFromSpareParts(e.target.value)}
                    className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-bold outline-none max-w-[240px] truncate"
                  >
                    <option value="">+ Agregar de Base de Repuestos...</option>
                    {availableSpareParts.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.pn} - {sp.descripcion?.slice(0, 30) || 'Sin desc'} ({sp.cliente || 'S/C'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tabla / Lista de Items */}
            <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {/* Encabezado en desktop */}
              <div className="hidden sm:grid grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <div className="col-span-3">P/N (Código) *</div>
                <div className="col-span-4">Descripción *</div>
                <div className="col-span-2">Cantidad *</div>
                <div className="col-span-2">Serie (S/N)</div>
                <div className="col-span-1 text-center">Acción</div>
              </div>

              {/* Filas */}
              {items.map((item, idx) => (
                <div key={item.id || idx} className="p-3 sm:p-2.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Codigo P/N */}
                  <div className="sm:col-span-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block mb-0.5">P/N (Código)</span>
                    <input
                      type="text"
                      required
                      value={item.codigo}
                      onChange={(e) => handleItemChange(idx, 'codigo', e.target.value.toUpperCase())}
                      placeholder="Ej: 5432100-2"
                      className="w-full px-2.5 py-1.5 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Descripcion */}
                  <div className="sm:col-span-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block mb-0.5">Descripción</span>
                    <input
                      type="text"
                      required
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción del repuesto"
                      className="w-full px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block mb-0.5">Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(idx, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-center"
                    />
                  </div>

                  {/* Serie S/N */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase sm:hidden block mb-0.5">S/N (Opcional)</span>
                    <input
                      type="text"
                      value={item.serial_number || ''}
                      onChange={(e) => handleItemChange(idx, 'serial_number', e.target.value)}
                      placeholder="Ej: SN-9876"
                      className="w-full px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Boton Eliminar fila */}
                  <div className="sm:col-span-1 flex justify-end sm:justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      title="Quitar repuesto de la lista"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón para agregar una nueva fila manual */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95"
              >
                <Plus size={14} /> Agregar otra fila de repuesto
              </button>
            </div>
          </div>

          {/* Seccion 3: Observaciones */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Observaciones del Egreso
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles adicionales, número de orden, motivo de entrega, etc."
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
            />
          </div>

          {/* Confirmación de eliminación */}
          {showDeleteConfirm && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                <AlertTriangle size={20} className="shrink-0" />
                <span className="text-xs font-bold">
                  ¿Estás seguro de que deseas eliminar este egreso digital (#{egress.numero})? Esta acción no se puede deshacer.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
                </button>
              </div>
            </div>
          )}

          {/* Footer Botones */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Opciones Izquierda: Eliminar si onDelete disponible */}
            <div>
              {onDelete && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs font-bold transition-colors"
                >
                  <Trash2 size={15} /> Eliminar Egreso
                </button>
              )}
            </div>

            {/* Opciones Derecha: Descargar PDF, Cancelar, Guardar */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPreviewPDF}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <Download size={15} /> Descargar PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
