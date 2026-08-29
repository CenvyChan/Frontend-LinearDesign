<script lang="ts" setup>
import type { ReturnTaskItem, ReturnTaskMaterialSummaryItem } from '#/api/production';

import { onMounted, reactive, ref, computed } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getReturnErpStatus,
  getReturnTaskMaterialSummary,
  previewReturnBill,
  submitReturnBill,
  submitReturnInspectionResult,
  transferReturnTask,
} from '#/api/production';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  buildReturnTaskPoolV2Model,
  getReturnTaskActionState,
} from './return-task-pool-v2-model';
import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import MaterialTaskTransferDialog from './components/MaterialTaskTransferDialog.vue';
import { paginateV2Rows } from './components/v2-workbench-model';

type InspectionStatus = Parameters<typeof submitReturnInspectionResult>[1]['inspectionStatus'];

defineOptions({ name: 'ReturnTaskPoolV2' });

const transferVisible = ref(false);
const transferTaskId = ref(0);

const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const summaryList = ref<ReturnTaskMaterialSummaryItem[]>([]);
const previewDialogVisible = ref(false);
const inspectionDialogVisible = ref(false);
const inspectionSubmitting = ref(false);
const currentTask = ref<ReturnTaskItem | null>(null);
const previewData = ref<any>(null);
const model = computed(() => buildReturnTaskPoolV2Model(summaryList.value));
const pagedSummaryList = computed(() => paginateV2Rows(summaryList.value, currentPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '物料汇总', value: model.value.summary.materialCount },
  { label: '任务数', value: model.value.summary.taskCount },
  { label: '待处理量', value: formatNumber(model.value.summary.pendingQty) },
  { label: '待检验', tone: model.value.summary.inspectionPendingCount ? 'warning' : 'success', value: model.value.summary.inspectionPendingCount },
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
  status: chain.inspectionStatus ? inspectionStatusText(chain.inspectionStatus) : chain.erpBillStatus || '-',
  tone: statusType(chain.erpBillStatus),
})));

const inspectionForm = reactive<{
  inspectionStatus: InspectionStatus;
  inspectorName: string;
  remark: string;
  scrapTarget: string;
  sourceCategory: string;
  targetWarehouseName: string;
  targetWarehouseNumber: string;
  vendorTarget: string;
}>({
  inspectionStatus: 'INSPECT_PASS_RETURN_TO_STOCK',
  inspectorName: '',
  remark: '',
  scrapTarget: '',
  sourceCategory: '',
  targetWarehouseName: '',
  targetWarehouseNumber: '',
  vendorTarget: '',
});

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

function returnTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'returnStatus', status);
}

function statusType(status?: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    APPROVED: 'success',
    APPROVING: 'warning',
    CLOSED: 'info',
    FAILED: 'danger',
    INSPECTED: 'success',
    INSPECTING: 'warning',
    PREVIEWED: 'primary',
    REJECTED: 'danger',
    SUBMITTED: 'primary',
    TERMINATED: 'info',
  };
  return map[status || ''] || 'info';
}

function inspectionStatusText(status?: string) {
  return resolveStatus('inspection', 'returnStatus', status);
}

