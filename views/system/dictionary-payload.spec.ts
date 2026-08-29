import { describe, expect, it } from 'vitest';

import type { DictionaryEditorRow } from './dictionary-payload';

import { toDictionaryTypePayload } from './dictionary-payload';

function row(overrides: Partial<DictionaryEditorRow> = {}): DictionaryEditorRow {
  return {
    uid: 1,
    type: 'bool',
    code: 'yes',
    label: '是',
    sort: 0,
    isDefault: false,
    isArchived: false,
    ...overrides,
  };
}

describe('toDictionaryTypePayload', () => {
  it('剔除纯前端的 uid —— 后端实体会对未知字段报 400', () => {
    const payload = toDictionaryTypePayload([row()], 'bool');

    expect(payload).toHaveLength(1);
    expect(payload[0]).not.toHaveProperty('uid');
  });

  it('只发出后端 Dictionary 实体已知的属性', () => {
    const known = new Set([
      'code',
      'id',
      'isArchived',
      'isDefault',
      'label',
      'remark',
      'sort',
      'type',
    ]);

    const payload = toDictionaryTypePayload(
      [row({ id: 7, remark: '备注', uid: 3 })],
      'bool',
    );

    for (const key of Object.keys(payload[0]!)) {
      expect(known, `unexpected key ${key}`).toContain(key);
    }
  });

  it('用参数里的 type 覆盖行上的 type，编码与标签两端去空格', () => {
    const payload = toDictionaryTypePayload(
      [row({ code: '  new_yes  ', label: '  是是是  ', type: 'stale' })],
      'bool',
    );

    expect(payload[0]).toMatchObject({
      code: 'new_yes',
      label: '是是是',
      type: 'bool',
    });
  });

  it('丢掉编码与标签都为空的行，保留只填了一个的行以便后端报错', () => {
    const payload = toDictionaryTypePayload(
      [
        row({ code: '   ', label: '   ', uid: 1 }),
        row({ code: 'no', label: '   ', uid: 2 }),
      ],
      'bool',
    );

    expect(payload).toHaveLength(1);
    expect(payload[0]!.code).toBe('no');
  });

  it('保留既有行的 id —— 后端靠它区分更新与新增', () => {
    const payload = toDictionaryTypePayload(
      [row({ id: 8, uid: 4 }), row({ code: 'maybe', uid: 5 })],
      'bool',
    );

    expect(payload[0]!.id).toBe(8);
    expect(payload[1]!.id).toBeUndefined();
  });
});
