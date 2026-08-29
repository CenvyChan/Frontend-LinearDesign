import type { ProcessWageSheet } from '#/api/processWage';

export type ProcessWageSheetTone = 'danger' | 'info' | 'primary' | 'success' | 'warning';

export interface ProcessWageSheetActionState {
  canAdjust: boolean;
  canConfirm: boolean;
  canDetail: boolean;
  canRecalculate: boolean;
  canReject: boolean;
  tone: ProcessWageSheetTone;
}

export interface ProcessWageSheetModel {
  summary: {
    confirmed: number;
    pendingReview: number;
    total: number;
    waitingQuality: number;
  };
}

export function getProcessWageSheetActionState(sheet: ProcessWageSheet): ProcessWageSheetActionState {
  return {
    canAdjust: sheet.status === 'PENDING_REVIEW',
    canConfirm: sheet.status === 'PENDING_REVIEW',
    canDetail: true,
    canRecalculate: sheet.status === 'PENDING_REVIEW',
    canReject: ['PENDING_REVIEW', 'WAIT_QUALITY'].includes(sheet.status),
    tone: sheet.status === 'CONFIRMED'
      ? 'success'
      : sheet.status === 'PENDING_REVIEW'
        ? 'warning'
        : sheet.status === 'WAIT_QUALITY'
          ? 'info'
          : 'danger',
  };
}

export function buildProcessWageSheetModel(sheets: ProcessWageSheet[] = []): ProcessWageSheetModel {
  return {
    summary: {
      confirmed: sheets.filter((sheet) => sheet.status === 'CONFIRMED').length,
      pendingReview: sheets.filter((sheet) => sheet.status === 'PENDING_REVIEW').length,
      total: sheets.length,
      waitingQuality: sheets.filter((sheet) => sheet.status === 'WAIT_QUALITY').length,
    },
  };
}
