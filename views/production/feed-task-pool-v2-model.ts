import type { FeedTaskItem, FeedTaskMaterialSummaryItem } from '#/api/production';

export type FeedPoolTone = 'danger' | 'info' | 'normal' | 'stable' | 'success' | 'warning';

export interface FeedPoolStage {
  blocked: number;
  description: string;
  done: number;
  key: 'applied' | 'done' | 'erp' | 'prepare' | 'preview';
  label: string;
  tone: FeedPoolTone;
  total: number;
}

export interface FeedPoolIssueGroup {
  count: number;
  key: 'erpRejected' | 'errorRecord' | 'missingStock';
  label: string;
  tone: FeedPoolTone;
}

export interface FeedPoolErpChain {
  erpBillNo?: string;
  erpBillStatus?: string;
  lastError?: string;
  orderNo: string;
  taskId: number;
}

export interface FeedTaskActionState {
  canDirectSave: boolean;
  canPrepare: boolean;
  canPreview: boolean;
  canRollback: boolean;
  canSubmit: boolean;
  canSyncStatus: boolean;
  canTransfer: boolean;
  risk: FeedPoolTone;
}

export interface FeedTaskPoolV2Model {
  erpChains: FeedPoolErpChain[];
  issueGroups: FeedPoolIssueGroup[];
  stages: FeedPoolStage[];
  summary: {
    blockedCount: number;
    materialCount: number;
    pendingQty: number;
    readyToPreviewCount: number;
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

function tasksOf(rows: FeedTaskMaterialSummaryItem[]): FeedTaskItem[] {
  return rows.flatMap((row) => row.tasks || []);
}

function rowPendingQty(row: FeedTaskMaterialSummaryItem): number {
  if (row.totalRequestQty !== undefined) return asNumber(row.totalRequestQty);
  return (row.tasks || []).reduce((sum, task) => sum + asNumber(task.requestQty), 0);
}

function isErpRejected(task: FeedTaskItem): boolean {
  return (
    task.taskStatus === 'FAILED' ||
    task.taskStatus === 'REJECTED' ||
    task.taskStatus === 'TERMINATED' ||
    task.erpBillStatus === 'REJECTED' ||
    task.erpBillStatus === 'TERMINATED'
  );
}

function hasErrorRecord(task: FeedTaskItem): boolean {
  return hasText(task.failReason) || hasText(task.closeReason) || task.rollbackStatus === 'FAILED';
}

function count(tasks: FeedTaskItem[], predicate: (task: FeedTaskItem) => boolean): number {
  return tasks.filter(predicate).length;
}

function tone(total: number, blocked: number): FeedPoolTone {
  if (blocked > 0) return 'danger';
  if (total > 0) return 'warning';
  return 'info';
}

export function getFeedTaskActionState(task: FeedTaskItem): FeedTaskActionState {
  const risky = isErpRejected(task) || hasErrorRecord(task);
  const waiting =
    ['SUBMITTED', 'APPROVING'].includes(task.taskStatus) ||
    ['SUBMITTED', 'APPROVING'].includes(String(task.erpBillStatus || ''));
  const stable = task.taskStatus === 'APPROVED' || task.taskStatus === 'CLOSED' || task.erpBillStatus === 'APPROVED';

  return {
    canDirectSave: ['PREPARING', 'PREPARED', 'FAILED'].includes(task.taskStatus),
    canPrepare: ['APPLIED', 'PREPARING'].includes(task.taskStatus),
    canPreview: ['PREPARING', 'PREPARED', 'FAILED'].includes(task.taskStatus),
    canRollback: Boolean(task.erpBillId || task.erpBillNo),
    canSubmit: Boolean(task.erpBillId || task.erpBillNo),
    canSyncStatus: Boolean(task.erpBillId || task.erpBillNo),
    canTransfer: ['APPLIED', 'PREPARING', 'PREVIEWED'].includes(task.taskStatus),
    risk: risky ? 'danger' : stable ? 'stable' : waiting || Boolean(task.erpBillId || task.erpBillNo) ? 'warning' : 'normal',
  };
}

export function buildFeedTaskPoolV2Model(rows: FeedTaskMaterialSummaryItem[] = []): FeedTaskPoolV2Model {
  const tasks = tasksOf(rows);
  const missingStockCount = rows.filter((row) => !hasText(row.defaultStockNumber) && !hasText(row.defaultStockName)).length;
  const erpRejectedCount = count(tasks, isErpRejected);
  const errorRecordCount = count(tasks, hasErrorRecord);
  const readyToPreviewCount = count(tasks, (task) => getFeedTaskActionState(task).canPreview);
  const issueGroups = ([
    { count: missingStockCount, key: 'missingStock', label: '缺少默认仓库', tone: 'warning' },
    { count: erpRejectedCount, key: 'erpRejected', label: 'ERP驳回/终止', tone: 'danger' },
    { count: errorRecordCount, key: 'errorRecord', label: '失败记录', tone: 'danger' },
  ] as FeedPoolIssueGroup[]).filter((group) => group.count > 0);

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
    stages: [
      {
        blocked: 0,
        description: '补料申请进入任务池',
        done: 0,
        key: 'applied',
        label: '申请',
        tone: tone(count(tasks, (task) => task.taskStatus === 'APPLIED'), 0),
        total: count(tasks, (task) => task.taskStatus === 'APPLIED'),
      },
      {
        blocked: 0,
        description: '仓库备料与批号分配',
        done: count(tasks, (task) => task.taskStatus === 'PREPARED'),
        key: 'prepare',
        label: '备料',
        tone: tone(count(tasks, (task) => ['PREPARING', 'PREPARED'].includes(task.taskStatus)), 0),
        total: count(tasks, (task) => ['PREPARING', 'PREPARED'].includes(task.taskStatus)),
      },
      {
        blocked: 0,
        description: 'ERP补料单预览或保存草稿',
        done: count(tasks, (task) => task.taskStatus === 'PREVIEWED'),
        key: 'preview',
        label: '预览',
        tone: tone(count(tasks, (task) => task.taskStatus === 'PREVIEWED'), 0),
        total: count(tasks, (task) => task.taskStatus === 'PREVIEWED'),
      },
      {
        blocked: erpRejectedCount,
        description: 'ERP补料单提交、审核与回滚',
        done: count(tasks, (task) => task.erpBillStatus === 'APPROVED'),
        key: 'erp',
        label: 'ERP',
        tone: tone(erpRejectedCount, erpRejectedCount),
        total: erpRejectedCount,
      },
      {
        blocked: 0,
        description: '补料任务完成或关闭',
        done: count(tasks, (task) => ['APPROVED', 'CLOSED'].includes(task.taskStatus) || task.erpBillStatus === 'APPROVED'),
        key: 'done',
        label: '完成',
        tone: 'success',
        total: count(tasks, (task) => ['APPROVED', 'CLOSED'].includes(task.taskStatus) || task.erpBillStatus === 'APPROVED'),
      },
    ],
    summary: {
      blockedCount: missingStockCount + erpRejectedCount,
      materialCount: rows.length,
      pendingQty: rows.reduce((sum, row) => sum + rowPendingQty(row), 0),
      readyToPreviewCount,
      taskCount: tasks.length,
    },
  };
}
