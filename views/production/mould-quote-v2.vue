<script lang="ts" setup>
import type {
  MouldQuote,
  MouldQuoteActualCost,
  MouldQuoteCategory,
  MouldQuoteComparisonItem,
  MouldQuoteCostCategory,
  MouldQuoteLine,
  MouldQuoteParameter,
  MouldQuoteStatus,
} from '#/api/mouldQuote';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  acceptMouldQuote,
  addMouldQuoteActualCost,
  approveMouldQuote,
  calculateMouldQuote,
  createMouldQuote,
  customerConfirmMouldQuote,
  getMouldQuoteDetail,
  getMouldQuotes,
  submitMouldQuote,
  syncMouldQuoteActualCosts,
  updateMouldQuote,
} from '#/api/mouldQuote';
import { searchCustomers } from '#/api/bom';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import {
  buildMouldQuoteBudgetActualComparison,
  buildMouldQuoteV2Model,
  createDefaultMouldQuoteBudgetLines,
  createDefaultMouldQuoteDraft,
  createDefaultMouldQuoteParameters,
  estimateMouldQuoteLineAmount,
  getMouldQuotePricingMode,
  getMouldQuoteTypeOptions,
  getMouldQuoteV2ActionState,
  isDimensionalMouldQuoteLine,
} from './mould-quote-v2-model';

defineOptions({ name: 'MouldQuoteV2' });

type ActualCostCategory = Exclude<MouldQuoteCostCategory, 'OTHER'>;
type CustomerSearchItem = {
  label?: string;
  name?: string;
  number?: string;
  value?: string;
};

const STATUS_LABELS: Record<MouldQuoteStatus, string> = {
  ACCEPTED: '已验收',
  APPROVED: '内部已审核',
  CANCELLED: '已取消',
  CUSTOMER_CONFIRMED: '客户已确认',
  DRAFT: '草稿',
  QUOTED: '已报价',
  REJECTED: '已驳回',
  REVIEWED: '成本复盘',
  SUBMITTED: '已提交',
};

const CATEGORY_LABELS: Record<MouldQuoteCategory, string> = {
  INJECTION: '注塑',
  SHEET_METAL: '钣金',
  STAMPING: '冲压',
};

const COST_CATEGORY_LABELS: Record<MouldQuoteCostCategory, string> = {
  LABOR: '人工',
  MATERIAL: '材料',
  OTHER: '其他费用',
  OUTSOURCE: '工序委外',
};

const ACTUAL_COST_CATEGORY_OPTIONS: Array<{ label: string; value: ActualCostCategory }> = [
  { label: '材料', value: 'MATERIAL' },
  { label: '人工', value: 'LABOR' },
  { label: '工序委外', value: 'OUTSOURCE' },
];

const PARAM_VALUE_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  press_mode: [
    { label: '连续冲', value: '连续冲' },
    { label: '单冲', value: '单冲' },
  ],
  size_grade: [
    { label: 'A级', value: 'A' },
    { label: 'B级', value: 'B' },
    { label: 'C级', value: 'C' },
  ],
};

const loading = ref(false);
const actionLoading = ref(false);
const actualSaving = ref(false);
const customerSearchLoading = ref(false);
const saving = ref(false);
const drawerVisible = ref(false);
const activeDrawerTab = ref('form');
const keyword = ref('');
const statusFilter = ref<MouldQuoteStatus | ''>('');
const categoryFilter = ref<MouldQuoteCategory | ''>('');
const currentPage = ref(1);
const pageSize = ref(20);
const rows = ref<MouldQuote[]>([]);
const quoteForm = reactive<MouldQuote>(createDefaultMouldQuoteDraft());
const parameters = ref<MouldQuoteParameter[]>(createDefaultMouldQuoteParameters('STAMPING'));
const budgetLines = ref<MouldQuoteLine[]>(createDefaultMouldQuoteBudgetLines('STAMPING'));
const actualCosts = ref<MouldQuoteActualCost[]>([]);
const comparison = ref<MouldQuoteComparisonItem[]>([]);
const actualForm = reactive<MouldQuoteActualCost>({
  amount: 0,
  costCategory: 'MATERIAL',
  itemName: '',
  quantity: 1,
  sourceBill: '',
  sourceType: 'MANUAL',
  unitPrice: 0,
});
const customerDialog = reactive({
  keyword: '',
  list: [] as CustomerSearchItem[],
  loading: false,
  selected: null as CustomerSearchItem | null,
  visible: false,
});

