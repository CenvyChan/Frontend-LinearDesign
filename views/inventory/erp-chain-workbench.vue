<script lang="ts" setup>
import type {
  WmsErpDocument,
  WmsErpDocumentLine,
  WmsOperationTask,
  WmsOperationTaskLine,
} from '#/api/wms';
import type { ErpChainKey } from './erp-chain-preset';

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { Check, Promotion, Refresh, Search, Upload, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import {
  completeWmsTaskLine,
  getWmsErpDocument,
  getWmsErpDocumentPage,
  getWmsErpDocumentSummary,
  getWmsTask,
  getWmsTasks,
  orchestrateWmsErpDocument,
} from '#/api/wms';
import { useErpAcctStore } from '#/store';

import IncomingInspectionDialog from './components/IncomingInspectionDialog.vue';
import {
  canRecordIncomingInspection,
  missingErpConversionDimensions,
} from './wms-task-action-model';

import { businessTypeLabel, businessTypeTagType, isOutOfScopeBusinessType } from './erp-business-type';
import {
  blockReasonLabel,
  chainPreset,
  stageLabel,
  summariseChainMetrics,
  type ChainSummaryRow,
} from './erp-chain-preset';

/**
 * ERP 业务链路作业台。销售发货与采购收料共用这一份，差异全在 `erp-chain-preset.ts`。
 *
 * 刻意不提供「手工造单」：单据来自 ERP 同步，手工造一张 ERP 里不存在的通知单
 * 会让后续下推、回写全部失败。销售发货页原先有这个入口，是给早期无 ERP 联调时用的。
 */
defineOptions({ name: 'ErpChainWorkbench' });

const props = defineProps<{ chain: ErpChainKey }>();

const preset = computed(() => chainPreset(props.chain));

const erpAcctStore = useErpAcctStore();
const loading = ref(false);
const detailVisible = ref(false);
/** 明细行单独 loading：表头来自列表行、打开即有，只有 lines 需要等请求 */
const detailLoading = ref(false);
const dispatchingId = ref<number>();
const documents = ref<WmsErpDocument[]>([]);
const currentDocument = ref<WmsErpDocument>();

const filters = reactive({
  businessType: '',
  erpAcctCode: erpAcctStore.acctCode || '',
  keyword: '',
  stage: '',
  status: '',
});

/**
 * 只看可作业（`available_qty > 0`）。初值按链路取，见 preset 的 defaultActionableOnly。
 *
 * 采购收料默认开：实测 1332 张里 97.7% 是 ERP 侧已闭环的历史单据，
 * 默认显示全部等于让用户在 1332 张里找那 30 张。
 */
const actionableOnly = ref(preset.value.defaultActionableOnly);

/**
 * 分页与过滤**全部在服务端**。
 *
 * 2026-08-27 实测：不分页时该端点返回 1.41 MB / 1332 行，服务端只花 0.089s，
 * 瓶颈全在浏览器渲染（1332 行 × 8 列，其中 3 列是 el-tag，约 4000 个组件实例）。
 *
 * ⚠️ **服务端过滤后不再做任何客户端过滤。** 两处判据漂移会表现为
 * "第 1 页搜得到、翻页后消失"，比只在一侧过滤更难查。链路过滤靠传 formId 多值实现。
 */
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);

/** 搜索防抖：每次击键都发请求会打满后端。250ms 是「打字停顿」的经验阈值。 */
let keywordTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => filters.keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => {
    currentPage.value = 1;
    void loadDocuments();
  }, 250);
});
// 组件卸载时清掉未触发的定时器，否则它会在卸载后对一个已销毁的组件发请求
onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer);
});

// 换筛选条件或页大小都要回到第 1 页再查：停在第 20 页发请求会得到空结果。
watch(
  [() => filters.stage, () => filters.status, () => filters.businessType, actionableOnly, pageSize],
  () => {
    currentPage.value = 1;
    void loadDocuments();
  },
);
watch(currentPage, () => {
  void loadDocuments();
});

