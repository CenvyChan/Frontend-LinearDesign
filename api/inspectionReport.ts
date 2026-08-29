import { requestClient } from '#/api/request';

export interface InspectionEfficiencyRow {
  completeTime?: number;
  createTime?: number;
  id: number;
  inspectMinutes?: number;
  inspectionResult?: string;
  inspectionType?: string;
  inspectorName?: string;
  materialCode?: string;
  materialName?: string;
  orderNo?: string;
  sourceBillNo?: string;
  startTime?: number;
  stepName?: string;
  taskStatus?: string;
  waitMinutes?: number;
}

export interface InspectionQualityRow {
  abnormalCount?: number;
  id: number;
  itemCode?: string;
  itemName?: string;
  judgement?: string;
  lowerLimit?: number;
  standardValue?: string;
  taskId?: number;
  upperLimit?: number;
  valueType?: string;
}

export interface InspectionEfficiencyReport {
  avgInspectMinutes?: number;
  avgWaitMinutes?: number;
  byInspector?: Record<string, number>;
  completed?: number;
  overdue?: number;
  rows?: InspectionEfficiencyRow[];
  total?: number;
}

export interface InspectionQualityReport {
  failByItem?: Record<string, number>;
  failItems?: number;
  passRate?: number;
  rows?: InspectionQualityRow[];
  totalItems?: number;
}

export async function getInspectionEfficiencyReport() {
  return requestClient.get('/inspection-reports/efficiency', { responseReturn: 'body' });
}

export async function getInspectionQualityReport() {
  return requestClient.get('/inspection-reports/quality', { responseReturn: 'body' });
}
