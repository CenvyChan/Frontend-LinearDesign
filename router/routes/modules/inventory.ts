import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:package',
      order: 4,
      title: $t('page.inventory.title'),
    },
    name: 'InventoryManagement',
    path: '/inventory',
    children: [
      {
        name: 'InventoryQuery',
        path: '/inventory/query',
        component: () => import('#/views/inventory/index.vue'),
        meta: {
          icon: 'lucide:search',
          title: $t('page.inventory.query'),
          permission: 'inventory:query',
          keepAlive: true,
          affix: true,
        },
      },
      {
        name: 'InitialInventorySync',
        path: '/inventory/initialization',
        component: () => import('#/views/inventory/initialization.vue'),
        meta: { icon: 'lucide:database-zap', title: '初始库存同步', permission: 'inventory:wms-adjustment:init', keepAlive: true },
      },
      {
        name: 'WmsLocationInventory',
        path: '/inventory/wms-location-inventory',
        component: () => import('#/views/inventory/wms-location-inventory.vue'),
        meta: { icon: 'lucide:warehouse', title: 'WMS库位库存', permission: 'inventory:query', keepAlive: true },
      },
      {
        name: 'PurchaseQuery',
        path: '/inventory/purchase-query',
        component: () => import('#/views/inventory/purchase-query.vue'),
        meta: {
          icon: 'lucide:file-search',
          title: '采购查询',
          permission: 'inventory:purchase-query',
          keepAlive: true,
        },
      },
      {
        name: 'ErpOperations',
        path: '/inventory/erp-operations',
        component: () => import('#/views/inventory/erp-operations.vue'),
        meta: {
          icon: 'lucide:activity',
          title: 'ERP/WMS 运维台',
          permission: 'inventory:erp-audit-exception:view',
          keepAlive: true,
        },
      },
      {
        name: 'WmsReconcile',
        path: '/inventory/wms-reconcile',
        component: () => import('#/views/inventory/wms-reconcile.vue'),
        meta: {
          icon: 'lucide:scan-search',
          title: '定仓差异',
          permission: 'inventory:wms-adjustment:reconcile',
          keepAlive: true,
        },
      },
      {
        name: 'WmsErpDocuments',
        path: '/inventory/wms-erp-documents',
        component: () => import('#/views/inventory/wms-erp-documents.vue'),
        meta: {
          icon: 'lucide:file-stack',
          title: 'ERP单据中心',
          permission: 'inventory:erp-audit-exception:view',
          keepAlive: true,
        },
      },
      {
        name: 'SalesDelivery',
        path: '/inventory/sales-delivery',
        component: () => import('#/views/inventory/sales-delivery.vue'),
        meta: {
          icon: 'lucide:truck',
          title: '销售发货',
          permission: 'inventory:wms-routine:delivery',
          keepAlive: true,
        },
      },
      {
        name: 'PurchaseReceive',
        path: '/inventory/purchase-receive',
        component: () => import('#/views/inventory/purchase-receive.vue'),
        meta: {
          icon: 'lucide:package-open',
          title: '采购收料',
          permission: 'inventory:wms-routine:receive',
          keepAlive: true,
        },
      },
      {
        // 检验退料：判退物料退回供应商，货从未入库（不要求批次与库位）
        name: 'PurchaseInspectionReturn',
        path: '/inventory/purchase-inspection-return',
        component: () =>
          import('#/views/inventory/purchase-inspection-return.vue'),
        meta: {
          icon: 'lucide:undo-2',
          title: '检验退料',
          permission: 'inventory:wms-routine:inspection-return',
          keepAlive: true,
        },
      },
      {
        // 库存退料：已入库物料退回供应商，需要完整库存维度
        name: 'PurchaseStockReturn',
        path: '/inventory/purchase-stock-return',
        component: () => import('#/views/inventory/purchase-stock-return.vue'),
        meta: {
          icon: 'lucide:package-x',
          title: '库存退料',
          permission: 'inventory:wms-routine:stock-return',
          keepAlive: true,
        },
      },
      {
        // 销售退货：客户退货入库，方向与销售发货相反
        name: 'SalesReturn',
        path: '/inventory/sales-return',
        component: () => import('#/views/inventory/sales-return.vue'),
        meta: {
          icon: 'lucide:package-plus',
          title: '销售退货',
          permission: 'inventory:wms-routine:sales-return',
          keepAlive: true,
        },
      },
      {
        name: 'ErpAuditExceptions',
        path: '/inventory/erp-audit-exceptions',
        component: () => import('#/views/inventory/erp-audit-exceptions.vue'),
        meta: {
          icon: 'lucide:shield-alert',
          title: 'ERP\u5f02\u5e38\u51ed\u8bc1',
          permission: 'inventory:erp-audit-exception:view',
          keepAlive: true,
        },
      },
      {
        name: 'WmsTaskPool',
        path: '/inventory/wms-task-pool',
        component: () => import('#/views/inventory/wms-task-pool.vue'),
        meta: {
          icon: 'lucide:clipboard-list',
          title: 'WMS任务池',
          permission: 'inventory:wms-routine:task',
          keepAlive: true,
        },
      },
      {
        name: 'BarcodeDesignPrint',
        path: '/inventory/barcode-design-print',
        component: () => import('#/views/inventory/barcode-design-print.vue'),
        meta: {
          icon: 'lucide:scan-barcode',
          title: '条码设计打印',
          permission: 'inventory:barcode',
          keepAlive: true,
        },
      },
      {
        name: 'PickTaskPool',
        path: '/inventory/pick-task-pool',
        component: () => import('#/views/production/pick-task-pool-v2.vue'),
        meta: {
          icon: 'lucide:list-checks',
          title: '\u9886\u8865\u6599\u5907\u6599\u6c60',
          permission: 'inventory:wms-routine:pick',
                  },
      },
      {
        name: 'PickTaskPoolLegacy',
        path: '/inventory/pick-task-pool-legacy',
        component: () => import('#/views/production/pick-task-pool.vue'),
        meta: {
          hideInMenu: true,
          title: '\u5907\u6599\u4efb\u52a1\u6c60 Legacy',
          permission: 'inventory:wms-routine:pick',
                  },
      },
      {
        name: 'PickTaskPoolV2',
        path: '/inventory/pick-task-pool-v2',
        component: () => import('#/views/production/pick-task-pool-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:list-checks',
          title: '\u9886\u8865\u6599\u5907\u6599\u6c60 V2',
          permission: 'inventory:wms-routine:pick',
          keepAlive: true,
        },
      },
      {
        name: 'ReturnTaskPool',
        path: '/inventory/return-task-pool',
        component: () => import('#/views/production/return-task-pool-v2.vue'),
        meta: {
          icon: 'lucide:rotate-ccw',
          title: '\u9000\u6599\u5904\u7406\u6c60',
          permission: 'inventory:wms-routine:return',
                  },
      },
      {
        name: 'ReturnTaskPoolLegacy',
        path: '/inventory/return-task-pool-legacy',
        component: () => import('#/views/production/return-task-pool.vue'),
        meta: {
          hideInMenu: true,
          title: '\u9000\u6599\u5904\u7406\u6c60 Legacy',
          permission: 'inventory:wms-routine:return',
                  },
      },
      {
        name: 'ReturnTaskPoolV2',
        path: '/inventory/return-task-pool-v2',
        component: () => import('#/views/production/return-task-pool-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:rotate-ccw',
          title: '\u9000\u6599\u5904\u7406\u6c60 V2',
          permission: 'inventory:wms-routine:return',
          keepAlive: true,
        },
      },
      {
        name: 'FeedTaskPool',
        path: '/inventory/feed-task-pool',
        component: () => import('#/views/production/feed-task-pool-v2.vue'),
        meta: {
          icon: 'lucide:package-plus',
          title: '\u8865\u6599\u4efb\u52a1\u6c60',
          permission: 'inventory:wms-routine:feed',
                  },
      },
      {
        name: 'FeedTaskPoolLegacy',
        path: '/inventory/feed-task-pool-legacy',
        component: () => import('#/views/production/feed-task-pool.vue'),
        meta: {
          hideInMenu: true,
          title: '\u8865\u6599\u4efb\u52a1\u6c60 Legacy',
          permission: 'inventory:wms-routine:feed',
                  },
      },
      {
        name: 'FeedTaskPoolV2',
        path: '/inventory/feed-task-pool-v2',
        component: () => import('#/views/production/feed-task-pool-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:package-plus',
          title: '\u8865\u6599\u4efb\u52a1\u6c60 V2',
          permission: 'inventory:wms-routine:feed',
          keepAlive: true,
        },
      },
      {
        name: 'ProductionInstockPool',
        path: '/inventory/production-instock',
        component: () => import('#/views/inventory/production-instock-v2.vue'),
        meta: {
          icon: 'lucide:package-check',
          title: '\u751f\u4ea7\u5165\u5e93\u786e\u8ba4\u6c60',
          permission: 'inventory:wms-routine:instock',
                  },
      },
      {
        name: 'ProductionInstockPoolLegacy',
        path: '/inventory/production-instock-legacy',
        component: () => import('#/views/inventory/production-instock.vue'),
        meta: {
          hideInMenu: true,
          title: '\u751f\u4ea7\u5165\u5e93\u786e\u8ba4\u6c60 Legacy',
          permission: 'inventory:wms-routine:instock',
                  },
      },
      {
        name: 'ProductionInstockPoolV2',
        path: '/inventory/production-instock-v2',
        component: () => import('#/views/inventory/production-instock-v2.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:package-check',
          title: '\u751f\u4ea7\u5165\u5e93\u786e\u8ba4\u6c60 V2',
          permission: 'inventory:wms-routine:instock',
        },
      },
    ],
  },
];

export default routes;
