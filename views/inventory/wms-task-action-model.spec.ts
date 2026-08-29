import { describe, expect, it } from 'vitest';

import type { WmsOperationTask, WmsOperationTaskLine } from '#/api/wms';

import {
  canConvertLineToErp,
  canRecordIncomingInspection,
  canSubmitWmsTask,
  inspectionQtyMatches,
  missingErpConversionDimensions,
  qualifiedQtyFromRejected,
} from './wms-task-action-model';

describe('wms-task-action-model', () => {
  it('blocks inspection, routing, blocked, and transfer-pending tasks before WMS submission', () => {
    const task = (taskStatus: WmsOperationTask['taskStatus']): WmsOperationTask => ({ id: 1, taskStatus });

    expect(canSubmitWmsTask(task('WAIT_QC'))).toBe(false);
    expect(canSubmitWmsTask(task('WAIT_ROUTE'))).toBe(false);
    expect(canSubmitWmsTask(task('BLOCKED'))).toBe(false);
    expect(canSubmitWmsTask(task('TRANSFER_PENDING'))).toBe(false);
    expect(canSubmitWmsTask(task('TASK_CREATED'))).toBe(true);
    expect(canSubmitWmsTask(task('RESERVED'))).toBe(true);
  });

  it('offers incoming inspection for notices that have an ERP inspection node and still wait for QC', () => {
    const task: WmsOperationTask = { id: 1, sourceFormId: 'PUR_ReceiveBill', taskStatus: 'WAIT_QC' };
    const line: WmsOperationTaskLine = { id: 2, lineStatus: 'WAIT_QC' };

    expect(canRecordIncomingInspection(task, line)).toBe(true);
    expect(canRecordIncomingInspection({ ...task, taskStatus: 'READY' }, line)).toBe(false);
    expect(canRecordIncomingInspection(task, { ...line, lineStatus: 'READY' })).toBe(false);
    // 客户退货也有检验节点（QM_SALReturn2Inspect），后端已支持，入口不能只认采购收料。
    expect(canRecordIncomingInspection({ ...task, sourceFormId: 'SAL_RETURNNOTICE' }, line)).toBe(true);
    // 发货通知单在金蝶没有到检验单的下推规则，勾了也无单可清，必须继续挡住。
    expect(canRecordIncomingInspection({ ...task, sourceFormId: 'SAL_DELIVERYNOTICE' }, line)).toBe(false);
    expect(canRecordIncomingInspection(null, line)).toBe(false);
  });

  it('allows ERP conversion once the line left QC and before the task is posted', () => {
    const task: WmsOperationTask = { id: 1, taskStatus: 'READY' };
    const line: WmsOperationTaskLine = { id: 2, lineStatus: 'READY' };

    expect(canConvertLineToErp(task, line)).toBe(true);
    expect(canConvertLineToErp(task, { ...line, lineStatus: 'WAIT_QC' })).toBe(false);
    expect(canConvertLineToErp(task, { ...line, lineStatus: 'CANCELLED' })).toBe(false);
    expect(canConvertLineToErp({ ...task, taskStatus: 'WMS_POSTED' }, line)).toBe(false);
    expect(canConvertLineToErp(task, null)).toBe(false);
  });

  it('names the inventory dimensions ERP conversion still needs', () => {
    expect(
      missingErpConversionDimensions({
        id: 1,
        keeperNumber: 'K1',
        locationCode: 'L1',
        lotNo: 'B1',
        ownerNumber: 'O1',
        stockNumber: 'CK01',
      }),
    ).toEqual([]);

    expect(missingErpConversionDimensions({ id: 1, lotNo: '  ', stockNumber: 'CK01' })).toEqual([
      '库位',
      '批次',
      '货主',
      '保管者',
    ]);
  });

  /**
   * 判退联动出合格数：现场只数「坏了几个」，合格数是算出来的。
   *
   * 此前检验弹窗两个框都要手填，而后端要求两者之和恰好等于计划量 ——
   * 各填一次必然凑不上、提交按钮一直是禁用的。
   */
  it('derives the qualified quantity from the rejected one and never goes negative', () => {
    expect(qualifiedQtyFromRejected(3000, 425)).toBe(2575);
    expect(qualifiedQtyFromRejected(3000, 0)).toBe(3000);
    // 全判退
    expect(qualifiedQtyFromRejected(3000, 3000)).toBe(0);
    // 判退多于计划量时钳到 0，而不是给出负数让后端拒绝
    expect(qualifiedQtyFromRejected(3000, 5000)).toBe(0);
    // null/undefined 当 0 处理：el-input-number 清空时会给 null
    expect(qualifiedQtyFromRejected(3000, null as unknown as number)).toBe(3000);
  });

  /**
   * 提交判据必须带浮点容差 —— planQty 是 `decimal(18,6)`，
   * 用 `===` 会让完全正确的输入被判为不匹配、按钮永久禁用。
   */
  it('accepts quantities that sum to the plan within a decimal tolerance', () => {
    expect(inspectionQtyMatches(3000, 2575, 425)).toBe(true);
    expect(inspectionQtyMatches(3000, 3000, 0)).toBe(true);
    expect(inspectionQtyMatches(3000, 0, 3000)).toBe(true);
    // 样品损耗这类两者之和小于计划量的情形要拒绝，由「合计」标签变红提示
    expect(inspectionQtyMatches(3000, 2500, 425)).toBe(false);
    expect(inspectionQtyMatches(3000, 2600, 425)).toBe(false);
    // 六位小数相加的浮点误差不能让它变红
    expect(inspectionQtyMatches(0.3, 0.1, 0.2)).toBe(true);
  });
});
