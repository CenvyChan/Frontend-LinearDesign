import type { NotificationRecipientOption } from '#/api/notification';

export type RecipientTransferKey = `role:${number}` | `user:${number}`;

export interface RecipientTransferItem {
  key: RecipientTransferKey;
  label: string;
}

function compactLabel(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' / ');
}

export function buildRecipientTransferData(
  users: NotificationRecipientOption[],
  roles: NotificationRecipientOption[],
): RecipientTransferItem[] {
  return [
    ...users.map((item) => ({
      key: `user:${item.id}` as RecipientTransferKey,
      label: `用户 ${compactLabel([item.username || `用户#${item.id}`, item.realName])}`,
    })),
    ...roles.map((item) => ({
      key: `role:${item.id}` as RecipientTransferKey,
      label: `角色 ${compactLabel([item.roleName || `角色#${item.id}`, item.roleKey])}`,
    })),
  ];
}

export function buildRecipientKeys(userIds: number[], roleIds: number[]): RecipientTransferKey[] {
  return [
    ...userIds.map((id) => `user:${id}` as RecipientTransferKey),
    ...roleIds.map((id) => `role:${id}` as RecipientTransferKey),
  ];
}

function toIds(value: unknown): number[] {
  return String(value ?? '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter(Boolean);
}

/**
 * 解析后端返回的 recipientIds，兼容 JSON 新格式与逗号旧格式。
 *
 * 旧格式（纯逗号分隔）必须按 recipientType 判断归属：只含 ROLE 时是角色 ID，
 * 否则是用户 ID。原实现一律当用户 ID，导致打开一条 ROLE 旧格式规则时角色栏为空、
 * 用户栏错误显示角色 ID，一按保存就把 ROLE=1 静默改写成 USER=1
 * （buildRecipientPayload 会按 formData 重算 recipientType）。
 * 后端 NotificationService.parseRecipientIds 有同构缺陷，已一并修复。
 */
export function parseRecipientIds(
  recipientIds: string | undefined,
  recipientType: string | undefined,
): { roleIds: number[]; userIds: number[] } {
  const raw = (recipientIds || '').trim();
  if (!raw) return { roleIds: [], userIds: [] };
  // 判 JSON 必须看 {} 包裹，不能靠 try/catch：JSON.parse('14') 会成功并返回数字 14，
  // 于是 parsed.r / parsed.u 都是 undefined、收件人全空。原实现正是这样写的，
  // 纯 USER 的旧格式（如 "14"）因此也解析不出来 —— 与后端那条 ROLE 缺陷是两个独立 bug。
  const looksLikeJson = raw.startsWith('{') && raw.endsWith('}');
  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(raw);
      return { roleIds: toIds(parsed.r), userIds: toIds(parsed.u) };
    } catch {
      // 落到下面按旧格式处理
    }
  }
  const type = (recipientType || '').toUpperCase();
  return type.includes('ROLE') && !type.includes('USER')
    ? { roleIds: toIds(raw), userIds: [] }
    : { roleIds: [], userIds: toIds(raw) };
}

export function splitRecipientKeys(keys: RecipientTransferKey[]) {
  return keys.reduce(
    (result, key) => {
      const [type, rawId] = key.split(':');
      const id = Number(rawId);
      if (!id) return result;
      if (type === 'user') {
        result.userIds.push(id);
      }
      if (type === 'role') {
        result.roleIds.push(id);
      }
      return result;
    },
    { roleIds: [] as number[], userIds: [] as number[] },
  );
}
