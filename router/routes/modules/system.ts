import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 10,
      title: $t('page.system.title'),
    },
    name: 'SystemManagement',
    path: '/system',
    children: [
      {
        name: 'SystemUser',
        path: '/system/user',
        component: () => import('#/views/system/user/index.vue'),
        meta: {
          icon: 'lucide:users',
          title: $t('page.system.user'),
          permission: 'system:user',
        },
      },
      {
        name: 'SystemRole',
        path: '/system/role',
        component: () => import('#/views/system/role/index.vue'),
        meta: {
          icon: 'lucide:shield',
          title: $t('page.system.role'),
          permission: 'system:role',
        },
      },
      {
        name: 'SystemConfig',
        path: '/system/config',
        component: () => import('#/views/system/config/index.vue'),
        meta: {
          icon: 'lucide:sliders',
          title: $t('page.system.config'),
          permission: 'system:config',
        },
      },
      {
        name: 'SystemStatusDictionary',
        path: '/system/status-dictionary',
        component: () => import('#/views/system/status-dictionary/index.vue'),
        meta: {
          icon: 'lucide:languages',
          title: '状态文案维护',
          permission: 'system:status-dictionary:manage',
        },
      },
      {
        name: 'MasterDataImportExport',
        path: '/system/master-data-import-export',
        component: () => import('#/views/system/master-data-import-export.vue'),
        meta: {
          icon: 'lucide:file-spreadsheet',
          title: '\u57fa\u7840\u8d44\u6599\u5bfc\u5165\u5bfc\u51fa',
          permission: 'system:config',
        },
      },
      {
        name: 'SystemDictionary',
        path: '/system/dictionary',
        component: () => import('#/views/system/dictionary.vue'),
        meta: {
          icon: 'lucide:book-open-check',
          title: '公共字典管理',
          permission: 'system:dictionary',
        },
      },
      {
        name: 'DingTalkConfig',
        path: '/system/dingtalk',
        component: () => import('#/views/system/dingtalk.vue'),
        meta: {
          icon: 'lucide:message-circle',
          title: $t('page.system.dingtalk'),
          permission: 'system:dingtalk',
        },
      },
      {
        name: 'NotificationRule',
        path: '/system/notification-rule',
        component: () => import('#/views/system/notification-rule.vue'),
        meta: {
          icon: 'lucide:bell',
          title: $t('page.system.notificationRule'),
          permission: 'system:notification-rule',
        },
      },
      {
        name: 'NotificationLog',
        path: '/system/notification-log',
        component: () => import('#/views/system/notification-log.vue'),
        meta: {
          icon: 'lucide:list',
          title: $t('page.system.notificationLog'),
          permission: 'system:notification-log',
        },
      },
      {
        name: 'SystemFeedback',
        path: '/system/feedback',
        component: () => import('#/views/system/feedback.vue'),
        meta: {
          icon: 'lucide:message-square-plus',
          title: $t('page.system.feedback'),
          permission: 'system:feedback',
        },
      },
      {
        name: 'ErpOperatorMapping',
        path: '/system/erp-operator-mapping',
        component: () => import('#/views/system/erp-operator-mapping-v2.vue'),
        meta: {
          icon: 'lucide:id-card',
          title: 'MES\u804c\u8d23\u4e0e\u6570\u636e\u8303\u56f4',
          permission: 'system:erp-operator-mapping',
        },
      },
      {
        name: 'ErpOperatorMappingLegacy',
        path: '/system/erp-operator-mapping-legacy',
        component: () => import('#/views/system/erp-operator-mapping.vue'),
        meta: {
          hideInMenu: true,
          title: 'ERP\u4eba\u5458\u6620\u5c04 Legacy',
          permission: 'system:erp-operator-mapping',
        },
      },
      {
        name: 'ErpOperatorMappingV2',
        path: '/system/erp-operator-mapping-v2',
        component: () => import('#/views/system/erp-operator-mapping-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:id-card',
          title: 'ERP\u4eba\u5458\u6620\u5c04 V2',
          permission: 'system:erp-operator-mapping',
        },
      },
    ],
  },
];

export default routes;
