import { requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    clientType?: 'ALL' | 'MOBILE' | 'WEB';
    erpAcctCode?: string;
    orgId?: string;
    password?: string;
    username?: string;
    tenantId?: number;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }
}

/**
 * 登录 - 兼容 MES 后端
 * MES 后端返回: { success: true, data: { token: 'xxx', user: {...} }, message: '登录成功' }
 * 响应拦截器提取 data 后得到 { token: 'xxx', user: {...} }
 * 需要映射为 Vben 期望的 { accessToken: 'xxx' }
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const resp: any = await requestClient.post('/auth/login', {
    ...data,
    clientType: data.clientType ?? 'WEB',
  });
  return { accessToken: resp?.token ?? '' } as AuthApi.LoginResult;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

/**
 * 刷新token stub - MES 后端无此功能，已通过 preferences 关闭
 */
export async function refreshTokenApi(): Promise<any> {
  throw new Error('MES 后端不支持 refresh token 机制');
}

/**
 * 获取用户权限码
 * MES 后端的权限信息已包含在用户信息接口返回的 permissions 字段中
 * 此接口保留但无需实际调用，由 auth store 从用户信息中提取
 */
export async function getAccessCodesApi() {
  return Promise.resolve([] as string[]);
}
