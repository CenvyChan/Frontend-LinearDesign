import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 菜单接口响应体
 *
 * 后端 `data` 从裸数组改为对象，以便随菜单一起下发 `menuVersion`。
 * 请求拦截器配置 `dataField: 'data'`，顶层兄弟字段会被丢弃，
 * 因此版本号必须放在 `data` 内部。
 */
export interface FormModelMenuResponse {
  /** 当前用户可见的菜单树（含动态表单分支） */
  menus: RouteRecordStringComponent[];
  /** 租户级菜单版本，授权变更时递增 */
  menuVersion: number;
}

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi(): Promise<FormModelMenuResponse> {
  const data =
    await requestClient.get<Partial<FormModelMenuResponse>>('/menu/all');

  return {
    menus: Array.isArray(data?.menus) ? data.menus : [],
    menuVersion: typeof data?.menuVersion === 'number' ? data.menuVersion : 0,
  };
}
