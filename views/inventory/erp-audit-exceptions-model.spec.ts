import { describe, expect, it } from 'vitest';

import type { ErpAuditException } from '#/api/inventory';

import {
  buildAuditExceptionMetrics,
  canRecheckAuditException,
  getAuditExceptionActionOptions,
} from './erp-audit-exceptions-model';

describe('erp audit exceptions model', () => {
  it('builds status metrics for open and resolved vouchers', () => {
    const metrics = buildAuditExceptionMetrics([
      voucher('ERP_CHANGED', 'OPEN'),
      voucher('ERP_REJECTED', 'OPEN'),
      voucher('ERP_CHANGED', 'RESOLVED'),
    ]);

    expect(metrics).toMatchObject({
      open: 2,
      resolved: 1,
      total: 3,
      highRisk: 1,
    });
  });

  it('offers release reservation only for vouchers linked to WMS tasks', () => {
    expect(getAuditExceptionActionOptions(voucher('ERP_CHANGED', 'OPEN', { wmsTaskId: 99 }), [
      'inventory:erp-audit-exception:handle',
      'inventory:erp-audit-exception:release',
    ]))
      .toContainEqual(expect.objectContaining({ value: 'RELEASE_RESERVATION' }));
    expect(getAuditExceptionActionOptions(voucher('ERP_CHANGED', 'OPEN'), [
      'inventory:erp-audit-exception:handle',
      'inventory:erp-audit-exception:release',
    ]))
      .not.toContainEqual(expect.objectContaining({ value: 'RELEASE_RESERVATION' }));
  });

  it('hides every handle action from view-only users', () => {
    expect(getAuditExceptionActionOptions(voucher('ERP_CHANGED', 'OPEN'), [
      'inventory:erp-audit-exception:view',
    ])).toEqual([]);
  });

  it('uses a separate permission for ERP recheck', () => {
    expect(canRecheckAuditException([
      'inventory:erp-audit-exception:recheck',
    ])).toBe(true);
    expect(canRecheckAuditException([
      'inventory:erp-audit-exception:handle',
    ])).toBe(false);
  });

  it('shows only the separately granted high-risk action', () => {
    expect(getAuditExceptionActionOptions(voucher('ERP_CHANGED', 'OPEN', { wmsTaskId: 99 }), [
      'inventory:erp-audit-exception:release',
    ])).toEqual([
      expect.objectContaining({ value: 'RELEASE_RESERVATION' }),
    ]);
    expect(getAuditExceptionActionOptions(voucher('ERP_CHANGED', 'OPEN'), [
      'inventory:erp-audit-exception:ignore',
    ])).toEqual([
      expect.objectContaining({ value: 'IGNORE' }),
    ]);
  });

  function voucher(
    exceptionType: ErpAuditException['exceptionType'],
    exceptionStatus: ErpAuditException['exceptionStatus'],
    patch: Partial<ErpAuditException> = {},
  ): ErpAuditException {
    return {
      billId: '1001',
      billNo: 'ERP-001',
      erpAcctCode: 'A',
      exceptionNo: `${exceptionType}-001`,
      exceptionStatus,
      exceptionType,
      formId: 'PRD_PickMtrl',
      ...patch,
    };
  }
});
