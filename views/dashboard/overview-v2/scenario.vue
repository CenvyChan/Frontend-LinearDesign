<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createIconifyIcon } from '@vben/icons';

import {
  getDashboardScenarioByCode,
  type DashboardOverviewV2GroupKey,
} from './overview-v2-model';

defineOptions({ name: 'DashboardOverviewScenarioV2' });

const route = useRoute();
const router = useRouter();
const ArrowLeftIcon = createIconifyIcon('lucide:arrow-left');
const RefreshIcon = createIconifyIcon('lucide:refresh-cw');

const group = computed(() => {
  const value = String(route.params.group || '');
  return value === 'analytics' || value === 'workspace'
    ? (value as DashboardOverviewV2GroupKey)
    : undefined;
});

const code = computed(() => String(route.params.code || '').toUpperCase());
const scenario = computed(() => {
  if (!group.value) return undefined;
  return getDashboardScenarioByCode(group.value, code.value);
});

const groupTitle = computed(() => {
  if (group.value === 'analytics') return '分析页入口';
  if (group.value === 'workspace') return '工作台入口';
  return '未知入口';
});

function backToOverview() {
  router.push('/dashboard/overview-v2');
}

function refreshPage() {
  router.go(0);
}
</script>

<template>
  <div class="dashboard-scenario-v2-page">
    <section class="scenario-hero">
      <div class="hero-copy">
        <span class="eyebrow">Dashboard V2 Reserved Route</span>
        <h2>{{ scenario ? `${scenario.code} ${scenario.title}` : '未找到预留方案' }}</h2>
        <p v-if="scenario">{{ scenario.description }}</p>
        <p v-else>当前路径没有匹配到 A1-A6 或 W1-W6 的总览入口方案。</p>
      </div>
      <div class="hero-actions">
        <el-button :icon="ArrowLeftIcon" size="small" @click="backToOverview">返回总览</el-button>
        <el-button :icon="RefreshIcon" size="small" @click="refreshPage">刷新</el-button>
      </div>
    </section>

    <section class="placeholder-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">{{ groupTitle }}</span>
          <h3>{{ scenario ? 'V2 场景预留页' : '路由兜底' }}</h3>
        </div>
        <el-tag :type="scenario ? 'warning' : 'danger'" effect="plain" size="small">
          {{ scenario ? '待接真实页面' : '未匹配' }}
        </el-tag>
      </div>

      <template v-if="scenario">
        <div class="detail-grid">
          <div class="detail-item">
            <span>方案编号</span>
            <strong>{{ scenario.code }}</strong>
          </div>
          <div class="detail-item">
            <span>入口分组</span>
            <strong>{{ groupTitle }}</strong>
          </div>
          <div class="detail-item detail-item--wide">
            <span>来源原型</span>
            <strong>{{ scenario.prototypePath }}</strong>
          </div>
        </div>

        <div class="tag-block">
          <span>方案标签</span>
          <div>
            <el-tag v-for="tag in scenario.tags" :key="tag" effect="light" size="small">
              {{ tag }}
            </el-tag>
          </div>
        </div>

        <div class="reserved-note">
          <strong>当前阶段</strong>
          <p>此 URL 已作为生产系统内的 V2 预留入口固定下来，后续 A/W 方案验收后直接在本路由替换为真实看板或工作台实现。</p>
        </div>
      </template>

      <div v-else class="empty-state">
        <strong>{{ code || '-' }}</strong>
        <span>请从总览入口选择有效方案。</span>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-scenario-v2-page {
  --dashboard-page-bg: var(--el-bg-color-page);
  --dashboard-surface-bg: var(--el-bg-color);
  --dashboard-surface-alt: var(--el-fill-color-lighter);
  --dashboard-border: var(--el-border-color-light);
  --dashboard-border-soft: var(--el-border-color-lighter);
  --dashboard-text: var(--el-text-color-primary);
  --dashboard-text-secondary: var(--el-text-color-secondary);
  --dashboard-accent: var(--el-color-primary);
  --dashboard-accent-soft: var(--el-color-primary-light-9);
  --dashboard-warn-soft: var(--el-color-warning-light-9);
  --dashboard-danger-soft: var(--el-color-danger-light-9);
  min-height: 100%;
  padding: 20px;
  color: var(--dashboard-text);
  background: linear-gradient(180deg, var(--dashboard-page-bg) 0%, var(--dashboard-surface-alt) 100%);
}

.scenario-hero,
.placeholder-panel {
  width: 100%;
  border: 1px solid var(--dashboard-border);
  border-radius: 8px;
  background: var(--dashboard-surface-bg);
  box-shadow: var(--el-box-shadow-light);
}

.scenario-hero {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px;
}

.hero-copy {
  min-width: 0;

  h2 {
    margin: 4px 0 8px;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  p {
    max-width: 820px;
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
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero-actions {
  display: flex;
  min-height: 32px;
  flex: 0 0 auto;
  gap: 8px;
}

.placeholder-panel {
  margin-top: 16px;
  padding: 18px;
}

.panel-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    margin: 4px 0 0;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px;
}

.detail-item,
.tag-block,
.reserved-note,
.empty-state {
  border: 1px solid var(--dashboard-border-soft);
  border-radius: 8px;
  background: var(--dashboard-surface-alt);
}

.detail-item {
  min-height: 84px;
  padding: 14px;

  span {
    display: block;
    color: var(--dashboard-text-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: var(--dashboard-text);
    font-size: 17px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
}

.detail-item--wide {
  grid-column: 1 / -1;
}

.tag-block {
  display: flex;
  min-height: 68px;
  margin-top: 12px;
  padding: 14px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;

  > span {
    color: var(--dashboard-text-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
}

.reserved-note {
  margin-top: 12px;
  padding: 14px;

  strong {
    display: block;
    color: var(--el-color-warning);
    font-size: 14px;
  }

  p {
    margin: 8px 0 0;
    color: var(--dashboard-text-secondary);
    line-height: 1.7;
  }
}

.empty-state {
  display: flex;
  min-height: 160px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--dashboard-text-secondary);
  gap: 8px;

  strong {
    color: var(--el-color-danger);
    font-size: 28px;
  }
}

@media (max-width: 720px) {
  .dashboard-scenario-v2-page {
    padding: 12px;
  }

  .scenario-hero,
  .placeholder-panel {
    padding: 14px;
  }

  .scenario-hero,
  .panel-head,
  .tag-block {
    flex-direction: column;
  }

  .hero-actions,
  .tag-block > div {
    justify-content: flex-start;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
