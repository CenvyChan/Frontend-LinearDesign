import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import {
  collectFormModelMenus,
  reloadFormModelRoutes,
} from '#/router/form-model-routes';
import { collectHiddenRoutesToRegister } from '#/router/hidden-routes';
import { accessRoutes } from '#/router/routes';
import { useAccessStore, useTabbarStore } from '@vben/stores';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

// Menu request deduplication flags to prevent multiple concurrent requests
let isFetchingMenus = false;
let cachedMenus: any[] | null = null;

/**
 * 最近一次菜单响应携带的租户菜单版本。
 * 授权变更后后端会递增该值，供后续「是否需要重载动态路由」判断使用。
 */
let lastMenuVersion = 0;

/** 读取最近一次菜单响应的 menuVersion */
export function getLastMenuVersion() {
  return lastMenuVersion;
}

/**
 * 当前用户是否具备该路由 `meta.permission` 声明的权限。
 *
 * 补注册 hideInMenu 路由（`access.ts`）与"动态路由是否完整"的校验（`guard.ts`）
 * 必须使用同一判定：若一侧按权限过滤、另一侧仍期望全部 hideInMenu 路由都已注册，
 * 校验会永远失败并触发 `clearMenuCache()` → 重新生成 → 无限请求 `/api/menu/all`。
 */
export function hasRoutePermission(route: {
  meta?: Record<string, any>;
}): boolean {
  const permission = route.meta?.permission;
  if (!permission) return true;
  const accessCodes = new Set(useAccessStore().accessCodes ?? []);
  return accessCodes.has('*') || accessCodes.has(String(permission));
}

function ensureProductionMenuItems(menus: any[]) {
  const patchedMenus = JSON.parse(JSON.stringify(menus));
  const productionMenu = patchedMenus.find(
    (item: any) => item?.name === 'ProductionManagement' || item?.path === '/production',
  );

  if (!productionMenu) {
    return patchedMenus;
  }

  productionMenu.children = Array.isArray(productionMenu.children)
    ? productionMenu.children
    : [];

  const ensureChild = (child: any) => {
    const exists = productionMenu.children.some(
      (item: any) => item?.name === child.name || item?.path === child.path,
    );
    if (!exists) {
      productionMenu.children.push(child);
    }
  };

  ensureChild({
    component: '/production/order-detail',
    meta: {
      hideInMenu: true,
      permission: 'production:order',
      title: '工单详情',
    },
    name: 'ProductionOrderDetail',
    path: '/production/order/:id',
  });

  ensureChild({
    component: '/production/order-lifecycle-diagnostics-v2',
    meta: {
      icon: 'lucide:scan-search',
      permission: 'production:order',
      title: '工单生命周期诊断',
    },
    name: 'OrderLifecycleDiagnostics',
    path: '/production/order-lifecycle-diagnostics',
  });

  return patchedMenus;
}

function ensureFactoryMouldMenuItems(menus: any[]) {
  const patchedMenus = JSON.parse(JSON.stringify(menus));
  const factoryMenu = patchedMenus.find(
    (item: any) => item?.name === 'FactoryModeling' || item?.path === '/factory',
  );

  if (!factoryMenu) {
    return patchedMenus;
  }

  factoryMenu.children = Array.isArray(factoryMenu.children)
    ? factoryMenu.children
    : [];

  let mouldGroup = factoryMenu.children.find(
    (item: any) => item?.name === 'FactoryMouldManagement' || item?.path === '/factory/mould-management',
  );

  if (!mouldGroup) {
    mouldGroup = {
      meta: {
        icon: 'lucide:layers',
        permission: 'factory:mould',
        title: '模具管理',
      },
      name: 'FactoryMouldManagement',
      path: '/factory/mould-management',
      redirect: '/factory/mould',
      children: [],
    };
    factoryMenu.children.push(mouldGroup);
  }

  mouldGroup.children = Array.isArray(mouldGroup.children)
    ? mouldGroup.children
    : [];

  const ensureMouldChild = (child: any) => {
    const exists = mouldGroup.children.some(
      (item: any) => item?.name === child.name || item?.path === child.path,
    );
    if (!exists) {
      mouldGroup.children.push(child);
    }
  };

  const accessStore = useAccessStore();
  const accessCodes = new Set(accessStore.accessCodes ?? []);
  const canUseMouldQuote =
    accessCodes.has('*') ||
    accessCodes.has('production') ||
    accessCodes.has('production:mould-quote') ||
    mouldGroup.children.some(
      (item: any) =>
        item?.path === '/production/mould-quote' ||
        item?.meta?.permission === 'production:mould-quote',
    );

  if (canUseMouldQuote) {
    ensureMouldChild({
      component: '/production/mould-quote-v2',
      meta: {
        icon: 'lucide:calculator',
        permission: 'production:mould-quote',
        title: '模具报价分析',
      },
      name: 'MouldQuote',
      path: '/production/mould-quote',
    });
  }

  return patchedMenus;
}

