<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { createIconifyIcon } from '@vben/icons';

import { dashboardOverviewV2Scenarios, getDashboardOverviewV2Groups } from './overview-v2-model';

defineOptions({ name: 'DashboardOverviewV2' });

const router = useRouter();
const ArrowRightIcon = createIconifyIcon('lucide:arrow-right');
const BarChart3Icon = createIconifyIcon('lucide:bar-chart-3');
const BlocksIcon = createIconifyIcon('lucide:blocks');
const BriefcaseIcon = createIconifyIcon('lucide:briefcase-business');
const RefreshIcon = createIconifyIcon('lucide:refresh-cw');

const groups = getDashboardOverviewV2Groups();
const analyticsCount = computed(
  () => dashboardOverviewV2Scenarios.filter((item) => item.group === 'analytics').length,
);
const workspaceCount = computed(
  () => dashboardOverviewV2Scenarios.filter((item) => item.group === 'workspace').length,
);

const entryCards = [
  {
    description: '聚合 A1-A6 方案，重点看闭环、计划、质量、ERP 链路与入库风险。',
    icon: BarChart3Icon,
    path: '/dashboard/analytics-v2',
    title: '分析页 V2',
  },
  {
    description: '聚合 W1-W6 角色工作台，重点看今日任务、异常优先级和跨部门协作。',
    icon: BriefcaseIcon,
    path: '/dashboard/workspace-v2',
    title: '工作台 V2',
  },
];

function openPage(path: string) {
  router.push(path);
}

function refreshOverview() {
  router.go(0);
}
</script>

<template>
  <div class="dashboard-overview-v2-page">
    <section class="overview-hero">
      <div class="hero-copy">
        <span class="eyebrow">Dashboard V2</span>
        <h2>总览入口 V2</h2>
        <p>
          这是一张并行验收入口页。我们把总览、分析页、工作台分别拆成独立新页面，方便你在前端直接检查信息结构、卡片分组和后续落地方向。
        </p>
      </div>
      <div class="hero-side">
        <div class="hero-actions">
          <el-button :icon="RefreshIcon" size="small" @click="refreshOverview">刷新</el-button>
        </div>
        <div class="metric-strip">
          <div class="metric-item">
            <span>分析方案</span>
            <strong>{{ analyticsCount }}</strong>
          </div>
          <div class="metric-item">
            <span>工作台方案</span>
            <strong>{{ workspaceCount }}</strong>
          </div>
          <div class="metric-item">
            <span>新页面</span>
            <strong>3</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="entry-panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Review Pages</span>
          <h3>先检查三个独立页面</h3>
          <p>总览页负责导航，分析页和工作台页负责承接真实的方案分组与验收入口。</p>
        </div>
        <el-tag effect="plain" size="small">并行落地</el-tag>
      </div>

      <div class="entry-grid">
        <button
          v-for="item in entryCards"
          :key="item.path"
          class="entry-card"
          type="button"
          @click="openPage(item.path)"
        >
          <span class="entry-icon">
            <component :is="item.icon" />
          </span>
          <span class="entry-title">{{ item.title }}</span>
          <span class="entry-desc">{{ item.description }}</span>
          <span class="card-action">
            <span>进入页面</span>
            <component :is="ArrowRightIcon" />
          </span>
        </button>
      </div>
    </section>

    <section v-for="group in groups" :key="group.key" class="scenario-section">
      <div class="section-head">
        <div>
          <span class="eyebrow">{{ group.key === 'analytics' ? 'Analytics' : 'Workspace' }}</span>
          <h3>{{ group.title }}</h3>
          <p>{{ group.description }}</p>
        </div>
        <el-tag effect="plain" size="small">{{ group.items.length }} 个候选方案</el-tag>
      </div>

      <div class="scenario-grid">
        <article v-for="scenario in group.items" :key="scenario.code" class="scenario-card">
          <span class="scenario-code">{{ scenario.code }}</span>
          <span class="scenario-title">{{ scenario.title }}</span>
          <span class="scenario-desc">{{ scenario.description }}</span>
          <span class="tag-row">
            <el-tag v-for="tag in scenario.tags" :key="tag" effect="light" size="small">
              {{ tag }}
            </el-tag>
          </span>
        </article>
      </div>
    </section>

    <section class="compare-note">
      <div class="note-icon">
        <component :is="BlocksIcon" />
      </div>
      <div>
        <h3>验收说明</h3>
        <p>
          现阶段不替换现有 `/analytics` 与 `/workspace`。请优先检查
          `总览入口 V2`、`分析页 V2`、`工作台 V2` 三张新页面，确认结构后再决定是否继续把 A/W 方案逐个升级成正式业务页。
        </p>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-overview-v2-page {
  --dashboard-page-bg: var(--el-bg-color-page);
  --dashboard-surface-bg: var(--el-bg-color);
  --dashboard-surface-alt: var(--el-fill-color-lighter);
  --dashboard-border: var(--el-border-color-light);
  --dashboard-border-soft: var(--el-border-color-lighter);
  --dashboard-text: var(--el-text-color-primary);
  --dashboard-text-secondary: var(--el-text-color-secondary);
  --dashboard-accent: var(--el-color-primary);
  --dashboard-accent-soft: var(--el-color-primary-light-9);
  --dashboard-info-soft: var(--el-color-info-light-9);
  --dashboard-success-soft: var(--el-color-success-light-9);
  min-height: 100%;
  padding: 20px;
  color: var(--dashboard-text);
  background: linear-gradient(180deg, var(--dashboard-page-bg) 0%, var(--dashboard-surface-alt) 100%);
}

