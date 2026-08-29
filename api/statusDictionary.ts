import { requestClient } from '#/api/request';

export interface StatusTextEntry {
  code: string;
  domain: string;
  field: string;
  locale: string;
  text: string;
  updatedByName?: string;
  updatedTime?: number;
}

export interface StatusTextAuditEntry {
  action: string;
  newText?: string;
  oldText?: string;
  operateTime?: number;
  operatorName?: string;
}

export function getStatusTextOverrides(locale = 'zh-CN') {
  return requestClient.get('/system/status-dictionary/admin', {
    params: { locale },
    responseReturn: 'body',
  });
}

export function saveStatusTextOverride(entry: StatusTextEntry) {
  return requestClient.put('/system/status-dictionary/admin/entry', entry, {
    responseReturn: 'body',
  });
}

export function resetStatusTextOverride(entry: Pick<StatusTextEntry, 'code' | 'domain' | 'field' | 'locale'>) {
  return requestClient.post('/system/status-dictionary/admin/reset', entry, {
    responseReturn: 'body',
  });
}

export function getStatusTextAudit(entry: Pick<StatusTextEntry, 'code' | 'domain' | 'field' | 'locale'>) {
  return requestClient.get('/system/status-dictionary/admin/audit', {
    params: entry,
    responseReturn: 'body',
  });
}