/**
 * 指标卡走独立的服务端聚合端点。
 *
 * 分页后客户端只有当前页 50 行，本地遍历算出的是"本页统计"——
 * 用户会看到「收料单据 50」而实际 1332 条，且错得不明显。
 * 折叠语义（哪个 formId 算待推进、哪些 businessType 不参与）仍留在前端，
 * 避免同一套判据两地维护。
 */
const summaryRows = ref<ChainSummaryRow[]>([]);

const metrics = computed(() => {
  const p = preset.value;
  const counts = summariseChainMetrics(p, summaryRows.value, isOutOfScopeBusinessType);
  return [
    // 首卡给双基准：主数字是「可作业」（用户真正要处理的），副文案给累计量保住全局感。
    // 只给累计会让人以为有 1332 件待办；只给可作业会让人以为数据丢了。
    {
      label: p.actionableLabel,
      value: counts.actionable,
      hint: `累计 ${counts.total}`,
      tone: 'warning',
    },
    { label: p.pendingLabel, value: counts.pending, tone: 'primary' },
    { label: '作业进行中', value: counts.inProgress, tone: 'primary' },
    { label: p.doneLabel, value: counts.done, tone: 'success' },
  ];
});

async function loadDocuments() {
  loading.value = true;
  try {
    const response = await getWmsErpDocumentPage({
      // 只在开启时传：端点默认 false，传 false 与不传等价，少一个查询参数更干净
      actionableOnly: actionableOnly.value || undefined,
      businessStage: filters.stage || undefined,
      businessType: filters.businessType || undefined,
      erpAcctCode: filters.erpAcctCode || undefined,
      // 链路过滤下推到服务端：只分页不过滤会让"每页 50 行筛完只剩 3 行"。
      // chainType 是四条链路的真正区分键（QM_InspectBill 与 PUR_MRB 都被两条链路共用），
      // formId 兜住 business_chain_type 为 null 的老单据 —— 两个维度缺一不可。
      businessChainType: preset.value.chainTypes.join(','),
      formId: preset.value.formIds.join(','),
      keyword: filters.keyword.trim() || undefined,
      page: currentPage.value,
      size: pageSize.value,
      wmsStatus: filters.status || undefined,
    });
    if (!response.success) throw new Error(response.message || '获取单据失败');
    documents.value = response.data || [];
    total.value = response.total ?? 0;
  } catch (error: any) {
    ElMessage.error(error.message || '获取单据失败');
  } finally {
    loading.value = false;
  }
}

/** 指标卡的聚合。与列表分开请求：它不吃 keyword/stage/status，换筛选条件时不需要重拉。 */
async function loadSummary() {
  try {
    const response = await getWmsErpDocumentSummary({
      // 必须与列表用同一套过滤维度，否则指标卡的基准和列表对不上
      businessChainType: preset.value.chainTypes.join(','),
      erpAcctCode: filters.erpAcctCode || undefined,
      formId: preset.value.formIds.join(','),
    });
    if (!response.success) throw new Error(response.message || '获取统计失败');
    summaryRows.value = response.data || [];
  } catch (error: any) {
    // 统计失败不该挡住列表 —— 指标卡显示 0 比整页报错好
    ElMessage.warning(error.message || '获取统计失败');
  }
}

async function dispatchDocument(row: WmsErpDocument) {
  dispatchingId.value = row.id;
  try {
    const response = await orchestrateWmsErpDocument(row.id);
    if (!response.success) throw new Error(response.message || '推进任务失败');
    // 后端可能返回 CHAIN_BLOCKED 并带 blockReasons —— 那是"业务前置未满足"而非失败，
    // 直接把原因显示出来，否则用户只看到"已生成"却查不到任务。
    if (response.data?.status === 'CHAIN_BLOCKED') {
      const reasons = (response.data as any).blockReasons;
      ElMessage.warning(
        Array.isArray(reasons) && reasons.length > 0
          // 逐项翻成中文再拼 —— 原先直接 join 会把 UPSTREAM_NOT_READY:CGSL202608287541
          // 这样的机器可读串直接怼给用户看
          ? `业务链路前置未满足：${reasons.map((item: string) => blockReasonLabel(item)).join('；')}`
          : response.data?.message || '业务链路前置未满足',
      );
    } else {
      ElMessage.success(response.data?.message || '任务已生成');
    }
    // 统计也要刷：单据从「待收货」变成「已建任务」，不刷指标卡会停在旧值
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '推进任务失败');
  } finally {
    dispatchingId.value = undefined;
  }
}

