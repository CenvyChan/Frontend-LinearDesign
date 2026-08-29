<script lang="ts" setup>
import type { FeedTaskItem, FeedTaskMaterialSummaryItem } from '#/api/production';

import { computed, onMounted, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getFeedErpStatus,
  getFeedTaskMaterialSummary,
  prepareFeedTask,
  previewFeedBill,
  rollbackFeedBill,
  submitFeedBill,
  transferFeedTask,
} from '#/api/production';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  buildFeedTaskPoolV2Model,
  getFeedTaskActionState,
} from './feed-task-pool-v2-model';
import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import MaterialTaskTransferDialog from './components/MaterialTaskTransferDialog.vue';
import { paginateV2Rows } from './components/v2-workbench-model';

defineOptions({ name: 'FeedTaskPoolV2' });

const transferVisible = ref(false);
const transferTaskId = ref(0);

const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const summaryList = ref<FeedTaskMaterialSummaryItem[]>([]);
const previewDialogVisible = ref(false);
const previewData = ref<any>(null);
const model = computed(() => buildFeedTaskPoolV2Model(summaryList.value));
const pagedSummaryList = computed(() => paginateV2Rows(summaryList.value, currentPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '物料汇总', value: model.value.summary.materialCount },
  { label: '任务数', value: model.value.summary.taskCount },
  { label: '待补总量', value: formatNumber(model.value.summary.pendingQty) },
  { label: '可预览', tone: 'success', value: model.value.summary.readyToPreviewCount },
  { label: '阻塞项', tone: model.value.summary.blockedCount ? 'danger' : 'success', value: model.value.summary.blockedCount },
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
  primary: chain.orderNo,
  secondary: chain.erpBillNo || '-',
  status: chain.erpBillStatus || '-',
  tone: statusType(chain.erpBillStatus),
})));

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTime(ts?: number) {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatDefaultStock(row: FeedTaskMaterialSummaryItem) {
  const text = [row.defaultStockNumber, row.defaultStockName].filter(Boolean).join(' / ');
  return text || '未配置';
}

function feedTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'feedStatus', status);
}

function statusType(status?: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    APPROVED: 'success',
    APPROVING: 'warning',
    CLOSED: 'info',
    FAILED: 'danger',
    PREPARED: 'success',
    PREPARING: 'warning',
    PREVIEWED: 'primary',
    REJECTED: 'danger',
    SUBMITTED: 'success',
    TERMINATED: 'info',
  };
  return map[status || ''] || 'info';
}

