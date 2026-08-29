<script lang="ts" setup>
import type { ProcessPriceType, ProcessStepPrice, ProcessWageSettlement } from '#/api/processWage';
import type { ProcessPool } from '#/api/processPool';
import type { ProcessRoute, ProcessStep } from '#/api/processRoute';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  exportExcel,
} from '#/api/excel';
import {
  auditWageSettlement,
  confirmWageSettlement,
  createProcessStepPrice,
  disableProcessStepPrice,
  getOrderWageExportUrl,
  getPendingWageSettlements,
  getProcessStepPrices,
  pushWageSettlementErp,
  recalculateProcessWage,
  updateProcessStepPrice,
} from '#/api/processWage';
import { getProcessPoolOptions } from '#/api/processPool';
import { getProcessRouteById, getProcessRouteList } from '#/api/processRoute';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'ProcessWage' });

const PRICE_TYPE_LABELS: Record<ProcessPriceType, string> = {
  HOUR: '计时',
  MIXED: '混合',
  PIECE: '计件',
};

const loading = ref(false);
const processPoolLoading = ref(false);
const routeLoading = ref(false);
const routeStepLoading = ref(false);
const workflowLoading = ref(false);
const saving = ref(false);
const workflowActionLoading = ref(false);
const dialogVisible = ref(false);
const batchConfirmVisible = ref(false);
const batchConfirmTitle = ref('');
const batchConfirmActionName = ref('');
const batchConfirmRows = ref<ProcessWageSettlement[]>([]);
const priceList = ref<ProcessStepPrice[]>([]);
const processPoolOptions = ref<ProcessPool[]>([]);
const routeOptions = ref<ProcessRoute[]>([]);
const routeStepOptions = ref<ProcessStep[]>([]);
const workflowList = ref<ProcessWageSettlement[]>([]);
const selectedWorkflowRows = ref<ProcessWageSettlement[]>([]);
const activeTab = ref('workflow');
const keyword = ref('');
const priceTypeFilter = ref('');
const workflowStatusFilter = ref('');
const workflowErpScopeFilter = ref('');
const workflowOrderNoFilter = ref('');
const workflowStepNameFilter = ref('');
const workflowOperatorFilter = ref('');
let batchConfirmExecutor: null | (() => Promise<void>) = null;

const WAGE_STATUS_OPTIONS = [
  { label: '待统计确认', value: 'SUBMITTED' },
  { label: '待主任审核', value: 'CONFIRMED' },
  { label: '待推ERP', value: 'AUDITED' },
  { label: 'ERP失败', value: 'ERP_FAILED' },
  { label: '核算失败', value: 'FAILED' },
  { label: '统计驳回', value: 'CONFIRM_REJECTED' },
  { label: '主任驳回', value: 'AUDIT_REJECTED' },
];

const form = reactive<Partial<ProcessStepPrice>>({
  defectDeductionPrice: 0,
  hourPrice: 0,
  piecePrice: 0,
  priceType: 'PIECE',
  setupPrice: 0,
  status: 'ACTIVE',
});

const filteredList = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return priceList.value.filter((item) => {
    const matchKeyword = !key || [item.processCode, item.processName, item.workCenterName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(key));
    const matchType = !priceTypeFilter.value || item.priceType === priceTypeFilter.value;
    return matchKeyword && matchType;
  });
});

const summary = computed(() => {
  const activeCount = priceList.value.filter((item) => item.status === 'ACTIVE').length;
  const routeCount = new Set(priceList.value.filter((item) => item.routeId).map((item) => item.routeId)).size;
  return { activeCount, routeCount, total: priceList.value.length };
});

const workflowSummary = computed(() => {
  const submitted = workflowList.value.filter((item) => item.calcStatus === 'SUBMITTED').length;
  const confirmed = workflowList.value.filter((item) => item.calcStatus === 'CONFIRMED').length;
  const audited = workflowList.value.filter((item) => item.calcStatus === 'AUDITED' || item.calcStatus === 'ERP_FAILED').length;
  return { audited, confirmed, submitted, total: workflowList.value.length };
});

