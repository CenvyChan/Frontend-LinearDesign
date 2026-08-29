import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:factory',
      order: 3,
      title: $t('page.factory.title'),
    },
    name: 'FactoryModeling',
    path: '/factory',
    children: [
      {
        name: 'FactoryWorkCenter',
        path: '/factory/work-center',
        component: () => import('#/views/factory/work-center.vue'),
        meta: {
          icon: 'lucide:building-2',
          title: $t('page.factory.workCenter'),
          permission: 'factory:work-center',
        },
      },
      {
        name: 'FactoryMachine',
        path: '/factory/machine',
        component: () => import('#/views/factory/machine.vue'),
        meta: {
          icon: 'lucide:monitor',
          title: $t('page.factory.machine'),
          permission: 'factory:machine',
        },
      },
      {
        name: 'FactoryTooling',
        path: '/factory/tooling',
        component: () => import('#/views/factory/tooling.vue'),
        meta: {
          icon: 'lucide:wrench',
          title: $t('page.factory.tooling'),
          permission: 'factory:tooling',
        },
      },
      {
        name: 'FactoryGauge',
        path: '/factory/gauge',
        component: () => import('#/views/factory/gauge.vue'),
        meta: {
          icon: 'lucide:ruler',
          title: $t('page.factory.gauge'),
          permission: 'factory:gauge',
        },
      },
      {
        name: 'FactoryMouldManagement',
        path: '/factory/mould-management',
        redirect: '/factory/mould',
        meta: {
          icon: 'lucide:layers',
          title: $t('page.factory.mould'),
        },
        children: [
          {
            name: 'FactoryMould',
            path: '/factory/mould',
            component: () => import('#/views/factory/mould.vue'),
            meta: {
              icon: 'lucide:box',
              title: $t('page.factory.mouldLedger'),
              permission: 'factory:mould',
            },
          },
          {
            name: 'MouldSync',
            path: '/production/mould-sync',
            component: () => import('#/views/production/mould-sync.vue'),
            meta: {
              icon: 'lucide:refresh-cw',
              title: $t('page.factory.mouldSync'),
              permission: 'production:mould-lifecycle',
              keepAlive: true,
            },
          },
          {
            name: 'ProductionMouldLifecycle',
            path: '/production/mould',
            component: () => import('#/views/production/mould.vue'),
            meta: {
              icon: 'lucide:layers',
              title: $t('page.factory.mouldLifecycle'),
              permission: 'production:mould-lifecycle',
              keepAlive: true,
            },
          },
          {
            name: 'MouldQuote',
            path: '/production/mould-quote',
            component: () => import('#/views/production/mould-quote-v2.vue'),
            meta: {
              icon: 'lucide:calculator',
              title: $t('page.factory.mouldQuote'),
              permission: 'production:mould-quote',
              keepAlive: true,
            },
          },
        ],
      },
      {
        name: 'MouldQuoteLegacy',
        path: '/production/mould-quote-legacy',
        component: () => import('#/views/production/mould-quote.vue'),
        meta: {
          hideInMenu: true,
          title: '模具报价分析 Legacy',
          permission: 'production:mould-quote',
          keepAlive: true,
        },
      },
      {
        name: 'MouldQuoteV2',
        path: '/production/mould-quote-v2',
        component: () => import('#/views/production/mould-quote-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:calculator',
          title: '模具报价分析 V2',
          permission: 'production:mould-quote',
          keepAlive: true,
        },
      },
      {
        name: 'FactoryPreCheck',
        path: '/factory/precheck',
        component: () => import('#/views/factory/precheck-config.vue'),
        meta: {
          icon: 'lucide:shield-check',
          title: $t('page.factory.precheck'),
          permission: 'factory:precheck',
        },
      },
    ],
  },
];

export default routes;
