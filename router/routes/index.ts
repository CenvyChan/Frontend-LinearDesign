import type { RouteRecordRaw } from 'vue-router';

import { mergeRouteModules, traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';
import phase0Routes from './modules/phase0';
import { $t } from '#/locales';

const dynamicRouteFiles = import.meta.glob(
  [
    './modules/**/*.ts',
    '!./modules/**/*.spec.ts',
    '!./modules/**/*.test.ts',
    '!./modules/phase0.ts',
  ],
  {
    eager: true,
  },
);

// 有需要可以自行打开注释，并创建文件夹
// const externalRouteFiles = import.meta.glob('./external/**/*.ts', { eager: true });
// const staticRouteFiles = import.meta.glob('./static/**/*.ts', { eager: true });

/** 动态路由 */
const dynamicRoutes: RouteRecordRaw[] = mergeRouteModules(dynamicRouteFiles);

/** 外部路由列表，访问这些页面可以不需要Layout，可能用于内嵌在别的系统(不会显示在菜单中) */
const externalRoutes: RouteRecordRaw[] = [
  ...phase0Routes,
  {
    name: 'UtilsDocumentPreview',
    path: '/utils/documentPreview',
    component: () => import('#/views/utils/document-preview.vue'),
    meta: {
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: '文档预览',
    },
  },
  {
    name: 'ProductionOrderPrint',
    path: '/production/order/:id/print',
    component: () => import('#/views/production/order-print.vue'),
    meta: {
      hideInMenu: true,
      title: $t('page.production.orderPrint'),
      permission: 'production:order',
      keepAlive: true,
    },
  },
];
const staticRoutes: RouteRecordRaw[] = [];

/** 路由列表，由基本路由、外部路由和404兜底路由组成
 *  无需走权限验证（会一直显示在菜单中） */
const routes: RouteRecordRaw[] = [
  ...coreRoutes,
  ...externalRoutes,
  fallbackNotFoundRoute,
];

/** 基本路由列表，这些路由不需要进入权限拦截 */
const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);

/** 有权限校验的路由列表，包含动态路由和静态路由 */
const accessRoutes = [...dynamicRoutes, ...staticRoutes];
export { accessRoutes, coreRouteNames, routes };
