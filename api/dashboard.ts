import { requestClient } from '#/api/request';

export type DashboardTone = 'danger' | 'info' | 'success' | 'warning';

export interface DashboardMetricMap {
  [key: string]: number | string | undefined;
}

export interface DashboardStage {
  blocked: number;
  done: number;
  key: string;
  label: string;
  tone: DashboardTone;
  total: number;
}

export interface DashboardBlockerGroup {
  count: number;
  label: string;
  sourceType: string;
}

export interface DashboardRiskRow {
  durationMinutes?: number;
  lastError?: string;
  orderNo?: string;
  primaryAction?: string;
  priority: 'high' | 'low' | 'medium';
  relatedBillNo?: string;
  sourceId?: number;
  sourceType: string;
  stageKey?: string;
  targetRoute?: string;
  title: string;
}

export interface DashboardQuickLink {
  primaryAction?: string;
  targetRoute: string;
  title: string;
}

export interface DashboardTimelineItem {
  status?: string;
  targetRoute?: string;
  time?: number;
  title: string;
}

export interface DashboardNamedCountRow {
  count: number;
  label: string;
}

export interface DashboardWorkshopRow {
  attainmentRate: number;
  completedQuantity: number;
  plannedQuantity: number;
  status: string;
  workshopName: string;
}

export interface DashboardDeliveryRiskRow {
  orderNo?: string;
  planEndTime?: number;
  productName?: string;
  remainingHours: number;
  status: string;
}

export interface DashboardPushExceptionRow {
  inspectorName?: string;
  orderNo?: string;
  reason: string;
  taskCode: string;
}

export interface DashboardWorkCenterLoadRow {
  loadRate: number;
  queueCount: number;
  workCenterName: string;
}

export interface DashboardDispatchRow {
  priority: 'high' | 'low' | 'medium';
  reason: string;
  title: string;
}

export interface DashboardQueueFlowRow {
  operatorName?: string;
  orderNo?: string;
  status?: string;
  stepName?: string;
  workCenterName?: string;
}

export interface DashboardKanbanItem {
  orderNo?: string;
  subtitle?: string;
  taskCode: string;
}

export interface DashboardKanbanColumn {
  items: DashboardKanbanItem[];
  key: string;
  title: string;
}

export interface DashboardSampleExceptionRow {
  actionLabel: string;
  detail?: string;
  title: string;
}

export interface DashboardBillChain {
  inspectionBillNo?: string;
  pushStatus?: string;
  reportBillNo?: string;
}

export interface DashboardErpStageRow {
  code: string;
  done: number;
  label: string;
  total: number;
}

export interface DashboardBillChainNode {
  code: string;
  label: string;
  status: string;
  subtitle?: string;
}

export interface DashboardAuditWaitingRow {
  billNo?: string;
  billType: string;
  nextAction: string;
  orderNo?: string;
  ownerRole?: string;
  status: string;
  waitingHours: number;
}

export interface DashboardWarehouseTaskBucket {
  items: DashboardKanbanItem[];
  key: string;
  title: string;
}

export interface DashboardWarehouseRiskRow {
  locationCode: string;
  priority: 'high' | 'low' | 'medium';
  reason: string;
}

export interface DashboardScanAction {
  description: string;
  title: string;
}

export interface DashboardWarehouseHeatmapRow {
  cells: number[];
  label: string;
}

export interface DashboardWorkloadRow {
  label: string;
  loadRate: number;
  queueCount: number;
}

export interface DashboardHourVarianceRow {
  actualMinutes: number;
  deviationMinutes: number;
  expectedMinutes: number;
  label: string;
  needsReview: boolean;
}

export interface DashboardFailureQueueRow {
  action: string;
  billType: string;
  errorMessage: string;
  orderNo?: string;
  retryCount: number;
  targetBillNo?: string;
}

export interface DashboardTimelineLogRow {
  status: string;
  timeLabel: string;
  title: string;
  detail: string;
}

export interface DashboardMorningRiskRow {
  currentBlocker: string;
  department: string;
  impactScope: string;
  recommendation: string;
  risk: string;
}

export interface DashboardDepartmentActionRow {
  department: string;
  instruction: string;
  priority: string;
  actionLabel: string;
}

export interface ProductionClosureAnalyticsResult {
  auditWaitingRows?: DashboardAuditWaitingRow[];
  attainmentTrend?: DashboardMetricMap[];
  billChainNodes?: DashboardBillChainNode[];
  blockerGroups: DashboardBlockerGroup[];
  blockerRows: DashboardRiskRow[];
  closureTrend: DashboardMetricMap[];
  defectPareto?: DashboardNamedCountRow[];
  deliveryRiskRows?: DashboardDeliveryRiskRow[];
  delayBuckets?: DashboardNamedCountRow[];
  erpFailureReasons?: DashboardNamedCountRow[];
  erpStageSummary?: DashboardErpStageRow[];
  exceptionTimeRows?: DashboardNamedCountRow[];
  hourVarianceRows?: DashboardHourVarianceRow[];
  inspectionSummary?: DashboardNamedCountRow[];
  inspectionTrend?: DashboardMetricMap[];
  metrics: DashboardMetricMap;
  pushExceptionRows?: DashboardPushExceptionRow[];
  warehouseHeatmapRows?: DashboardWarehouseHeatmapRow[];
  warehouseTaskStatusRows?: DashboardNamedCountRow[];
  workloadRows?: DashboardWorkloadRow[];
  stages: DashboardStage[];
  updatedAt: number;
  workshopRows?: DashboardWorkshopRow[];
}

export interface ProductionClosureWorkspaceResult {
  billChain?: DashboardBillChain;
  departmentActions?: DashboardDepartmentActionRow[];
  dispatchRows?: DashboardDispatchRow[];
  erpFailureReasons?: DashboardNamedCountRow[];
  failureQueueRows?: DashboardFailureQueueRow[];
  kanbanColumns?: DashboardKanbanColumn[];
  loadRows?: DashboardWorkCenterLoadRow[];
  metrics: DashboardMetricMap;
  morningCarryoverRows?: DashboardNamedCountRow[];
  morningGoalRows?: DashboardNamedCountRow[];
  morningRiskRows?: DashboardMorningRiskRow[];
  queues: DashboardMetricMap;
  queueRows?: DashboardQueueFlowRow[];
  quickLinks: DashboardQuickLink[];
  riskRows: DashboardRiskRow[];
  scanActions?: DashboardScanAction[];
  sampleExceptions?: DashboardSampleExceptionRow[];
  timeline: DashboardTimelineItem[];
  timelineLogRows?: DashboardTimelineLogRow[];
  updatedAt: number;
  warehouseRiskRows?: DashboardWarehouseRiskRow[];
  warehouseTaskBuckets?: DashboardWarehouseTaskBucket[];
}

export async function getProductionClosureAnalytics(params?: {
  erpOrgNumber?: string;
  range?: '30d' | '7d' | 'today';
  scenario?: string;
  workshopNumber?: string;
}) {
  return requestClient.get<ProductionClosureAnalyticsResult>('/dashboard/production-closure/analytics', {
    params,
  });
}

export async function getProductionClosureWorkspace(params?: {
  erpOrgNumber?: string;
  range?: '30d' | '7d' | 'today';
  roleScope?: 'all' | 'my' | 'team';
  scenario?: string;
}) {
  return requestClient.get<ProductionClosureWorkspaceResult>('/dashboard/production-closure/workspace', {
    params,
  });
}
