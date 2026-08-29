<script lang="ts" setup>
import type {
  DashboardRiskRow,
  DashboardStage,
  ProductionClosureAnalyticsResult,
} from '#/api/dashboard';
import type { DashboardOverviewV2Scenario } from '../overview-v2/overview-v2-model';

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createIconifyIcon } from '@vben/icons';

import { getProductionClosureAnalytics } from '#/api/dashboard';

import DashboardScenarioHeader from '../overview-v2/DashboardScenarioHeader.vue';
import {
  getDashboardScenarioRoute,
  getDashboardScenariosByGroup,
  getNormalizedDashboardScenarioCode,
  isImplementedDashboardScenario,
  resolveDashboardScenario,
} from '../overview-v2/overview-v2-model';

defineOptions({ name: 'DashboardAnalyticsV2' });

const route = useRoute();
const router = useRouter();
const WarningIcon = createIconifyIcon('lucide:triangle-alert');
const EmptyIcon = createIconifyIcon('lucide:panel-top-dashed');
const TrendIcon = createIconifyIcon('lucide:chart-column-big');
const QualityIcon = createIconifyIcon('lucide:shield-alert');

const scenarios = getDashboardScenariosByGroup('analytics');
const loading = ref(false);
const errorMessage = ref('');
const analyticsData = ref<ProductionClosureAnalyticsResult | null>(null);
let lastAutoLoadedScenarioCode = '';

const normalizedScenarioCode = computed(() =>
  getNormalizedDashboardScenarioCode('analytics', route.query.scenario),
);
const currentScenario = computed(() =>
  resolveDashboardScenario('analytics', normalizedScenarioCode.value),
);
const currentScenarioCode = computed(() => currentScenario.value.code);
const implementedScenario = computed(() => isImplementedDashboardScenario(currentScenarioCode.value));

const isA1 = computed(() => currentScenarioCode.value === 'A1');
const isA2 = computed(() => currentScenarioCode.value === 'A2');
const isA3 = computed(() => currentScenarioCode.value === 'A3');
const isA4 = computed(() => currentScenarioCode.value === 'A4');
const isA5 = computed(() => currentScenarioCode.value === 'A5');
const isA6 = computed(() => currentScenarioCode.value === 'A6');

const metrics = computed(() => analyticsData.value?.metrics || {});
const stages = computed(() => analyticsData.value?.stages || []);
const blockerRows = computed(() => analyticsData.value?.blockerRows || []);
const blockerGroups = computed(() => analyticsData.value?.blockerGroups || []);
const attainmentTrend = computed(() => analyticsData.value?.attainmentTrend || []);
const delayBuckets = computed(() => analyticsData.value?.delayBuckets || []);
const workshopRows = computed(() => analyticsData.value?.workshopRows || []);
const deliveryRiskRows = computed(() => analyticsData.value?.deliveryRiskRows || []);
const defectPareto = computed(() => analyticsData.value?.defectPareto || []);
const inspectionSummary = computed(() => analyticsData.value?.inspectionSummary || []);
const inspectionTrend = computed(() => analyticsData.value?.inspectionTrend || []);
const pushExceptionRows = computed(() => analyticsData.value?.pushExceptionRows || []);
const erpStageSummary = computed(() => analyticsData.value?.erpStageSummary || []);
const billChainNodes = computed(() => analyticsData.value?.billChainNodes || []);
const erpFailureReasons = computed(() => analyticsData.value?.erpFailureReasons || []);
const auditWaitingRows = computed(() => analyticsData.value?.auditWaitingRows || []);
const warehouseHeatmapRows = computed(() => analyticsData.value?.warehouseHeatmapRows || []);
const warehouseTaskStatusRows = computed(() => analyticsData.value?.warehouseTaskStatusRows || []);
const workloadRows = computed(() => analyticsData.value?.workloadRows || []);
const hourVarianceRows = computed(() => analyticsData.value?.hourVarianceRows || []);
const exceptionTimeRows = computed(() => analyticsData.value?.exceptionTimeRows || []);

