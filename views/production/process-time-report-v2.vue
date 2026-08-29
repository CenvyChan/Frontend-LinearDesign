<script lang="ts" setup>
import type { ProcessTimeReportResult, ProcessTimeReportRow } from '#/api/processTimeReport';
import type { ProcessTimeReportV2StageKey } from './process-time-report-v2-model';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { queryProcessTimeReport } from '#/api/processTimeReport';

import {
  buildProcessTimeReportV2Model,
  filterRowsByProcessTimeStage,
  paginateProcessTimeRows,
} from './process-time-report-v2-model';

defineOptions({ name: 'ProcessTimeReportV2' });

const loading = ref(false);
const overviewExpanded = ref(false);
const overviewHidden = ref(false);
const activeStage = ref<ProcessTimeReportV2StageKey>('');
const currentPage = ref(1);
const pageSize = ref(20);
const report = ref<ProcessTimeReportResult>({
  rows: [],
  summary: {
    abnormalCount: 0,
    normalCount: 0,
    totalCount: 0,
    totalQuantity: 0,
  },
});
const queryForm = reactive({
  operatorName: '',
  orderNo: '',
  processKeyword: '',
  timeRange: [] as number[],
});

const model = computed(() => buildProcessTimeReportV2Model(report.value));
const rows = computed<ProcessTimeReportRow[]>(() => report.value.rows || []);
const filteredRows = computed(() => filterRowsByProcessTimeStage(rows.value, activeStage.value));
const pagedRows = computed(() => paginateProcessTimeRows(filteredRows.value, currentPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '报工记录', value: formatInteger(model.value.summary.totalCount) },
  { label: '完成数量', tone: 'success', value: formatInteger(model.value.summary.totalQuantity) },
  { label: '正常记录', tone: 'success', value: formatInteger(report.value.summary.normalCount) },
  { label: '异常记录', tone: report.value.summary.abnormalCount > 0 ? 'danger' : 'success', value: formatInteger(report.value.summary.abnormalCount) },
  { label: '异常占比', tone: model.value.summary.abnormalRate > 0 ? 'danger' : 'success', value: `${formatNumber(model.value.summary.abnormalRate)}%` },
  { label: '总体效率', tone: model.value.summary.efficiencyRate >= 90 ? 'success' : 'warning', value: `${formatNumber(model.value.summary.efficiencyRate)}%` },
  { label: '偏差分钟', tone: model.value.summary.totalVarianceMinutes > 0 ? 'warning' : 'success', value: formatNumber(model.value.summary.totalVarianceMinutes) },
]);
const chains = computed(() => rows.value
  .filter((row) => row.anomalyLevel && row.anomalyLevel !== 'NORMAL')
  .slice(0, overviewExpanded.value ? 8 : 3)
  .map((row) => ({
    key: row.flowId,
    primary: row.orderNo || '-',
    secondary: row.stepName || row.processCode || '-',
    status: row.anomalyText || row.anomalyLevel,
    tone: ['SEVERE', 'NO_STANDARD', 'NO_ACTUAL_TIME'].includes(row.anomalyLevel) ? 'danger' : 'warning',
  })));

function metricClass(tone?: string) {
  return tone ? `metric-chip--${tone}` : '';
}

function tagType(tone?: string) {
  const map: Record<string, string> = {
    danger: 'danger',
    success: 'success',
    warning: 'warning',
  };
  return map[tone || ''] || 'info';
}

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
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

function anomalyType(level?: string) {
  const map: Record<string, string> = {
    MAJOR: 'warning',
    MINOR: 'info',
    NO_ACTUAL_TIME: 'danger',
    NO_QUANTITY: 'danger',
    NO_STANDARD: 'danger',
    NORMAL: 'success',
    SEVERE: 'danger',
  };
  return map[level || ''] || 'info';
}

