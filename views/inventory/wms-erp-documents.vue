<script lang="ts" setup>
import type {
  WmsBusinessChainDetail,
  WmsErpDocument,
  WmsErpDocumentCapability,
  WmsErpDocumentLine,
  WmsErpDocumentRegistration,
  WmsErpDocumentSummaryRow,
  WmsErpDocumentSyncPayload,
  WmsOperationTaskStatus,
} from '#/api/wms';

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { CirclePlus, DocumentAdd, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import {
  getWmsErpDocument,
  getWmsErpDocumentChain,
  getWmsErpDocumentPage,
  getWmsErpDocumentRegistrations,
  getWmsErpDocumentSummary,
  orchestrateWmsErpDocument,
  syncWmsErpDocument,
} from '#/api/wms';
import { useErpAcctStore } from '#/store';

import {
  countByCapability,
  resolveFormIdFilter,
  summariseDocumentCenter,
} from './erp-document-center-query';

defineOptions({ name: 'WmsErpDocuments' });

const erpAcctStore = useErpAcctStore();

const loading = ref(false);
const syncLoading = ref(false);
const detailLoading = ref(false);
const syncVisible = ref(false);
const detailVisible = ref(false);
const taskLoadingRowId = ref<number | null>(null);

const documents = ref<WmsErpDocument[]>([]);
const registrations = ref<WmsErpDocumentRegistration[]>([]);
const currentDocument = ref<WmsErpDocument | null>(null);
const currentChain = ref<WmsBusinessChainDetail | null>(null);

const filters = reactive({
  erpAcctCode: '',
  formId: '',
  keyword: '',
  priority: '',
  wmsStatus: '',
});

/**
 * 分页与过滤**全部在服务端**。
 *
 * 改造前这页拉全量（`getWmsErpDocuments` 无分页）再在浏览器里做 5 字段过滤 ——
 * 实测 1332 张单据的响应是 1.41MB。现在与作业台共用 `/wms/erp-documents` 的
 * 分页端点，响应降到 53KB 级。
 */
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);

/** 服务端分组计数，指标卡的数据源。见 `erp-document-center-query.ts`。 */
const summaryRows = ref<WmsErpDocumentSummaryRow[]>([]);

/** 只看可作业（`available_qty > 0`）。本页是全局单据中心，默认关 —— 它的用途包含追溯。 */
const actionableOnly = ref(false);

/** 250ms 防抖：搜索框每敲一个字符都发请求会打满后端。 */
let keywordTimer: null | ReturnType<typeof setTimeout> = null;

const syncForm = reactive<WmsErpDocumentSyncPayload>({
  billNo: '',
  documentStatus: 'AUDITED',
  erpAcctCode: erpAcctStore.acctCode || '',
  erpOrgNumber: '',
  formId: 'PRD_PickMtrl',
  lines: [
    {
      lineSeq: 1,
      materialCode: '',
      qty: 1,
      unitName: 'PCS',
    },
  ],
  stockNumber: '',
});

/**
 * 指标卡。**判据分两类，来源不同**：
 *
 * - `total` / `actionable` / `failed`：落在真实列（count / available_qty / wms_status），
 *   由 SQL 分组聚合直接给出
 * - `生产主链路(P0)` / `可生成任务`：判据是 priority / capability，而它们来自
 *   `WmsErpDocumentRegistryService` 的**内存注册表**，SQL 不知道它们的存在。
 *   做法是把 formId 分组结果穿过注册表映射（`countByCapability`）——
 *   后端零改动，注册表保持唯一真相，计数仍覆盖全表而非当前页
 *
 * 落库 priority/capability 等于制造第二份真相：注册表每改一次就要配一次回填迁移。
 */
const metrics = computed(() => {
  const counts = summariseDocumentCenter(summaryRows.value);
  const p0FormIds = new Set(
    registrations.value.filter((item) => item.priority === 'P0').map((item) => item.formId),
  );
  const p0 = summaryRows.value.reduce(
    (sum, row) => (row.formId && p0FormIds.has(row.formId) ? sum + (Number(row.count) || 0) : sum),
    0,
  );
  const taskReady = countByCapability(summaryRows.value, registrations.value, 'WMS_TASK');
  return [
    { key: 'total', label: '镜像单据', tone: 'primary', value: counts.total },
    { key: 'actionable', label: '可作业', tone: 'success', value: counts.actionable },
    { key: 'p0', label: '生产主链路', tone: 'primary', value: p0 },
    { key: 'task', label: '可生成任务', tone: 'stable', value: taskReady },
    {
      key: 'failed',
      label: 'ERP失败',
      tone: counts.failed ? 'danger' : 'stable',
      value: counts.failed,
    },
  ];
});