function ensureSystemMenuItems(menus: any[]) {
  const patchedMenus = JSON.parse(JSON.stringify(menus));
  const systemMenu = patchedMenus.find(
    (item: any) => item?.name === 'SystemManagement' || item?.path === '/system',
  );

  if (!systemMenu) {
    return patchedMenus;
  }

  systemMenu.children = Array.isArray(systemMenu.children)
    ? systemMenu.children
    : [];

  const exists = systemMenu.children.some(
    (item: any) =>
      item?.name === 'MasterDataImportExport' ||
      item?.path === '/system/master-data-import-export',
  );

  if (!exists) {
    systemMenu.children.push({
      component: '/system/master-data-import-export',
      meta: {
        icon: 'lucide:file-spreadsheet',
        permission: 'system:config',
        title: '基础资料导入导出',
      },
      name: 'MasterDataImportExport',
      path: '/system/master-data-import-export',
    });
  }

  return patchedMenus;
}

function promoteAcceptedV2MenuItems(menus: any[]) {
  const patchedMenus = JSON.parse(JSON.stringify(menus));
  const componentByName: Record<string, string> = {
    ErpOperatorMapping: '/system/erp-operator-mapping-v2',
    FeedTaskPool: '/production/feed-task-pool-v2',
    InspectionReports: '/production/inspection-reports-v2',
    InspectionSchemes: '/production/inspection-schemes-v2',
    InspectionTasks: '/production/inspection-tasks-v2',
    MouldQuote: '/production/mould-quote-v2',
    OrderLifecycleDiagnostics: '/production/order-lifecycle-diagnostics-v2',
    PickTaskPool: '/production/pick-task-pool-v2',
    ProcessPool: '/production/process-pool-v2',
    ProcessTimeReport: '/production/process-time-report-v2',
    ProcessWage: '/production/process-wage-v2',
    ProductionInstockPool: '/inventory/production-instock-v2',
    ReturnTaskPool: '/production/return-task-pool-v2',
  };
  const removableV2Names = new Set([
    'ProcessPoolV2',
    'ProcessWageV2',
    'MouldQuoteV2',
    'ProcessTimeReportV2',
    'InspectionTasksV2',
    'InspectionSchemesV2',
    'InspectionReportsV2',
    'PickTaskPoolV2',
    'ReturnTaskPoolV2',
    'FeedTaskPoolV2',
    'ProductionInstockPoolV2',
    'ErpOperatorMappingV2',
  ]);
  const removableV2Paths = new Set([
    '/production/process-pool-v2',
    '/production/process-wage-v2',
    '/production/mould-quote-v2',
    '/production/process-time-report-v2',
    '/quality/inspection-tasks-v2',
    '/quality/inspection-schemes-v2',
    '/quality/inspection-reports-v2',
    '/inventory/pick-task-pool-v2',
    '/inventory/return-task-pool-v2',
    '/inventory/feed-task-pool-v2',
    '/inventory/production-instock-v2',
    '/system/erp-operator-mapping-v2',
  ]);

  const walk = (items: any[]) => {
    for (const item of items) {
      if (item?.name && componentByName[item.name]) {
        item.component = componentByName[item.name];
      }
      if (Array.isArray(item?.children)) {
        item.children = item.children.filter((child: any) => {
          const name = String(child?.name ?? '');
          const path = String(child?.path ?? '');
          return !removableV2Names.has(name) && !removableV2Paths.has(path);
        });
        walk(item.children);
      }
    }
  };

  walk(patchedMenus);
  return patchedMenus;
}

