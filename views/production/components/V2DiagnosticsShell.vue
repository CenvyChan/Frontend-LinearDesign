<script lang="ts" setup>
import { computed, ref } from 'vue';

type V2Tone = string;

interface V2Metric {
  label: string;
  tone?: V2Tone;
  value: number | string;
}

interface V2Stage {
  blocked?: number;
  description?: string;
  done?: number;
  key: string;
  label: string;
  tone?: V2Tone;
  total?: number;
  value?: number | string;
}

interface V2Issue {
  count: number;
  key: string;
  label: string;
  tone?: V2Tone;
}

interface V2Chain {
  key: string | number;
  primary: string;
  secondary?: string;
  status?: string;
  tone?: V2Tone;
}

const props = defineProps<{
  chainTitle?: string;
  chains?: V2Chain[];
  description: string;
  eyebrow: string;
  issueTitle?: string;
  issues?: V2Issue[];
  metrics: V2Metric[];
  stages?: V2Stage[];
  title: string;
}>();

const emit = defineEmits<{
  stageClick: [stageKey: string, stage: V2Stage];
}>();

const overviewExpanded = ref(false);
const overviewHidden = ref(false);
const activeStageKey = ref('');

const visibleChains = computed(() => props.chains?.slice(0, overviewExpanded.value ? 8 : 4) || []);
const visibleIssues = computed(() => props.issues?.slice(0, overviewExpanded.value ? 6 : 3) || []);

function metricClass(tone?: V2Tone) {
  return tone ? `metric-chip--${tone}` : '';
}

function tagType(tone?: V2Tone) {
  const map: Record<string, string> = {
    danger: 'danger',
    primary: 'primary',
    stable: 'success',
    success: 'success',
    warning: 'warning',
  };
  return map[tone || ''] || 'info';
}

function stageValue(stage: V2Stage) {
  if (stage.value !== undefined) return stage.value;
  if (stage.total !== undefined) return stage.total;
  return '-';
}

function toggleStage(stage: V2Stage) {
  activeStageKey.value = activeStageKey.value === stage.key ? '' : stage.key;
  emit('stageClick', activeStageKey.value, stage);
}
</script>

<template>
  <div class="v2-diagnostics-page">
    <section class="title-banner">
      <div class="hero-copy">
        <span class="eyebrow">{{ props.eyebrow }}</span>
        <div class="title-line">
          <h2>{{ props.title }}</h2>
          <el-tooltip :content="props.description" effect="dark" placement="bottom-start">
            <span class="help-mark" tabindex="0">?</span>
          </el-tooltip>
        </div>
      </div>
      <div class="hero-actions">
        <el-button v-if="overviewHidden" size="small" @click="overviewHidden = false">显示概览</el-button>
        <el-button v-else size="small" @click="overviewExpanded = !overviewExpanded">
          {{ overviewExpanded ? '缩小概览' : '展开概览' }}
        </el-button>
        <el-button v-if="!overviewHidden" size="small" @click="overviewHidden = true">隐藏概览</el-button>
        <slot name="actions" />
      </div>
    </section>

    <section
      v-if="!overviewHidden"
      class="overview-panel"
      :class="{ 'overview-panel--expanded': overviewExpanded }"
    >
      <div class="overview-head">
        <div>
          <strong>运行概览</strong>
          <span>指标、流程阶段、异常优先区与单据链按当前返回数据推导</span>
        </div>
        <el-tag size="small" :type="activeStageKey ? 'warning' : 'info'">
          {{ activeStageKey || '全部维度' }}
        </el-tag>
      </div>

      <div class="metric-row" :style="{ '--metric-count': String(Math.max(props.metrics.length, 1)) }">
        <button
          v-for="metric in props.metrics"
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
        <div v-if="props.stages?.length" class="stage-track">
          <el-tooltip
            v-for="stage in props.stages"
            :key="stage.key"
            :content="stage.description || stage.label"
            effect="dark"
            placement="top"
          >
            <button
              class="stage-pill"
              :class="[`stage-pill--${stage.tone || 'info'}`, { 'stage-pill--active': activeStageKey === stage.key }]"
              type="button"
              @click="toggleStage(stage)"
            >
              <span>{{ stage.label }}</span>
              <strong>{{ stageValue(stage) }}</strong>
            </button>
          </el-tooltip>
        </div>

        <div v-else class="stage-track stage-track--empty">
          <span class="muted-text">暂无流程阶段</span>
        </div>

        <div class="priority-strip">
          <div class="strip-title">
            <strong>{{ props.issueTitle || '异常优先区' }}</strong>
            <span>{{ props.issues?.length || 0 }} 项</span>
          </div>
          <div v-if="visibleIssues.length" class="issue-row">
            <el-tag
              v-for="issue in visibleIssues"
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
            <strong>{{ props.chainTitle || '关键链路' }}</strong>
            <span>{{ props.chains?.length || 0 }} 条</span>
          </div>
          <div v-if="visibleChains.length" class="chain-row">
            <div v-for="chain in visibleChains" :key="chain.key" class="chain-item">
              <span>{{ chain.primary }}</span>
              <strong>{{ chain.secondary || '-' }}</strong>
              <el-tag :type="tagType(chain.tone)" size="small">{{ chain.status || '-' }}</el-tag>
            </div>
          </div>
          <span v-else class="muted-text">暂无链路数据</span>
        </div>
      </div>
    </section>

    <slot name="toolbar" />
    <slot />
  </div>
