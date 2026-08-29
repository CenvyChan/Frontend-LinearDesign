import type { ErpAuditException } from '#/api/inventory';

export interface AuditExceptionActionOption {
  label: string;
  risk: 'danger' | 'normal' | 'warning';
  value: string;
}

export interface AuditExceptionMetrics {
  highRisk: number;
  open: number;
  resolved: number;
  total: number;
}

export const ERP_AUDIT_EXCEPTION_HANDLE_PERMISSION = 'inventory:erp-audit-exception:handle';
export const ERP_AUDIT_EXCEPTION_IGNORE_PERMISSION = 'inventory:erp-audit-exception:ignore';
export const ERP_AUDIT_EXCEPTION_RECHECK_PERMISSION = 'inventory:erp-audit-exception:recheck';
export const ERP_AUDIT_EXCEPTION_RELEASE_PERMISSION = 'inventory:erp-audit-exception:release';

const HIGH_RISK_TYPES = new Set<ErpAuditException['exceptionType']>([
  'ERP_CHANGED',
  'ERP_DELETED_OR_MISSING',
  'ERP_REOPENED_OR_UNAUDITED',
  'ERP_POLL_TIMEOUT_PERMANENT',
]);

export function buildAuditExceptionMetrics(rows: ErpAuditException[]): AuditExceptionMetrics {
  return {
    highRisk: rows.filter((row) => row.exceptionStatus === 'OPEN' && HIGH_RISK_TYPES.has(row.exceptionType)).length,
    open: rows.filter((row) => row.exceptionStatus === 'OPEN').length,
    resolved: rows.filter((row) => row.exceptionStatus === 'RESOLVED').length,
    total: rows.length,
  };
}

export function canHandleAuditException(accessCodes: string[]) {
  return accessCodes.includes('*')
    || accessCodes.includes(ERP_AUDIT_EXCEPTION_HANDLE_PERMISSION)
    || accessCodes.includes(ERP_AUDIT_EXCEPTION_IGNORE_PERMISSION)
    || accessCodes.includes(ERP_AUDIT_EXCEPTION_RELEASE_PERMISSION);
}

export function canRecheckAuditException(accessCodes: string[]) {
  return accessCodes.includes('*') || accessCodes.includes(ERP_AUDIT_EXCEPTION_RECHECK_PERMISSION);
}

export function getAuditExceptionActionOptions(
  row: ErpAuditException,
  accessCodes: string[] = [],
): AuditExceptionActionOption[] {
  const options: AuditExceptionActionOption[] = [];

  if (accessCodes.includes('*') || accessCodes.includes(ERP_AUDIT_EXCEPTION_HANDLE_PERMISSION)) {
    options.push(
      { label: '稍后重试', risk: 'warning', value: 'RETRY' },
      { label: 'ERP 侧改单', risk: 'warning', value: 'CHANGE_ERP_BILL' },
    );
  }

  if (accessCodes.includes('*') || accessCodes.includes(ERP_AUDIT_EXCEPTION_IGNORE_PERMISSION)) {
    options.push({ label: '记录已处理', risk: 'normal', value: 'IGNORE' });
  }

  if (row.wmsTaskId && (accessCodes.includes('*') || accessCodes.includes(ERP_AUDIT_EXCEPTION_RELEASE_PERMISSION))) {
    options.push({
      label: '释放 WMS 预占',
      risk: 'danger',
      value: 'RELEASE_RESERVATION',
    });
  }

  return options;
}

export function getExceptionTypeTone(type: ErpAuditException['exceptionType']) {
  return HIGH_RISK_TYPES.has(type) ? 'danger' : 'warning';
}

export function getStatusTone(status: ErpAuditException['exceptionStatus']) {
  if (status === 'RESOLVED') return 'success';
  if (status === 'IGNORED') return 'info';
  if (status === 'PROCESSING') return 'warning';
  return 'danger';
}