const filteredWorkflowList = computed(() => {
  const orderNo = workflowOrderNoFilter.value.trim().toLowerCase();
  const stepName = workflowStepNameFilter.value.trim().toLowerCase();
  const operator = workflowOperatorFilter.value.trim().toLowerCase();
  return workflowList.value.filter((item) => {
    const matchStatus = !workflowStatusFilter.value || item.calcStatus === workflowStatusFilter.value;
    const matchErpScope = !workflowErpScopeFilter.value
      || (workflowErpScopeFilter.value === 'LAST' ? item.lastProductionStep : !item.lastProductionStep);
    const matchOrderNo = !orderNo || String(item.orderNo || '').toLowerCase().includes(orderNo);
    const matchStepName = !stepName || [item.stepName, item.processCode]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(stepName));
    const matchOperator = !operator || String(item.operatorName || '').toLowerCase().includes(operator);
    return matchStatus && matchErpScope && matchOrderNo && matchStepName && matchOperator;
  });
});

const batchConfirmFailedRows = computed(() => batchConfirmRows.value.filter((row) => row.calcStatus === 'FAILED'));

const selectedWorkflowCount = computed(() => {
  const visibleIds = new Set(filteredWorkflowList.value.map((row) => row.id));
  return selectedWorkflowRows.value.filter((row) => visibleIds.has(row.id)).length;
});

function resetForm(row?: ProcessStepPrice) {
  Object.assign(form, {
    defectDeductionPrice: row?.defectDeductionPrice ?? 0,
    effectiveFrom: row?.effectiveFrom,
    effectiveTo: row?.effectiveTo,
    hourPrice: row?.hourPrice ?? 0,
    id: row?.id,
    piecePrice: row?.piecePrice ?? 0,
    priceType: row?.priceType ?? 'PIECE',
    processPoolId: row?.processPoolId,
    processPoolCode: row?.processPoolCode,
    processPoolName: row?.processPoolName,
    processCode: row?.processCode ?? '',
    processName: row?.processName ?? '',
    processStepId: row?.processStepId,
    remark: row?.remark ?? '',
    routeId: row?.routeId,
    setupPrice: row?.setupPrice ?? 0,
    status: row?.status ?? 'ACTIVE',
    workCenterId: row?.workCenterId,
    workCenterName: row?.workCenterName ?? '',
  });
}

function formatMoney(value?: number, digits = 4) {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return num.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 2,
  });
}

function formatTime(value?: number) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getStatusText(status?: string) {
  return resolveStatus('processWage', 'calcStatus', status);
}

function getStatusType(status?: string) {
  const map: Record<string, string> = {
    AUDITED: 'warning',
    AUDIT_REJECTED: 'danger',
    CONFIRMED: 'primary',
    CONFIRM_REJECTED: 'danger',
    ERP_FAILED: 'danger',
    ERP_PUSHED: 'success',
    FAILED: 'danger',
    SUBMITTED: 'info',
  };
  return map[status || ''] || 'info';
}

function getErpError(row: ProcessWageSettlement) {
  return row.rawErpError || row.failureReason || row.rejectReason || '';
}

function canConfirm(row: ProcessWageSettlement) {
  return row.calcStatus === 'SUBMITTED' || row.calcStatus === 'FAILED';
}

function canAudit(row: ProcessWageSettlement) {
  return row.calcStatus === 'CONFIRMED' || row.calcStatus === 'FAILED';
}

function canRecalculate(row: ProcessWageSettlement) {
  return ['FAILED', 'CONFIRM_REJECTED', 'AUDIT_REJECTED'].includes(row.calcStatus);
}

function getPriceTypeLabel(type?: ProcessPriceType) {
  return type ? PRICE_TYPE_LABELS[type] || type : '--';
}

function getRowTitle(row: ProcessWageSettlement) {
  return `${row.orderNo || '-'} / 序号${row.stepNo ?? '-'} / ${row.stepName || row.processCode || '-'}`;
}

function summarizeRows(rows: ProcessWageSettlement[]) {
  return rows.slice(0, 5).map(getRowTitle).join('；') + (rows.length > 5 ? ` 等${rows.length}条` : '');
}

function handleWorkflowSelectionChange(rows: ProcessWageSettlement[]) {
  selectedWorkflowRows.value = rows;
}

function getSelectedWorkflowRows() {
  const visibleIds = new Set(filteredWorkflowList.value.map((row) => row.id));
  const rows = selectedWorkflowRows.value.filter((row) => visibleIds.has(row.id));
  if (rows.length !== selectedWorkflowRows.value.length) {
    selectedWorkflowRows.value = rows;
  }
  if (rows.length === 0) {
    ElMessage.warning('请先勾选需要操作的报工');
    return [];
  }
  return rows;
}

