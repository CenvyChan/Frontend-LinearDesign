import { describe, expect, it } from 'vitest';

import type { ReturnTaskMaterialSummaryItem } from '#/api/production';

import {
  buildReturnTaskPoolV2Model,
  getReturnTaskActionState,
} from './return-task-pool-v2-model';

describe('return task pool v2 model', () => {
  it('derives return workflow health and inspection actions', () => {
    const rows: ReturnTaskMaterialSummaryItem[] = [
      {
        materialCode: 'RET-A',
        totalRequestQty: 3,
        tasks: [
          {
            id: 11,
            orderNo: 'MO-101',
            moEntrySeq: 1,
            pbomEntryId: 1,
            materialCode: 'RET-A',
            requestQty: 3,
            taskStatus: 'APPLIED',
          },
        ],
      },
      {
        materialCode: 'RET-B',
        totalRequestQty: 2,
        tasks: [
          {
            erpBillNo: 'RETURN-001',
            erpBillStatus: 'APPROVED',
            id: 12,
            inspectionStatus: 'PENDING_INSPECTION',
            orderNo: 'MO-102',
            moEntrySeq: 1,
            pbomEntryId: 2,
            materialCode: 'RET-B',
            requestQty: 2,
            sourceQrToken: 'QR-001',
            taskStatus: 'APPROVED',
          },
          {
            erpBillNo: 'RETURN-002',
            erpBillStatus: 'REJECTED',
            failReason: 'save failed',
            id: 13,
            orderNo: 'MO-103',
            moEntrySeq: 1,
            pbomEntryId: 3,
            materialCode: 'RET-B',
            requestQty: 1,
            sourceQrToken: 'QR-002',
            taskStatus: 'FAILED',
          },
        ],
      },
    ];

    const model = buildReturnTaskPoolV2Model(rows);

    expect(model.summary).toMatchObject({
      blockedCount: 2,
      inspectionPendingCount: 1,
      pendingQty: 5,
      taskCount: 3,
    });
    expect(model.stages.map((stage) => [stage.key, stage.total, stage.blocked])).toEqual([
      ['applied', 1, 0],
      ['preview', 0, 0],
      ['submit', 0, 0],
      ['erp', 1, 1],
      ['inspection', 1, 0],
      ['closed', 0, 0],
    ]);
    expect(model.issueGroups.map((issue) => [issue.key, issue.count])).toEqual([
      ['missingSourceQr', 1],
      ['pendingInspection', 1],
      ['erpRejected', 1],
      ['errorRecord', 1],
    ]);
    expect(model.erpChains.map((chain) => [chain.taskId, chain.erpBillNo, chain.inspectionStatus])).toEqual([
      [12, 'RETURN-001', 'PENDING_INSPECTION'],
      [13, 'RETURN-002', undefined],
    ]);

    expect(getReturnTaskActionState(rows[0]!.tasks[0]!)).toMatchObject({
      canPreview: true,
      canSubmit: true,
      risk: 'normal',
    });
    expect(getReturnTaskActionState(rows[1]!.tasks[0]!)).toMatchObject({
      canInspect: true,
      canSyncStatus: true,
      risk: 'warning',
    });
    expect(getReturnTaskActionState(rows[1]!.tasks[1]!)).toMatchObject({
      canPreview: true,
      canSubmit: true,
      risk: 'danger',
    });
  });
});
