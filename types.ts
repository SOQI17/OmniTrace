
export enum AssetStatus {
  DRAFT = 'SOLICITADO', // Mapped from 'SOLICITADO'
  ORDERED = 'ORDERED',
  IN_TRANSIT = 'IN_TRANSIT',
  CUSTOMS = 'CUSTOMS',
  RECEIVED_WH = 'RECEIVED_WH',
  QUALITY_CHECK = 'QUALITY_CHECK',
  DISPATCHED = 'DISPATCHED'
}

export enum AssetCondition {
  PURCHASE = 'COMPRA',
  SERVICE_CONTRACT = 'CONTRATO_SERVICIO',
  WARRANTY = 'GARANTIA',
  DOA = 'DOA',
  FOI = 'FOI'
}

export interface SupplierInvoice {
  proveedor: string;
  no_factura: string;
  monto?: number;
}

export interface ImportItem {
  id: string; // Para manejo de UI
  no_factura: string;
  item_number: string;
  descripcion: string;
  cantidad: number;
  precio_uni: number;
  cif_unitario: number; // Valor en aduana (CIF) ingresado manualmente
  aplica_arancel: boolean; // Checkbox para calcular 5%
}

export interface ImportationCosts {
  // Cabecera / Identificadores
  fecha_llegada_almacen: string;
  no_liquidacion: string;
  no_dai: string;

  // Gastos Locales (Necesarios para el prorrateo)
  manejo_carga: number;
  costo_cc: number;
  almacenaje: number;
  asesoria_gestion_riesgo: number;
  transporte_local: number;
  agenciamiento_aduana: number;
  total_gastos_locales: number;

  // Matriz de Items (Nuevo Excel)
  items: ImportItem[];

  // Facturas Proveedores
  facturas_proveedores: SupplierInvoice[];
}

export interface AssetMetadata {
  pn: string; // numero_parte
  description: string; // descripcion
  serial_ge: string;
  workflow_id: string; // workflow_id
  cost: number; // valor_unitario (Base)
  
  // New Fields
  provider: string; // Proveedor (ej. GE, SIEMENS)
  cliente_final: string;
  equipo_destino: string;
  condicion: AssetCondition; // Usado como Tipo de Importacion
  numero_orden_ge: string; // Usado como No Pedido
  cantidad: number;
  fecha_solicitud: string;

  // Cost breakdown (Final structure matching Excel)
  cost_breakdown?: ImportationCosts;
}

export interface ImportationDocuments {
  factura_comercial?: string; // Filename/URL
  packing_list?: string;
  documento_transporte?: string; // AWB / BL
  certificado_origen?: string;
}

// Nueva interfaz para documentos flexibles
export interface StoredDocument {
    id: string;
    name: string; // Nombre asignado por el usuario (ej. "Retención IVA")
    filename: string; // Nombre real del archivo
    uploaded_by: string;
    date: string;
    url?: string; // En un app real, aquí iría el downloadURL de Firebase Storage
}

export interface AssetLogistics {
  tracking_number?: string;
  courier?: string;
  consolidation_id?: string; // ID compartido para pedidos consolidados
  import_docs_url?: string[]; // Legacy array
  documents?: ImportationDocuments; // Estructura fija legacy
  extra_docs?: StoredDocument[]; // Nueva lista flexible
  importacion_procesada?: boolean;
  solicitado_proveedor?: boolean; // Nuevo campo para gestión de retornos
}

export interface AssetWarehouse {
  aisle?: string; // ubicacion_bodega part 1
  bin?: string; // ubicacion_bodega part 2
  qr_hash?: string;
  url_foto_paquete?: string;
  responsable_egreso?: string;
  destino_final?: string; // Nuevo campo
  motivo_salida?: string; // Nuevo campo
  ubicacion_retorno?: string; // Nuevo campo para ubicación específica en retornos
}

export interface Asset {
  id: string;
  current_status: AssetStatus;
  metadata: AssetMetadata;
  logistics: AssetLogistics;
  warehouse: AssetWarehouse;
  lifecycle_lock: boolean;
}

export interface AuditLogEntry {
  id: string; // Internal ID for the log entry
  asset_id: string;
  actor_id: string;
  action: 'STATUS_CHANGE' | 'UPDATE_FIELD' | 'UPLOAD_DOC' | 'CREATE' | 'EXPORT_DATA';
  prev_value: Partial<Asset> | any;
  new_value: Partial<Asset> | any;
  timestamp: string; // ISO String
}

export type UserRole = 'REQUESTER' | 'IMPORTER' | 'WAREHOUSE' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

// Mermaid Diagram Source for documentation
export const CLASS_DIAGRAM_MERMAID = `
classDiagram
    class Asset {
        +UUID id
        +AssetStatus current_status
        +AssetMetadata metadata
        +AssetLogistics logistics
        +AssetWarehouse warehouse
        +Boolean lifecycle_lock
    }
    class User {
        +String id
        +Enum role (REQUESTER, IMPORTER, WAREHOUSE, ADMIN)
    }
    Asset "1" *-- "1" AssetMetadata
    Asset "1" *-- "1" AssetLogistics
    Asset "1" *-- "1" AssetWarehouse
    Asset "1" -- "0..*" AuditLog : history
`;

// ─── MÓDULO REPUESTOS — Base Instalada ───────────────────────────────────────

export interface SparePart {
  id: string;

  // Identificación del repuesto
  pn: string;                    // Part Number
  descripcion: string;
  cantidad: number;

  // Destino
  cliente: string;               // CLIENTE
  mod: string;                   // MOD (MR, CT, XR, Surgery, etc.)
  equipo: string;                // Equipo / modelo (Signa Creator, D387T, etc.)

  // Pedido
  workflow_id: string;           // WF
  orden_ge: string;              // ORDEN (número de orden GE)
  condicion: string;             // Compra, Garantía, DOA, FOI, etc.
  precio?: number;               // Precio extraído (ej: 13887.20 de CONTRATO SERVICIO 13887,20$)
  observacion: string;           // OBSERVACION

  // Fechas
  mes: string;                   // MES (Julio, Agosto, etc.)
  anio: number;                  // Año
  fecha_pedido: string;          // Fecha pedido
  fecha_llegada: string;         // Fecha llegada
  fecha_despacho: string;        // Fecha Despacho Instalada
  fecha_egreso: string;          // Egreso
  fecha_instalacion: string;     // Fecha de instalación
  fecha_llegada_tentativa: string; // Fecha Llegada tentativa

  // Trazabilidad
  asset_id?: string;             // Vinculado a un Asset de OmniTrace si aplica
  created_by: string;
  created_at: string;
  source: 'CSV_IMPORT' | 'SOLICITUD' | 'MANUAL'; // Origen del registro
}