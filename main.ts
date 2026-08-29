import { initPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences } from './preferences';

/**
 * 应用初始化完成之后再进行页面加载渲染
 */
async function initApplication() {
  // name用于指定项目唯一标识
  // 用于区分不同项目的偏好设置以及存储数据的key前缀以及其他一些需要隔离的数据
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  // app偏好设置初始化
  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });

  // 启动应用并挂载
  // vue应用主要逻辑及视图
  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  // 页面刷新后要重置权限检查标志，否则动态路由不会重新注册。
  // 必须在 bootstrap 之后调用，因为 Pinia 在 bootstrap 中初始化。
  const isPageReload =
    performance.navigation && performance.navigation.type === 1;
  if (isPageReload) {
    console.log('[App Init] Page reload detected, resetting access check flag');
    const { useAccessStore } = await import('@vben/stores');
    const accessStore = useAccessStore();
    accessStore.setIsAccessChecked(false);
  }

  // 移除并销毁loading
  unmountGlobalLoading();
}

initApplication();
