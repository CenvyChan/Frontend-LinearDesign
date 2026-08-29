import type { RouteRecordRaw, Router } from 'vue-router';

/**
 * 动态表单路由名称前缀。
 *
 * 重载时据此识别"上一轮注册的动态路由"并整体摘除，
 * 使 reload 可重入：撤销授权后对应路由会真正消失。
 */
const DYNAMIC_FORM_ROUTE_PREFIX = 'form-model-runtime-';

/**
 * 动态表单菜单的最小结构。
 *
 * `path` 是必需的：视图可以配置自定义菜单地址（如 `/info/material-query`），
 * 地址不再能由 formKey + viewKey 推出来，只能取后端下发的那个。
 */
interface FormMenuLike {
  path?: string;
  meta?: { formKey?: string; viewKey?: string };
}

/** 默认地址前缀，与后端 `FormViewRouting.DEFAULT_PREFIX` 对应 */
const DEFAULT_FORM_PATH_PREFIX = '/form-model/';

/**
 * 并发 reload 去重：同一时刻的多次调用合并到同一个 Promise，
 * 避免 remove/add 交错导致路由表处于半装载状态。
 */
let inFlightReload: null | Promise<void> = null;

/**
 * 该视图默认的菜单地址，没有配置自定义地址时使用。
 *
 * 与后端 `FormViewRouting.effectivePath` 的默认分支必须一致。
 */
export function defaultFormModelPath(formKey: string, viewKey: string): string {
  return `${DEFAULT_FORM_PATH_PREFIX}${formKey}/${viewKey}`;
}

/**
 * 构建单个动态表单的路由记录。
 *
 * 组件固定为通用运行时页，渲染哪张表单由 `meta.formKey` 决定。
 *
 * @param path 后端下发的实际地址。视图可以配置自定义地址，所以这里**不能**由
 *             formKey + viewKey 推导 —— 那样注册出的路由会与菜单里的链接不一致，
 *             表现为菜单点进去 404。省略时退回默认地址。
 */
export function buildFormModelRoute(
  formKey: string,
  viewKey: string,
  path?: string,
): RouteRecordRaw {
  return {
    // 路由名只由 formKey + viewKey 决定，不含地址：改自定义地址时旧路由
    // 仍能按同一个名字被摘掉，否则会留下一条摘不掉的僵尸路由。
    name: `${DYNAMIC_FORM_ROUTE_PREFIX}${formKey}-${viewKey}`,
    path: path && path.startsWith('/') ? path : defaultFormModelPath(formKey, viewKey),
    component: () => import('../views/form-model/runtime/index.vue'),
    meta: {
      title: `表单-${formKey}`,
      permission: 'form-model:view',
      formKey,
      viewKey,
    },
  };
}

/** 摘除上一轮注册的全部动态表单路由 */
function removeExistingFormModelRoutes(router: Router): void {
  for (const route of router.getRoutes()) {
    const name = typeof route.name === 'string' ? route.name : '';
    if (name.startsWith(DYNAMIC_FORM_ROUTE_PREFIX)) {
      router.removeRoute(name);
    }
  }
}

/**
 * 依据菜单里的动态表单分支重载动态路由（可重入）。
 *
 * 先 remove 再 add：重复调用不会产生重复路由，
 * 授权被撤销的表单也会随之从路由表移除。
 *
 * @param router   vue-router 实例
 * @param formMenus 后端下发的动态表单菜单项（无 formKey 的会被跳过）
 */
export async function reloadFormModelRoutes(
  router: Router,
  formMenus: FormMenuLike[],
): Promise<void> {
  if (inFlightReload) {
    return inFlightReload;
  }

  inFlightReload = (async () => {
    removeExistingFormModelRoutes(router);

    const seen = new Set<string>();
    for (const menu of formMenus ?? []) {
      const formKey = menu?.meta?.formKey;
      const viewKey = menu?.meta?.viewKey;
      if (!formKey || !viewKey) continue;
      // 去重键必须含 viewKey：一张表单的多个视图是多条独立路由，
      // 只按 formKey 去重会让除第一个以外的视图全部注册不上。
      const routeKey = `${formKey}/${viewKey}`;
      if (!seen.has(routeKey)) {
        seen.add(routeKey);
        // 地址取菜单项自己的 path：视图可能配了自定义地址
        router.addRoute(buildFormModelRoute(formKey, viewKey, menu?.path));
      }
    }
  })();

  try {
    await inFlightReload;
  } finally {
    // 失败也要清掉 in-flight，否则后续 reload 会一直复用已 reject 的 Promise
    inFlightReload = null;
  }
}

/**
 * 从任意深度的菜单树里收集带 formKey 的节点。
 *
 * 递归是必需的：视图可以指定父菜单节点，动态表单不再只出现在顶层。
 */
export function collectFormModelMenus(menus: any[]): FormMenuLike[] {
  const collected: FormMenuLike[] = [];

  const visit = (items: any[]) => {
    for (const item of items ?? []) {
      if (item?.meta?.formKey) {
        collected.push(item);
      }
      if (Array.isArray(item?.children) && item.children.length > 0) {
        visit(item.children);
      }
    }
  };

  visit(menus);
  return collected;
}

/**
 * 该地址**可能**是一个尚未装载的动态表单入口，值得为它刷新一次菜单。
 *
 * 判据是「只匹配上了 404 兜底路由」，而不是路径前缀 —— 视图可以配置任意自定义
 * 地址（`/info/material-query`），按 `/form-model/` 前缀判断会漏掉它们，
 * 已授权的用户直接打开或刷新自定义地址就会停在 404 而不触发菜单重载。
 *
 * 用"匹配不到真实路由"作判据也更严格：已经装载好的表单路由不会命中，
 * 因此不会为正常导航多刷一次菜单。
 *
 * @param matched 本次导航匹配到的路由记录名列表（`to.matched`）
 */
export function mayBeUnloadedFormRoute(matched: Array<{ name?: unknown }>): boolean {
  if (matched.length === 0) return true;
  return matched.every((record) => record?.name === 'FallbackNotFound');
}

/** 测试辅助：清空并发去重状态 */
export function resetFormModelReloadState(): void {
  inFlightReload = null;
}
