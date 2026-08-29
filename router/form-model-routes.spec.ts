import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildFormModelRoute,
  collectFormModelMenus,
  mayBeUnloadedFormRoute,
  reloadFormModelRoutes,
  resetFormModelReloadState,
} from './form-model-routes';

function fakeRouter() {
  const routes: any[] = [];
  return {
    addRoute: vi.fn((route: any) => routes.push(route)),
    getRoutes: () => routes,
    removeRoute: vi.fn((name: string) => {
      const index = routes.findIndex((route) => route.name === name);
      if (index >= 0) routes.splice(index, 1);
    }),
    routes,
  };
}

describe('buildFormModelRoute', () => {
  it('keys the route on both form and view', () => {
    const route = buildFormModelRoute('purchase_inquiry', 'pending');

    expect(route.name).toBe('form-model-runtime-purchase_inquiry-pending');
    expect(route.path).toBe('/form-model/purchase_inquiry/pending');
    expect(route.meta?.formKey).toBe('purchase_inquiry');
    expect(route.meta?.viewKey).toBe('pending');
  });

  it('uses the custom path the backend sent instead of deriving one', () => {
    // 视图可以配自定义地址；自己推导会让注册的路由与菜单链接不一致 → 点进去 404
    const route = buildFormModelRoute('mat_q', 'query_a', '/info/material-query');

    expect(route.path).toBe('/info/material-query');
    // 名字不含地址：改地址后旧路由仍能按同一个名字摘掉
    expect(route.name).toBe('form-model-runtime-mat_q-query_a');
  });

  it('falls back to the derived path when the menu carries a relative one', () => {
    // 相对地址无法注册成顶级路由，退回默认地址比造一条打不开的路由好
    expect(buildFormModelRoute('mat_q', 'query_a', 'info/x').path).toBe(
      '/form-model/mat_q/query_a',
    );
  });
});

describe('mayBeUnloadedFormRoute', () => {
  it('treats a 404-only match as possibly-unloaded', () => {
    expect(mayBeUnloadedFormRoute([{ name: 'FallbackNotFound' }])).toBe(true);
    expect(mayBeUnloadedFormRoute([])).toBe(true);
  });

  it('leaves an already registered route alone', () => {
    // 否则每次正常导航都会多刷一次 /api/menu/all
    expect(
      mayBeUnloadedFormRoute([{ name: 'Root' }, { name: 'SystemUser' }]),
    ).toBe(false);
  });
});

describe('reloadFormModelRoutes', () => {
  beforeEach(() => {
    resetFormModelReloadState();
  });

  it('registers every view of the same form', async () => {
    // 去重键只用 formKey 时，除第一个视图外全部注册不上 —— 用户点第二个菜单会 404
    const router = fakeRouter();

    await reloadFormModelRoutes(router as any, [
      { path: '/form-model/orders/pending', meta: { formKey: 'orders', viewKey: 'pending' } },
      { path: '/info/done-orders', meta: { formKey: 'orders', viewKey: 'done' } },
    ]);

    expect(router.routes.map((route) => route.path)).toEqual([
      '/form-model/orders/pending',
      '/info/done-orders',
    ]);
  });

  it('still collapses an exact duplicate menu entry', async () => {
    const router = fakeRouter();

    await reloadFormModelRoutes(router as any, [
      { meta: { formKey: 'orders', viewKey: 'pending' } },
      { meta: { formKey: 'orders', viewKey: 'pending' } },
    ]);

    expect(router.addRoute).toHaveBeenCalledTimes(1);
  });

  it('skips menu entries missing either key', async () => {
    // 缺 viewKey 的菜单项来自旧缓存，注册它会造出一条打不开的路由
    const router = fakeRouter();

    await reloadFormModelRoutes(router as any, [
      { meta: { formKey: 'orders' } },
      { meta: { viewKey: 'pending' } },
      {},
    ]);

    expect(router.addRoute).not.toHaveBeenCalled();
  });

  it('drops routes that are no longer granted on reload', async () => {
    const router = fakeRouter();
    await reloadFormModelRoutes(router as any, [
      { meta: { formKey: 'orders', viewKey: 'pending' } },
    ]);
    resetFormModelReloadState();

    await reloadFormModelRoutes(router as any, []);

    expect(router.routes).toHaveLength(0);
  });
});

describe('collectFormModelMenus', () => {
  it('finds views nested under a parent menu node', () => {
    // 视图可以挂到任意静态节点下，不再只出现在顶层
    const collected = collectFormModelMenus([
      {
        name: 'SystemManagement',
        children: [
          { meta: { formKey: 'orders', viewKey: 'pending' } },
          { name: 'SystemUser' },
        ],
      },
    ]);

    expect(collected).toHaveLength(1);
    expect(collected[0]?.meta?.viewKey).toBe('pending');
  });
});
