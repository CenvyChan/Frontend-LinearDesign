<script lang="ts" setup>
import type {
  InspectionSample,
  InspectionErpCallAudit,
  InspectionTaskDetail,
  InspectionTaskItem,
  InspectionTaskStatus,
  InspectionType,
  ProcessInspectionTask,
} from '#/api/inspectionTask';
import { resolveStatus } from '#/shared/status/statusDictionary';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { ElMessage } from 'element-plus';

import {
  assignInspectionTask,
  completeInspectionTask,
  getInspectionTaskErpCallAudits,
  getInspectionTaskDetail,
  getInspectionTasks,
  retryInspectionTaskErp,
  saveInspectionSample,
  startInspectionTask,
} from '#/api/inspectionTask';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import {
  buildInspectionTasksV2Model,
  buildProductInboundInspectionRequest,
  getInspectionTaskV2ActionState,
  normalizeInspectionErpPushStatus,
  validateProductInboundInspectionQuantities,
} from './inspection-tasks-v2-model';

defineOptions({ name: 'InspectionTasksV2' });

const INSPECTION_TYPES: Array<{ label: string; value: InspectionType }> = [
  { label: '来料检验', value: 'IQC' },
  { label: '制程检验', value: 'PQC' },
  { label: '成品检验', value: 'FQC' },
  { label: '发货检验', value: 'OQC' },
  { label: '产线巡检', value: 'LQC' },
];