const a1MetricCards = computed(() => [
  { label: '进入闭环工单', value: valueOf('startedOrderCount'), unit: '单' },
  { label: '已闭环工单', value: valueOf('closedOrderCount'), unit: '单' },
  { label: '闭环率', value: valueOf('closureRate'), unit: '%' },
  { label: 'ERP 失败', value: valueOf('erpFailedCount'), unit: '项' },
  { label: '待检/检验中', value: valueOf('pendingInspectionCount'), unit: '项' },
  { label: '待入库确认', value: valueOf('instockPendingCount'), unit: '项' },
]);

const a2MetricCards = computed(() => [
  { label: '计划数量', value: valueOf('plannedQuantity'), unit: '件' },
  { label: '完工数量', value: valueOf('completedQuantity'), unit: '件' },
  { label: '达成率', value: valueOf('attainmentRate'), unit: '%' },
  { label: '延期工单', value: valueOf('delayedOrderCount'), unit: '单' },
  { label: '交期风险', value: valueOf('deliveryRiskCount'), unit: '单' },
]);

const a3MetricCards = computed(() => [
  { label: '待检任务', value: valueOf('pendingInspectionCount'), unit: '项' },
  { label: '检验中', value: valueOf('inProgressInspectionCount'), unit: '项' },
  { label: '缺陷数量', value: valueOf('defectCount'), unit: '件' },
  { label: '产品入库检验推送成功率', value: valueOf('pushSuccessRate'), unit: '%' },
]);

const a4MetricCards = computed(() => [
  { label: '成功单据', value: valueOf('successBillCount'), unit: '项' },
  { label: '待审核', value: valueOf('pendingAuditCount'), unit: '项' },
  { label: '失败待重试', value: valueOf('failedRetryCount'), unit: '项' },
  { label: '平均回写', value: valueOf('averageWritebackMinutes'), unit: 'm' },
]);

const a5MetricCards = computed(() => [
  { label: '入库待确认', value: valueOf('pendingConfirmCount'), unit: '项' },
  { label: '对账差异行', value: valueOf('locationDiffCount'), unit: '行' },
  { label: 'WMS 任务', value: valueOf('wmsTaskCount'), unit: '项' },
  { label: '已匹配库位', value: valueOf('matchedLocationRate'), unit: '%' },
]);

const a6MetricCards = computed(() => [
  { label: '工作中心负荷', value: valueOf('averageLoadRate'), unit: '%' },
  { label: '超负荷中心', value: valueOf('overloadCenterCount'), unit: '个' },
  { label: '已核算工资', value: valueOf('settledWageCount'), unit: '笔' },
  { label: '异常报工', value: valueOf('exceptionReportCount'), unit: '项' },
]);

watch(
  () => [currentScenarioCode.value, route.query.scenario] as const,
  ([code]) => {
    if (route.query.scenario !== code) {
      void router.replace({ path: route.path, query: { ...route.query, scenario: code } });
    }
    if (!isImplementedDashboardScenario(code)) {
      lastAutoLoadedScenarioCode = '';
      analyticsData.value = null;
      errorMessage.value = '';
      return;
    }
    if (lastAutoLoadedScenarioCode !== code) {
      lastAutoLoadedScenarioCode = code;
      void loadScenario(code);
    }
  },
  { immediate: true },
);

function valueOf(key: string) {
  return metrics.value[key] ?? 0;
}

