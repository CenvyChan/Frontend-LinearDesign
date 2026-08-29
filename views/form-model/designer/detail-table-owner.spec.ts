import { describe, expect, it } from 'vitest';

import type { DetailTableRow } from './detail-table-owner';

import {
  detailClientKeyOf,
  findOrphanFields,
  isFormPublished,
  ownerTableLabel,
} from './detail-table-owner';

function table(
  detailTableId: number,
  detailKey: string,
  extra: Partial<DetailTableRow> = {},
): DetailTableRow {
  return {
    uid: `d${detailTableId}`,
    detailTableId,
    detailKey,
    detailName: detailKey,
    ...extra,
  };
}

describe('detailClientKeyOf', () => {
  const tables = [table(7, 'lines'), table(8, 'extras')];

  it('maps a detail table id onto the matching front-end uid', () => {
    expect(detailClientKeyOf({ detailTableId: 8 }, tables)).toBe('d8');
  });

  it('treats 0 and a missing id as the main table', () => {
    // 老快照可能完全不带这个键，两种形态都必须走主表分支。
    expect(detailClientKeyOf({ detailTableId: 0 }, tables)).toBeUndefined();
    expect(detailClientKeyOf({}, tables)).toBeUndefined();
  });

  it('yields nothing for an id that is not in the list', () => {
    // 悬空归属由 findOrphanFields 报错，这里只负责不要凭空造出一个 uid。
    expect(detailClientKeyOf({ detailTableId: 99 }, tables)).toBeUndefined();
  });
});

describe('findOrphanFields', () => {
  it('reports fields whose detail table was removed', () => {
    const fields = [
      { fieldKey: 'title' },
      { fieldKey: 'qty', detailClientKey: 'd7' },
      { fieldKey: 'note', detailClientKey: 'd8' },
    ];

    // 只留 d7，d8 被删掉了。
    const orphans = findOrphanFields(fields, [table(7, 'lines')]);

    expect(orphans.map((field) => field.fieldKey)).toEqual(['note']);
  });

  it('does not treat main-table fields as orphans', () => {
    const fields = [{ fieldKey: 'title' }, { fieldKey: 'code', detailClientKey: '' }];

    // 空串与缺省都表示主表，不能因为"没有匹配的明细表"就误报。
    expect(findOrphanFields(fields, [])).toEqual([]);
  });

  it('finds every orphan, not just the first', () => {
    const fields = [
      { fieldKey: 'a', detailClientKey: 'gone' },
      { fieldKey: 'b', detailClientKey: 'gone' },
    ];

    // 错误提示要能一次列出全部，否则用户得反复保存才能逐个发现。
    expect(findOrphanFields(fields, []).map((field) => field.fieldKey)).toEqual(['a', 'b']);
  });
});

describe('ownerTableLabel', () => {
  it('shows the main table for a field with no owner', () => {
    expect(ownerTableLabel({ fieldKey: 'title' }, [])).toBe('主表');
  });

  it('prefers the detail name and falls back to the key', () => {
    expect(ownerTableLabel({ fieldKey: 'qty', detailClientKey: 'd7' }, [table(7, 'lines')]))
      .toBe('lines');
    expect(
      ownerTableLabel({ fieldKey: 'qty', detailClientKey: 'd7' }, [
        table(7, 'lines', { detailName: '行项目' }),
      ]),
    ).toBe('行项目');
    expect(
      ownerTableLabel({ fieldKey: 'qty', detailClientKey: 'd7' }, [
        table(7, 'lines', { detailName: '' }),
      ]),
    ).toBe('lines');
  });

  it('marks a dangling owner rather than showing it as the main table', () => {
    // 显示成「主表」会让用户以为没问题，而保存必然失败。
    expect(ownerTableLabel({ fieldKey: 'qty', detailClientKey: 'gone' }, [])).toBe('（已删除）');
  });
});

describe('isFormPublished', () => {
  it('is true when any detail table is published', () => {
    expect(isFormPublished([table(7, 'lines', { isPublished: true })])).toBe(true);
  });

  it('is false while every detail table is still a draft', () => {
    expect(isFormPublished([table(7, 'lines', { isPublished: false })])).toBe(false);
    // 标记缺省时不能当成已发布：那会让草稿里的明细表也变成不可改。
    expect(isFormPublished([table(7, 'lines')])).toBe(false);
    expect(isFormPublished([])).toBe(false);
  });
});
