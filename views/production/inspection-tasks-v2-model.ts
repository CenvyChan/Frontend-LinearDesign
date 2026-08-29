import type { InspectionErpPushStatus, ProcessInspectionTask } from '#/api/inspectionTask';

export type InspectionTaskV2Tone = 'danger' | 'info' | 'normal' | 'primary' | 'success' | 'warning';

export interface InspectionTaskV2Stage {
  blocked: number;
  description: string;
  done: number;
  key: 'assign' | 'erp' | 'inspect' | 'result' | 'source';
  label: string;
  tone: InspectionTaskV2Tone;
  total: number;
}

export interface InspectionTaskV2IssueGroup {
  count: number;
  key: 'defectFound' | 'erpFailed' | 'missingScheme' | 'waitingProductReport';
  label: string;
  tone: InspectionTaskV2Tone;
}

export interface InspectionTaskV2ErpChain {
  erpInspectionBillNo?: string;
  erpReportBillNo?: string;
  lastError?: string;
  sourceNo: string;
  status: string;
  taskId: number;
}

export interface InspectionTaskV2ActionState {
  canAssign: boolean;
  canComplete: boolean;
  canRetryErp: boolean;
  canStart: boolean;
  canViewDetail: boolean;
  risk: InspectionTaskV2Tone;
}

