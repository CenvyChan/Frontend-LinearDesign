<script lang="ts" setup>
import type {
  DashboardBillChain,
  DashboardDispatchRow,
  DashboardRiskRow,
  DashboardTimelineItem,
  ProductionClosureWorkspaceResult,
} from '#/api/dashboard';
import type { DashboardOverviewV2Scenario } from '../overview-v2/overview-v2-model';

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createIconifyIcon } from '@vben/icons';

import { getProductionClosureWorkspace } from '#/api/dashboard';

import DashboardScenarioHeader from '../overview-v2/DashboardScenarioHeader.vue';
import {
  getDashboardScenarioRoute,
  getDashboardScenariosByGroup,
  getNormalizedDashboardScenarioCode,
  isImplementedDashboardScenario,
  resolveDashboardScenario,
} from '../overview-v2/overview-v2-model';

defineOptions({ name: 'DashboardWorkspaceV2' });

const route = useRoute();
const router = useRouter();
const EmptyIcon = createIconifyIcon('lucide:panel-top-dashed');
const RouteIcon = createIconifyIcon('lucide:route');
const TeamIcon = createIconifyIcon('lucide:users-round');
const InspectIcon = createIconifyIcon('lucide:clipboard-check');

const scenarios = getDashboardScenariosByGroup('workspace');
const loading = ref(false);
const errorMessage = ref('');
const workspaceData = ref<ProductionClosureWorkspaceResult | null>(null);
let lastAutoLoadedScenarioCode = '';

const normalizedScenarioCode = computed(() =>
  getNormalizedDashboardScenarioCode('workspace', route.query.scenario),
);
const currentScenario = computed(() =>
  resolveDashboardScenario('workspace', normalizedScenarioCode.value),
);
const currentScenarioCode = computed(() => currentScenario.value.code);
const implementedScenario = computed(() => isImplementedDashboardScenario(currentScenarioCode.value));

const isW1 = computed(() => currentScenarioCode.value === 'W1');
const isW2 = computed(() => currentScenarioCode.value === 'W2');
const isW3 = computed(() => currentScenarioCode.value === 'W3');
const isW4 = computed(() => currentScenarioCode.value === 'W4');
const isW5 = computed(() => currentScenarioCode.value === 'W5');
const isW6 = computed(() => currentScenarioCode.value === 'W6');

const metrics = computed(() => workspaceData.value?.metrics || {});
const queues = computed(() => workspaceData.value?.queues || {});
const riskRows = computed(() => workspaceData.value?.riskRows || []);
const quickLinks = computed(() => workspaceData.value?.quickLinks || []);
const timeline = computed(() => workspaceData.value?.timeline || []);
const loadRows = computed(() => workspaceData.value?.loadRows || []);
const queueRows = computed(() => workspaceData.value?.queueRows || []);
const dispatchRows = computed(() => workspaceData.value?.dispatchRows || []);
const kanbanColumns = computed(() => workspaceData.value?.kanbanColumns || []);
const sampleExceptions = computed(() => workspaceData.value?.sampleExceptions || []);
const billChain = computed(() => workspaceData.value?.billChain);
const warehouseTaskBuckets = computed(() => workspaceData.value?.warehouseTaskBuckets || []);
const warehouseRiskRows = computed(() => workspaceData.value?.warehouseRiskRows || []);
const scanActions = computed(() => workspaceData.value?.scanActions || []);
const failureQueueRows = computed(() => workspaceData.value?.failureQueueRows || []);
const timelineLogRows = computed(() => workspaceData.value?.timelineLogRows || []);
const erpFailureReasons = computed(() => workspaceData.value?.erpFailureReasons || []);
const morningRiskRows = computed(() => workspaceData.value?.morningRiskRows || []);
const morningCarryoverRows = computed(() => workspaceData.value?.morningCarryoverRows || []);
const departmentActions = computed(() => workspaceData.value?.departmentActions || []);
const morningGoalRows = computed(() => workspaceData.value?.morningGoalRows || []);

const w1MetricCards = computed(() => [
  { label: '今日待办', value: valueOf('todoCount'), unit: '项' },
  { label: '阻塞项', value: valueOf('blockedCount'), unit: '项' },
  { label: '可立刻处理', value: valueOf('actionableCount'), unit: '项' },
  { label: '今日完成', value: valueOf('completedTodayCount'), unit: '项' },
]);