</template>

<style scoped>
.v2-diagnostics-page {
  height: 100%;
  min-height: 100%;
  padding: 10px;
  overflow: auto;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}

.title-banner,
.overview-panel,
:slotted(.v2-panel) {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.title-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  padding: 8px 10px;
  border-left: 3px solid var(--el-color-primary);
}

.hero-copy {
  min-width: 0;
}

.title-line,
.hero-actions,
.overview-head,
.overview-head > div,
.strip-title,
.issue-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-line h2 {
  overflow: hidden;
  margin: 1px 0 0;
  color: var(--el-text-color-primary);
  font-size: 17px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eyebrow,
.overview-head span,
.metric-chip span,
.muted-text,
.strip-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.eyebrow {
  color: var(--el-color-primary);
  font-weight: 700;
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
  line-height: 1;
  cursor: help;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
}

.hero-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.overview-panel {
  margin-bottom: 6px;
  padding: 7px 8px;
}

.overview-head {
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 5px;
}

.overview-head strong,
.strip-title strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  white-space: nowrap;
}

.overview-panel:not(.overview-panel--expanded) .overview-head span,
.overview-panel:not(.overview-panel--expanded) .chain-item:nth-child(n + 3) {
  display: none;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(var(--metric-count), minmax(0, 1fr));
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
  min-height: 32px;
  gap: 6px;
  padding: 5px 8px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: default;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--el-border-color-lighter);
}

.metric-chip:last-child {
  border-right: 0;
}

.metric-chip strong,
.stage-pill strong {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-chip--danger strong {
  color: var(--el-color-danger);
}

.metric-chip--primary strong {
  color: var(--el-color-primary);
}

.metric-chip--success strong,
.metric-chip--stable strong {
  color: var(--el-color-success);
}

.metric-chip--warning strong {
  color: var(--el-color-warning);
}

.diagnostic-row {
  display: grid;
  grid-template-columns: minmax(360px, 1.05fr) minmax(220px, 0.58fr) minmax(340px, 0.92fr);
  gap: 7px;
  margin-top: 6px;
}

.stage-track,
.priority-strip,
.chain-strip {
  min-width: 0;
  padding: 6px 7px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.stage-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 5px;
  align-content: start;
}

.stage-track--empty {
  display: flex;
  align-items: center;
}

.stage-pill {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  gap: 5px;
  padding: 4px 7px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-top: 2px solid var(--el-color-info);
  border-radius: 5px;
}

.stage-pill span {
  overflow: hidden;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-pill:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 3px 8px rgb(0 0 0 / 5%);
}

.stage-pill--active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
}

.stage-pill--danger {
  border-top-color: var(--el-color-danger);
}

.stage-pill--primary {
  border-top-color: var(--el-color-primary);
}

.stage-pill--success,
.stage-pill--stable {
  border-top-color: var(--el-color-success);
}

.stage-pill--warning {
  border-top-color: var(--el-color-warning);
}

.strip-title {
  justify-content: space-between;
  min-height: 22px;
  margin-bottom: 4px;
}

.issue-row {
  flex-wrap: wrap;
  min-height: 28px;
}

.chain-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
  max-height: 94px;
  overflow: auto;
}

.chain-item {
  display: grid;
  grid-template-columns: minmax(86px, 0.8fr) minmax(92px, 1fr) auto;
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
  color: var(--el-text-color-regular);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chain-item strong {
  color: var(--el-text-color-primary);
}

:slotted(.v2-panel) {
  margin-bottom: 6px;
  padding: 8px;
}

:slotted(.v2-table-panel) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 1280px) {
  .diagnostic-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1100px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-chip:nth-child(2n) {
    border-right: 0;
  }
}

@media (max-width: 720px) {
  .title-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .metric-row,
  .stage-track {
    grid-template-columns: 1fr;
  }

  .metric-chip {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}
</style>
