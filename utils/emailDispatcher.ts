export const PAUL_OROZCO_EMAIL = 'paul.orozco@orimec.com.ec';
export const DEFAULT_EMAIL_GREETING = 'Hola Paul por favor traer lo mas pronto.';

export interface EmailSparePartItem {
  pn: string;
  descripcion: string;
  cliente?: string;
  mod?: string;
  equipo?: string;
  cantidad: number;
  condicion?: string;
  precio?: number;
  orden_ge?: string;
}

export const formatCurrency = (amount?: number): string => {
  if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) return '—';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Genera una tabla HTML con estilos inline optimizada para Outlook Desktop, Outlook Web y Gmail.
 */
export const generateEmailHtmlTable = (items: EmailSparePartItem[]): string => {
  const rowsHtml = items.map(item => {
    const cleanMod = item.mod || '—';
    const cleanCond = item.condicion ? item.condicion.toUpperCase() : '—';
    const formattedPrice = formatCurrency(item.precio);

    return `
      <tr style="border-bottom: 1px solid #cbd5e1; font-size: 13px;">
        <td style="padding: 10px 12px; font-weight: bold; font-family: Consolas, monospace, sans-serif; color: #0f172a; white-space: nowrap;">${item.pn || '—'}</td>
        <td style="padding: 10px 12px; color: #334155;">${item.descripcion || '—'}</td>
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 500;">${item.cliente || '—'}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="display: inline-block; background-color: #334155; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: Consolas, monospace;">${cleanMod}</span>
        </td>
        <td style="padding: 10px 12px; color: #475569;">${item.equipo || '—'}</td>
        <td style="padding: 10px 12px; text-align: center; font-weight: bold; color: #0f172a;">${item.cantidad ?? 1}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">${cleanCond}</span>
        </td>
        <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #059669; white-space: nowrap;">${formattedPrice}</td>
        <td style="padding: 10px 12px; text-align: center; font-weight: bold; font-family: Consolas, monospace; color: #334155;">${item.orden_ge || '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <table style="border-collapse: collapse; width: 100%; max-width: 900px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 16px 0; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
          <th style="padding: 12px; text-align: left;">P/N</th>
          <th style="padding: 12px; text-align: left;">Descripción</th>
          <th style="padding: 12px; text-align: left;">Cliente</th>
          <th style="padding: 12px; text-align: center;">MOD</th>
          <th style="padding: 12px; text-align: left;">Equipo</th>
          <th style="padding: 12px; text-align: center;">Cant.</th>
          <th style="padding: 12px; text-align: center;">Condición</th>
          <th style="padding: 12px; text-align: right;">Precio (USD)</th>
          <th style="padding: 12px; text-align: center;">Orden GE</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `.trim();
};

/**
 * Genera el cuerpo de texto plano para compatibilidad con esquemas mailto: y clientes que no aceptan HTML directo en URL.
 */
export const generateEmailPlainText = (
  items: EmailSparePartItem[],
  greeting: string = DEFAULT_EMAIL_GREETING,
  senderName?: string
): string => {
  const partsList = items.map((item, idx) => {
    const lines = [
      `[Repuesto ${items.length > 1 ? `#${idx + 1}` : ''}]`,
      `• P/N: ${item.pn}`,
      `• Descripción: ${item.descripcion}`,
      `• Cliente: ${item.cliente || 'No especificado'}`,
      `• MOD: ${item.mod || '—'}`,
      `• Equipo: ${item.equipo || '—'}`,
      `• Cantidad: ${item.cantidad ?? 1}`,
      `• Condición: ${item.condicion || '—'}`,
      `• Precio: ${formatCurrency(item.precio)}`,
      `• Orden GE: ${item.orden_ge || '—'}`
    ];
    return lines.join('\n');
  }).join('\n\n');

  const senderFooter = senderName ? `\n\nSaludos cordiales,\n${senderName}\nORIMEC C.A.` : '\n\nSaludos cordiales,\nORIMEC C.A.';

  return `${greeting}\n\n${partsList}${senderFooter}`;
};

/**
 * Copia la tabla en formato enriquecido (HTML) y texto plano al portapapeles.
 * Al pegar con Ctrl + V dentro de Outlook, se pegará como una tabla formateada idéntica a la vista en OmniTrace.
 */
export const copyEmailTableToClipboard = async (
  items: EmailSparePartItem[],
  greeting: string = DEFAULT_EMAIL_GREETING,
  senderName?: string
): Promise<boolean> => {
  const htmlContent = `
    <div>
      <p style="font-family: Arial, sans-serif; font-size: 14px; margin-bottom: 12px;">${greeting}</p>
      ${generateEmailHtmlTable(items)}
      ${senderName ? `<p style="font-family: Arial, sans-serif; font-size: 13px; color: #475569; margin-top: 16px;">Saludos cordiales,<br><strong>${senderName}</strong><br>ORIMEC C.A.</p>` : ''}
    </div>
  `.trim();

  const plainText = generateEmailPlainText(items, greeting, senderName);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && (window as any).ClipboardItem) {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const item = new (window as any).ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem HTML copy failed, falling back to writeText:', err);
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.error('All clipboard operations failed:', err);
  }

  return false;
};

/**
 * Abre el cliente de correo predeterminado (Outlook, Mail, etc.) o la web de Outlook de Microsoft 365.
 */
export const openEmailCompose = (options: {
  to?: string;
  cc?: string;
  subject: string;
  body: string;
  mode?: 'mailto' | 'outlook-web';
}) => {
  const { to = PAUL_OROZCO_EMAIL, cc = '', subject, body, mode = 'mailto' } = options;

  if (mode === 'outlook-web') {
    const params = new URLSearchParams();
    if (to) params.set('to', to);
    if (cc) params.set('cc', cc);
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);

    const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
    window.open(outlookWebUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Modo mailto estándar
  const params: string[] = [];
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);

  const queryString = params.length > 0 ? `?${params.join('&')}` : '';
  const mailtoUrl = `mailto:${encodeURIComponent(to)}${queryString}`;

  const link = document.createElement('a');
  link.href = mailtoUrl;
  link.target = '_self';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