/**
 * 打开详情抽屉。
 *
 * 先用列表行渲染表头再异步补明细（照 `wms-erp-documents.vue` 的 openDetail 模式）：
 * 列表行已含全部 41 个表头字段，只有 `lines` 需要补拉 —— 这样抽屉**打开就有内容**，
 * 明细单独 loading，比整个抽屉转圈体验好。
 *
 * 列表端点刻意不返回明细（那会让响应从 53KB 涨回 MB 级），所以这里必须单独请求。
 */
async function openDetail(row: WmsErpDocument) {
  detailVisible.value = true;
  currentDocument.value = row;
  // 明细与任务并发拉：任务只用于行动作，拉失败不该拖慢明细展示
  await Promise.all([refreshDetail(row.id), loadDocumentTasks(row)]);
}

async function refreshDetail(documentId: number) {
  detailLoading.value = true;
  try {
    const response = await getWmsErpDocument(documentId);
    if (!response.success) throw new Error(response.message || '获取单据明细失败');
    currentDocument.value = response.data;
  } catch (error: any) {
    // 明细拉失败不清空 currentDocument：表头（来自列表行）仍然有效，
    // 全清掉会让抽屉变空白，用户以为单据不存在
    ElMessage.error(error.message || '获取单据明细失败');
  } finally {
    detailLoading.value = false;
  }
}

/* ------------------------------------------------------------------ *
 * 行级动作
 *
 * 抽屉展示的是**单据行**（WmsErpDocumentLine），而检验/下推需要的是**任务行**
 * （WmsOperationTaskLine）—— 两者是不同实体，靠 sourceEntryId 对应。
 *
 * 改造前这些动作只在「WMS任务池」菜单里，用户必须换页面、靠单号找到对应任务才能操作。
 * 现在收进抽屉：打开单据即可完成检验 → 入库/退料整条链路，不切菜单、不记任务号。
 * ------------------------------------------------------------------ */

/** 本单据关联的任务与任务行，key 是 sourceEntryId（单据行与任务行的唯一对应键）。 */
const taskByEntryId = ref<Map<number, { line: WmsOperationTaskLine; task: WmsOperationTask }>>(
  new Map(),
);
const actionLoadingEntryId = ref<number>();
const inspectionVisible = ref(false);
const inspectionTarget = ref<{ line: WmsOperationTaskLine; task: WmsOperationTask }>();

/**
 * 拉本单据的任务行。
 *
 * 复用 `getWmsTasks` 再按 `sourceDocumentId` 在前端匹配，与 `wms-task-pool.vue` 现有做法一致 ——
 * 不新增「按单据取任务」的端点：任务可见性由职责作用域决定、判据在 Java 里
 * （先拉本账套全部任务再逐条 isVisibleToStocker），另开一个端点得把那套判据复制一遍。
 *
 * 任务数量级很小（2026-08-27 实测 47 条），全量拉不构成负担。
 */
