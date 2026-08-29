import type { ReturnTaskItem, ReturnTaskMaterialSummaryItem } from '#/api/production';

export type ReturnPoolTone = 'danger' | 'info' | 'normal' | 'stable' | 'success' | 'warning';

export interface ReturnPoolStage {
  blocked: number;
  description: string;
  done: number;
  key: 'applied' | 'closed' | 'erp' | 'inspection' | 'preview' | 'submit';
  label: string;
  tone: ReturnPoolTone;
  total: number;
}

export interface ReturnPoolIssueGroup {
  count: number;
  key: 'erpRejected' | 'errorRecord' | 'missingSourceQr' | 'pendingInspection';
  label: string;
  tone: ReturnPoolTone;
}

export interface ReturnPoolErpChain {
  erpBillNo?: string;
  erpBillStatus?: string;
  inspectionStatus?: string;
  orderNo: string;
  taskId: number;
}

export interface ReturnTaskActionState {
  canInspect: boolean;
  canPreview: boolean;
  canSubmit: boolean;
  canSyncStatus: boolean;
  canTransfer: boolean;
  risk: ReturnPoolTone;
}

export interface ReturnTaskPoolV2Model {
  erpChains: ReturnPoolErpChain[];
  issueGroups: ReturnPoolIssueGroup[];
  stages: ReturnPoolStage[];
  summary: {
    blockedCount: number;
    inspectionPendingCount: number;
    materialCount: number;
    pendingQty: number;
    taskCount: number;
  };
}

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function tasksOf(rows: ReturnTaskMaterialSummaryItem[]): ReturnTaskItem[] {
  return rows.flatMap((row) => row.tasks || []);
}

function rowPendingQty(row: ReturnTaskMaterialSummaryItem): number {
  if (row.totalRequestQty !== undefined) return asNumber(row.totalRequestQty);
  return (row.tasks || []).reduce((sum, task) => sum + asNumber(task.requestQty), 0);
}

function isErpRejected(task: ReturnTaskItem): boolean {
  return (
    task.taskStatus === 'FAILED' ||
    task.taskStatus === 'REJECTED' ||
    task.taskStatus === 'TERMINATED' ||
    task.erpBillStatus === 'REJECTED' ||
    task.erpBillStatus === 'TERMINATED'
  );
}

function hasErrorRecord(task: ReturnTaskItem): boolean {
  return hasText(task.failReason) || hasText(task.inspectionRemark);
}

function count(tasks: ReturnTaskItem[], predicate: (task: ReturnTaskItem) => boolean): number {
  return tasks.filter(predicate).length;
}

function tone(total: number, blocked: number): ReturnPoolTone {
  if (blocked > 0) return 'danger';
  if (total > 0) return 'warning';
  return 'info';
}

export function getReturnTaskActionState(task: ReturnTaskItem): ReturnTaskActionState {
  const risky = isErpRejected(task) || hasText(task.failReason);
  const needsInspection = task.erpBillStatus === 'APPROVED' && task.inspectionStatus !== 'INSPECT_PASS_RETURN_TO_STOCK';
  const stable = task.taskStatus === 'INSPECTED' || task.taskStatus === 'CLOSED';

  return {
    canInspect: task.erpBillStatus === 'APPROVED',
    canPreview: ['APPLIED', 'FAILED'].includes(task.taskStatus),
    canSubmit: ['APPLIED', 'PREVIEWED', 'FAILED'].includes(task.taskStatus),
    canSyncStatus: Boolean(task.erpBillId || task.erpBillNo),
    canTransfer: ['APPLIED', 'PREVIEWED'].includes(task.taskStatus),
    risk: risky ? 'danger' : stable ? 'stable' : needsInspection ? 'warning' : 'normal',
  };
}

