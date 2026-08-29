import { describe, expect, it } from 'vitest';

import type { MaterialRequestTaskMaterialSummaryItem } from '#/api/production';

import {
  buildMaterialRequestSummaryKey,
  buildPickTaskPoolV2Model,
  getPickTaskActionState,
} from './pick-task-pool-v2-model';

describe('pick task pool v2 model', () => {

  it('keeps same material and stock separate by apply and warehouse type', () => {
    expect(buildMaterialRequestSummaryKey({
      applyType: 'PHYSICAL',
      defaultStockNumber: 'S01',
      materialCode: 'MAT-A',
      warehouseType: 'PHYSICAL',
    })).not.toBe(buildMaterialRequestSummaryKey({
      applyType: 'PHYSICAL',
      defaultStockNumber: 'S01',
      materialCode: 'MAT-A',
      warehouseType: 'WORKSHOP',
    }));
  });

  it('summarizes stage rail, issue groups, erp chains, and task actions', () => {
    const rows: MaterialRequestTaskMaterialSummaryItem[] = [
      {
        materialCode: 'MAT-A',
        materialName: 'Motor',
        totalReservedQty: 5,
        tasks: [
          {
            id: 1,
            orderNo: 'MO-001',
            moEntrySeq: 1,
            pbomEntryId: 10,
            materialCode: 'MAT-A',
            requestQty: 5,
            reservedQty: 5,
            taskStatus: 'APPLIED',
          },
        ],
      },
      {
        defaultStockNumber: 'S01',
        materialCode: 'MAT-B',
        materialName: 'Cover',
        totalReservedQty: 4,
        tasks: [
          {
            erpBillNo: 'PICK-001',
            erpBillStatus: 'REJECTED',
            failReason: 'ERP rejected',
            id: 2,
            orderNo: 'MO-002',
            moEntrySeq: 1,
            pbomEntryId: 20,
            materialCode: 'MAT-B',
            requestQty: 2,
            reservedQty: 2,
            taskStatus: 'PREPARING',
          },
          {
            erpBillNo: 'PICK-002',
            erpBillStatus: 'APPROVED',
            id: 3,
            orderNo: 'MO-003',
            moEntrySeq: 1,
            pbomEntryId: 30,
            materialCode: 'MAT-B',
            requestQty: 2,
            reservedQty: 2,
            taskStatus: 'APPROVED',
          },
        ],
      },
    ];

    const model = buildPickTaskPoolV2Model(rows);

    expect(model.summary).toMatchObject({
      blockedCount: 2,
      materialCount: 2,
      pendingQty: 9,
      taskCount: 3,
    });
    expect(model.stages.map((stage) => [stage.key, stage.total, stage.blocked])).toEqual([
      ['applied', 1, 0],
      ['prepare', 1, 0],
      ['issue', 0, 0],
      ['erp', 1, 1],
      ['done', 1, 0],
    ]);
    expect(model.issueGroups.map((issue) => [issue.key, issue.count])).toEqual([
      ['missingStock', 1],
      ['erpRejected', 1],
      ['errorRecord', 1],
    ]);
    expect(model.erpChains.map((chain) => [chain.taskId, chain.erpBillNo, chain.erpBillStatus])).toEqual([
      [2, 'PICK-001', 'REJECTED'],
      [3, 'PICK-002', 'APPROVED'],
    ]);

    expect(getPickTaskActionState(rows[0]!.tasks[0]!)).toMatchObject({
      canClose: true,
      canIssue: false,
      canPrepare: true,
      risk: 'normal',
    });
    expect(getPickTaskActionState(rows[1]!.tasks[0]!)).toMatchObject({
      canClose: true,
      canIssue: true,
      canSyncStatus: true,
      risk: 'danger',
    });
    expect(getPickTaskActionState(rows[1]!.tasks[1]!)).toMatchObject({
      canClose: false,
      canIssue: false,
      risk: 'stable',
    });
  });

  it('uses combined pick and feed demand quantity for material request summary rows', () => {
    const rows = [
      {
        defaultStockNumber: 'S01',
        materialCode: 'MAT-C',
        materialName: 'Frame',
        sourceTypes: ['PICK', 'FEED'],
        totalDemandQty: 13,
        tasks: [
          {
            id: 11,
            materialCode: 'MAT-C',
            moEntrySeq: 1,
            orderNo: 'MO-011',
            pbomEntryId: 110,
            requestQty: 7,
            reservedQty: 7,
            sourceType: 'PICK',
            taskStatus: 'APPLIED',
          },
          {
            id: 12,
            materialCode: 'MAT-C',
            moEntrySeq: 1,
            orderNo: 'MO-011',
            pbomEntryId: 111,
            requestQty: 5,
            sourceType: 'FEED',
            taskStatus: 'APPLIED',
          },
        ],
      },
    ] as unknown as MaterialRequestTaskMaterialSummaryItem[];

    const model = buildPickTaskPoolV2Model(rows);

    expect(model.summary.pendingQty).toBe(13);
    expect(model.summary.taskCount).toBe(2);
  });
});