async function loadDocumentTasks(document: WmsErpDocument) {
  const next = new Map<number, { line: WmsOperationTaskLine; task: WmsOperationTask }>();
  // 账套优先取**单据自己的** —— 它一定有值。顶部筛选框的 erpAcctCode 可能是空的，
  // 而 listTasksForUser 对空账套直接抛 "erpAcctCode is required"，
  // 结果是行动作全部不可用且没有任何提示（2026-08-29 实测踩到）。
  const acctCode = document.erpAcctCode || filters.erpAcctCode;
  if (!acctCode) {
    ElMessage.warning('该单据没有账套信息，无法关联 WMS 任务');
    taskByEntryId.value = next;
    return;
  }
  try {
    const response = await getWmsTasks({ erpAcctCode: acctCode });
    if (!response.success) throw new Error(response.message || '获取任务失败');
    const tasks = (response.data || []).filter((task) => task.sourceDocumentId === document.id);
    // 任务行要逐个任务取（列表端点只返回任务头），任务数很少所以并发发出。
    const details = await Promise.all(
      tasks.map(async (task) => {
        const detail = await getWmsTask(task.id, {
          erpAcctCode: task.erpAcctCode || acctCode,
        });
        return { lines: detail.success ? detail.data.lines || [] : [], task };
      }),
    );
    for (const { lines, task } of details) {
      for (const line of lines) {
        if (line.sourceEntryId) next.set(line.sourceEntryId, { line, task });
      }
    }
    // 单据有可作业量却一个任务都没关联到，多半是职责作用域不覆盖该仓库 ——
    // 那种情况下行动作列会整片显示「待推进」，用户无从判断是没建任务还是看不见任务。
    if (tasks.length === 0) {
      ElMessage.info('该单据尚未生成 WMS 任务，或当前账号的职责范围不包含对应仓库');
    }
  } catch (error: any) {
    // 不再静默吞异常：拉不到任务时行动作全部不可用，用户必须知道原因。
    // 明细本身仍照常展示 —— 它是有价值的，不该被任务查询失败挡住。
    ElMessage.warning(`关联 WMS 任务失败，行操作暂不可用：${error.message || '未知错误'}`);
  }
  taskByEntryId.value = next;
}

/** 该单据行对应的任务行。没有任务（还没推进）时返回 undefined，动作列显示占位。 */
function taskForLine(row: WmsErpDocumentLine) {
  return row.sourceEntryId ? taskByEntryId.value.get(row.sourceEntryId) : undefined;
}

function canInspect(row: WmsErpDocumentLine) {
  const found = taskForLine(row);
  return !!found && canRecordIncomingInspection(found.task, found.line);
}

/**
 * 能否一步完成（下推 ERP + 记本地库存）。
 *
 * 与旧的 `canConvertLineToErp` 相比去掉了 `WMS_POSTED` 那条禁用 —— 合并动作之后
 * `WMS_POSTED` 只可能由本端点自己产生（前端已不再暴露单独的「提交任务」），
 * 而它同时意味着 ERP 也推过了。留着那条会让「已完成」的行看起来仍可点。
 */
function canComplete(row: WmsErpDocumentLine) {
  const found = taskForLine(row);
  if (!found) return false;
  return (
    found.line.lineStatus !== 'WAIT_QC' &&
    found.line.lineStatus !== 'CANCELLED' &&
    found.line.lineStatus !== 'WMS_POSTED'
  );
}

function openInspection(row: WmsErpDocumentLine) {
  const found = taskForLine(row);
  if (!found) return;
  inspectionTarget.value = found;
  inspectionVisible.value = true;
}

async function onInspectionSubmitted() {
  if (!currentDocument.value) return;
  // 检验会改任务状态与可作业量，单据与任务都要重拉
  await refreshDetail(currentDocument.value.id);
  await loadDocumentTasks(currentDocument.value);
  await refreshAll();
}

/**
 * 一步完成：下推 ERP，成功后记本地库存。
 *
 * 维度缺失时**不发请求**，直接提示缺哪几项 —— 让用户看到可读原因，
 * 而不是等 ERP 返回一个英文字段名。
 */