const TASK_STATUSES: Array<{ label: string; value: InspectionTaskStatus }> = [
  { label: '待检', value: 'PENDING' },
  { label: '检验中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
];

const userStore = useUserStore();
const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const submitting = ref(false);
const rows = ref<ProcessInspectionTask[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const currentDetail = ref<InspectionTaskDetail | null>(null);
const taskItems = ref<InspectionTaskItem[]>([]);
const samples = ref<InspectionSample[]>([]);
const erpCallAudits = ref<InspectionErpCallAudit[]>([]);

interface SampleForm {
  attachmentUrl: string;
  measuredValue: string;
  remark: string;
  sampleNo: number;
}

const sampleForms = reactive<Record<number, SampleForm>>({});

const completeForm = reactive({
  inspectionTotalQuantity: 0,
  qualifiedQuantity: 0,
  unqualifiedQuantity: 0,
  scrapQuantity: 0,
  reworkRequired: undefined as boolean | undefined,
  inspectionResult: 'PASS',
  remark: '',
});

const filters = reactive<{
  inspectionType: '' | InspectionType;
  statuses: InspectionTaskStatus[];
}>({
  inspectionType: '',
  statuses: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
});

const model = computed(() => buildInspectionTasksV2Model(rows.value));
const metrics = computed(() => [
  { label: '任务总数', value: model.value.summary.total },
  { label: '待检', tone: 'warning', value: model.value.summary.pending },
  { label: '检验中', tone: 'primary', value: model.value.summary.inProgress },
  { label: '已完成', tone: 'success', value: model.value.summary.completed },
  { label: '阻塞', tone: 'danger', value: model.value.summary.blocked },
]);
const chains = computed(() => model.value.erpChains.map((item) => ({
  key: item.taskId,
  primary: item.sourceNo,
  secondary: [item.erpReportBillNo, item.erpInspectionBillNo].filter(Boolean).join(' / '),
  status: item.status,
  tone: item.lastError ? 'danger' : item.status === 'PUSHED' ? 'success' : 'warning',
})));
const pagedRows = computed(() => paginateV2Rows(rows.value, currentPage.value, pageSize.value));
const canCompleteCurrentDetail = computed(() => currentDetail.value
  ? getInspectionTaskV2ActionState(currentDetail.value).canComplete
  : false);

function currentOperator() {
  const info: any = userStore.userInfo || {};
  return {
    inspectorId: info.id || info.userId,
    inspectorName: info.realName || info.nickname || info.username || '',
  };
}

function inspectionTypeText(type?: string) {
  return INSPECTION_TYPES.find((item) => item.value === type)?.label || type || '-';
}

function inspectionStageText(row?: ProcessInspectionTask | InspectionTaskDetail | null) {
  if (!row || row.inspectionType !== 'PQC') {
    return '';
  }
  return row.inspectionStageLabel || (row.productionFlowId ? (row.lastProductionStep ? '产品检验' : '中间工序检验') : '');
}

function taskStatusText(status?: string) {
  return resolveStatus('inspection', 'taskStatus', status);
}

function taskStatusType(status?: string) {
  const map: Record<string, string> = {
    CANCELLED: 'info',
    COMPLETED: 'success',
    IN_PROGRESS: 'primary',
    PENDING: 'warning',
  };
  return map[status || ''] || 'info';
}

function erpStatusType(status?: string) {
  const map: Record<string, string> = {
    ERP_AUDITED: 'success',
    PUSH_FAILED: 'danger',
    PUSHED: 'success',
    PUSHING: 'primary',
    READY_TO_PUSH: 'warning',
    SKIPPED: 'info',
    SOURCE_INVALID: 'danger',
    WAIT_LOCAL_RESULT: 'warning',
    WAIT_REPORT_AUDIT: 'warning',
  };
  return map[status || ''] || 'info';
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function judgementText(status?: string) {
  return resolveStatus('inspection', 'judgement', status);
}

function judgementType(status?: string) {
  const map: Record<string, string> = {
    FAIL: 'danger',
    NA: 'info',
    PASS: 'success',
    PENDING: 'warning',
  };
  return map[status || ''] || 'info';
}

function formatStandard(row: InspectionTaskItem) {
  const parts = [
    row.standardValue ? `标准 ${row.standardValue}` : '',
    row.lowerLimit !== undefined && row.lowerLimit !== null ? `下限 ${row.lowerLimit}` : '',
    row.upperLimit !== undefined && row.upperLimit !== null ? `上限 ${row.upperLimit}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '-';
}

function sampleListOf(itemId: number) {
  return samples.value.filter((item) => item.taskItemId === itemId);
}

function nextSampleNo(itemId: number) {
  return sampleListOf(itemId).reduce((max, sample) => Math.max(max, sample.sampleNo || 0), 0) + 1;
}

function ensureSampleForm(row: InspectionTaskItem): SampleForm {
  let form = sampleForms[row.id];
  if (!form) {
    form = {
      attachmentUrl: '',
      measuredValue: '',
      remark: '',
      sampleNo: nextSampleNo(row.id),
    };
    sampleForms[row.id] = form;
  }
  return form;
}

function clearSampleForms() {
  Object.keys(sampleForms).forEach((key) => {
    delete sampleForms[Number(key)];
  });
}

async function loadData() {
  loading.value = true;
  try {
    const res: any = await getInspectionTasks({
      inspectionType: filters.inspectionType || undefined,
      statuses: filters.statuses,
    });
    if (!res.success) throw new Error(res.message || '获取检验任务失败');
    rows.value = res.data || [];
    currentPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取检验任务失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: ProcessInspectionTask) {
  detailVisible.value = true;
  detailLoading.value = true;
  currentDetail.value = null;
  taskItems.value = [];
  samples.value = [];
  erpCallAudits.value = [];
  clearSampleForms();
  try {
    const res: any = await getInspectionTaskDetail(row.id);
    if (!res.success) throw new Error(res.message || '获取检验任务详情失败');
    currentDetail.value = res.data || row;
    taskItems.value = res.data?.items || [];
    samples.value = res.data?.samples || [];
    taskItems.value.forEach((item) => ensureSampleForm(item));
    openComplete(currentDetail.value);
    const auditRes: any = await getInspectionTaskErpCallAudits(row.id);
    if (auditRes.success) erpCallAudits.value = auditRes.data || [];
  } catch (error: any) {
    ElMessage.error(error?.message || '获取检验任务详情失败');
  } finally {
    detailLoading.value = false;
  }
}

function openComplete(row?: ProcessInspectionTask | InspectionTaskDetail | null) {
  const source = row || currentDetail.value;
  if (!source) return;
  const inspectionTotalQuantity = Number(source.inspectionTotalQuantity ?? source.actualQuantity ?? 0);
  const unqualifiedQuantity = Number(source.unqualifiedQuantity ?? source.defectQuantity ?? 0);
  const scrapQuantity = Number(source.scrapQuantity ?? 0);
  Object.assign(completeForm, {
    inspectionTotalQuantity,
    qualifiedQuantity: Number(source.qualifiedQuantity ?? inspectionTotalQuantity - unqualifiedQuantity - scrapQuantity),
    unqualifiedQuantity,
    scrapQuantity,
    reworkRequired: source.qualityDisposition === 'REWORK'
      ? true
      : source.qualityDisposition === 'SCRAP'
        ? false
        : undefined,
    inspectionResult: source.inspectionResult || 'PASS',
    remark: source.remark || '',
  });
}

async function submitComplete() {
  if (!currentDetail.value) return;
  if (!canCompleteCurrentDetail.value) {
    ElMessage.warning('当前任务状态不允许提交结果');
    return;
  }
  const validation = validateProductInboundInspectionQuantities(completeForm);
  if (!validation.valid) {
    ElMessage.warning(validation.message || '数量校验失败');
    return;
  }
  submitting.value = true;
  try {
    const res: any = await completeInspectionTask(
      currentDetail.value.id,
      buildProductInboundInspectionRequest(completeForm),
    );
    if (!res.success) throw new Error(res.message || '完成检验失败');
    ElMessage.success(res.message || '检验任务已完成');
    await loadData();
    await openDetail(res.data || currentDetail.value);
  } catch (error: any) {
    ElMessage.error(error?.message || '完成检验失败');
  } finally {
    submitting.value = false;
  }
}

async function handleSaveSample(row: InspectionTaskItem) {
  if (!currentDetail.value) return;
  if (!canCompleteCurrentDetail.value) {
    ElMessage.warning('当前任务状态不允许录入样本');
    return;
  }
  const form = ensureSampleForm(row);
  if (!form.measuredValue && row.valueType !== 'ATTACHMENT') {
    ElMessage.warning('请输入实测值');
    return;
  }
  submitting.value = true;
  try {
    const res: any = await saveInspectionSample(currentDetail.value.id, {
      attachmentUrl: form.attachmentUrl || undefined,
      measuredValue: form.measuredValue,
      remark: form.remark,
      sampleNo: form.sampleNo,
      taskItemId: row.id,
    });
    if (!res.success) throw new Error(res.message || '保存样本失败');
    ElMessage.success(res.message || '样本已保存');
    await openDetail(currentDetail.value);
  } catch (error: any) {
    ElMessage.error(error?.message || '保存样本失败');
  } finally {
    submitting.value = false;
  }
}

async function handleStart(row: ProcessInspectionTask) {
  try {
    const res: any = await startInspectionTask(row.id);
    if (!res.success) throw new Error(res.message || '开始检验失败');
    ElMessage.success(res.message || '检验任务已开始');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '开始检验失败');
  }
}

async function handleClaim(row: ProcessInspectionTask) {
  try {
    const operator = currentOperator();
    const res: any = await assignInspectionTask(row.id, {
      assignedToId: operator.inspectorId,
      assignedToName: operator.inspectorName || row.assignedToName || row.inspectorName || '当前用户',
    });
    if (!res.success) throw new Error(res.message || '领取任务失败');
    ElMessage.success(res.message || '任务已领取');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '领取任务失败');
  }
}

async function handleRetry(row: ProcessInspectionTask) {
  try {
    const res: any = await retryInspectionTaskErp(row.id);
    if (!res.success) throw new Error(res.message || 'ERP 重试失败');
    ElMessage.success(res.message || 'ERP 重试已提交');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || 'ERP 重试失败');
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

onMounted(loadData);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="生产汇报单 / 产品入库检验单据链"
    description="检验任务执行与 ERP 下推。检验不通过或下推失败的任务会卡住工单闭环，失败原因直接展开在行内。"
    eyebrow="质量 · 检验任务"
    issue-title="检验异常优先区"
    :chains="chains"
    :issues="model.issueGroups"
    :metrics="metrics"
    :stages="model.stages"
    title="检验任务"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
    </template>

    <template #toolbar>
      <section class="v2-panel">
        <el-form :model="filters" inline>
          <el-form-item label="检验类型">
            <el-select v-model="filters.inspectionType" clearable placeholder="全部类型" style="width: 150px">
              <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select v-model="filters.statuses" multiple collapse-tags collapse-tags-tooltip style="width: 260px">
              <el-option v-for="item in TASK_STATUSES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadData" :icon="'Refresh'">查询</el-button>
          </el-form-item>
        </el-form>
      </section>
    </template>

    <section class="v2-panel v2-table-panel">
      <el-table :data="pagedRows" v-loading="loading" border height="520" stripe size="small">
        <el-table-column label="类型" width="105" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ inspectionTypeText(row.inspectionType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源/工单" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.sourceBillNo || row.orderNo || '-' }}</strong>
              <span>{{ row.materialName || row.productName || row.materialCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工序/产线" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.stepName || row.lineName || row.processCode || '-' }}</template>
        </el-table-column>
        <el-table-column label="数量" width="160" align="right">
          <template #default="{ row }">
            {{ row.inspectionTotalQuantity ?? row.actualQuantity ?? 0 }} / {{ row.qualifiedQuantity ?? 0 }} / {{ row.unqualifiedQuantity ?? row.defectQuantity ?? 0 }} / {{ row.scrapQuantity ?? 0 }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="taskStatusType(row.taskStatus)" size="small">{{ taskStatusText(row.taskStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="ERP" width="120" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.lastError" :content="row.lastError" placement="top">
              <el-tag :type="erpStatusType(row.erpPushStatus)" size="small">{{ normalizeInspectionErpPushStatus(row.erpPushStatus) }}</el-tag>
            </el-tooltip>
            <el-tag v-else :type="erpStatusType(row.erpPushStatus)" size="small">{{ normalizeInspectionErpPushStatus(row.erpPushStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="检验员" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.inspectorName || row.assignedToName || '-' }}</template>
        </el-table-column>
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.completeTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button size="small" link type="primary" @click="openDetail(row)" :icon="'View'">详情</el-button>
              <el-button size="small" link type="primary" :disabled="!getInspectionTaskV2ActionState(row).canAssign" @click="handleClaim(row)">领取</el-button>
              <el-button size="small" link type="success" :disabled="!getInspectionTaskV2ActionState(row).canStart" @click="handleStart(row)" :icon="'Check'">开始</el-button>
              <el-button size="small" link type="warning" :disabled="!getInspectionTaskV2ActionState(row).canRetryErp" @click="handleRetry(row)" :icon="'RefreshRight'">重试 ERP</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="rows.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-drawer v-model="detailVisible" title="检验任务详情" size="72%">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="currentDetail">
          <section class="detail-section">
            <div class="detail-summary-grid">
              <span>类型：{{ inspectionTypeText(currentDetail.inspectionType) }}</span>
              <span v-if="inspectionStageText(currentDetail)">阶段：{{ inspectionStageText(currentDetail) }}</span>
              <span>来源：{{ currentDetail.sourceBillNo || currentDetail.orderNo || '-' }}</span>
              <span>物料：{{ currentDetail.materialName || currentDetail.materialCode || '-' }}</span>
              <span>工序：{{ currentDetail.stepName || currentDetail.processCode || '-' }}</span>
              <span>状态：{{ taskStatusText(currentDetail.taskStatus) }}</span>
              <span>方案：{{ currentDetail.schemeCode || '-' }} {{ currentDetail.schemeVersion || '' }}</span>
              <span>生产汇报单：{{ currentDetail.erpReportBillNo || '-' }}</span>
              <span>产品入库检验：{{ currentDetail.erpInspectionBillNo || '-' }}</span>
              <span class="detail-wide">最后错误：{{ currentDetail.lastError || '-' }}</span>
            </div>
          </section>

          <section class="detail-section">
            <el-collapse>
              <el-collapse-item title="ERP 调用审计" name="erp-call-audits">
                <el-table :data="erpCallAudits" border size="small" max-height="260">
                  <el-table-column prop="attemptNo" label="尝试" width="70" />
                  <el-table-column prop="stepNo" label="步骤" width="70" />
                  <el-table-column prop="operation" label="操作" width="180" />
                  <el-table-column prop="formId" label="FormId" width="140" />
                  <el-table-column label="结果" width="80">
                    <template #default="{ row }"><el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag></template>
                  </el-table-column>
                  <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
                  <el-table-column label="时间" width="170"><template #default="{ row }">{{ formatTime(row.occurredTime) }}</template></el-table-column>
                </el-table>
              </el-collapse-item>
            </el-collapse>
          </section>

          <section class="detail-section">
            <div class="section-head">
              <strong>检验项与样本</strong>
              <el-button
                size="small"
                type="success"
                :disabled="!canCompleteCurrentDetail"
                @click="openComplete(currentDetail)" :icon="'Check'">
                带入提交结果
              </el-button>
            </div>
            <el-empty v-if="taskItems.length === 0" description="未匹配到检验方案项目，请先维护并匹配检验方案" />
            <el-table v-else :data="taskItems" border size="small">
              <el-table-column label="项目" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="inline-info">
                    <strong>{{ row.itemName }}</strong>
                    <span>{{ row.itemCode }} / {{ row.methodName || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="标准" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">{{ formatStandard(row) }}</template>
              </el-table-column>
              <el-table-column label="判定" width="100" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="judgementType(row.judgement)">{{ judgementText(row.judgement) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="录入样本" min-width="380">
                <template #default="{ row }">
                  <div class="sample-input-row">
                    <el-input-number
                      v-model="ensureSampleForm(row).sampleNo"
                      :disabled="!canCompleteCurrentDetail"
                      :min="1"
                      :precision="0"
                      controls-position="right"
                    />
                    <el-input
                      v-model="ensureSampleForm(row).measuredValue"
                      :disabled="!canCompleteCurrentDetail"
                      placeholder="实测值/结果"
                    />
                    <el-input
                      v-model="ensureSampleForm(row).remark"
                      :disabled="!canCompleteCurrentDetail"
                      placeholder="备注"
                    />
                    <el-button
                      size="small"
                      type="primary"
                      :disabled="!canCompleteCurrentDetail"
                      :loading="submitting"
                      @click="handleSaveSample(row)" :icon="'Check'">
                      保存
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="已有样本" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="sample-tags">
                    <el-tag
                      v-for="sample in sampleListOf(row.id)"
                      :key="sample.id"
                      size="small"
                      :type="judgementType(sample.judgement)"
                    >
                      {{ sample.sampleNo }}# {{ sample.measuredValue || '-' }}
                    </el-tag>
                    <span v-if="sampleListOf(row.id).length === 0">-</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="detail-section">
            <div class="section-head">
              <strong>提交结果</strong>
              <el-tag size="small" :type="canCompleteCurrentDetail ? 'warning' : 'info'">
                {{ canCompleteCurrentDetail ? '可提交' : '已锁定' }}
              </el-tag>
            </div>
            <el-form :model="completeForm" class="complete-form" label-width="90px" size="small">
              <el-form-item label="检验数量">
                <el-input-number
                  v-model="completeForm.inspectionTotalQuantity"
                  :disabled="!canCompleteCurrentDetail"
                  :min="0"
                  :precision="6"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="合格数量">
                <el-input-number
                  v-model="completeForm.qualifiedQuantity"
                  :disabled="!canCompleteCurrentDetail"
                  :min="0"
                  :precision="6"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="不良数量">
                <el-input-number
                  v-model="completeForm.unqualifiedQuantity"
                  :disabled="!canCompleteCurrentDetail"
                  :min="0"
                  :precision="6"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="报废数量">
                <el-input-number
                  v-model="completeForm.scrapQuantity"
                  :disabled="!canCompleteCurrentDetail"
                  :min="0"
                  :precision="6"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="检验结论">
                <span v-if="completeForm.unqualifiedQuantity + completeForm.scrapQuantity > 0" style="margin-right: 8px">不良处置：</span>
                <el-radio-group
                  v-if="completeForm.unqualifiedQuantity + completeForm.scrapQuantity > 0"
                  v-model="completeForm.reworkRequired"
                  :disabled="!canCompleteCurrentDetail"
                >
                  <el-radio :value="true">返修</el-radio>
                  <el-radio :value="false">不返修（报废）</el-radio>
                </el-radio-group>
                <el-select v-model="completeForm.inspectionResult" :disabled="!canCompleteCurrentDetail" style="width: 160px">
                  <el-option label="通过" value="PASS" />
                  <el-option label="存在不良" value="HAS_DEFECT" />
                  <el-option label="让步接收" value="CONCESSION" />
                </el-select>
              </el-form-item>
              <el-form-item label="备注">
                <el-input
                  v-model="completeForm.remark"
                  :disabled="!canCompleteCurrentDetail"
                  placeholder="完成说明"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="success"
                  :disabled="!canCompleteCurrentDetail"
                  :loading="submitting"
                  @click="submitComplete" :icon="'Check'">
                  提交完成
                </el-button>
              </el-form-item>
            </el-form>
          </section>
        </template>
      </div>
    </el-drawer>
  </V2DiagnosticsShell>
</template>

<style scoped>
.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.inline-info span {
  color: #6b7280;
  font-size: 12px;
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.action-cell :deep(.el-button),
.action-cell :deep(.el-button + .el-button) {
  margin-left: 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
}

.detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  padding: 12px;
}

.detail-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.detail-wide {
  grid-column: 1 / -1;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.sample-input-row {
  display: grid;
  grid-template-columns: 90px minmax(100px, 1fr) minmax(100px, 1fr) 58px;
  gap: 6px;
  align-items: center;
}

.sample-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 24px;
  align-items: center;
}

.complete-form {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, auto));
  gap: 8px 12px;
  align-items: center;
}

.complete-form :deep(.el-form-item) {
  margin-bottom: 0;
}

@media (max-width: 1200px) {
  .detail-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .complete-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .detail-summary-grid,
  .complete-form,
  .sample-input-row {
    grid-template-columns: 1fr;
  }
}
</style>
