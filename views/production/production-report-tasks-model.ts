import type { ProductionReportTask } from '#/api/productionReportTask';

export type ProductionReportTaskTone = 'danger' | 'info' | 'success' | 'warning';

export interface ProductionReportTaskActionState {
  canCancel: boolean;
  canConfirm: boolean;
  canRetry: boolean;
  tone: ProductionReportTaskTone;
}

export interface ProductionReportTasksModel {
  errorCount: number;
  metrics: Array<{ label: string; tone?: ProductionReportTaskTone; value: number }>;
  pendingCount: number;
  rows: ProductionReportTask[];
}

export function formatProductionReportError(task: ProductionReportTask): string {
  const structured = [task.erpErrorCode && `MsgCode=${task.erpErrorCode}`, task.erpErrorField]
    .filter(Boolean)
    .join(' / ');
  return [structured, task.erpErrorMessage || task.lastError, task.rawErpResponse]
    .filter(Boolean)
    .join('\n') || '暂无 ERP 错误';
}

export function getProductionReportTaskActionState(
  task: ProductionReportTask,
): ProductionReportTaskActionState {
  const canConfirm = task.status === 'WAIT_CONFIRM';
  const canRetry = task.status === 'PUSH_FAILED';
  const canCancel = canConfirm || canRetry;
  const tone = task.status === 'PUSH_FAILED'
    ? 'danger'
    : task.status === 'ERP_AUDITED'
      ? 'success'
      : task.status === 'WAIT_CONFIRM'
        ? 'warning'
        : 'info';
  return { canCancel, canConfirm, canRetry, tone };
}

export function buildProductionReportTasksModel(
  rows: ProductionReportTask[] = [],
): ProductionReportTasksModel {
  const errorCount = rows.filter((row) => row.status === 'PUSH_FAILED' || row.lastError).length;
  const pendingCount = rows.filter((row) => row.status === 'WAIT_CONFIRM' || row.status === 'ERP_STATUS_PENDING').length;
  return {
    errorCount,
    metrics: [
      { label: '任务总数', value: rows.length },
      { label: '待确认', tone: 'warning', value: rows.filter((row) => row.status === 'WAIT_CONFIRM').length },
      { label: 'ERP处理中', tone: 'info', value: rows.filter((row) => row.status === 'ERP_STATUS_PENDING').length },
      { label: '已审核', tone: 'success', value: rows.filter((row) => row.status === 'ERP_AUDITED').length },
      { label: '失败', tone: 'danger', value: errorCount },
    ],
    pendingCount,
    rows,
  };
}
