<script lang="ts" setup>
import type { LifecycleStage, LifecycleTone } from './order-lifecycle-diagnostics-v2-model';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getOrderLifecycleDiagnostics } from '#/api/production';

import {
  buildIssueGroups,
  buildLifecycleStages,
  summarizeRecords,
} from './order-lifecycle-diagnostics-v2-model';

defineOptions({ name: 'OrderLifecycleDiagnostics' });

const route = useRoute();
const loading = ref(false);
const activeTab = ref('flowCards');
const queryOrderNo = ref(String(route.query.orderNo || route.query.orderNoEq || '').trim());
const diagnostics = ref<Record<string, any> | null>(null);

const summary = computed<Record<string, any>>(() => diagnostics.value?.summary || {});
const order = computed<Record<string, any>>(() => diagnostics.value?.order || {});
const diagnosticRows = computed<any[]>(() => toArray(diagnostics.value?.diagnostics));
const flowCards = computed<any[]>(() => toArray(diagnostics.value?.flowCards));
const inspectionTasks = computed<any[]>(() => toArray(diagnostics.value?.inspectionTasks));
const wageSettlements = computed<any[]>(() => toArray(diagnostics.value?.wageSettlements));
const r1Rows = computed<any[]>(() => toArray(diagnostics.value?.productReport?.rows || diagnostics.value?.r1?.rows));
const pqc1Rows = computed<any[]>(() => toArray(diagnostics.value?.pqc1?.rows));
const instockTasks = computed<any[]>(() => toArray(diagnostics.value?.instockTasks));
const rawJson = computed(() => (diagnostics.value ? JSON.stringify(diagnostics.value, null, 2) : ''));
const stages = computed(() => buildLifecycleStages(diagnostics.value || {}));
const issueGroups = computed(() => buildIssueGroups(diagnostics.value || {}));
const recordSummary = computed(() => summarizeRecords(diagnostics.value || {}));
const topIssues = computed(() => diagnosticRows.value.slice(0, 4));
const billTrace = computed(() => ({
  erpOrderNo: order.value.erpOrderNo || '-',
  instockBillNo: firstText(instockTasks.value, 'erpInstockBillNo'),
  pqc1BillNo: firstText(pqc1Rows.value, 'erpInspectionBillNo'),
  r1BillNo: firstText(r1Rows.value, 'erpReportBillNo') || firstText(r1Rows.value, 'flowReportBillNo'),
}));
const overallTone = computed<LifecycleTone>(() => {
  if (recordSummary.value.errorRecords > 0) return 'danger';
  if (diagnosticRows.value.length > 0) return 'warning';
  if (stages.value.some((stage) => stage.tone === 'primary')) return 'primary';
  return 'success';
});

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

function stagePercent(stage: LifecycleStage) {
  if (!stage.total) return 0;
  return Math.min(100, Math.round((stage.done / stage.total) * 100));
}

