<script lang="ts" setup>
import type {
  WmsErpDocument,
  WmsOperationTask,
  WmsOperationTaskLine,
  WmsOperationTaskStatus,
  WmsOperationTaskType,
  WmsTaskReservePayload,
} from '#/api/wms';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Box, Check, Refresh, Search, Unlock, Upload, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import {
  completeIncomingInspection,
  convertWmsTaskToErp,
  getWmsErpDocumentPage,
  getWmsTask,
  getWmsTasks,
  releaseWmsTask,
  reserveWmsTask,
  submitWmsTask,
} from '#/api/wms';
import { useErpAcctStore } from '#/store';
import { resolveStatus } from '#/shared/status/statusDictionary';

import { businessTypeLabel, businessTypeTagType } from './erp-business-type';
import {
  canConvertLineToErp,
  canRecordIncomingInspection,
  canSubmitWmsTask,
  missingErpConversionDimensions,
} from './wms-task-action-model';

defineOptions({ name: 'WmsTaskPool' });

const erpAcctStore = useErpAcctStore();

const loading = ref(false);
const detailLoading = ref(false);
const reserveLoading = ref(false);
const submitLoadingId = ref<number | null>(null);
const releaseLoadingId = ref<number | null>(null);
const detailVisible = ref(false);
const reserveVisible = ref(false);

const tasks = ref<WmsOperationTask[]>([]);
const currentTask = ref<WmsOperationTask | null>(null);
const currentLines = ref<WmsOperationTaskLine[]>([]);
const erpDocumentMap = ref<Record<number, WmsErpDocument>>({});

const filters = reactive({
  erpAcctCode: '',
  keyword: '',
  taskStatus: '',
  taskType: '',
});

filters.erpAcctCode = erpAcctStore.acctCode || '';

const reserveForm = reactive<WmsTaskReservePayload>({
  barcode: '',
  clientRequestId: '',
  containerCode: '',
  deviceNo: 'PC',
  locationCode: '',
  locationName: '',
  qty: 0,
  remark: '',
  taskLineId: 0,
});

const inspectionVisible = ref(false);
const inspectionLoading = ref(false);
const inspectionLine = ref<WmsOperationTaskLine | null>(null);
const convertLoadingLineId = ref<number | null>(null);
const inspectionForm = reactive({
  qualifiedQty: 0,
  rejectedQty: 0,
});

const filteredTasks = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();
  return tasks.value.filter((item) => {
    const matchKeyword = !keyword || [
      item.taskNo,
      item.sourceBillNo,
      item.sourceFormId,
      item.stockNumber,
      item.stockName,
      item.operatorName,
    ].some((value) => String(value || '').toLowerCase().includes(keyword));
    const matchAcct = !filters.erpAcctCode || item.erpAcctCode === filters.erpAcctCode;
    const matchType = !filters.taskType || item.taskType === filters.taskType;
    const matchStatus = !filters.taskStatus || item.taskStatus === filters.taskStatus;
    return matchKeyword && matchAcct && matchType && matchStatus;
  });
});

/**
 * **客户端**分页。
 *
 * 与 ERP 单据中心不同，这页的分页不能下推到服务端 —— 任务可见性由职责作用域
 * 决定，判据在 Java 里（见 `loadTasks` 注释）。先分页再过滤会得到
 * 「每页 50 条筛完剩 3 条」。所以数据全量拉，只控制渲染量。
 *
 * 触发线（超过就该给任务表加真正的服务端分页）：
 * `mes_wms_operation_task` 超约 2000 行，或该页响应超约 500KB。
 * 2026-08-27 实测 47 行。
 */
const currentPage = ref(1);
const pageSize = ref(50);
const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredTasks.value.slice(start, start + pageSize.value);
});

// 过滤条件变化后当前页可能已越界（筛完只剩 1 页却停在第 3 页会显示空表）。
// 监听 length 而不是数组本身：数组每次 filter 都是新引用，会导致每次渲染都触发。
watch(
  [() => filteredTasks.value.length, pageSize],
  () => {
    currentPage.value = 1;
  },
);