function assertBatchRows(rows: ProcessWageSettlement[], predicate: (row: ProcessWageSettlement) => boolean, message: string) {
  const invalidRows = rows.filter((row) => !predicate(row));
  if (invalidRows.length > 0) {
    ElMessageBox.alert(`${message}：${summarizeRows(invalidRows)}`, '批量操作已阻断', { type: 'warning' });
    return false;
  }
  return true;
}

async function runBatchWorkflowAction(
  rows: ProcessWageSettlement[],
  actionName: string,
  action: (row: ProcessWageSettlement) => Promise<any>,
) {
  workflowActionLoading.value = true;
  try {
    for (const row of rows) {
      const res = await action(row);
      if (!res?.success) {
        throw new Error(`${getRowTitle(row)}：${res?.message || `${actionName}失败`}`);
      }
    }
    ElMessage.success(`${actionName}完成，共处理 ${rows.length} 条`);
    await loadWorkflow();
  } catch (error: any) {
    ElMessage.error(error.message || `${actionName}失败`);
  } finally {
    workflowActionLoading.value = false;
  }
}

function resetWorkflowFilters() {
  workflowStatusFilter.value = '';
  workflowErpScopeFilter.value = '';
  workflowOrderNoFilter.value = '';
  workflowStepNameFilter.value = '';
  workflowOperatorFilter.value = '';
}

function openBatchConfirm(actionName: string, rows: ProcessWageSettlement[], executor: () => Promise<void>) {
  batchConfirmActionName.value = actionName;
  batchConfirmTitle.value = `确认${actionName} ${rows.length} 条报工`;
  batchConfirmRows.value = [...rows];
  batchConfirmExecutor = executor;
  batchConfirmVisible.value = true;
}

async function submitBatchConfirm() {
  if (!batchConfirmExecutor) return;
  const executor = batchConfirmExecutor;
  batchConfirmVisible.value = false;
  batchConfirmExecutor = null;
  await executor();
}

function showCreateDialog() {
  resetForm();
  routeStepOptions.value = [];
  dialogVisible.value = true;
}

function showEditDialog(row: ProcessStepPrice) {
  resetForm(row);
  dialogVisible.value = true;
  if (row.routeId) {
    loadRouteSteps(row.routeId);
  } else {
    routeStepOptions.value = [];
  }
}

async function loadProcessPools() {
  processPoolLoading.value = true;
  try {
    const res = await getProcessPoolOptions();
    if (res.success) {
      processPoolOptions.value = res.data || [];
    }
  } catch (error) {
    console.error(error);
  } finally {
    processPoolLoading.value = false;
  }
}

function handleProcessPoolChange(processPoolId?: number) {
  const pool = processPoolOptions.value.find((item) => item.id === processPoolId);
  form.processPoolId = processPoolId;
  form.processPoolCode = pool?.processCode;
  form.processPoolName = pool?.processName;
  if (!pool) return;
  form.processCode = pool.processCode;
  form.processName = pool.processName;
  if (!form.workCenterId) {
    form.workCenterId = pool.workCenterId;
  }
  if (!form.workCenterName) {
    form.workCenterName = pool.workCenterName;
  }
}

async function loadRoutes(keyword?: string) {
  routeLoading.value = true;
  try {
    const res = await getProcessRouteList({
      keyword,
      page: 1,
      pageSize: 50,
      status: 'ACTIVE',
    });
    if (res.success) {
      routeOptions.value = res.data || [];
    }
  } catch (error) {
    console.error(error);
  } finally {
    routeLoading.value = false;
  }
}

async function loadRouteSteps(routeId?: number) {
  if (!routeId) {
    routeStepOptions.value = [];
    return;
  }
  routeStepLoading.value = true;
  try {
    const res = await getProcessRouteById(routeId);
    if (res.success && res.data) {
      if (!routeOptions.value.some((item) => item.id === res.data.id)) {
        routeOptions.value = [res.data, ...routeOptions.value];
      }
      routeStepOptions.value = res.data.steps || [];
    } else {
      routeStepOptions.value = [];
      ElMessage.error(res.message || '获取路线工序失败');
    }
  } catch (error) {
    console.error(error);
    routeStepOptions.value = [];
    ElMessage.error('获取路线工序失败');
  } finally {
    routeStepLoading.value = false;
  }
}

