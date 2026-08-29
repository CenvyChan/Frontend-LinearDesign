import type { WmsOperationTask, WmsOperationTaskLine } from '#/api/wms';

const submissionBlockedStatuses = new Set([
  'BLOCKED',
  'CANCELLED',
  'REVERSED',
  'TRANSFER_PENDING',
  'WAIT_QC',
  'WAIT_ROUTE',
  'WMS_POSTED',
]);

export function canSubmitWmsTask(task?: WmsOperationTask | null): boolean {
  return Boolean(task && !submissionBlockedStatuses.has(task.taskStatus || ''));
}

/**
 * Source notices that carry an inspection node in ERP.
 *
 * PUR_ReceiveBill pushes to QM_InspectBill via QM_PURReceive2Inspect, SAL_RETURNNOTICE via
 * QM_SALReturn2Inspect. Deliberately excludes SAL_DELIVERYNOTICE: its FCheckDelivery flag is set on
 * no bill in the account and K3Cloud has no delivery-notice-to-inspection push rule, so offering the
 * action would park the task at WAIT_QC with no ERP bill able to clear it.
 */
const inspectableSourceFormIds = new Set(['PUR_ReceiveBill', 'SAL_RETURNNOTICE']);

/**
 * Incoming inspection can only be recorded while the line still waits for QC.
 * The backend enforces the same rule and additionally requires qualified + rejected to equal planQty.
 */
export function canRecordIncomingInspection(
  task?: WmsOperationTask | null,
  line?: WmsOperationTaskLine | null,
): boolean {
  return Boolean(
    task?.taskStatus === 'WAIT_QC' &&
      line?.lineStatus === 'WAIT_QC' &&
      inspectableSourceFormIds.has(task.sourceFormId || ''),
  );
}

/**
 * A line may be (re)pushed to ERP once it is no longer waiting for QC and has not been posted yet.
 * Used both for the first manual push and for retrying after a dimension gap.
 */
export function canConvertLineToErp(
  task?: WmsOperationTask | null,
  line?: WmsOperationTaskLine | null,
): boolean {
  if (!task || !line) return false;
  if (task.taskStatus === 'WMS_POSTED') return false;
  return line.lineStatus !== 'WAIT_QC' && line.lineStatus !== 'CANCELLED';
}

/**
 * 判退数量联动出的合格数量：合格 = 计划 - 判退，下限 0。
 *
 * 现场只会数出「坏了几个」，合格数是算出来的。此前检验弹窗两个框都要手填，
 * 而后端要求两者之和恰好等于计划量 —— 各填一次必然凑不上、提交按钮一直禁用。
 */
export function qualifiedQtyFromRejected(planQty: number, rejectedQty: number): number {
  const remaining = Number(planQty || 0) - Number(rejectedQty || 0);
  return remaining > 0 ? remaining : 0;
}

/**
 * 检验数量是否可提交：合格 + 判退 必须等于计划量（后端同样校验）。
 *
 * 用 1e-6 容差而非 `===`：planQty 是 `decimal(18,6)`，浮点误差会让完全正确的输入被判为不匹配。
 */
export function inspectionQtyMatches(
  planQty: number,
  qualifiedQty: number,
  rejectedQty: number,
): boolean {
  const total = Number(qualifiedQty || 0) + Number(rejectedQty || 0);
  return Math.abs(total - Number(planQty || 0)) < 0.000_001;
}

/** The dimensions convertTaskLine requires when they are not already stored on the line. */
export function missingErpConversionDimensions(line?: WmsOperationTaskLine | null): string[] {
  if (!line) return [];
  const required: Array<[keyof WmsOperationTaskLine, string]> = [
    ['stockNumber', '仓库'],
    ['locationCode', '库位'],
    ['lotNo', '批次'],
    ['ownerNumber', '货主'],
    ['keeperNumber', '保管者'],
  ];
  return required
    .filter(([key]) => {
      const value = line[key];
      return value === null || value === undefined || String(value).trim() === '';
    })
    .map(([, label]) => label);
}
