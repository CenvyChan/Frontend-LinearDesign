import { requestClient } from '#/api/request';

export interface ProcessTimeReportQuery {
  endTime?: number;
  operatorName?: string;
  orderNo?: string;
  processKeyword?: string;
  startTime?: number;
  tenantId?: number;
}

export interface ProcessTimeReportRow {
  actualEndTime?: number;
  actualHours?: number;
  actualMinutes?: number;
  actualQuantity?: number;
  actualTaktMinutes?: number;
  actualWorkSeconds?: number;
  anomalyLevel: string;
  anomalyText: string;
  defectQuantity?: number;
  efficiencyRate?: number;
  flowId: number;
  hourVarianceRate?: number;
  operatorId?: number;
  operatorName?: string;
  orderId?: number;
  orderNo?: string;
  processCode?: string;
  productCode?: string;
  productName?: string;
  remark?: string;
  standardDuration?: number;
  standardHours?: number;
  standardMinutes?: number;
  standardQuantity?: number;
  standardTaktMinutes?: number;
  stepName?: string;
  stepNo?: number;
  taktVarianceMinutes?: number;
  taktVarianceRate?: number;
  timeUnit?: string;
  varianceMinutes?: number;
}

export interface ProcessTimeReportSummary {
  abnormalCount: number;
  normalCount: number;
  overallEfficiencyRate?: number;
  totalActualMinutes?: number;
  totalCount: number;
  totalQuantity: number;
  totalStandardMinutes?: number;
  totalVarianceMinutes?: number;
}

export interface ProcessTimeReportResult {
  rows: ProcessTimeReportRow[];
  summary: ProcessTimeReportSummary;
}

export async function queryProcessTimeReport(data: ProcessTimeReportQuery) {
  return requestClient.post<ProcessTimeReportResult>('/process-time-report/query', data, {
    responseReturn: 'data',
  });
}
