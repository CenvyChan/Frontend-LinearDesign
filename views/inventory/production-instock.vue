<script lang="ts" setup>
import type {
  ProductionInstockTask,
  ProductionInstockTaskStatus,
} from '#/api/productionInstock';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { ElMessage } from 'element-plus';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  confirmProductionInstock,
  getProductionInstockTasks,
  refreshProductionInstockErpStatus,
  retryProductionInstockErp,
} from '#/api/productionInstock';

defineOptions({ name: 'ProductionInstockPool' });

const TASK_STATUSES: Array<{ label: string; value: ProductionInstockTaskStatus }> = [
  { label: '等待ERP审核', value: 'WAIT_ERP_AUDIT' },
  { label: '待仓库确认', value: 'PENDING_CONFIRM' },
  { label: '确认中', value: 'CONFIRMING' },
  { label: 'ERP失败', value: 'ERP_FAILED' },
  { label: '已生成ERP', value: 'ERP_PUSHED' },
  { label: '已审核入库', value: 'ERP_AUDITED' },
  { label: '已取消', value: 'CANCELLED' },
];

const userStore = useUserStore();
const loading = ref(false);
const submitting = ref(false);
const confirmVisible = ref(false);
const taskList = ref<ProductionInstockTask[]>([]);
const currentTask = ref<ProductionInstockTask | null>(null);

const filters = reactive<{ statuses: ProductionInstockTaskStatus[] }>({
  statuses: ['WAIT_ERP_AUDIT', 'PENDING_CONFIRM', 'ERP_FAILED'],
});

const confirmForm = reactive({
  erpOrgNumber: '',
  instockQty: 0,
  lotNumber: '',
  remark: '',
  stockLoc: '',
  stockName: '',
  stockNumber: '',
  stockStatusName: '',
  stockStatusNumber: 'KCZT01_SYS',
  stockerId: undefined as number | undefined,
  stockerName: '',
});

const summary = computed(() => ({
  failed: taskList.value.filter((item) => item.taskStatus === 'ERP_FAILED').length,
  pending: taskList.value.filter((item) => item.taskStatus === 'PENDING_CONFIRM').length,
  total: taskList.value.length,
  waiting: taskList.value.filter((item) => item.taskStatus === 'WAIT_ERP_AUDIT').length,
}));

function currentOperator() {
  const info: any = userStore.userInfo || {};
  return {
    stockerId: info.id || info.userId,
    stockerName: info.realName || info.nickname || info.username || '',
  };
}

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function statusText(status?: string) {
  return resolveStatus('productionInstock', 'taskStatus', status);
}

function statusType(status?: string) {
  const map: Record<string, string> = {
    CONFIRMING: 'primary',
    ERP_AUDITED: 'success',
    ERP_FAILED: 'danger',
    ERP_PUSHED: 'success',
    PENDING_CONFIRM: 'warning',
    WAIT_ERP_AUDIT: 'info',
  };
  return map[status || ''] || 'info';
}

function erpStatusText(status?: string) {
  return resolveStatus('erp', 'billStatus', status);
}

async function loadTasks() {
  loading.value = true;
  try {
    const res = await getProductionInstockTasks({ statuses: filters.statuses });
    if (!res.success) throw new Error(res.message || '获取生产入库确认池失败');
    taskList.value = res.data || [];
  } catch (error: any) {
    ElMessage.error(error.message || '获取生产入库确认池失败');
  } finally {
    loading.value = false;
  }
}

async function handleRefresh(row: ProductionInstockTask) {
  const res = await refreshProductionInstockErpStatus(row.id);
  if (res.success) {
    ElMessage.success(res.message || 'ERP状态已刷新');
    await loadTasks();
  } else {
    ElMessage.error(res.message || '刷新ERP状态失败');
  }
}

function openConfirm(row: ProductionInstockTask) {
  currentTask.value = row;
  const operator = currentOperator();
  Object.assign(confirmForm, {
    erpOrgNumber: row.erpOrgNumber || '',
    instockQty: Number(row.pendingQty || row.qualifiedQty || 0),
    lotNumber: row.lotNumber || '',
    remark: row.remark || '',
    stockLoc: row.stockLoc || '',
    stockName: row.stockName || '',
    stockNumber: row.stockNumber || '',
    stockStatusName: row.stockStatusName || '',
    stockStatusNumber: row.stockStatusNumber || 'KCZT01_SYS',
    stockerId: operator.stockerId,
    stockerName: row.stockerName || operator.stockerName,
  });
  confirmVisible.value = true;
}

async function submitConfirm() {
  if (!currentTask.value) return;
  if (!confirmForm.erpOrgNumber) {
    ElMessage.warning('请填写ERP组织编码');
    return;
  }
  if (!confirmForm.stockNumber) {
    ElMessage.warning('请填写入库仓库编码');
    return;
  }
  if (Number(confirmForm.instockQty || 0) <= 0) {
    ElMessage.warning('入库数量必须大于0');
    return;
  }
  submitting.value = true;
  try {
    const res = await confirmProductionInstock(currentTask.value.id, { ...confirmForm });
    if (!res.success) throw new Error(res.message || '确认入库失败');
    ElMessage.success(res.message || '入库确认已提交ERP');
    confirmVisible.value = false;
    await loadTasks();
  } catch (error: any) {
    ElMessage.error(error.message || '确认入库失败');
  } finally {
    submitting.value = false;
  }
}

