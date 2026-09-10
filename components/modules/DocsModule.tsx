import React, { useState, memo } from 'react';
import { Asset, StoredDocument, User } from '../../types';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  FolderOpen, Search, FileText, Eye, Download, Trash2, 
  Upload, UploadCloud, Loader2, ChevronRight, X, ArrowLeft 
} from 'lucide-react';
import { generateUUID } from '../../utils/helpers';
import { uploadDocToStorage, deleteDocFromStorage } from '../../utils/storage';

interface DocsModuleProps {
  assets: Asset[];
  assetsByOrder: Record<string, Asset[]>;
  currentUser: User | null;
  selectedAssetId?: string | null;
  onSelectAsset?: (id: string | null) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showError: (msg: string) => void;
}

export const DocsModule: React.FC<DocsModuleProps> = memo(({
  assets,
  assetsByOrder,
  currentUser,
  selectedAssetId: externalSelectedAssetId,
  onSelectAsset,
  showToast,
  showError
}) => {
  const [internalAssetId, setInternalAssetId] = useState<string | null>(null);
  const activeAssetId = externalSelectedAssetId !== undefined ? externalSelectedAssetId : internalAssetId;
  const setAssetId = (id: string | null) => {
    if (onSelectAsset) onSelectAsset(id);
    setInternalAssetId(id);
  };

  const selectedAsset = assets.find(a => a.id === activeAssetId) || null;

  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<StoredDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (docItem: StoredDocument) => {
    setPreviewDoc(docItem);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      if (docItem.url && docItem.url !== '' && docItem.url !== '#') {
        setPreviewUrl(docItem.url);
      } else {
        setPreviewUrl(null);
      }
    } catch {
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const downloadDoc = async (docItem: StoredDocument) => {
    const url = docItem.url;
    if (!url || url === '' || url === '#') {
      showToast('Este documento no tiene archivo almacenado aún.', 'info');
      return;
    }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = docItem.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !currentUser || !docFile) return;
    setUploadingDoc(true);
    try {
      const ext = docFile.name.includes('.') ? '.' + docFile.name.split('.').pop() : '';
      const baseName = docFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\-_. ]/g, '').trim();
      const cleanFilename = (baseName || 'documento') + ext;
      const docId = generateUUID();

      const downloadURL = await uploadDocToStorage(docFile, docId, setUploadProgress);

      const newDoc: StoredDocument = {
        id: docId,
        name: docName,
        filename: cleanFilename,
        uploaded_by: currentUser.name,
        date: new Date().toISOString(),
        url: downloadURL,
      };

      await updateDoc(doc(db, "assets", selectedAsset.id), {
        "logistics.extra_docs": [...(selectedAsset.logistics.extra_docs || []), newDoc]
      });

      setDocName('');
      setDocFile(null);
      showToast('Documento adjuntado correctamente.', 'success');
    } catch (err: any) {
      showError(`Error al subir archivo: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedAsset) return;
    if (!window.confirm("¿Eliminar este documento? Esta acción no puede deshacerse.")) return;
    const docToDelete = selectedAsset.logistics.extra_docs?.find(d => d.id === docId);
    if (docToDelete?.url) {
      await deleteDocFromStorage(docToDelete.url);
    }
    await updateDoc(doc(db, "assets", selectedAsset.id), {
      "logistics.extra_docs": selectedAsset.logistics.extra_docs?.filter(d => d.id !== docId)
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 flex flex-col min-h-0">
      {!selectedAsset ? (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 text-center border-b-8 border-slate-900 dark:border-slate-700">
            <div className="bg-slate-100 dark:bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FolderOpen size={40} className="text-slate-800 dark:text-slate-200"/>
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter">Repositorio Documental</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto font-medium">Gestione facturas, guías y certificados de cada Orden de Compra.</p>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-slate-800 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por número de orden..." 
              value={docSearchTerm} 
              onChange={(e) => setDocSearchTerm(e.target.value)} 
              className="w-full pl-12 pr-6 py-4 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-0 focus:border-slate-900 outline-none bg-white dark:bg-slate-800 shadow-sm transition-all font-bold text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-5">Orden</th>
                    <th className="p-5">Proyecto / Equipo</th>
                    <th className="p-5">Solicitud</th>
                    <th className="p-5 text-center">Docs</th>
                    <th className="p-5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(Object.entries(assetsByOrder) as [string, Asset[]][])
                    .filter(([id, g]) => id.toLowerCase().includes(docSearchTerm.toLowerCase()) || (g[0]?.metadata?.description || '').toLowerCase().includes(docSearchTerm.toLowerCase()))
                    .map(([id, group]) => {
                      const main = group[0];
                      const docs = main?.logistics?.extra_docs?.length || 0;
                      return (
                        <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group">
                          <td className="p-5">
                            <div className="font-black text-slate-800 dark:text-slate-200 text-sm">{id}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{main?.metadata?.workflow_id}</div>
                          </td>
                          <td className="p-5 font-bold text-slate-600 dark:text-slate-300">{main?.metadata?.equipo_destino || 'Varios'}</td>
                          <td className="p-5 text-slate-400 font-mono text-[10px]">{main?.metadata?.fecha_solicitud ? new Date(main.metadata.fecha_solicitud).toLocaleDateString() : '-'}</td>
                          <td className="p-5 text-center">
                            <span className={`font-black px-2.5 py-1 rounded-full text-[10px] ${docs > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                              {docs}
                            </span>
                          </td>
                          <td className="p-5 text-right">
                            <button 
                              onClick={() => setAssetId(main.id)} 
                              className="bg-slate-900 dark:bg-blue-600 text-white p-2 rounded-lg hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors shadow-sm"
                            >
                              <ChevronRight size={16}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 animate-fadeIn">
          {/* Header */}
          <div className="p-6 md:p-8 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center shrink-0">
            <div>
              <button 
                onClick={() => setAssetId(null)} 
                className="text-[10px] uppercase font-black text-slate-400 hover:text-white flex items-center gap-2 mb-2 transition-colors tracking-widest"
              >
                <ArrowLeft size={16}/> Volver al listado
              </button>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">
                Documentos: {selectedAsset.metadata.numero_orden_ge || selectedAsset.metadata.workflow_id}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                {selectedAsset.metadata.cliente_final || selectedAsset.metadata.equipo_destino}
              </p>
            </div>
            <div className="bg-slate-800 dark:bg-slate-900 px-4 py-2 rounded-xl text-center border border-slate-700">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Archivos</span>
              <span className="text-xl font-black text-white">{selectedAsset.logistics.extra_docs?.length || 0}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(!selectedAsset.logistics.extra_docs || selectedAsset.logistics.extra_docs.length === 0) && (
                <div className="col-span-full text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <FileText className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">No hay documentos adjuntos a esta orden</p>
                  <p className="text-xs text-slate-400 mt-1">Utilice el formulario inferior para subir facturas, guías o certificados.</p>
                </div>
              )}
              {selectedAsset.logistics.extra_docs?.map((docItem) => {
                const hasFile = !!docItem.url && docItem.url !== '' && docItem.url !== '#';
                return (
                  <div key={docItem.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight mb-1 line-clamp-1">{docItem.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono truncate mb-3">{docItem.filename}</p>
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-auto">
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">{new Date(docItem.date).toLocaleDateString()}</span>
                        <span className="text-[9px] text-blue-700 dark:text-blue-400 font-black uppercase">@{docItem.uploaded_by}</span>
                      </div>
                    </div>

                    <div className="flex border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => hasFile && openPreview(docItem)}
                        disabled={!hasFile}
                        aria-label="Vista previa"
                        className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
                      >
                        <Eye size={14}/> Vista previa
                      </button>
                      <div className="w-px bg-slate-100 dark:bg-slate-700"/>
                      <button
                        onClick={() => downloadDoc(docItem)}
                        disabled={!hasFile}
                        aria-label="Descargar documento"
                        className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
                      >
                        <Download size={14}/> Descargar
                      </button>
                      <div className="w-px bg-slate-100 dark:bg-slate-700"/>
                      <button
                        onClick={() => handleDeleteDoc(docItem.id)}
                        aria-label="Eliminar documento"
                        className="py-2.5 px-4 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload form */}
          <div className="p-6 md:p-8 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <form onSubmit={handleUploadDoc} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Descripción del Documento</label>
                  <input 
                    type="text" 
                    value={docName} 
                    onChange={(e)=>setDocName(e.target.value)} 
                    placeholder="Ej. Factura Comercial" 
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-bold focus:border-slate-800 outline-none transition-all dark:bg-slate-900 dark:text-white" 
                    required 
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Seleccionar Archivo</label>
                  <div className="relative group/file">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      required
                    />
                    <div className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-sm text-slate-500 flex items-center gap-3 group-hover/file:border-blue-400 group-hover/file:bg-blue-50/30 dark:group-hover/file:bg-blue-900/10 transition-all">
                      <Upload size={18} className="text-slate-400 group-hover/file:text-blue-500 transition-colors"/>
                      <span className="truncate font-medium">{docFile ? docFile.name : 'Arrastrar archivo o click para seleccionar'}</span>
                      {docFile && <span className="ml-auto text-[10px] text-slate-400">{(docFile.size / 1024).toFixed(0)} KB</span>}
                    </div>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={uploadingDoc} 
                  className="w-full md:w-auto bg-slate-900 dark:bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploadingDoc ? <Loader2 size={20} className="animate-spin"/> : <UploadCloud size={20}/>}
                  {uploadingDoc ? `Subiendo ${uploadProgress}%` : 'Adjuntar'}
                </button>
              </div>
              {uploadingDoc && (
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-blue-400" />
                <div>
                  <div className="font-black text-sm uppercase">{previewDoc.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{previewDoc.filename}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadDoc(previewDoc)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Descargar"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 overflow-auto flex items-center justify-center min-h-[400px]">
              {previewLoading ? (
                <Loader2 size={32} className="animate-spin text-slate-400" />
              ) : previewUrl ? (
                previewDoc.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                  <img src={previewUrl} alt={previewDoc.name} className="max-w-full max-h-full object-contain" />
                ) : previewDoc.filename.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={previewUrl} className="w-full h-full min-h-[600px] border-none" title={previewDoc.name} />
                ) : (
                  <div className="text-center p-10 text-slate-500">
                    <FileText size={48} className="mx-auto mb-3 text-slate-400" />
                    <p className="font-bold text-sm">Vista previa no disponible para este tipo de archivo.</p>
                    <button
                      onClick={() => downloadDoc(previewDoc)}
                      className="mt-4 px-6 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all inline-flex items-center gap-2"
                    >
                      <Download size={14} /> Descargar Archivo
                    </button>
                  </div>
                )
              ) : (
                <p className="text-slate-400 text-sm">No se pudo cargar la vista previa.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
DocsModule.displayName = 'DocsModule';
