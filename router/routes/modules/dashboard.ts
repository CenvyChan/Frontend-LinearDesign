import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/dashboard',
    // Vben 自带的演示页 `/analytics` 与 `/workspace` 已下线，V2 两页取代它们。
    // 菜单可见性由后端 MenuController 决定（accessMode: 'backend'），所以那边
    // 也删了对应节点；这里同步删除是为了摘掉 `/analytics` 上的 `affixTab: true`
    // —— 固定页签在菜单之外另有一条注册路径，只删后端节点会留下一个打不开的页签。
    children: [
      {
        name: 'DashboardOverviewV2',
        path: '/dashboard/overview-v2',
        component: () => import('#/views/dashboard/overview-v2/index.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:layout-grid',
          title: $t('page.dashboard.overviewV2'),
        },
      },
      {
        name: 'DashboardAnalyticsV2',
        path: '/dashboard/analytics-v2',
        component: () => import('#/views/dashboard/analytics-v2/index.vue'),
        meta: {
          fullPathKey: false,
          icon: 'lucide:bar-chart-3',
          title: $t('page.dashboard.analyticsV2'),
        },
      },
      {
        name: 'DashboardWorkspaceV2',
        path: '/dashboard/workspace-v2',
        component: () => import('#/views/dashboard/workspace-v2/index.vue'),
        meta: {
          fullPathKey: false,
          icon: 'lucide:briefcase-business',
          title: $t('page.dashboard.workspaceV2'),
        },
      },
      {
        name: 'DashboardAnalyticsScenarioV2',
        path: '/dashboard/overview-v2/analytics/:code',
        component: () => import('#/views/dashboard/overview-v2/scenario.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.dashboard.analyticsScenarioV2'),
        },
      },
      {
        name: 'DashboardWorkspaceScenarioV2',
        path: '/dashboard/overview-v2/workspace/:code',
        component: () => import('#/views/dashboard/overview-v2/scenario.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.dashboard.workspaceScenarioV2'),
        },
      },
    ],
  },
];

export default routes;
