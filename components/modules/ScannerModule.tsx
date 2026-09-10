import React, { useState, memo } from 'react';
import { Asset } from '../../types';
import { ScanLine, CheckCircle, X } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { AssetLabelPDF } from '../AssetLabelPDF';

interface ScannerModuleProps {
  assets: Asset[];
}

const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700 text-xs">
    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{label}</span>
    <div>{value}</div>
  </div>
);

export const ScannerModule: React.FC<ScannerModuleProps> = memo(({ assets }) => {
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);

  const handleScanMock = () => {
    if (assets.length > 0) {
      setScannedAsset(assets[0]);
    }
  };

  return (
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
  );
});
ScannerModule.displayName = 'ScannerModule';
