import { defineOverridesPreferences } from '@vben/preferences';

import { DEFAULT_HOME_PATH } from './shared/home';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    // MES 后端没有 refresh token 接口，关闭 token 刷新
    enableRefreshToken: false,
    // 使用后端模式，从 API 获取菜单
    accessMode: 'backend',
    /**
     * 登录后的首屏。Vben 默认值是 `/analytics`（演示用分析页），MES 的首屏是分析页 V2。
     *
     * 这里只是让设置面板等 preferences 消费方看到正确值。**路由与守卫不读它**：
     * 缓存的偏好设置会赢过本文件（见 `shared/home.ts` 的说明），
     * 首屏地址的权威来源是 `DEFAULT_HOME_PATH`。
     */
    defaultHomePath: DEFAULT_HOME_PATH,
  },
});
