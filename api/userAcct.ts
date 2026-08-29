import { requestClient } from '#/api/request';

/** 一条用户 ↔ 账套绑定 */
export interface UserAcctBinding {
  id: number;
  erpAcctCode: string;
  /** 该用户登录后默认落在哪个账套 */
  isDefault: boolean;
}

/** 租户级 ERP 账套候选项。**存在 ≠ 某个用户已被授权。** */
export interface ErpAcctOption {
  acctCode: string;
  displayName: string;
  isDefault: boolean;
}

interface BodyResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function unwrap<T>(
  promise: Promise<BodyResponse<T>>,
  fallback: string,
): Promise<T> {
  const response = await promise;
  if (!response?.success || response.data === undefined) {
    throw new Error(response?.message || fallback);
  }
  return response.data;
}

/**
 * 本租户可绑定的账套候选集。
 *
 * 这是**租户配置了哪些账套**，不是某个用户被授权用哪些 —— 两层概念。
 * 表单建模的访问校验只看后者（`sys_user_acct`）。
 */
export function getAvailableErpAcctsApi(): Promise<ErpAcctOption[]> {
  return unwrap(
    requestClient.get<BodyResponse<ErpAcctOption[]>>('/user-acct/available', {
      responseReturn: 'body',
    }),
    '加载账套候选失败',
  );
}

export function getUserAcctBindingsApi(
  userId: number,
): Promise<UserAcctBinding[]> {
  return unwrap(
    requestClient.get<BodyResponse<UserAcctBinding[]>>(`/user-acct/${userId}`, {
      responseReturn: 'body',
    }),
    '加载账套授权失败',
  );
}

/**
 * 整体替换该用户的绑定集合。空数组表示收回全部。
 *
 * 整体替换而非增量：界面上这是一组多选框，提交的是「最终应该是这几个」。
 * 增量接口要前端自己算差集，而算错的方向是多留一条授权。
 */
export function saveUserAcctBindingsApi(
  userId: number,
  acctCodes: string[],
  defaultAcctCode?: null | string,
): Promise<UserAcctBinding[]> {
  return unwrap(
    requestClient.put<BodyResponse<UserAcctBinding[]>>(
      `/user-acct/${userId}`,
      { acctCodes, defaultAcctCode: defaultAcctCode ?? null },
      { responseReturn: 'body' },
    ),
    '保存账套授权失败',
  );
}