export interface InspectionTasksV2Model {
  erpChains: InspectionTaskV2ErpChain[];
  issueGroups: InspectionTaskV2IssueGroup[];
  stages: InspectionTaskV2Stage[];
  summary: {
    blocked: number;
    completed: number;
    inProgress: number;
    pending: number;
    total: number;
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(rows: ProcessInspectionTask[], predicate: (row: ProcessInspectionTask) => boolean): number {
  return rows.filter(predicate).length;
}

function hasDefect(row: ProcessInspectionTask): boolean {
  return Number(row.unqualifiedQuantity ?? row.defectQuantity ?? 0) > 0
    || Number(row.scrapQuantity || 0) > 0
    || ['FAIL', 'HAS_DEFECT'].includes(String(row.inspectionResult || ''));
}

function isMissingScheme(row: ProcessInspectionTask): boolean {
  return !row.schemeId && !hasText(row.schemeCode);
}

function stageTone(total: number, blocked: number, done = 0): InspectionTaskV2Tone {
  if (blocked > 0) return 'danger';
  if (total > 0 && done >= total) return 'success';
  if (total > 0) return 'warning';
  return 'info';
}

export function getInspectionTaskV2ActionState(row: ProcessInspectionTask): InspectionTaskV2ActionState {
  const erpPushStatus = normalizeInspectionErpPushStatus(row.erpPushStatus);
  const risk = erpPushStatus === 'PUSH_FAILED' || hasText(row.lastError)
    ? 'danger'
    : erpPushStatus === 'WAIT_REPORT_AUDIT'
      ? 'warning'
      : row.taskStatus === 'COMPLETED'
        ? 'success'
        : 'normal';

  return {
    canAssign: row.taskStatus !== 'COMPLETED' && row.taskStatus !== 'CANCELLED',
    canComplete: row.taskStatus === 'PENDING' || row.taskStatus === 'IN_PROGRESS',
    canRetryErp: ['PUSH_FAILED', 'PUSHED', 'READY_TO_PUSH'].includes(erpPushStatus),
    canStart: row.taskStatus === 'PENDING',
    canViewDetail: true,
    risk,
  };
}

export function normalizeInspectionErpPushStatus(status?: string): InspectionErpPushStatus {
  if (status === 'WAIT_R1') return 'WAIT_REPORT_AUDIT';
  if (status === 'PUSH_PENDING') return 'READY_TO_PUSH';
  const officialStatuses: InspectionErpPushStatus[] = [
    'WAIT_REPORT_AUDIT', 'WAIT_LOCAL_RESULT', 'READY_TO_PUSH', 'PUSHING',
    'PUSHED', 'ERP_AUDITED', 'PUSH_FAILED', 'SOURCE_INVALID', 'SKIPPED',
  ];
  return officialStatuses.includes(status as InspectionErpPushStatus)
    ? status as InspectionErpPushStatus
    : 'WAIT_REPORT_AUDIT';
}

export function validateProductInboundInspectionQuantities(values: {
  inspectionTotalQuantity: number;
  qualifiedQuantity: number;
  scrapQuantity: number;
  unqualifiedQuantity: number;
}): { message?: string; valid: boolean } {
  const quantities = [
    values.inspectionTotalQuantity,
    values.qualifiedQuantity,
    values.unqualifiedQuantity,
    values.scrapQuantity,
  ];
  if (quantities.some((value) => !Number.isFinite(value) || value < 0)) {
    return { valid: false, message: '数量必须为非负数' };
  }
  if (Math.abs(values.inspectionTotalQuantity
    - values.qualifiedQuantity - values.unqualifiedQuantity - values.scrapQuantity) > 0.000001) {
    return { valid: false, message: '检验总数必须等于合格、不良和报废数量之和' };
  }
  return { valid: true };
}

export function buildProductInboundInspectionRequest(values: {
  inspectionResult: string;
  inspectionTotalQuantity: number;
  qualifiedQuantity: number;
  remark?: string;
  scrapQuantity: number;
  unqualifiedQuantity: number;
  reworkRequired?: boolean;
}) {
  const validation = validateProductInboundInspectionQuantities(values);
  if (!validation.valid) {
    throw new Error(validation.message || '数量校验失败');
  }
  const defectiveQuantity = values.unqualifiedQuantity + values.scrapQuantity;
  if (defectiveQuantity > 0 && typeof values.reworkRequired !== 'boolean') {
    throw new Error('请先选择不良处置方式');
  }
  if (typeof values.reworkRequired !== 'boolean') {
    return { ...values };
  }
  return {
    ...values,
    unqualifiedQuantity: values.reworkRequired ? defectiveQuantity : 0,
    scrapQuantity: values.reworkRequired ? 0 : defectiveQuantity,
  };
}

export function buildInspectionTasksV2Model(rows: ProcessInspectionTask[] = []): InspectionTasksV2Model {
  const missingScheme = count(rows, isMissingScheme);
  const erpFailed = count(rows, (row) => normalizeInspectionErpPushStatus(row.erpPushStatus) === 'PUSH_FAILED' || hasText(row.lastError));
  const waitingProductReport = count(rows, (row) => normalizeInspectionErpPushStatus(row.erpPushStatus) === 'WAIT_REPORT_AUDIT');
  const defectFound = count(rows, hasDefect);
  const blocked = erpFailed + waitingProductReport;

  return {
    erpChains: rows
      .filter((row) => hasText(row.erpInspectionBillNo) || hasText(row.erpReportBillNo))
      .map((row) => ({
        erpInspectionBillNo: row.erpInspectionBillNo,
        erpReportBillNo: row.erpReportBillNo,
        lastError: row.lastError,
        sourceNo: row.sourceBillNo || row.orderNo || '-',
        status: normalizeInspectionErpPushStatus(row.erpPushStatus),
        taskId: row.id,
      })),
    issueGroups: ([
      { count: missingScheme, key: 'missingScheme', label: '缺少检验方案', tone: 'warning' },
      { count: erpFailed, key: 'erpFailed', label: 'ERP 下推失败', tone: 'danger' },
      { count: waitingProductReport, key: 'waitingProductReport', label: '等待生产汇报单', tone: 'warning' },
      { count: defectFound, key: 'defectFound', label: '检出不良', tone: 'danger' },
    ] as InspectionTaskV2IssueGroup[]).filter((item) => item.count > 0),
    stages: [
      {
        blocked: 0,
        description: '来源单据或工单已生成检验任务',
        done: rows.length,
        key: 'source',
        label: '任务来源',
        tone: rows.length ? 'success' : 'info',
        total: rows.length,
      },
      {
        blocked: 0,
        description: '任务已指派或已被检验员领取',
        done: count(rows, (row) => hasText(row.assignedToName) || hasText(row.inspectorName)),
        key: 'assign',
        label: '指派',
        tone: stageTone(rows.length, 0, count(rows, (row) => hasText(row.assignedToName) || hasText(row.inspectorName))),
        total: rows.length,
      },
      {
        blocked: 0,
        description: '检验执行中或已经完成',
        done: count(rows, (row) => row.taskStatus === 'COMPLETED'),
        key: 'inspect',
        label: '检验',
        tone: stageTone(count(rows, (row) => ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(row.taskStatus)), 0),
        total: count(rows, (row) => ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(row.taskStatus)),
      },
      {
        blocked: defectFound,
        description: '检验结论、样本和不良数量',
        done: count(rows, (row) => row.taskStatus === 'COMPLETED' && !hasDefect(row)),
        key: 'result',
        label: '结果',
        tone: stageTone(count(rows, (row) => row.taskStatus === 'COMPLETED'), defectFound),
        total: count(rows, (row) => row.taskStatus === 'COMPLETED'),
      },
      {
        blocked,
        description: '生产汇报单/产品入库检验下推与 ERP 状态同步',
        done: count(rows, (row) => ['PUSHED', 'ERP_AUDITED', 'SKIPPED'].includes(normalizeInspectionErpPushStatus(row.erpPushStatus))),
        key: 'erp',
        label: 'ERP',
        tone: stageTone(count(rows, (row) => row.erpPushStatus !== 'SKIPPED'), blocked),
        total: count(rows, (row) => normalizeInspectionErpPushStatus(row.erpPushStatus) !== 'SKIPPED'),
      },
    ],
    summary: {
      blocked,
      completed: count(rows, (row) => row.taskStatus === 'COMPLETED'),
      inProgress: count(rows, (row) => row.taskStatus === 'IN_PROGRESS'),
      pending: count(rows, (row) => row.taskStatus === 'PENDING'),
      total: rows.length,
    },
  };
}
