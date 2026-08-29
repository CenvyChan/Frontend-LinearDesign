import { describe, expect, it } from 'vitest';

import { repeatArrayParams } from './form-model';

/**
 * 这些断言存在的原因：axios 默认把数组参数写成 `search[]=a&search[]=b`，
 * 而 Spring 的 `@RequestParam List<String> search` 按键名精确匹配，
 * `search[]` 绑不上 —— 请求会成功，但搜索条件被静默丢弃，
 * 前端拿到未过滤的全量数据却看不出任何异常。
 */
describe('repeatArrayParams', () => {
  it('serializes arrays as repeated keys, not bracket notation', () => {
    const query = repeatArrayParams({
      search: ['status:EQ:1', 'name:LIKE:abc'],
    });

    expect(query).not.toContain('search[]');
    expect(query).not.toContain('%5B%5D');
    expect(new URLSearchParams(query).getAll('search')).toEqual([
      'status:EQ:1',
      'name:LIKE:abc',
    ]);
  });

  it('keeps scalar params alongside arrays', () => {
    const params = new URLSearchParams(
      repeatArrayParams({ page: 0, pageSize: 50, search: ['a:EQ:1'] }),
    );

    expect(params.get('page')).toBe('0');
    expect(params.get('pageSize')).toBe('50');
    expect(params.getAll('search')).toEqual(['a:EQ:1']);
  });

  it('omits null and undefined instead of sending the literal text', () => {
    // 发出 keyword=undefined 会让后端按字面量 "undefined" 过滤，结果恒为空
    const query = repeatArrayParams({
      keyword: undefined,
      page: 1,
      viewKey: null,
    });

    expect(query).toBe('page=1');
  });

  it('preserves colons in values so the field:operator:value shape survives', () => {
    // 值本身可以含冒号（时间 12:30），后端只按前两个冒号切分
    const params = new URLSearchParams(
      repeatArrayParams({ search: ['due:EQ:12:30'] }),
    );

    expect(params.getAll('search')).toEqual(['due:EQ:12:30']);
  });
});
