import { describe, expect, it } from 'vitest';

import type { FeedTaskMaterialSummaryItem } from '#/api/production';

import {
  buildFeedTaskPoolV2Model,
  getFeedTaskActionState,
} from './feed-task-pool-v2-model';

describe('feed task pool v2 model', () => {
  it('captures feed preparation, erp status, risk, and actions', () => {
    const rows: FeedTaskMaterialSummaryItem[] = [
      {
        materialCode: 'FEED-A',
        totalRequestQty: 6,
        tasks: [
          {
            id: 21,
            orderNo: 'MO-201',
            moEntrySeq: 1,
            pbomEntryId: 1,
            materialCode: 'FEED-A',
            requestQty: 6,
            taskStatus: 'APPLIED',
          },
        ],
      },
      {
        defaultStockNumber: 'S02',
        materialCode: 'FEED-B',
        totalRequestQty: 2,
        tasks: [
          {
            erpBillId: 100,
            erpBillNo: 'FEED-001',
            erpBillStatus: 'SUBMITTED',
            id: 22,
            orderNo: 'MO-202',
            moEntrySeq: 1,
            pbomEntryId: 2,
            materialCode: 'FEED-B',
            requestQty: 2,
            taskStatus: 'PREPARED',
          },
          {
            erpBillNo: 'FEED-002',
            erpBillStatus: 'REJECTED',
            failReason: 'erp validation failed',
            id: 23,
            orderNo: 'MO-203',
            moEntrySeq: 1,
            pbomEntryId: 3,
            materialCode: 'FEED-B',
            requestQty: 1,
            taskStatus: 'FAILED',
          },
        ],
      },
    ];

    const model = buildFeedTaskPoolV2Model(rows);

    expect(model.summary).toMatchObject({
      blockedCount: 2,
      materialCount: 2,
      pendingQty: 8,
      taskCount: 3,
    });
    expect(model.stages.map((stage) => [stage.key, stage.total, stage.blocked])).toEqual([
      ['applied', 1, 0],
      ['prepare', 1, 0],
      ['preview', 0, 0],
      ['erp', 1, 1],
      ['done', 0, 0],
    ]);
    expect(model.issueGroups.map((issue) => [issue.key, issue.count])).toEqual([
      ['missingStock', 1],
      ['erpRejected', 1],
      ['errorRecord', 1],
    ]);
    expect(model.erpChains.map((chain) => [chain.taskId, chain.erpBillNo, chain.erpBillStatus])).toEqual([
      [22, 'FEED-001', 'SUBMITTED'],
      [23, 'FEED-002', 'REJECTED'],
    ]);

    expect(getFeedTaskActionState(rows[0]!.tasks[0]!)).toMatchObject({
      canPrepare: true,
      canPreview: false,
      risk: 'normal',
    });
    expect(getFeedTaskActionState(rows[1]!.tasks[0]!)).toMatchObject({
      canDirectSave: true,
      canRollback: true,
      canSubmit: true,
      risk: 'warning',
    });
    expect(getFeedTaskActionState(rows[1]!.tasks[1]!)).toMatchObject({
      canPreview: true,
      risk: 'danger',
    });
  });
});