export function buildReturnTaskPoolV2Model(rows: ReturnTaskMaterialSummaryItem[] = []): ReturnTaskPoolV2Model {
  const tasks = tasksOf(rows);
  const missingSourceQrCount = count(tasks, (task) => !hasText(task.sourceQrToken));
  const pendingInspectionCount = count(
    tasks,
    (task) => task.inspectionStatus === 'PENDING_INSPECTION' || task.taskStatus === 'INSPECTING',
  );
  const erpRejectedCount = count(tasks, isErpRejected);
  const errorRecordCount = count(tasks, hasErrorRecord);
  const issueGroups = ([
    { count: missingSourceQrCount, key: 'missingSourceQr', label: '缺少来源条码', tone: 'warning' },
    { count: pendingInspectionCount, key: 'pendingInspection', label: '待检验结论', tone: 'warning' },
    { count: erpRejectedCount, key: 'erpRejected', label: 'ERP驳回/终止', tone: 'danger' },
    { count: errorRecordCount, key: 'errorRecord', label: '失败记录', tone: 'danger' },
  ] as ReturnPoolIssueGroup[]).filter((group) => group.count > 0);

  return {
    erpChains: tasks
      .filter((task) => hasText(task.erpBillNo) || Boolean(task.erpBillId))
      .map((task) => ({
        erpBillNo: task.erpBillNo,
        erpBillStatus: task.erpBillStatus || task.erpDocumentStatus,
        inspectionStatus: task.inspectionStatus,
        orderNo: task.orderNo,
        taskId: task.id,
      })),
    issueGroups,
    stages: [
      {
        blocked: 0,
        description: '退料申请进入处理池',
        done: 0,
        key: 'applied',
        label: '申请',
        tone: tone(count(tasks, (task) => task.taskStatus === 'APPLIED'), 0),
        total: count(tasks, (task) => task.taskStatus === 'APPLIED'),
      },
      {
        blocked: 0,
        description: 'ERP退料单草稿预览',
        done: count(tasks, (task) => task.taskStatus === 'PREVIEWED'),
        key: 'preview',
        label: '预览',
        tone: tone(count(tasks, (task) => task.taskStatus === 'PREVIEWED'), 0),
        total: count(tasks, (task) => task.taskStatus === 'PREVIEWED'),
      },
      {
        blocked: 0,
        description: '退料单提交ERP',
        done: count(tasks, (task) => task.taskStatus === 'SUBMITTED'),
        key: 'submit',
        label: '提交',
        tone: tone(count(tasks, (task) => ['SUBMITTED', 'APPROVING'].includes(task.taskStatus)), 0),
        total: count(tasks, (task) => ['SUBMITTED', 'APPROVING'].includes(task.taskStatus)),
      },
      {
        blocked: erpRejectedCount,
        description: 'ERP退料单审核与异常',
        done: count(tasks, (task) => task.erpBillStatus === 'APPROVED'),
        key: 'erp',
        label: 'ERP',
        tone: tone(erpRejectedCount, erpRejectedCount),
        total: erpRejectedCount,
      },
      {
        blocked: 0,
        description: '退料检验结论与去向',
        done: count(tasks, (task) => task.taskStatus === 'INSPECTED'),
        key: 'inspection',
        label: '检验',
        tone: tone(pendingInspectionCount, 0),
        total: pendingInspectionCount,
      },
      {
        blocked: 0,
        description: '退料闭环',
        done: count(tasks, (task) => ['CLOSED', 'INSPECTED'].includes(task.taskStatus)),
        key: 'closed',
        label: '闭环',
        tone: 'success',
        total: count(tasks, (task) => ['CLOSED', 'INSPECTED'].includes(task.taskStatus)),
      },
    ],
    summary: {
      blockedCount: pendingInspectionCount + erpRejectedCount,
      inspectionPendingCount: pendingInspectionCount,
      materialCount: rows.length,
      pendingQty: rows.reduce((sum, row) => sum + rowPendingQty(row), 0),
      taskCount: tasks.length,
    },
  };
}