const w2MetricCards = computed(() => [
  { label: '待领取工序', value: valueOf('unassignedFlowCount'), unit: '项' },
  { label: '排队超时', value: valueOf('overdueQueueCount'), unit: '项' },
  { label: '设备瓶颈', value: valueOf('bottleneckCount'), unit: '处' },
  { label: '班组完成', value: valueOf('completedFlowCount'), unit: '道' },
]);

const w3MetricCards = computed(() => [
  { label: '待检', value: valueOf('pendingInspectionCount'), unit: '项' },
  { label: '检验中', value: valueOf('inspectingCount'), unit: '项' },
  { label: '样本异常', value: valueOf('sampleExceptionCount'), unit: '项' },
  { label: '今日完成', value: valueOf('completedCount'), unit: '项' },
]);

const w4MetricCards = computed(() => [
  { label: '领料待备', value: valueOf('pickReadyCount'), unit: '项' },
  { label: '退料待检', value: valueOf('returnPendingCount'), unit: '项' },
  { label: '入库可确认', value: valueOf('readyInstockCount'), unit: '项' },
  { label: '库位差异', value: valueOf('locationRiskCount'), unit: '项' },
]);

const w5MetricCards = computed(() => [
  { label: '推送失败', value: valueOf('failedPushCount'), unit: '项' },
  { label: '待审核', value: valueOf('pendingAuditCount'), unit: '项' },
  { label: '可重试', value: valueOf('retryableCount'), unit: '项' },
  { label: '今日成功', value: valueOf('todaySuccessCount'), unit: '项' },
]);

const w6MetricCards = computed(() => [
  { label: '昨日闭环率', value: valueOf('yesterdayClosureRate'), unit: '%' },
  { label: '今日交期风险', value: valueOf('todayDeliveryRiskCount'), unit: '项' },
  { label: '跨部门阻塞', value: valueOf('crossDepartmentBlockCount'), unit: '项' },
  { label: '待审核单据', value: valueOf('pendingAuditCount'), unit: '项' },
]);

const queueCards = computed(() => [
  { key: 'pending', label: '待处理', value: queues.value.pending ?? 0 },
  { key: 'processing', label: '处理中', value: queues.value.processing ?? 0 },
  { key: 'waitingExternal', label: '等外部', value: queues.value.waitingExternal ?? 0 },
  { key: 'done', label: '已完成', value: queues.value.done ?? 0 },
]);

