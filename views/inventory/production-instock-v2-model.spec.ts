import { describe, expect, it } from 'vitest';

import type { ProductionInstockTask } from '#/api/productionInstock';

import {
  buildProductionInstockV2Model,
  getProductionInstockActionState,
} from './production-instock-v2-model';

describe('production instock v2 model', () => {
  it('summarizes instock lifecycle and action risk', () => {
    const tasks: ProductionInstockTask[] = [
      {
        id: 31,
        inspectionTaskId: 1,
        orderNo: 'MO-301',
        taskStatus: 'WAIT_ERP_AUDIT',
      },
      {
        erpInspectionBillNo: 'PQC1-001',
        erpInspectionStatus: 'APPROVED',
        erpReportBillNo: 'PRD_MORPT-001',
        erpReportStatus: 'APPROVED',
        id: 32,
        inspectionTaskId: 2,
        orderNo: 'MO-302',
        pendingQty: 3,
        taskStatus: 'PENDING_CONFIRM',
      },
      {
        erpInspectionBillNo: 'PQC1-002',
        erpInstockBillNo: 'INSTOCK-001',
        erpReportBillNo: 'PRD_MORPT-002',
        id: 33,
        inspectionTaskId: 3,
        lastError: 'ERP save failed',
        orderNo: 'MO-303',
        retryCount: 2,
        stockNumber: 'S03',
        taskStatus: 'ERP_FAILED',
      },
      {
        erpInstockBillNo: 'INSTOCK-002',
        id: 34,
        inspectionTaskId: 4,
        orderNo: 'MO-304',
        taskStatus: 'ERP_AUDITED',
      },
    ];

    const model = buildProductionInstockV2Model(tasks);

    expect(model.summary).toMatchObject({
      blockedCount: 2,
      pendingQty: 3,
      taskCount: 4,
    });
    expect(model.stages.map((stage) => [stage.key, stage.total, stage.blocked])).toEqual([
      ['waitAudit', 1, 0],
      ['pendingConfirm', 1, 1],
      ['confirming', 0, 0],
      ['erp', 1, 1],
      ['done', 1, 0],
    ]);
    expect(model.issueGroups.map((issue) => [issue.key, issue.count])).toEqual([
      ['missingStock', 1],
      ['erpFailed', 1],
      ['errorRecord', 1],
    ]);
    expect(model.erpChains.map((chain) => [chain.taskId, chain.productReportBillNo, chain.pqc1BillNo, chain.instockBillNo])).toEqual([
      [32, 'PRD_MORPT-001', 'PQC1-001', undefined],
      [33, 'PRD_MORPT-002', 'PQC1-002', 'INSTOCK-001'],
      [34, undefined, undefined, 'INSTOCK-002'],
    ]);

    expect(getProductionInstockActionState(tasks[1]!)).toMatchObject({
      canConfirm: true,
      canRefresh: true,
      canRetry: false,
      risk: 'warning',
    });
    expect(getProductionInstockActionState(tasks[2]!)).toMatchObject({
      canConfirm: false,
      canRetry: true,
      risk: 'danger',
    });
    expect(getProductionInstockActionState(tasks[3]!)).toMatchObject({
      canConfirm: false,
      canRetry: false,
      risk: 'stable',
    });
  });
});
