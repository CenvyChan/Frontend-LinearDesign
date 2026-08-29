import { describe, expect, it } from 'vitest';

import type { ColumnField } from './list-columns';

import { resolveListColumns } from './list-columns';

function field(overrides: Partial<ColumnField> & { fieldKey: string }): ColumnField {
  return {
    fieldStatus: 'ACTIVE',
    isVisible: true,
    showInList: true,
    sort: 0,
    ...overrides,
  };
}

const FIELDS: ColumnField[] = [
  field({ fieldKey: 'code', sort: 1 }),
  field({ fieldKey: 'qty', sort: 2 }),
  field({ fieldKey: 'remark', sort: 3, showInList: false }),
];

function keys(columns: ColumnField[]): string[] {
  return columns.map((column) => column.fieldKey);
}

describe('resolveListColumns — 入口已配置列', () => {
  it('按入口配置的列与顺序显示，忽略字段级 showInList', () => {
    // remark 的 showInList 是 false，但入口明确要它 —— 入口说了算
    const columns = resolveListColumns(FIELDS, [
      { fieldKey: 'remark', sort: 1 },
      { fieldKey: 'code', sort: 2 },
    ]);

    expect(keys(columns)).toEqual(['remark', 'code']);
  });

  it('入口没选的字段不显示，即使它的 showInList 是 true', () => {
    expect(keys(resolveListColumns(FIELDS, [{ fieldKey: 'qty', sort: 1 }]))).toEqual(['qty']);
  });

  /**
   * 空数组是「明确零列」，不是「未配置」。
   *
   * 若当成未配置，用户永远配不出一个只有操作列的入口 ——
   * 每次保存都会被解读成没配过而退回字段级。
   */
  it('空数组表示明确不显示任何数据列', () => {
    expect(resolveListColumns(FIELDS, [])).toEqual([]);
  });

  /** 视图可能先于字段建立，字段也可能后来被停用 —— 跳过而不是报错。 */
  it('跳过配置里引用的不存在字段', () => {
    const columns = resolveListColumns(FIELDS, [
      { fieldKey: 'gone', sort: 1 },
      { fieldKey: 'code', sort: 2 },
    ]);

    expect(keys(columns)).toEqual(['code']);
  });

  it('跳过已停用或不可见的字段', () => {
    const fields = [
      field({ fieldKey: 'disabled', fieldStatus: 'DISABLED' }),
      field({ fieldKey: 'hidden', isVisible: false }),
      field({ fieldKey: 'ok' }),
    ];

    const columns = resolveListColumns(fields, [
      { fieldKey: 'disabled', sort: 1 },
      { fieldKey: 'hidden', sort: 2 },
      { fieldKey: 'ok', sort: 3 },
    ]);

    expect(keys(columns)).toEqual(['ok']);
  });

  it('sort 缺失时保持数组顺序，而不是塌到 0 后乱序', () => {
    const columns = resolveListColumns(FIELDS, [
      { fieldKey: 'qty' },
      { fieldKey: 'code' },
    ]);

    expect(keys(columns)).toEqual(['qty', 'code']);
  });

  it('sort 重复时按数组下标稳定兜底', () => {
    const columns = resolveListColumns(FIELDS, [
      { fieldKey: 'qty', sort: 1 },
      { fieldKey: 'code', sort: 1 },
    ]);

    expect(keys(columns)).toEqual(['qty', 'code']);
  });
});

describe('resolveListColumns — 入口未配置列（过渡期兼容）', () => {
  /**
   * null 必须退回字段级 showInList。
   *
   * 后端 FieldSchema.showInList 暂时删不掉：现存快照全部含该键，而 ObjectMapper
   * 未关 FAIL_ON_UNKNOWN_PROPERTIES，删字段会让每次反序列化都抛异常。
   */
  it('null 退回字段级 showInList', () => {
    expect(keys(resolveListColumns(FIELDS, null))).toEqual(['code', 'qty']);
  });

  it('undefined 与 null 同义 —— 旧后端不返回该键', () => {
    expect(keys(resolveListColumns(FIELDS, undefined))).toEqual(['code', 'qty']);
  });

  it('退回时按 listSort 优先、sort 兜底排序', () => {
    const fields = [
      field({ fieldKey: 'b', listSort: 1, sort: 9 }),
      field({ fieldKey: 'a', listSort: 2, sort: 1 }),
    ];

    expect(keys(resolveListColumns(fields, null))).toEqual(['b', 'a']);
  });

  it('退回时同样排除停用与不可见字段', () => {
    const fields = [
      field({ fieldKey: 'disabled', fieldStatus: 'DISABLED' }),
      field({ fieldKey: 'hidden', isVisible: false }),
      field({ fieldKey: 'ok' }),
    ];

    expect(keys(resolveListColumns(fields, null))).toEqual(['ok']);
  });

  it('showInList 缺省视为显示 —— 旧快照可能没有这个键', () => {
    const fields = [{ fieldKey: 'legacy' } as ColumnField];

    expect(keys(resolveListColumns(fields, null))).toEqual(['legacy']);
  });
});

describe('resolveListColumns — 明细表字段', () => {
  /**
   * 明细字段不能进主表列表：一条主记录下有多行明细，平铺只能显示第一行或空值。
   * 后端快照从 Phase 1 起就冻结了 detailTableId，前端此前没读，所以明细字段
   * 一旦进入快照就会混进列表。
   */
  it('退回字段级 showInList 时排除明细字段', () => {
    const fields = [
      field({ fieldKey: 'main_code' }),
      field({ fieldKey: 'line_qty', detailTableId: 7 }),
    ];

    expect(keys(resolveListColumns(fields, null))).toEqual(['main_code']);
  });

  it('入口显式配置了明细字段也不显示 —— 入口不能提权到主表之外', () => {
    const fields = [
      field({ fieldKey: 'main_code' }),
      field({ fieldKey: 'line_qty', detailTableId: 7 }),
    ];

    const columns = resolveListColumns(fields, [
      { fieldKey: 'line_qty', sort: 1 },
      { fieldKey: 'main_code', sort: 2 },
    ]);

    expect(keys(columns)).toEqual(['main_code']);
  });

  it('detailTableId=0 与缺省都算主表字段', () => {
    const fields = [
      field({ fieldKey: 'explicit_main', detailTableId: 0 }),
      field({ fieldKey: 'legacy_main' }),
    ];

    expect(keys(resolveListColumns(fields, null))).toEqual([
      'explicit_main',
      'legacy_main',
    ]);
  });
});