async function loadScenario(code: string) {
  loading.value = true;
  errorMessage.value = '';
  try {
    analyticsData.value = await getProductionClosureAnalytics({
      range: code === 'A3' ? '30d' : '7d',
      scenario: code,
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : `${code} 数据加载失败`;
  } finally {
    loading.value = false;
  }
}

function selectScenario(scenario: DashboardOverviewV2Scenario) {
  router.replace(getDashboardScenarioRoute(scenario));
}

function refreshCurrent() {
  if (implementedScenario.value) {
    void loadScenario(currentScenarioCode.value);
  }
}

function tagType(tone?: DashboardStage['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'info';
}

function priorityType(priority?: DashboardRiskRow['priority']) {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'info';
}

function statusType(status?: string) {
  if (status === '瓶颈' || status === '已延期') return 'danger';
  if (status === '关注' || status === '交期紧张') return 'warning';
  return 'success';
}

function progressStyle(value: number) {
  return {
    width: `${Math.max(8, Math.min(100, value))}%`,
  };
}

function trendMax(rows: Array<Record<string, any>>, keys: string[]) {
  const max = rows.reduce((value, row) => {
    return Math.max(
      value,
      ...keys.map((key) => Number(row[key] || 0)),
    );
  }, 0);
  return max || 1;
}

function linePointX(index: number, size: number) {
  if (size <= 1) return 50;
  return 50 + (index * 100) / (size - 1);
}

function linePointY(value: number, max: number) {
  const ratio = max <= 0 ? 0 : Number(value || 0) / max;
  return 96 - Math.min(88, ratio * 88);
}

function linePath(rows: Array<Record<string, any>>, key: string) {
  const max = trendMax(rows, [key]);
  return rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${linePointX(index, rows.length)} ${linePointY(Number(row[key] || 0), max)}`)
    .join(' ');
}
</script>

<template>
  <div class="dashboard-analytics-v2-page">
    <DashboardScenarioHeader
      eyebrow="Analytics V2"
      :loading="loading"
      :scenario="currentScenario"
      :scenarios="scenarios"
      subtitle="A1-A6 六套分析视角，切换方案可换一组指标与图表。"
      :updated-at="analyticsData?.updatedAt"
      @refresh="refreshCurrent"
      @select="selectScenario"
    />

    <el-alert
      v-if="errorMessage"
      class="status-alert"
      :closable="false"
      show-icon
      type="error"
      :title="errorMessage"
    />

    <template v-if="isA1">
      <section class="metric-grid metric-grid--6">
        <article v-for="item in a1MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Lifecycle Rail</span>
            <h3>生产闭环阶段轨道</h3>
          </div>
          <el-tag effect="plain" size="small">A1 默认分析页</el-tag>
        </div>
        <div class="stage-rail">
          <article v-for="stage in stages" :key="stage.key" class="stage-card">
            <div class="stage-top">
              <strong>{{ stage.label }}</strong>
              <el-tag :type="tagType(stage.tone)" effect="light" size="small">
                {{ stage.blocked > 0 ? '有阻塞' : '正常' }}
              </el-tag>
            </div>
            <div class="stage-value">
              <span>{{ stage.done }}</span>
              <em>/ {{ stage.total }}</em>
            </div>
            <small>阻塞 {{ stage.blocked }} 项</small>
          </article>
        </div>
      </section>

      <section class="split-layout split-layout--a1">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Blockers</span>
              <h3>阻塞类型</h3>
            </div>
          </div>
          <div v-if="blockerGroups.length" class="blocker-group-list">
            <div v-for="group in blockerGroups" :key="group.sourceType" class="blocker-group">
              <span>{{ group.label }}</span>
              <strong>{{ group.count }}</strong>
            </div>
          </div>
          <el-empty v-else :image-size="80" description="暂无阻塞类型" />
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Exceptions</span>
              <h3>关键阻塞明细</h3>
            </div>
            <component :is="WarningIcon" class="head-icon" />
          </div>
          <el-table :data="blockerRows" border stripe size="small" height="320">
            <el-table-column label="优先级" min-width="82">
              <template #default="{ row }">
                <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="工单" min-width="120" prop="orderNo" />
            <el-table-column label="阶段" min-width="110" prop="stageKey" />
            <el-table-column label="说明" min-width="160" prop="title" />
            <el-table-column label="最后错误" min-width="220" prop="lastError" show-overflow-tooltip />
          </el-table>
        </article>
      </section>
    </template>

    <template v-else-if="isA2">
      <section class="metric-grid metric-grid--5">
        <article v-for="item in a2MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="analytics-grid analytics-grid--a2">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Plan vs Actual</span>
              <h3>计划 / 实际达成</h3>
            </div>
            <component :is="TrendIcon" class="head-icon head-icon--primary" />
          </div>
          <div class="trend-bars">
            <article v-for="row in attainmentTrend" :key="String(row.label)" class="trend-bar-card">
              <div class="trend-top">
                <strong>{{ row.label }}</strong>
                <span>{{ row.attainmentRate }}%</span>
              </div>
              <div class="double-bar">
                <div class="double-bar__col">
                  <i class="bar bar--plan" :style="progressStyle(Number(row.plannedQuantity || 0) / trendMax(attainmentTrend, ['plannedQuantity']) * 100)" />
                  <span>计划 {{ row.plannedQuantity }}</span>
                </div>
                <div class="double-bar__col">
                  <i class="bar bar--actual" :style="progressStyle(Number(row.completedQuantity || 0) / trendMax(attainmentTrend, ['plannedQuantity', 'completedQuantity']) * 100)" />
                  <span>实际 {{ row.completedQuantity }}</span>
                </div>
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Delay Buckets</span>
              <h3>延期分布</h3>
            </div>
            <el-tag effect="plain" type="warning">按当前流程阶段聚合</el-tag>
          </div>
          <div class="count-list">
            <div v-for="row in delayBuckets" :key="row.label" class="count-row">
              <div>
                <strong>{{ row.label }}</strong>
              </div>
              <span>{{ row.count }} 单</span>
            </div>
          </div>
        </article>
      </section>

      <section class="split-layout split-layout--balanced">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Workshop</span>
              <h3>车间达成排行</h3>
            </div>
          </div>
          <el-table :data="workshopRows" border stripe size="small" height="320">
            <el-table-column label="车间" min-width="140" prop="workshopName" />
            <el-table-column label="计划" min-width="96" prop="plannedQuantity" />
            <el-table-column label="完工" min-width="96" prop="completedQuantity" />
            <el-table-column label="达成率" min-width="96">
              <template #default="{ row }">{{ row.attainmentRate }}%</template>
            </el-table-column>
            <el-table-column label="状态" min-width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Due Today</span>
              <h3>今日交期风险</h3>
            </div>
            <component :is="WarningIcon" class="head-icon" />
          </div>
          <div v-if="deliveryRiskRows.length" class="task-list">
            <article v-for="row in deliveryRiskRows" :key="`${row.orderNo}-${row.planEndTime}`" class="task-row task-row--stacked">
              <div>
                <strong>{{ row.orderNo }} {{ row.productName }}</strong>
                <span>剩余 {{ row.remainingHours }}h</span>
              </div>
              <el-tag :type="statusType(row.status)" effect="light" size="small">{{ row.status }}</el-tag>
            </article>
          </div>
          <el-empty v-else :image-size="80" description="暂无交期风险" />
        </article>
      </section>
    </template>

    <template v-else-if="isA3">
      <section class="metric-grid metric-grid--4">
        <article v-for="item in a3MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="analytics-grid analytics-grid--a3">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Pareto</span>
              <h3>缺陷 Pareto</h3>
            </div>
            <component :is="QualityIcon" class="head-icon head-icon--danger" />
          </div>
          <div class="pareto-list">
            <article v-for="row in defectPareto" :key="row.label" class="pareto-row">
              <div class="pareto-row__copy">
                <strong>{{ row.label }}</strong>
                <span>{{ row.count }} 件</span>
              </div>
              <div class="pareto-row__bar">
                <i :style="progressStyle((row.count / trendMax(defectPareto, ['count'])) * 100)" />
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Inspection Summary</span>
              <h3>检验状态堆叠</h3>
            </div>
          </div>
          <div class="summary-grid">
            <article v-for="row in inspectionSummary" :key="row.label" class="summary-card">
              <strong>{{ row.count }}</strong>
              <span>{{ row.label }}</span>
            </article>
          </div>
          <svg
            v-if="inspectionTrend.length"
            class="line-chart"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="质检趋势图"
          >
            <path class="line-chart__line" :d="linePath(inspectionTrend, 'taskCount')" />
            <path class="line-chart__line line-chart__line--danger" :d="linePath(inspectionTrend, 'defectCount')" />
          </svg>
        </article>
      </section>

      <section class="split-layout split-layout--balanced">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Exceptions</span>
              <h3>产品入库检验推送异常</h3>
            </div>
          </div>
          <el-table :data="pushExceptionRows" border stripe size="small" height="320">
            <el-table-column label="任务" min-width="120" prop="taskCode" />
            <el-table-column label="工单" min-width="120" prop="orderNo" />
            <el-table-column label="原因" min-width="180" prop="reason" show-overflow-tooltip />
            <el-table-column label="质检员" min-width="100" prop="inspectorName" />
          </el-table>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Backlog Focus</span>
              <h3>待检与异常关注</h3>
            </div>
            <el-tag effect="plain" type="warning">优先清理堆积</el-tag>
          </div>
          <div class="count-list">
            <div
              v-for="row in inspectionSummary.filter((item) => item.label !== '已完成')"
              :key="row.label"
              class="count-row"
            >
              <div>
                <strong>{{ row.label }}</strong>
              </div>
              <span>{{ row.count }} 项</span>
            </div>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="isA4">
      <section class="metric-grid metric-grid--4">
        <article v-for="item in a4MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">ERP Chain</span>
            <h3>关键单据链路</h3>
          </div>
          <el-tag effect="plain" type="info">MES -> ERP -> Audit</el-tag>
        </div>
        <div class="stage-rail stage-rail--erp">
          <article v-for="row in erpStageSummary" :key="row.code" class="stage-card">
            <div class="stage-top">
              <strong>{{ row.label }}</strong>
              <el-tag effect="light" size="small">{{ row.done }}/{{ row.total }}</el-tag>
            </div>
            <div class="stage-value">
              <span>{{ row.done }}</span>
              <em>/ {{ row.total }}</em>
            </div>
          </article>
        </div>
      </section>

      <section class="analytics-grid analytics-grid--a4">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Chain Flow</span>
              <h3>单据链路图</h3>
            </div>
          </div>
          <div class="chain-flow">
            <article v-for="node in billChainNodes" :key="node.code" class="chain-node">
              <strong>{{ node.label }}</strong>
              <span>{{ node.status }}</span>
              <em>{{ node.subtitle }}</em>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Failure Reasons</span>
              <h3>ERP 失败原因</h3>
            </div>
            <component :is="WarningIcon" class="head-icon" />
          </div>
          <div class="count-list">
            <div v-for="row in erpFailureReasons" :key="row.label" class="count-row">
              <div>
                <strong>{{ row.label }}</strong>
              </div>
              <span>{{ row.count }} 项</span>
            </div>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Audit Queue</span>
            <h3>审核等待清单</h3>
          </div>
        </div>
        <el-table :data="auditWaitingRows" border stripe size="small" height="320">
          <el-table-column label="单据类型" min-width="110" prop="billType" />
          <el-table-column label="ERP 单号" min-width="140" prop="billNo" />
          <el-table-column label="源工单" min-width="120" prop="orderNo" />
          <el-table-column label="状态" min-width="120" prop="status" />
          <el-table-column label="责任角色" min-width="120" prop="ownerRole" />
          <el-table-column label="等待(h)" min-width="90" prop="waitingHours" />
          <el-table-column label="下一步" min-width="100" prop="nextAction" />
        </el-table>
      </section>
    </template>

    <template v-else-if="isA5">
      <section class="metric-grid metric-grid--4">
        <article v-for="item in a5MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="analytics-grid analytics-grid--a5">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Heatmap</span>
              <h3>ERP / WMS 差异热力表</h3>
            </div>
          </div>
          <div class="heatmap-grid">
            <article v-for="row in warehouseHeatmapRows" :key="row.label" class="heatmap-row">
              <strong>{{ row.label }}</strong>
              <div class="heatmap-cells">
                <span v-for="(cell, index) in row.cells" :key="`${row.label}-${index}`">{{ cell }}</span>
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Task Status</span>
              <h3>WMS 任务状态</h3>
            </div>
          </div>
          <div class="count-list">
            <div v-for="row in warehouseTaskStatusRows" :key="row.label" class="count-row">
              <div><strong>{{ row.label }}</strong></div>
              <span>{{ row.count }} 项</span>
            </div>
          </div>
        </article>
      </section>

      <section class="split-layout split-layout--balanced">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Risk Materials</span>
              <h3>风险物料排行</h3>
            </div>
          </div>
          <div class="task-list">
            <article v-for="row in deliveryRiskRows" :key="`${row.orderNo}-${row.productName}`" class="task-row task-row--stacked">
              <div>
                <strong>{{ row.orderNo }} {{ row.productName }}</strong>
                <span>{{ row.status }}</span>
              </div>
              <el-tag effect="light" size="small">{{ row.remainingHours }}h</el-tag>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Instock / Failure</span>
              <h3>入库与失败原因</h3>
            </div>
          </div>
          <div class="count-list">
            <div v-for="row in erpFailureReasons" :key="row.label" class="count-row">
              <div><strong>{{ row.label }}</strong></div>
              <span>{{ row.count }} 项</span>
            </div>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="isA6">
      <section class="metric-grid metric-grid--4">
        <article v-for="item in a6MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="analytics-grid analytics-grid--a6">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Workload</span>
              <h3>工作中心负荷</h3>
            </div>
          </div>
          <div class="count-list">
            <div v-for="row in workloadRows" :key="row.label" class="count-row">
              <div>
                <strong>{{ row.label }}</strong>
              </div>
              <span>{{ row.loadRate }}% / {{ row.queueCount }} 单</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Hour Variance</span>
              <h3>标准 / 实际工时偏差</h3>
            </div>
          </div>
          <div class="variance-list">
            <article v-for="row in hourVarianceRows" :key="row.label" class="variance-card">
              <strong>{{ row.label }}</strong>
              <span>标准 {{ row.expectedMinutes }}m / 实际 {{ row.actualMinutes }}m</span>
              <el-tag :type="row.needsReview ? 'danger' : 'success'" size="small">
                {{ row.deviationMinutes > 0 ? `+${row.deviationMinutes}` : row.deviationMinutes }}m
              </el-tag>
            </article>
          </div>
        </article>
      </section>

      <section class="split-layout split-layout--balanced">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Settlement Funnel</span>
              <h3>工资核算状态</h3>
            </div>
          </div>
          <div class="summary-grid summary-grid--wide">
            <article v-for="row in exceptionTimeRows" :key="row.label" class="summary-card">
              <strong>{{ row.count }}</strong>
              <span>{{ row.label }}</span>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Exception Reports</span>
              <h3>异常报工清单</h3>
            </div>
          </div>
          <el-table :data="pushExceptionRows" border stripe size="small" height="300">
            <el-table-column label="工单" min-width="120" prop="taskCode" />
            <el-table-column label="说明" min-width="180" prop="reason" show-overflow-tooltip />
            <el-table-column label="责任人" min-width="120" prop="inspectorName" />
          </el-table>
        </article>
      </section>
    </template>

    <section v-else class="placeholder-panel">
      <component :is="EmptyIcon" />
      <h3>{{ currentScenario.code }} {{ currentScenario.title }}</h3>
      <p>{{ currentScenario.description }}</p>
      <span>原型路径：{{ currentScenario.prototypePath }}</span>
      <el-tag effect="plain" type="warning">按阶段计划待接入真实聚合数据</el-tag>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-analytics-v2-page {
  min-height: 100%;
  padding: 20px;
  color: var(--el-text-color-primary);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-color-primary) 7%, transparent), transparent 44%),
    linear-gradient(180deg, var(--el-bg-color-page), var(--el-fill-color-lighter));
}

.status-alert,
.metric-grid,
.panel,
.placeholder-panel,
.analytics-grid,
.split-layout {
  margin-top: 16px;
}

.metric-grid,
.analytics-grid,
.split-layout,
.stage-rail,
.summary-grid {
  display: grid;
  gap: 12px;
}

.metric-grid--6 {
  grid-template-columns: repeat(6, minmax(130px, 1fr));
}

.metric-grid--5 {
  grid-template-columns: repeat(5, minmax(150px, 1fr));
}

.metric-grid--4 {
  grid-template-columns: repeat(4, minmax(160px, 1fr));
}

.analytics-grid--a2 {
  grid-template-columns: minmax(480px, 1.3fr) minmax(260px, 0.7fr);
}

.analytics-grid--a3 {
  grid-template-columns: minmax(420px, 1.15fr) minmax(320px, 0.85fr);
}

.analytics-grid--a4 {
  grid-template-columns: minmax(460px, 1.15fr) minmax(300px, 0.85fr);
}

.analytics-grid--a5,
.analytics-grid--a6 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.split-layout--a1 {
  grid-template-columns: minmax(260px, 0.72fr) minmax(420px, 1.28fr);
}

.split-layout--balanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric-card,
.panel,
.placeholder-panel,
.stage-card,
.trend-bar-card,
.summary-card,
.pareto-row,
.task-row,
.count-row,
.blocker-group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: 0 10px 28px rgb(15 23 42 / 7%);
}

.metric-card {
  position: relative;
  display: grid;
  min-height: 112px;
  padding: 16px;
  overflow: hidden;
  align-content: space-between;
  border-left: 4px solid color-mix(in srgb, var(--el-color-primary) 62%, var(--el-border-color));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--el-color-primary) 6%, transparent), transparent 70%),
    var(--el-bg-color);

  &::after {
    position: absolute;
    right: 14px;
    bottom: 12px;
    width: 42px;
    height: 42px;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
    border-radius: 50%;
    content: '';
    opacity: 0.42;
  }

  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: inline-block;
    margin-top: 12px;
    font-size: 31px;
    line-height: 1;
  }

  em {
    margin-left: 6px;
    color: var(--el-text-color-secondary);
    font-style: normal;
  }
}

.panel {
  min-width: 0;
  padding: 16px;
  border-color: var(--el-border-color);
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  h3 {
    margin: 4px 0 0;
    font-size: 17px;
    font-weight: 760;
  }
}

.eyebrow {
  display: block;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.stage-rail {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.stage-rail--erp {
  grid-template-columns: repeat(6, minmax(140px, 1fr));
}

.stage-card {
  position: relative;
  padding: 14px;
  border-color: var(--el-border-color-lighter);
  background: linear-gradient(180deg, var(--el-fill-color-lighter), var(--el-bg-color));
  box-shadow: none;

  small {
    color: var(--el-text-color-secondary);
  }

  &::before {
    display: block;
    width: 34px;
    height: 3px;
    margin-bottom: 12px;
    border-radius: 999px;
    background: var(--el-color-primary);
    content: '';
  }
}

.stage-top,
.trend-top,
.blocker-group,
.count-row,
.task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stage-value {
  margin: 16px 0 8px;

  span {
    font-size: 28px;
    font-weight: 780;
  }

  em {
    color: var(--el-text-color-secondary);
    font-style: normal;
  }
}

.blocker-group-list,
.task-list,
.count-list,
.pareto-list {
  display: grid;
  gap: 10px;
}

.blocker-group,
.count-row,
.task-row {
  min-height: 56px;
  padding: 12px;
}

.blocker-group {
  border-color: var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-warning);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-color-warning) 8%, transparent), transparent 58%),
    var(--el-fill-color-lighter);
  box-shadow: none;

  span {
    color: var(--el-text-color-secondary);
  }

  strong {
    font-size: 22px;
  }
}

.head-icon {
  width: 22px;
  height: 22px;
  color: var(--el-color-warning);
}

.head-icon--primary {
  color: var(--el-color-primary);
}

.head-icon--danger {
  color: var(--el-color-danger);
}

.trend-bars {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.trend-bar-card {
  padding: 14px;
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
}

.trend-top {
  margin-bottom: 12px;

  span {
    color: var(--el-color-success);
    font-weight: 700;
  }
}

.double-bar {
  display: grid;
  gap: 10px;
}

.double-bar__col {
  display: grid;
  gap: 6px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.bar {
  display: block;
  height: 12px;
  border-radius: 999px;
  background: var(--el-color-primary-light-5);
}

.bar--plan {
  background: color-mix(in srgb, var(--el-color-primary) 42%, white);
}

.bar--actual {
  background: var(--el-color-primary);
}

.pareto-row {
  display: grid;
  padding: 12px;
  border-color: var(--el-border-color-lighter);
  gap: 10px;
}

.pareto-row__copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.pareto-row__bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: var(--el-fill-color-light);

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--el-color-danger), var(--el-color-warning));
  }
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 16px;
}

.summary-card {
  display: grid;
  min-height: 100px;
  place-items: center;
  padding: 14px;
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
  text-align: center;

  strong {
    font-size: 28px;
  }

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.chain-flow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.heatmap-grid,
.variance-list {
  display: grid;
  gap: 10px;
}

.heatmap-row,
.variance-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.heatmap-cells {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;

  span {
    display: inline-flex;
    min-height: 38px;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--el-color-warning) 22%, var(--el-fill-color-light));
    font-weight: 700;
  }
}

.variance-card {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.summary-grid--wide {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.chain-node {
  display: grid;
  min-height: 108px;
  align-content: center;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: linear-gradient(180deg, var(--el-fill-color-lighter), var(--el-bg-color));
  box-shadow: none;
  gap: 6px;

  span,
  em {
    color: var(--el-text-color-secondary);
    font-style: normal;
  }
}

.line-chart {
  width: 100%;
  height: 160px;
  overflow: visible;
}

.line-chart__line {
  fill: none;
  stroke: var(--el-color-primary);
  stroke-linecap: round;
  stroke-width: 3;
}

.line-chart__line--danger {
  stroke: var(--el-color-danger);
  stroke-dasharray: 5 4;
}

.task-row--stacked {
  align-items: flex-start;
}

.task-row strong,
.count-row strong {
  display: block;
}

.task-row span,
.count-row span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.placeholder-panel {
  display: flex;
  min-height: 360px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px;
  text-align: center;

  svg {
    width: 44px;
    height: 44px;
    color: var(--el-color-info);
  }

  h3 {
    margin: 0;
    font-size: 22px;
  }

  p {
    max-width: 640px;
    margin: 0;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
  }

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

@media (max-width: 1180px) {
  .metric-grid--6,
  .metric-grid--5,
  .metric-grid--4,
  .stage-rail,
  .analytics-grid--a2,
  .analytics-grid--a3,
  .analytics-grid--a4,
  .analytics-grid--a5,
  .analytics-grid--a6,
  .split-layout--a1,
  .split-layout--balanced,
  .summary-grid {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  .trend-bars {
    grid-template-columns: 1fr;
  }

  .chain-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-analytics-v2-page {
    padding: 12px;
  }

  .metric-grid--6,
  .metric-grid--5,
  .metric-grid--4,
  .stage-rail,
  .analytics-grid--a2,
  .analytics-grid--a3,
  .analytics-grid--a4,
  .analytics-grid--a5,
  .analytics-grid--a6,
  .split-layout--a1,
  .split-layout--balanced,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .chain-flow {
    grid-template-columns: 1fr;
  }
}
</style>
