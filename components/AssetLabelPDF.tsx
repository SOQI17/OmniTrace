import React, { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Asset } from '../types';
import { Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface AssetLabelPDFProps {
  asset: Asset;
}

const formatWorkflow = (wf: string): string => {
  if (!wf) return '-';
  if (wf.toUpperCase().includes('PRESTAMO') || wf.toUpperCase().includes('LOAN')) return 'PRÉSTAMO';
  if (/^[A-Z]+-\d+/i.test(wf)) return wf.toUpperCase();
  return wf.toUpperCase();
};

const condicionColor = (cond: string): [number, number, number] => {
  const c = (cond || '').toLowerCase();
  if (c.includes('compra') || c.includes('purchase'))        return [16, 185, 129];
  if (c.includes('warranty') || c.includes('garantia') || c.includes('garantía')) return [139, 92, 246];
  if (c.includes('service') || c.includes('servicio') || c.includes('contrato'))  return [59, 130, 246];
  if (c.includes('loan') || c.includes('prestamo') || c.includes('préstamo'))     return [245, 158, 11];
  return [100, 116, 139];
};

export const AssetLabelPDF: React.FC<AssetLabelPDFProps> = ({ asset }) => {
  const qrRef = useRef<HTMLDivElement>(null);
  // Ref al canvas oculto de alta resolución
  const qrHiResRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    const W = 90, H = 50;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [H, W] });

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.rect(1, 1, W - 2, H - 2);

    // Franja superior
    doc.setFillColor(15, 23, 42);
    doc.rect(1, 1, W - 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('OMNITRACE', 3, 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4);
    doc.setTextColor(148, 163, 184);
    doc.text('Gestión de Activos Médicos', 3, 7.2);

    const lx = 3;

    // N° Parte grande
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const pn = asset.metadata.pn || '-';
    doc.text(pn, lx, 17);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(lx, 19, 58, 19);

    // Encabezados columnas
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('N° PARTE', lx, 22.5);
    doc.text('PO / WF', 25, 22.5);
    doc.text('ORDEN GE/FJ', 45, 22.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(15, 23, 42);

    const pnShort = pn.length > 10 ? pn.substring(0, 10) : pn;
    doc.text(pnShort, lx, 26.5);
    const wfShort = formatWorkflow(asset.metadata.workflow_id || '').substring(0, 10);
    doc.text(wfShort, 25, 26.5);
    const ge = asset.metadata.numero_orden_ge || '-';
    const geShort = ge.length > 10 ? ge.substring(0, 10) : ge;
    doc.text(geShort, 45, 26.5);

    // Serial GE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(100, 116, 139);
    doc.text('SERIAL GE', lx, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(15, 23, 42);
    const sn = (asset.metadata.serial_ge || 'PENDIENTE').toUpperCase();
    doc.text(sn.length > 16 ? sn.substring(0, 16) + '…' : sn, lx, 34);

    // Descripción
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4);
    doc.setTextColor(71, 85, 105);
    const desc = asset.metadata.description || '';
    doc.text(desc.length > 42 ? desc.substring(0, 42) + '…' : desc, lx, 38.5);

    // Badge condición
    const cond = (asset.metadata.condicion || 'N/A').toUpperCase();
    const [cr, cg, cb] = condicionColor(asset.metadata.condicion || '');
    const condWidth = Math.max(16, cond.length * 2.2 + 4);
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(lx, 41, condWidth, 5.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.text(cond, lx + condWidth / 2, 44.4, { align: 'center' });
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3.5);
    doc.text(`ID: ${asset.id.substring(0, 8)}`, lx + condWidth + 2, 44.4);

    // ── QR de alta resolución ──────────────────────────────────────────────
    // Usar el canvas oculto de 512px en vez del canvas visible de 80px
    const qrX = 60, qrY = 9, qrSize = 28;

    let qrDataUrl: string | null = null;

    // 1. Intentar canvas hi-res (512px)
    if (qrHiResRef.current) {
      const hiResCanvas = qrHiResRef.current.querySelector('canvas');
      if (hiResCanvas) {
        try { qrDataUrl = hiResCanvas.toDataURL('image/png'); } catch { /* ignore */ }
      }
    }
    // 2. Fallback al canvas visible (80px)
    if (!qrDataUrl && qrRef.current) {
      const visCanvas = qrRef.current.querySelector('canvas');
      if (visCanvas) {
        try { qrDataUrl = visCanvas.toDataURL('image/png'); } catch { /* ignore */ }
      }
    }

    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } else {
      doc.setFillColor(220, 220, 220);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(qrX - 0.5, qrY - 0.5, qrSize + 1, qrSize + 1);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3.5);
    doc.text('Escanear para trazabilidad', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

    doc.save(`ETIQUETA_${asset.metadata.pn}_${ge}.pdf`);
  };

  const qrPayload = asset.warehouse.qr_hash || asset.id;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Canvas visible (80px) para mostrar en UI */}
      <div
        ref={qrRef}
        className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={generatePDF}
        title="Click para imprimir etiqueta PDF"
      >
        <QRCodeCanvas value={qrPayload} size={80} level="H" includeMargin={false} />
      </div>

      {/* Canvas oculto de alta resolución (512px) — solo para el PDF */}
      <div ref={qrHiResRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <QRCodeCanvas value={qrPayload} size={512} level="H" includeMargin={false} />
      </div>

      <button
        onClick={generatePDF}
        className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-full"
      >
        <Printer size={12} />
        <span>Imprimir Etiqueta</span>
      </button>
    </div>
  );
};