const filteredRows = computed(() => rows.value.filter((row) => !categoryFilter.value || row.quoteCategory === categoryFilter.value));
const pagedRows = computed(() => paginateV2Rows(filteredRows.value, currentPage.value, pageSize.value));
const model = computed(() => buildMouldQuoteV2Model(filteredRows.value));
const metrics = computed(() => [
  { label: '报价单数', value: model.value.summary.total },
  { label: '待工程报价', tone: 'warning', value: model.value.summary.submitted },
  { label: '已验收/复盘', tone: 'success', value: model.value.summary.accepted },
  { label: '报价总额', value: formatMoney(model.value.summary.totalAmount) },
  { label: '平均毛利率', tone: model.value.summary.averageGrossProfitRate < 5 ? 'warning' : 'success', value: `${formatNumber(model.value.summary.averageGrossProfitRate)}%` },
]);
const chains = computed(() => filteredRows.value.slice(0, 8).map((row, index) => ({
  key: row.id || row.quoteNo || row.mouldCode || row.mouldName || `row-${index}`,
  primary: row.quoteNo || row.mouldName || '-',
  secondary: [row.customerName, row.productName].filter(Boolean).join(' / '),
  status: quoteStatusLabel(row.quoteStatus),
  tone: row.quoteStatus === 'REJECTED' ? 'danger' : ['ACCEPTED', 'REVIEWED'].includes(row.quoteStatus || '') ? 'success' : 'warning',
})));
const budgetSummary = computed(() => {
  const totals: Record<MouldQuoteCostCategory, number> = {
    LABOR: 0,
    MATERIAL: 0,
    OTHER: 0,
    OUTSOURCE: 0,
  };
  for (const line of budgetLines.value) {
    totals[line.costCategory || 'OTHER'] += estimateMouldQuoteLineAmount(line);
  }
  return totals;
});
const dimensionalBudgetLines = computed(() => budgetLines.value.filter(isDimensionalMouldQuoteLine));
const generalBudgetLines = computed(() => budgetLines.value.filter((line) => !isDimensionalMouldQuoteLine(line)));
const budgetEditable = computed(() => ['DRAFT', 'REJECTED'].includes(quoteForm.quoteStatus || 'DRAFT'));
const actualCostEditable = computed(() => !!quoteForm.id && ['ACCEPTED', 'REVIEWED'].includes(quoteForm.quoteStatus || 'DRAFT'));
const comparisonRows = computed(() => comparison.value.length
  ? comparison.value
  : buildMouldQuoteBudgetActualComparison(budgetLines.value, actualCosts.value));
const mouldTypeOptions = computed(() => getMouldQuoteTypeOptions(quoteForm.quoteCategory || 'STAMPING'));
const pricingMode = computed(() => getMouldQuotePricingMode(quoteForm.quoteCategory, quoteForm.mouldType));

function quoteCategoryLabel(category?: MouldQuoteCategory) {
  return category ? CATEGORY_LABELS[category] || '-' : '-';
}

function quoteStatusLabel(status?: MouldQuoteStatus) {
  return STATUS_LABELS[status || 'DRAFT'] || '-';
}

function statusType(status?: MouldQuoteStatus) {
  const map: Partial<Record<MouldQuoteStatus, string>> = {
    ACCEPTED: 'success',
    APPROVED: 'primary',
    CANCELLED: 'info',
    CUSTOMER_CONFIRMED: 'success',
    DRAFT: 'info',
    QUOTED: 'warning',
    REJECTED: 'danger',
    REVIEWED: 'success',
    SUBMITTED: 'primary',
  };
  return map[status || 'DRAFT'] || 'info';
}

function formatMoney(value?: number, digits = 2) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 2),
  });
}