watch(
  () => [currentScenarioCode.value, route.query.scenario] as const,
  ([code]) => {
    if (route.query.scenario !== code) {
      void router.replace({ path: route.path, query: { ...route.query, scenario: code } });
    }
    if (!isImplementedDashboardScenario(code)) {
      lastAutoLoadedScenarioCode = '';
      workspaceData.value = null;
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
    workspaceData.value = await getProductionClosureWorkspace({
      range: 'today',
      roleScope: 'team',
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

function openTarget(targetRoute?: string) {
  if (targetRoute) {
    void router.push(targetRoute);
  }
}

function priorityType(priority?: DashboardRiskRow['priority'] | DashboardDispatchRow['priority']) {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'info';
}

function actionLabel(action?: string) {
  const labels: Record<string, string> = {
    confirmInstock: '入库确认',
    inspect: '去检验',
    retryErp: 'ERP 重试',
    viewDetail: '查看',
  };
  return action ? labels[action] || '查看' : '查看';
}

function formatTime(item: DashboardTimelineItem) {
  if (!item.time) {
    return '-';
  }
  return new Date(item.time).toLocaleTimeString();
}

function statusType(status?: string) {
  if (status?.includes('超时') || status?.includes('返工') || status?.includes('失败')) return 'danger';
  if (status?.includes('进行') || status?.includes('待')) return 'warning';
  return 'success';
}

function loadRateStyle(value: number) {
  return {
    width: `${Math.max(8, Math.min(100, value))}%`,
  };
}

function billStateText(chain?: DashboardBillChain) {
  if (!chain) return '暂无单据链';
  if (chain.pushStatus) return chain.pushStatus;
  if (chain.inspectionBillNo || chain.reportBillNo) return '已生成单据';
  return '待补链';
}
</script>

<template>
  <div class="dashboard-workspace-v2-page">
    <DashboardScenarioHeader
      eyebrow="Workspace V2"
      :loading="loading"
      :scenario="currentScenario"
      :scenarios="scenarios"
      subtitle="W1-W6 六套角色工作台，切换方案可换一组待办与快捷入口。"
      :updated-at="workspaceData?.updatedAt"
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

    <template v-if="isW1">
      <section class="metric-grid">
        <article v-for="item in w1MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel queue-panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Queue</span>
              <h3>今日闭环队列</h3>
            </div>
            <component :is="RouteIcon" class="head-icon" />
          </div>
          <div class="queue-list">
            <button
              v-for="item in queueCards"
              :key="item.key"
              class="queue-card"
              type="button"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </button>
          </div>
        </article>

        <article class="panel quick-panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Quick Links</span>
              <h3>快捷入口</h3>
            </div>
          </div>
          <div class="quick-list">
            <button
              v-for="link in quickLinks"
              :key="link.title"
              class="quick-link"
              type="button"
              @click="openTarget(link.targetRoute)"
            >
              <span>{{ link.title }}</span>
              <em>{{ actionLabel(link.primaryAction) }}</em>
            </button>
          </div>
        </article>
      </section>

      <section class="split-layout split-layout--w1">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Risks</span>
              <h3>异常优先区</h3>
            </div>
            <el-tag effect="plain" type="warning">先处理高风险</el-tag>
          </div>
          <el-table :data="riskRows" border stripe size="small" height="360">
            <el-table-column label="优先级" min-width="82">
              <template #default="{ row }">
                <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="工单" min-width="118" prop="orderNo" />
            <el-table-column label="任务" min-width="160" prop="title" />
            <el-table-column label="单据" min-width="140" prop="relatedBillNo" show-overflow-tooltip />
            <el-table-column label="最后错误" min-width="220" prop="lastError" show-overflow-tooltip />
            <el-table-column fixed="right" label="动作" width="92">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="openTarget(row.targetRoute)">
                  {{ actionLabel(row.primaryAction) }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>

        <article class="panel timeline-panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Today</span>
              <h3>今日动态</h3>
            </div>
          </div>
          <div v-if="timeline.length" class="timeline-list">
            <button
              v-for="item in timeline"
              :key="`${item.title}-${item.time}`"
              class="timeline-item"
              type="button"
              @click="openTarget(item.targetRoute)"
            >
              <span>{{ formatTime(item) }}</span>
              <strong>{{ item.title }}</strong>
              <em>{{ item.status || '-' }}</em>
            </button>
          </div>
          <el-empty v-else :image-size="90" description="暂无今日动态" />
        </article>
      </section>
    </template>

    <template v-else-if="isW2">
      <section class="metric-grid">
        <article v-for="item in w2MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Work Center Load</span>
              <h3>工作中心负荷</h3>
            </div>
            <component :is="TeamIcon" class="head-icon head-icon--warning" />
          </div>
          <div class="load-list">
            <article v-for="row in loadRows" :key="row.workCenterName" class="load-row">
              <div class="load-row__copy">
                <strong>{{ row.workCenterName }}</strong>
                <span>{{ row.queueCount }} 单排队</span>
              </div>
              <div class="load-row__meta">
                <div class="load-bar">
                  <i :style="loadRateStyle(row.loadRate)" />
                </div>
                <em>{{ row.loadRate }}%</em>
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Dispatch Focus</span>
              <h3>班组阻塞处置</h3>
            </div>
          </div>
          <div class="dispatch-list">
            <article v-for="row in dispatchRows" :key="`${row.title}-${row.reason}`" class="dispatch-card">
              <div>
                <strong>{{ row.title }}</strong>
                <span>{{ row.reason }}</span>
              </div>
              <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
            </article>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Queue Table</span>
            <h3>工序队列</h3>
          </div>
        </div>
        <el-table :data="queueRows" border stripe size="small" height="360">
          <el-table-column label="工单" min-width="120" prop="orderNo" />
          <el-table-column label="工序" min-width="150" prop="stepName" />
          <el-table-column label="设备" min-width="120" prop="workCenterName" />
          <el-table-column label="操作员" min-width="120" prop="operatorName" />
          <el-table-column label="状态" min-width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(String(row.status || ''))" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <template v-else-if="isW3">
      <section class="metric-grid">
        <article v-for="item in w3MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workbench-layout">
        <div>
          <section class="panel">
            <div class="section-head">
              <div>
                <span class="eyebrow">Kanban</span>
                <h3>检验任务看板</h3>
              </div>
              <component :is="InspectIcon" class="head-icon head-icon--primary" />
            </div>
            <div class="kanban">
              <article v-for="column in kanbanColumns" :key="column.key" class="kanban-col">
                <h4>{{ column.title }}</h4>
                <div class="kanban-items">
                  <button
                    v-for="item in column.items"
                    :key="item.taskCode"
                    class="work-card"
                    type="button"
                  >
                    <strong>{{ item.taskCode }}</strong>
                    <p>{{ item.orderNo }}</p>
                    <span>{{ item.subtitle }}</span>
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside class="aside-stack">
          <section class="panel compact">
            <div class="section-head">
              <div>
                <span class="eyebrow">Sample Exceptions</span>
                <h3>样本异常</h3>
              </div>
              <el-tag effect="plain" type="danger">{{ sampleExceptions.length }} 项</el-tag>
            </div>
            <div class="exception-list">
              <article v-for="row in sampleExceptions" :key="`${row.title}-${row.detail}`" class="exception-card">
                <div>
                  <strong>{{ row.title }}</strong>
                  <span>{{ row.detail }}</span>
                </div>
                <em>{{ row.actionLabel }}</em>
              </article>
            </div>
          </section>

          <section class="panel compact">
            <div class="section-head">
              <div>
                <span class="eyebrow">Bill Chain</span>
                <h3>单据链</h3>
              </div>
            </div>
            <div class="bill-chain">
              <article class="bill-node">
                <strong>生产汇报单</strong>
                <span>{{ billChain?.reportBillNo || '未生成' }}</span>
              </article>
              <article class="bill-node">
                <strong>产品入库检验</strong>
                <span>{{ billChain?.inspectionBillNo || '待补链' }}</span>
              </article>
              <el-tag effect="light" :type="statusType(billStateText(billChain))" size="small">
                {{ billStateText(billChain) }}
              </el-tag>
            </div>
          </section>
        </aside>
      </section>
    </template>

    <template v-else-if="isW4">
      <section class="metric-grid">
        <article v-for="item in w4MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workbench-layout">
        <div>
          <section class="panel">
            <div class="section-head">
              <div>
                <span class="eyebrow">Warehouse Pool</span>
                <h3>仓储任务池</h3>
              </div>
              <component :is="RouteIcon" class="head-icon" />
            </div>
            <div class="kanban">
              <article v-for="bucket in warehouseTaskBuckets" :key="bucket.key" class="kanban-col">
                <h4>{{ bucket.title }}</h4>
                <div class="kanban-items">
                  <button
                    v-for="item in bucket.items"
                    :key="item.taskCode"
                    class="work-card"
                    type="button"
                  >
                    <strong>{{ item.taskCode }}</strong>
                    <p>{{ item.orderNo }}</p>
                    <span>{{ item.subtitle }}</span>
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside class="aside-stack">
          <section class="panel compact">
            <div class="section-head">
              <div>
                <span class="eyebrow">Location Risks</span>
                <h3>库位风险</h3>
              </div>
              <el-tag effect="plain" type="danger">{{ warehouseRiskRows.length }} 条</el-tag>
            </div>
            <div class="exception-list">
              <article v-for="row in warehouseRiskRows" :key="`${row.locationCode}-${row.reason}`" class="exception-card">
                <div>
                  <strong>{{ row.locationCode }}</strong>
                  <span>{{ row.reason }}</span>
                </div>
                <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
              </article>
            </div>
          </section>

          <section class="panel compact">
            <div class="section-head">
              <div>
                <span class="eyebrow">Scan Actions</span>
                <h3>扫码入口</h3>
              </div>
            </div>
            <div class="scan-grid">
              <article v-for="action in scanActions" :key="action.title" class="scan-card">
                <strong>{{ action.title }}</strong>
                <span>{{ action.description }}</span>
              </article>
            </div>
          </section>
        </aside>
      </section>
    </template>

    <template v-else-if="isW5">
      <section class="metric-grid">
        <article v-for="item in w5MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Failure Queue</span>
              <h3>失败队列</h3>
            </div>
          </div>
          <el-table :data="failureQueueRows" border stripe size="small" height="320">
            <el-table-column label="类型" min-width="120" prop="billType" />
            <el-table-column label="源单" min-width="120" prop="orderNo" />
            <el-table-column label="目标单" min-width="140" prop="targetBillNo" />
            <el-table-column label="最后错误" min-width="220" prop="errorMessage" show-overflow-tooltip />
            <el-table-column label="重试" min-width="80" prop="retryCount" />
            <el-table-column label="动作" min-width="100" prop="action" />
          </el-table>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Reason Groups</span>
              <h3>错误原因聚类</h3>
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

      <section class="panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Trace Timeline</span>
            <h3>单据追踪时间线</h3>
          </div>
        </div>
        <div class="timeline-list">
          <article v-for="row in timelineLogRows" :key="`${row.timeLabel}-${row.title}`" class="timeline-item timeline-item--log">
            <span>{{ row.timeLabel }}</span>
            <strong>{{ row.title }}</strong>
            <em>{{ row.detail }}</em>
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </article>
        </div>
      </section>
    </template>

    <template v-else-if="isW6">
      <section class="metric-grid">
        <article v-for="item in w6MetricCards" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.unit }}</em>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Morning Risks</span>
              <h3>晨会风险清单</h3>
            </div>
          </div>
          <el-table :data="morningRiskRows" border stripe size="small" height="320">
            <el-table-column label="风险" min-width="160" prop="risk" />
            <el-table-column label="影响范围" min-width="150" prop="impactScope" />
            <el-table-column label="责任部门" min-width="120" prop="department" />
            <el-table-column label="当前卡点" min-width="160" prop="currentBlocker" show-overflow-tooltip />
            <el-table-column label="建议" min-width="100" prop="recommendation" />
          </el-table>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Carryover</span>
              <h3>昨日遗留</h3>
            </div>
          </div>
          <div class="count-list">
            <div v-for="row in morningCarryoverRows" :key="row.label" class="count-row">
              <div><strong>{{ row.label }}</strong></div>
              <span>{{ row.count }} 项</span>
            </div>
          </div>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Department Actions</span>
              <h3>部门行动项</h3>
            </div>
          </div>
          <div class="dispatch-list">
            <article v-for="row in departmentActions" :key="`${row.department}-${row.instruction}`" class="dispatch-card">
              <div>
                <strong>{{ row.department }}</strong>
                <span>{{ row.instruction }}</span>
              </div>
              <el-tag :type="row.priority === '高' ? 'danger' : 'warning'" size="small">{{ row.actionLabel }}</el-tag>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="section-head">
            <div>
              <span class="eyebrow">Today Goals</span>
              <h3>今日目标</h3>
            </div>
          </div>
          <div class="count-list">
            <div v-for="row in morningGoalRows" :key="row.label" class="count-row">
              <div><strong>{{ row.label }}</strong></div>
              <span>{{ row.count }}</span>
            </div>
          </div>
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
.dashboard-workspace-v2-page {
  min-height: 100%;
  padding: 20px;
  color: var(--el-text-color-primary);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-color-success) 7%, transparent), transparent 44%),
    linear-gradient(180deg, var(--el-bg-color-page), var(--el-fill-color-lighter));
}

.status-alert,
.metric-grid,
.workspace-grid,
.split-layout,
.placeholder-panel,
.workbench-layout {
  margin-top: 16px;
}

.metric-grid,
.workspace-grid,
.split-layout,
.queue-list,
.quick-list,
.timeline-list,
.load-list,
.dispatch-list,
.kanban,
.aside-stack {
  display: grid;
  gap: 12px;
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(160px, 1fr));
}

