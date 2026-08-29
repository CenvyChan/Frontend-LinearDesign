import { requestClient } from '#/api/request';

export interface DingTalkConfig {
  enabled: boolean;
  appKey: string;
  appSecret: string;
  agentId: string;
}

export interface DingTalkBindingItem {
  userId: number;
  username: string;
  realName: string;
  phone: string;
  dingtalkUserid: string;
  dingtalkName: string;
  isBound: number;
  bindTime: number | string | null;
}

export interface DingTalkDepartmentNode {
  deptId: number | string;
  name: string;
  parentId?: number | string;
  children?: DingTalkDepartmentNode[];
}

export interface DingTalkBatchBindItem {
  userId: number;
  dingtalkUserid: string;
  dingtalkName?: string;
}

export interface DingTalkContactSyncTask {
  taskId: number;
  taskNo: string;
  status: 'FAILED' | 'PARTIAL' | 'PENDING' | 'RUNNING' | 'SUCCESS' | string;
  phase?: string;
  departmentCount: number;
  scannedCount: number;
  boundCount: number;
  createdCount: number;
  failedCount: number;
  retryCount: number;
  lastError?: string | null;
  errorDetails?: string | null;
  autoCreate: boolean;
  createdTime?: number | null;
  startedTime?: number | null;
  finishTime?: number | null;
}

export async function getDingTalkConfig() {
  return requestClient.get('/dingtalk/config', { responseReturn: 'body' });
}

// ==================== 钉钉绑定管理 ====================

/**
 * 获取所有用户的钉钉绑定列表
 */
export async function getDingTalkBindingList() {
  return requestClient.get('/dingtalk/binding/list', { responseReturn: 'body' });
}

/**
 * 管理员绑定用户钉钉
 */
export async function adminBindDingTalk(data: {
  userId: number;
  dingtalkUserid: string;
  dingtalkName?: string;
}) {
  return requestClient.post('/dingtalk/admin/bind', data, { responseReturn: 'body' });
}

/**
 * 管理员解绑用户钉钉
 */
export async function adminUnbindDingTalk(userId: number) {
  return requestClient.post('/dingtalk/admin/unbind', { userId }, { responseReturn: 'body' });
}

export async function batchBindDingTalk(items: DingTalkBatchBindItem[]) {
  return requestClient.post('/dingtalk/binding/batch-bind', { items }, { responseReturn: 'body' });
}

export async function batchUnbindDingTalk(userIds: number[]) {
  return requestClient.post('/dingtalk/binding/batch-unbind', { userIds }, { responseReturn: 'body' });
}

// ==================== 测试消息 ====================

/**
 * 发送钉钉工作通知
 */
export async function sendDingTalkNotice(data: { userId: number | string; content: string }) {
  return requestClient.post('/dingtalk/send-notice', data, { responseReturn: 'body' });
}

export async function sendDingTalkToAll(data: { content: string; msgType?: string; title?: string }) {
  return requestClient.post('/dingtalk/send/all', data, { responseReturn: 'body' });
}

/**
 * 测试钉钉连接
 */
export async function testDingTalkConnection() {
  return requestClient.get('/dingtalk/test', { responseReturn: 'body' });
}

export async function getDingTalkDepartmentTree() {
  return requestClient.get('/dingtalk/departments/tree', { responseReturn: 'body' });
}

export async function syncDingTalkContacts(autoCreate = false) {
  return requestClient.post('/dingtalk/contacts/sync', { autoCreate }, { responseReturn: 'body' });
}

export async function getDingTalkContactSyncTask(taskId: number) {
  return requestClient.get(`/dingtalk/contacts/sync/${taskId}`, { responseReturn: 'body' });
}

// ==================== 用户个人绑定 ====================


/**
 * 获取当前用户的钉钉绑定信息
 */
export async function getCurrentUserBinding() {
  return requestClient.get('/dingtalk/binding', { responseReturn: 'body' });
}

/**
 * 通过手机号绑定钉钉
 */
export async function bindByMobile(mobile: string) {
  return requestClient.post('/dingtalk/bind-by-mobile', null, { params: { mobile }, responseReturn: 'body' });
}

/**
 * 手动绑定钉钉
 */
export async function bindDingTalk(data: { dingtalkUserid: string; dingtalkName?: string }) {
  return requestClient.post('/dingtalk/bind', data, { responseReturn: 'body' });
}

/**
 * 解绑钉钉账号
 */
export async function unbindDingTalk() {
  return requestClient.post('/dingtalk/unbind', {}, { responseReturn: 'body' });
}

/**
 * 通过授权码绑定（扫码）
 */
export async function bindByAuthCode(authCode: string) {
  return requestClient.post('/dingtalk/bind-by-code', null, { params: { authCode }, responseReturn: 'body' });
}
