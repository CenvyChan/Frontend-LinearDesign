import type { RouteRecordRaw } from 'vue-router';

/** 补注册计划：某条 hideInMenu 路由该挂到哪个父级下 */
export interface HiddenRouteRegistration {
  parentName: string;
  route: RouteRecordRaw;
}

/**
 * 收集需要补注册的 hideInMenu 叶子路由，并决定各自挂载到哪个父级。
 *
 * 后端 accessMode 不下发不可见路由，它们只能靠这里补注册。顶层定义的
 * hideInMenu 路由没有父级（如 `/form-model/designer/:formKey`），必须回退到
 * `Root` 而不是被跳过：`guard.ts` 的 `collectHiddenRouteNames` 不检查父级，
 * 两侧判定一旦错位，该路由永远不会注册，导航只能落到 404 兜底，
 * 且因为全程发生在前端，后端不会留下任何错误痕迹。
 *
 * @param routes          待扫描的路由表
 * @param registeredNames 已注册的路由名，用于跳过后端已下发的项
 * @param hasPermission   权限判定，必须与 `guard.ts` 使用同一实现
 * @param parentName      当前递归层的父路由名，顶层为 undefined
 */
export function collectHiddenRoutesToRegister(
  routes: RouteRecordRaw[],
  registeredNames: Set<string>,
  hasPermission: (route: { meta?: Record<string, any> }) => boolean,
  parentName?: string,
): HiddenRouteRegistration[] {
  const result: HiddenRouteRegistration[] = [];

  for (const route of routes) {
    if (!route.children || route.children.length === 0) {
      if (
        route.meta?.hideInMenu &&
        hasPermission(route) &&
        !registeredNames.has(route.name as string)
      ) {
        result.push({ parentName: parentName ?? 'Root', route });
      }
    }
    if (route.children) {
      result.push(
        ...collectHiddenRoutesToRegister(
          route.children,
          registeredNames,
          hasPermission,
          route.name as string,
        ),
      );
    }
  }

  return result;
}
