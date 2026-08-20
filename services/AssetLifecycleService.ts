
import { Asset, AssetStatus, AuditLogEntry, User } from '../types';

/**
 * Service responsible for enforcing business rules, state transitions,
 * and generating the audit trail.
 */
export class AssetLifecycleService {
  
  /**
   * Validates and prepares a status transition.
   */
  static transitionStatus(
    asset: Asset,
    newStatus: AssetStatus,
    actor: User,
    additionalData?: any
  ): { updatedAsset: Asset; auditLog: AuditLogEntry } {
    
    // Permission Check for Transitions
    if (actor.role === 'REQUESTER') {
        throw new Error("ACCESO DENEGADO: El Rol 'Solicitante' no puede cambiar estados de flujo.");
    }
    if (newStatus === AssetStatus.RECEIVED_WH || newStatus === AssetStatus.DISPATCHED) {
        if (actor.role !== 'WAREHOUSE' && actor.role !== 'ADMIN') {
            throw new Error("ACCESO DENEGADO: Solo 'Bodega' o 'Admin' pueden recibir/despachar.");
        }
    }

    // 1. Check Locks
    if (asset.lifecycle_lock && actor.role !== 'ADMIN') {
      throw new Error(`El activo ${asset.id} está bloqueado por otro proceso.`);
    }

    // 2. Validate Transitions (Strict State Machine)
    const validTransitions: Record<AssetStatus, AssetStatus[]> = {
      [AssetStatus.DRAFT]: [AssetStatus.ORDERED],
      [AssetStatus.ORDERED]: [AssetStatus.IN_TRANSIT],
      [AssetStatus.IN_TRANSIT]: [AssetStatus.CUSTOMS, AssetStatus.RECEIVED_WH],
      [AssetStatus.CUSTOMS]: [AssetStatus.RECEIVED_WH],
      [AssetStatus.RECEIVED_WH]: [AssetStatus.QUALITY_CHECK, AssetStatus.DISPATCHED], // CHANGE: Added DISPATCHED to allow direct exit
      [AssetStatus.QUALITY_CHECK]: [AssetStatus.RECEIVED_WH, AssetStatus.DISPATCHED], 
      [AssetStatus.DISPATCHED]: [] // Terminal state
    };

    if (!validTransitions[asset.current_status].includes(newStatus)) {
      throw new Error(`Transición inválida de ${asset.current_status} a ${newStatus}`);
    }

    // 3. Enforce Business Rules
    
    // Rule: Cannot go to RECEIVED_WH if tracking_number is missing
    if (newStatus === AssetStatus.RECEIVED_WH) {
      if (!asset.logistics.tracking_number) {
        throw new Error("BLOQUEO: Se requiere Número de Tracking antes de la Recepción en Bodega.");
      }
    }

    // Rule: Cannot go to DISPATCHED if qr_hash is missing
    if (newStatus === AssetStatus.DISPATCHED) {
      if (!asset.warehouse.qr_hash) {
        throw new Error("BLOQUEO: Debe generar el Hash QR antes del Despacho.");
      }
    }

    // 4. Prepare New State
    const updatedAsset = { ...asset, current_status: newStatus };
    
    // Apply additional data if provided during transition
    if (additionalData) {
        if(additionalData.warehouse) {
            updatedAsset.warehouse = { ...updatedAsset.warehouse, ...additionalData.warehouse };
        }
        if(additionalData.logistics) {
            updatedAsset.logistics = { ...updatedAsset.logistics, ...additionalData.logistics };
        }
    }

    // 5. Generate Audit Log (Immutable append-only record)
    const auditLog: AuditLogEntry = {
      id: crypto.randomUUID(),
      asset_id: asset.id,
      actor_id: actor.id,
      action: 'STATUS_CHANGE',
      prev_value: { current_status: asset.current_status },
      new_value: { current_status: newStatus },
      timestamp: new Date().toISOString()
    };

    return { updatedAsset, auditLog };
  }

  /**
   * Updates fields without changing status, still strictly audited.
   */
  static updateField(
    asset: Asset,
    fieldGroup: 'metadata' | 'logistics' | 'warehouse',
    data: any,
    actor: User
  ): { updatedAsset: Asset; auditLog: AuditLogEntry } {
    
    // Permission Checks
    if (actor.role !== 'ADMIN') {
        if (fieldGroup === 'logistics' && actor.role !== 'IMPORTER') {
             throw new Error("ACCESO DENEGADO: Solo 'Importaciones' puede editar logística.");
        }
        if (fieldGroup === 'warehouse' && actor.role !== 'WAREHOUSE') {
             throw new Error("ACCESO DENEGADO: Solo 'Bodega' puede editar datos físicos.");
        }
    }

    const prevValue = { [fieldGroup]: asset[fieldGroup] };
    
    const updatedAsset = {
        ...asset,
        [fieldGroup]: { ...asset[fieldGroup], ...data }
    };

    const auditLog: AuditLogEntry = {
        id: crypto.randomUUID(),
        asset_id: asset.id,
        actor_id: actor.id,
        action: 'UPDATE_FIELD',
        prev_value: prevValue,
        new_value: { [fieldGroup]: data },
        timestamp: new Date().toISOString()
    };

    return { updatedAsset, auditLog };
  }

  /**
   * Simulates the Import Module file renaming logic.
   * Pattern: WFLOW_{workflow_id}_TRACKING_{tracking}.pdf
   */
  static generateImportFilename(workflowId: string, trackingNumber: string): string {
    const cleanTracking = trackingNumber.replace(/[^a-zA-Z0-9]/g, '');
    return `WFLOW_${workflowId}_TRACKING_${cleanTracking}.pdf`;
  }

  /**
   * Generates the Minified JSON for the QR code.
   */
  static generateQRPayload(asset: Asset): string {
    return JSON.stringify({
        id: asset.id,
        pn: asset.metadata.pn
    });
  }
}
