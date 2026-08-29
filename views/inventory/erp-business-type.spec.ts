import { describe, expect, it } from 'vitest';

import { businessTypeLabel, businessTypeTagType, isOutOfScopeBusinessType } from './erp-business-type';

describe('businessTypeLabel', () => {
  it('maps the sales delivery notice values', () => {
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', 'NORMAL')).toBe('标准');
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', 'CONSIGNMENT')).toBe('寄售');
  });

  it('maps the purchase receipt values', () => {
    expect(businessTypeLabel('PUR_ReceiveBill', 'CG')).toBe('采购');
    expect(businessTypeLabel('PUR_ReceiveBill', 'WW')).toBe('委外');
  });

  /**
   * 这条是整个模块存在的理由：用单一 map 时 CG 与 NORMAL 会互相污染 ——
   * 发货单会显示出「采购」，收料单会显示出「标准」。
   */
  it('does not leak one form values into the other', () => {
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', 'CG')).toBe('CG');
    expect(businessTypeLabel('PUR_ReceiveBill', 'NORMAL')).toBe('NORMAL');
  });

  /** 未知 formId 回落到原值而不是空串，否则 ERP 新增单据类型时页面一片空白，无从定位。 */
  it('falls back to the raw value for an unknown form', () => {
    expect(businessTypeLabel('SAL_RETURNNOTICE', 'THHH')).toBe('THHH');
    expect(businessTypeLabel(undefined, 'NORMAL')).toBe('NORMAL');
  });

  it('treats an absent business type as empty', () => {
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', undefined)).toBe('');
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', '  ')).toBe('');
  });

  /** ERP 侧大小写不稳定（已实测字段名按单据各异），取值也按大写归一。 */
  it('is case insensitive on the value', () => {
    expect(businessTypeLabel('SAL_DELIVERYNOTICE', 'consignment')).toBe('寄售');
    expect(businessTypeLabel('PUR_ReceiveBill', 'ww')).toBe('委外');
  });
});

describe('businessTypeTagType', () => {
  it('highlights the non-standard flows', () => {
    expect(businessTypeTagType('SAL_DELIVERYNOTICE', 'CONSIGNMENT')).toBe('warning');
    expect(businessTypeTagType('PUR_ReceiveBill', 'WW')).toBe('warning');
  });

  it('keeps the standard flows quiet', () => {
    expect(businessTypeTagType('SAL_DELIVERYNOTICE', 'NORMAL')).toBe('info');
    expect(businessTypeTagType('PUR_ReceiveBill', 'CG')).toBe('info');
  });

  /** 配色也按 formId 分派：发货单收到 WW 不该被标成非标准流程。 */
  it('does not flag a value that is non-standard only on the other form', () => {
    expect(businessTypeTagType('SAL_DELIVERYNOTICE', 'WW')).toBe('info');
    expect(businessTypeTagType('PUR_ReceiveBill', 'CONSIGNMENT')).toBe('info');
  });

  /**
   * 资产采购必须与委外**区分开**，不能都用 warning。
   *
   * 委外是「要处理，只是流程不同」，资产采购是「根本不用处理」——
   * 同色会让人以为资产接收单也要收料。
   */
  it('marks an out-of-scope type as danger rather than lumping it with the non-standard flows', () => {
    expect(businessTypeTagType('PUR_ReceiveBill', 'ZCCG')).toBe('danger');
    expect(businessTypeTagType('PUR_ReceiveBill', 'WW')).toBe('warning');
  });
});

describe('isOutOfScopeBusinessType', () => {
  /**
   * 资产采购（ZCCG / 单据类型 SLD04_SYS「资产接收单」）不进收料业务，
   * 后续不生成采购入库单。2026-08-27 探活确认账套里 5 张全是这个组合。
   * 后端已按单据类型置 BLOCKED，前端这个判据只负责解释（显示"无需处理"、
   * 禁推进按钮、不计入待收货）。
   */
  it('recognises the asset purchase as out of scope for the receiving flow', () => {
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', 'ZCCG')).toBe(true);
    expect(businessTypeLabel('PUR_ReceiveBill', 'ZCCG')).toBe('资产采购');
  });

  it('keeps the real receiving types in scope', () => {
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', 'CG')).toBe(false);
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', 'WW')).toBe(false);
  });

  /** 按 formId 分派：ZCCG 只在采购收料的语境里表示"不参与"，别的单据不受影响。 */
  it('is scoped per form so it cannot leak to another chain', () => {
    expect(isOutOfScopeBusinessType('SAL_DELIVERYNOTICE', 'ZCCG')).toBe(false);
    expect(isOutOfScopeBusinessType(undefined, 'ZCCG')).toBe(false);
  });

  it('is case insensitive and tolerates an absent value', () => {
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', 'zccg')).toBe(true);
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', undefined)).toBe(false);
    expect(isOutOfScopeBusinessType('PUR_ReceiveBill', '  ')).toBe(false);
  });
});