function ensureLocalMenuItems(menus: any[]) {
  return promoteAcceptedV2MenuItems(
    ensureFactoryMouldMenuItems(ensureProductionMenuItems(ensureSystemMenuItems(menus))),
  );
}

// Export function to clear menu cache (call on logout)
export function clearMenuCache() {
  cachedMenus = null;
  isFetchingMenus = false;
  lastMenuVersion = 0;
  console.log('[Route Debug] Menu cache cleared');
}

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      // Only collapse simultaneous calls. Each new access generation must fetch
      // the current menu so revoked permissions remove routes without a cache delay.
      if (isFetchingMenus && cachedMenus) {
        console.log('[Route Debug] Menu is being fetched, returning cached data');
        return ensureLocalMenuItems(cachedMenus);
      }

      console.log('[Route Debug] Fetching current menu data from API');

      ElMessage({
        duration: 1500,
        message: `${$t('common.loadingMenu')}...`,
      });

      console.log('[Route Debug] accessMode:', preferences.app.accessMode);
      console.log('[Route Debug] Available page components:', Object.keys(pageMap));

      try {
        isFetchingMenus = true;

        // 后端 data 为 {menus, menuVersion}，菜单树在 .menus 上
        const menuResponse = await getAllMenusApi();
        const menus = menuResponse.menus;
        lastMenuVersion = menuResponse.menuVersion;
        console.log('[Route Debug] getAllMenusApi returned:', menuResponse);
        console.log(
          '[Route Debug] menus isArray:',
          Array.isArray(menus),
          'menuVersion:',
          lastMenuVersion,
        );

        if (menus && Array.isArray(menus)) {
          console.log('[Route Debug] Fetched menus from API:', JSON.stringify(menus, null, 2));
          const patchedMenus = ensureLocalMenuItems(menus);
          // 深拷贝缓存，避免 convertRoutes 修改缓存对象后再次使用时报错
          cachedMenus = JSON.parse(JSON.stringify(patchedMenus));
          return patchedMenus;
        }
        console.warn('[Route Debug] API returned non-array menu data:', menus);
        return [];
      } catch (error) {
        console.error('[Route Debug] Failed to fetch menus:', error);
        ElMessage.error('Failed to load menu, please check backend service');
        return [];
      } finally {
        isFetchingMenus = false;
      }
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  }).then(async (result) => {
    const { router } = options;

    // 后端菜单加载完成后，以 meta.formKey 为准可重入重载动态表单路由。
    // 无论本轮来自 API 还是缓存，都先 remove 旧路由再 add 当前可见路由，
    // 从而覆盖刷新、重复生成和授权撤销三种场景。
    await reloadFormModelRoutes(
      router,
      collectFormModelMenus(cachedMenus ?? []),
    );

    // ===================================================================
    // 补注册 hideInMenu 的路由（后端模式下不返回不可见路由）
    // 如 ProductionOrderDetail、ProductionOrderPrint 等
    // ===================================================================
    const registeredNames = new Set(
      router.getRoutes().map((r) => r.name as string),
    );

    const hiddenRoutes = collectHiddenRoutesToRegister(
      accessRoutes,
      registeredNames,
      hasRoutePermission,
    );
    const routeNameSet = () =>
      new Set(router.getRoutes().map((r) => String(r.name ?? '')));
    for (const { route, parentName } of hiddenRoutes) {
      const currentNames = routeNameSet();
      if (currentNames.has(String(route.name ?? ''))) {
        continue;
      }

      if (currentNames.has(parentName)) {
        console.log(
          `[Route Debug] Adding hidden route: ${String(route.name)} under ${parentName}`,
        );
        router.addRoute(parentName, route);
        continue;
      }

      console.warn(
        `[Route Debug] Parent route ${parentName} not found for hidden route ${String(route.name)}, registering under Root`,
      );
      router.addRoute('Root', route);
    }

    // ===================================================================
    // 补全 keepAlive meta（后端模式生成的动态路由不含 keepAlive meta）
    // 需要从原始路由配置中读取并注入到已注册的路由记录和标签页存储中
    // ===================================================================
    /** 递归收集需要 keepAlive 的路由名称和路径 */
    const keepAliveNames = new Set<string>();
    const keepAlivePaths = new Set<string>();
    const collectKeepAlive = (
      routes: import('vue-router').RouteRecordRaw[],
    ) => {
      for (const r of routes) {
        if (r.meta?.keepAlive && r.name) {
          keepAliveNames.add(r.name as string);
          if (r.path) {
            keepAlivePaths.add(r.path);
          }
        }
        if (r.children) {
          collectKeepAlive(r.children as import('vue-router').RouteRecordRaw[]);
        }
      }
    };
    collectKeepAlive(accessRoutes);

    console.log(
      `[Route Debug] KeepAlive names to patch: ${[...keepAliveNames].join(', ')}`,
    );
    console.log(
      `[Route Debug] KeepAlive paths to patch: ${[...keepAlivePaths].join(', ')}`,
    );

    // 1. 修补路由记录 meta（同时按名称和路径匹配）
    const allRecords = router.getRoutes();
    for (const record of allRecords) {
      const matchedByName = keepAliveNames.has(record.name as string);
      const matchedByPath =
        record.path && keepAlivePaths.has(record.path);
      if ((matchedByName || matchedByPath) && !record.meta?.keepAlive) {
        record.meta = { ...record.meta, keepAlive: true };
        console.log(
          `[Route Debug] Patched keepAlive on route: ${String(record.name)} (${record.path})`,
        );
      }
    }

    // 2. 修补已存在的标签页 meta（页面刷新后标签页从 sessionStorage 恢复，不含 keepAlive）
    //    也同时按名称和路径匹配
    try {
      const tabbarStore = useTabbarStore();
      if (tabbarStore) {
        for (const tab of tabbarStore.tabs) {
          if (!tab.meta?.keepAlive) {
            const matchedByName = keepAliveNames.has(tab.name as string);
            const matchedByPath =
              tab.path && keepAlivePaths.has(tab.path);
            if (matchedByName || matchedByPath) {
              tab.meta = { ...tab.meta, keepAlive: true };
              console.log(
                `[Route Debug] Patched keepAlive on tab: ${String(tab.name)}`,
              );
            }
          }
        }
        // 3. 重建缓存列表
        tabbarStore.updateCacheTabs();
      }
    } catch (e) {
      console.warn('[Route Debug] Skipping tabbar store patch (not available yet):', e);
    }

    // 4. 强制追加 keepAlive 路由名称到缓存列表，确保即使 tab.meta.keepAlive
    //    尚未正确设置时 KeepAlive 也能生效（后备保障）
    try {
      const tabbarStore2 = useTabbarStore();
      if (tabbarStore2) {
        const currentCache = new Set(tabbarStore2.cachedTabs);
        let addedCount = 0;
        for (const name of keepAliveNames) {
          if (!currentCache.has(name)) {
            currentCache.add(name);
            addedCount++;
          }
        }
        for (const path of keepAlivePaths) {
          for (const record of allRecords) {
            if (
              record.path === path &&
              record.name &&
              !currentCache.has(record.name as string)
            ) {
              currentCache.add(record.name as string);
              addedCount++;
            }
          }
        }
        if (addedCount > 0) {
          tabbarStore2.cachedTabs = currentCache;
          console.log(
            `[Route Debug] Force added ${addedCount} names to cachedTabs`,
          );
        }
      }
    } catch (e) {
      console.warn('[Route Debug] Skipping force cache patch:', e);
    }

    return result;
  });
}

export { generateAccess };