async function handleRetry(row: ProductionInstockTask) {
  const res = await retryProductionInstockErp(row.id);
  if (res.success) {
    ElMessage.success(res.message || 'ERP重试完成');
    await loadTasks();
  } else {
    ElMessage.error(res.message || 'ERP重试失败');
  }
}

onMounted(loadTasks);
</script>

<template>
  <div class="production-instock-page">
    <section class="summary-row">
      <div class="summary-item"><span>当前任务</span><strong>{{ summary.total }}</strong></div>
      <div class="summary-item"><span>等待ERP审核</span><strong>{{ summary.waiting }}</strong></div>
      <div class="summary-item"><span>待仓库确认</span><strong>{{ summary.pending }}</strong></div>
      <div class="summary-item"><span>ERP失败</span><strong>{{ summary.failed }}</strong></div>
    </section>

    <section class="toolbar-panel">
      <el-form :model="filters" class="query-form" inline>
        <el-form-item label="任务状态">
          <el-select v-model="filters.statuses" multiple collapse-tags collapse-tags-tooltip style="width: 300px">
            <el-option v-for="item in TASK_STATUSES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="toolbar-actions">
            <el-button type="primary" :icon="'Search'" @click="loadTasks">查询</el-button>
            <el-button :icon="'Refresh'" @click="loadTasks">刷新</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <el-table v-loading="loading" :data="taskList" border stripe size="small">
        <el-table-column label="工单/产品" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.orderNo || '-' }}</strong>
              <span>{{ row.productName || row.productCode || row.materialName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="生产汇报单/产品入库检验" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <span>生产汇报单: {{ row.erpReportBillNo || '-' }} / {{ erpStatusText(row.erpReportStatus) }}</span>
              <span>产品入库检验: {{ row.erpInspectionBillNo || '-' }} / {{ erpStatusText(row.erpInspectionStatus) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="qualifiedQty" label="合格数" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.qualifiedQty) }}</template>
        </el-table-column>
        <el-table-column prop="pendingQty" label="待入库" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.pendingQty) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.taskStatus)">{{ statusText(row.taskStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="入库仓库" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.stockNumber || '-' }}</strong>
              <span>{{ row.stockName || row.stockLoc || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="ERP入库单" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.erpInstockBillNo || '-' }}</strong>
              <span>{{ erpStatusText(row.erpBillStatus) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="错误" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.lastError || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="task-action-cell">
              <el-button size="small" link type="primary" :icon="'Refresh'" @click="handleRefresh(row)">刷新状态</el-button>
              <el-button size="small" link type="success" :icon="'CircleCheck'" :disabled="row.taskStatus !== 'PENDING_CONFIRM'" @click="openConfirm(row)">确认入库</el-button>
              <el-button size="small" link type="warning" :icon="'RefreshRight'" :disabled="row.taskStatus !== 'ERP_FAILED'" @click="handleRetry(row)">重试</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="confirmVisible" title="生产入库确认" width="720px">
      <el-form :model="confirmForm" label-width="110px" size="small">
        <div class="form-grid">
          <el-form-item label="ERP组织编码">
            <el-input v-model="confirmForm.erpOrgNumber" placeholder="例如 100" />
          </el-form-item>
          <el-form-item label="入库数量">
            <el-input-number v-model="confirmForm.instockQty" :min="0" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="仓库编码">
            <el-input v-model="confirmForm.stockNumber" />
          </el-form-item>
          <el-form-item label="仓库名称">
            <el-input v-model="confirmForm.stockName" />
          </el-form-item>
          <el-form-item label="库位">
            <el-input v-model="confirmForm.stockLoc" />
          </el-form-item>
          <el-form-item label="库存状态">
            <el-input v-model="confirmForm.stockStatusNumber" />
          </el-form-item>
          <el-form-item label="批号">
            <el-input v-model="confirmForm.lotNumber" />
          </el-form-item>
          <el-form-item label="仓管员">
            <el-input v-model="confirmForm.stockerName" />
          </el-form-item>
          <el-form-item label="备注" class="form-wide">
            <el-input v-model="confirmForm.remark" type="textarea" :rows="3" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitConfirm" :icon="'Check'">提交ERP入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.production-instock-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item,
.toolbar-panel,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.summary-item span,
.inline-info span {
  color: #606266;
  font-size: 13px;
}

.summary-item strong {
  color: #1f2937;
  font-size: 22px;
}

.toolbar-panel,
.table-panel {
  margin-bottom: 12px;
  padding: 12px;
}

.query-form,
.toolbar-actions,
.task-action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.task-action-cell {
  justify-content: center;
}

.task-action-cell .el-button + .el-button {
  margin-left: 0;
}

.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.form-wide {
  grid-column: 1 / -1;
}

@media (max-width: 900px) {
  .summary-row,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