async function completeLine(row: WmsErpDocumentLine) {
  const found = taskForLine(row);
  if (!found) return;
  const missing = missingErpConversionDimensions(found.line);
  if (missing.length > 0) {
    ElMessage.warning(`缺少库存维度：${missing.join('、')}`);
    return;
  }
  actionLoadingEntryId.value = row.sourceEntryId;
  try {
    const response = await completeWmsTaskLine(
      found.task.id,
      found.line.id,
      found.task.erpAcctCode || filters.erpAcctCode || undefined,
    );
    if (!response.success) throw new Error(response.message || '下推 ERP 失败');
    const billNo = response.data?.erpBillNo;
    ElMessage.success(billNo ? `已生成 ERP 单据 ${billNo}` : 'ERP 下推成功');
    if (currentDocument.value) {
      await refreshDetail(currentDocument.value.id);
      await loadDocumentTasks(currentDocument.value);
    }
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '下推 ERP 失败');
  } finally {
    actionLoadingEntryId.value = undefined;
  }
}

function statusLabel(status?: string) {
  return ({
    ERP_SYNCED: '已同步',
    TASK_CREATED: '已建任务',
    OPERATING: '作业中',
    RESERVED: '已预占',
    WMS_POSTED: '已完成',
    ERP_FAILED: '异常',
  } as Record<string, string>)[status || ''] || status || '-';
}

function statusType(status?: string) {
  if (status === 'WMS_POSTED') return 'success';
  if (status === 'ERP_FAILED') return 'danger';
  if (['OPERATING', 'RESERVED'].includes(status || '')) return 'warning';
  return 'info';
}

