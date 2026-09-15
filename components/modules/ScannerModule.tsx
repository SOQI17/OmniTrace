import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Asset, SparePart, DigitalEgressItem } from '../../types';
import { 
  QrCode, 
  Camera, 
  CameraOff, 
  ScanLine, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ArrowRight, 
  Search, 
  FileText, 
  Package, 
  History, 
  Sparkles,
  RefreshCw,
  Building2,
  Hash
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { AssetLabelPDF } from '../AssetLabelPDF';

interface ScannerModuleProps {
  assets: Asset[];
  spareParts?: SparePart[];
  onOpenDigitalEgress?: (origin: 'REPUESTOS' | 'BODEGA', client: string, items: DigitalEgressItem[]) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ScannedMatch {
  type: 'ASSET' | 'SPARE_PART';
  id: string;
  pn: string;
  description: string;
  client: string;
  quantity: number;
  serialNumber?: string;
  orderGE?: string;
  workflowId?: string;
  status?: string;
  rawAsset?: Asset;
  rawSparePart?: SparePart;
}

export const ScannerModule: React.FC<ScannerModuleProps> = memo(({
  assets,
  spareParts = [],
  onOpenDigitalEgress,
  showToast
}) => {
  const [manualCode, setManualCode] = useState('');
  const [activeMatch, setActiveMatch] = useState<ScannedMatch | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedMatch[]>([]);
  
  // Cámara
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Función de búsqueda de código en Activos y Repuestos
  const processScannedCode = useCallback((rawQuery: string) => {
    const query = (rawQuery || '').trim();
    if (!query) return;

    setNotFoundQuery(null);

    // 1. Buscar en assets (por ID, qr_hash, P/N, o número de orden GE)
    const qUpper = query.toUpperCase();
    const assetFound = assets.find(a => 
      a.id === query ||
      (a.warehouse && a.warehouse.qr_hash && a.warehouse.qr_hash.toUpperCase() === qUpper) ||
      (a.metadata && a.metadata.pn && a.metadata.pn.toUpperCase() === qUpper) ||
      (a.metadata && a.metadata.numero_orden_ge && a.metadata.numero_orden_ge.toUpperCase() === qUpper) ||
      (a.metadata && a.metadata.sn && a.metadata.sn.toUpperCase() === qUpper)
    );

    if (assetFound) {
      const match: ScannedMatch = {
        type: 'ASSET',
        id: assetFound.id,
        pn: assetFound.metadata.pn || 'SIN P/N',
        description: assetFound.metadata.description || 'Sin descripción',
        client: (assetFound.metadata as any).cliente_final || assetFound.metadata.client || 'NO ESPECIFICADO',
        quantity: Number((assetFound.metadata as any).cantidad || (assetFound.metadata as any).quantity) || 1,
        serialNumber: assetFound.metadata.sn || '',
        orderGE: assetFound.metadata.numero_orden_ge || '',
        workflowId: assetFound.metadata.workflow_id || '',
        status: assetFound.current_status,
        rawAsset: assetFound
      };
      setActiveMatch(match);
      setScanHistory(prev => [match, ...prev.filter(p => p.id !== match.id)].slice(0, 8));
      if (showToast) showToast(`✅ Repuesto detectado: ${match.pn}`, 'success');
      return;
    }

    // 2. Si no está en assets, buscar en spareParts (Base de Repuestos)
    const spFound = spareParts.find(sp => 
      sp.id === query ||
      (sp.asset_id && sp.asset_id === query) ||
      (sp.pn && sp.pn.toUpperCase() === qUpper) ||
      (sp.orden_ge && sp.orden_ge.toUpperCase() === qUpper) ||
      (sp.workflow_id && sp.workflow_id.toUpperCase() === qUpper)
    );

    if (spFound) {
      const match: ScannedMatch = {
        type: 'SPARE_PART',
        id: spFound.id,
        pn: spFound.pn || 'SIN P/N',
        description: spFound.descripcion || 'Sin descripción',
        client: spFound.cliente || 'NO ESPECIFICADO',
        quantity: Number(spFound.cantidad) || 1,
        serialNumber: '',
        orderGE: spFound.orden_ge || '',
        workflowId: spFound.workflow_id || '',
        status: 'BASE REPUESTOS',
        rawSparePart: spFound
      };
      setActiveMatch(match);
      setScanHistory(prev => [match, ...prev.filter(p => p.id !== match.id)].slice(0, 8));
      if (showToast) showToast(`✅ Repuesto encontrado en catálogo: ${match.pn}`, 'success');
      return;
    }

    // No encontrado
    setNotFoundQuery(query);
    setActiveMatch(null);
  }, [assets, spareParts, showToast]);

  // Manejar submit del formulario manual / lector
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode);
    setManualCode('');
  };

  // Detener stream de cámara
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Iniciar cámara con detección QR
  const startCamera = async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Si el navegador soporta BarcodeDetector nativo (Chrome / Android / iOS moderno)
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  processScannedCode(detectedVal);
                  stopCamera();
                }
              }
            } catch {
              // Ignorar frames sin código
            }
          }
        }, 300);
      }
    } catch (err: any) {
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos o ingresa el código manualmente.');
      setCameraActive(false);
    }
  };

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Despachar Egreso Digital con 1 clic
  const handleProceedToEgress = () => {
    if (!activeMatch) return;
    if (onOpenDigitalEgress) {
      onOpenDigitalEgress(
        'BODEGA',
        activeMatch.client || '',
        [{
          id: activeMatch.id,
          codigo: activeMatch.pn,
          cantidad: activeMatch.quantity || 1,
          descripcion: activeMatch.description,
          serial_number: activeMatch.serialNumber || ''
        }]
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── ENCABEZADO ── */}
      <div className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <QrCode size={22} />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Escáner de Egreso Rápido
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Escanea el código QR de la solicitud o etiqueta de repuesto para realizar el egreso digital en segundos.
          </p>
        </div>

        {/* Botón de Cámara */}
        <button
          onClick={cameraActive ? stopCamera : startCamera}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 ${
            cameraActive 
              ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
          }`}
        >
          {cameraActive ? (
            <>
              <CameraOff size={16} /> Detener Cámara
            </>
          ) : (
            <>
              <Camera size={16} /> Escanear con Cámara
            </>
          )}
        </button>
      </div>

      {/* ── VISOR DE CÁMARA (SI ESTÁ ACTIVA) ── */}
      {cameraActive && (
        <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-500 max-w-md mx-auto aspect-[4/3] flex items-center justify-center animate-fadeIn">
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover" 
            playsInline 
            muted 
          />
          {/* Mirilla de Escáner tipo Visor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_50px_rgba(59,130,246,0.3)]">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 -mt-1 -ml-1 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 -mt-1 -mr-1 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 -mb-1 -ml-1 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 -mb-1 -mr-1 rounded-br-lg"></div>
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
            </div>
          </div>
          <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
            <span className="bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
              Enfoca el código QR del repuesto
            </span>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle size={18} className="shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* ── ENTRADA MANUAL / LECTOR DE BARRAS PISTOLA USB ── */}
      <form onSubmit={handleManualSubmit} className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Pasa la pistola lectora o escribe el código QR, P/N, Orden GE o ID..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shrink-0"
        >
          <ScanLine size={16} /> Buscar Repuesto
        </button>
      </form>

      {/* ── REPORTE SI NO SE ENCONTRÓ EL CÓDIGO ── */}
      {notFoundQuery && (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl text-center space-y-2 animate-fadeIn">
          <div className="inline-flex p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full">
            <AlertCircle size={24} />
          </div>
          <h3 className="font-black text-red-900 dark:text-red-300 text-base">No se encontró ningún repuesto</h3>
          <p className="text-xs text-red-700 dark:text-red-400 max-w-md mx-auto">
            El código <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">{notFoundQuery}</span> no coincide con ninguna solicitud ni activo registrado.
          </p>
        </div>
      )}

      {/* ── RESULTADO ENCONTRADO (TARJETA DE EGRESO RÁPIDO) ── */}
      {activeMatch && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-emerald-500 shadow-xl overflow-hidden animate-fadeIn">
          <div className="bg-emerald-600 text-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <CheckCircle size={18} /> Repuesto Identificado para Egreso
            </div>
            <button 
              onClick={() => setActiveMatch(null)}
              className="text-emerald-100 hover:text-white p-1 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente Solicitante</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Building2 size={16} className="text-blue-500" />
                    <span className="text-base font-black text-slate-900 dark:text-white">{activeMatch.client || 'No especificado'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Número de Parte (P/N)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Hash size={16} className="text-emerald-500" />
                    <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">{activeMatch.pn}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Descripción</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">{activeMatch.description}</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Cantidad a Despachar</span>
                  <span className="font-black text-slate-900 dark:text-white text-base bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    {activeMatch.quantity} unidad(es)
                  </span>
                </div>

                {activeMatch.orderGE && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Orden GE</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{activeMatch.orderGE}</span>
                  </div>
                )}

                {activeMatch.workflowId && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Workflow ID</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{activeMatch.workflowId}</span>
                  </div>
                )}

                {activeMatch.status && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Estado Actual</span>
                    <StatusBadge status={activeMatch.status} />
                  </div>
                )}
              </div>
            </div>

            {/* BOTÓN PRINCIPAL DE ACCIÓN: HACER EGRESO DIGITAL */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleProceedToEgress}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-98"
              >
                <FileText size={20} /> Generar Egreso Digital Ahora <ArrowRight size={18} />
              </button>

              {activeMatch.rawAsset && (
                <div className="shrink-0 flex items-center justify-center">
                  <AssetLabelPDF asset={activeMatch.rawAsset} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE ESCANEOS RECIENTES ── */}
      {scanHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <History size={16} /> Escaneados recientemente en esta sesión
            </div>
            <button
              onClick={() => setScanHistory([])}
              className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {scanHistory.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                onClick={() => setActiveMatch(item)}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Package size={16} />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">{item.pn}</span>
                    <span className="text-[11px] text-slate-400 ml-2 truncate max-w-[200px] inline-block align-bottom">{item.client}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                    {item.quantity} u.
                  </span>
                  <ArrowRight size={14} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

ScannerModule.displayName = 'ScannerModule';
