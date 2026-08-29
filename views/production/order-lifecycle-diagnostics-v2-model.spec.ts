import { describe, expect, it } from 'vitest';

import {
  buildIssueGroups,
  buildLifecycleStages,
  summarizeRecords,
} from './order-lifecycle-diagnostics-v2-model';

describe('order lifecycle diagnostics v2 model', () => {
  it('builds workflow stages with blocked and waiting states', () => {
    const stages = buildLifecycleStages({
      diagnostics: [
        {
          code: 'PQC1_PUSHED_WITHOUT_INSTOCK_TASK',
          level: 'WARN',
          message: 'PQC1 已下推，但未找到生产入库确认池任务',
        },
      ],
      flowCards: [
        { flowStatus: 'COMPLETED', stepName: '粗加工', stepNo: 10 },
        { flowStatus: 'IN_PROGRESS', stepName: '精加工', stepNo: 20 },
      ],
      inspectionTasks: [{ erpPushStatus: 'PUSHED', taskStatus: 'COMPLETED' }],
      instockTasks: [],
      productReport: { rows: [{ erpReportBillNo: 'PRD_MORPT-001' }] },
      pqc1: { rows: [{ erpInspectionBillNo: 'PQC1-001', erpPushStatus: 'PUSHED' }] },
      summary: {
        completedFlowCount: 1,
        flowCount: 2,
        inspectionTaskCount: 1,
        instockTaskCount: 0,
        productReportBillCount: 1,
      },
    });

    expect(stages.map((stage) => stage.key)).toEqual([
      'order',
      'flow',
      'inspection',
      'productReport',
      'pqc1',
      'instock',
    ]);
    expect(stages.find((stage) => stage.key === 'pqc1')).toMatchObject({
      issueCount: 1,
      tone: 'warning',
    });
    expect(stages.find((stage) => stage.key === 'instock')).toMatchObject({
      done: 0,
      tone: 'info',
      total: 0,
    });
  });

  it('summarizes issue groups and record errors for the attention panel', () => {
    const data = {
      diagnostics: [
        { code: 'ORDER_COMPLETED_QTY_MISMATCH', level: 'WARN', message: '数量不一致' },
        { code: 'COMPLETED_FLOW_WITHOUT_WAGE', level: 'WARN', message: '缺少工资核算' },
      ],
      flowCards: [{ flowStatus: 'COMPLETED' }],
      inspectionTasks: [{ lastError: 'PQC1 timeout' }],
      instockTasks: [{ lastError: 'ERP save failed' }],
      wageSettlements: [{ failureReason: 'Production report rejected' }],
    };

    expect(buildIssueGroups(data)).toEqual([
      {
        count: 1,
        key: 'quantity',
        label: '数量一致性',
        level: 'WARN',
      },
      {
        count: 1,
        key: 'missing',
        label: '缺失记录',
        level: 'WARN',
      },
    ]);
    expect(summarizeRecords(data)).toMatchObject({
      errorRecords: 3,
      flowCount: 1,
      inspectionCount: 1,
      instockCount: 1,
      wageCount: 1,
    });
  });
});