const metrics = computed(() => {
  const operating = tasks.value.filter((item) => item.taskStatus === 'OPERATING').length;
  const reserved = tasks.value.filter((item) => item.taskStatus === 'RESERVED').length;
  const posted = tasks.value.filter((item) => item.taskStatus === 'WMS_POSTED').length;
  const failed = tasks.value.filter((item) => item.taskStatus === 'ERP_FAILED').length;
  return [
    { key: 'total', label: '任务总数', tone: 'primary', value: tasks.value.length },
    { key: 'operating', label: '作业中', tone: operating ? 'warning' : 'stable', value: operating },
    { key: 'reserved', label: '已预占', tone: reserved ? 'primary' : 'stable', value: reserved },
    { key: 'posted', label: '已过账', tone: 'success', value: posted },
    { key: 'failed', label: '异常失败', tone: failed ? 'danger' : 'stable', value: failed },
  ];
});

/**
 * 拉任务，再按任务引用的 sourceDocumentId **定向**取单据。
 *
 * ## 为什么这里没有服务端分页
 *
 * 任务可见性由职责作用域决定，而那个判据在 Java 里（`WmsTaskRoutingService`
 * 第 44-46 行先拉本账套全部任务，再 `isVisibleToStocker` 逐条过滤，其中还要做
 * 组织编码→ERP 内部 org id 的跨账套解析）。**下推分页会先分页再过滤** ——
 * 结果是「每页 50 条筛完只剩 3 条」，比不分页更糟。
 *
 * 所以这页用**客户端分页**：数据全量拉（受可见性约束，无法避免），
 * 表格只渲染当前页。解决的是 DOM 渲染压力，不是网络传输。
 *
 * ## 但单据镜像改成了定向取
 *
 * 改造前这里拉**全量** 1332 张单据只为建一个 id→document 的 map，
 * 而任务只有 47 条、最多引用 47 张单据 —— 1.41MB 里 97% 是白拉的。
 * 现在按 `ids` 精准取，代价是两个请求从并行变串行（必须先知道要哪些 id）。
 * 数据量差两个数量级，多一个 RTT 换掉 1.4MB 是值的。
 */
