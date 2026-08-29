/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { ElMessage } from 'element-plus';

import { useAuthStore, useErpAcctStore } from '#/store';

import { refreshTokenApi } from './core';
import { resolveErpAcctCode } from './request-context';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.data;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();
      const erpAcctStore = useErpAcctStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      // MES 后端默认租户
      config.headers['X-Tenant-Id'] = '1';
      const requestedAcctCode = config.headers['X-Erp-Acct-Code'];
      const acctCode = resolveErpAcctCode(requestedAcctCode, erpAcctStore.acctCode);
      if (acctCode) {
        config.headers['X-Erp-Acct-Code'] = acctCode;
      } else {
        delete config.headers['X-Erp-Acct-Code'];
      }

      // 从 localStorage 读取当前组织ID并添加到请求头
      const orgId = localStorage.getItem('mes_current_org_id');
      if (orgId) {
        config.headers['X-Org-Id'] = orgId;
      }

      return config;
    },
  });

  // 处理返回的响应数据格式
  // MES 后端响应格式: { success: true, data: {...}, message: '...' }
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'success',
      dataField: 'data',
      successCode: (code: any) => code === true,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      ElMessage.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

/**
 * 列表查询请求客户端 - 返回完整响应体而非仅 data 字段
 * MES 后端分页接口返回格式: { success: true, data: [...], total: 240 }
 * 标准 requestClient 会通过拦截器只提取 data 字段，丢失 total
 * 本客户端保留完整响应供分页处理
 */
export function postList<T = any>(url: string, data?: any): Promise<{
  data: T[];
  total: number;
}> {
  const fullUrl = `${apiURL}${url}`;
  console.log('[API Request] POST', fullUrl, 'Data:', data);
  
  // 通过 baseRequestClient 发送，手动提取响应体
  return baseRequestClient
    .post(url, data)
    .then((resp: any) => {
      console.log('[API Response]', fullUrl, 'Status:', resp.status, 'Data:', resp.data);
      return resp.data as { data: T[]; total: number };
    })
    .catch((error: any) => {
      console.error('[API Error]', fullUrl, 'Error:', error.message || error);
      throw error;
    });
}

export function getList<T = any>(url: string, params?: any): Promise<{
  data: T[];
  total: number;
}> {
  // 通过 baseRequestClient 发送，手动提取响应体
  return baseRequestClient
    .get(url, { params })
    .then((resp: any) => resp.data as { data: T[]; total: number });
}

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
baseRequestClient.addRequestInterceptor({
  fulfilled: async (config) => {
    const accessStore = useAccessStore();
    const erpAcctStore = useErpAcctStore();

    config.headers.Authorization = formatBaseToken(accessStore.accessToken);
    config.headers['Accept-Language'] = preferences.app.locale;
    config.headers['X-Tenant-Id'] = '1';
    const requestedAcctCode = config.headers['X-Erp-Acct-Code'];
    const acctCode = resolveErpAcctCode(requestedAcctCode, erpAcctStore.acctCode);
    if (acctCode) {
      config.headers['X-Erp-Acct-Code'] = acctCode;
    } else {
      delete config.headers['X-Erp-Acct-Code'];
    }

    const orgId = localStorage.getItem('mes_current_org_id');
    if (orgId) {
      config.headers['X-Org-Id'] = orgId;
    }
    return config;
  },
});

function formatBaseToken(token: null | string) {
  return token ? `Bearer ${token}` : null;
}
