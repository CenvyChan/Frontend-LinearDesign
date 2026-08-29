import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:shield-check',
      order: 3,
      title: '\u8d28\u91cf\u7ba1\u7406',
    },
    name: 'QualityManagement',
    path: '/quality',
    children: [
      {
        name: 'InspectionTasks',
        path: '/quality/inspection-tasks',
        component: () => import('#/views/production/inspection-tasks-v2.vue'),
        meta: {
          icon: 'lucide:clipboard-check',
          title: '\u68c0\u9a8c\u4efb\u52a1',
          permission: 'production:inspection-task',
                  },
      },
      {
        name: 'InspectionTasksLegacy',
        path: '/quality/inspection-tasks-legacy',
        component: () => import('#/views/production/inspection-tasks.vue'),
        meta: {
          hideInMenu: true,
          title: '\u68c0\u9a8c\u4efb\u52a1 Legacy',
          permission: 'production:inspection-task',
                  },
      },
      {
        name: 'InspectionTasksV2',
        path: '/quality/inspection-tasks-v2',
        component: () => import('#/views/production/inspection-tasks-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:clipboard-check',
          title: '\u68c0\u9a8c\u4efb\u52a1 V2',
          permission: 'production:inspection-task',
          keepAlive: true,
        },
      },
      {
        name: 'InspectionSchemes',
        path: '/quality/inspection-schemes',
        component: () => import('#/views/production/inspection-schemes-v2.vue'),
        meta: {
          icon: 'lucide:clipboard-list',
          title: '\u68c0\u9a8c\u65b9\u6848',
          permission: 'production:inspection-scheme',
                  },
      },
      {
        name: 'InspectionSchemesLegacy',
        path: '/quality/inspection-schemes-legacy',
        component: () => import('#/views/production/inspection-schemes.vue'),
        meta: {
          hideInMenu: true,
          title: '\u68c0\u9a8c\u65b9\u6848 Legacy',
          permission: 'production:inspection-scheme',
                  },
      },
      {
        name: 'InspectionSchemesV2',
        path: '/quality/inspection-schemes-v2',
        component: () => import('#/views/production/inspection-schemes-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:clipboard-list',
          title: '\u68c0\u9a8c\u65b9\u6848 V2',
          permission: 'production:inspection-scheme',
          keepAlive: true,
        },
      },
      {
        name: 'InspectionReports',
        path: '/quality/inspection-reports',
        component: () => import('#/views/production/inspection-reports-v2.vue'),
        meta: {
          icon: 'lucide:chart-no-axes-combined',
          title: '\u68c0\u9a8c\u62a5\u8868',
          permission: 'production:inspection-report',
                  },
      },
      {
        name: 'InspectionReportsLegacy',
        path: '/quality/inspection-reports-legacy',
        component: () => import('#/views/production/inspection-reports.vue'),
        meta: {
          hideInMenu: true,
          title: '\u68c0\u9a8c\u62a5\u8868 Legacy',
          permission: 'production:inspection-report',
                  },
      },
      {
        name: 'InspectionReportsV2',
        path: '/quality/inspection-reports-v2',
        component: () => import('#/views/production/inspection-reports-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:chart-no-axes-combined',
          title: '\u68c0\u9a8c\u62a5\u8868 V2',
          permission: 'production:inspection-report',
          keepAlive: true,
        },
      },
    ],
  },
];

export default routes;
