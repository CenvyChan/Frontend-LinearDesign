<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getOrderLifecycleDiagnostics } from '#/api/production';

defineOptions({ name: 'OrderLifecycleDiagnosticsLegacy' });

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
const rawJson = computed(() => diagnostics.value ? JSON.stringify(diagnostics.value, null, 2) : '');

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
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
  <div class="order-lifecycle-page">
    <section class="query-panel">
      <div class="query-title">
        <strong>工单生命周期诊断</strong>
        <span>流转卡、检验任务、工资核算、生产汇报单/产品入库检验、入库确认池</span>
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
          <el-button type="primary" :loading="loading" @click="loadDiagnostics" :icon="'Refresh'">查询</el-button>
          <el-button :disabled="!diagnostics" @click="copyRawJson" :icon="'CopyDocument'">复制 JSON</el-button>
        </el-form-item>
      </el-form>
    </section>

    <el-empty v-if="!diagnostics && !loading" description="暂无诊断数据" />

    <div v-else v-loading="loading" class="diagnostics-content">
      <section class="summary-grid">
        <div class="summary-item">
          <span>工单号</span>
          <strong>{{ order.orderNo || '-' }}</strong>
        </div>
        <div class="summary-item">
          <span>计划数量</span>
          <strong>{{ formatInteger(summary.planQty) }}</strong>
        </div>
        <div class="summary-item">
          <span>工单完成数</span>
          <strong>{{ formatInteger(summary.orderCompletedQty) }}</strong>
        </div>
        <div class="summary-item">
          <span>末道完成数</span>
          <strong>{{ formatInteger(summary.terminalCompletedQtyFromFlows) }}</strong>
        </div>
        <div class="summary-item">
          <span>流转卡</span>
          <strong>{{ formatInteger(summary.flowCount) }}</strong>
        </div>
        <div class="summary-item">
          <span>检验任务</span>
          <strong>{{ formatInteger(summary.inspectionTaskCount) }}</strong>
        </div>
        <div class="summary-item">
          <span>工资核算</span>
          <strong>{{ formatInteger(summary.wageSettlementCount) }}</strong>
        </div>
        <div class="summary-item">
          <span>入库池</span>
          <strong>{{ formatInteger(summary.instockTaskCount) }}</strong>
        </div>
      </section>

      <section class="issue-panel">
        <div class="section-header">
          <strong>诊断结果</strong>
          <el-tag :type="diagnosticRows.length ? 'warning' : 'success'" size="small">
            {{ diagnosticRows.length ? `${diagnosticRows.length} 项需关注` : '未发现明显不一致' }}
          </el-tag>
        </div>
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
      </section>

      <section class="detail-panel">
        <el-tabs v-model="activeTab">
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
              <el-table-column label="类型/状态" width="150">
                <template #default="{ row }">
                  <div class="tag-line">
                    <el-tag size="small">{{ stepTypeText(row.stepType) }}</el-tag>
                    <el-tag :type="statusType(row.flowStatus)" size="small">{{ row.flowStatus || '-' }}</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="数量" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">
                  投入 {{ formatInteger(row.inputQuantity) }} / 完成 {{ formatInteger(row.actualQuantity) }} / 良品 {{ formatInteger(row.goodQuantity) }}
                </template>
              </el-table-column>
              <el-table-column label="检验任务" width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.inspectionTaskId">#{{ row.inspectionTaskId }} {{ row.inspectionTaskStatus }}</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="工资核算" width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.wageSettlementId">#{{ row.wageSettlementId }} {{ row.wageCalcStatus }}</span>
                  <span v-else>-</span>
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
              <el-table-column prop="inspectionResult" label="结果" width="110" />
              <el-table-column label="数量" min-width="150">
                <template #default="{ row }">
                  检验 {{ formatInteger(row.actualQuantity) }} / 不良 {{ formatInteger(row.defectQuantity) }}
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

          <el-tab-pane label="工资核算" name="wage">
            <el-table :data="wageSettlements" border stripe size="small" max-height="520">
              <el-table-column prop="id" label="核算ID" width="90" />
              <el-table-column label="工序" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || '-' }}</template>
              </el-table-column>
              <el-table-column prop="operatorName" label="操作员" width="110" />
              <el-table-column label="数量" min-width="160">
                <template #default="{ row }">
                  完成 {{ formatInteger(row.actualQuantity) }} / 良品 {{ formatInteger(row.goodQuantity) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.calcStatus)" size="small">{{ row.calcStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="金额" width="100" align="right">
                <template #default="{ row }">{{ formatNumber(row.wageAmount) }}</template>
              </el-table-column>
              <el-table-column prop="erpReportBillNo" label="生产汇报单号" width="150" show-overflow-tooltip />
              <el-table-column prop="failureReason" label="失败信息" min-width="220" show-overflow-tooltip />
              <el-table-column prop="rejectReason" label="驳回原因" min-width="180" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="生产汇报单" name="r1">
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
              <el-table-column label="工资状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.calcStatus)" size="small">{{ row.calcStatus || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpReportBillNo" label="工资生产汇报单" width="150" show-overflow-tooltip />
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
              <el-table-column label="检验状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.taskStatus)" size="small">{{ row.taskStatus || '-' }}</el-tag>
                </template>
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
.order-lifecycle-page {
  padding: 16px;
}

.query-panel,
.issue-panel,
.detail-panel {
  margin-bottom: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.query-panel {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.query-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 260px;
}

.query-title strong {
  font-size: 18px;
  color: #1f2937;
}

.query-title span,
.summary-item span,
.cell-stack span {
  font-size: 12px;
  color: #6b7280;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.diagnostics-content {
  min-height: 220px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 64px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.summary-item strong {
  font-size: 20px;
  color: #111827;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.tag-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

@media (max-width: 900px) {
  .query-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .query-form {
    justify-content: flex-start;
  }
}
</style>
