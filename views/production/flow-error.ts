const ACTION_PREFIX_RE = /^(开始|完成|跳过|上报|处理|解决|升级|加载|检查|绑定|下达|重新生成|刷新|保存|提交|获取|查询|删除|同步|返回)失败[：:]?\s*/;

const FRIENDLY_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /Transaction silently rolled back because it has been marked as rollback-only|UnexpectedRollbackException/i,
    message: '工序开始失败：工序开始时的资源自动绑定触发了回滚。请检查机台、工装、量具或模具的状态和占用情况。',
  },
  {
    pattern: /未关联工艺路线|未绑定工艺路线/,
    message: '工单还没有绑定工艺路线，请先绑定后再继续。',
  },
  {
    pattern: /未定义工序步骤/,
    message: '工艺路线还没有配置工序步骤，请先补充工序。',
  },
  {
    pattern: /当前状态为.*不可开始/,
    message: '当前工序状态不允许开始，请先处理工序状态。',
  },
  {
    pattern: /当前状态为.*不可完成/,
    message: '当前工序状态不允许完成，请先确认工序已经开始。',
  },
  {
    pattern: /当前状态为.*不可跳过/,
    message: '当前工序状态不允许跳过。',
  },
  {
    pattern: /前序工序.*尚未完成/,
    message: '前面的工序还没有完成，请先完成前序工序。',
  },
  {
    pattern: /仅拥有\s*stepskiper\s*角色|权限不足.*跳过工序/,
    message: '你没有跳过工序的权限，请联系管理员。',
  },
  {
    pattern: /机台设备.*当前状态为.*不可用于生产/,
    message: '机台当前状态不能用于生产，请先处理状态或占用。',
  },
  {
    pattern: /机台设备.*已被工单.*占用/,
    message: '机台已经被其他工单占用，请先释放后再开始。',
  },
  {
    pattern: /工装夹具.*当前状态为.*不可用于生产/,
    message: '工装夹具当前状态不能用于生产，请先处理状态或占用。',
  },
  {
    pattern: /工装夹具.*已被工单.*占用/,
    message: '工装夹具已经被其他工单占用，请先释放后再开始。',
  },
  {
    pattern: /模具.*当前状态为.*不可用于生产/,
    message: '模具当前状态不能用于生产，请先处理状态。',
  },
  {
    pattern: /模具.*已达设计寿命上限/,
    message: '模具寿命已经到上限，请先更换模具。',
  },
  {
    pattern: /量具.*当前状态为.*不可用于生产/,
    message: '量具当前状态不能用于生产，请先处理状态。',
  },
  {
    pattern: /量具.*校准已过期/,
    message: '量具已经过校准期限，请先校准后再使用。',
  },
  {
    pattern: /推送ERP生产汇报单失败/,
    message: 'ERP生产汇报单同步失败，请稍后重试。',
  },
  {
    pattern: /工单不存在/,
    message: '工单不存在或已被删除，请刷新后重试。',
  },
  {
    pattern: /exceptionType不能为空/,
    message: '请先选择异常类型。',
  },
  {
    pattern: /description不能为空/,
    message: '请先填写异常说明。',
  },
];

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();

  const raw = error as {
    message?: string;
    error?: string;
    msg?: string;
    response?: { data?: { message?: string; error?: string } };
  };

  return (
    raw.response?.data?.message?.trim()
    || raw.response?.data?.error?.trim()
    || raw.message?.trim()
    || raw.error?.trim()
    || raw.msg?.trim()
    || ''
  );
}

function looksTechnical(message: string): boolean {
  return /rollback-only|UnexpectedRollbackException|org\.springframework|java\.|SQLException|DataIntegrityViolationException|ConstraintViolationException|NestedServletException|Failed to|HTTP \d{3}/i.test(
    message,
  );
}

export function formatFlowActionError(actionLabel: string, error: unknown, fallback = `${actionLabel}失败`): string {
  const rawMessage = extractErrorMessage(error);
  if (!rawMessage) {
    return `${fallback}，请稍后重试。`;
  }

  const normalized = rawMessage.replace(ACTION_PREFIX_RE, '');

  for (const rule of FRIENDLY_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.message;
    }
  }

  if (looksTechnical(normalized)) {
    return `${actionLabel}失败：系统处理异常，请稍后重试或联系管理员。`;
  }

  if (normalized.startsWith(actionLabel) || normalized.startsWith(fallback)) {
    return normalized;
  }

  if (/^[\u4e00-\u9fa5]/.test(normalized)) {
    return `${actionLabel}失败：${normalized}`;
  }

  return `${actionLabel}失败：系统处理异常，请稍后重试或联系管理员。`;
}
