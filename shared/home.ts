/**
 * 登录后的首屏地址（单一来源）。
 *
 * **为什么不直接读 `preferences.app.defaultHomePath`：**
 * 偏好设置会被整体写进 localStorage，而 `initPreferences` 用
 * `merge({}, 缓存, 配置)`（defu）合并 —— defu 里**靠前的参数优先**，
 * 也就是缓存赢过配置文件。老浏览器里缓存着上一个首屏地址，
 * 只改 `preferences.ts` 对它们完全无效（这正是该文件
 * 「更改配置后请清空缓存，否则可能不生效」那句注释的由来）。
 *
 * 首屏是路由正确性问题，不该取决于用户本地有没有清缓存，
 * 因此路由与守卫一律读本常量；`preferences.ts` 也引用它，
 * 保证设置面板等其他消费方看到的是同一个值。
 */

/**
 * 纯路径，不带 query。
 *
 * 守卫里有 `to.path === DEFAULT_HOME_PATH` 这样的判断，而 `to.path`
 * 永不包含 query；把 `?scenario=A1` 写进这里会让该判断恒为 false。
 */
export const DEFAULT_HOME_PATH = '/dashboard/analytics-v2';

/**
 * 带默认场景的完整首屏地址，用于**导航**（重定向、返回首页）。
 *
 * 分析页 V2 挂载时也会把缺失的 scenario 规范化成 A1 再 `router.replace`，
 * 但直接带上可以省掉那一次地址替换，避免 URL 先短暂显示成无参版本。
 */
export const DEFAULT_HOME_FULL_PATH = `${DEFAULT_HOME_PATH}?scenario=A1`;
