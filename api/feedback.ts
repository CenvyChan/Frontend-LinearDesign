import { requestClient } from '#/api/request';

export type FeedbackPriority = 'HIGH' | 'LOW' | 'NORMAL' | 'URGENT';
export type FeedbackStatus =
  | 'ACCEPTED'
  | 'DEFERRED'
  | 'DEVELOPING'
  | 'DONE'
  | 'EVALUATING'
  | 'REJECTED'
  | 'SUBMITTED';

export interface FeedbackItem {
  id: number;
  title: string;
  description?: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  submitterId?: number;
  submitterName?: string;
  handlerId?: number;
  handlerName?: string;
  menuPath?: string;
  expectedDeliveryDate?: string;
  remark?: string;
  createTime?: number;
  updateTime?: number;
}

export interface FeedbackAttachment {
  id: number;
  feedbackId: number;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  fileExt?: string;
  contentType?: string;
  createdByName?: string;
  createTime?: number;
}

export interface FeedbackReply {
  id: number;
  feedbackId: number;
  replyContent?: string;
  expectedDeliveryDate?: string;
  replierName?: string;
  createTime?: number;
}

export interface FeedbackStatusLog {
  id: number;
  feedbackId: number;
  fromStatus?: FeedbackStatus;
  toStatus: FeedbackStatus;
  remark?: string;
  operatorName?: string;
  createTime?: number;
}

export interface FeedbackDetail {
  attachments: FeedbackAttachment[];
  feedback: FeedbackItem;
  replies: FeedbackReply[];
  statusLogs: FeedbackStatusLog[];
}

export interface FeedbackPageParams {
  keyword?: string;
  page?: number;
  priority?: FeedbackPriority | '';
  size?: number;
  status?: FeedbackStatus | '';
  submitterId?: number;
}

export interface FeedbackPayload {
  description?: string;
  menuPath: string;
  priority?: FeedbackPriority;
  remark?: string;
  title: string;
}

export async function getFeedbackPage(params: FeedbackPageParams) {
  return requestClient.get('/feedback/page', { params, responseReturn: 'body' });
}

export async function getFeedbackDetail(id: number) {
  return requestClient.get(`/feedback/${id}`, { responseReturn: 'body' });
}

export async function createFeedback(data: FeedbackPayload, files: File[]) {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('menuPath', data.menuPath);
  if (data.description) formData.append('description', data.description);
  if (data.priority) formData.append('priority', data.priority);
  if (data.remark) formData.append('remark', data.remark);
  files.forEach((file) => formData.append('files', file));
  return requestClient.post('/feedback', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

export async function updateFeedback(id: number, data: FeedbackPayload) {
  return requestClient.put(`/feedback/${id}`, data, { responseReturn: 'body' });
}

export async function changeFeedbackStatus(
  id: number,
  data: { remark?: string; status: FeedbackStatus },
) {
  return requestClient.post(`/feedback/${id}/status`, data, { responseReturn: 'body' });
}

export async function replyFeedback(
  id: number,
  data: { content: string; expectedDeliveryDate?: string },
) {
  return requestClient.post(`/feedback/${id}/reply`, data, { responseReturn: 'body' });
}

export async function uploadFeedbackAttachment(id: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post(`/feedback/${id}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseReturn: 'body',
  });
}

export async function deleteFeedbackAttachment(id: number) {
  return requestClient.delete(`/feedback/attachments/${id}`, { responseReturn: 'body' });
}
