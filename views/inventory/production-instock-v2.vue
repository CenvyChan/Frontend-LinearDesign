<script lang="ts" setup>
import type {
  ProductionInstockTask,
  ProductionInstockTaskStatus,
} from '#/api/productionInstock';
import { resolveStatus } from '#/shared/status/statusDictionary';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { ElMessage } from 'element-plus';

import {
  confirmProductionInstock,
  getProductionInstockTasks,
  refreshProductionInstockErpStatus,
  retryProductionInstockErp,
  suggestProductionInstockStock,
} from '#/api/productionInstock';

import {
  buildProductionInstockV2Model,
  getProductionInstockActionState,
} from './production-instock-v2-model';
import V2DiagnosticsShell from '../production/components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from '../production/components/v2-workbench-model';

defineOptions({ name: 'ProductionInstockPoolV2' });

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
const currentPage = ref(1);
const pageSize = ref(20);
const taskList = ref<ProductionInstockTask[]>([]);
const currentTask = ref<ProductionInstockTask | null>(null);
const model = computed(() => buildProductionInstockV2Model(taskList.value));
const pagedTaskList = computed(() => paginateV2Rows(taskList.value, currentPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '当前任务', value: model.value.summary.taskCount },
  { label: '待入库数量', value: formatNumber(model.value.summary.pendingQty) },
  { label: '阻塞项', tone: model.value.summary.blockedCount ? 'danger' : 'success', value: model.value.summary.blockedCount },
  { label: 'ERP单据链', tone: model.value.erpChains.length ? 'success' : 'warning', value: model.value.erpChains.length },
]);
const shellStages = computed(() => model.value.stages.map((stage) => ({
  blocked: stage.blocked,
  description: stage.description,
  key: stage.key,
  label: stage.label,
  tone: stage.tone,
  value: stage.total,
})));
const shellIssues = computed(() => model.value.issueGroups.map((issue) => ({
  count: issue.count,
  key: issue.key,
  label: issue.label,
  tone: issue.tone,
})));
const chains = computed(() => model.value.erpChains.slice(0, 8).map((chain) => ({
  key: chain.taskId,
  primary: chain.orderNo || '-',
  secondary: [chain.productReportBillNo, chain.pqc1BillNo].filter(Boolean).join(' / ') || '-',
  status: chain.instockBillNo || '待入库单',
  tone: chain.instockBillNo ? 'success' : 'warning',
})));

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
    currentPage.value = 1;
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

async function openConfirm(row: ProductionInstockTask) {
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
  // 若仓库未预填，异步调用建议接口（纯MES查询，不阻塞弹窗打开）
  if (!confirmForm.stockNumber) {
    try {
      const suggestion = await suggestProductionInstockStock(row.id);
      if (suggestion?.suggestedStockNumber && !confirmForm.stockNumber) {
        confirmForm.stockNumber = suggestion.suggestedStockNumber;
        if (!confirmForm.stockName && suggestion.suggestedStockName) {
          confirmForm.stockName = suggestion.suggestedStockName;
        }
      }
    } catch {
      // 建议失败时静默忽略，不影响用户手动输入
    }
  }
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

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function resetFilters() {
  filters.statuses = ['WAIT_ERP_AUDIT', 'PENDING_CONFIRM', 'ERP_FAILED'];
  await loadTasks();
}

onMounted(loadTasks);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="关键 ERP 单据链"
    :chains="chains"
    description="生产汇报单和产品入库检验审核通过后，在这里确认入库并推 ERP 入库单。缺仓库编码的任务无法确认。"
    eyebrow="仓储 · 生产入库"
    issue-title="异常优先区"
    :issues="shellIssues"
    :metrics="metrics"
    :stages="shellStages"
    title="生产入库确认池"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadTasks" :icon="'Refresh'">刷新</el-button>
    </template>

    <template #toolbar>
      <section class="filter-panel">
        <el-form :model="filters" class="query-form" inline>
          <el-form-item label="任务状态">
            <el-select v-model="filters.statuses" collapse-tags collapse-tags-tooltip multiple style="width: 320px">
              <el-option v-for="item in TASK_STATUSES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <div class="toolbar-actions">
              <el-button type="primary" @click="loadTasks" :icon="'Refresh'">查询</el-button>
              <el-button @click="resetFilters" :icon="'RefreshRight'">重置条件</el-button>
            </div>
          </el-form-item>
        </el-form>
      </section>
    </template>

    <section class="table-panel">
      <el-table v-loading="loading" :data="pagedTaskList" border height="520" size="small" stripe>
        <el-table-column label="工单/产品" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.orderNo || '-' }}</strong>
              <span>{{ row.productName || row.productCode || row.materialName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="生产汇报单/产品入库检验" min-width="240" show-overflow-tooltip>
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
        <el-table-column label="状态" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.taskStatus)" size="small">{{ statusText(row.taskStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="入库仓库" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.stockNumber || '-' }}</strong>
              <span>{{ row.stockName || row.stockLoc || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="ERP入库单" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.erpInstockBillNo || '-' }}</strong>
              <span>{{ erpStatusText(row.erpBillStatus) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="lastError" label="错误" min-width="200" show-overflow-tooltip />
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <div class="task-action-cell">
              <el-button size="small" link type="primary" :disabled="!getProductionInstockActionState(row).canRefresh" @click="handleRefresh(row)" :icon="'Refresh'">
                刷新状态
              </el-button>
              <el-button size="small" link type="success" :disabled="!getProductionInstockActionState(row).canConfirm" @click="openConfirm(row)" :icon="'Check'">
                确认入库
              </el-button>
              <el-button size="small" link type="warning" :disabled="!getProductionInstockActionState(row).canRetry" @click="handleRetry(row)" :icon="'RefreshRight'">
                重试
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="taskList.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
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
          <el-form-item label="仓库编码"><el-input v-model="confirmForm.stockNumber" /></el-form-item>
          <el-form-item label="仓库名称"><el-input v-model="confirmForm.stockName" /></el-form-item>
          <el-form-item label="库位"><el-input v-model="confirmForm.stockLoc" /></el-form-item>
          <el-form-item label="库存状态"><el-input v-model="confirmForm.stockStatusNumber" /></el-form-item>
          <el-form-item label="批号"><el-input v-model="confirmForm.lotNumber" /></el-form-item>
          <el-form-item label="仓管员"><el-input v-model="confirmForm.stockerName" /></el-form-item>
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
  </V2DiagnosticsShell>
</template>

<style scoped>
.filter-panel,
.table-panel {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.filter-panel .query-form {
  margin-bottom: -18px;
}

.table-panel {
  margin-top: 6px;
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
  white-space: nowrap;
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

.inline-info span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.form-wide {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .query-form,
  .toolbar-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
