import { describe, expect, it } from 'vitest';

import type { FormDetailTableSchema, FormFieldSchema } from '#/api/form-model';

import { DEFAULT_MAX_DETAIL_ROWS } from '#/api/form-model-detail-limits';

import {
  blankRow,
  emptyDetailRows,
  fieldsOfTable,
  initialValue,
  toDetailPayload,
  validateDetailRows,
} from './detail-rows';

function field(
  fieldKey: string,
  fieldType: string,
  detailTableId: number,
  extra: Partial<FormFieldSchema> = {},
): FormFieldSchema {
  return {
    fieldId: 1,
    fieldKey,
    fieldLabel: fieldKey,
    fieldType,
    detailTableId,
    ...extra,
  };
}

function detailTable(
  detailTableId: number,
  detailKey: string,
  extra: Partial<FormDetailTableSchema> = {},
): FormDetailTableSchema {
  return {
    detailTableId,
    detailKey,
    detailName: detailKey,
    ...extra,
  };
}

describe('fieldsOfTable', () => {
  const fields = [
    field('title', 'TEXT', 0),
    field('qty', 'NUMBER', 7),
    field('note', 'TEXT', 7),
    field('other', 'TEXT', 8),
  ];

  it('splits fields by their owning table', () => {
    expect(fieldsOfTable(fields, 0).map((f) => f.fieldKey)).toEqual(['title']);
    expect(fieldsOfTable(fields, 7).map((f) => f.fieldKey)).toEqual(['qty', 'note']);
  });

  it('treats a missing detailTableId as the main table', () => {
    // 老快照可能不带这个键。
    const legacy = [{ ...field('code', 'TEXT', 0), detailTableId: undefined }];
    expect(fieldsOfTable(legacy, 0).map((f) => f.fieldKey)).toEqual(['code']);
  });

  it('skips fields the designer hid', () => {
    const hidden = [field('secret', 'TEXT', 7, { isVisible: false })];
    expect(fieldsOfTable(hidden, 7)).toEqual([]);
  });
});

describe('initialValue', () => {
  it('gives multi-value fields an array and booleans false', () => {
    // 类型不对会让 el-checkbox-group 在首次渲染就报错。
    expect(initialValue(field('tags', 'MULTI_SELECT', 7))).toEqual([]);
    expect(initialValue(field('flags', 'CHECKBOX', 7))).toEqual([]);
    expect(initialValue(field('ok', 'BOOLEAN', 7))).toBe(false);
  });

  it('prefers the declared default and otherwise uses an empty string', () => {
    expect(initialValue(field('code', 'TEXT', 7, { defaultValue: 'A' }))).toBe('A');
    expect(initialValue(field('code', 'TEXT', 7))).toBe('');
  });
});

describe('blankRow / emptyDetailRows', () => {
  it('builds a row with only that table\u2019s fields', () => {
    const fields = [field('title', 'TEXT', 0), field('qty', 'NUMBER', 7)];
    // 主表字段不能进明细行：后端按归属表白名单校验，多带一个键会被拒。
    expect(blankRow(fields, 7)).toEqual({ qty: '' });
  });

  it('creates one empty bucket per declared table', () => {
    expect(emptyDetailRows([detailTable(7, 'lines'), detailTable(8, 'extras')])).toEqual({
      lines: [],
      extras: [],
    });
  });
});

