import { describe, expect, it } from 'vitest';

import type { ProcessInspectionTask } from '#/api/inspectionTask';

import {
  buildProductInboundInspectionRequest,
  buildInspectionTasksV2Model,
  getInspectionTaskV2ActionState,
  normalizeInspectionErpPushStatus,
  validateProductInboundInspectionQuantities,
} from './inspection-tasks-v2-model';

describe('inspection-tasks-v2-model', () => {
  it('groups task state, ERP blockers, and action availability', () => {
    const rows: ProcessInspectionTask[] = [
      {
        erpPushStatus: 'READY_TO_PUSH',
        id: 1,
        inspectionType: 'PQC',
        orderNo: 'MO-001',
        taskStatus: 'PENDING',
      },
      {
        defectQuantity: 2,
        erpInspectionBillNo: 'PQC1-001',
        erpPushStatus: 'PUSH_FAILED',
        id: 2,
        inspectionResult: 'FAIL',
        lastError: 'ERP reject',
        orderNo: 'MO-002',
        schemeCode: 'PQC-A',
        taskStatus: 'COMPLETED',
      },
      {
        assignedToName: 'QC01',
        erpPushStatus: 'WAIT_REPORT_AUDIT',
        erpReportBillNo: 'PRD_MORPT-001',
        id: 3,
        orderNo: 'MO-003',
        schemeCode: 'PQC-B',
        taskStatus: 'IN_PROGRESS',
      },
    ];

    const model = buildInspectionTasksV2Model(rows);

    expect(model.summary.total).toBe(3);
    expect(model.summary.blocked).toBe(2);
    expect(model.issueGroups.map((item) => item.key)).toEqual([
      'missingScheme',
      'erpFailed',
      'waitingProductReport',
      'defectFound',
    ]);
    expect(model.erpChains).toHaveLength(2);
    expect(getInspectionTaskV2ActionState(rows[1]!).canRetryErp).toBe(true);
  });

  it('allows result submission only before completion', () => {
    expect(getInspectionTaskV2ActionState({
      erpPushStatus: 'READY_TO_PUSH',
      id: 1,
      taskStatus: 'PENDING',
    }).canComplete).toBe(true);

    expect(getInspectionTaskV2ActionState({
      erpPushStatus: 'READY_TO_PUSH',
      id: 2,
      taskStatus: 'IN_PROGRESS',
    }).canComplete).toBe(true);

    expect(getInspectionTaskV2ActionState({
      erpPushStatus: 'PUSHED',
      id: 3,
      taskStatus: 'COMPLETED',
    }).canComplete).toBe(false);

    expect(getInspectionTaskV2ActionState({
      erpPushStatus: 'SKIPPED',
      id: 4,
      taskStatus: 'CANCELLED',
    }).canComplete).toBe(false);
  });

  it('accepts the Task 8 quality split and rejects a non-conserving result', () => {
    expect(validateProductInboundInspectionQuantities({
      inspectionTotalQuantity: 1000,
      qualifiedQuantity: 890,
      scrapQuantity: 10,
      unqualifiedQuantity: 100,
    })).toEqual({ valid: true });
    expect(validateProductInboundInspectionQuantities({
      inspectionTotalQuantity: 1000,
      qualifiedQuantity: 890,
      scrapQuantity: 10,
      unqualifiedQuantity: 90,
    })).toEqual({ valid: false, message: '检验总数必须等于合格、不良和报废数量之和' });
  });

  it('constructs the frozen four-quantity completion contract', () => {
    expect(buildProductInboundInspectionRequest({
      inspectionResult: 'HAS_DEFECT',
      inspectionTotalQuantity: 1000,
      qualifiedQuantity: 890,
      remark: 'Task 8',
      scrapQuantity: 0,
      unqualifiedQuantity: 110,
      reworkRequired: true,
    })).toEqual({
      inspectionResult: 'HAS_DEFECT',
      inspectionTotalQuantity: 1000,
      qualifiedQuantity: 890,
      remark: 'Task 8',
      scrapQuantity: 0,
      unqualifiedQuantity: 110,
      reworkRequired: true,
    });
  });

  it('requires an explicit disposition for defective quantities and preserves scrap choice', () => {
    expect(() => buildProductInboundInspectionRequest({
      inspectionResult: 'HAS_DEFECT',
      inspectionTotalQuantity: 10,
      qualifiedQuantity: 8,
      remark: '',
      scrapQuantity: 0,
      unqualifiedQuantity: 2,
    })).toThrow();
    expect(buildProductInboundInspectionRequest({
      inspectionResult: 'HAS_DEFECT',
      inspectionTotalQuantity: 10,
      qualifiedQuantity: 8,
      remark: '',
      scrapQuantity: 2,
      unqualifiedQuantity: 0,
      reworkRequired: false,
    })).toMatchObject({ reworkRequired: false });
  });

  it('normalizes historical ERP states before deriving V2 actions', () => {
    expect(normalizeInspectionErpPushStatus('WAIT_R1')).toBe('WAIT_REPORT_AUDIT');
    expect(normalizeInspectionErpPushStatus('PUSH_PENDING')).toBe('READY_TO_PUSH');
    expect(getInspectionTaskV2ActionState({
      erpPushStatus: 'READY_TO_PUSH',
      id: 5,
      taskStatus: 'COMPLETED',
    }).canRetryErp).toBe(true);
  });
});