async function loadSummary() {
  loading.value = true;
  try {
    const res = await getReturnTaskMaterialSummary();
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

async function handlePreview(task: ReturnTaskItem) {
  try {
    const res = await previewReturnBill(task.id);
    if (showMappingPrompt(res)) return;
    if (res.success) {
      currentTask.value = task;
      previewData.value = res.data;
      previewDialogVisible.value = true;
      await loadSummary();
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || 'ERP退料预览失败');
  }
}

async function handleSubmit(task: ReturnTaskItem) {
  try {
    const res = await submitReturnBill(task.id);
    if (showMappingPrompt(res)) return;
    if (res.success) {
      ElMessage.success(res.message || 'ERP退料单已提交');
      await loadSummary();
    }
  } catch (error: any) {
    if (showMappingPrompt(error)) return;
    ElMessage.error(error?.message || '提交ERP退料单失败');
  }
}

async function handleQueryStatus(task: ReturnTaskItem) {
  try {
    const res = await getReturnErpStatus(task.id);
    if (res.success) {
      ElMessage.success('ERP状态已同步');
      await loadSummary();
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '查询ERP状态失败');
  }
}

function openInspection(task: ReturnTaskItem) {
  currentTask.value = task;
  inspectionForm.inspectionStatus =
    task.inspectionStatus === 'INSPECT_FAIL_TO_SCRAP' || task.inspectionStatus === 'INSPECT_FAIL_TO_VENDOR'
      ? task.inspectionStatus
      : 'INSPECT_PASS_RETURN_TO_STOCK';
  inspectionForm.inspectorName = task.inspectorName || '';
  inspectionForm.sourceCategory = task.inspectionSourceCategory || '';
  inspectionForm.targetWarehouseNumber = task.targetWarehouseNumber || '';
  inspectionForm.targetWarehouseName = task.targetWarehouseName || '';
  inspectionForm.scrapTarget = task.scrapTarget || '';
  inspectionForm.vendorTarget = task.vendorTarget || '';
  inspectionForm.remark = task.inspectionRemark || '';
  inspectionDialogVisible.value = true;
}

async function submitInspection() {
  if (!currentTask.value) return;
  inspectionSubmitting.value = true;
  try {
    const res = await submitReturnInspectionResult(currentTask.value.id, { ...inspectionForm });
    if (res.success) {
      ElMessage.success(res.message || '检验结果已提交');
      inspectionDialogVisible.value = false;
      await loadSummary();
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '提交检验结果失败');
  } finally {
    inspectionSubmitting.value = false;
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
    description="跟踪退料从申请到闭环：ERP 退料单审核状态、来源条码，以及退料后是否还需要检验。"
    eyebrow="仓储 · 退料"
    issue-title="异常优先区"
    :issues="shellIssues"
    :metrics="metrics"
    :stages="shellStages"
    title="退料处理池"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadSummary" :icon="'Refresh'">刷新</el-button>
    </template>

    <section class="table-panel">
      <el-table v-loading="loading" :data="pagedSummaryList" border empty-text="暂无退料任务" height="520" row-key="materialCode" size="small">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border max-height="320" size="small">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="退料量" width="90" align="right" />
              <el-table-column prop="warehouseNumber" label="退料仓库" width="120" />
              <el-table-column prop="sourceQrToken" label="来源条码" min-width="150" show-overflow-tooltip />
              <el-table-column label="任务状态" width="110">
                <template #default="{ row: task }">
                  <el-tag :type="statusType(task.taskStatus)" size="small">{{ returnTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="检验状态" width="130">
                <template #default="{ row: task }">{{ inspectionStatusText(task.inspectionStatus) }}</template>
              </el-table-column>
              <el-table-column prop="erpBillNo" label="ERP单号" min-width="130" show-overflow-tooltip />
              <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
              <el-table-column label="申请时间" min-width="150">
                <template #default="{ row: task }">{{ formatTime(task.createTime) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="400" fixed="right">
                <template #default="{ row: task }">
                  <div class="task-action-cell">
                    <el-button size="small" type="primary" :disabled="!getReturnTaskActionState(task).canPreview" @click="handlePreview(task)" :icon="'View'">预览</el-button>
                    <el-button size="small" type="success" :disabled="!getReturnTaskActionState(task).canSubmit" @click="handleSubmit(task)" :icon="'Check'">提交ERP</el-button>
                    <el-button size="small" :disabled="!getReturnTaskActionState(task).canTransfer" @click="transferTaskId = task.id; transferVisible = true">转仓</el-button>
                    <el-button size="small" :disabled="!getReturnTaskActionState(task).canSyncStatus" @click="handleQueryStatus(task)" :icon="'Refresh'">查状态</el-button>
                    <el-button size="small" type="warning" :disabled="!getReturnTaskActionState(task).canInspect" @click="openInspection(task)">检验</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="totalRequestQty" label="待处理总量" width="120" align="right" />
        <el-table-column prop="taskCount" label="关联任务" width="100" align="center" />
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

    <el-dialog v-model="previewDialogVisible" title="ERP生产退料单预览" width="80%">
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
          <el-table-column prop="APPQty" label="申请数" width="100" align="right" />
          <el-table-column prop="Qty" label="退料数" width="100" align="right" />
          <el-table-column label="仓库" min-width="120">
            <template #default="{ row }">{{ row.StockId?.Name?.[0]?.Value || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无 ERP 草稿单数据" />
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectionDialogVisible" title="退料检验结果" width="560px">
      <el-form :model="inspectionForm" label-width="120px" size="small">
        <el-form-item label="检验结论">
          <el-select v-model="inspectionForm.inspectionStatus" style="width: 100%">
            <el-option label="合格返库" value="INSPECT_PASS_RETURN_TO_STOCK" />
            <el-option label="不合格报废" value="INSPECT_FAIL_TO_SCRAP" />
            <el-option label="来料不良退供应商" value="INSPECT_FAIL_TO_VENDOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="检验员"><el-input v-model="inspectionForm.inspectorName" /></el-form-item>
        <el-form-item label="来源分类"><el-input v-model="inspectionForm.sourceCategory" /></el-form-item>
        <el-form-item label="返库仓库"><el-input v-model="inspectionForm.targetWarehouseNumber" /></el-form-item>
        <el-form-item label="返库仓库名称"><el-input v-model="inspectionForm.targetWarehouseName" /></el-form-item>
        <el-form-item label="报废去向"><el-input v-model="inspectionForm.scrapTarget" /></el-form-item>
        <el-form-item label="供应商去向"><el-input v-model="inspectionForm.vendorTarget" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="inspectionForm.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="inspectionSubmitting" @click="submitInspection" :icon="'Check'">提交</el-button>
      </template>
    </el-dialog>
    <MaterialTaskTransferDialog
      v-model="transferVisible"
      :task-id="transferTaskId"
      :do-transfer="transferReturnTask"
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
