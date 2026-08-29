import { describe, expect, it } from 'vitest';

import { DEFAULT_HOME_FULL_PATH, DEFAULT_HOME_PATH } from './home';

/**
 * 这些断言存在的原因：首屏地址曾经有两个各自独立的来源
 * （`preferences` 的默认值与 `api/core/user.ts` 的兜底），
 * 其中一个指向不存在的路由时登录后就 404，而"返回首页"因为经过
 * `/` 的 redirect 又跳回同一个坏地址，形成死循环。
 */
describe('default home path', () => {
  it('points at the analytics V2 route that actually exists', () => {
    expect(DEFAULT_HOME_PATH).toBe('/dashboard/analytics-v2');
  });

  it('carries no query, so `to.path` comparisons in the guard can match', () => {
    // guard.ts 用 `to.path === DEFAULT_HOME_PATH` 判断"目标就是首页"，
    // 而 to.path 永不含 query。带上 ?scenario 会让该判断恒为 false。
    expect(DEFAULT_HOME_PATH).not.toContain('?');
  });

  it('navigates with the default scenario so the page need not self-correct', () => {
    expect(DEFAULT_HOME_FULL_PATH).toBe('/dashboard/analytics-v2?scenario=A1');
    expect(DEFAULT_HOME_FULL_PATH.startsWith(DEFAULT_HOME_PATH)).toBe(true);
  });
});
