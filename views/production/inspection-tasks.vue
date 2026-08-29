<script lang="ts" setup>
import type {
  InspectionSample,
  InspectionTaskDetail,
  InspectionTaskItem,
  InspectionTaskStatus,
  InspectionType,
  ProcessInspectionTask,
} from '#/api/inspectionTask';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  assignInspectionTask,
  completeInspectionTask,
  createInspectionTask,
  getInspectionTaskDetail,
  getInspectionTasks,
  retryInspectionTaskErp,
  saveInspectionSample,
  startInspectionTask,
} from '#/api/inspectionTask';

defineOptions({ name: 'InspectionTasks' });

const INSPECTION_TYPES: Array<{ label: string; value: InspectionType }> = [
  { label: '来料检验', value: 'IQC' },
  { label: '制程检验', value: 'PQC' },
  { label: '产品检验', value: 'FQC' },
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
const submitting = ref(false);
const detailLoading = ref(false);
const taskList = ref<ProcessInspectionTask[]>([]);
const detailVisible = ref(false);
const createVisible = ref(false);
const currentTask = ref<InspectionTaskDetail | null>(null);
const taskItems = ref<InspectionTaskItem[]>([]);
const samples = ref<InspectionSample[]>([]);

interface SampleForm {
  attachmentUrl: string;
  measuredValue: string;
  remark: string;
  sampleNo: number;
}

const sampleForms = reactive<Record<number, SampleForm>>({});

const filters = reactive<{
  inspectionType: '' | InspectionType;
  statuses: InspectionTaskStatus[];
}>({
  inspectionType: '',
  statuses: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
});

const createForm = reactive<Partial<ProcessInspectionTask>>({
  actualQuantity: 0,
  defectQuantity: 0,
  inspectionType: 'IQC',
  orderNo: '',
  sourceBillType: '',
  sourceBillNo: '',
  materialCode: '',
  materialName: '',
  productCode: '',
  productName: '',
  supplierCode: '',
  supplierName: '',
  customerCode: '',
  customerName: '',
  lineCode: '',
  lineName: '',
  assignedToName: '',
  remark: '',
});

const completeForm = reactive({
  actualQuantity: 0,
  defectQuantity: 0,
  reworkRequired: undefined as boolean | undefined,
  inspectionResult: 'PASS',
  inspectorId: undefined as number | undefined,
  inspectorName: '',
  remark: '',
});

const summary = computed(() => ({
  completed: taskList.value.filter((item) => item.taskStatus === 'COMPLETED').length,
  pending: taskList.value.filter((item) => item.taskStatus === 'PENDING').length,
  pushing: taskList.value.filter((item) => ['PUSH_FAILED', 'READY_TO_PUSH', 'WAIT_REPORT_AUDIT'].includes(item.erpPushStatus)).length,
  total: taskList.value.length,
}));

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

function inspectionDisplayText(row: ProcessInspectionTask | InspectionTaskDetail) {
  return inspectionStageText(row) || inspectionTypeText(row.inspectionType);
}

function inspectionDisplayType(row: ProcessInspectionTask | InspectionTaskDetail) {
  if (row.inspectionType === 'FQC') {
    return 'success';
  }
  if (row.inspectionType !== 'PQC') {
    return '';
  }
  return row.lastProductionStep ? 'success' : 'primary';
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

function erpStatusText(status?: string) {
  return resolveStatus('inspection', 'erpPushStatus', status);
}

function erpStatusType(status?: string) {
  const map: Record<string, string> = {
    PUSH_FAILED: 'danger',
    READY_TO_PUSH: 'warning',
    PUSHED: 'success',
    PUSHING: 'primary',
    WAIT_REPORT_AUDIT: 'info',
  };
  return map[status || ''] || 'info';
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

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
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
  const maxNo = sampleListOf(itemId).reduce((max, sample) => Math.max(max, sample.sampleNo || 0), 0);
  return maxNo + 1;
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

async function loadTasks() {
  loading.value = true;
  try {
    const res = await getInspectionTasks({
      inspectionType: filters.inspectionType || undefined,
      statuses: filters.statuses,
    });
    if (res.success) {
      taskList.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取检验任务失败');
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取检验任务失败');
  } finally {
    loading.value = false;
  }
}

function resetCreateForm() {
  Object.assign(createForm, {
    actualQuantity: 0,
    defectQuantity: 0,
    inspectionType: 'IQC',
    orderNo: '',
    sourceBillType: '',
    sourceBillNo: '',
    materialCode: '',
    materialName: '',
    productCode: '',
    productName: '',
    supplierCode: '',
    supplierName: '',
    customerCode: '',
    customerName: '',
    lineCode: '',
    lineName: '',
    assignedToName: '',
    remark: '',
  });
}

function openCreateDialog() {
  resetCreateForm();
  createVisible.value = true;
}

async function submitCreate() {
  if (!createForm.inspectionType) {
    ElMessage.warning('请选择检验类型');
    return;
  }
  if (!createForm.sourceBillNo && !createForm.orderNo) {
    ElMessage.warning('请至少填写来源单号或工单号');
    return;
  }
  submitting.value = true;
  try {
    const res = await createInspectionTask({ ...createForm });
    if (!res.success) throw new Error(res.message || '创建检验任务失败');
    ElMessage.success(res.message || '检验任务已创建');
    createVisible.value = false;
    await loadTasks();
  } catch (error: any) {
    ElMessage.error(error.message || '创建检验任务失败');
  } finally {
    submitting.value = false;
  }
}

async function openDetail(row: ProcessInspectionTask) {
  detailVisible.value = true;
  detailLoading.value = true;
  currentTask.value = null;
  taskItems.value = [];
  samples.value = [];
  try {
    const res = await getInspectionTaskDetail(row.id);
    if (!res.success) throw new Error(res.message || '获取检验详情失败');
    currentTask.value = res.data || row;
    taskItems.value = res.data?.items || [];
    samples.value = res.data?.samples || [];
    Object.keys(sampleForms).forEach((key) => delete sampleForms[Number(key)]);
    taskItems.value.forEach((item) => ensureSampleForm(item));
  } catch (error: any) {
    ElMessage.error(error.message || '获取检验详情失败');
  } finally {
    detailLoading.value = false;
  }
}

async function handleStart(row: ProcessInspectionTask) {
  const res = await startInspectionTask(row.id);
  if (res.success) {
    ElMessage.success(res.message || '检验任务已开始');
    await loadTasks();
  } else {
    ElMessage.error(res.message || '开始失败');
  }
}

async function handleClaim(row: ProcessInspectionTask) {
  const operator = currentOperator();
  if (!operator.inspectorName) {
    ElMessage.warning('当前账号缺少姓名，无法领取');
    return;
  }
  const res = await assignInspectionTask(row.id, {
    assignedToId: operator.inspectorId,
    assignedToName: operator.inspectorName,
  });
  if (res.success) {
    ElMessage.success(res.message || '任务已领取');
    await loadTasks();
  } else {
    ElMessage.error(res.message || '领取失败');
  }
}

async function handleAssign(row: ProcessInspectionTask) {
  try {
    const promptResult: any = await ElMessageBox.prompt('请输入检验员姓名', '指派检验任务', {
      confirmButtonText: '指派',
      inputPattern: /\S+/,
      inputValue: row.assignedToName || row.inspectorName || '',
      inputErrorMessage: '检验员姓名不能为空',
    });
    const res = await assignInspectionTask(row.id, { assignedToName: promptResult.value });
    if (!res.success) throw new Error(res.message || '指派失败');
    ElMessage.success(res.message || '任务已指派');
    await loadTasks();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '指派失败');
    }
  }
}

function openComplete(row?: ProcessInspectionTask) {
  const source = row || currentTask.value;
  if (!source) return;
  currentTask.value = source as InspectionTaskDetail;
  const operator = currentOperator();
  Object.assign(completeForm, {
    actualQuantity: source.actualQuantity || 0,
    defectQuantity: source.defectQuantity || 0,
    reworkRequired: source.qualityDisposition === 'REWORK'
      ? true
      : source.qualityDisposition === 'SCRAP'
        ? false
        : undefined,
    inspectionResult: source.inspectionResult || 'PASS',
    inspectorId: source.inspectorId || operator.inspectorId,
    inspectorName: source.inspectorName || operator.inspectorName,
    remark: source.remark || '',
  });
}

async function submitComplete() {
  if (!currentTask.value) return;
  if (completeForm.defectQuantity > completeForm.actualQuantity) {
    ElMessage.warning('不良数量不能大于检验数量');
    return;
  }
  if (completeForm.defectQuantity > 0 && typeof completeForm.reworkRequired !== 'boolean') {
    ElMessage.warning(String.fromCharCode(35831,20808,36873,25321,19981,33391,22788,32622,26041,24335));
    return;
  }
  submitting.value = true;
  try {
    const res = await completeInspectionTask(currentTask.value.id, {
      inspectionTotalQuantity: completeForm.actualQuantity,
      qualifiedQuantity: completeForm.actualQuantity - completeForm.defectQuantity,
      unqualifiedQuantity: completeForm.reworkRequired === false ? 0 : completeForm.defectQuantity,
      scrapQuantity: completeForm.reworkRequired === false ? completeForm.defectQuantity : 0,
      reworkRequired: completeForm.reworkRequired,
      inspectionResult: completeForm.inspectionResult,
      remark: completeForm.remark,
    });
    if (!res.success) throw new Error(res.message || '完成检验失败');
    ElMessage.success(res.message || '检验任务已完成');
    await loadTasks();
    await openDetail(res.data || currentTask.value);
  } catch (error: any) {
    ElMessage.error(error.message || '完成检验失败');
  } finally {
    submitting.value = false;
  }
}

async function handleSaveSample(row: InspectionTaskItem) {
  if (!currentTask.value) return;
  const form = ensureSampleForm(row);
  if (!form.measuredValue && row.valueType !== 'ATTACHMENT') {
    ElMessage.warning('请输入实测值');
    return;
  }
  submitting.value = true;
  try {
    const res = await saveInspectionSample(currentTask.value.id, {
      attachmentUrl: form.attachmentUrl || undefined,
      measuredValue: form.measuredValue,
      remark: form.remark,
      sampleNo: form.sampleNo,
      taskItemId: row.id,
    });
    if (!res.success) throw new Error(res.message || '保存样本失败');
    ElMessage.success(res.message || '样本已保存');
    form.measuredValue = '';
    form.attachmentUrl = '';
    form.remark = '';
    form.sampleNo = nextSampleNo(row.id) + 1;
    await openDetail(currentTask.value);
  } catch (error: any) {
    ElMessage.error(error.message || '保存样本失败');
  } finally {
    submitting.value = false;
  }
}

async function handleRetry(row: ProcessInspectionTask) {
  const res = await retryInspectionTaskErp(row.id);
  if (res.success) {
    ElMessage.success(res.message || '产品入库检验下推完成');
  } else {
    ElMessage.error(res.message || '产品入库检验下推失败');
  }
  await loadTasks();
}

onMounted(loadTasks);
</script>

<template>
  <div class="inspection-task-page">
    <section class="summary-row">
      <div class="summary-item"><span>待检</span><strong>{{ summary.pending }}</strong></div>
      <div class="summary-item"><span>已完成</span><strong>{{ summary.completed }}</strong></div>
      <div class="summary-item"><span>ERP待处理</span><strong>{{ summary.pushing }}</strong></div>
      <div class="summary-item"><span>任务总数</span><strong>{{ summary.total }}</strong></div>
    </section>

    <section class="toolbar-panel">
      <el-form :model="filters" class="query-form" inline>
        <el-form-item label="检验类型">
          <el-select v-model="filters.inspectionType" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="filters.statuses" multiple collapse-tags collapse-tags-tooltip style="width: 240px">
            <el-option v-for="item in TASK_STATUSES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="toolbar-actions">
            <el-button type="primary" :icon="'Search'" @click="loadTasks">查询</el-button>
            <el-button :icon="'Refresh'" @click="loadTasks">刷新</el-button>
            <el-button type="success" :icon="'Plus'" @click="openCreateDialog">新建任务</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <el-table :data="taskList" v-loading="loading" border stripe size="small">
        <el-table-column label="类型" width="130" align="center">
          <template #default="{ row }">
            <div class="inspection-type-cell">
              <el-tag size="small" :type="inspectionDisplayType(row)">{{ inspectionDisplayText(row) }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源/工单" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.sourceBillNo || row.orderNo || '-' }}</strong>
              <span>{{ row.sourceBillType || row.orderNo || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="物料/产品" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.materialName || row.productName || '-' }}</strong>
              <span>{{ row.materialCode || row.productCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工序/产线" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.stepName || row.lineName || '-' }}</strong>
              <span>{{ row.processCode || row.lineCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="actualQuantity" label="检验数" width="90" align="right" />
        <el-table-column prop="defectQuantity" label="不良数" width="90" align="right" />
        <el-table-column label="状态" width="105" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="taskStatusType(row.taskStatus)">{{ taskStatusText(row.taskStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="检验员" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.inspectorName || row.assignedToName || '-' }}</template>
        </el-table-column>
        <el-table-column label="方案" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.schemeCode ? `${row.schemeCode} / ${row.schemeVersion || '-'}` : '-' }}</template>
        </el-table-column>
        <el-table-column label="产品入库检验状态" width="115" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.lastError" :content="row.lastError" placement="top">
              <el-tag size="small" :type="erpStatusType(row.erpPushStatus)">{{ erpStatusText(row.erpPushStatus) }}</el-tag>
            </el-tooltip>
            <el-tag v-else size="small" :type="erpStatusType(row.erpPushStatus)">{{ erpStatusText(row.erpPushStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.completeTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="310" fixed="right" align="center">
          <template #default="{ row }">
            <div class="task-action-cell">
              <el-button size="small" link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
              <el-button size="small" link type="primary" :icon="'User'" :disabled="row.taskStatus === 'COMPLETED'" @click="handleClaim(row)">领取</el-button>
              <el-button size="small" link type="primary" :icon="'EditPen'" :disabled="row.taskStatus === 'COMPLETED'" @click="handleAssign(row)">指派</el-button>
              <el-button size="small" link type="success" :icon="'VideoPlay'" :disabled="row.taskStatus !== 'PENDING'" @click="handleStart(row)">开始</el-button>
              <el-button size="small" link type="warning" :icon="'RefreshRight'" :disabled="!['READY_TO_PUSH','PUSHED','PUSH_FAILED'].includes(row.erpPushStatus)" @click="handleRetry(row)">检验下推</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="detailVisible" title="检验任务详情" size="70%">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="currentTask">
          <section class="detail-section">
            <div class="detail-grid">
              <span>类型：{{ inspectionTypeText(currentTask.inspectionType) }}</span>
              <span v-if="inspectionStageText(currentTask)">阶段：{{ inspectionStageText(currentTask) }}</span>
              <span>来源：{{ currentTask.sourceBillNo || currentTask.orderNo || '-' }}</span>
              <span>物料：{{ currentTask.materialName || currentTask.materialCode || '-' }}</span>
              <span>工序：{{ currentTask.stepName || currentTask.processCode || '-' }}</span>
              <span>状态：{{ taskStatusText(currentTask.taskStatus) }}</span>
              <span>方案：{{ currentTask.schemeCode || '-' }} {{ currentTask.schemeVersion || '' }}</span>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-head">
              <strong>项目与样本</strong>
              <el-button
                size="small"
                type="success"
                :icon="'CircleCheck'"
                :disabled="!['PENDING','IN_PROGRESS'].includes(currentTask.taskStatus)"
                @click="openComplete()"
              >
                完成检验
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
              <el-table-column label="录入样本" min-width="360">
                <template #default="{ row }">
                  <div class="sample-input-row">
                    <el-input-number v-model="ensureSampleForm(row).sampleNo" :min="1" :precision="0" controls-position="right" />
                    <el-input v-model="ensureSampleForm(row).measuredValue" placeholder="实测值/结果" />
                    <el-input v-model="ensureSampleForm(row).remark" placeholder="备注" />
                    <el-button size="small" type="primary" :icon="'Check'" :loading="submitting" @click="handleSaveSample(row)">保存</el-button>
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
            <el-form :model="completeForm" class="complete-form" label-width="90px" size="small">
              <el-form-item label="检验数量">
                <el-input-number v-model="completeForm.actualQuantity" :min="0" :precision="0" controls-position="right" />
              </el-form-item>
              <el-form-item label="不良数量">
                <el-input-number v-model="completeForm.defectQuantity" :min="0" :max="completeForm.actualQuantity" :precision="0" controls-position="right" />
              </el-form-item>
              <el-form-item label="检验结论">
                <span v-if="completeForm.defectQuantity > 0" style="margin-right: 8px">不良处置：</span>
                <el-radio-group v-if="completeForm.defectQuantity > 0" v-model="completeForm.reworkRequired">
                  <el-radio :value="true">返修</el-radio>
                  <el-radio :value="false">不返修（报废）</el-radio>
                </el-radio-group>
                <el-select v-model="completeForm.inspectionResult" style="width: 160px">
                  <el-option label="通过" value="PASS" />
                  <el-option label="存在不良" value="HAS_DEFECT" />
                  <el-option label="让步接收" value="CONCESSION" />
                </el-select>
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="completeForm.remark" placeholder="完成说明" />
              </el-form-item>
              <el-form-item>
                <el-button type="success" :icon="'CircleCheck'" :loading="submitting" @click="submitComplete">提交完成</el-button>
              </el-form-item>
            </el-form>
          </section>
        </template>
      </div>
    </el-drawer>

    <el-dialog v-model="createVisible" title="新建检验任务" width="760px">
      <el-form :model="createForm" label-width="100px" size="small">
        <div class="form-grid">
          <el-form-item label="检验类型">
            <el-select v-model="createForm.inspectionType" style="width: 100%">
              <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="来源类型">
            <el-input v-model="createForm.sourceBillType" placeholder="采购收料/发货通知/巡检计划" />
          </el-form-item>
          <el-form-item label="来源单号">
            <el-input v-model="createForm.sourceBillNo" />
          </el-form-item>
          <el-form-item label="工单号">
            <el-input v-model="createForm.orderNo" />
          </el-form-item>
          <el-form-item label="物料编码">
            <el-input v-model="createForm.materialCode" />
          </el-form-item>
          <el-form-item label="物料名称">
            <el-input v-model="createForm.materialName" />
          </el-form-item>
          <el-form-item label="产品编码">
            <el-input v-model="createForm.productCode" />
          </el-form-item>
          <el-form-item label="产品名称">
            <el-input v-model="createForm.productName" />
          </el-form-item>
          <el-form-item label="供应商">
            <el-input v-model="createForm.supplierName" />
          </el-form-item>
          <el-form-item label="客户">
            <el-input v-model="createForm.customerName" />
          </el-form-item>
          <el-form-item label="产线">
            <el-input v-model="createForm.lineName" />
          </el-form-item>
          <el-form-item label="指派给">
            <el-input v-model="createForm.assignedToName" />
          </el-form-item>
          <el-form-item label="检验数量">
            <el-input-number v-model="createForm.actualQuantity" :min="0" :precision="0" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="备注" class="form-wide">
            <el-input v-model="createForm.remark" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate" :icon="'Plus'">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.inspection-task-page {
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
.table-panel,
.detail-section {
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
.table-panel,
.detail-section {
  margin-bottom: 12px;
  padding: 12px;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-actions,
.task-action-cell,
.sample-input-row,
.sample-tags,
.section-head {
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

.inspection-type-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.detail-body {
  min-height: 320px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  color: #303133;
  font-size: 13px;
}

.section-head {
  justify-content: space-between;
  margin-bottom: 10px;
}

.sample-input-row {
  min-width: 0;
}

.sample-input-row .el-input-number {
  width: 88px;
  flex: 0 0 auto;
}

.sample-input-row .el-input {
  min-width: 96px;
}

.sample-tags {
  flex-wrap: wrap;
}

.complete-form {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.form-wide {
  grid-column: 1 / -1;
}

@media (max-width: 1000px) {
  .summary-row,
  .detail-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
