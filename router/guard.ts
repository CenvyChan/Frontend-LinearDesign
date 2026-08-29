import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { accessRoutes, coreRouteNames } from '#/router/routes';
import { DEFAULT_HOME_FULL_PATH, DEFAULT_HOME_PATH } from '#/shared/home';
import { useAuthStore } from '#/store';

import { clearMenuCache, generateAccess, hasRoutePermission } from './access';
import { mayBeUnloadedFormRoute } from './form-model-routes';

/**
 * hideInMenu 路由名集合，**只统计当前用户有权限的那些**。
 *
 * `access.ts` 的补注册按 `meta.permission` 过滤，所以这里若统计全部 hideInMenu 路由，
 * 「动态路由是否完整」永远不成立 → 每次导航都 clearMenuCache 并重新生成
 * → 无限请求 `/api/menu/all`，页面永远进不了首屏。
 */
function collectHiddenRouteNames(routes: any[]): Set<string> {
  const hiddenRouteNames = new Set<string>();

  const visit = (records: any[]) => {
    for (const record of records) {
      if (
        record?.meta?.hideInMenu &&
        record?.name &&
        hasRoutePermission(record)
      ) {
        hiddenRouteNames.add(String(record.name));
      }
      if (Array.isArray(record?.children) && record.children.length > 0) {
        visit(record.children);
      }
    }
  };

  visit(routes);
  return hiddenRouteNames;
}

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  // 添加标志防止重复生成路由
  let isGeneratingRoutes = false;
  // 已尝试过重载的动态表单路径，防止 reload 后仍未命中时无限跳转
  const attemptedFormReloads = new Set<string>();
  // 「动态路由不完整」的重生成次数上限，超过后放行而不是继续重试
  const MAX_ROUTE_REGENERATIONS = 2;
  let routeRegenerationAttempts = 0;

  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            userStore.userInfo?.homePath ||
            DEFAULT_HOME_FULL_PATH,
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          // 比 path 而不是 fullPath：未登录访问首页时不该带 redirect 回来，
          // 而首页的 fullPath 会带上 ?scenario=xx，用 fullPath 比永远不相等。
          query:
            to.path === DEFAULT_HOME_PATH
              ? {}
              : { redirect: encodeURIComponent(to.fullPath) },
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      // 已登录用户直接打开尚未装载的动态表单 URL 时，强制刷新一次菜单与路由。
      // 重载后 replace 重进目标路径；若授权已撤销，第二次进入不会再循环。
      //
      // 判据是「本次导航只匹配到 404 兜底」而不是路径前缀：视图可以配置任意自定义
      // 地址，按 `/form-model/` 前缀判断会漏掉它们，用户刷新自定义地址就停在 404。
      if (
        mayBeUnloadedFormRoute(to.matched) &&
        !attemptedFormReloads.has(to.fullPath)
      ) {
        attemptedFormReloads.add(to.fullPath);
        clearMenuCache();
        accessStore.setIsAccessChecked(false);
      } else {
        // 即使标记为已检查，也要验证动态路由是否真的存在：
        // 页面刷新后 isAccessChecked 可能仍为 true，但动态路由已丢失。
        const allRoutes = router.getRoutes();
        const rootRoute = allRoutes.find((r) => r.path === '/');
        const registeredRouteNames = new Set(
          allRoutes.map((route) => String(route.name ?? '')),
        );
        const hiddenRouteNames = collectHiddenRouteNames(accessRoutes);
        const hasDynamicRoutes =
          rootRoute?.children &&
          rootRoute.children.some(
            (child) => child.name !== 'Login' && child.name !== 'FirstLogin',
          );

        const hasAllHiddenRoutes = [...hiddenRouteNames].every((name) =>
          registeredRouteNames.has(name),
        );

        if (hasDynamicRoutes && hasAllHiddenRoutes) {
          // 动态路由确实存在,直接放行
          routeRegenerationAttempts = 0;
          console.log('[Route Guard] Dynamic routes exist, skipping regeneration');
          return true;
        }

        // 熔断：重新生成本身可能无法让校验通过（例如某个 hideInMenu 路由因权限
        // 被跳过注册）。若不设上限，就会陷入"校验失败→重新生成→再校验失败"的
        // 死循环，把 /api/menu/all 打成无限请求且永远进不了首屏。
        if (routeRegenerationAttempts >= MAX_ROUTE_REGENERATIONS) {
          const missing = [...hiddenRouteNames].filter(
            (name) => !registeredRouteNames.has(name),
          );
          console.error(
            '[Route Guard] Route regeneration limit reached; proceeding without it.',
            'Missing hidden routes:',
            missing,
          );
          return true;
        }
        routeRegenerationAttempts += 1;

        // 动态路由不存在,需要重新生成(继续执行下面的代码)
        console.warn(
          `[Route Guard] Dynamic routes are incomplete, regenerating (attempt ${routeRegenerationAttempts}/${MAX_ROUTE_REGENERATIONS})...`,
        );
        // 清除菜单缓存,确保获取最新数据
        clearMenuCache();
        // 重置 isAccessChecked 标志
        accessStore.setIsAccessChecked(false);
      }
    }

    // 防止重复生成路由
    if (isGeneratingRoutes) {
      console.log('[Route Guard] Routes are being generated, waiting...');
      return true; // 直接放行，等待生成完成
    }

    try {
      isGeneratingRoutes = true;

      // 生成路由表
      // 当前登录用户拥有的角色标识列表
      const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
      const userRoles = userInfo.roles ?? [];

      // 检查是否首次登录
      const firstLogin = (userInfo as any)?.firstLogin;
      if (firstLogin === 1 && to.path !== '/auth/first-login') {
        // 首次登录用户，重定向到密码修改页面
        console.log('[Route Guard] 首次登录用户，重定向到密码修改页面');
        return {
          path: '/auth/first-login',
          replace: true,
        };
      }

      console.log('[Route Guard] Generating dynamic routes...');

      // 生成菜单和路由
      const { accessibleMenus, accessibleRoutes } = await generateAccess({
        roles: userRoles,
        router,
        // 则会在菜单中显示，但是访问会被重定向到403
        routes: accessRoutes,
      });

      console.log('[Route Guard] Generated', accessibleRoutes.length, 'routes');

      // 保存菜单信息和路由信息
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);

      console.log('[Route Guard] Routes generation completed');

      // 动态路由已添加，重新解析目标路径以确保正确匹配。
      // 判定用 to.path：to.fullPath 带 ?scenario=xx，与纯路径常量永不相等，
      // 那样进首页时会走 to.fullPath 分支而忽略用户自己的 homePath。
      const redirectPath = (from.query.redirect ??
        (to.path === DEFAULT_HOME_PATH
          ? userInfo.homePath || DEFAULT_HOME_FULL_PATH
          : to.fullPath)) as string;

      return {
        ...router.resolve(decodeURIComponent(redirectPath)),
        replace: true,
      };
    } finally {
      isGeneratingRoutes = false;
    }
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
