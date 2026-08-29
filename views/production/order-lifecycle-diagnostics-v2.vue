<script lang="ts" setup>
import type { LifecycleStage, LifecycleTone } from './order-lifecycle-diagnostics-v2-model';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getOrderLifecycleDiagnostics } from '#/api/production';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import {
  buildIssueGroups,
  buildLifecycleStages,
  summarizeRecords,
} from './order-lifecycle-diagnostics-v2-model';

defineOptions({ name: 'OrderLifecycleDiagnosticsV2' });

const route = useRoute();
const loading = ref(false);
const activeTab = ref('flowCards');
const issuesPage = ref(1);
const flowPage = ref(1);
const inspectionPage = ref(1);
const productReportPage = ref(1);
const wagePage = ref(1);
const pqc1Page = ref(1);
const instockPage = ref(1);
const pageSize = ref(20);
const queryOrderNo = ref(String(route.query.orderNo || route.query.orderNoEq || '').trim());
const diagnostics = ref<Record<string, any> | null>(null);

const summary = computed<Record<string, any>>(() => diagnostics.value?.summary || {});
const order = computed<Record<string, any>>(() => diagnostics.value?.order || {});
const diagnosticRows = computed<any[]>(() => toArray(diagnostics.value?.diagnostics));
const flowCards = computed<any[]>(() => toArray(diagnostics.value?.flowCards));
const inspectionTasks = computed<any[]>(() => toArray(diagnostics.value?.inspectionTasks));
const wageSettlements = computed<any[]>(() => toArray(diagnostics.value?.wageSettlements));
const productReportRows = computed<any[]>(() => toArray(diagnostics.value?.productReport?.rows || diagnostics.value?.r1?.rows));
const pqc1Rows = computed<any[]>(() => toArray(diagnostics.value?.pqc1?.rows));
const instockTasks = computed<any[]>(() => toArray(diagnostics.value?.instockTasks));
const rawJson = computed(() => (diagnostics.value ? JSON.stringify(diagnostics.value, null, 2) : ''));
const stages = computed(() => buildLifecycleStages(diagnostics.value || {}));
const issueGroups = computed(() => buildIssueGroups(diagnostics.value || {}));
const recordSummary = computed(() => summarizeRecords(diagnostics.value || {}));
const pagedDiagnosticRows = computed(() => paginateV2Rows(diagnosticRows.value, issuesPage.value, pageSize.value));
const pagedFlowCards = computed(() => paginateV2Rows(flowCards.value, flowPage.value, pageSize.value));
const pagedInspectionTasks = computed(() => paginateV2Rows(inspectionTasks.value, inspectionPage.value, pageSize.value));
const pagedProductReportRows = computed(() => paginateV2Rows(productReportRows.value, productReportPage.value, pageSize.value));
const pagedWageSettlements = computed(() => paginateV2Rows(wageSettlements.value, wagePage.value, pageSize.value));
const pagedPqc1Rows = computed(() => paginateV2Rows(pqc1Rows.value, pqc1Page.value, pageSize.value));
const pagedInstockTasks = computed(() => paginateV2Rows(instockTasks.value, instockPage.value, pageSize.value));
const billTrace = computed(() => ({
  erpOrderNo: order.value.erpOrderNo || '-',
  instockBillNo: firstText(instockTasks.value, 'erpInstockBillNo'),
  pqc1BillNo: firstText(pqc1Rows.value, 'erpInspectionBillNo'),
  productReportBillNo: firstText(productReportRows.value, 'erpReportBillNo') || firstText(productReportRows.value, 'flowReportBillNo'),
}));
const overallTone = computed<LifecycleTone>(() => {
  if (recordSummary.value.errorRecords > 0) return 'danger';
  if (diagnosticRows.value.length > 0) return 'warning';
  if (stages.value.some((stage) => stage.tone === 'primary')) return 'primary';
  return 'success';
});
const metrics = computed(() => [
  { label: '计划数', value: formatInteger(summary.value.planQty) },
  { label: '末道良品', tone: 'success', value: formatInteger(summary.value.terminalCompletedQtyFromFlows) },
  { label: '诊断问题', tone: diagnosticRows.value.length ? 'warning' : 'success', value: diagnosticRows.value.length },
  { label: '错误记录', tone: recordSummary.value.errorRecords ? 'danger' : 'success', value: recordSummary.value.errorRecords },
  { label: '流转卡', value: recordSummary.value.flowCount },
  { label: '检验任务', value: recordSummary.value.inspectionCount },
  { label: '工资记录', value: recordSummary.value.wageCount },
  { label: '入库任务', value: recordSummary.value.instockCount },
]);
const shellStages = computed(() => stages.value.map((stage) => ({
  description: stage.description,
  key: stage.key,
  label: stage.label,
  tone: stage.tone,
  value: `${stage.done}/${stage.total}`,
})));
const shellIssues = computed(() => issueGroups.value.map((group) => ({
  count: group.count,
  key: group.key,
  label: group.label,
  tone: issueTone(group.level),
})));
const chains = computed(() => [
  { key: 'erp-order', primary: 'ERP工单', secondary: billTrace.value.erpOrderNo, status: billTrace.value.erpOrderNo === '-' ? '缺失' : '已关联', tone: billTrace.value.erpOrderNo === '-' ? 'warning' : 'success' },
  { key: 'productReport', primary: '生产汇报单', secondary: billTrace.value.productReportBillNo, status: billTrace.value.productReportBillNo === '-' ? '缺失' : '已生成', tone: billTrace.value.productReportBillNo === '-' ? 'warning' : 'success' },
  { key: 'pqc1', primary: '产品入库检验', secondary: billTrace.value.pqc1BillNo, status: billTrace.value.pqc1BillNo === '-' ? '缺失' : '已生成', tone: billTrace.value.pqc1BillNo === '-' ? 'warning' : 'success' },
  { key: 'instock', primary: '入库单', secondary: billTrace.value.instockBillNo, status: billTrace.value.instockBillNo === '-' ? '缺失' : '已生成', tone: billTrace.value.instockBillNo === '-' ? 'warning' : 'success' },
]);

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function firstText(rows: any[], key: string) {
  return rows.find((row) => row?.[key])?.[key] || '-';
}

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatInteger(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function statusType(status?: string) {
  const map: Record<string, string> = {
    AUDITED: 'success',
    CALCULATED: 'primary',
    COMPLETED: 'success',
    CONFIRMED: 'primary',
    CONFIRMING: 'primary',
    ERP_AUDITED: 'success',
    ERP_FAILED: 'danger',
    ERP_PUSHED: 'success',
    FAILED: 'danger',
    IN_PROGRESS: 'warning',
    PENDING: 'info',
    PENDING_CONFIRM: 'warning',
    PUSHED: 'success',
    PUSH_FAILED: 'danger',
    PUSH_PENDING: 'warning',
    SKIPPED: 'info',
    SUBMITTED: 'info',
    WAIT_ERP_AUDIT: 'info',
    WAIT_R1: 'warning',
  };
  return map[status || ''] || 'info';
}

function issueType(level?: string) {
  const map: Record<string, string> = {
    ERROR: 'danger',
    INFO: 'info',
    WARN: 'warning',
  };
  return map[level || ''] || 'info';
}

function issueTone(level?: string) {
  return issueType(level);
}

function resetPages() {
  issuesPage.value = 1;
  flowPage.value = 1;
  inspectionPage.value = 1;
  productReportPage.value = 1;
  wagePage.value = 1;
  pqc1Page.value = 1;
  instockPage.value = 1;
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  resetPages();
}

function stepTypeText(value?: string) {
  const map: Record<string, string> = {
    INSPECTION: '检验',
    PRODUCTION: '生产',
  };
  return map[value || ''] || value || '-';
}

function inspectionTypeText(value?: string) {
  const map: Record<string, string> = {
    FQC: '产品检验',
    IQC: '来料检验',
    LQC: '产线巡检',
    OQC: '出货检验',
    PQC: '中间工序检验',
  };
  return map[value || ''] || value || '-';
}

function compactContext(value: any) {
  if (!value || typeof value !== 'object') return '-';
  return Object.entries(value)
    .map(([key, item]) => `${key}=${item ?? '-'}`)
    .join('，');
}

function jumpToStage(stage: LifecycleStage) {
  const map: Record<LifecycleStage['key'], string> = {
    flow: 'flowCards',
    inspection: 'inspection',
    instock: 'instock',
    order: 'issues',
    pqc1: 'pqc1',
    productReport: 'productReport',
  };
  activeTab.value = map[stage.key];
}

function handleStageClick(stageKey: string) {
  if (!stageKey) return;
  const stage = stages.value.find((item) => item.key === stageKey);
  if (stage) jumpToStage(stage);
}

async function loadDiagnostics() {
  const orderNo = queryOrderNo.value.trim();
  if (!orderNo) {
    ElMessage.warning('请输入工单号');
    return;
  }
  loading.value = true;
  try {
    const res = await getOrderLifecycleDiagnostics(orderNo);
    if (!res.success) throw new Error(res.message || '获取工单生命周期诊断失败');
    diagnostics.value = res.data || null;
    resetPages();
    if (!diagnostics.value) {
      ElMessage.warning('未返回诊断数据');
      return;
    }
    ElMessage.success(res.message || '诊断完成');
  } catch (error: any) {
    diagnostics.value = null;
    ElMessage.error(error.message || '获取工单生命周期诊断失败');
  } finally {
    loading.value = false;
  }
}

async function copyRawJson() {
  if (!rawJson.value) return;
  await navigator.clipboard.writeText(rawJson.value);
  ElMessage.success('原始诊断 JSON 已复制');
}

onMounted(() => {
  if (queryOrderNo.value) {
    loadDiagnostics();
  }
});
</script>

<template>
  <V2DiagnosticsShell
    chain-title="关键单据链"
    :chains="chains"
    description="输入工单号，对照流转卡、检验、工资与入库记录，找出缺失记录、数量对不上和 ERP 推送失败的环节。原始诊断 JSON 可复制。"
    eyebrow="生产 · 工单诊断"
    issue-title="问题优先区"
    :issues="shellIssues"
    :metrics="metrics"
    :stages="shellStages"
    title="工单生命周期诊断"
    @stage-click="handleStageClick"
  >
    <template #actions>
      <el-tag :type="overallTone" size="small">
        {{ diagnosticRows.length ? '需关注' : '链路正常' }}
      </el-tag>
      <el-button size="small" type="primary" :loading="loading" @click="loadDiagnostics" :icon="'Refresh'">刷新</el-button>
      <el-button size="small" :disabled="!diagnostics" @click="copyRawJson" :icon="'CopyDocument'">复制 JSON</el-button>
    </template>

    <template #toolbar>
    <section class="query-panel">
      <div class="query-title">
        <strong>自定义筛选</strong>
        <span>输入工单号后查询同源链路，刷新按钮会使用当前条件重新加载</span>
      </div>
      <el-form class="query-form" inline>
        <el-form-item label="工单号">
          <el-input
            v-model="queryOrderNo"
            clearable
            placeholder="请输入工单号"
            style="width: 280px"
            @keyup.enter="loadDiagnostics"
          />
        </el-form-item>
        <el-form-item>
          <div class="toolbar-actions">
            <el-button type="primary" :loading="loading" @click="loadDiagnostics" :icon="'Refresh'">查询</el-button>
            <el-button :disabled="!diagnostics" @click="copyRawJson" :icon="'CopyDocument'">复制 JSON</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>
    </template>

    <el-empty v-if="!diagnostics && !loading" description="暂无诊断数据" />

    <div v-else v-loading="loading" class="diagnostics-content">
      <section class="detail-panel">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="诊断问题" name="issues">
            <el-table :data="pagedDiagnosticRows" border size="small" height="520" empty-text="未发现明显不一致">
              <el-table-column label="级别" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="issueType(row.level)" size="small">{{ row.level || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="code" label="编码" width="250" show-overflow-tooltip />
              <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
              <el-table-column label="上下文" min-width="320" show-overflow-tooltip>
                <template #default="{ row }">{{ compactContext(row.context) }}</template>
              </el-table-column>
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="issuesPage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="diagnosticRows.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="流转卡" name="flowCards">
            <el-table :data="pagedFlowCards" border stripe size="small" height="520">
              <el-table-column prop="batchCode" label="批次" width="150" show-overflow-tooltip />
              <el-table-column label="工序" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="cell-stack">
                    <strong>{{ row.stepNo }}. {{ row.stepName || '-' }}</strong>
                    <span>{{ row.processCode || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="类型/状态" width="160">
                <template #default="{ row }">
                  <div class="tag-line">
                    <el-tag size="small">{{ stepTypeText(row.stepType) }}</el-tag>
                    <el-tag :type="statusType(row.flowStatus)" size="small">{{ row.flowStatus || '-' }}</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="数量" min-width="210" show-overflow-tooltip>
                <template #default="{ row }">
                  投入 {{ formatInteger(row.inputQuantity) }} / 完成 {{ formatInteger(row.actualQuantity) }} / 良品 {{ formatInteger(row.goodQuantity) }}
                </template>
              </el-table-column>
              <el-table-column label="关联记录" min-width="230" show-overflow-tooltip>
                <template #default="{ row }">
                  检验 {{ row.inspectionTaskId ? `#${row.inspectionTaskId}` : '-' }} / 工资 {{ row.wageSettlementId ? `#${row.wageSettlementId}` : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="reportBillNo" label="流转卡生产汇报单" width="150" show-overflow-tooltip />
              <el-table-column label="完成时间" width="170">
                <template #default="{ row }">{{ formatTime(row.actualEndTime) }}</template>
              </el-table-column>
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="flowPage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="flowCards.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="检验任务" name="inspection">
            <el-table :data="pagedInspectionTasks" border stripe size="small" height="520">
              <el-table-column prop="id" label="任务ID" width="90" />
              <el-table-column label="检验类型" width="130">
                <template #default="{ row }">{{ inspectionTypeText(row.inspectionType) }}</template>
              </el-table-column>
              <el-table-column label="工序" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || '-' }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.taskStatus)" size="small">{{ row.taskStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="产品入库检验状态" width="130">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.erpPushStatus)" size="small">{{ row.erpPushStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpReportBillNo" label="生产汇报单号" width="150" show-overflow-tooltip />
              <el-table-column prop="erpInspectionBillNo" label="产品入库检验单号" width="150" show-overflow-tooltip />
              <el-table-column prop="lastError" label="失败信息" min-width="220" show-overflow-tooltip />
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="inspectionPage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="inspectionTasks.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="生产汇报单/工资" name="productReport">
            <el-table :data="pagedProductReportRows" border stripe size="small" height="420">
              <el-table-column prop="flowId" label="流转卡ID" width="100" />
              <el-table-column prop="batchCode" label="批次" width="150" show-overflow-tooltip />
              <el-table-column label="工序" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || '-' }}</template>
              </el-table-column>
              <el-table-column label="流转卡状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.flowStatus)" size="small">{{ row.flowStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="flowReportBillNo" label="流转卡生产汇报单" width="150" show-overflow-tooltip />
              <el-table-column prop="erpReportBillNo" label="工资生产汇报单" width="150" show-overflow-tooltip />
              <el-table-column prop="failureReason" label="失败信息" min-width="220" show-overflow-tooltip />
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="productReportPage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="productReportRows.length"
                @size-change="handleSizeChange"
              />
            </div>
            <el-divider />
            <el-table :data="pagedWageSettlements" border stripe size="small" height="360">
              <el-table-column prop="id" label="核算ID" width="90" />
              <el-table-column label="工序" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || '-' }}</template>
              </el-table-column>
              <el-table-column prop="operatorName" label="操作员" width="110" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.calcStatus)" size="small">{{ row.calcStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="金额" width="100" align="right">
                <template #default="{ row }">{{ formatNumber(row.wageAmount) }}</template>
              </el-table-column>
              <el-table-column prop="failureReason" label="失败信息" min-width="220" show-overflow-tooltip />
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="wagePage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="wageSettlements.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="产品入库检验" name="pqc1">
            <el-table :data="pagedPqc1Rows" border stripe size="small" height="520">
              <el-table-column prop="inspectionTaskId" label="检验任务ID" width="110" />
              <el-table-column label="检验类型" width="130">
                <template #default="{ row }">{{ inspectionTypeText(row.inspectionType) }}</template>
              </el-table-column>
              <el-table-column label="工序" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || '-' }}</template>
              </el-table-column>
              <el-table-column label="产品入库检验状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.erpPushStatus)" size="small">{{ row.erpPushStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpReportBillNo" label="生产汇报单号" width="150" show-overflow-tooltip />
              <el-table-column prop="erpInspectionBillNo" label="产品入库检验单号" width="150" show-overflow-tooltip />
              <el-table-column label="入库池" width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.instockTaskId">#{{ row.instockTaskId }} {{ row.instockTaskStatus }}</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="lastError" label="失败信息" min-width="220" show-overflow-tooltip />
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="pqc1Page"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="pqc1Rows.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="入库确认池" name="instock">
            <el-table :data="pagedInstockTasks" border stripe size="small" height="520">
              <el-table-column prop="id" label="任务ID" width="90" />
              <el-table-column prop="inspectionTaskId" label="检验任务" width="100" />
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.taskStatus)" size="small">{{ row.taskStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="数量" min-width="210" show-overflow-tooltip>
                <template #default="{ row }">
                  合格 {{ formatNumber(row.qualifiedQty) }} / 待入 {{ formatNumber(row.pendingQty) }} / 已入 {{ formatNumber(row.instockedQty) }}
                </template>
              </el-table-column>
              <el-table-column prop="erpReportBillNo" label="生产汇报单号" width="150" show-overflow-tooltip />
              <el-table-column prop="erpInspectionBillNo" label="产品入库检验单号" width="150" show-overflow-tooltip />
              <el-table-column prop="erpInstockBillNo" label="入库单号" width="150" show-overflow-tooltip />
              <el-table-column label="ERP状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.erpBillStatus)" size="small">{{ row.erpBillStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="lastError" label="失败信息" min-width="220" show-overflow-tooltip />
            </el-table>
            <div class="pagination-row">
              <el-pagination
                v-model:current-page="instockPage"
                v-model:page-size="pageSize"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="instockTasks.length"
                @size-change="handleSizeChange"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="原始JSON" name="raw">
            <pre class="json-view">{{ rawJson }}</pre>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </V2DiagnosticsShell>
</template>

<style scoped>
.query-panel {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.query-title,
.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.query-title strong {
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.query-title span,
.cell-stack span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-bottom: -18px;
}

.toolbar-actions,
.tag-line {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.diagnostics-content {
  min-height: 220px;
}

.detail-panel {
  margin-top: 6px;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.detail-panel :deep(.el-tabs__header) {
  margin-bottom: 8px;
}

.detail-panel :deep(.el-divider--horizontal) {
  margin: 10px 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.json-view {
  max-height: 520px;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

@media (max-width: 760px) {
  .query-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .query-form {
    justify-content: flex-start;
  }
}
</style>
