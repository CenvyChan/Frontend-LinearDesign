import type { RouteRecordRaw } from 'vue-router';

/**
 * 表单建模设计器静态路由。
 *
 * 草稿预览是隐藏路由：它通过受保护的 `/api/form-model/designer/{formKey}/preview-schema`
 * 读取草稿，不进入动态表单菜单，也不渲染后端 HTML（iframe 导航拿不到内存中的 Bearer token）。
 * 设计器列表/编辑入口在其后端 CRUD 端点落地后再补，避免出现不可用菜单。
 */
const routes: RouteRecordRaw[] = [
  {
    name: 'FormModelDesigner',
    path: '/form-model/designer',
    component: () => import('#/views/form-model/designer/index.vue'),
    meta: { icon: 'lucide:form-input', title: '表单设计器', permission: 'form-model:design' },
  },
  {
    name: 'FormModelDesignerEdit',
    path: '/form-model/designer/:formKey',
    component: () => import('#/views/form-model/designer/edit.vue'),
    meta: { hideInMenu: true, title: '编辑表单', permission: 'form-model:design' },
  },
  {
    name: 'FormModelDesignerPreview',
    path: '/form-model/preview/:formKey',
    component: () => import('#/views/form-model/designer/preview.vue'),
    meta: {
      hideInMenu: true,
      hideInTab: true,
      title: '表单草稿预览',
      permission: 'form-model:design',
    },
  },
];

export default routes;
