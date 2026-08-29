import { describe, expect, it } from 'vitest';

import type { ProcessWageSheet } from '#/api/processWage';

import {
  buildProcessWageSheetModel,
  getProcessWageSheetActionState,
} from './process-wage-sheet-model';

describe('process-wage-sheet-model', () => {
  it('summarizes frozen wage-sheet statuses and keeps details available without granting review rights', () => {
    const sheets: ProcessWageSheet[] = [
      { id: 1, orderId: 11, orderNo: 'MO-001', status: 'WAIT_QUALITY', terminalSnapshotId: 101 },
      { id: 2, orderId: 12, orderNo: 'MO-002', status: 'PENDING_REVIEW', terminalSnapshotId: 102 },
      { id: 3, orderId: 13, orderNo: 'MO-003', status: 'CONFIRMED', terminalSnapshotId: 103 },
    ];

    const model = buildProcessWageSheetModel(sheets);

    expect(model.summary).toEqual({ confirmed: 1, pendingReview: 1, total: 3, waitingQuality: 1 });
    expect(getProcessWageSheetActionState(sheets[0]!)).toMatchObject({
      canAdjust: false, canConfirm: false, canDetail: true, canRecalculate: false, canReject: true,
    });
    expect(getProcessWageSheetActionState(sheets[1]!)).toMatchObject({
      canAdjust: true, canConfirm: true, canDetail: true, canRecalculate: true, canReject: true,
    });
    expect(getProcessWageSheetActionState(sheets[2]!)).toMatchObject({
      canAdjust: false, canConfirm: false, canDetail: true, canRecalculate: false, canReject: false,
    });
  });
});
