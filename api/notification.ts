import { requestClient } from '#/api/request';

// ==================== 类型定义 ====================

/** 通知规则 */
export interface NotificationRuleItem {
  id?: number;
  ruleName: string;
  triggerType: string;
  notificationLevel: string;
  recipientType: string;
  recipientIds: string;
  messageTemplate: string;
  messageTitle: string;
  dingtalkEnabled: boolean;
  dingtalkMsgType: string;
  isEnabled: boolean;
  remark?: string;
  createTime?: number;
  updateTime?: number;
}

/** 通知记录 */
export interface NotificationLogItem {
  id?: number;
  ruleId?: number;
  ruleName?: string;
  triggerType: string;
  triggerContent?: string;
  notificationLevel: string;
  messageTitle?: string;
  messageContent?: string;
  recipients?: string;
  dingtalkSent: boolean;
  dingtalkSendTime?: number;
  dingtalkResponse?: string;
  dingtalkTaskId?: string;
  sendSuccess: boolean;
  sendTime?: number;
  remark?: string;
  createTime?: number;
}

export interface NotificationRecipientOption {
  id: number;
  username?: string;
  realName?: string;
  roleKey?: string;
  roleName?: string;
  type?: 'role' | 'user';
}

export interface NotificationRecipientOptions {
  users: NotificationRecipientOption[];
  roles: NotificationRecipientOption[];
}

/**
 * 兼容旧页面字段定义（notification-rule.vue）
 */
export interface NotificationRule {
  id?: number;
  ruleName: string;
  ruleType?: string;
  enabled?: boolean;
  receivers?: string;
  remark?: string;
}

function normalizeRulePayload(data: NotificationRuleItem | NotificationRule) {
  const payload: any = { ...data };
  if (payload.triggerType === undefined && payload.ruleType !== undefined) {
    payload.triggerType = payload.ruleType;
  }
  if (payload.isEnabled === undefined && payload.enabled !== undefined) {
    payload.isEnabled = payload.enabled;
  }
  if (payload.recipientIds === undefined && payload.receivers !== undefined) {
    payload.recipientIds = payload.receivers;
  }
  return payload;
}

// ==================== 通知规则 CRUD ====================

/** 获取所有通知规则 */
export async function getAllRules() {
  return requestClient.get('/notification/rules', { responseReturn: 'body' });
}

function toLegacyRule(item: any): NotificationRule {
  return {
    ...item,
    ruleType: item?.ruleType ?? item?.triggerType ?? '',
    enabled: item?.enabled ?? item?.isEnabled ?? true,
    receivers: item?.receivers ?? item?.recipientIds ?? '',
  };
}

/**
 * 兼容旧页面方法名：返回列表数组
 */
export async function getNotificationRuleList() {
  const res: any = await getAllRules();
  if (Array.isArray(res)) {
    return res.map(toLegacyRule);
  }
  if (Array.isArray(res?.data)) {
    return res.data.map(toLegacyRule);
  }
  return [];
}

/** 获取规则详情 */
export async function getRuleById(id: number) {
  return requestClient.get(`/notification/rules/${id}`, { responseReturn: 'body' });
}

/** 筛选通知规则 */
export async function getRulesByFilter(params: {
  keyword?: string;
  triggerType?: string;
  notificationLevel?: string;
}) {
  return requestClient.get('/notification/rules/filter', { params, responseReturn: 'body' });
}

/** 创建通知规则 */
export async function createNotificationRule(data: NotificationRuleItem | NotificationRule) {
  return requestClient.post('/notification/rules', normalizeRulePayload(data), { responseReturn: 'body' });
}

/** 更新通知规则 */
export async function updateNotificationRule(data: NotificationRuleItem | NotificationRule) {
  return requestClient.put('/notification/rules', normalizeRulePayload(data), { responseReturn: 'body' });
}

/** 删除通知规则 */
export async function deleteNotificationRule(id: number) {
  return requestClient.delete(`/notification/rules/${id}`, { responseReturn: 'body' });
}

/** 切换规则启用状态 */
export async function toggleRuleEnabled(id: number) {
  return requestClient.post(`/notification/rules/${id}/toggle`, {}, { responseReturn: 'body' });
}

/** 批量启用/禁用规则 */
export async function batchEnableRules(ids: number[], enabled: boolean) {
  return requestClient.post('/notification/rules/batch-enable', { ids, enabled }, { responseReturn: 'body' });
}

export async function batchUpsertRules(rules: Array<NotificationRuleItem | NotificationRule>) {
  return requestClient.post(
    '/notification/rules/batch-upsert',
    rules.map((rule) => normalizeRulePayload(rule)),
    { responseReturn: 'body' },
  );
}

export async function getRecipientOptions() {
  return requestClient.get<{
    data: NotificationRecipientOptions;
    message?: string;
    success: boolean;
  }>('/notification/recipient-options', { responseReturn: 'body' });
}

// ==================== 通知记录查询 ====================

/** 分页查询通知记录（含 total 分页信息） */
export async function getNotificationLogList(params: {
  page?: number;
  size?: number;
  triggerType?: string;
  notificationLevel?: string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  sendSuccess?: boolean | string;
  dingtalkSent?: boolean | string;
}) {
  return requestClient.get('/notification/logs/page', { params, responseReturn: 'body' });
}

// ==================== 枚举和常量 ====================

/** 获取所有触发类型列表 */
export async function getTriggerTypes() {
  return requestClient.get('/notification/trigger-types', { responseReturn: 'body' });
}

/** 获取所有通知级别列表 */
export async function getNotificationLevels() {
  return requestClient.get('/notification/notification-levels', { responseReturn: 'body' });
}

// ==================== 个人收件箱（站内信铃铛） ====================

/** 收件箱条目：合并发送流水的消息内容与本人已读态 */
export interface NotificationInboxItem {
  id: number;
  logId: number;
  title?: string;
  content?: string;
  triggerType?: string;
  createTime?: number;
  isRead: boolean;
  readTime?: number;
  dingtalkSent?: boolean;
}

/** 分页查询当前登录用户的通知收件箱 */
export async function getMyInbox(params: {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
}) {
  return requestClient.get('/notification/my', { params, responseReturn: 'body' });
}

/** 获取当前用户未读通知数量（供铃铛红点展示） */
export async function getMyUnreadCount() {
  return requestClient.get('/notification/my/unread-count', { responseReturn: 'body' });
}

/** 标记单条通知已读 */
export async function markNotificationRead(id: number) {
  return requestClient.post(`/notification/my/${id}/read`, {}, { responseReturn: 'body' });
}

/** 全部标记已读 */
export async function markAllNotificationsRead() {
  return requestClient.post('/notification/my/read-all', {}, { responseReturn: 'body' });
}

/** 删除我的一条通知（仅影响本人收件箱，不影响其他收件人或发送流水） */
export async function deleteMyNotification(id: number) {
  return requestClient.delete(`/notification/my/${id}`, { responseReturn: 'body' });
}
