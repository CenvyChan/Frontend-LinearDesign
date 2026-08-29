import { describe, expect, it, vi } from 'vitest';

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

import dashboardRoutes from './dashboard';

describe('dashboard routes', () => {
  it('keeps analytics and workspace V2 query switching inside one tab', () => {
    const dashboard = dashboardRoutes.find((route) => route.name === 'Dashboard');
    const children = dashboard?.children || [];

    expect(children.find((route) => route.name === 'DashboardAnalyticsV2')?.meta).toMatchObject({
      fullPathKey: false,
    });
    expect(children.find((route) => route.name === 'DashboardWorkspaceV2')?.meta).toMatchObject({
      fullPathKey: false,
    });
  });
});
