import { describe, expect, it } from 'vitest';

import type { ProductionReportTask } from '#/api/productionReportTask';

import {
  buildProductionReportTasksModel,
  formatProductionReportError,
  getProductionReportTaskActionState,
} from './production-report-tasks-model';

describe('production-report-tasks-model', () => {
  it('summarizes report states and keeps ERP evidence visible', () => {
    const rows: ProductionReportTask[] = [
      { id: 1, orderNo: 'MO-001', status: 'WAIT_CONFIRM' },
      {
        erpErrorCode: 4,
        erpErrorField: 'FUnqualifiedQty',
        erpErrorMessage: 'derived field cannot be assigned',
        id: 2,
        lastError: 'ERP rejected',
        rawErpResponse: '{"MsgCode":4}',
        orderNo: 'MO-002',
        status: 'PUSH_FAILED',
      },
      { erpDocumentStatus: 'C', id: 3, orderNo: 'MO-003', status: 'ERP_AUDITED' },
    ];

    const model = buildProductionReportTasksModel(rows);

    expect(model.pendingCount).toBe(1);
    expect(model.errorCount).toBe(1);
    expect(model.metrics.find((item) => item.label === '已审核')?.value).toBe(1);
    expect(formatProductionReportError(rows[1]!)).toContain('FUnqualifiedQty');
  });

  it('only exposes actions for the matching report status', () => {
    expect(getProductionReportTaskActionState({ id: 1, status: 'WAIT_CONFIRM' })).toMatchObject({
      canCancel: true,
      canConfirm: true,
      canRetry: false,
    });
    expect(getProductionReportTaskActionState({ id: 2, status: 'ERP_AUDITED' }).canCancel).toBe(false);
    expect(getProductionReportTaskActionState({ id: 3, status: 'PUSH_FAILED' }).canRetry).toBe(true);
  });
});
