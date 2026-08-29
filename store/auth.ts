import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { ElNotification } from 'element-plus';
import { defineStore } from 'pinia';

import { loginApi, logoutApi } from '#/api';
import { $t } from '#/locales';

import { getUserInfoApi } from '#/api/core/user';
import { getOrganizations } from '#/api/erpData';
import { clearMenuCache } from '#/router/access';
import { DEFAULT_HOME_FULL_PATH } from '#/shared/home';
import { useErpAcctStore } from '#/store/erp-acct';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;

      // 保存选中的组织到 localStorage
      const erpAcctStore = useErpAcctStore();
      const selectedAcctCode = `${params?.erpAcctCode ?? ''}`.trim();
      if (selectedAcctCode) {
        erpAcctStore.setAcctCode(selectedAcctCode);
      }

      if (params?.orgId) {
        localStorage.setItem('mes_current_org_id', String(params.orgId));
      } else if (selectedAcctCode) {
        await syncDefaultOrgForLoginAcct(selectedAcctCode);
      }

      const { accessToken } = await loginApi(params);

      if (!accessToken) {
        // 无 accessToken 说明登录失败，抛出错误由外层 catch 处理
        throw new Error('登录失败，无法获取访问令牌');
      }

      accessStore.setAccessToken(accessToken);

      // MES 后端的权限信息在 userInfo.permissions 中，不需要单独调用 getAccessCodesApi
      const fetchUserInfoResult = await fetchUserInfo();
      userInfo = fetchUserInfoResult;
      userStore.setUserInfo(userInfo);

      // 从 userInfo 中提取权限设置到 access store
      const perms = (userInfo as any)?.permissions ?? [];
      accessStore.setAccessCodes(perms);

      // 检查是否首次登录（firstLogin === 1 表示需要改密）
      const firstLogin = (userInfo as any)?.firstLogin;
      if (firstLogin === 1) {
        // 首次登录，跳转到密码修改页面
        console.log('[Auth] 首次登录，需要修改密码');
        await router.push('/auth/first-login');
        ElNotification({
          message: '首次登录请先修改密码',
          title: '提示',
          type: 'warning',
          duration: 5000,
        });
        return { userInfo };
      }

      if (accessStore.loginExpired) {
        accessStore.setLoginExpired(false);
      } else {
        onSuccess
          ? await onSuccess?.()
          : await router.push(userInfo.homePath || DEFAULT_HOME_FULL_PATH);
      }

      if (userInfo?.realName) {
        ElNotification({
          message: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
          title: $t('authentication.loginSuccess'),
          type: 'success',
        });
      }
    } catch (error: any) {
      // 提取错误消息并显示给用户
      let errorMsg = '';
      if (error?.message) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error?.msg) {
        errorMsg = error.msg;
      } else {
        errorMsg = '登录失败，请检查用户名和密码';
      }
      ElNotification({
        message: errorMsg,
        title: '登录失败',
        type: 'error',
        duration: 5000,
      });
      console.warn('登录失败:', errorMsg);
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    // 清除菜单缓存
    clearMenuCache();
    // 重置所有 store
    resetAllStores();
    accessStore.setLoginExpired(false);

    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function syncDefaultOrgForLoginAcct(acctCode: string) {
    const res = await getOrganizations(acctCode);
    if (!res.success) {
      throw new Error(res.message || '鑾峰彇缁勭粐鍒楄〃澶辫触');
    }
    const org = res.defaultOrg || res.data?.[0];
    if (org?.erpOrgId) {
      localStorage.setItem('mes_current_org_id', String(org.erpOrgId));
    } else {
      localStorage.removeItem('mes_current_org_id');
    }
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
