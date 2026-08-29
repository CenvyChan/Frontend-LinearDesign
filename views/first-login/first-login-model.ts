interface ChangeFirstLoginPasswordDeps {
  logout: (redirect?: boolean) => Promise<void>;
  put: (url: string, data: { newPassword: string }) => Promise<unknown>;
  success: (message: string) => void;
}

export function toFirstLoginPasswordChangeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message
  ) {
    return error.message;
  }
  return '修改失败';
}

export async function changeFirstLoginPasswordAndRequireLogin(
  newPassword: string,
  deps: ChangeFirstLoginPasswordDeps,
) {
  await deps.put('/auth/first-login-password', {
    newPassword,
  });
  deps.success('密码修改成功，请重新登录');
  await deps.logout(false);
}
