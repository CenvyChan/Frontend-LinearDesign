import { requestClient } from '#/api/request';

export interface ErpOperationsHealth {
  dlqCount: number;
  erpUnavailableCount: number;
  failedEventCount: number;
  openExceptionCount: number;
  retryBacklogCount: number;
}

export interface ErpOperationEvent {
  eventId: string;
  erpAcctCode: string;
  eventStatus: string;
  billNo?: string;
  formId: string;
  lastError?: string;
  retryCount?: number;
  maxRetryCount?: number;
  traceId?: string;
}

export const getErpOperationsHealth = () => requestClient.get<ErpOperationsHealth>('/erp-operations/health');
export const getErpOperationEvents = (erpAcctCode?: string) => requestClient.get<ErpOperationEvent[]>('/erp-operations/events', { params: { erpAcctCode } });
export const retryErpOperationEvents = (erpAcctCode: string, eventIds: string[]) => requestClient.post('/erp-operations/events/retry', { erpAcctCode, eventIds });
