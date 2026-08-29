<script lang="ts" setup>
import type {
  MaterialRequestTaskItem,
  MaterialRequestTaskMaterialSummaryItem,
  PickTaskItem,
} from '#/api/production';
import { resolveStatus } from '#/shared/status/statusDictionary';

import { computed, onMounted, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  autoAllocateMaterialRequests,
  closePickTask,
  getMaterialRequestTaskMaterialSummary,
  getPickErpStatus,
  prepareFeedTask,
  preparePickTask,
  previewIssueBill,
  previewIssueBillsBatch,
  rollbackIssueBill,
  rollbackIssueBillsBatch,
  submitIssueBill,
  submitIssueBillsBatch,
  transferPickTask,
} from '#/api/production';

import {
  buildMaterialRequestSummaryKey,
  buildPickTaskPoolV2Model,
  getPickTaskActionState,
} from './pick-task-pool-v2-model';
import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import MaterialTaskTransferDialog from './components/MaterialTaskTransferDialog.vue';
import { paginateV2Rows } from './components/v2-workbench-model';

defineOptions({ name: 'PickTaskPoolV2' });

const transferVisible = ref(false);
const transferTaskId = ref(0);

const loading = ref(false);
const autoAllocating = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const summaryList = ref<MaterialRequestTaskMaterialSummaryItem[]>([]);
const selectedSummaries = ref<MaterialRequestTaskMaterialSummaryItem[]>([]);
const issueDialogVisible = ref(false);
const issueSubmitting = ref(false);
const currentIssueTasks = ref<PickTaskItem[]>([]);
const issuePreview = ref<any>(null);

const model = computed(() => buildPickTaskPoolV2Model(summaryList.value));
const summaryRows = computed(() =>
  summaryList.value.map((item) => ({
    ...item,
    summaryKey: buildMaterialRequestSummaryKey(item),
  })),
);
const pagedSummaryRows = computed(() => paginateV2Rows(summaryRows.value, currentPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '物料汇总', value: model.value.summary.materialCount },
  { label: '任务数', value: model.value.summary.taskCount },
  { label: '待备总量', value: formatNumber(model.value.summary.pendingQty) },
  { label: '可发料', tone: 'success', value: model.value.summary.readyToIssueCount },
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
  tone: pickTaskStatusType(chain.erpBillStatus || ''),
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

function formatDefaultStock(row: MaterialRequestTaskMaterialSummaryItem) {
  const text = [row.defaultStockNumber, row.defaultStockName].filter(Boolean).join(' / ');
  return text || '未配置';
}

function formatApplyType(value?: string) {
  const map: Record<string, string> = {
    PHYSICAL: '实仓申请',
    WORKSHOP: '线边/车间仓申请',
  };
  return map[String(value || 'PHYSICAL').toUpperCase()] || value || 'PHYSICAL';
}

function formatWarehouseType(value?: string) {
  const map: Record<string, string> = {
    PHYSICAL: '实仓',
    WORKSHOP: '线边/车间仓',
  };
  return map[String(value || 'PHYSICAL').toUpperCase()] || value || 'PHYSICAL';
}

function pickTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'pickStatus', status);
}

function pickTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    APPROVED: 'success',
    APPROVING: 'warning',
    CLOSED: 'info',
    FAILED: 'danger',
    ISSUING: 'primary',
    PREPARED: 'success',
    PREPARING: 'warning',
    REJECTED: 'danger',
    SUBMITTED: 'success',
    TERMINATED: 'info',
  };
  return map[status] || 'info';
}