function stageClass(tone: LifecycleTone) {
  return `stage-node stage-node--${tone}`;
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
  <div class="order-lifecycle-v2-page">
    <section class="query-panel">
      <div class="query-title">
        <strong>工单生命周期诊断</strong>
        <span>同源数据 · 阶段轨道 · 问题优先 · 单据追溯</span>
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

    <el-empty v-if="!diagnostics && !loading" description="暂无诊断数据" />

    <div v-else v-loading="loading" class="diagnostics-content">
      <section class="command-panel">
        <div class="command-main">
          <span class="eyebrow">当前工单</span>
          <strong>{{ order.orderNo || '-' }}</strong>
          <p>{{ order.productCode || '-' }} · {{ order.productName || '未返回产品名称' }}</p>
        </div>
        <div class="command-metrics">
          <div>
            <span>计划数</span>
            <strong>{{ formatInteger(summary.planQty) }}</strong>
          </div>
          <div>
            <span>末道良品</span>
            <strong>{{ formatInteger(summary.terminalCompletedQtyFromFlows) }}</strong>
          </div>
          <div>
            <span>诊断问题</span>
            <strong>{{ diagnosticRows.length }}</strong>
          </div>
          <div>
            <span>错误记录</span>
            <strong>{{ recordSummary.errorRecords }}</strong>
          </div>
        </div>
        <el-tag :type="overallTone" size="large">
          {{ diagnosticRows.length ? '需关注' : '链路正常' }}
        </el-tag>
      </section>

      <section class="stage-panel">
        <div class="section-header">
          <strong>生命周期阶段轨道</strong>
          <span>点击阶段可跳转到对应明细</span>
        </div>
        <div class="stage-rail">
          <button v-for="stage in stages" :key="stage.key" :class="stageClass(stage.tone)" type="button" @click="jumpToStage(stage)">
            <span class="stage-label">{{ stage.label }}</span>
            <strong>{{ stage.done }} / {{ stage.total }}</strong>
            <el-progress :percentage="stagePercent(stage)" :show-text="false" :stroke-width="6" />
            <span class="stage-desc">{{ stage.description }}</span>
            <em v-if="stage.issueCount">{{ stage.issueCount }} 个问题</em>
          </button>
        </div>
      </section>

      <section class="attention-grid">
        <div class="attention-panel">
          <div class="section-header">
            <strong>问题优先</strong>
            <el-tag :type="diagnosticRows.length ? 'warning' : 'success'" size="small">
              {{ diagnosticRows.length ? `${diagnosticRows.length} 项` : '未发现问题' }}
            </el-tag>
          </div>
          <div v-if="issueGroups.length" class="issue-groups">
            <div v-for="group in issueGroups" :key="group.key" class="issue-group">
              <span>{{ group.label }}</span>
              <strong>{{ group.count }}</strong>
            </div>
          </div>
          <el-empty v-else description="暂无诊断问题" :image-size="56" />
        </div>

        <div class="attention-panel">
          <div class="section-header">
            <strong>记录覆盖</strong>
            <span>流转/检验/工资/入库</span>
          </div>
          <div class="coverage-grid">
            <div><span>流转卡</span><strong>{{ recordSummary.flowCount }}</strong></div>
            <div><span>检验</span><strong>{{ recordSummary.inspectionCount }}</strong></div>
            <div><span>工资</span><strong>{{ recordSummary.wageCount }}</strong></div>
            <div><span>入库</span><strong>{{ recordSummary.instockCount }}</strong></div>
          </div>
        </div>

        <div class="attention-panel">
          <div class="section-header">
            <strong>关键单据链</strong>
            <span>首个可追溯单号</span>
          </div>
          <dl class="bill-list">
            <div><dt>ERP工单</dt><dd>{{ billTrace.erpOrderNo }}</dd></div>
            <div><dt>生产汇报单</dt><dd>{{ billTrace.r1BillNo }}</dd></div>
            <div><dt>产品入库检验</dt><dd>{{ billTrace.pqc1BillNo }}</dd></div>
            <div><dt>入库单</dt><dd>{{ billTrace.instockBillNo }}</dd></div>
          </dl>
        </div>
      </section>

      <section v-if="topIssues.length" class="issue-strip">
        <div v-for="issue in topIssues" :key="issue.code" class="issue-card">
          <el-tag :type="issueType(issue.level)" size="small">{{ issue.level || 'INFO' }}</el-tag>
          <strong>{{ issue.code }}</strong>
          <span>{{ issue.message }}</span>
        </div>
      </section>

      <section class="detail-panel">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="诊断问题" name="issues">
            <el-table :data="diagnosticRows" border size="small" empty-text="未发现明显不一致">
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
          </el-tab-pane>

          <el-tab-pane label="流转卡" name="flowCards">
            <el-table :data="flowCards" border stripe size="small" max-height="520">
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
          </el-tab-pane>

          <el-tab-pane label="检验任务" name="inspection">
            <el-table :data="inspectionTasks" border stripe size="small" max-height="520">
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
          </el-tab-pane>

          <el-tab-pane label="生产汇报单/工资" name="r1">
            <el-table :data="r1Rows" border stripe size="small" max-height="520">
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
            <el-divider />
            <el-table :data="wageSettlements" border stripe size="small" max-height="360">
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
          </el-tab-pane>

          <el-tab-pane label="产品入库检验" name="pqc1">
            <el-table :data="pqc1Rows" border stripe size="small" max-height="520">
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
          </el-tab-pane>

          <el-tab-pane label="入库确认池" name="instock">
            <el-table :data="instockTasks" border stripe size="small" max-height="520">
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
          </el-tab-pane>

          <el-tab-pane label="原始JSON" name="raw">
            <pre class="json-view">{{ rawJson }}</pre>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </div>
</template>

<style scoped>
.order-lifecycle-v2-page {
  padding: 16px;
}

.query-panel,
.command-panel,
.stage-panel,
.attention-panel,
.issue-strip,
.detail-panel {
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.query-panel {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.query-title,
.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.query-title strong {
  font-size: 18px;
  color: #111827;
}

.query-title span,
.section-header span,
.command-main p,
.command-metrics span,
.stage-desc,
.cell-stack span,
.bill-list dt {
  font-size: 12px;
  color: #6b7280;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.command-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(360px, 2fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border-left: 4px solid #2563eb;
}

.command-main {
  min-width: 0;
}

.command-main strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  font-size: 24px;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eyebrow {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
}

.command-metrics,
.coverage-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(80px, 1fr));
  gap: 10px;
}

.command-metrics div,
.coverage-grid div {
  min-width: 0;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 6px;
}

.command-metrics strong,
.coverage-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  color: #111827;
}

.stage-panel,
.detail-panel {
  padding: 14px 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-header strong {
  color: #111827;
}

.stage-rail {
  display: grid;
  grid-template-columns: repeat(6, minmax(140px, 1fr));
  gap: 10px;
}

.stage-node {
  display: flex;
  min-height: 128px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  flex-direction: column;
  gap: 8px;
}

.stage-node strong {
  font-size: 20px;
  color: #111827;
}

.stage-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.stage-node em {
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
}

.stage-node--success {
  border-color: #bbf7d0;
}

.stage-node--primary {
  border-color: #bfdbfe;
}

.stage-node--warning {
  border-color: #fde68a;
  background: #fffbeb;
}

.stage-node--danger {
  border-color: #fecaca;
  background: #fef2f2;
}

.attention-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
}

.attention-panel {
  min-height: 150px;
  padding: 14px 16px;
}

.issue-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 6px;
}

.bill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.bill-list div {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.bill-list dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-weight: 600;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  padding: 12px;
}

.issue-card {
  display: grid;
  grid-template-columns: auto minmax(120px, 180px) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
}

.issue-card strong,
.issue-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.json-view {
  max-height: 520px;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  color: #1f2937;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

@media (max-width: 1200px) {
  .command-panel,
  .attention-grid {
    grid-template-columns: 1fr;
  }

  .stage-rail {
    grid-template-columns: repeat(3, minmax(160px, 1fr));
  }
}

@media (max-width: 760px) {
  .query-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .query-form {
    justify-content: flex-start;
  }

  .command-metrics,
  .coverage-grid,
  .stage-rail {
    grid-template-columns: 1fr 1fr;
  }

  .issue-card {
    grid-template-columns: 1fr;
  }
}
</style>