async function loadTasks() {
  loading.value = true;
  try {
    const taskResp = await getWmsTasks({ erpAcctCode: filters.erpAcctCode || undefined });
    if (!taskResp.success) throw new Error(taskResp.message || '获取WMS任务失败');
    const rawTasks = taskResp.data || [];

    const documentIds = [
      ...new Set(rawTasks.map((task) => task.sourceDocumentId).filter(Boolean)),
    ] as number[];
    const documentMap: Record<number, WmsErpDocument> = {};
    // 一条任务都没引用单据时不发这个请求 —— 不传 ids 会退化成拉全量，
    // 那正是本次要消除的行为。
    if (documentIds.length > 0) {
      const documentResp = await getWmsErpDocumentPage({
        erpAcctCode: filters.erpAcctCode || undefined,
        ids: documentIds.join(','),
        page: 1,
        // 每个 id 最多命中一张单据，所以一页足够。上限 500 由服务端 MAX_PAGE_SIZE 夹住，
        // 任务数超过 500 时这里会截断 —— 届时该给任务表加分页，而不是把这个数字调大。
        size: Math.min(documentIds.length, 500),
      });
      if (!documentResp.success) {
        throw new Error(documentResp.message || '获取ERP单据镜像失败');
      }
      for (const item of documentResp.data || []) {
        documentMap[item.id] = item;
      }
    }
    erpDocumentMap.value = documentMap;
    tasks.value = rawTasks.map((task) => {
      const document = task.sourceDocumentId ? documentMap[task.sourceDocumentId] : undefined;
      return {
        ...task,
        businessChainType: document?.businessChainType,
        inspectionStatus: document?.inspectionStatus,
        availableQty: document?.availableQty,
        acceptedQty: document?.acceptedQty,
        rejectedQty: document?.rejectedQty,
        blockedQty: document?.blockedQty,
        sourceFormId: task.sourceFormId || document?.formId,
        sourceBillNo: task.sourceBillNo || document?.billNo,
        erpDocumentStatus: document?.documentStatus,
        erpError: document?.erpError || task.lastError,
      };
    });
  } catch (error: any) {
    ElMessage.error(error.message || '获取WMS任务失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: WmsOperationTask) {
  detailVisible.value = true;
  currentTask.value = row;
  currentLines.value = [];
  await refreshCurrentTask(row.id);
}

async function refreshCurrentTask(taskId: number) {
  detailLoading.value = true;
  try {
    const resp = await getWmsTask(taskId, {
      erpAcctCode: currentTask.value?.erpAcctCode || filters.erpAcctCode || undefined,
    });
    if (!resp.success) throw new Error(resp.message || '获取任务明细失败');
    currentTask.value = resp.data.task;
    currentLines.value = resp.data.lines || [];
  } catch (error: any) {
    ElMessage.error(error.message || '获取任务明细失败');
  } finally {
    detailLoading.value = false;
  }
}

function openReserveDialog(line: WmsOperationTaskLine) {
  if (!currentTask.value) return;
  const qty = remainingQty(line);
  reserveForm.taskLineId = line.id;
  reserveForm.locationCode = line.locationCode || '';
  reserveForm.locationName = '';
  reserveForm.containerCode = line.containerCode || '';
  reserveForm.barcode = line.barcode || '';
  reserveForm.qty = qty > 0 ? qty : Number(line.planQty || 0);
  reserveForm.deviceNo = currentTask.value.deviceNo || 'PC';
  reserveForm.erpAcctCode = currentTask.value.erpAcctCode || '';
  reserveForm.clientRequestId = `pc-${Date.now()}-${line.id}`;
  reserveForm.remark = '';
  reserveVisible.value = true;
}

async function handleReserve() {
  if (!currentTask.value) return;
  if (!reserveForm.taskLineId || !reserveForm.locationCode || !reserveForm.qty) {
    ElMessage.warning('请补齐任务行、库位和数量');
    return;
  }
  reserveLoading.value = true;
  try {
    const resp = await reserveWmsTask(currentTask.value.id, {
      ...reserveForm,
      erpAcctCode: currentTask.value.erpAcctCode || reserveForm.erpAcctCode,
    });
    if (!resp.success) throw new Error(resp.message || '预占失败');
    ElMessage.success('库位库存已预占');
    reserveVisible.value = false;
    await Promise.all([loadTasks(), refreshCurrentTask(currentTask.value.id)]);
  } catch (error: any) {
    ElMessage.error(error.message || '预占失败');
  } finally {
    reserveLoading.value = false;
  }
}

function openInspectionDialog(line: WmsOperationTaskLine) {
  if (!currentTask.value) return;
  inspectionLine.value = line;
  const planQty = Number(line.planQty || 0);
  inspectionForm.qualifiedQty = planQty;
  inspectionForm.rejectedQty = 0;
  inspectionVisible.value = true;
}

/** Backend requires qualified + rejected to equal planQty exactly; check it before the round trip. */
const inspectionPlanQty = computed(() => Number(inspectionLine.value?.planQty || 0));
const inspectionTotalQty = computed(
  () => Number(inspectionForm.qualifiedQty || 0) + Number(inspectionForm.rejectedQty || 0),
);
const inspectionQtyMatches = computed(
  () => Math.abs(inspectionTotalQty.value - inspectionPlanQty.value) < 0.000_001,
);

async function handleCompleteInspection() {
  if (!currentTask.value || !inspectionLine.value) return;
  if (!inspectionQtyMatches.value) {
    ElMessage.warning(`合格数 + 判退数必须等于计划数 ${inspectionPlanQty.value}`);
    return;
  }
  inspectionLoading.value = true;
  try {
    const resp = await completeIncomingInspection(currentTask.value.id, inspectionLine.value.id, {
      qualifiedQty: Number(inspectionForm.qualifiedQty || 0),
      rejectedQty: Number(inspectionForm.rejectedQty || 0),
    });
    if (!resp.success) throw new Error(resp.message || '录入检验结果失败');
    ElMessage.success(
      Number(inspectionForm.rejectedQty || 0) > 0
        ? '检验结果已录入，判退数量已生成退料任务'
        : '检验结果已录入',
    );
    inspectionVisible.value = false;
    await Promise.all([loadTasks(), refreshCurrentTask(currentTask.value.id)]);
  } catch (error: any) {
    ElMessage.error(error.message || '录入检验结果失败');
  } finally {
    inspectionLoading.value = false;
  }
}

async function handleConvertToErp(line: WmsOperationTaskLine) {
  if (!currentTask.value) return;
  const missing = missingErpConversionDimensions(line);
  if (missing.length > 0) {
    ElMessage.warning(`缺少库存维度：${missing.join('、')}，请先补齐后再下推`);
    return;
  }
  convertLoadingLineId.value = line.id;
  try {
    // Omit the body so the backend reuses the dimensions already stored on the line.
    const resp = await convertWmsTaskToErp(currentTask.value.id, line.id);
    if (!resp.success) throw new Error(resp.message || 'ERP下推失败');
    ElMessage.success('已下推至ERP');
    await Promise.all([loadTasks(), refreshCurrentTask(currentTask.value.id)]);
  } catch (error: any) {
    ElMessage.error(error.message || 'ERP下推失败');
  } finally {
    convertLoadingLineId.value = null;
  }
}

async function handleSubmit(row: WmsOperationTask) {  submitLoadingId.value = row.id;
  try {
    const resp = await submitWmsTask(row.id, { erpAcctCode: row.erpAcctCode || filters.erpAcctCode || undefined });
    if (!resp.success) throw new Error(resp.message || '提交WMS任务失败');
    ElMessage.success('WMS任务已提交');
    await loadTasks();
    if (currentTask.value?.id === row.id) {
      await refreshCurrentTask(row.id);
    }
  } catch (error: any) {
    ElMessage.error(error.message || '提交WMS任务失败');
  } finally {
    submitLoadingId.value = null;
  }
}

async function handleRelease(row: WmsOperationTask) {
  releaseLoadingId.value = row.id;
  try {
    const resp = await releaseWmsTask(row.id, { erpAcctCode: row.erpAcctCode || filters.erpAcctCode || undefined });
    if (!resp.success) throw new Error(resp.message || '释放预占失败');
    ElMessage.success('预占已释放');
    await loadTasks();
    if (currentTask.value?.id === row.id) {
      await refreshCurrentTask(row.id);
    }
  } catch (error: any) {
    ElMessage.error(error.message || '释放预占失败');
  } finally {
    releaseLoadingId.value = null;
  }
}

function canSubmit(row?: WmsOperationTask | null) {
  return canSubmitWmsTask(row);
}

function canRelease(row?: WmsOperationTask | null) {
  return !!row && ['ERP_FAILED', 'OPERATING', 'RESERVED'].includes(row.taskStatus || '');
}

function linkedDocument(row?: WmsOperationTask | null) {
  return row?.sourceDocumentId ? erpDocumentMap.value[row.sourceDocumentId] : undefined;
}

function taskBusinessType(row?: WmsOperationTask | null) {
  return linkedDocument(row)?.businessType;
}

function chainSummary(row?: WmsOperationTask | null) {
  const document = linkedDocument(row);
  if (!document) return '-';
  return [
    document.businessChainType || '-',
    document.documentRole || '-',
    document.inspectionStatus || '-',
  ].join(' / ');
}

function failureText(row?: WmsOperationTask | null) {
  return row?.lastError || row?.erpError || linkedDocument(row)?.erpError || '';
}

function remainingQty(line: WmsOperationTaskLine) {
  return Number(line.planQty || 0) - Number(line.reservedQty || 0) - Number(line.doneQty || 0);
}

function progressText(line: WmsOperationTaskLine) {
  return `${formatNumber(line.doneQty)} / ${formatNumber(line.reservedQty)} / ${formatNumber(line.planQty)}`;
}

function taskTypeLabel(type?: WmsOperationTaskType) {
  const map: Record<WmsOperationTaskType, string> = {
    ADJUSTMENT: '调整',
    INSTOCK: '入库',
    ISSUE: '发料',
    MOVE: '移库',
    PICKING: '拣货',
    PUTAWAY: '上架',
    RECEIVING: '收货',
    RETURN: '退料',
    STOCKTAKE: '盘点',
  };
  return type ? map[type] : '-';
}

function taskTypeTag(type?: WmsOperationTaskType) {
  const map: Partial<Record<WmsOperationTaskType, string>> = {
    ADJUSTMENT: 'warning',
    INSTOCK: 'success',
    PICKING: 'primary',
    PUTAWAY: 'success',
    RECEIVING: 'success',
    RETURN: 'warning',
  };
  return type ? map[type] || 'info' : 'info';
}

function statusLabel(status?: WmsOperationTaskStatus) {
  return resolveStatus('wms', 'operationTaskStatus', status);
}

function statusType(status?: WmsOperationTaskStatus) {
  const map: Partial<Record<WmsOperationTaskStatus, string>> = {
    BLOCKED: 'danger',
    CLAIMED: 'primary',
    EXECUTING: 'warning',
    READY: 'primary',
    REVERSED: 'info',
    TRANSFER_PENDING: 'warning',
    WAIT_QC: 'warning',
    WAIT_ROUTE: 'info',
    CANCELLED: 'info',
    ERP_FAILED: 'danger',
    OPERATING: 'warning',
    RESERVED: 'primary',
    TASK_CREATED: 'info',
    WMS_POSTED: 'success',
  };
  return status ? map[status] || 'info' : 'info';
}

function erpStatusLabel(status?: string) {
  // Delegate entirely to the registry so dictionary overrides take effect.
  // Built-in text is provided by erp.billStatus entries in statusDictionary.generated.ts.
  return status ? resolveStatus('erp', 'billStatus', status) : '未知状态'
}

function erpStatusType(status?: string) {
  if (!status) return 'info';
  if (['C', 'AUDITED'].includes(status)) return 'success';
  if (['FAILED', 'REJECTED'].includes(status)) return 'danger';
  if (['B', 'SUBMITTED'].includes(status)) return 'warning';
  return 'info';
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

onMounted(loadTasks);
</script>

<template>
  <div class="wms-task-page">
    <section class="page-header">
      <div>
        <p class="eyebrow">WMS Tasks</p>
        <h1>WMS任务池</h1>
        <p class="subtitle">按收货、上架、拣货、退料、入库组织现场作业。</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" type="primary" @click="loadTasks">刷新</el-button>
      </div>
    </section>

    <section class="metric-grid">
      <div v-for="item in metrics" :key="item.key" class="metric-tile" :class="`tone-${item.tone}`">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="toolbar">
      <el-select v-model="filters.erpAcctCode" clearable placeholder="账套">
        <el-option :label="erpAcctStore.acctCode || '请选择账套'" :value="erpAcctStore.acctCode || ''" />
      </el-select>
      <el-input v-model="filters.keyword" :prefix-icon="Search" clearable placeholder="搜索任务号、源单、仓库、操作人" />
      <el-select v-model="filters.taskType" clearable placeholder="任务类型">
        <el-option label="收货" value="RECEIVING" />
        <el-option label="上架" value="PUTAWAY" />
        <el-option label="拣货" value="PICKING" />
        <el-option label="发料" value="ISSUE" />
        <el-option label="退料" value="RETURN" />
        <el-option label="入库" value="INSTOCK" />
        <el-option label="移库" value="MOVE" />
        <el-option label="盘点" value="STOCKTAKE" />
      </el-select>
      <el-select v-model="filters.taskStatus" clearable placeholder="任务状态">
        <el-option label="已创建" value="TASK_CREATED" />
        <el-option label="已预占" value="RESERVED" />
        <el-option label="作业中" value="OPERATING" />
        <el-option label="WMS已过账" value="WMS_POSTED" />
        <el-option label="ERP失败" value="ERP_FAILED" />
      </el-select>
    </section>

    <el-table v-loading="loading" :data="pagedTasks" border row-key="id">
      <el-table-column label="任务" min-width="250">
        <template #default="{ row }: { row: WmsOperationTask }">
          <div class="primary-cell">
            <strong>{{ row.taskNo || '-' }}</strong>
            <span>{{ row.sourceFormId || '-' }} / {{ row.sourceBillNo || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }: { row: WmsOperationTask }">
          <el-tag :type="taskTypeTag(row.taskType)" effect="plain">{{ taskTypeLabel(row.taskType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="ERP状态" width="120">
        <template #default="{ row }: { row: WmsOperationTask }">
          <el-tag :type="erpStatusType(row.erpDocumentStatus)" effect="plain">
            {{ erpStatusLabel(row.erpDocumentStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <!--
        业务类型走关联单据取值，不放进 WmsOperationTask —— 它是 ERP 单据头的属性，
        任务只是它的执行载体，复制一份会多出一个需要同步的副本。
      -->
      <el-table-column label="业务类型" width="100">
        <template #default="{ row }: { row: WmsOperationTask }">
          <el-tag
            v-if="taskBusinessType(row)"
            :type="businessTypeTagType(row.sourceFormId, taskBusinessType(row))"
            effect="plain"
          >
            {{ businessTypeLabel(row.sourceFormId, taskBusinessType(row)) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="链路" min-width="190">
        <template #default="{ row }: { row: WmsOperationTask }">
          <div class="primary-cell">
            <strong>{{ chainSummary(row) }}</strong>
            <span>
              可执行 {{ formatNumber(linkedDocument(row)?.availableQty) }} /
              合格 {{ formatNumber(linkedDocument(row)?.acceptedQty) }} /
              拒收 {{ formatNumber(linkedDocument(row)?.rejectedQty) }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="WMS状态" width="120">
        <template #default="{ row }: { row: WmsOperationTask }">
          <el-tag :type="statusType(row.taskStatus)" effect="light">{{ statusLabel(row.taskStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="仓库" min-width="180">
        <template #default="{ row }: { row: WmsOperationTask }">
          {{ [row.stockNumber, row.stockName].filter(Boolean).join(' / ') || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="账套" width="110">
        <template #default="{ row }: { row: WmsOperationTask }">
          {{ row.erpAcctCode || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="组织" prop="erpOrgNumber" width="120" />
      <el-table-column label="最近更新" width="180">
        <template #default="{ row }: { row: WmsOperationTask }">
          {{ formatTime(row.updateTime) }}
        </template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="180" show-overflow-tooltip>
        <template #default="{ row }: { row: WmsOperationTask }">
          {{ failureText(row) || '-' }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="280">
        <template #default="{ row }: { row: WmsOperationTask }">
          <el-button :icon="View" text type="primary" @click="openDetail(row)">明细</el-button>
          <el-button
            :disabled="!canSubmit(row)"
            :icon="Check"
            :loading="submitLoadingId === row.id"
            text
            type="success"
            @click="handleSubmit(row)"
          >
            提交
          </el-button>
          <el-button
            :disabled="!canRelease(row)"
            :icon="Unlock"
            :loading="releaseLoadingId === row.id"
            text
            type="warning"
            @click="handleRelease(row)"
          >
            释放
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 客户端分页：total 取过滤后的条数，不是服务端 total（这页没有服务端分页） -->
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      class="pager"
      :total="filteredTasks.length"
      :page-sizes="[20, 50, 100, 200]"
      layout="total, sizes, prev, pager, next, jumper"
      background
    />

    <el-drawer v-model="detailVisible" :title="currentTask?.taskNo || '任务明细'" size="78%">
      <div v-loading="detailLoading" class="detail-body">
        <div class="detail-meta">
          <span>类型：{{ taskTypeLabel(currentTask?.taskType) }}</span>
          <span>账套：{{ currentTask?.erpAcctCode || '-' }}</span>
          <span>组织：{{ currentTask?.erpOrgNumber || '-' }}</span>
          <span>ERP状态：{{ erpStatusLabel(currentTask?.erpDocumentStatus || linkedDocument(currentTask)?.documentStatus) }}</span>
          <span>WMS状态：{{ statusLabel(currentTask?.taskStatus) }}</span>
          <span>源单：{{ currentTask?.sourceBillNo || '-' }}</span>
          <span>仓库：{{ currentTask?.stockNumber || '-' }}</span>
        </div>
        <el-alert
          v-if="failureText(currentTask)"
          :closable="false"
          :title="failureText(currentTask)"
          show-icon
          type="error"
        />
        <div class="drawer-actions">
          <el-button
            :disabled="!canSubmit(currentTask)"
            :icon="Check"
            :loading="submitLoadingId === currentTask?.id"
            type="primary"
            @click="currentTask && handleSubmit(currentTask)"
          >
            提交任务
          </el-button>
          <el-button
            :disabled="!canRelease(currentTask)"
            :icon="Unlock"
            :loading="releaseLoadingId === currentTask?.id"
            type="warning"
            @click="currentTask && handleRelease(currentTask)"
          >
            释放预占
          </el-button>
        </div>
        <el-table :data="currentLines" border>
          <el-table-column label="行号" prop="lineSeq" width="80" />
          <el-table-column label="物料" min-width="240">
            <template #default="{ row }: { row: WmsOperationTaskLine }">
              <div class="primary-cell">
                <strong>{{ row.materialCode || '-' }}</strong>
                <span>{{ row.materialName || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="批次" prop="lotNo" width="130" />
          <el-table-column label="库位/条码" min-width="170">
            <template #default="{ row }: { row: WmsOperationTaskLine }">
              <div class="primary-cell">
                <strong>{{ row.locationCode || '-' }}</strong>
                <span>{{ row.barcode || row.containerCode || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column align="right" label="完成/预占/计划" width="170">
            <template #default="{ row }: { row: WmsOperationTaskLine }">
              {{ progressText(row) }}
            </template>
          </el-table-column>
          <el-table-column label="行状态" width="120">
            <template #default="{ row }: { row: WmsOperationTaskLine }">
              <el-tag :type="statusType(row.lineStatus)" effect="plain">{{ statusLabel(row.lineStatus) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="240">
            <template #default="{ row }: { row: WmsOperationTaskLine }">
              <div class="line-actions">
                <el-button
                  :disabled="currentTask?.taskStatus === 'WMS_POSTED'"
                  :icon="Box"
                  text
                  type="primary"
                  @click="openReserveDialog(row)"
                >
                  预占
                </el-button>
                <el-button
                  v-if="canRecordIncomingInspection(currentTask, row)"
                  :icon="Check"
                  text
                  type="success"
                  @click="openInspectionDialog(row)"
                >
                  检验
                </el-button>
                <el-button
                  :disabled="!canConvertLineToErp(currentTask, row)"
                  :icon="Upload"
                  :loading="convertLoadingLineId === row.id"
                  text
                  type="warning"
                  @click="handleConvertToErp(row)"
                >
                  下推ERP
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <el-dialog v-model="reserveVisible" title="库位预占" width="560px">
      <el-form :model="reserveForm" label-width="96px">
        <el-form-item label="任务行">
          <el-input-number v-model="reserveForm.taskLineId" :controls="false" disabled class="full-control" />
        </el-form-item>
        <el-form-item label="库位编码">
          <el-input v-model="reserveForm.locationCode" placeholder="扫描或录入库位" />
        </el-form-item>
        <el-form-item label="库位名称">
          <el-input v-model="reserveForm.locationName" placeholder="可选" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="reserveForm.qty" :min="0" class="full-control" />
        </el-form-item>
        <el-form-item label="条码">
          <el-input v-model="reserveForm.barcode" placeholder="物料/箱/托条码，可选" />
        </el-form-item>
        <el-form-item label="容器">
          <el-input v-model="reserveForm.containerCode" placeholder="容器编码，可选" />
        </el-form-item>
        <el-form-item label="设备">
          <el-input v-model="reserveForm.deviceNo" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="reserveForm.remark" :rows="2" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reserveVisible = false">取消</el-button>
        <el-button :loading="reserveLoading" type="primary" @click="handleReserve">确认预占</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectionVisible" title="录入来料检验结果" width="520px">
      <el-alert
        :closable="false"
        class="inspection-hint"
        show-icon
        title="合格数量放行入库，判退数量将自动生成采购退料任务（检验退料）。"
        type="info"
      />
      <el-form :model="inspectionForm" label-width="96px">
        <el-form-item label="物料">
          <span>{{ inspectionLine?.materialCode }} {{ inspectionLine?.materialName }}</span>
        </el-form-item>
        <el-form-item label="计划数量">
          <span>{{ inspectionPlanQty }}</span>
        </el-form-item>
        <el-form-item label="合格数量">
          <el-input-number v-model="inspectionForm.qualifiedQty" :min="0" class="full-control" />
        </el-form-item>
        <el-form-item label="判退数量">
          <el-input-number v-model="inspectionForm.rejectedQty" :min="0" class="full-control" />
        </el-form-item>
        <el-form-item label="合计">
          <el-tag :type="inspectionQtyMatches ? 'success' : 'danger'" effect="plain">
            {{ inspectionTotalQty }} / {{ inspectionPlanQty }}
          </el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectionVisible = false">取消</el-button>
        <el-button
          :disabled="!inspectionQtyMatches"
          :loading="inspectionLoading"
          type="primary"
          @click="handleCompleteInspection"
        >
          提交检验结果
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.inspection-hint {
  margin-bottom: 12px;
}

.wms-task-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.page-header,
.toolbar,
.detail-meta,
.drawer-actions,
.header-actions {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  margin: 6px 0 0;
  color: var(--el-text-color-regular);
}

.metric-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
}

.metric-tile {
  min-height: 76px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.metric-tile span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.metric-tile strong {
  display: block;
  margin-top: 8px;
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.tone-primary {
  border-color: var(--el-color-primary-light-7);
}

.tone-success {
  border-color: var(--el-color-success-light-7);
}

.tone-warning {
  border-color: var(--el-color-warning-light-7);
}

.tone-danger {
  border-color: var(--el-color-danger-light-7);
}

.tone-stable {
  border-color: var(--el-border-color-light);
}

.toolbar {
  flex-wrap: wrap;
  gap: 10px;
}

.pager {
  justify-content: flex-end;
}

.toolbar .el-input {
  max-width: 360px;
}

.toolbar .el-select {
  width: 180px;
}

.primary-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.primary-cell span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-meta {
  flex-wrap: wrap;
  gap: 10px 18px;
  color: var(--el-text-color-regular);
}

.drawer-actions {
  justify-content: flex-end;
}

.full-control {
  width: 100%;
}

@media (max-width: 900px) {
  .page-header,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .toolbar .el-input,
  .toolbar .el-select {
    width: 100%;
    max-width: none;
  }
}
</style>