async function loadSummary() {
  loading.value = true;
  try {
    const res = await getFeedTaskMaterialSummary();
    if (res.success) summaryList.value = res.data || [];
    currentPage.value = 1;
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function handlePrepare(task: FeedTaskItem) {
  try {
    await prepareFeedTask(task.id);
    ElMessage.success('补料任务已进入备料状态');
    await loadSummary();
  } catch (error: any) {
    ElMessage.error(error?.message || '开始备料失败');
  }
}

async function handlePreview(task: FeedTaskItem, mode?: 'SAVE') {
  try {
    const res = await previewFeedBill(task.id, mode);
    if (showMappingPrompt(res)) return;
    if (res.success) {
      previewData.value = res.data;
      previewDialogVisible.value = true;
      await loadSummary();
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || 'ERP补料预览失败');
  }
}

async function handleSubmit(task: FeedTaskItem) {
  try {
    const res = await submitFeedBill(task.id);
    if (showMappingPrompt(res)) return;
    if (res.success) {
      ElMessage.success(res.message || '生产补料单已提交');
      await loadSummary();
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || '提交ERP补料单失败');
  }
}

async function handleRollback(task: FeedTaskItem) {
  try {
    await ElMessageBox.confirm(`确认回滚补料草稿单 ${task.erpBillNo || task.id}？`, '回滚补料单', { type: 'warning' });
    await rollbackFeedBill(task.id);
    ElMessage.success('ERP补料单已回滚');
    await loadSummary();
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '回滚ERP补料单失败');
  }
}

async function handleQueryStatus(task: FeedTaskItem) {
  try {
    const res = await getFeedErpStatus(task.id);
    if (res.success) {
      ElMessage.success('ERP状态已同步');
      await loadSummary();
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '查询ERP状态失败');
  }
}

function showMappingPrompt(payload: any) {
  const data = payload?.response?.data || payload?.data || payload;
  if (!data || data.success !== false || !data.missingRole) return false;
  const orgText = [data.erpOrgNumber, data.erpOrgName].filter(Boolean).join(' / ') || '通用';
  ElMessageBox.alert(
    `${data.message || '当前用户缺少ERP人员映射'}\n\n角色：${data.missingRoleText || data.missingRole}\nERP组织编码：${orgText}\n维护入口：系统管理 > MES 职责与数据范围`,
    '缺少ERP人员映射',
    { type: 'warning' },
  );
  return true;
}

onMounted(loadSummary);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="关键 ERP 单据链"
    :chains="chains"
    description="按物料汇总补料任务，可见补料原因与备料进度。ERP 补料单默认走下推后保存，草稿未提交时可回滚。"
    eyebrow="仓储 · 补料"
    issue-title="异常优先区"
    :issues="shellIssues"
    :metrics="metrics"
    :stages="shellStages"
    title="补料任务池"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadSummary" :icon="'Refresh'">刷新</el-button>
    </template>

    <section class="table-panel">
      <el-table v-loading="loading" :data="pagedSummaryList" border empty-text="暂无补料任务" height="520" row-key="materialCode" size="small">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border max-height="320" size="small">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="补料量" width="90" align="right" />
              <el-table-column prop="preparedQty" label="备料量" width="90" align="right" />
              <el-table-column prop="reasonText" label="补料原因" min-width="160" show-overflow-tooltip />
              <el-table-column label="状态" width="110">
                <template #default="{ row: task }">
                  <el-tag :type="statusType(task.taskStatus)" size="small">{{ feedTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpBillNo" label="ERP单号" min-width="130" show-overflow-tooltip />
              <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
              <el-table-column label="申请时间" min-width="150">
                <template #default="{ row: task }">{{ formatTime(task.createTime) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="370" fixed="right">
                <template #default="{ row: task }">
                  <div class="task-action-cell">
                    <el-button size="small" type="primary" :disabled="!getFeedTaskActionState(task).canPrepare" @click="handlePrepare(task)" :icon="'Check'">备料</el-button>
                    <el-button size="small" type="success" :disabled="!getFeedTaskActionState(task).canPreview" @click="handlePreview(task)" :icon="'View'">预览</el-button>
                    <el-button size="small" :disabled="!getFeedTaskActionState(task).canTransfer" @click="transferTaskId = task.id; transferVisible = true">转仓</el-button>
                    <el-button size="small" :disabled="!getFeedTaskActionState(task).canDirectSave" @click="handlePreview(task, 'SAVE')" :icon="'Check'">直接保存</el-button>
                    <el-button size="small" type="warning" :disabled="!getFeedTaskActionState(task).canSubmit" @click="handleSubmit(task)" :icon="'Check'">提交</el-button>
                    <el-button size="small" :disabled="!getFeedTaskActionState(task).canSyncStatus" @click="handleQueryStatus(task)" :icon="'Refresh'">查状态</el-button>
                    <el-button size="small" type="danger" :disabled="!getFeedTaskActionState(task).canRollback" @click="handleRollback(task)" :icon="'ArrowLeft'">回滚</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column label="默认仓库" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDefaultStock(row) }}</template>
        </el-table-column>
        <el-table-column prop="totalRequestQty" label="待补总量" width="110" align="right" />
        <el-table-column prop="taskCount" label="任务数" width="90" align="center" />
        <el-table-column label="最早申请" min-width="150">
          <template #default="{ row }">{{ formatTime(row.earliestApplyTime) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="summaryList.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="previewDialogVisible" title="ERP生产补料单预览" width="80%">
      <div v-if="previewData?.result">
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="ERP单号">{{ previewData.erpBillNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ERP内码">{{ previewData.erpBillId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据状态">{{ previewData.documentStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据日期">{{ previewData.billDate || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="previewData.result.Entity || []" border max-height="360" size="small" style="margin-top: 12px">
          <el-table-column prop="Seq" label="序号" width="60" />
          <el-table-column label="物料编码" min-width="120">
            <template #default="{ row }">{{ row.MaterialId?.Number || '-' }}</template>
          </el-table-column>
          <el-table-column prop="ActualQty" label="补料数量" width="100" align="right" />
          <el-table-column label="仓库" min-width="120">
            <template #default="{ row }">{{ row.StockId?.Name?.[0]?.Value || '-' }}</template>
          </el-table-column>
          <el-table-column label="批号" min-width="120">
            <template #default="{ row }">{{ row.Lot?.Number || row.Lot_Text || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无 ERP 草稿单数据" />
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
    <MaterialTaskTransferDialog
      v-model="transferVisible"
      :task-id="transferTaskId"
      :do-transfer="transferFeedTask"
      @success="loadSummary"
    />
  </V2DiagnosticsShell>
</template>

<style scoped>
.table-panel {
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.task-action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.task-action-cell .el-button + .el-button {
  margin-left: 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}
</style>
