import type {
  MaterialRequestTaskItem,
  MaterialRequestTaskMaterialSummaryItem,
} from '#/api/production';

export type PickPoolTone = 'danger' | 'info' | 'normal' | 'primary' | 'stable' | 'success' | 'warning';

export interface PickPoolStage {
  blocked: number;
  description: string;
  done: number;
  key: 'applied' | 'done' | 'erp' | 'issue' | 'prepare';
  label: string;
  tone: PickPoolTone;
  total: number;
}

export interface PickPoolIssueGroup {
  count: number;
  key: 'erpRejected' | 'errorRecord' | 'missingStock';
  label: string;
  tone: PickPoolTone;
}

export interface PickPoolErpChain {
  erpBillNo?: string;
  erpBillStatus?: string;
  lastError?: string;
  orderNo: string;
  taskId: number;
}

export interface PickTaskActionState {
  canClose: boolean;
  canIssue: boolean;
  canPrepare: boolean;
  canSyncStatus: boolean;
  canTransfer: boolean;
  risk: PickPoolTone;
}

export interface PickTaskPoolV2Model {
  erpChains: PickPoolErpChain[];
  issueGroups: PickPoolIssueGroup[];
  stages: PickPoolStage[];
  summary: {
    blockedCount: number;
    materialCount: number;
    pendingQty: number;
    readyToIssueCount: number;
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

export function buildMaterialRequestSummaryKey(row: {
  applyType?: string;
  defaultStockNumber?: string;
  materialCode?: string;
  warehouseType?: string;
}): string {
  return [row.materialCode, row.defaultStockNumber, row.applyType, row.warehouseType]
    .map((value) => value || '')
    .join('|');
}

function tasksOf(rows: MaterialRequestTaskMaterialSummaryItem[]): MaterialRequestTaskItem[] {
  return rows.flatMap((row) => row.tasks || []);
}

function rowPendingQty(row: MaterialRequestTaskMaterialSummaryItem): number {
  if (row.totalDemandQty !== undefined) return asNumber(row.totalDemandQty);
  return (row.tasks || []).reduce((sum, task) => sum + asNumber('reservedQty' in task ? task.reservedQty ?? task.requestQty : task.requestQty), 0);
}

function isErpRejected(task: MaterialRequestTaskItem): boolean {
  return (
    task.taskStatus === 'FAILED' ||
    task.taskStatus === 'REJECTED' ||
    task.taskStatus === 'TERMINATED' ||
    task.erpBillStatus === 'REJECTED' ||
    task.erpBillStatus === 'TERMINATED'
  );
}

function hasErrorRecord(task: MaterialRequestTaskItem): boolean {
  return hasText(task.failReason) || hasText(task.closeReason) || task.rollbackStatus === 'FAILED';
}

function stageTone(total: number, blocked: number, done = 0): PickPoolTone {
  if (blocked > 0) return 'danger';
  if (total > 0 && done >= total) return 'success';
  if (total > 0) return 'warning';
  return 'info';
}

function count(tasks: MaterialRequestTaskItem[], predicate: (task: MaterialRequestTaskItem) => boolean): number {
  return tasks.filter(predicate).length;
}

export function getPickTaskActionState(task: MaterialRequestTaskItem): PickTaskActionState {
  const risky = isErpRejected(task) || hasErrorRecord(task);
  const waiting =
    ['APPROVING', 'ISSUING', 'SUBMITTED'].includes(task.taskStatus) ||
    ['APPROVING', 'SUBMITTED'].includes(String(task.erpBillStatus || ''));
  const stable = task.taskStatus === 'APPROVED' || task.taskStatus === 'CLOSED' || task.erpBillStatus === 'APPROVED';

  return {
    canClose: !['APPROVED', 'CLOSED', 'SUBMITTED'].includes(task.taskStatus),
    canIssue: ['PREPARING', 'PREPARED', 'ISSUING'].includes(task.taskStatus),
    canPrepare: ['APPLIED', 'PREPARING'].includes(task.taskStatus),
    canSyncStatus: Boolean(task.erpBillId || task.erpBillNo),
    canTransfer: ['APPLIED', 'PREPARING', 'ISSUING'].includes(task.taskStatus),
    risk: risky ? 'danger' : stable ? 'stable' : waiting ? 'warning' : 'normal',
  };
}

export function buildPickTaskPoolV2Model(rows: MaterialRequestTaskMaterialSummaryItem[] = []): PickTaskPoolV2Model {
  const tasks = tasksOf(rows);
  const missingStockCount = rows.filter((row) => !hasText(row.defaultStockNumber) && !hasText(row.defaultStockName)).length;
  const erpRejectedCount = count(tasks, isErpRejected);
  const errorRecordCount = count(tasks, hasErrorRecord);
  const readyToIssueCount = count(tasks, (task) => getPickTaskActionState(task).canIssue);
  const issueGroups = ([
    { count: missingStockCount, key: 'missingStock', label: '缺少默认仓库', tone: 'warning' },
    { count: erpRejectedCount, key: 'erpRejected', label: 'ERP驳回/终止', tone: 'danger' },
    { count: errorRecordCount, key: 'errorRecord', label: '失败记录', tone: 'danger' },
  ] as PickPoolIssueGroup[]).filter((group) => group.count > 0);

  const stages: PickPoolStage[] = [
    {
      blocked: 0,
      description: '任务已申请，等待仓库备料',
      done: 0,
      key: 'applied',
      label: '申请',
      tone: stageTone(count(tasks, (task) => task.taskStatus === 'APPLIED'), 0),
      total: count(tasks, (task) => task.taskStatus === 'APPLIED'),
    },
    {
      blocked: 0,
      description: '备料中或已完成备料',
      done: count(tasks, (task) => task.taskStatus === 'PREPARED'),
      key: 'prepare',
      label: '备料',
      tone: stageTone(count(tasks, (task) => ['PREPARING', 'PREPARED'].includes(task.taskStatus)), 0),
      total: count(tasks, (task) => ['PREPARING', 'PREPARED'].includes(task.taskStatus)),
    },
    {
      blocked: 0,
      description: '生成或提交生产领料单',
      done: count(tasks, (task) => task.taskStatus === 'SUBMITTED'),
      key: 'issue',
      label: '发料',
      tone: stageTone(count(tasks, (task) => ['ISSUING', 'SUBMITTED'].includes(task.taskStatus)), 0),
      total: count(tasks, (task) => ['ISSUING', 'SUBMITTED'].includes(task.taskStatus)),
    },
    {
      blocked: erpRejectedCount,
      description: 'ERP领料单状态同步与审核',
      done: count(tasks, (task) => task.erpBillStatus === 'APPROVED' || task.taskStatus === 'APPROVED'),
      key: 'erp',
      label: 'ERP',
      tone: stageTone(erpRejectedCount, erpRejectedCount),
      total: erpRejectedCount,
    },
    {
      blocked: 0,
      description: '已审核或关闭的备料任务',
      done: count(tasks, (task) => ['APPROVED', 'CLOSED'].includes(task.taskStatus) || task.erpBillStatus === 'APPROVED'),
      key: 'done',
      label: '完成',
      tone: 'success',
      total: count(tasks, (task) => ['APPROVED', 'CLOSED'].includes(task.taskStatus) || task.erpBillStatus === 'APPROVED'),
    },
  ];

  return {
    erpChains: tasks
      .filter((task) => hasText(task.erpBillNo) || Boolean(task.erpBillId))
      .map((task) => ({
        erpBillNo: task.erpBillNo,
        erpBillStatus: task.erpBillStatus || task.erpDocumentStatus,
        lastError: task.failReason,
        orderNo: task.orderNo,
        taskId: task.id,
      })),
    issueGroups,
    stages,
    summary: {
      blockedCount: missingStockCount + erpRejectedCount,
      materialCount: rows.length,
      pendingQty: rows.reduce((sum, row) => sum + rowPendingQty(row), 0),
      readyToIssueCount,
      taskCount: tasks.length,
    },
  };
}