function formatNumber(value?: number, digits = 2) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatRate(value?: number) {
  return `${formatNumber(Number(value || 0) * 100)}%`;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function getVarianceType(value?: number) {
  const amount = Number(value || 0);
  if (amount > 0) return 'danger';
  if (amount < 0) return 'success';
  return 'info';
}

function parameterValueOptions(paramKey?: string) {
  return paramKey ? PARAM_VALUE_OPTIONS[paramKey] || [] : [];
}

function resetActualForm(category: ActualCostCategory = 'MATERIAL') {
  Object.assign(actualForm, {
    amount: 0,
    costCategory: category,
    itemName: '',
    quantity: 1,
    remark: '',
    sourceBill: '',
    sourceType: 'MANUAL',
    unitPrice: 0,
  });
}

function resetCreateDrawer(category: MouldQuoteCategory = 'STAMPING') {
  Object.assign(quoteForm, createDefaultMouldQuoteDraft(category));
  parameters.value = createDefaultMouldQuoteParameters(category, quoteForm.mouldType);
  budgetLines.value = createDefaultMouldQuoteBudgetLines(category, quoteForm.mouldType);
  actualCosts.value = [];
  comparison.value = [];
  resetActualForm();
  activeDrawerTab.value = 'form';
}

function handleDrawerCategoryChange(category: MouldQuoteCategory) {
  if (!budgetEditable.value) {
    ElMessage.warning('报价单已进入流程，不能重置报价类别和预算明细');
    return;
  }
  resetCreateDrawer(category);
}

function handleDrawerMouldTypeChange() {
  if (!budgetEditable.value) {
    ElMessage.warning('报价单已进入流程，不能重置模具参数');
    return;
  }
  parameters.value = createDefaultMouldQuoteParameters(quoteForm.quoteCategory || 'STAMPING', quoteForm.mouldType);
  budgetLines.value = createDefaultMouldQuoteBudgetLines(quoteForm.quoteCategory || 'STAMPING', quoteForm.mouldType);
}

function defaultMaterialDensity() {
  return quoteForm.quoteCategory === 'INJECTION' ? 8 : 7.85;
}

function resetBudgetLineSortNos() {
  budgetLines.value.forEach((item, sortIndex) => {
    item.sortNo = sortIndex + 1;
  });
}

function createBudgetLine(costCategory: MouldQuoteCostCategory, dimensional = false): MouldQuoteLine {
  const extra: Partial<MouldQuoteLine> = {};
  if (costCategory === 'MATERIAL' && dimensional) {
    extra.density = defaultMaterialDensity();
  }
  return {
    costCategory,
    itemName: COST_CATEGORY_LABELS[costCategory],
    quantity: costCategory === 'LABOR' ? undefined : 1,
    sortNo: budgetLines.value.length + 1,
    unitPrice: 0,
    workHours: costCategory === 'LABOR' ? 0 : undefined,
    ...extra,
  };
}

function addBudgetLine(category: MouldQuoteCostCategory, dimensional = false) {
  if (!budgetEditable.value) {
    ElMessage.warning('报价单已进入流程，预算明细不可新增');
    return;
  }
  budgetLines.value.push(createBudgetLine(category, dimensional));
  resetBudgetLineSortNos();
}

function removeBudgetLine(row: MouldQuoteLine) {
  if (!budgetEditable.value) {
    ElMessage.warning('报价单已进入流程，预算明细不可删除');
    return;
  }
  const index = budgetLines.value.indexOf(row);
  if (index < 0) return;
  budgetLines.value.splice(index, 1);
  resetBudgetLineSortNos();
}

const getCurrentOrgId = (): string | null => localStorage.getItem('mes_current_org_id');

async function searchCustomerSuggestions(queryString: string, cb: (items: CustomerSearchItem[]) => void) {
  if (!queryString.trim()) {
    cb([]);
    return;
  }
  customerSearchLoading.value = true;
  try {
    const res: any = await searchCustomers(queryString.trim(), getCurrentOrgId() ?? undefined);
    if (res.success && res.data) {
      cb(res.data.map((item: CustomerSearchItem) => ({
        ...item,
        label: `${item.number || ''} | ${item.name || ''}`,
        value: item.number || item.name || '',
      })));
    } else {
      cb([]);
    }
  } catch {
    cb([]);
  } finally {
    customerSearchLoading.value = false;
  }
}

function onCustomerSelected(item: CustomerSearchItem) {
  quoteForm.customerName = item.name || item.value || '';
}

function handleCustomerNameInput(value: string) {
  quoteForm.customerName = value;
}

async function onCustomerBlur() {
  if (!quoteForm.customerName) return;
  try {
    const res: any = await searchCustomers(quoteForm.customerName, getCurrentOrgId() ?? undefined);
    if (res.success && res.data?.length) {
      quoteForm.customerName = res.data[0].name || quoteForm.customerName;
    }
  } catch {
    // Keep the manually entered customer name when ERP search is unavailable.
  }
}

function openCustomerDialog() {
  customerDialog.visible = true;
  customerDialog.keyword = quoteForm.customerName || '';
  customerDialog.list = [];
  customerDialog.selected = null;
}

async function searchCustomerData() {
  if (!customerDialog.keyword.trim()) {
    ElMessage.warning('请输入搜索关键字');
    return;
  }
  customerDialog.loading = true;
  try {
    const res: any = await searchCustomers(customerDialog.keyword.trim(), getCurrentOrgId() ?? undefined);
    if (res.success) {
      customerDialog.list = res.data || [];
    } else {
      customerDialog.list = [];
      ElMessage.error(res.message || '搜索客户失败');
    }
  } catch {
    customerDialog.list = [];
    ElMessage.error('搜索客户失败');
  } finally {
    customerDialog.loading = false;
  }
}

function onCustomerSelectChange(row: CustomerSearchItem) {
  customerDialog.selected = row;
}

function confirmCustomerSelection() {
  if (!customerDialog.selected) {
    ElMessage.warning('请选择一个客户');
    return;
  }
  quoteForm.customerName = customerDialog.selected.name || '';
  customerDialog.visible = false;
}

async function loadQuoteDetail(id: number, targetTab = 'form') {
  const res: any = await getMouldQuoteDetail(id);
  if (!res.success || !res.data?.quote) {
    throw new Error(res.message || '查询报价详情失败');
  }
  const quote = res.data.quote as MouldQuote;
  Object.assign(quoteForm, quote);
  parameters.value = res.data.parameters?.length
    ? res.data.parameters
    : createDefaultMouldQuoteParameters(quote.quoteCategory || 'STAMPING', quote.mouldType);
  budgetLines.value = res.data.budgetLines || createDefaultMouldQuoteBudgetLines(quote.quoteCategory || 'STAMPING', quote.mouldType);
  actualCosts.value = res.data.actualCosts || [];
  comparison.value = res.data.comparison || [];
  activeDrawerTab.value = targetTab;
  drawerVisible.value = true;
}

async function openQuoteDetail(row: MouldQuote, targetTab = 'form') {
  if (!row.id) return;
  loading.value = true;
  try {
    await loadQuoteDetail(row.id, targetTab);
  } catch (error: any) {
    ElMessage.error(error?.message || '查询报价详情失败');
  } finally {
    loading.value = false;
  }
}

async function saveCurrentQuote() {
  if (!quoteForm.quoteCategory) {
    ElMessage.warning('请选择模具类别');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      budgetLines: budgetLines.value
        .filter((item) => item.itemName)
        .map((item, index) => ({ ...item, sortNo: index + 1 })),
      parameters: parameters.value
        .filter((item) => item.paramKey && item.paramName)
        .map((item, index) => ({ ...item, sortNo: index + 1 })),
      quote: { ...quoteForm },
    };
    const res: any = quoteForm.id
      ? await updateMouldQuote(quoteForm.id, payload)
      : await createMouldQuote(payload);
    if (!res.success) throw new Error(res.message || '保存报价失败');
    ElMessage.success(res.message || '保存成功');
    if (res.data?.id) {
      await loadQuoteDetail(res.data.id, activeDrawerTab.value);
    }
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存报价失败');
  } finally {
    saving.value = false;
  }
}