.overview-hero,
.entry-panel,
.scenario-section,
.compare-note {
  width: 100%;
  border: 1px solid var(--dashboard-border);
  border-radius: 12px;
  background: var(--dashboard-surface-bg);
  box-shadow: var(--el-box-shadow-light);
  backdrop-filter: blur(6px);
}

.overview-hero {
  display: flex;
  gap: 24px;
  align-items: stretch;
  justify-content: space-between;
  padding: 24px;
}

.hero-copy {
  min-width: 0;

  h2 {
    margin: 6px 0 10px;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
  }

  p {
    max-width: 760px;
    margin: 0;
    color: var(--dashboard-text-secondary);
    line-height: 1.7;
  }
}

.eyebrow {
  display: block;
  color: var(--dashboard-accent);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.hero-side {
  display: flex;
  flex: 0 0 360px;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.hero-actions {
  display: flex;
  justify-content: flex-end;
  min-height: 32px;
}

.metric-strip {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.metric-item {
  min-height: 76px;
  padding: 14px;
  border: 1px solid var(--dashboard-border-soft);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--dashboard-surface-alt) 0%, var(--dashboard-surface-bg) 100%);

  span {
    display: block;
    color: var(--dashboard-text-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: var(--dashboard-text);
    font-size: 28px;
    line-height: 1;
  }
}

.entry-panel,
.scenario-section {
  margin-top: 16px;
  padding: 18px;
}

.section-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;

  h3 {
    margin: 4px 0 6px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
  }

  p {
    margin: 0;
    color: var(--dashboard-text-secondary);
    line-height: 1.6;
  }
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 14px;
}

.entry-card,
.scenario-card {
  display: flex;
  border: 1px solid var(--dashboard-border);
  border-radius: 10px;
  flex-direction: column;
  align-items: flex-start;
  background: var(--dashboard-surface-bg);
  color: inherit;
  text-align: left;
}

.entry-card {
  min-height: 208px;
  padding: 18px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--dashboard-accent);
    box-shadow: var(--el-box-shadow-light);
    outline: none;
    transform: translateY(-1px);
  }
}

.entry-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--dashboard-accent-soft);
  color: var(--dashboard-accent);

  :deep(svg) {
    width: 22px;
    height: 22px;
  }
}

.entry-title {
  margin-top: 16px;
  color: var(--dashboard-text);
  font-size: 20px;
  font-weight: 700;
}

.entry-desc {
  margin-top: 8px;
  color: var(--dashboard-text-secondary);
  line-height: 1.7;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
}

.scenario-card {
  min-height: 206px;
  padding: 16px;
}

.scenario-code {
  display: inline-flex;
  min-width: 42px;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--dashboard-info-soft);
  color: var(--el-color-info);
  font-size: 13px;
  font-weight: 800;
}

.scenario-title {
  display: block;
  margin-top: 12px;
  color: var(--dashboard-text);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}

.scenario-desc {
  display: -webkit-box;
  min-height: 68px;
  margin-top: 8px;
  overflow: hidden;
  color: var(--dashboard-text-secondary);
  font-size: 13px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.tag-row {
  display: flex;
  min-height: 24px;
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 6px;
}

.card-action {
  display: inline-flex;
  min-height: 28px;
  margin-top: auto;
  align-items: center;
  gap: 6px;
  color: var(--dashboard-accent);
  font-size: 13px;
  font-weight: 700;

  :deep(svg) {
    width: 15px;
    height: 15px;
  }
}

.compare-note {
  display: flex;
  gap: 14px;
  margin-top: 16px;
  padding: 18px;
  align-items: flex-start;

  h3 {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
  }

  p {
    margin: 0;
    color: var(--dashboard-text-secondary);
    line-height: 1.7;
  }
}

.note-icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--dashboard-success-soft);
  color: var(--el-color-success);

  :deep(svg) {
    width: 20px;
    height: 20px;
  }
}

@media (max-width: 1180px) {
  .overview-hero {
    flex-direction: column;
  }

  .hero-side {
    flex: none;
    width: 100%;
    align-items: stretch;
  }

  .entry-grid,
  .scenario-grid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard-overview-v2-page {
    padding: 12px;
  }

  .overview-hero,
  .entry-panel,
  .scenario-section,
  .compare-note {
    padding: 14px;
  }

  .metric-strip,
  .entry-grid,
  .scenario-grid {
    grid-template-columns: 1fr;
  }

  .section-head,
  .compare-note {
    flex-direction: column;
  }
}
</style>
