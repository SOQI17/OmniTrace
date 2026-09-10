// Shared helper utilities for OmniTrace

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Previene ataques de Formula Injection (CSV/Excel Injection).
 * Si un valor de texto inicia con =, +, -, @, \t o \r, se antepone una comilla simple (')
 */
export function sanitizeCell(value: any): any {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return value;
}

export function sanitizeRow<T extends Record<string, any>>(row: T): T {
  const clean = {} as T;
  for (const key of Object.keys(row) as (keyof T)[]) {
    clean[key] = sanitizeCell(row[key]);
  }
  return clean;
}

export function normalizeSparePartCondition(cond: string | undefined | null, precio?: number): string {
  const str = (cond || '').trim();
  const lower = str.toLowerCase();

  // 1. Contrato de servicios (cualquier variación que mencione contrato o CS)
  if (/contrato|service\s*contract|\bcs\b/i.test(lower)) {
    return 'CONTRATO DE SERVICIOS';
  }

  // 2. Garantías (garantía, garantía extendida, warranty, wty)
  if (/garant[ií]a|warranty|\bwty\b/i.test(lower)) {
    return 'GARANTÍAS';
  }

  // 3. DOA / FOA / FOI (Dead on Arrival, FOA)
  if (/\b(doa|foa|foi)\b/i.test(lower)) {
    return 'DOA';
  }

  // 4. Wrong shipment (wrong shipment, wrong shippment)
  if (/wrong\s*ship+ment/i.test(lower)) {
    return 'WRONG SHIPMENT';
  }

  // 5. Concesión comercial (concesion comercial, conseción comercial, concession)
  if (/con[sc]e[cs]i[oó]n|concession/i.test(lower)) {
    return 'CONCESIÓN COMERCIAL';
  }

  // 6. Ventas / Compra / With payment / Payment / Símbolo de dólar ($) o USD
  if (/ventas?|compras?|purchase|sales?|with\s*payment|payment|\$|\busd\b/i.test(lower)) {
    return 'VENTAS';
  }

  // 7. Si el texto de la condición contiene $ o es puramente un precio (ej: "$", "5233.06", "13887,20$", "$450")
  if (str.includes('$')) {
    return 'VENTAS';
  }
  const isOnlyPriceString = /^[\$€£]?\s*\d+(?:[.,]\d{1,2})?\s*(?:usd|\$)?$/i.test(str.replace(/\s+/g, ''));
  if (isOnlyPriceString) {
    return 'VENTAS';
  }

  if (precio !== undefined && precio > 0 && (!str || str === '—' || str === '-' || str === 'MANUAL')) {
    return 'VENTAS';
  }

  if (!str || str === '—' || str === '-') {
    return precio !== undefined && precio > 0 ? 'VENTAS' : '—';
  }

  return str.toUpperCase();
}

export const formatSparePartDisplayDate = (val: any): string => {
  if (!val && val !== 0) return '—';
  const num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 80000 && !String(val).includes('/') && !String(val).includes('-')) {
    const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }
  }
  const str = String(val).trim();
  if (!str) return '—';
  const sep = str.includes('/') ? '/' : str.includes('-') ? '-' : null;
  if (sep) {
    const p = str.split('T')[0].split(sep);
    if (p.length === 3) {
      const p0 = p[0].trim();
      const p1 = p[1].trim();
      const p2 = p[2].trim();
      if (p0.length === 4 || (Number(p0) > 31 && Number(p0) < 2100)) {
        const y = p0.length === 2 ? `20${p0}` : p0;
        return `${p2.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
      }
      let y = p2;
      if (y.length === 2) y = `20${y}`;
      return `${p0.padStart(2, '0')}/${p1.padStart(2, '0')}/${y}`;
    }
  }
  return str;
};