.workspace-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.split-layout--w1 {
  grid-template-columns: minmax(520px, 1.35fr) minmax(300px, 0.65fr);
}

.metric-card,
.panel,
.placeholder-panel,
.queue-card,
.quick-link,
.timeline-item,
.load-row,
.dispatch-card,
.work-card,
.exception-card,
.bill-node {
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
  border-left: 4px solid color-mix(in srgb, var(--el-color-success) 62%, var(--el-border-color));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--el-color-success) 7%, transparent), transparent 70%),
    var(--el-bg-color);

  &::after {
    position: absolute;
    right: 14px;
    bottom: 12px;
    width: 42px;
    height: 42px;
    border: 1px solid color-mix(in srgb, var(--el-color-success) 22%, transparent);
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

.head-icon {
  width: 22px;
  height: 22px;
  color: var(--el-color-success);
}

.head-icon--warning {
  color: var(--el-color-warning);
}

.head-icon--primary {
  color: var(--el-color-primary);
}

.queue-list {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.queue-card,
.quick-link,
.timeline-item,
.work-card {
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.queue-card {
  min-height: 92px;
  padding: 14px;
  border-color: var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-success);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-color-success) 8%, transparent), transparent 62%),
    var(--el-fill-color-lighter);
  box-shadow: none;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 12px;
    font-size: 28px;
  }
}

