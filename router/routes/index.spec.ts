import { describe, expect, it, vi } from 'vitest';

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@vben/constants', () => ({
  LOGIN_PATH: '/auth/login',
}));

import { accessRoutes } from './index';

function findRouteByName(routes: any[], name: string): any | undefined {
  for (const route of routes) {
    if (route.name === name) {
      return route;
    }
    const child = findRouteByName(route.children ?? [], name);
    if (child) {
      return child;
    }
  }
}

describe('access routes', () => {
  it('loads module routes that back hidden business pages', () => {
    expect(accessRoutes.length).toBeGreaterThan(0);

    expect(findRouteByName(accessRoutes, 'ProcessRouteAdd')).toMatchObject({
      path: '/production/process-route/add',
      meta: expect.objectContaining({ hideInMenu: true }),
    });
    expect(findRouteByName(accessRoutes, 'ProcessRouteView')).toMatchObject({
      path: '/production/process-route/view/:id',
      meta: expect.objectContaining({ hideInMenu: true }),
    });
    expect(findRouteByName(accessRoutes, 'ProcessRouteEdit')).toMatchObject({
      path: '/production/process-route/edit/:id',
      meta: expect.objectContaining({ hideInMenu: true }),
    });
  });

  // Vben 自带的两个演示页已被 V2 取代。菜单可见性由后端决定
  // （accessMode: 'backend'），但 `/analytics` 曾带 `affixTab: true` ——
  // 固定页签走的是菜单之外的另一条注册路径，所以静态路由这边也必须不存在，
  // 否则会留下一个打不开的常驻页签。
  it('不再注册已下线的 /analytics 与 /workspace 演示页', () => {
    expect(findRouteByName(accessRoutes, 'Analytics')).toBeUndefined();
    expect(findRouteByName(accessRoutes, 'Workspace')).toBeUndefined();
  });

  it('没有任何静态路由带 affixTab —— 常驻页签必须指向仍然存在的页面', () => {
    const affixed: string[] = [];
    const walk = (routes: any[]) => {
      for (const route of routes) {
        if (route.meta?.affixTab) affixed.push(String(route.name));
        walk(route.children ?? []);
      }
    };
    walk(accessRoutes);

    expect(affixed).toEqual([]);
  });
});