async function loadData() {
  loading.value = true;
  try {
    const res: any = await getMouldQuotes({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
    });
    if (!res.success) throw new Error(res.message || '查询模具报价失败');
    rows.value = res.data || [];
    currentPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '查询模具报价失败');
  } finally {
    loading.value = false;
  }
}

async function handleSyncActualCosts() {
  if (!quoteForm.id || !actualCostEditable.value) {
    ElMessage.warning('模具验收后才能同步实际成本');
    return;
  }
  try {
    await ElMessageBox.confirm('将从工序工资和模具成本记录重新归集自动成本，是否继续？', '同步实际成本', { type: 'warning' });
  } catch {
    return;
  }
  actionLoading.value = true;
  try {
    const res: any = await syncMouldQuoteActualCosts(quoteForm.id);
    if (!res.success) throw new Error(res.message || '同步实际成本失败');
    ElMessage.success(res.message || '实际成本已同步');
    await loadQuoteDetail(quoteForm.id, 'comparison');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '同步实际成本失败');
  } finally {
    actionLoading.value = false;
  }
}

async function handleAddActualCost() {
  if (!quoteForm.id || !actualCostEditable.value) {
    ElMessage.warning('模具验收后才能补录实际成本');
    return;
  }
  if (!actualForm.itemName || !actualForm.amount) {
    ElMessage.warning('请填写成本项目和金额');
    return;
  }
  actualSaving.value = true;
  try {
    const res: any = await addMouldQuoteActualCost(quoteForm.id, { ...actualForm });
    if (!res.success) throw new Error(res.message || '补录实际成本失败');
    ElMessage.success(res.message || '补录成功');
    resetActualForm(actualForm.costCategory as ActualCostCategory);
    await loadQuoteDetail(quoteForm.id, 'comparison');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '补录实际成本失败');
  } finally {
    actualSaving.value = false;
  }
}