.quick-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.quick-link {
  display: flex;
  min-height: 64px;
  padding: 14px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-color: var(--el-border-color-lighter);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--el-color-primary) 5%, transparent), transparent),
    var(--el-fill-color-lighter);
  box-shadow: none;

  span {
    font-weight: 700;
  }

  em {
    color: var(--el-color-primary);
    font-style: normal;
  }
}

.timeline-item {
  display: grid;
  min-height: 64px;
  padding: 12px;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 4px 10px;
  border-color: var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  box-shadow: none;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    grid-column: 2;
    color: var(--el-text-color-secondary);
    font-style: normal;
  }
}

.timeline-item--log {
  grid-template-columns: 64px minmax(0, 1fr) auto;

  em {
    grid-column: 2;
  }
}

.load-row,
.dispatch-card,
.exception-card {
  display: flex;
  min-height: 72px;
  padding: 14px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
}

.load-row__copy,
.load-row__meta,
.dispatch-card div,
.exception-card div {
  display: grid;
  gap: 6px;
}

.load-row span,
.dispatch-card span,
.exception-card span,
.bill-node span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.load-row__meta {
  min-width: 160px;
}

.load-bar {
  width: 160px;
  height: 12px;
  border-radius: 999px;
  background: var(--el-fill-color-light);

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--el-color-success), var(--el-color-warning), var(--el-color-danger));
  }
}