async function handleRouteChange(routeId?: number) {
  form.routeId = routeId;
  form.processStepId = undefined;
  routeStepOptions.value = [];
  if (routeId) {
    await loadRouteSteps(routeId);
  }
}

function handleRouteStepChange(processStepId?: number) {
  const step = routeStepOptions.value.find((item) => item.id === processStepId);
  form.processStepId = processStepId;
  if (!step) return;
  form.processPoolId = step.processPoolId;
  form.processPoolCode = step.processPoolCode;
  form.processPoolName = step.processPoolName;
  form.processCode = step.processCode;
  form.processName = step.processName || step.stepName;
  const primaryWorkCenter = step.workCenters?.find((item) => item.isPrimary) || step.workCenters?.[0];
  if (primaryWorkCenter) {
    form.workCenterId = primaryWorkCenter.workCenterId;
    form.workCenterName = primaryWorkCenter.workCenterName;
  }
}

async function loadPrices() {
  loading.value = true;
  try {
    const res = await getProcessStepPrices();
    if (res.success) {
      priceList.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取工序单价失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('获取工序单价失败');
  } finally {
    loading.value = false;
  }
}

async function loadWorkflow() {
  workflowLoading.value = true;
  try {
    const res = await getPendingWageSettlements();
    if (res.success) {
      workflowList.value = res.data || [];
      selectedWorkflowRows.value = [];
    } else {
      ElMessage.error(res.message || '获取报工审核数据失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('获取报工审核数据失败');
  } finally {
    workflowLoading.value = false;
  }
}

async function handleBatchConfirm() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0 || !assertBatchRows(rows, canConfirm, '只有待统计确认或核算失败的报工可以确认')) return;
  openBatchConfirm('确认', rows, () => runBatchWorkflowAction(rows, '确认', (row) => confirmWageSettlement(row.id)));
}

async function handleBatchAudit() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0 || !assertBatchRows(rows, canAudit, '只有待主任审核或核算失败的报工可以审核')) return;
  openBatchConfirm('审核', rows, () => runBatchWorkflowAction(rows, '审核', (row) => auditWageSettlement(row.id)));
}

async function handleBatchPushErp() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0 || !assertBatchRows(rows, (row) => Boolean(row.canPushErp), '只有主任已审核或ERP失败且属于末道生产工序的报工可以推ERP')) return;
  openBatchConfirm('推ERP', rows, () => runBatchWorkflowAction(rows, '推ERP', (row) => pushWageSettlementErp(row.id)));
}

function handleBatchReject() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0) return;
  ElMessageBox.alert(
    '批量驳回会要求逐条填写驳回原因，并且会回滚对应工序流转卡，存在误回滚风险。请进入单条报工明细后单独驳回。',
    '批量驳回已阻断',
    { type: 'warning' },
  );
}

async function handleBatchRecalculate() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0 || !assertBatchRows(rows, canRecalculate, '只有核算失败、统计驳回或主任驳回的报工可以重算')) return;
  openBatchConfirm('重算', rows, () => runBatchWorkflowAction(rows, '重算', (row) => recalculateProcessWage(row.flowId)));
}

async function handleBatchExport() {
  const rows = getSelectedWorkflowRows();
  if (rows.length === 0 || !assertBatchRows(rows, (row) => Boolean(row.orderId), '缺少工单ID的报工不能导出')) return;
  const orderIds = [...new Set(rows.map((row) => row.orderId).filter((orderId): orderId is number => Boolean(orderId)))];
  openBatchConfirm('导出', rows, async () => {
    orderIds.forEach((orderId) => window.open(getOrderWageExportUrl(orderId), '_blank'));
  });
}

async function handleExportPrices() {
  try {
    const blob = await exportExcel('/process-wage/prices');
    downloadBlob(blob, '工序单价导出.xlsx');
  } catch (error) {
    console.error(error);
    ElMessage.error('导出失败');
  }
}