const selectedRegistration = computed(() => (
  registrations.value.find((item) => item.formId === syncForm.formId)
));

/**
 * 拉当前页单据。
 *
 * `priority` 过滤翻译成 formId 集合再下推 —— 它不是数据库列，
 * 但是 formId 的纯函数，见 `resolveFormIdFilter` 的注释。
 */
async function loadDocuments() {
  loading.value = true;
  try {
    const formIds = resolveFormIdFilter(registrations.value, filters.priority, filters.formId);
    const response = await getWmsErpDocumentPage({
      actionableOnly: actionableOnly.value || undefined,
      erpAcctCode: filters.erpAcctCode || undefined,
      formId: formIds ? formIds.join(',') : undefined,
      keyword: filters.keyword.trim() || undefined,
      page: currentPage.value,
      size: pageSize.value,
      wmsStatus: filters.wmsStatus || undefined,
    });
    if (!response.success) throw new Error(response.message || '获取ERP单据镜像失败');
    documents.value = response.data || [];
    total.value = response.total ?? documents.value.length;
  } catch (error: any) {
    ElMessage.error(error.message || '加载WMS单据中心失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 拉分组计数。**不吃 keyword / status / priority** ——
 * 指标卡要显示的是"总共有多少"，跟着筛选条件变会让用户失去基准。
 */
async function loadSummary() {
  try {
    const response = await getWmsErpDocumentSummary({
      erpAcctCode: filters.erpAcctCode || undefined,
    });
    if (!response.success) throw new Error(response.message || '获取单据统计失败');
    summaryRows.value = response.data || [];
  } catch (error: any) {
    ElMessage.error(error.message || '获取单据统计失败');
  }
}

/**
 * 注册表只需拉一次 —— 它是后端内存常量（`WmsErpDocumentRegistryService` 里
 * 硬编码的 register 调用），进程内不会变。每次刷新都拉是白费一个 RTT。
 */
async function loadRegistrations() {
  if (registrations.value.length > 0) return;
  try {
    const response = await getWmsErpDocumentRegistrations();
    if (!response.success) throw new Error(response.message || '获取单据注册表失败');
    registrations.value = Object.values(response.data || {});
  } catch (error: any) {
    ElMessage.error(error.message || '获取单据注册表失败');
  }
}

/**
 * 注册表必须先到 —— `loadDocuments` 要用它把 priority 翻译成 formId，
 * 没有它的话 priority 过滤会静默失效（`resolveFormIdFilter` 在空注册表上返回 null）。
 * 列表与统计之间无依赖，并行拉。
 */
async function loadData() {
  await loadRegistrations();
  await Promise.all([loadDocuments(), loadSummary()]);
}

function openSyncDialog() {
  syncVisible.value = true;
}

function addLine() {
  syncForm.lines.push({
    lineSeq: syncForm.lines.length + 1,
    materialCode: '',
    qty: 1,
    unitName: syncForm.lines[0]?.unitName || 'PCS',
  });
}

function removeLine(index: number) {
  if (syncForm.lines.length === 1) {
    ElMessage.warning('至少保留一行物料');
    return;
  }
  syncForm.lines.splice(index, 1);
  syncForm.lines.forEach((line, lineIndex) => {
    line.lineSeq = lineIndex + 1;
  });
}

async function handleSync() {
  if (!syncForm.formId || !syncForm.billNo) {
    ElMessage.warning('请填写formId和单号');
    return;
  }
  if (syncForm.lines.some((line) => !line.materialCode || !line.qty)) {
    ElMessage.warning('请补齐物料编码和数量');
    return;
  }
  syncLoading.value = true;
  try {
    const resp = await syncWmsErpDocument({
      ...syncForm,
      formName: selectedRegistration.value?.formName,
    });
    if (!resp.success) throw new Error(resp.message || '同步ERP单据镜像失败');
    ElMessage.success('ERP单据镜像已保存');
    syncVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(error.message || '同步ERP单据镜像失败');
  } finally {
    syncLoading.value = false;
  }
}

async function openDetail(row: WmsErpDocument) {
  detailVisible.value = true;
  currentDocument.value = row;
  currentChain.value = null;
  await refreshDetail(row.id);
}

async function refreshDetail(documentId: number) {
  detailLoading.value = true;
  try {
    const [resp, chainResp] = await Promise.all([
      getWmsErpDocument(documentId),
      getWmsErpDocumentChain(documentId),
    ]);
    if (!resp.success) throw new Error(resp.message || '获取单据明细失败');
    if (!chainResp.success) throw new Error(chainResp.message || '获取链路明细失败');
    currentDocument.value = resp.data;
    currentChain.value = chainResp.data;
  } catch (error: any) {
    ElMessage.error(error.message || '获取单据或链路明细失败');
  } finally {
    detailLoading.value = false;
  }
}

async function handleOrchestrate(row: WmsErpDocument) {
  taskLoadingRowId.value = row.id;
  try {
    const resp = await orchestrateWmsErpDocument(row.id);
    if (!resp.success) throw new Error(resp.message || '推进WMS编排失败');
    // The chain gate reports CHAIN_BLOCKED instead of throwing, so a blocked document arrives
    // here as a successful response carrying the reasons.
    if (resp.data?.status === 'CHAIN_BLOCKED') {
      const reasons = (resp.data.blockReasons || []).map(blockReasonLabel).join('；');
      ElMessage.warning(reasons ? `链路未就绪：${reasons}` : resp.data.message || '链路未就绪');
    } else {
      ElMessage.success(resp.data?.message || (resp.data?.taskId ? 'WMS任务已生成' : 'WMS编排已推进'));
    }
    await loadData();
    if (detailVisible.value && currentDocument.value?.id === row.id) {
      await refreshDetail(row.id);
    }
  } catch (error: any) {
    ElMessage.error(error.message || '推进WMS编排失败');
  } finally {
    taskLoadingRowId.value = null;
  }
}

/** Turns `INSPECTION_PENDING:CGSL-001` into `待检验（CGSL-001）`. */
function blockReasonLabel(reason: string) {
  const [code = '', billNo = ''] = reason.split(':');
  const map: Record<string, string> = {
    CHAIN_BLOCKED: '链路阻塞',
    INSPECTION_PENDING: '待检验',
    INSPECTION_REJECTED: '检验判退',
    NO_AVAILABLE_QTY: '无可执行数量',
    UPSTREAM_NOT_READY: '上游未就绪',
  };
  const label = map[code] || code;
  return billNo ? `${label}（${billNo}）` : label;
}

function canOrchestrate(row: WmsErpDocument) {
  return row.wmsStatus !== 'WMS_POSTED';
}

function capabilityLabel(capability: WmsErpDocumentCapability) {
  const map: Record<WmsErpDocumentCapability, string> = {
    ADJUSTMENT_SUGGESTION: '调整建议',
    DEFERRED: '暂缓',
    ERP_PUSH: '反写',
    MANUAL_CONFIRMATION: '人工确认',
    MES_CREATE: 'MES创建',
    READ_ONLY: '只读',
    WMS_TASK: 'WMS任务',
  };
  return map[capability] || capability;
}

function operationModeLabel(mode?: string) {
  const map: Record<string, string> = {
    ADJUSTMENT_TASK: '调整任务',
    INBOUND_TASK: '入库任务',
    MANUAL_CONFIRMATION: '人工确认',
    MOVE_TASK: '移库任务',
    OUTBOUND_TASK: '出库任务',
    READ_ONLY: '只读追踪',
  };
  return mode ? map[mode] || mode : '-';
}

function chainRoleLabel(role?: string) {
  const map: Record<string, string> = {
    EXECUTION_DOCUMENT: '执行单据',
    INSPECTION: '检验节点',
    MANUAL_CONFIRMATION: '人工边界',
    NOTICE: '通知节点',
    READ_ONLY: '只读节点',
  };
  return role ? map[role] || role : '-';
}

function chainStageLabel(stage?: string) {
  const map: Record<string, string> = {
    BLOCKED: '阻塞',
    COMPLETED: '完成',
    EXECUTABLE: '可执行',
    INSPECTION: '检验',
    INSTOCK: '入库',
    NOTICE: '通知',
    OUTSTOCK: '出库',
    RETURN: '退料',
  };
  return stage ? map[stage] || stage : '-';
}

function inspectionStatusLabel(status?: string) {
  const map: Record<string, string> = {
    ACCEPTED: '已接收',
    BLOCKED: '已阻塞',
    CONDITIONAL_ACCEPTED: '让步接收',
    INSPECTING: '检验中',
    PARTIAL_ACCEPTED: '部分合格',
    PENDING_INSPECTION: '待检验',
    REJECTED: '已拒收',
  };
  return status ? map[status] || status : '-';
}

function nextActionLabel(action?: string) {
  const map: Record<string, string> = {
    MANUAL_CONFIRM_ON_PC: 'PC确认',
    SCAN_COUNT_AND_CONFIRM: '扫码盘点',
    SCAN_FROM_TO_LOCATION: '扫码移库',
    SCAN_SOURCE_LOCATION_RESERVE_SUBMIT: '扫码预占提交',
    SCAN_TARGET_LOCATION_AND_SUBMIT: '扫码入库提交',
    VIEW_ONLY: '只读查看',
  };
  return action ? map[action] || action : '-';
}

function priorityType(priority?: string) {
  const map: Record<string, string> = {
    P0: 'danger',
    P1: 'warning',
    P2: 'primary',
    P3: 'info',
  };
  return map[priority || ''] || 'info';
}

function statusLabel(status?: WmsOperationTaskStatus) {
  const map: Record<WmsOperationTaskStatus, string> = {
    BLOCKED: '已阻塞',
    CLAIMED: '已认领',
    EXECUTING: '执行中',
    READY: '待执行',
    REVERSED: '已反转',
    TRANSFER_PENDING: '待直调',
    WAIT_QC: '待质检',
    WAIT_ROUTE: '待路由',
    CANCELLED: '已取消',
    ERP_AUDITED: 'ERP已审核',
    ERP_DRAFT: 'ERP草稿',
    ERP_FAILED: 'ERP失败',
    ERP_SUBMITTED: 'ERP已提交',
    ERP_SYNCED: '已同步',
    OPERATING: '作业中',
    RESERVED: '已预占',
    TASK_CREATED: '已建任务',
    WMS_POSTED: 'WMS已过账',
  };
  return status ? map[status] : '-';
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
    ERP_FAILED: 'danger',
    ERP_SYNCED: 'info',
    OPERATING: 'warning',
    RESERVED: 'warning',
    TASK_CREATED: 'primary',
    WMS_POSTED: 'success',
  };
  return status ? map[status] || 'info' : 'info';
}

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

// ⚠️ 这两行必须在下面 watch 注册**之前** —— 它们是同步赋值，
// 放在 watch 之后会立刻触发一次多余的请求（onMounted 只注册回调，不立即执行，
// 所以原本放在 onMounted 之后也能正确生效，但对 watch 不成立）。
filters.erpAcctCode = erpAcctStore.acctCode || '';
syncForm.erpAcctCode = erpAcctStore.acctCode || '';

// 换筛选条件或页大小都要回到第 1 页再查：停在第 20 页发请求会得到空结果。
watch(
  [
    () => filters.formId,
    () => filters.priority,
    () => filters.wmsStatus,
    actionableOnly,
    pageSize,
  ],
  () => {
    currentPage.value = 1;
    void loadDocuments();
  },
);
watch(currentPage, () => {
  void loadDocuments();
});
// 搜索走服务端，防抖 250ms
watch(
  () => filters.keyword,
  () => {
    if (keywordTimer) clearTimeout(keywordTimer);
    keywordTimer = setTimeout(() => {
      currentPage.value = 1;
      void loadDocuments();
    }, 250);
  },
);
onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer);
});