async function runAction(row: MouldQuote, actionName: string, action: (id: number) => Promise<any>) {
  if (!row.id) return;
  actionLoading.value = true;
  try {
    const res: any = await action(row.id);
    if (!res.success) throw new Error(res.message || `${actionName}失败`);
    ElMessage.success(res.message || `${actionName}成功`);
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || `${actionName}失败`);
  } finally {
    actionLoading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

function openCreateQuote() {
  resetCreateDrawer();
  drawerVisible.value = true;
}

watch(categoryFilter, () => {
  currentPage.value = 1;
});

onMounted(loadData);
</script>

<template>
  <div class="mould-quote-v2-page">
    <V2DiagnosticsShell
      chain-title="报价流程链路"
      description="模具报价从提交到验收复盘。平均毛利率低于 5% 会标为预警，验收后的实际成本可与报价成本对比。"
      eyebrow="生产 · 模具报价"
      issue-title="报价风险优先区"
      :chains="chains"
      :issues="model.issueGroups"
      :metrics="metrics"
      :stages="model.stages"
      title="模具报价分析"
    >
    <template #actions>
      <el-button size="small" type="primary" @click="openCreateQuote" :icon="'Plus'">新增报价单</el-button>
      <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
    </template>

    <template #toolbar>
      <section class="v2-panel toolbar-row">
        <el-input v-model="keyword" clearable placeholder="客户/产品/模具/工单" style="width: 260px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" clearable placeholder="流程状态" style="width: 150px">
          <el-option v-for="(label, value) in STATUS_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-select v-model="categoryFilter" clearable placeholder="模具类别" style="width: 130px">
          <el-option v-for="(label, value) in CATEGORY_LABELS" :key="value" :label="label" :value="value" />
        </el-select>
        <el-button type="primary" @click="loadData" :icon="'Refresh'">查询</el-button>
      </section>
    </template>

    <section class="v2-panel v2-table-panel">
      <el-table :data="pagedRows" v-loading="loading" border height="520" size="small" stripe>
        <el-table-column label="报价单" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.quoteNo || '-' }}</strong>
              <span>{{ row.mouldName || row.mouldCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="客户/产品" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.customerName || '-' }}</strong>
              <span>{{ row.productName || row.productNo || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="100" align="center">
          <template #default="{ row }">{{ quoteCategoryLabel(row.quoteCategory) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.quoteStatus)" size="small">{{ quoteStatusLabel(row.quoteStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="报价金额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.quoteAmount) }}</template>
        </el-table-column>
        <el-table-column label="含税金额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.taxIncludedAmount) }}</template>
        </el-table-column>
        <el-table-column label="毛利率" width="100" align="right">
          <template #default="{ row }">
            <span :class="Number(row.grossProfitRate || 0) < 0.05 ? 'danger-text' : 'success-text'">
              {{ formatRate(row.grossProfitRate) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="报价日期" width="170">
          <template #default="{ row }">{{ formatTime(row.quoteDate) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="350" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button size="small" link type="primary" @click="openQuoteDetail(row)" :icon="'View'">查看</el-button>
              <el-button size="small" link type="success" :disabled="!getMouldQuoteV2ActionState(row).canSubmit || actionLoading" @click="runAction(row, '提交', submitMouldQuote)" :icon="'Check'">提交</el-button>
              <el-button size="small" link type="warning" :disabled="!getMouldQuoteV2ActionState(row).canCalculate || actionLoading" @click="runAction(row, '计算报价', calculateMouldQuote)">计算</el-button>
              <el-button size="small" link type="primary" :disabled="!getMouldQuoteV2ActionState(row).canApprove || actionLoading" @click="runAction(row, '审核', approveMouldQuote)" :icon="'Check'">审核</el-button>
              <el-button size="small" link type="success" :disabled="!getMouldQuoteV2ActionState(row).canCustomerConfirm || actionLoading" @click="runAction(row, '客户确认', customerConfirmMouldQuote)" :icon="'Check'">客户确认</el-button>
              <el-button size="small" link type="success" :disabled="!getMouldQuoteV2ActionState(row).canAccept || actionLoading" @click="runAction(row, '验收', acceptMouldQuote)" :icon="'Check'">验收</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="filteredRows.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>
  </V2DiagnosticsShell>

  <el-drawer
    v-model="drawerVisible"
    append-to-body
    size="86%"
    title="新增报价单"
  >
    <template #default>
      <div class="drawer-body">
        <el-tabs v-model="activeDrawerTab" class="drawer-tabs">
          <el-tab-pane label="报价表单" name="form">
            <el-form :model="quoteForm" label-width="96px" size="small">
              <div class="drawer-form-grid">
                <el-form-item label="模具类别">
                  <el-select
                    v-model="quoteForm.quoteCategory"
                    :disabled="!budgetEditable"
                    style="width: 100%"
                    @change="handleDrawerCategoryChange"
                  >
                    <el-option v-for="(label, value) in CATEGORY_LABELS" :key="value" :label="label" :value="value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="模具类型">
                  <el-select
                    v-if="mouldTypeOptions.length"
                    v-model="quoteForm.mouldType"
                    :disabled="!budgetEditable"
                    clearable
                    filterable
                    style="width: 100%"
                    @change="handleDrawerMouldTypeChange"
                  >
                    <el-option v-for="item in mouldTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                  <el-input v-else v-model="quoteForm.mouldType" :disabled="!budgetEditable" @change="handleDrawerMouldTypeChange" />
                </el-form-item>
                <el-form-item label="客户">
                  <div class="customer-picker">
                    <el-autocomplete
                      v-model="quoteForm.customerName"
                      :fetch-suggestions="searchCustomerSuggestions"
                      :loading="customerSearchLoading"
                      clearable
                      placeholder="输入编码/名称搜索客户"
                      value-key="label"
                      @blur="onCustomerBlur"
                      @clear="handleCustomerNameInput('')"
                      @input="handleCustomerNameInput"
                      @select="onCustomerSelected"
                    />
                    <el-button type="primary" link :icon="'Search'" @click="openCustomerDialog" />
                  </div>
                </el-form-item>
                <el-form-item label="产品名称">
                  <el-input v-model="quoteForm.productName" clearable />
                </el-form-item>
                <el-form-item label="产品图号">
                  <el-input v-model="quoteForm.productNo" clearable />
                </el-form-item>
                <el-form-item label="模具名称">
                  <el-input v-model="quoteForm.mouldName" clearable />
                </el-form-item>
                <el-form-item label="模具编号">
                  <el-input v-model="quoteForm.mouldCode" clearable />
                </el-form-item>
                <el-form-item label="关联工单">
                  <el-input v-model="quoteForm.orderNo" clearable />
                </el-form-item>
                <el-form-item label="管理费率">
                  <el-input-number v-model="quoteForm.managementRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="风险费率">
                  <el-input-number v-model="quoteForm.riskRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="毛利率">
                  <el-input-number v-model="quoteForm.grossProfitRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="税率">
                  <el-input-number v-model="quoteForm.taxRate" :min="0" :precision="4" :step="0.01" controls-position="right" style="width: 100%" />
                </el-form-item>
              </div>
              <el-form-item label="备注">
                <el-input v-model="quoteForm.remark" type="textarea" :rows="2" />
              </el-form-item>
            </el-form>

            <div class="drawer-section-title">
              <span>模具参数</span>
              <el-button :disabled="!budgetEditable" size="small" @click="handleDrawerCategoryChange(quoteForm.quoteCategory || 'STAMPING')" :icon="'RefreshRight'">按类别重置</el-button>
            </div>
            <el-alert
              :closable="false"
              :description="pricingMode.remark"
              :title="`${pricingMode.label}：${quoteForm.mouldType || '未选择模具类型'}`"
              :type="pricingMode.tone === 'success' ? 'success' : 'warning'"
              class="pricing-mode-alert"
              show-icon
            />
            <el-table :data="parameters" border height="300" size="small" stripe>
              <el-table-column type="index" width="48" align="center" />
              <el-table-column prop="paramName" label="字段" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.paramName" />
                </template>
              </el-table-column>
              <el-table-column prop="paramKey" label="字段编码" min-width="150">
                <template #default="{ row }">
                  <el-input v-model="row.paramKey" />
                </template>
              </el-table-column>
              <el-table-column prop="paramValue" label="值" min-width="180">
                <template #default="{ row }">
                  <el-select
                    v-if="parameterValueOptions(row.paramKey).length"
                    v-model="row.paramValue"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in parameterValueOptions(row.paramKey)"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                  <el-input v-else v-model="row.paramValue" />
                </template>
              </el-table-column>
              <el-table-column prop="valueType" label="类型" width="120">
                <template #default="{ row }">
                  <el-select v-model="row.valueType">
                    <el-option label="文本" value="TEXT" />
                    <el-option label="数字" value="NUMBER" />
                  </el-select>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="预算明细" name="budget">
            <div class="budget-summary-row">
              <div><span>材料</span><strong>{{ formatMoney(budgetSummary.MATERIAL) }}</strong></div>
              <div><span>人工</span><strong>{{ formatMoney(budgetSummary.LABOR) }}</strong></div>
              <div><span>工序委外</span><strong>{{ formatMoney(budgetSummary.OUTSOURCE) }}</strong></div>
              <div><span>其他费用</span><strong>{{ formatMoney(budgetSummary.OTHER) }}</strong></div>
            </div>
            <div class="drawer-section-title">
              <span>尺寸/重量材料</span>
              <div class="drawer-toolbar compact-toolbar">
                <el-button :disabled="!budgetEditable" size="small" @click="addBudgetLine('MATERIAL', true)" :icon="'Plus'">尺寸材料</el-button>
                <el-tag v-if="!budgetEditable" type="info">报价单已进入流程，预算明细不可编辑</el-tag>
              </div>
            </div>
            <el-table :data="dimensionalBudgetLines" border height="260" size="small" stripe>
              <el-table-column type="index" width="48" fixed="left" />
              <el-table-column prop="itemName" label="项目" min-width="130" fixed="left">
                <template #default="{ row }">
                  <el-input v-model="row.itemName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="materialName" label="材质/材料" width="130">
                <template #default="{ row }">
                  <el-input v-model="row.materialName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="specification" label="规格" width="140">
                <template #default="{ row }">
                  <el-input v-model="row.specification" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="lengthValue" label="长" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.lengthValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="widthValue" label="宽" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.widthValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="heightValue" label="高/厚" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.heightValue" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="density" label="密度" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.density" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.quantity" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="unitPrice" label="单价" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.unitPrice" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="lossRate" label="损耗率" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.lossRate" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column label="系统金额" width="120" align="right">
                <template #default="{ row }">
                  <strong>{{ formatMoney(estimateMouldQuoteLineAmount(row), 4) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button :disabled="!budgetEditable" text type="danger" size="small" @click="removeBudgetLine(row)" :icon="'Delete'">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <div class="drawer-section-title">
              <span>普通费用明细</span>
              <div class="drawer-toolbar compact-toolbar">
                <el-button :disabled="!budgetEditable" size="small" @click="addBudgetLine('MATERIAL')" :icon="'Plus'">固定材料</el-button>
                <el-button :disabled="!budgetEditable" size="small" @click="addBudgetLine('LABOR')" :icon="'Plus'">人工</el-button>
                <el-button :disabled="!budgetEditable" size="small" @click="addBudgetLine('OUTSOURCE')" :icon="'Plus'">委外</el-button>
                <el-button :disabled="!budgetEditable" size="small" @click="addBudgetLine('OTHER')" :icon="'Plus'">其他</el-button>
              </div>
            </div>
            <el-table :data="generalBudgetLines" border height="270" size="small" stripe>
              <el-table-column type="index" width="48" fixed="left" />
              <el-table-column prop="costCategory" label="分类" width="110" fixed="left">
                <template #default="{ row }">
                  <el-select v-model="row.costCategory" :disabled="!budgetEditable">
                    <el-option v-for="(label, value) in COST_CATEGORY_LABELS" :key="value" :label="label" :value="value" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column prop="itemName" label="项目" min-width="140" fixed="left">
                <template #default="{ row }">
                  <el-input v-model="row.itemName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="materialName" label="材料/说明" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.materialName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="supplierName" label="供应商" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.supplierName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="processName" label="工序" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.processName" :disabled="!budgetEditable" />
                </template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.quantity" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="unitPrice" label="单价" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.unitPrice" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="workHours" label="工时" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.workHours" :disabled="!budgetEditable" :min="0" :precision="2" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="固定金额" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.amount" :disabled="!budgetEditable" :min="0" :precision="4" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column label="系统金额" width="120" align="right">
                <template #default="{ row }">
                  <strong>{{ formatMoney(estimateMouldQuoteLineAmount(row), 4) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button :disabled="!budgetEditable" text type="danger" size="small" @click="removeBudgetLine(row)" :icon="'Delete'">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="成本与预算对比" name="comparison">
            <div class="drawer-toolbar">
              <el-button :disabled="!actualCostEditable" :loading="actionLoading" :icon="'Refresh'" @click="handleSyncActualCosts">
                同步实际成本
              </el-button>
              <el-tag v-if="!quoteForm.id" type="info">保存报价单后可归集实际成本</el-tag>
              <el-tag v-else-if="!actualCostEditable" type="info">模具验收后开放成本归集</el-tag>
            </div>

            <el-form :model="actualForm" inline size="small" :disabled="!actualCostEditable">
              <el-form-item label="分类">
                <el-select v-model="actualForm.costCategory" style="width: 120px">
                  <el-option v-for="item in ACTUAL_COST_CATEGORY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="项目">
                <el-input v-model="actualForm.itemName" style="width: 160px" />
              </el-form-item>
              <el-form-item label="金额">
                <el-input-number v-model="actualForm.amount" :min="0" :precision="4" controls-position="right" style="width: 140px" />
              </el-form-item>
              <el-form-item label="来源单据">
                <el-input v-model="actualForm.sourceBill" style="width: 160px" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="actualSaving" @click="handleAddActualCost" :icon="'Plus'">补录</el-button>
              </el-form-item>
            </el-form>

            <div class="drawer-section-title">
              <span>实际成本记录</span>
            </div>
            <el-table :data="actualCosts" border height="210" size="small" stripe>
              <el-table-column prop="costCategory" label="分类" width="100">
                <template #default="{ row }">{{ COST_CATEGORY_LABELS[row.costCategory as MouldQuoteCostCategory] }}</template>
              </el-table-column>
              <el-table-column prop="itemName" label="项目" min-width="150" show-overflow-tooltip />
              <el-table-column label="金额" width="130" align="right">
                <template #default="{ row }">{{ formatMoney(row.amount, 4) }}</template>
              </el-table-column>
              <el-table-column prop="sourceType" label="来源" width="130" />
              <el-table-column prop="sourceBill" label="来源单据" min-width="150" show-overflow-tooltip />
              <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            </el-table>

            <div class="drawer-section-title">
              <span>预算与实际对比</span>
            </div>
            <el-table :data="comparisonRows" border height="240" size="small" stripe>
              <el-table-column prop="categoryName" label="维度" width="120" />
              <el-table-column label="预算" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.budgetAmount, 4) }}</template>
              </el-table-column>
              <el-table-column label="实际" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.actualAmount, 4) }}</template>
              </el-table-column>
              <el-table-column label="差异" width="140" align="right">
                <template #default="{ row }">
                  <el-tag :type="getVarianceType(row.varianceAmount)" size="small">
                    {{ formatMoney(row.varianceAmount, 4) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="差异率" width="120" align="right">
                <template #default="{ row }">{{ formatRate(row.varianceRate) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <template #footer>
      <div class="drawer-footer">
        <div class="footer-status">
          <el-tag :type="statusType(quoteForm.quoteStatus)" size="small">{{ quoteStatusLabel(quoteForm.quoteStatus) }}</el-tag>
          <span>{{ quoteForm.customerName || quoteForm.productName || '未保存报价单' }}</span>
        </div>
        <div class="footer-actions">
          <el-button @click="drawerVisible = false">关闭</el-button>
          <el-button type="primary" :loading="saving" @click="saveCurrentQuote" :icon="'Check'">保存</el-button>
        </div>
      </div>
    </template>
    </el-drawer>

    <el-dialog v-model="customerDialog.visible" title="选择客户" width="600px" append-to-body destroy-on-close>
      <div class="customer-dialog-search">
        <el-input
          v-model="customerDialog.keyword"
          clearable
          placeholder="输入客户编码/名称搜索"
          @keyup.enter="searchCustomerData"
        />
        <el-button type="primary" :loading="customerDialog.loading" @click="searchCustomerData" :icon="'Search'">搜索</el-button>
      </div>
      <el-table
        :data="customerDialog.list"
        border
        highlight-current-row
        max-height="400"
        size="small"
        @current-change="onCustomerSelectChange"
      >
        <el-table-column prop="number" label="客户编码" width="140" />
        <el-table-column prop="name" label="客户名称" min-width="220" />
      </el-table>
      <p v-if="customerDialog.list.length === 0 && !customerDialog.loading" class="empty-hint">输入关键字后点击搜索</p>
      <template #footer>
        <el-button @click="customerDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="confirmCustomerSelection">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mould-quote-v2-page {
  height: 100%;
  min-height: 100%;
}

.toolbar-row,
.action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-cell {
  justify-content: center;
  flex-wrap: nowrap;
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

.danger-text {
  color: #dc2626;
  font-weight: 700;
}

.success-text {
  color: #15803d;
  font-weight: 700;
}

.drawer-body {
  display: flex;
  min-height: calc(100vh - 150px);
  flex-direction: column;
}

.drawer-tabs {
  flex: 1;
  min-height: 0;
}

.drawer-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 12px;
}

.customer-picker,
.customer-dialog-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.customer-picker :deep(.el-autocomplete) {
  flex: 1;
}

.customer-dialog-search {
  margin-bottom: 12px;
}

.empty-hint {
  margin: 0;
  padding: 20px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.drawer-section-title,
.drawer-toolbar,
.drawer-footer,
.footer-actions,
.footer-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-section-title {
  justify-content: space-between;
  margin: 12px 0 8px;
  color: var(--el-text-color-primary);
  font-weight: 700;
}

.drawer-toolbar {
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.compact-toolbar {
  margin-bottom: 0;
}

.pricing-mode-alert {
  margin-bottom: 8px;
}

.budget-summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.budget-summary-row div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 8px 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.budget-summary-row span,
.footer-status span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.budget-summary-row strong {
  color: var(--el-text-color-primary);
}

.drawer-footer {
  justify-content: space-between;
  width: 100%;
}

.footer-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.footer-actions :deep(.el-button),
.footer-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 1100px) {
  .drawer-form-grid,
  .budget-summary-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .drawer-form-grid,
  .budget-summary-row {
    grid-template-columns: 1fr;
  }

  .drawer-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