async function loadSummary() {
  loading.value = true;
  try {
    const res = await getMaterialRequestTaskMaterialSummary();
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

function handleSummarySelectionChange(rows: MaterialRequestTaskMaterialSummaryItem[]) {
  selectedSummaries.value = rows;
}

async function handleBatchPrepare() {
  const taskMap = new Map<string, MaterialRequestTaskItem>();
  selectedSummaries.value
    .flatMap((item) => item.tasks || [])
    .filter((task) => getPickTaskActionState(task).canPrepare)
    .forEach((task) => taskMap.set(`${task.sourceType || 'PICK'}|${task.id}`, task));
  const tasks = [...taskMap.values()];
  if (tasks.length === 0) {
    ElMessage.warning('选中的汇总行没有可开始备料的任务');
    return;
  }
  try {
    for (const task of tasks) await prepareTask(task);
    ElMessage.success(`已开始备料 ${tasks.length} 条任务`);
    await loadSummary();
  } catch (error: any) {
    ElMessage.error(error?.message || '汇总备料失败');
  }
}

async function handleBatchAutoAllocate() {
  const taskMap = new Map<string, MaterialRequestTaskItem>();
  selectedSummaries.value
    .flatMap((item) => item.tasks || [])
    .filter((task) => getPickTaskActionState(task).canPrepare)
    .forEach((task) => taskMap.set(`${task.sourceType || 'PICK'}|${task.id}`, task));
  const tasks = [...taskMap.values()];
  if (tasks.length === 0) {
    ElMessage.warning('选中的汇总行没有可自动分配的任务');
    return;
  }
  autoAllocating.value = true;
  try {
    const res: any = await autoAllocateMaterialRequests({
      tasks: tasks.map((task) => ({
        sourceType: task.sourceType || 'PICK',
        taskId: task.id,
      })),
    });
    if (res.success) {
      const data = res.data || {};
      const shortage = Number(data.shortageTaskCount || 0);
      ElMessage.success(
        shortage > 0
          ? `已自动分配 ${data.allocatedTaskCount || 0} 条任务，${shortage} 条库存不足`
          : `已自动分配 ${data.allocatedTaskCount || 0} 条任务`,
      );
      await loadSummary();
    } else {
      ElMessage.error(res.message || '自动分配失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '自动分配失败');
  } finally {
    autoAllocating.value = false;
  }
}

async function handleBatchIssue() {
  const tasks = selectedSummaries.value
    .flatMap((item) => item.tasks || [])
    .filter(isPickTask)
    .filter((task) => getPickTaskActionState(task).canIssue);
  if (tasks.length === 0) {
    ElMessage.warning('选中的汇总行没有可发料任务');
    return;
  }
  try {
    const res = await previewIssueBillsBatch(tasks.map((task) => task.id));
    if (showMappingPrompt(res)) return;
    if (res.success) {
      currentIssueTasks.value = tasks;
      issuePreview.value = res.data;
      issueDialogVisible.value = true;
      await loadSummary();
    } else {
      ElMessage.error(res.message || 'ERP汇总发料预览失败');
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || 'ERP汇总发料预览失败');
  }
}

async function handlePrepare(task: MaterialRequestTaskItem) {
  try {
    await prepareTask(task);
    ElMessage.success('任务已进入备料状态');
    await loadSummary();
  } catch (error: any) {
    ElMessage.error(error?.message || '开始备料失败');
  }
}

function prepareTask(task: MaterialRequestTaskItem) {
  return isFeedTask(task) ? prepareFeedTask(task.id) : preparePickTask(task.id);
}

function isFeedTask(task: MaterialRequestTaskItem) {
  return task.sourceType === 'FEED';
}

function isPickTask(task: MaterialRequestTaskItem): task is PickTaskItem {
  return task.sourceType !== 'FEED';
}

async function handleIssue(task: PickTaskItem) {
  try {
    const res = await previewIssueBill(task.id);
    if (showMappingPrompt(res)) return;
    if (res.success) {
      currentIssueTasks.value = [task];
      issuePreview.value = res.data;
      issueDialogVisible.value = true;
      await loadSummary();
    } else {
      ElMessage.error(res.message || 'ERP发料预览失败');
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || 'ERP发料预览失败');
  }
}

async function handleSubmitIssue() {
  if (!currentIssueTasks.value.length) return;
  issueSubmitting.value = true;
  try {
    const taskIds = currentIssueTasks.value.map((task) => task.id);
    const taskId = taskIds[0];
    if (taskId === undefined) return;
    const res =
      taskIds.length > 1
        ? await submitIssueBillsBatch(taskIds)
        : await submitIssueBill(taskId, { preview: issuePreview.value });
    if (showMappingPrompt(res)) return;
    if (res.success) {
      ElMessage.success(res.message || '生产领料单已提交');
      issueDialogVisible.value = false;
      currentIssueTasks.value = [];
      issuePreview.value = null;
      await loadSummary();
    } else {
      ElMessage.error(res.message || '提交生产领料单失败');
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || '提交生产领料单失败');
  } finally {
    issueSubmitting.value = false;
  }
}

async function handleRollback() {
  if (!currentIssueTasks.value.length) return;
  try {
    const taskIds = currentIssueTasks.value.map((task) => task.id);
    const taskId = taskIds[0];
    if (taskId === undefined) return;
    if (taskIds.length > 1) {
      await rollbackIssueBillsBatch(taskIds);
    } else {
      await rollbackIssueBill(taskId);
    }
    ElMessage.success('ERP草稿单已回滚');
    issueDialogVisible.value = false;
    currentIssueTasks.value = [];
    issuePreview.value = null;
    await loadSummary();
  } catch (error: any) {
    ElMessage.error(error?.message || '回滚ERP草稿单失败');
  }
}

async function handleSyncStatus(task: PickTaskItem) {
  try {
    const res = await getPickErpStatus(task.id);
    if (res.success) {
      ElMessage.success('ERP状态已同步');
      await loadSummary();
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '查询ERP状态失败');
  }
}

async function handleClose(task: PickTaskItem) {
  try {
    await ElMessageBox.confirm(`确认关闭工单 ${task.orderNo} 的备料任务？`, '关闭任务', { type: 'warning' });
    await closePickTask(task.id);
    ElMessage.success('任务已关闭');
    await loadSummary();
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '关闭任务失败');
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
    description="按物料和默认发料仓库汇总备料任务，展开可见各工单的申请明细。缺仓、ERP 驳回和已可发料的任务排在异常区。"
    eyebrow="仓储 · 备料"
    issue-title="异常优先区"
    :issues="shellIssues"
    :metrics="metrics"
    :stages="shellStages"
    title="备料任务池"
  >
    <template #actions>
      <el-button size="small" type="warning" :disabled="selectedSummaries.length === 0" @click="handleBatchPrepare" :icon="'Check'">
        汇总备料开始
      </el-button>
      <el-button size="small" type="success" :loading="autoAllocating" :disabled="selectedSummaries.length === 0" @click="handleBatchAutoAllocate" :icon="'Box'">
        自动分配批次
      </el-button>
      <el-button size="small" type="primary" :disabled="selectedSummaries.length === 0" @click="handleBatchIssue" :icon="'Check'">
        汇总发料
      </el-button>
      <el-button size="small" :loading="loading" @click="loadSummary" :icon="'Refresh'">刷新</el-button>
    </template>

    <section class="table-panel">
      <el-table
        v-loading="loading"
        :data="pagedSummaryRows"
        border
        empty-text="暂无备料任务"
        height="520"
        row-key="summaryKey"
        size="small"
        @selection-change="handleSummarySelectionChange"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border max-height="320" size="small">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="申请量" width="90" align="right" />
              <el-table-column prop="reservedQty" label="占用量" width="90" align="right" />
              <el-table-column prop="applyUserName" label="申请人" width="100" />
              <el-table-column label="申请类型" width="130">
                <template #default="{ row: task }">{{ formatApplyType(task.applyType) }}</template>
              </el-table-column>
              <el-table-column label="仓库类型" width="120">
                <template #default="{ row: task }">{{ formatWarehouseType(task.warehouseType || task.applyType) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row: task }">
                  <el-tag :type="pickTaskStatusType(task.taskStatus)" size="small">{{ pickTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpBillNo" label="ERP单号" min-width="130" show-overflow-tooltip />
              <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
              <el-table-column label="申请时间" min-width="150">
                <template #default="{ row: task }">{{ formatTime(task.createTime) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="280" fixed="right">
                <template #default="{ row: task }">
                  <div class="task-action-cell">
                    <el-button size="small" type="primary" :disabled="!getPickTaskActionState(task).canPrepare" @click="handlePrepare(task)" :icon="'Check'">备料</el-button>
                    <el-button size="small" type="success" :disabled="!isPickTask(task) || !getPickTaskActionState(task).canIssue" @click="handleIssue(task)" :icon="'Check'">发料</el-button>
                    <el-button size="small" :disabled="!getPickTaskActionState(task).canSyncStatus" @click="handleSyncStatus(task)" :icon="'Refresh'">查状态</el-button>
                    <el-button size="small" type="danger" :disabled="!getPickTaskActionState(task).canClose" @click="handleClose(task)">关闭</el-button>
                    <el-button size="small" :disabled="!getPickTaskActionState(task).canTransfer" @click="transferTaskId = task.id; transferVisible = true">转仓</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column label="申请类型" width="130">
          <template #default="{ row }">{{ formatApplyType(row.applyType) }}</template>
        </el-table-column>
        <el-table-column label="仓库类型" width="120">
          <template #default="{ row }">{{ formatWarehouseType(row.warehouseType || row.applyType) }}</template>
        </el-table-column>
        <el-table-column label="默认发料仓库" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDefaultStock(row) }}</template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column label="待备总量" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.totalDemandQty ?? row.totalReservedQty) }}</template>
        </el-table-column>
        <el-table-column prop="taskCount" label="关联任务" width="100" align="center" />
        <el-table-column prop="highestPriority" label="最高优先级" width="110" align="center" />
        <el-table-column label="最早申请" min-width="150">
          <template #default="{ row }">{{ formatTime(row.earliestApplyTime) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="summaryRows.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="issueDialogVisible" title="ERP生产领料单预览" width="80%">
      <el-alert
        v-if="currentIssueTasks.length > 1"
        title="当前预览由多条备料任务合并生成，ERP请求报文会在后端日志输出。"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />
      <div v-if="issuePreview?.result">
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="ERP单号">{{ issuePreview.erpBillNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ERP内码">{{ issuePreview.erpBillId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据状态">{{ issuePreview.documentStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据日期">{{ issuePreview.billDate || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="issuePreview.result.Entity || []" border max-height="360" size="small" style="margin-top: 12px">
          <el-table-column prop="Seq" label="序号" width="60" />
          <el-table-column label="物料编码" min-width="120">
            <template #default="{ row }">{{ row.MaterialId?.Number || '-' }}</template>
          </el-table-column>
          <el-table-column prop="AppQty" label="申请数" width="100" align="right" />
          <el-table-column prop="ActualQty" label="实发数" width="100" align="right" />
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
        <el-button @click="issueDialogVisible = false">关闭</el-button>
        <el-button :disabled="!currentIssueTasks.length" @click="handleRollback" :icon="'ArrowLeft'">回滚草稿</el-button>
        <el-button type="primary" :loading="issueSubmitting" :disabled="!currentIssueTasks.length" @click="handleSubmitIssue" :icon="'Check'">
          提交到 ERP
        </el-button>
      </template>
    </el-dialog>
    <MaterialTaskTransferDialog
      v-model="transferVisible"
      :task-id="transferTaskId"
      :do-transfer="transferPickTask"
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
