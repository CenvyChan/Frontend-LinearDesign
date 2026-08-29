import { describe, expect, it } from 'vitest';

import {
  buildRecipientKeys,
  buildRecipientTransferData,
  parseRecipientIds,
  splitRecipientKeys,
} from './notification-rule-model';

describe('notification-rule-model', () => {
  it('merges user and role options into one recipient transfer list', () => {
    const data = buildRecipientTransferData(
      [{ id: 2, realName: '操作员', username: 'operator' }],
      [{ id: 8, roleKey: 'workshop_director', roleName: '车间主任' }],
    );

    expect(data).toEqual([
      { key: 'user:2', label: '用户 operator / 操作员' },
      { key: 'role:8', label: '角色 车间主任 / workshop_director' },
    ]);
  });

  it('keeps submitted user and role ids separated after one transfer selection', () => {
    const keys = buildRecipientKeys([2, 5], [8]);

    expect(keys).toEqual(['user:2', 'user:5', 'role:8']);
    expect(splitRecipientKeys(keys)).toEqual({
      roleIds: [8],
      userIds: [2, 5],
    });
  });

  describe('parseRecipientIds', () => {
    it('reads role ids from JSON format', () => {
      expect(parseRecipientIds('{"r":"1,2","u":"7"}', 'USER,ROLE')).toEqual({
        roleIds: [1, 2],
        userIds: [7],
      });
    });

    // 2026-08-26 实测：库里 14 条 ROLE 规则都是旧格式纯数字。原实现一律当用户 ID，
    // 打开规则时角色栏为空、用户栏显示角色 ID，一按保存就把 ROLE=1 改写成 USER=1。
    it('treats legacy comma ids as roles when recipientType is ROLE only', () => {
      expect(parseRecipientIds('1', 'ROLE')).toEqual({
        roleIds: [1],
        userIds: [],
      });
      expect(parseRecipientIds('1,3', 'ROLE')).toEqual({
        roleIds: [1, 3],
        userIds: [],
      });
    });

    it('keeps legacy comma ids as users for USER and mixed types', () => {
      expect(parseRecipientIds('14', 'USER')).toEqual({
        roleIds: [],
        userIds: [14],
      });
      // 混合类型的旧格式无法区分归属，保持按用户处理，不猜
      expect(parseRecipientIds('1,2', 'USER,ROLE')).toEqual({
        roleIds: [],
        userIds: [1, 2],
      });
    });

    it('returns empty lists for blank input', () => {
      expect(parseRecipientIds('', 'ROLE')).toEqual({ roleIds: [], userIds: [] });
      expect(parseRecipientIds(undefined, 'ROLE')).toEqual({
        roleIds: [],
        userIds: [],
      });
    });
  });
});
