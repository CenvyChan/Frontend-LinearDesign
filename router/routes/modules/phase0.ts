import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        name: 'Phase0FormModeler',
        path: '/phase0/form-modeler',
        component: () =>
          import('#/phase0/form-model/BpmnModelerProbe.vue'),
        meta: {
          hideInMenu: true,
          hideInTab: true,
          ignoreAccess: true,
          title: '流程设计器验证',
        },
      },
    ]
  : [];

export default routes;
