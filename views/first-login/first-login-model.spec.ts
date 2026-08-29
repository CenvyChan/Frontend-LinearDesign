import { describe, expect, it, vi } from 'vitest';

import {
  changeFirstLoginPasswordAndRequireLogin,
  toFirstLoginPasswordChangeErrorMessage,
} from './first-login-model';

describe('first login password change', () => {
  it('logs out without redirect query after changing the password', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const logout = vi.fn().mockResolvedValue(undefined);
    const success = vi.fn();

    await changeFirstLoginPasswordAndRequireLogin('new-password', {
      logout,
      put,
      success,
    });

    expect(put).toHaveBeenCalledWith('/auth/first-login-password', {
      newPassword: 'new-password',
    });
    expect(success).toHaveBeenCalledWith('密码修改成功，请重新登录');
    expect(logout).toHaveBeenCalledWith(false);
  });

  it('does not log out or show success when the password change request fails', async () => {
    const error = new Error('后端返回的失败原因');
    const put = vi.fn().mockRejectedValue(error);
    const logout = vi.fn().mockResolvedValue(undefined);
    const success = vi.fn();

    await expect(
      changeFirstLoginPasswordAndRequireLogin('new-password', {
        logout,
        put,
        success,
      }),
    ).rejects.toThrow('后端返回的失败原因');

    expect(success).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('maps unknown errors to a default message', () => {
    expect(toFirstLoginPasswordChangeErrorMessage(new Error('修改失败详情'))).toBe(
      '修改失败详情',
    );
    expect(toFirstLoginPasswordChangeErrorMessage({ message: '接口异常' })).toBe(
      '接口异常',
    );
    expect(toFirstLoginPasswordChangeErrorMessage('字符串异常')).toBe(
      '字符串异常',
    );
    expect(toFirstLoginPasswordChangeErrorMessage(undefined)).toBe('修改失败');
  });
});
