import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';
import { DEFAULT_HOME_FULL_PATH } from '#/shared/home';

/**
 * 获取用户信息 - 兼容 MES 后端
 * MES 后端接口: GET /auth/info
 * 返回格式: { id, username, nickname, email, phone, permissions[], roles[], firstLogin }
 * 需要映射为 Vben 的 UserInfo 格式: { userId, username, realName, roles, avatar, ... }
 */
export async function getUserInfoApi() {
  const resp: any = await requestClient.get('/auth/info');

  // 将 MES 后端返回的用户信息映射为 Vben 期望的 UserInfo 格式
  // 后端 buildUserInfo() 使用 nickname 作为真实姓名字段
  return {
    userId: String(resp?.id ?? ''),
    username: resp?.username ?? '',
    realName: resp?.nickname ?? resp?.realName ?? resp?.real_name ?? '',
    avatar: resp?.avatar ?? '',
    roles: resp?.roles ?? [],
    permissions: resp?.permissions ?? [],
    desc: resp?.desc ?? '',
    // 后端 buildUserInfo() 不返回 homePath，所以这个兜底恒生效，是真正决定首屏的值
    // （store/auth.ts 与 guard.ts 都是 `userInfo.homePath || 常量`，homePath 一有值就赢）。
    //
    // 必须读常量，**不能读 `preferences.app.defaultHomePath`**：偏好设置整体缓存在
    // localStorage，且 `initPreferences` 用 defu 合并（靠前的参数优先 ⇒ 缓存赢过配置文件），
    // 而缓存命名空间里钉死了 VITE_APP_VERSION=1.0.0、永不轮换。结果是老浏览器里
    // 缓存着改版前的 `/analytics`，改 `preferences.ts` 对它们完全无效 ——
    // 这正是"admin 已经落到 analytics-v2、其他人还落到 /analytics"的成因：
    // 差异在各自浏览器的缓存，不在用户身份。
    homePath: resp?.homePath ?? DEFAULT_HOME_FULL_PATH,
    token: '',
    // 首次登录标识：1=需要改密，0=已改密
    firstLogin: resp?.firstLogin ?? 0,
  } as UserInfo;
}
