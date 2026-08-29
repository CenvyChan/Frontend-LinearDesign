import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { collectHiddenRoutesToRegister } from './hidden-routes';

const allow = () => true;
const deny = () => false;

const designerEdit = {
  name: 'FormModelDesignerEdit',
  path: '/form-model/designer/:formKey',
  meta: { hideInMenu: true, permission: 'form-model:design' },
} as unknown as RouteRecordRaw;

/**
 * 后端 accessMode 不下发 hideInMenu 路由，它们只能靠 access.ts 补注册。
 * 顶层定义的 hideInMenu 路由没有父级，一旦被跳过就永远不注册，导航落到
 * 404 兜底且后端毫无痕迹 —— 表单设计器编辑页曾因此打不开。
 */
describe('collectHiddenRoutesToRegister', () => {
  it('falls back to Root for a top-level hidden route without a parent', () => {
    const collected = collectHiddenRoutesToRegister(
      [designerEdit],
      new Set(),
      allow,
    );

    expect(collected).toHaveLength(1);
    expect(collected[0]?.parentName).toBe('Root');
    expect(collected[0]?.route.name).toBe('FormModelDesignerEdit');
  });

  it('keeps the real parent for a nested hidden route', () => {
    const collected = collectHiddenRoutesToRegister(
      [
        {
          name: 'Parent',
          path: '/parent',
          children: [
            { name: 'Child', path: 'child', meta: { hideInMenu: true } },
          ],
        } as unknown as RouteRecordRaw,
      ],
      new Set(),
      allow,
    );

    expect(collected).toHaveLength(1);
    expect(collected[0]?.parentName).toBe('Parent');
    expect(collected[0]?.route.name).toBe('Child');
  });

  it('skips a route the user has no permission for', () => {
    expect(
      collectHiddenRoutesToRegister([designerEdit], new Set(), deny),
    ).toEqual([]);
  });

  it('skips a route the backend menu already registered', () => {
    expect(
      collectHiddenRoutesToRegister(
        [designerEdit],
        new Set(['FormModelDesignerEdit']),
        allow,
      ),
    ).toEqual([]);
  });

  it('ignores parent routes that only group children', () => {
    const collected = collectHiddenRoutesToRegister(
      [
        {
          name: 'GroupOnly',
          path: '/group',
          meta: { hideInMenu: true },
          children: [{ name: 'Leaf', path: 'leaf', meta: {} }],
        } as unknown as RouteRecordRaw,
      ],
      new Set(),
      allow,
    );

    expect(collected).toEqual([]);
  });
});
