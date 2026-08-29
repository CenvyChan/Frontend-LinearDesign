import { describe, expect, it } from 'vitest';

import type { ProcessStepPrice, ProcessWageSettlement } from '#/api/processWage';

import {
  buildProcessWageV2Model,
  getProcessWageV2ActionState,
} from './process-wage-v2-model';

describe('process-wage-v2-model', () => {
  it('summarizes wage workflow and price coverage risks', () => {
    const settlements: ProcessWageSettlement[] = [
      {
        calcStatus: 'SUBMITTED',
        flowId: 10,
        id: 1,
        orderId: 1,
        orderNo: 'MO-001',
        wageAmount: 120,
      },
      {
        calcStatus: 'ERP_FAILED',
        canPushErp: true,
        failureReason: 'ERP error',
        flowId: 11,
        id: 2,
        lastProductionStep: true,
        orderId: 2,
        orderNo: 'MO-002',
      },
      {
        calcStatus: 'FAILED',
        flowId: 12,
        id: 3,
        orderId: 3,
        orderNo: 'MO-003',
      },
    ];
    const prices: ProcessStepPrice[] = [
      { priceType: 'PIECE', processCode: 'P10', processName: 'Cut', status: 'ACTIVE' },
    ];

    const model = buildProcessWageV2Model(settlements, prices);

    expect(model.summary.workflowTotal).toBe(3);
    expect(model.summary.erpFailed).toBe(1);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'calcFailed',
      'erpFailed',
      'missingPrice',
    ]);
    expect(getProcessWageV2ActionState(settlements[1]!).canPushErp).toBe(true);
  });
});