.load-row__meta em,
.exception-card em {
  color: var(--el-color-primary);
  font-style: normal;
  font-weight: 700;
}

.workbench-layout {
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
}

.kanban {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.kanban-col {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: linear-gradient(180deg, var(--el-fill-color-lighter), var(--el-bg-color));

  h4 {
    margin: 0;
    font-size: 14px;
  }
}

.kanban-items {
  display: grid;
  gap: 10px;
}

.work-card {
  display: grid;
  min-height: 92px;
  padding: 12px;
  gap: 6px;
  border-color: var(--el-border-color-lighter);
  box-shadow: none;

  p,
  span {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.aside-stack {
  align-content: start;
}

.compact {
  padding: 16px;
}

.exception-list,
.bill-chain,
.scan-grid {
  display: grid;
  gap: 10px;
}

.bill-chain {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
}

.scan-card {
  display: grid;
  min-height: 82px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: linear-gradient(180deg, var(--el-fill-color-lighter), var(--el-bg-color));
  gap: 6px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.bill-node {
  display: grid;
  min-height: 88px;
  place-items: center;
  padding: 12px;
  border-color: var(--el-border-color-lighter);
  text-align: center;
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
  .workspace-grid,
  .split-layout--w1,
  .workbench-layout,
  .kanban {
    grid-template-columns: 1fr;
  }

  .queue-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-workspace-v2-page {
    padding: 12px;
  }

  .metric-grid,
  .quick-list,
  .queue-list,
  .bill-chain {
    grid-template-columns: 1fr;
  }
}
</style>
