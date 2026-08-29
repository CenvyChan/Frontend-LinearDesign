import type { ProductionInstockTask } from '#/api/productionInstock';

export type ProductionInstockTone = 'danger' | 'info' | 'stable' | 'success' | 'warning';

export interface ProductionInstockStage {
  blocked: number;
  description: string;
  done: number;
  key: 'confirming' | 'done' | 'erp' | 'pendingConfirm' | 'waitAudit';
  label: string;
  tone: ProductionInstockTone;
  total: number;
}

export interface ProductionInstockIssueGroup {
  count: number;
  key: 'erpFailed' | 'errorRecord' | 'missingStock';
  label: string;
  tone: ProductionInstockTone;
}

export interface ProductionInstockErpChain {
  instockBillNo?: string;
  orderNo?: string;
  pqc1BillNo?: string;
  productReportBillNo?: string;
  taskId: number;
}

export interface ProductionInstockActionState {
  canConfirm: boolean;
  canRefresh: boolean;
  canRetry: boolean;
  risk: ProductionInstockTone;
}

export interface ProductionInstockV2Model {
  erpChains: ProductionInstockErpChain[];
  issueGroups: ProductionInstockIssueGroup[];
  stages: ProductionInstockStage[];
  summary: {
    blockedCount: number;
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

function count(tasks: ProductionInstockTask[], predicate: (task: ProductionInstockTask) => boolean): number {
  return tasks.filter(predicate).length;
}

function tone(total: number, blocked: number): ProductionInstockTone {
  if (blocked > 0) return 'danger';
  if (total > 0) return 'warning';
  return 'info';
}

function missingStock(task: ProductionInstockTask): boolean {
  return task.taskStatus === 'PENDING_CONFIRM' && !hasText(task.stockNumber);
}

function hasErrorRecord(task: ProductionInstockTask): boolean {
  return hasText(task.lastError);
}

export function getProductionInstockActionState(task: ProductionInstockTask): ProductionInstockActionState {
  const failed = task.taskStatus === 'ERP_FAILED';
  const pending = task.taskStatus === 'PENDING_CONFIRM';
  const stable = task.taskStatus === 'ERP_AUDITED' || task.taskStatus === 'CANCELLED';
  return {
    canConfirm: pending,
    canRefresh: task.taskStatus !== 'CANCELLED',
    canRetry: failed,
    risk: failed ? 'danger' : stable ? 'stable' : pending ? 'warning' : 'info',
  };
}

export function buildProductionInstockV2Model(tasks: ProductionInstockTask[] = []): ProductionInstockV2Model {
  const missingStockCount = count(tasks, missingStock);
  const erpFailedCount = count(tasks, (task) => task.taskStatus === 'ERP_FAILED');
  const errorRecordCount = count(tasks, hasErrorRecord);
  const issueGroups = ([
    { count: missingStockCount, key: 'missingStock', label: '缺少入库仓库', tone: 'warning' },
    { count: erpFailedCount, key: 'erpFailed', label: 'ERP入库失败', tone: 'danger' },
    { count: errorRecordCount, key: 'errorRecord', label: '失败记录', tone: 'danger' },
  ] as ProductionInstockIssueGroup[]).filter((group) => group.count > 0);

  return {
    erpChains: tasks
      .filter((task) => hasText(task.erpReportBillNo) || hasText(task.erpInspectionBillNo) || hasText(task.erpInstockBillNo))
      .map((task) => ({
        instockBillNo: task.erpInstockBillNo,
        orderNo: task.orderNo,
        pqc1BillNo: task.erpInspectionBillNo,
        productReportBillNo: task.erpReportBillNo,
        taskId: task.id,
      })),
    issueGroups,
    stages: [
      {
        blocked: 0,
        description: '等待生产汇报单/产品入库检验审核完成',
        done: 0,
        key: 'waitAudit',
        label: '待审核',
        tone: tone(count(tasks, (task) => task.taskStatus === 'WAIT_ERP_AUDIT'), 0),
        total: count(tasks, (task) => task.taskStatus === 'WAIT_ERP_AUDIT'),
      },
      {
        blocked: missingStockCount,
        description: '仓管确认入库仓库、批号和数量',
        done: 0,
        key: 'pendingConfirm',
        label: '待确认',
        tone: tone(count(tasks, (task) => task.taskStatus === 'PENDING_CONFIRM'), missingStockCount),
        total: count(tasks, (task) => task.taskStatus === 'PENDING_CONFIRM'),
      },
      {
        blocked: 0,
        description: '正在提交生产入库单',
        done: 0,
        key: 'confirming',
        label: '确认中',
        tone: tone(count(tasks, (task) => task.taskStatus === 'CONFIRMING'), 0),
        total: count(tasks, (task) => task.taskStatus === 'CONFIRMING'),
      },
      {
        blocked: erpFailedCount,
        description: 'ERP入库单保存、提交和审核',
        done: count(tasks, (task) => task.taskStatus === 'ERP_PUSHED'),
        key: 'erp',
        label: 'ERP',
        tone: tone(erpFailedCount, erpFailedCount),
        total: erpFailedCount,
      },
      {
        blocked: 0,
        description: 'ERP入库单已审核',
        done: count(tasks, (task) => task.taskStatus === 'ERP_AUDITED'),
        key: 'done',
        label: '完成',
        tone: 'success',
        total: count(tasks, (task) => task.taskStatus === 'ERP_AUDITED'),
      },
    ],
    summary: {
      blockedCount: missingStockCount + erpFailedCount,
      pendingQty: tasks.reduce((sum, task) => sum + asNumber(task.pendingQty), 0),
      taskCount: tasks.length,
    },
  };
}