onMounted(loadData);
</script>

<template>
  <div class="wms-document-page">
    <section class="page-header">
      <div>
        <p class="eyebrow">WMS / ERP Documents</p>
        <h1>ERP单据中心</h1>
        <p class="subtitle">按单据镜像追踪WMS任务生成、ERP状态和异常信息。</p>
      </div>
      <div class="header-actions">
        <el-button :icon="DocumentAdd" @click="openSyncDialog">同步镜像</el-button>
        <el-button :icon="Refresh" :loading="loading" type="primary" @click="loadData">刷新</el-button>
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
      <el-input
        v-model="filters.keyword"
        :prefix-icon="Search"
        clearable
        placeholder="搜索单号、formId、仓库、源单"
      />
      <el-select v-model="filters.formId" clearable filterable placeholder="单据类型">
        <el-option
          v-for="item in registrations"
          :key="item.formId"
          :label="`${item.formId} / ${item.formName}`"
          :value="item.formId"
        />
      </el-select>
      <el-select v-model="filters.priority" clearable placeholder="优先级">
        <el-option label="P0 生产主链路" value="P0" />
        <el-option label="P1 上下游" value="P1" />
        <el-option label="P2 调整建议" value="P2" />
        <el-option label="P3 暂缓" value="P3" />
      </el-select>
      <el-select v-model="filters.wmsStatus" clearable placeholder="WMS状态">
        <el-option label="已同步" value="ERP_SYNCED" />
        <el-option label="已建任务" value="TASK_CREATED" />
        <el-option label="已预占" value="RESERVED" />
        <el-option label="WMS已过账" value="WMS_POSTED" />
        <el-option label="ERP失败" value="ERP_FAILED" />
      </el-select>
      <!-- 本页默认关：它是全局单据中心，用途包含追溯已闭环单据。
           作业台（采购收料）那边默认开，因为那里只关心待办。 -->
      <el-tooltip
        content="只看还有待作业数量的单据。关闭后包含 ERP 侧已闭环、仅供追溯的历史单据"
        placement="top"
      >
        <el-switch v-model="actionableOnly" class="actionable-switch" active-text="仅看可作业" />
      </el-tooltip>
    </section>

    <el-table v-loading="loading" :data="documents" border class="data-table" row-key="id">
      <el-table-column label="ERP单据" min-width="230">
        <template #default="{ row }: { row: WmsErpDocument }">
          <div class="primary-cell">
            <strong>{{ row.billNo || '-' }}</strong>
            <span>{{ row.formId }} / {{ row.formName || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="分层" width="90">
        <template #default="{ row }: { row: WmsErpDocument }">
          <el-tag :type="priorityType(row.priority)" effect="plain">{{ row.priority || '-' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="能力" min-width="210">
        <template #default="{ row }: { row: WmsErpDocument }">
          <div class="tag-row">
            <el-tag
              v-for="capability in row.capabilities || []"
              :key="capability"
              effect="plain"
              size="small"
              :type="capability === 'DEFERRED' ? 'info' : capability === 'WMS_TASK' ? 'success' : 'primary'"
            >
              {{ capabilityLabel(capability) }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="执行模式" min-width="190">
        <template #default="{ row }: { row: WmsErpDocument }">
          <div class="primary-cell">
            <strong>{{ operationModeLabel(row.operationMode) }}</strong>
            <span>{{ nextActionLabel(row.mobileNextAction) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="ERP状态" prop="documentStatus" width="110" />
      <el-table-column label="链路" min-width="180">
        <template #default="{ row }: { row: WmsErpDocument }">
          <div class="primary-cell">
            <strong>{{ chainRoleLabel(row.documentRole) }}</strong>
            <span>{{ chainStageLabel(row.businessStage) }} / {{ inspectionStatusLabel(row.inspectionStatus) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="WMS状态" width="120">
        <template #default="{ row }: { row: WmsErpDocument }">
          <el-tag :type="statusType(row.wmsStatus)" effect="light">{{ statusLabel(row.wmsStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="仓库" min-width="170">
        <template #default="{ row }: { row: WmsErpDocument }">
          {{ [row.stockNumber, row.stockName].filter(Boolean).join(' / ') || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="账套/组织" min-width="150">
        <template #default="{ row }: { row: WmsErpDocument }">
          {{ [row.erpAcctCode, row.erpOrgNumber].filter(Boolean).join(' / ') || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="源单" min-width="150">
        <template #default="{ row }: { row: WmsErpDocument }">
          {{ row.sourceBillNo || row.sourceFormId || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="同步时间" width="180">
        <template #default="{ row }: { row: WmsErpDocument }">
          {{ formatTime(row.lastSyncTime) }}
        </template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="180" show-overflow-tooltip>
        <template #default="{ row }: { row: WmsErpDocument }">
          {{ row.lastError || row.erpError || '-' }}
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="210">
        <template #default="{ row }: { row: WmsErpDocument }">
          <el-button :icon="View" text type="primary" @click="openDetail(row)">明细</el-button>
          <el-button
            :disabled="!canOrchestrate(row)"
            :icon="CirclePlus"
            :loading="taskLoadingRowId === row.id"
            text
            type="success"
            @click="handleOrchestrate(row)"
          >
            推进
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      class="pager"
      :total="total"
      :page-sizes="[20, 50, 100, 200]"
      layout="total, sizes, prev, pager, next, jumper"
      background
    />

    <el-dialog v-model="syncVisible" title="同步ERP单据镜像" width="920px">
      <el-form :model="syncForm" label-width="100px">
        <div class="form-grid">
          <el-form-item label="单据类型">
            <el-select v-model="syncForm.formId" filterable>
              <el-option
                v-for="item in registrations"
                :key="item.formId"
                :label="`${item.formId} / ${item.formName}`"
                :value="item.formId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="单号">
            <el-input v-model="syncForm.billNo" placeholder="ERP单号" />
          </el-form-item>
          <el-form-item label="FID">
            <el-input-number v-model="syncForm.fid" :controls="false" class="full-control" />
          </el-form-item>
          <el-form-item label="ERP状态">
            <el-input v-model="syncForm.documentStatus" />
          </el-form-item>
          <el-form-item label="账套">
            <el-input v-model="syncForm.erpAcctCode" placeholder="ERP账套编码" />
          </el-form-item>
          <el-form-item label="组织">
            <el-input v-model="syncForm.erpOrgNumber" placeholder="ERP组织编码" />
          </el-form-item>
          <el-form-item label="仓库">
            <el-input v-model="syncForm.stockNumber" placeholder="仓库编码" />
          </el-form-item>
        </div>

        <div class="line-header">
          <strong>单据行</strong>
          <el-button :icon="CirclePlus" text type="primary" @click="addLine">新增行</el-button>
        </div>
        <div v-for="(line, index) in syncForm.lines" :key="index" class="sync-line">
          <el-input-number v-model="line.lineSeq" :controls="false" class="seq-input" />
          <el-input v-model="line.materialCode" placeholder="物料编码" />
          <el-input v-model="line.materialName" placeholder="物料名称" />
          <el-input v-model="line.lotNo" placeholder="批次" />
          <el-input-number v-model="line.qty" :min="0" class="qty-input" />
          <el-input v-model="line.unitName" placeholder="单位" />
          <el-button text type="danger" @click="removeLine(index)">移除</el-button>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="syncVisible = false">取消</el-button>
        <el-button :loading="syncLoading" type="primary" @click="handleSync">保存镜像</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="currentDocument?.billNo || '单据明细'" size="70%">
      <div v-loading="detailLoading">
        <div class="detail-meta">
          <span>formId：{{ currentDocument?.formId || '-' }}</span>
          <span>FID：{{ currentDocument?.fid || '-' }}</span>
          <span>账套：{{ currentDocument?.erpAcctCode || '-' }}</span>
          <span>组织：{{ currentDocument?.erpOrgNumber || '-' }}</span>
          <span>状态：{{ statusLabel(currentDocument?.wmsStatus) }}</span>
          <span>仓库：{{ currentDocument?.stockNumber || '-' }}</span>
          <span>模式：{{ operationModeLabel(currentDocument?.operationMode) }}</span>
          <span>移动端：{{ nextActionLabel(currentDocument?.mobileNextAction) }}</span>
          <span>链路角色：{{ chainRoleLabel(currentDocument?.documentRole) }}</span>
          <span>链路阶段：{{ chainStageLabel(currentDocument?.businessStage) }}</span>
          <span>检验：{{ inspectionStatusLabel(currentDocument?.inspectionStatus) }}</span>
        </div>
        <el-alert
          v-if="currentDocument?.erpError || currentDocument?.lastError"
          :closable="false"
          :title="currentDocument?.lastError || currentDocument?.erpError || ''"
          show-icon
          type="error"
        />
        <el-card v-if="currentChain" class="chain-card" shadow="never">
          <template #header>
            <div class="chain-header">
              <strong>业务链路</strong>
              <span>{{ currentChain.businessChainType || '-' }} / {{ currentChain.chainStatus || '-' }}</span>
            </div>
          </template>
          <div class="chain-metrics">
            <span>通知数：{{ formatNumber(currentChain.chainQuantities?.noticeQty) }}</span>
            <span>可执行：{{ formatNumber(currentChain.chainQuantities?.availableQty) }}</span>
            <span>合格：{{ formatNumber(currentChain.chainQuantities?.acceptedQty) }}</span>
            <span>拒收：{{ formatNumber(currentChain.chainQuantities?.rejectedQty) }}</span>
            <span>阻塞：{{ formatNumber(currentChain.chainQuantities?.blockedQty) }}</span>
          </div>
          <div v-if="currentChain.blockReasons?.length" class="tag-row">
            <el-tag v-for="reason in currentChain.blockReasons" :key="reason" type="danger" effect="plain">
              {{ reason }}
            </el-tag>
          </div>
          <el-table :data="currentChain.chainNodes || []" border>
            <el-table-column prop="billNo" label="节点单号" min-width="180" />
            <el-table-column label="角色" width="120">
              <template #default="{ row }">{{ chainRoleLabel(row.documentRole) }}</template>
            </el-table-column>
            <el-table-column label="阶段" width="120">
              <template #default="{ row }">{{ chainStageLabel(row.businessStage) }}</template>
            </el-table-column>
            <el-table-column label="检验" width="120">
              <template #default="{ row }">{{ inspectionStatusLabel(row.inspectionStatus) }}</template>
            </el-table-column>
            <el-table-column label="可执行" width="110">
              <template #default="{ row }">{{ formatNumber(row.availableQty) }}</template>
            </el-table-column>
            <el-table-column label="合格/拒收" width="150">
              <template #default="{ row }">{{ formatNumber(row.acceptedQty) }} / {{ formatNumber(row.rejectedQty) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
        <el-table :data="currentDocument?.lines || []" border>
          <el-table-column label="行号" prop="lineSeq" width="80" />
          <el-table-column label="EntryId" prop="sourceEntryId" width="120" />
          <el-table-column label="物料" min-width="220">
            <template #default="{ row }: { row: WmsErpDocumentLine }">
              <div class="primary-cell">
                <strong>{{ row.materialCode || '-' }}</strong>
                <span>{{ row.materialName || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="批次" prop="lotNo" width="130" />
          <el-table-column label="仓库" min-width="160">
            <template #default="{ row }: { row: WmsErpDocumentLine }">
              {{ [row.stockNumber, row.stockName].filter(Boolean).join(' / ') || '-' }}
            </template>
          </el-table-column>
          <el-table-column align="right" label="数量" width="130">
            <template #default="{ row }: { row: WmsErpDocumentLine }">
              {{ formatNumber(row.qty) }} {{ row.unitName || '' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.wms-document-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.page-header,
.toolbar,
.line-header,
.detail-meta,
.header-actions,
.tag-row {
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

.header-actions {
  gap: 8px;
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

.toolbar .el-input {
  max-width: 320px;
}

.toolbar .el-select {
  width: 180px;
}

/* 开关不参与 el-select 的定宽，且靠右与筛选组分开 */
.actionable-switch {
  flex-shrink: 0;
  margin-left: auto;
}

.data-table {
  width: 100%;
}

.pager {
  justify-content: flex-end;
}

.primary-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.chain-card {
  margin: 12px 0;
}

.chain-header,
.chain-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}

.chain-header {
  justify-content: space-between;
}

.primary-cell span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row {
  flex-wrap: wrap;
  gap: 6px;
}

.form-grid {
  display: grid;
  gap: 0 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.full-control,
.form-grid .el-select {
  width: 100%;
}

.line-header {
  justify-content: space-between;
  margin: 8px 0 10px;
}

.sync-line {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: 72px minmax(130px, 1fr) minmax(130px, 1fr) 120px 130px 96px 72px;
  margin-bottom: 8px;
}

.seq-input,
.qty-input {
  width: 100%;
}

.detail-meta {
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
}

@media (max-width: 900px) {
  .page-header,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .sync-line {
    grid-template-columns: 1fr;
  }

  .toolbar .el-input,
  .toolbar .el-select {
    width: 100%;
    max-width: none;
  }
}
</style>