describe('validateDetailRows', () => {
  const fields = [field('qty', 'NUMBER', 7, { isRequired: true })];

  it('accepts a form with no detail tables at all', () => {
    expect(validateDetailRows([], [], {})).toBe('');
  });

  it('reports a row count below the minimum', () => {
    const tables = [detailTable(7, 'lines', { detailName: '行项目', minRows: 2 })];
    expect(validateDetailRows(tables, fields, { lines: [{ qty: 1 }] })).toContain(
      '「行项目」至少需要 2 行',
    );
  });

  it('reports a row count above the maximum', () => {
    const tables = [detailTable(7, 'lines', { maxRows: 1 })];
    expect(
      validateDetailRows(tables, fields, { lines: [{ qty: 1 }, { qty: 2 }] }),
    ).toContain('最多 1 行');
  });

  it('names the row number and the field for a missing required value', () => {
    const tables = [detailTable(7, 'lines', { detailName: '行项目' })];
    // 后端只能说「必填」；能指出第几行才是前端做这一遍校验的理由。
    const error = validateDetailRows(tables, fields, {
      lines: [{ qty: 1 }, { qty: '' }],
    });
    expect(error).toContain('第 2 行');
    expect(error).toContain('qty');
  });

  it('numbers rows from one so they match the stored row_no', () => {
    const tables = [detailTable(7, 'lines')];
    expect(validateDetailRows(tables, fields, { lines: [{ qty: '' }] })).toContain('第 1 行');
  });

  it('treats a missing bucket as zero rows rather than skipping the minimum', () => {
    const tables = [detailTable(7, 'lines', { minRows: 1 })];
    // 前端少建一个桶不能变成绕过必填。
    expect(validateDetailRows(tables, fields, {})).toContain('至少需要 1 行');
  });

  // 这条断言此前写死「最多 100 行」并自称 "to match the backend"，而后端
  // MainDetailWriteService 对同一个 null 兜底成 1000 —— 测试把不一致锁住了：
  // 任何把 100 改成 1000 的正确修复都会让它变红，而红灯会被读成「改错了」。
  // 现在取 DEFAULT_MAX_DETAIL_ROWS，兜底值改动时断言自动跟随。
  it('defaults the ceiling to the backend limit rather than a hardcoded number', () => {
    const tables = [detailTable(7, 'lines')];
    const rows = Array.from({ length: DEFAULT_MAX_DETAIL_ROWS + 1 }, () => ({
      qty: 1,
    }));
    expect(validateDetailRows(tables, fields, { lines: rows })).toContain(
      `最多 ${DEFAULT_MAX_DETAIL_ROWS} 行`,
    );
  });

  // 上一条只证明「超过上限会被拒」。它在兜底值是 100 还是 1000 时都会绿，
  // 所以还需要这条钉住具体数值：兜底不再是 100。
  it('admits a row count that the old hardcoded ceiling of 100 would have rejected', () => {
    const tables = [detailTable(7, 'lines')];
    const rows = Array.from({ length: 101 }, () => ({ qty: 1 }));
    expect(validateDetailRows(tables, fields, { lines: rows })).toBe('');
  });
});

describe('toDetailPayload', () => {
  const tables = [detailTable(7, 'lines')];

  it('converts numeric fields and drops blanks', () => {
    const fields = [field('qty', 'NUMBER', 7), field('note', 'TEXT', 7)];
    // 剔除而不是送 null：后端按「键存在」决定写哪些列。
    expect(
      toDetailPayload(tables, fields, { lines: [{ qty: '5', note: '' }] }),
    ).toEqual({ lines: [{ qty: 5 }] });
  });

  it('drops keys that do not belong to the table', () => {
    const fields = [field('qty', 'NUMBER', 7), field('title', 'TEXT', 0)];
    // 行对象可能残留切换归属前的键；原样送出会让后端拒掉整次写入。
    expect(
      toDetailPayload(tables, fields, { lines: [{ qty: 1, title: 'x', stray: 'y' }] }),
    ).toEqual({ lines: [{ qty: 1 }] });
  });

  it('keeps false and zero, which are values rather than blanks', () => {
    const fields = [field('ok', 'BOOLEAN', 7), field('qty', 'NUMBER', 7)];
    expect(toDetailPayload(tables, fields, { lines: [{ ok: false, qty: 0 }] })).toEqual({
      lines: [{ ok: false, qty: 0 }],
    });
  });

  it('emits an empty array for a table the user left blank', () => {
    // 后端靠这个键区分「零行」与「未声明」，缺键会让 minRows 校验读不到该表。
    expect(toDetailPayload(tables, [], {})).toEqual({ lines: [] });
  });
});