function formatQuantity(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

/** 列表与统计并行拉：它们互不依赖，串行会白等一个 RTT。 */
async function refreshAll() {
  await Promise.all([loadDocuments(), loadSummary()]);
}

onMounted(refreshAll);
</script>

<template>
  <div class="chain-page">
    <section class="page-header">
      <div>
        <h1>{{ preset.title }}</h1>
        <p class="subtitle">{{ preset.subtitle }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" type="primary" @click="refreshAll">刷新</el-button>
      </div>
    </section>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card" :class="`tone-${item.tone}`">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em v-if="item.hint">{{ item.hint }}</em>
      </article>
    </section>

    <section class="toolbar">
      <el-input v-model="filters.keyword" :prefix-icon="Search" clearable placeholder="搜索单号、来源单、仓库" />
      <el-select v-model="filters.stage" clearable placeholder="业务阶段">
        <el-option v-for="stage in preset.stages" :key="stage.value" :label="stage.label" :value="stage.value" />
      </el-select>
      <el-select v-model="filters.businessType" clearable placeholder="业务类型">
        <el-option
          v-for="item in preset.businessTypes"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select v-model="filters.status" clearable placeholder="任务状态">
        <el-option label="已同步" value="ERP_SYNCED" />
        <el-option label="已建任务" value="TASK_CREATED" />
        <el-option label="作业中" value="OPERATING" />
        <el-option label="已完成" value="WMS_POSTED" />
      </el-select>
      <!-- 关掉后会显示 ERP 侧已闭环的历史单据（实测占 97.7%），所以提示要写清是"含已闭环" -->
      <el-tooltip content="只看还有待作业数量的单据。关闭后包含 ERP 侧已闭环、仅供追溯的历史单据" placement="top">
        <el-switch v-model="actionableOnly" class="actionable-switch" active-text="仅看可作业" />
      </el-tooltip>
    </section>

    <el-table v-loading="loading" :data="documents" border row-key="id">
      <el-table-column :label="preset.documentColumnLabel" min-width="220">
        <template #default="{ row }">
          <div class="primary-cell">
            <strong>{{ row.billNo || '-' }}</strong>
            <span>{{ row.formId }}{{ row.sourceBillNo ? ` / ${row.sourceBillNo}` : '' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="阶段" width="120">
        <template #default="{ row }">
          <el-tag effect="plain">{{ stageLabel(preset, row.businessStage) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="业务类型" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.businessType" :type="businessTypeTagType(row.formId, row.businessType)" effect="plain">
            {{ businessTypeLabel(row.formId, row.businessType) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="可用/合格/阻塞" min-width="170">
        <template #default="{ row }">
          {{ formatQuantity(row.availableQty) }} / {{ formatQuantity(row.acceptedQty) }} / {{ formatQuantity(row.blockedQty) }}
        </template>
      </el-table-column>
      <el-table-column label="仓库" min-width="160">
        <template #default="{ row }">{{ [row.stockNumber, row.stockName].filter(Boolean).join(' / ') || '-' }}</template>
      </el-table-column>
      <el-table-column label="WMS 状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusType(row.wmsStatus)" effect="light">{{ statusLabel(row.wmsStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="异常" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.erpError || row.lastError || '-' }}</template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="190">
        <template #default="{ row }">
          <el-button :icon="View" text type="primary" @click="openDetail(row)">查看</el-button>
          <!-- 不参与本业务的单据（如资产接收单）禁用推进：点了必然得到 CHAIN_BLOCKED，
               后端已按单据类型拦住。这里只是不让用户白点一次。 -->
          <el-tooltip
            v-if="isOutOfScopeBusinessType(row.formId, row.businessType)"
            content="该业务类型不参与本流程，同步进来仅供追溯"
            placement="top"
          >
            <el-button :icon="Promotion" disabled text>无需处理</el-button>
          </el-tooltip>
          <el-button
            v-else
            :icon="Promotion"
            :loading="dispatchingId === row.id"
            text
            type="success"
            @click="dispatchDocument(row)"
          >
            {{ preset.dispatchLabel }}
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

    <!-- 从 520px 扩到 70%：明细表有 6 列，520px 里横向滚动条比内容还显眼 -->
    <el-drawer v-model="detailVisible" :title="currentDocument?.billNo || '单据详情'" size="70%">
      <el-descriptions v-if="currentDocument" :column="2" border>
        <el-descriptions-item label="单据类型">{{ currentDocument.formId }}</el-descriptions-item>
        <el-descriptions-item label="业务阶段">{{ stageLabel(preset, currentDocument.businessStage) }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">
          {{ currentDocument.businessType ? businessTypeLabel(currentDocument.formId, currentDocument.businessType) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="账套">{{ currentDocument.erpAcctCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="组织 / 仓库">{{ currentDocument.erpOrgNumber || '-' }} / {{ currentDocument.stockNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="WMS 状态">{{ statusLabel(currentDocument.wmsStatus) }}</el-descriptions-item>
        <!-- 头级视图只有 available/accepted/rejected/blocked 四个数量（见 WmsErpDocumentService.toView），
             noticeQty 只在行级有，不要按行级字段类推头级。 -->
        <el-descriptions-item label="可作业 / 合格 / 拒收">
          {{ formatQuantity(currentDocument.availableQty) }} /
          {{ formatQuantity(currentDocument.acceptedQty) }} /
          {{ formatQuantity(currentDocument.rejectedQty) }}
        </el-descriptions-item>
        <el-descriptions-item label="异常信息">{{ currentDocument.erpError || currentDocument.lastError || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="line-title">单据明细</h3>
      <!-- 明细来自 GET /wms/erp-documents/{id}（列表端点刻意不返回 lines，那会让响应回到 MB 级）。
           表头已由列表行渲染，所以 loading 只罩这张表，不罩整个抽屉。 -->
      <el-table v-loading="detailLoading" :data="currentDocument?.lines || []" border>
        <el-table-column label="行号" prop="lineSeq" width="70" />
        <el-table-column label="物料" min-width="220">
          <template #default="{ row }: { row: WmsErpDocumentLine }">
            <div class="primary-cell">
              <strong>{{ row.materialCode || '-' }}</strong>
              <span>{{ row.materialName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="仓库" min-width="160">
          <template #default="{ row }: { row: WmsErpDocumentLine }">
            {{ [row.stockNumber, row.stockName].filter(Boolean).join(' / ') || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="批次" prop="lotNo" width="120" />
        <el-table-column align="right" label="通知数量" width="130">
          <template #default="{ row }: { row: WmsErpDocumentLine }">
            {{ formatQuantity(row.noticeQty ?? row.qty) }} {{ row.unitName || '' }}
          </template>
        </el-table-column>
        <!-- 可作业量是准入过滤的判据本身，明细里也要能看到是哪几行还有量 -->
        <el-table-column align="right" label="可作业" width="100">
          <template #default="{ row }: { row: WmsErpDocumentLine }">{{ formatQuantity(row.availableQty) }}</template>
        </el-table-column>
        <el-table-column align="right" label="合格 / 拒收" width="140">
          <template #default="{ row }: { row: WmsErpDocumentLine }">
            {{ formatQuantity(row.acceptedQty) }} / {{ formatQuantity(row.rejectedQty) }}
          </template>
        </el-table-column>
        <!-- 行级动作。每行只暴露**当前唯一该做的那一件事**：
             待检验 → 录入检验；已检验 → 一步完成（下推 ERP + 记本地库存）。
             改造前这些动作在「WMS任务池」菜单，用户得换页面、靠单号找任务。 -->
        <el-table-column fixed="right" label="操作" width="150">
          <template #default="{ row }: { row: WmsErpDocumentLine }">
            <el-button
              v-if="canInspect(row)"
              :icon="Check"
              text
              type="success"
              @click="openInspection(row)"
            >
              录入检验
            </el-button>
            <el-button
              v-else-if="canComplete(row)"
              :icon="Upload"
              :loading="actionLoadingEntryId === row.sourceEntryId"
              text
              type="primary"
              @click="completeLine(row)"
            >
              {{ preset.dispatchLabel }}
            </el-button>
            <!-- 没有任务说明单据还没「推进」，或该行已完成 —— 显式说明而不是留空白单元格 -->
            <span v-else class="action-hint">
              {{ taskForLine(row) ? '已完成' : '待推进' }}
            </span>
          </template>
        </el-table-column>
        <template #empty>{{ detailLoading ? '加载中' : '该单据没有明细行' }}</template>
      </el-table>
    </el-drawer>

    <IncomingInspectionDialog
      v-model:visible="inspectionVisible"
      :line="inspectionTarget?.line"
      :task-id="inspectionTarget?.task.id"
      @submitted="onInspectionSubmitted"
    />
  </div>
</template>

<style scoped>
.chain-page { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.page-header, .header-actions, .toolbar { display: flex; align-items: center; }
.page-header { justify-content: space-between; }
h1 { margin: 0; color: var(--el-text-color-primary); font-size: 24px; }
.subtitle { margin: 6px 0 0; color: var(--el-text-color-regular); }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 12px; }
.metric-card { padding: 16px; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); }
.metric-card span { display: block; color: var(--el-text-color-secondary); font-size: 13px; }
.action-hint { color: var(--el-text-color-secondary); font-size: 13px; }
.metric-card strong { display: block; margin-top: 8px; font-size: 26px; }
/* 副基准（累计量）：比主数字弱一档，避免和它抢注意力 */
.metric-card em { display: block; margin-top: 2px; color: var(--el-text-color-secondary); font-size: 12px; font-style: normal; }
.tone-success { border-color: var(--el-color-success-light-7); }
.tone-warning { border-color: var(--el-color-warning-light-7); }
.tone-primary { border-color: var(--el-color-primary-light-7); }
.toolbar { flex-wrap: wrap; gap: 10px; }
.toolbar .el-input { max-width: 340px; }
.toolbar .el-select { width: 150px; }
/* 开关不参与 el-select 的定宽，且靠右与筛选组分开 */
.actionable-switch { flex-shrink: 0; margin-left: auto; }
.line-title { margin: 20px 0 10px; color: var(--el-text-color-primary); font-size: 15px; }
.primary-cell { display: flex; flex-direction: column; gap: 3px; }
.primary-cell span { color: var(--el-text-color-secondary); font-size: 12px; }
.pager { justify-content: flex-end; }
@media (max-width: 900px) {
  .page-header, .toolbar { align-items: stretch; flex-direction: column; }
  .metric-grid { grid-template-columns: 1fr 1fr; }
  .toolbar .el-input, .toolbar .el-select { width: 100%; max-width: none; }
}
</style>
