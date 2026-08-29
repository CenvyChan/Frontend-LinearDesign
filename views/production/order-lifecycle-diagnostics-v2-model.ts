export type LifecycleStageKey = 'flow' | 'inspection' | 'instock' | 'order' | 'pqc1' | 'productReport';
export type LifecycleTone = 'danger' | 'info' | 'primary' | 'success' | 'warning';

export interface LifecycleStage {
  description: string;
  done: number;
  issueCount: number;
  key: LifecycleStageKey;
  label: string;
  tone: LifecycleTone;
  total: number;
}

export interface IssueGroup {
  count: number;
  key: 'erp' | 'missing' | 'other' | 'quantity';
  label: string;
  level: string;
}

export interface RecordSummary {
  errorRecords: number;
  flowCount: number;
  inspectionCount: number;
  instockCount: number;
  wageCount: number;
}

const ISSUE_STAGE_MAP: Record<string, LifecycleStageKey> = {
  COMPLETED_FLOW_WITHOUT_WAGE: 'productReport',
  ORDER_COMPLETED_QTY_MISMATCH: 'order',
  PQC1_PUSHED_WITHOUT_INSTOCK_TASK: 'pqc1',
  QC_FLOW_WITHOUT_INSPECTION_TASK: 'inspection',
};

function toArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function countDone<T>(rows: T[], predicate: (row: T) => boolean): number {
  return rows.filter(predicate).length;
}

function statusDone(status: unknown): boolean {
  return ['APPROVED', 'AUDITED', 'CALCULATED', 'COMPLETED', 'CONFIRMED', 'ERP_AUDITED', 'ERP_PUSHED', 'PUSHED'].includes(
    String(status || ''),
  );
}

function stageTone(total: number, done: number, issueCount: number, hasError: boolean): LifecycleTone {
  if (hasError) return 'danger';
  if (issueCount > 0) return 'warning';
  if (total > 0 && done >= total) return 'success';
  if (done > 0) return 'primary';
  return 'info';
}

function issueStage(code: string): LifecycleStageKey {
  return ISSUE_STAGE_MAP[code] ||
    (code.includes('PQC1') ? 'pqc1' : code.includes('PRODUCT_REPORT') || code.includes('R1') ? 'productReport' : 'flow');
}

function countStageIssues(data: Record<string, any>, stageKey: LifecycleStageKey): number {
  return toArray(data?.diagnostics).filter((issue: any) => issueStage(String(issue?.code || '')) === stageKey).length;
}

function rowHasError(row: any): boolean {
  return ['failReason', 'failureReason', 'lastError', 'rawErpError', 'rejectReason'].some((key) => hasText(row?.[key]));
}

export function summarizeRecords(data: Record<string, any> = {}): RecordSummary {
  const flowCards = toArray(data.flowCards);
  const inspectionTasks = toArray(data.inspectionTasks);
  const wageSettlements = toArray(data.wageSettlements);
  const instockTasks = toArray(data.instockTasks);
  return {
    errorRecords: [...inspectionTasks, ...wageSettlements, ...instockTasks].filter(rowHasError).length,
    flowCount: flowCards.length,
    inspectionCount: inspectionTasks.length,
    instockCount: instockTasks.length,
    wageCount: wageSettlements.length,
  };
}

export function buildLifecycleStages(data: Record<string, any> = {}): LifecycleStage[] {
  const summary = data.summary || {};
  const flowCards = toArray(data.flowCards);
  const inspectionTasks = toArray(data.inspectionTasks);
  const productReportRows = toArray(data.productReport?.rows || data.r1?.rows);
  const pqc1Rows = toArray(data.pqc1?.rows);
  const instockTasks = toArray(data.instockTasks);
  const orderTotal = data.order || data.orderNo ? 1 : 0;
  const orderDone = asNumber(summary.orderCompletedQty) > 0 || asNumber(summary.terminalCompletedQtyFromFlows) > 0 ? 1 : 0;

  const stageDefs: Array<Omit<LifecycleStage, 'issueCount' | 'tone'> & { hasError: boolean }> = [
    {
      description: '生产工单与计划数量',
      done: orderDone,
      hasError: false,
      key: 'order',
      label: '工单',
      total: orderTotal || 1,
    },
    {
      description: '生产/检验流转卡执行',
      done: asNumber(summary.completedFlowCount) || countDone(flowCards, (row: any) => statusDone(row.flowStatus)),
      hasError: false,
      key: 'flow',
      label: '流转卡',
      total: asNumber(summary.flowCount) || flowCards.length,
    },
    {
      description: '检验任务与结果',
      done: countDone(inspectionTasks, (row: any) => statusDone(row.taskStatus) || statusDone(row.erpPushStatus)),
      hasError: inspectionTasks.some(rowHasError),
      key: 'inspection',
      label: '检验',
      total: asNumber(summary.inspectionTaskCount) || inspectionTasks.length,
    },
    {
      description: '生产汇报单/工资核算',
      done:
        asNumber(summary.productReportBillCount ?? summary.r1BillCount) ||
        countDone(productReportRows, (row: any) => hasText(row.erpReportBillNo) || hasText(row.flowReportBillNo)),
      hasError: productReportRows.some(rowHasError) || toArray(data.wageSettlements).some(rowHasError),
      key: 'productReport',
      label: '生产汇报单',
      total: productReportRows.length || asNumber(summary.wageSettlementCount),
    },
    {
      description: '产品入库检验单下推',
      done:
        asNumber(summary.pqc1PushedCount) ||
        countDone(pqc1Rows, (row: any) => hasText(row.erpInspectionBillNo) || statusDone(row.erpPushStatus)),
      hasError: pqc1Rows.some(rowHasError),
      key: 'pqc1',
      label: '产品入库检验',
      total: pqc1Rows.length,
    },
    {
      description: '生产入库确认与 ERP 入库单',
      done: countDone(instockTasks, (row: any) => hasText(row.erpInstockBillNo) || statusDone(row.taskStatus) || statusDone(row.erpBillStatus)),
      hasError: instockTasks.some(rowHasError),
      key: 'instock',
      label: '入库',
      total: asNumber(summary.instockTaskCount) || instockTasks.length,
    },
  ];

  return stageDefs.map((stage) => {
    const issueCount = countStageIssues(data, stage.key);
    return {
      description: stage.description,
      done: stage.done,
      issueCount,
      key: stage.key,
      label: stage.label,
      tone: stageTone(stage.total, stage.done, issueCount, stage.hasError),
      total: stage.total,
    };
  });
}

function groupForIssue(code: string): Pick<IssueGroup, 'key' | 'label'> {
  if (code.includes('QTY') || code.includes('MISMATCH')) {
    return { key: 'quantity', label: '数量一致性' };
  }
  if (code.includes('WITHOUT') || code.includes('MISSING')) {
    return { key: 'missing', label: '缺失记录' };
  }
  if (code.includes('ERP') || code.includes('PUSH') || code.includes('AUDIT')) {
    return { key: 'erp', label: 'ERP 单据状态' };
  }
  return { key: 'other', label: '其他问题' };
}

export function buildIssueGroups(data: Record<string, any> = {}): IssueGroup[] {
  const groups = new Map<IssueGroup['key'], IssueGroup>();
  for (const issue of toArray(data.diagnostics)) {
    const group = groupForIssue(String(issue?.code || ''));
    const current = groups.get(group.key);
    groups.set(group.key, {
      count: (current?.count || 0) + 1,
      key: group.key,
      label: group.label,
      level: current?.level || String(issue?.level || 'INFO'),
    });
  }
  return [...groups.values()];
}
