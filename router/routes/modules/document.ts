import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:folder-kanban',
      order: 6,
      title: '文档中心',
    },
    name: 'DocumentCenter',
    path: '/document',
    children: [
      {
        name: 'MaterialDocumentExportTasks',
        path: '/document/export-tasks',
        component: () => import('#/views/document/export-tasks.vue'),
        meta: {
          icon: 'lucide:file-archive',
          title: '导出任务中心',
          permission: 'production:bom-document:export',
          keepAlive: true,
        },
      },
    ],
  },
];

export default routes;
