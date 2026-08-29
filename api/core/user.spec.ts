import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('#/api/request', () => ({
  requestClient: {
    get: (...args: unknown[]) => get(...args),
  },
}));

/**
 * 偏好设置模块被故意打桩成「缓存里留着改版前的旧首屏」。
 *
 * 真实环境里这不是假设：偏好整体缓存在 localStorage，`initPreferences` 用
 * defu 合并（靠前的参数优先 ⇒ 缓存赢过配置文件），缓存命名空间又钉死了
 * `VITE_APP_VERSION=1.0.0` 永不轮换。所以改 `preferences.ts` 对老浏览器无效，
 * 表现为「admin 已落到 analytics-v2、其他人还落到 /analytics」——
 * 差异在各自浏览器的缓存，不在用户身份。
 */
vi.mock('@vben/preferences', () => ({
  preferences: { app: { defaultHomePath: '/analytics' } },
}));

import { DEFAULT_HOME_FULL_PATH } from '#/shared/home';

import { getUserInfoApi } from './user';

describe('getUserInfoApi homePath', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('后端不返回 homePath 时兜底到常量，而不是被缓存污染的偏好值', async () => {
    get.mockResolvedValue({ id: 2, username: 'operator' });

    const info = await getUserInfoApi();

    expect(info.homePath).toBe(DEFAULT_HOME_FULL_PATH);
    expect(info.homePath).not.toBe('/analytics');
  });

  it('后端一旦真的下发 homePath 就照用 —— 兜底只在缺值时生效', async () => {
    get.mockResolvedValue({ homePath: '/production/order', id: 3 });

    expect((await getUserInfoApi()).homePath).toBe('/production/order');
  });

  it('兜底值带默认场景参数：store/auth.ts 直接把它交给 router.push', async () => {
    get.mockResolvedValue({ id: 4 });

    expect((await getUserInfoApi()).homePath).toContain('?scenario=');
  });
});
