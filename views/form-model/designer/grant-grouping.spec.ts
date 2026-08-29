import { describe, expect, it } from 'vitest';

import type { FormGrantItem } from './grant-grouping';

import { ALL_VIEWS, groupGrants } from './grant-grouping';

function grant(overrides: Partial<FormGrantItem> = {}): FormGrantItem {
  return {
    viewId: ALL_VIEWS,
    grantType: 'VIEW',
    principalType: 'ROLE',
    principalId: 3,
    grantedAt: 1000,
    ...overrides,
  };
}

describe('ALL_VIEWS 哨兵值', () => {
  // 三方必须一致：后端 FormGrant.ALL_VIEWS、api/formModelDesigner 的同名常量、这里。
  // 值本身写死是刻意的 —— 它是跨语言的线上契约，改动必须显式且被这条断言拦住。
  it('是 0，与后端 FormGrant.ALL_VIEWS 及 mes_form_grant.view_id 的默认值一致', () => {
    expect(ALL_VIEWS).toBe(0);
  });
});

describe('groupGrants', () => {
  it('把同一组合的 VIEW 与 CREATE 合并成一行', () => {
    const rows = groupGrants([
      grant({ grantType: 'VIEW' }),
      grant({ grantType: 'CREATE' }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.canCreate).toBe(true);
  });

  /**
   * 这条是本轮的核心：分组键含 viewId。
   *
   * 少了它，「全部入口只读」与「录入入口可新增」会塌成一行，
   * 界面显示两者的并集，用户既看不出也无法分别撤销。
   */
  it('不同菜单入口的授权保持为独立的行', () => {
    const rows = groupGrants([
      grant({ viewId: 0, grantType: 'VIEW' }),
      grant({ viewId: 51, grantType: 'CREATE' }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.viewId, row.canCreate])).toEqual([
      [0, false],
      [51, true],
    ]);
  });

  it('同一入口的不同授权对象各占一行', () => {
    const rows = groupGrants([
      grant({ viewId: 51, principalId: 3 }),
      grant({ viewId: 51, principalId: 4 }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it('USER 与 ROLE 即使 id 相同也不合并', () => {
    const rows = groupGrants([
      grant({ principalType: 'ROLE', principalId: 3 }),
      grant({ principalType: 'USER', principalId: 3 }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it('表单级授权排在入口级之前 —— 先读作用范围最广的那条', () => {
    const rows = groupGrants([
      grant({ viewId: 52 }),
      grant({ viewId: 0 }),
      grant({ viewId: 51 }),
    ]);

    expect(rows.map((row) => row.viewId)).toEqual([0, 51, 52]);
  });

  it('缺失的 viewId 落成表单级，而不是产生一行 undefined', () => {
    const rows = groupGrants([
      { ...grant(), viewId: undefined as unknown as number },
    ]);

    expect(rows[0]!.viewId).toBe(0);
  });

  it('grantedAt 取组内最大值，空值不参与比较', () => {
    const rows = groupGrants([
      grant({ grantType: 'VIEW', grantedAt: 500 }),
      grant({ grantType: 'CREATE', grantedAt: 900 }),
    ]);

    expect(rows[0]!.grantedAt).toBe(900);
  });
});