function activeStageText() {
  if (!activeStage.value) return '全部记录';
  return model.value.stages.find((stage) => stage.key === activeStage.value)?.label || '阶段筛选';
}

function toggleStage(stageKey: ProcessTimeReportV2StageKey) {
  activeStage.value = activeStage.value === stageKey ? '' : stageKey;
  currentPage.value = 1;
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function loadData() {
  loading.value = true;
  try {
    const [startTime, endTime] = queryForm.timeRange || [];
    const res: any = await queryProcessTimeReport({
      endTime,
      operatorName: queryForm.operatorName || undefined,
      orderNo: queryForm.orderNo || undefined,
      processKeyword: queryForm.processKeyword || undefined,
      startTime,
    });
    report.value = {
      rows: res?.rows || [],
      summary: res?.summary || {
        abnormalCount: 0,
        normalCount: 0,
        totalCount: 0,
        totalQuantity: 0,
      },
    };
    currentPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取工时节拍报表失败');
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  queryForm.operatorName = '';
  queryForm.orderNo = '';
  queryForm.processKeyword = '';
  queryForm.timeRange = [];
  activeStage.value = '';
  currentPage.value = 1;
  loadData();
}

onMounted(loadData);
</script>

<template>
  <div class="process-time-report-v2-page">
    <section class="title-banner">
      <div class="title-copy">
        <span class="eyebrow">Process Takt</span>
        <div class="title-line">
          <h2>工时节拍报表</h2>
          <el-tooltip
            content="对比标准工时、实际工时、节拍偏差和异常原因；流程轨道可点击筛选下方列表。"
            effect="dark"
            placement="bottom-start"
          >
            <span class="help-mark" tabindex="0">?</span>
          </el-tooltip>
        </div>
      </div>
      <div class="banner-actions">
        <el-button v-if="overviewHidden" size="small" @click="overviewHidden = false">显示概览</el-button>
        <el-button v-else size="small" @click="overviewExpanded = !overviewExpanded">
          {{ overviewExpanded ? '缩小概览' : '展开概览' }}
        </el-button>
        <el-button v-if="!overviewHidden" size="small" @click="overviewHidden = true">隐藏概览</el-button>
        <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
      </div>
    </section>

    <section v-if="!overviewHidden" class="overview-panel" :class="{ 'overview-panel--expanded': overviewExpanded }">
      <div class="overview-head">
        <div>
          <strong>运行概览</strong>
          <span>{{ activeStageText() }}</span>
        </div>
        <el-tag size="small" :type="activeStage ? 'warning' : 'info'">{{ filteredRows.length }} / {{ rows.length }}</el-tag>
      </div>

      <div class="metric-row">
        <button
          v-for="metric in metrics"
          :key="metric.label"
          class="metric-chip"
          :class="metricClass(metric.tone)"
          type="button"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </button>
      </div>

      <div class="diagnostic-row">
        <div class="stage-track">
          <el-tooltip
            v-for="stage in model.stages"
            :key="stage.key"
            :content="stage.description"
            effect="dark"
            placement="top"
          >
            <button
              class="stage-pill"
              :class="[`stage-pill--${stage.tone}`, { 'stage-pill--active': activeStage === stage.key }]"
              type="button"
              @click="toggleStage(stage.key)"
            >
              <span>{{ stage.label }}</span>
              <strong>{{ formatNumber(stage.value) }}</strong>
            </button>
          </el-tooltip>
        </div>

        <div class="priority-strip">
          <div class="strip-title">
            <strong>优先区</strong>
            <el-tag size="small" :type="activeStage ? 'warning' : 'info'">{{ activeStageText() }}</el-tag>
          </div>
          <div v-if="model.issueGroups.length" class="issue-row">
            <el-tag
              v-for="issue in model.issueGroups.slice(0, overviewExpanded ? 4 : 2)"
              :key="issue.key"
              :type="tagType(issue.tone)"
              size="small"
            >
              {{ issue.label }} {{ issue.count }}
            </el-tag>
          </div>
          <span v-else class="muted-text">暂无异常</span>
        </div>

        <div class="chain-strip">
          <div class="strip-title">
            <strong>异常工序链路</strong>
            <span>{{ chains.length }} 条</span>
          </div>
          <div v-if="chains.length" class="chain-row">
            <div v-for="chain in chains" :key="chain.key" class="chain-item">
              <span>{{ chain.primary }}</span>
              <strong>{{ chain.secondary }}</strong>
              <el-tag :type="tagType(chain.tone)" size="small">{{ chain.status }}</el-tag>
            </div>
          </div>
          <span v-else class="muted-text">暂无链路</span>
        </div>
      </div>
    </section>

    <section class="filter-panel">
      <div class="filter-fields">
        <el-date-picker
          v-model="queryForm.timeRange"
          class="filter-date"
          end-placeholder="结束时间"
          range-separator="至"
          start-placeholder="开始时间"
          type="datetimerange"
          value-format="x"
        />
        <el-input v-model="queryForm.orderNo" clearable placeholder="工单号" />
        <el-input v-model="queryForm.operatorName" clearable placeholder="员工" />
        <el-input v-model="queryForm.processKeyword" clearable placeholder="工序名称/代码" />
      </div>
      <div class="filter-actions">
        <el-button type="primary" @click="loadData" :icon="'Refresh'">查询</el-button>
        <el-button @click="resetQuery" :icon="'RefreshRight'">重置</el-button>
      </div>
    </section>

    <section class="table-panel">
      <div class="table-meta">
        <div>
          <strong>明细列表</strong>
          <span>当前筛选：{{ activeStageText() }}</span>
        </div>
        <strong>{{ filteredRows.length }} / {{ rows.length }}</strong>
      </div>
      <div class="table-scroll">
        <el-table :data="pagedRows" v-loading="loading" border height="100%" size="small" stripe>
          <el-table-column label="工单/产品" min-width="210" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <strong>{{ row.orderNo || '-' }}</strong>
                <span>{{ row.productName || row.productCode || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="工序" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <strong>{{ row.stepNo }}. {{ row.stepName || '-' }}</strong>
                <span>{{ row.processCode || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="员工" width="110" />
          <el-table-column label="完成时间" width="170">
            <template #default="{ row }">{{ formatTime(row.actualEndTime) }}</template>
          </el-table-column>
          <el-table-column prop="actualQuantity" label="完成" width="80" align="right" />
          <el-table-column prop="defectQuantity" label="不良" width="80" align="right" />
          <el-table-column label="标准(分)" width="110" align="right">
            <template #default="{ row }">{{ formatNumber(row.standardMinutes) }}</template>
          </el-table-column>
          <el-table-column label="实际(分)" width="110" align="right">
            <template #default="{ row }">{{ formatNumber(row.actualMinutes) }}</template>
          </el-table-column>
          <el-table-column label="偏差(分)" width="110" align="right">
            <template #default="{ row }">
              <span :class="Number(row.varianceMinutes || 0) > 0 ? 'danger-text' : 'success-text'">
                {{ formatNumber(row.varianceMinutes) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="效率" width="95" align="right">
            <template #default="{ row }">{{ formatNumber(row.efficiencyRate) }}%</template>
          </el-table-column>
          <el-table-column label="异常" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-tag :type="anomalyType(row.anomalyLevel)" size="small">{{ row.anomalyText || row.anomalyLevel }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
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
  </div>
</template>

<style scoped>
.process-time-report-v2-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 10px;
  overflow: auto;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}

.title-banner,
.overview-panel,
.filter-panel,
.table-panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.title-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 8px 12px;
  border-left: 3px solid var(--el-color-primary);
}

.title-copy {
  min-width: 0;
}

.eyebrow {
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.title-line,
.banner-actions,
.filter-panel,
.table-meta,
.pagination-row,
.strip-title,
.issue-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-line h2 {
  overflow: hidden;
  margin: 2px 0 0;
  font-size: 16px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: help;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
}

.banner-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.overview-panel {
  padding: 8px;
}

.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.overview-head > div {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 8px;
}

.overview-head strong,
.table-meta strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.overview-head span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.metric-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 34px;
  padding: 6px 10px;
  color: var(--el-text-color-primary);
  cursor: default;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--el-border-color-lighter);
  border-radius: 0;
}

.metric-chip:last-child {
  border-right: 0;
}

.metric-chip span,
.stage-pill span,
.muted-text,
.strip-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-chip strong,
.stage-pill strong {
  overflow: hidden;
  font-size: 14px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-chip--danger strong,
.danger-text {
  color: var(--el-color-danger);
}

.metric-chip--success strong,
.success-text {
  color: var(--el-color-success);
}

.metric-chip--warning strong {
  color: var(--el-color-warning);
}

.diagnostic-row {
  display: grid;
  grid-template-columns: minmax(460px, 1.18fr) minmax(250px, 0.62fr) minmax(360px, 0.9fr);
  gap: 8px;
  margin-top: 6px;
}

.stage-track,
.priority-strip,
.chain-strip {
  min-width: 0;
  padding: 6px 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stage-track {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  align-content: start;
}

.stage-pill {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 42px;
  gap: 2px 6px;
  padding: 6px 8px 5px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-top: 2px solid var(--el-color-info);
  border-radius: 5px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.stage-pill:hover {
  transform: translateY(-1px);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 10px rgb(0 0 0 / 5%);
}

.stage-pill--active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
}

.stage-pill--danger {
  border-top-color: var(--el-color-danger);
}

.stage-pill--success {
  border-top-color: var(--el-color-success);
}

.stage-pill--warning {
  border-top-color: var(--el-color-warning);
}

.strip-title {
  justify-content: space-between;
  min-height: 22px;
  margin-bottom: 5px;
}

.strip-title strong {
  font-size: 13px;
}

.issue-row {
  flex-wrap: wrap;
}

.chain-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
  max-height: 82px;
  overflow: auto;
}

.chain-item {
  display: grid;
  grid-template-columns: minmax(82px, 0.8fr) minmax(84px, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 2px 5px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
}

.chain-item span,
.chain-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chain-item span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.chain-item strong {
  font-size: 12px;
}

.filter-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
}

.filter-fields {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) 150px 130px 180px;
  flex: 1;
  gap: 8px;
  min-width: 0;
}

.filter-fields :deep(.el-input),
.filter-fields :deep(.el-select),
.filter-fields :deep(.el-date-editor) {
  width: 100%;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.table-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 390px;
  padding: 8px 10px 10px;
  overflow: hidden;
}

.table-meta {
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.table-meta > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.table-scroll {
  flex: 1;
  overflow: hidden;
  min-height: 260px;
}

.table-scroll :deep(.el-table__header .cell),
.table-scroll :deep(.el-table__body .cell) {
  padding: 0 6px;
  line-height: 18px;
}

.table-scroll :deep(.el-table__header th.el-table__cell),
.table-scroll :deep(.el-table__body td.el-table__cell) {
  padding: 3px 0;
}

.table-scroll :deep(.el-table__row) {
  height: 32px;
}

.table-scroll :deep(.el-tag) {
  height: 20px;
  padding: 0 6px;
  line-height: 18px;
}

.pagination-row {
  justify-content: flex-end;
  padding-top: 7px;
}

.inline-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.inline-info strong,
.inline-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-info span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.inline-info span::before {
  margin-right: 6px;
  color: var(--el-border-color);
  content: '|';
}

@media (max-width: 1280px) {
  .metric-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .diagnostic-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .title-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .banner-actions {
    justify-content: flex-start;
  }

  .metric-row,
  .stage-track {
    grid-template-columns: 1fr;
  }
}
</style>