async function handleSave() {
  if (!form.processPoolId && !form.processCode && !form.processStepId) {
    ElMessage.warning('请至少选择工序池，或填写工序代码/工序步骤ID');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form };
    const res = form.id
      ? await updateProcessStepPrice(form.id, payload)
      : await createProcessStepPrice(payload);
    if (res.success) {
      ElMessage.success(res.message || '保存成功');
      dialogVisible.value = false;
      await loadPrices();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDisable(row: ProcessStepPrice) {
  if (!row.id) return;
  try {
    await ElMessageBox.confirm(`确定停用工序[${row.processName || row.processCode}]的单价配置?`, '确认停用');
  } catch {
    return;
  }
  const res = await disableProcessStepPrice(row.id);
  if (res.success) {
    ElMessage.success(res.message || '已停用');
    await loadPrices();
  } else {
    ElMessage.error(res.message || '停用失败');
  }
}

onMounted(() => {
  loadProcessPools();
  loadRoutes();
  loadWorkflow();
  loadPrices();
});
</script>

<template>
  <div class="process-wage-page">
    <el-tabs v-model="activeTab" class="wage-tabs">
      <el-tab-pane label="报工审核" name="workflow">
        <div class="summary-row">
          <div class="summary-item">
            <span>待处理报工</span>
            <strong>{{ workflowSummary.total }}</strong>
          </div>
          <div class="summary-item">
            <span>待统计确认</span>
            <strong>{{ workflowSummary.submitted }}</strong>
          </div>
          <div class="summary-item">
            <span>待主任审核</span>
            <strong>{{ workflowSummary.confirmed }}</strong>
          </div>
          <div class="summary-item">
            <span>待推ERP</span>
            <strong>{{ workflowSummary.audited }}</strong>
          </div>
        </div>

        <div class="toolbar-panel">
          <div class="toolbar-left workflow-filters">
            <el-select v-model="workflowStatusFilter" clearable placeholder="状态" style="width: 140px">
              <el-option v-for="option in WAGE_STATUS_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
            <el-select v-model="workflowErpScopeFilter" clearable placeholder="ERP范围" style="width: 120px">
              <el-option label="末道" value="LAST" />
              <el-option label="内部" value="INTERNAL" />
            </el-select>
            <el-input v-model="workflowOrderNoFilter" clearable placeholder="工单号" style="width: 160px" />
            <el-input v-model="workflowStepNameFilter" clearable placeholder="工序名称/代码" style="width: 170px" />
            <el-input v-model="workflowOperatorFilter" clearable placeholder="操作工" style="width: 130px" />
            <el-button @click="resetWorkflowFilters" :icon="'RefreshRight'">重置</el-button>
          </div>
          <div class="toolbar-right workflow-batch-actions">
            <el-tag v-if="selectedWorkflowCount" size="small" type="primary">
              已选 {{ selectedWorkflowCount }} 条
            </el-tag>
            <el-button type="primary" :loading="workflowActionLoading" @click="handleBatchConfirm" :icon="'Check'">确认</el-button>
            <el-button type="success" :loading="workflowActionLoading" @click="handleBatchAudit" :icon="'Check'">审核</el-button>
            <el-button type="warning" :loading="workflowActionLoading" @click="handleBatchPushErp">推ERP</el-button>
            <el-button type="danger" :loading="workflowActionLoading" @click="handleBatchReject" :icon="'Delete'">驳回</el-button>
            <el-button :loading="workflowActionLoading" @click="handleBatchRecalculate">重算</el-button>
            <el-button @click="handleBatchExport" :icon="'Download'">导出</el-button>
            <el-button @click="loadWorkflow" :icon="'Refresh'">刷新</el-button>
          </div>
        </div>

        <div class="table-panel">
          <el-table
            :data="filteredWorkflowList"
            v-loading="workflowLoading"
            border
            row-key="id"
            size="small"
            stripe
            @selection-change="handleWorkflowSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column prop="orderNo" label="工单号" width="150" />
            <el-table-column prop="stepNo" label="序号" width="70" />
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tooltip v-if="getErpError(row)" :content="getErpError(row)" placement="top">
                  <el-tag :type="getStatusType(row.calcStatus)" size="small">{{ getStatusText(row.calcStatus) }}</el-tag>
                </el-tooltip>
                <el-tag v-else :type="getStatusType(row.calcStatus)" size="small">{{ getStatusText(row.calcStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="失败信息" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <span :class="row.calcStatus === 'ERP_FAILED' ? 'error-text' : ''">{{ getErpError(row) || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="确认/审核" width="180">
              <template #default="{ row }">
                <div class="audit-info">
                  <span><b>确认</b>{{ row.confirmedByName || '-' }}</span>
                  <span><b>审核</b>{{ row.auditedByName || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="stepName" label="工序名称" min-width="150" show-overflow-tooltip />
            <el-table-column label="ERP范围" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.lastProductionStep ? 'success' : 'info'">
                  {{ row.lastProductionStep ? '末道' : '内部' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operatorName" label="操作工" width="100" />
            <el-table-column prop="actualQuantity" label="完成数" width="80" align="right" />
            <el-table-column prop="defectQuantity" label="不良数" width="80" align="right" />
            <el-table-column prop="goodQuantity" label="良品数" width="80" align="right" />
            <el-table-column label="工资金额" width="110" align="right">
              <template #default="{ row }"><strong>{{ formatMoney(row.wageAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="ERP单据" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="erp-info">
                  <span>{{ row.erpReportBillNo || '-' }}</span>
                  <small v-if="row.erpReportBillId">ID: {{ row.erpReportBillId }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="ERP推送时间" width="170">
              <template #default="{ row }">{{ formatTime(row.erpPushTime) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="单价配置" name="price">
    <div class="summary-row">
      <div class="summary-item">
        <span>启用单价</span>
        <strong>{{ summary.activeCount }}</strong>
      </div>
      <div class="summary-item">
        <span>覆盖路线</span>
        <strong>{{ summary.routeCount }}</strong>
      </div>
      <div class="summary-item">
        <span>配置总数</span>
        <strong>{{ summary.total }}</strong>
      </div>
    </div>

    <div class="toolbar-panel">
      <div class="toolbar-left">
        <el-input v-model="keyword" clearable placeholder="搜索工序代码、名称、工作中心" style="width: 320px" />
        <el-select v-model="priceTypeFilter" clearable placeholder="计价方式" style="width: 150px">
          <el-option label="计件" value="PIECE" />
          <el-option label="计时" value="HOUR" />
          <el-option label="混合" value="MIXED" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button @click="handleExportPrices" :icon="'Download'">导出</el-button>
        <el-button @click="loadPrices" :icon="'Refresh'">刷新</el-button>
        <el-button type="primary" @click="showCreateDialog" :icon="'Plus'">新增单价</el-button>
      </div>
    </div>

    <div class="table-panel">
      <el-table :data="filteredList" v-loading="loading" border stripe size="small">
        <el-table-column label="工序池" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.processPoolName || row.processPoolCode || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="processCode" label="工序代码" width="130" />
        <el-table-column prop="processName" label="工序名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="routeId" label="路线ID" width="90" />
        <el-table-column prop="processStepId" label="工序ID" width="90" />
        <el-table-column prop="workCenterName" label="工作中心" min-width="140" show-overflow-tooltip />
        <el-table-column label="计价方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.priceType === 'MIXED' ? 'warning' : row.priceType === 'HOUR' ? 'success' : 'primary'">
              {{ getPriceTypeLabel(row.priceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="计件单价" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.piecePrice) }}</template>
        </el-table-column>
        <el-table-column label="小时单价" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.hourPrice) }}</template>
        </el-table-column>
        <el-table-column label="准备补贴" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.setupPrice) }}</template>
        </el-table-column>
        <el-table-column label="不良扣款" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.defectDeductionPrice) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
              {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <div class="wage-action-cell price-action-cell">
              <el-button size="small" text type="primary" @click="showEditDialog(row)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" text type="danger" :disabled="row.status !== 'ACTIVE'" @click="handleDisable(row)" :icon="'Delete'">
                停用
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑工序单价' : '新增工序单价'" width="680px" destroy-on-close>
      <el-form :model="form" label-width="110px" size="small">
        <div class="form-grid">
          <el-form-item label="工序池">
            <el-select
              v-model="form.processPoolId"
              clearable
              filterable
              :loading="processPoolLoading"
              placeholder="选择工序池"
              style="width: 100%"
              @change="handleProcessPoolChange"
            >
              <el-option
                v-for="item in processPoolOptions"
                :key="item.id"
                :label="`${item.processCode} ${item.processName}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="工艺路线">
            <el-select
              v-model="form.routeId"
              clearable
              filterable
              remote
              :loading="routeLoading"
              :remote-method="loadRoutes"
              placeholder="选择工艺路线"
              style="width: 100%"
              @change="handleRouteChange"
            >
              <el-option
                v-for="item in routeOptions"
                :key="item.id"
                :label="`${item.routeCode || item.id} ${item.routeName || ''} ${item.materialCode || ''}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="路线工序">
            <el-select
              v-model="form.processStepId"
              clearable
              filterable
              :disabled="!form.routeId"
              :loading="routeStepLoading"
              placeholder="选择路线工序"
              style="width: 100%"
              @change="handleRouteStepChange"
            >
              <el-option
                v-for="item in routeStepOptions"
                :key="item.id"
                :label="`${item.stepNo}. ${item.stepName || item.processName || item.processCode}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="路线ID">
            <el-input-number v-model="form.routeId" :min="1" controls-position="right" style="width: 100%" @change="handleRouteChange" />
          </el-form-item>
          <el-form-item label="工序步骤ID">
            <el-input-number v-model="form.processStepId" :min="1" controls-position="right" style="width: 100%" @change="handleRouteStepChange" />
          </el-form-item>
          <el-form-item label="工序代码">
            <el-input v-model="form.processCode" />
          </el-form-item>
          <el-form-item label="工序名称">
            <el-input v-model="form.processName" />
          </el-form-item>
          <el-form-item label="工作中心ID">
            <el-input-number v-model="form.workCenterId" :min="1" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="工作中心">
            <el-input v-model="form.workCenterName" />
          </el-form-item>
          <el-form-item label="计价方式">
            <el-select v-model="form.priceType" style="width: 100%">
              <el-option label="计件" value="PIECE" />
              <el-option label="计时" value="HOUR" />
              <el-option label="混合" value="MIXED" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="计件单价">
            <el-input-number v-model="form.piecePrice" :min="0" :precision="4" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="小时单价">
            <el-input-number v-model="form.hourPrice" :min="0" :precision="4" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="准备补贴">
            <el-input-number v-model="form.setupPrice" :min="0" :precision="4" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="不良扣款">
            <el-input-number v-model="form.defectDeductionPrice" :min="0" :precision="4" controls-position="right" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="batchConfirmVisible" :title="batchConfirmTitle" width="860px" destroy-on-close>
      <el-alert
        v-if="batchConfirmFailedRows.length"
        :title="`包含 ${batchConfirmFailedRows.length} 条核算失败报工，请确认失败信息后再继续。`"
        show-icon
        type="warning"
        :closable="false"
      />
      <el-table :data="batchConfirmRows" border max-height="360" size="small" stripe class="batch-confirm-table">
        <el-table-column prop="orderNo" label="工单号" width="140" />
        <el-table-column prop="stepNo" label="序号" width="70" />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.calcStatus)" size="small">{{ getStatusText(row.calcStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stepName" label="工序名称" min-width="130" show-overflow-tooltip />
        <el-table-column label="ERP范围" width="90" align="center">
          <template #default="{ row }">{{ row.lastProductionStep ? '末道' : '内部' }}</template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作工" width="100" />
        <el-table-column label="完成数" width="80" align="right">
          <template #default="{ row }">{{ row.actualQuantity ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="失败信息" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ getErpError(row) || '-' }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="batchConfirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="workflowActionLoading" @click="submitBatchConfirm" :icon="'Check'">
          确认{{ batchConfirmActionName }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.process-wage-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.wage-tabs {
  min-height: 100%;
}

.toolbar-summary,
.audit-info,
.erp-info {
  color: #606266;
  font-size: 13px;
}

.erp-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audit-info {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.audit-info span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.audit-info b {
  color: #909399;
  font-weight: 500;
}

.erp-info small {
  color: #909399;
}

.error-text {
  color: #f56c6c;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.summary-item span {
  color: #606266;
  font-size: 13px;
}

.summary-item strong {
  color: #1f2937;
  font-size: 22px;
}

.toolbar-panel,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workflow-filters {
  flex: 1 1 auto;
  flex-wrap: wrap;
  min-width: 0;
}

.workflow-batch-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workflow-batch-actions :deep(.el-button),
.workflow-batch-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.table-panel {
  padding: 12px;
}

.batch-confirm-table {
  margin-top: 10px;
}

.wage-action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.wage-action-cell :deep(.el-button) {
  margin-left: 0;
  padding-right: 4px;
  padding-left: 4px;
}

.wage-action-cell :deep(.el-button + .el-button) {
  margin-left: 0;
}

.price-action-cell {
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}

@media (max-width: 900px) {
  .summary-row,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    flex-wrap: wrap;
  }
}
</style>
