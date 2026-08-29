import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings-2',
      order: 2,
      title: $t('page.production.title'),
    },
    name: 'ProductionManagement',
    path: '/production',
    children: [
      {
        name: 'ProductionOrder',
        path: '/production/order',
        component: () => import('#/views/production/order/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: $t('page.production.order'),
          permission: 'production:order',
          keepAlive: true,
        },
      },
      {
        name: 'ProductionOrderDetail',
        path: '/production/order/:id',
        component: () => import('#/views/production/order-detail.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.production.orderDetail'),
          permission: 'production:order',
                  },
      },
      {
        name: 'ProductionReportTasks',
        path: '/production/production-report-tasks',
        component: () => import('#/views/production/production-report-tasks.vue'),
        meta: {
          icon: 'lucide:clipboard-check',
          title: '生产汇报工作台',
          permission: 'production:report',
          keepAlive: true,
        },
      },
      {
        name: 'BomExpand',
        path: '/production/bom-expand',
        component: () => import('#/views/production/bom-expand.vue'),
        meta: {
          icon: 'lucide:git-merge',
          title: $t('page.production.bomExpand'),
          permission: 'production:bom-expand',
          keepAlive: true,
        },
      },
      {
        name: 'ProcessRoute',
        path: '/production/process-route',
        component: () => import('#/views/production/process-route.vue'),
        meta: {
          icon: 'lucide:route',
          title: $t('page.production.processRoute'),
          permission: 'production:process-route',
          keepAlive: true,
        },
      },
      {
        name: 'ProcessPool',
        path: '/production/process-pool',
        component: () => import('#/views/production/process-pool-v2.vue'),
        meta: {
          icon: 'lucide:workflow',
          title: '\u5de5\u5e8f\u6c60',
          permission: 'production:process-pool',
                  },
      },
      {
        name: 'ProcessPoolLegacy',
        path: '/production/process-pool-legacy',
        component: () => import('#/views/production/process-pool.vue'),
        meta: {
          hideInMenu: true,
          title: '\u5de5\u5e8f\u6c60 Legacy',
          permission: 'production:process-pool',
                  },
      },
      {
        name: 'ProcessPoolV2',
        path: '/production/process-pool-v2',
        component: () => import('#/views/production/process-pool-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:workflow',
          title: '\u5de5\u5e8f\u6c60 V2',
          permission: 'production:process-pool',
          keepAlive: true,
        },
      },
      {
        name: 'ProcessWage',
        path: '/production/process-wage',
        component: () => import('#/views/production/process-wage-v2.vue'),
        meta: {
          icon: 'lucide:wallet-cards',
          title: '\u5de5\u8d44\u6838\u7b97',
          permission: 'production:process-wage',
                  },
      },
      {
        name: 'ProcessWageLegacy',
        path: '/production/process-wage-legacy',
        component: () => import('#/views/production/process-wage.vue'),
        meta: {
          hideInMenu: true,
          title: '\u5de5\u8d44\u6838\u7b97 Legacy',
          permission: 'production:process-wage',
                  },
      },
      {
        name: 'ProcessWageV2',
        path: '/production/process-wage-v2',
        component: () => import('#/views/production/process-wage-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:wallet-cards',
          title: '\u5de5\u8d44\u6838\u7b97 V2',
          permission: 'production:process-wage',
          keepAlive: true,
        },
      },
      {
        name: 'ProcessTimeReport',
        path: '/production/process-time-report',
        component: () => import('#/views/production/process-time-report-v2.vue'),
        meta: {
          icon: 'lucide:gauge',
          title: '\u5de5\u65f6\u8282\u62cd\u62a5\u8868',
          permission: 'production:process-wage',
                  },
      },
      {
        name: 'ProcessTimeReportLegacy',
        path: '/production/process-time-report-legacy',
        component: () => import('#/views/production/process-time-report.vue'),
        meta: {
          hideInMenu: true,
          title: '\u5de5\u65f6\u8282\u62cd\u62a5\u8868 Legacy',
          permission: 'production:process-wage',
                  },
      },
      {
        name: 'ProcessTimeReportV2',
        path: '/production/process-time-report-v2',
        component: () => import('#/views/production/process-time-report-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:gauge',
          title: '\u5de5\u65f6\u8282\u62cd\u62a5\u8868 V2',
          permission: 'production:process-wage',
          keepAlive: true,
        },
      },
      {
        name: 'OrderLifecycleDiagnostics',
        path: '/production/order-lifecycle-diagnostics',
        component: () => import('#/views/production/order-lifecycle-diagnostics-v2.vue'),
        meta: {
          icon: 'lucide:scan-search',
          title: '\u5de5\u5355\u751f\u547d\u5468\u671f\u8bca\u65ad',
          permission: 'production:order',
                  },
      },
      {
        name: 'OrderLifecycleDiagnosticsLegacy',
        path: '/production/order-lifecycle-diagnostics-legacy',
        component: () => import('#/views/production/order-lifecycle-diagnostics-legacy.vue'),
        meta: {
          hideInMenu: true,
          title: '\u5de5\u5355\u751f\u547d\u5468\u671f\u8bca\u65ad Legacy',
          permission: 'production:order',
        },
      },
      {
        name: 'OrderLifecycleDiagnosticsV2',
        path: '/production/order-lifecycle-diagnostics-v2',
        component: () => import('#/views/production/order-lifecycle-diagnostics-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:activity',
          title: '\u5de5\u5355\u751f\u547d\u5468\u671f\u8bca\u65ad V2',
          permission: 'production:order',
          keepAlive: true,
        },
      },
      {
        name: 'ProcessRouteAdd',
        path: '/production/process-route/add',
        component: () => import('#/views/production/process-route.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.production.processRouteAdd'),
          permission: 'production:process-route',
                  },
      },
      {
        name: 'ProcessRouteEdit',
        path: '/production/process-route/edit/:id',
        component: () => import('#/views/production/process-route.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.production.processRouteEdit'),
          permission: 'production:process-route',
                  },
      },
      {
        name: 'ProcessRouteView',
        path: '/production/process-route/view/:id',
        component: () => import('#/views/production/process-route.vue'),
        meta: {
          hideInMenu: true,
          title: $t('page.production.processRouteView'),
          permission: 'production:process-route',
                  },
      },
      {
        name: 'MetalPrice',
        path: '/production/metal-price',
        component: () => import('#/views/production/metal-price.vue'),
        meta: {
          icon: 'lucide:trending-up',
          title: $t('page.production.metalPrice'),
          permission: 'production:metal-price',
          keepAlive: true,
        },
      },
      {
        name: 'ExceptionDashboard',
        path: '/production/exception-dashboard',
        component: () => import('#/views/production/exception-dashboard.vue'),
        meta: {
          icon: 'lucide:alert-triangle',
          title: $t('page.production.exceptionDashboard'),
          permission: 'production:exception-dashboard',
          keepAlive: true,
        },
      },
    ],
  },
];

export default routes;
