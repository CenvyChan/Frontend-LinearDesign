<script lang="ts" setup>
import type { DashboardOverviewV2Scenario } from './overview-v2-model';

import { computed, ref } from 'vue';

import { createIconifyIcon } from '@vben/icons';

const props = defineProps<{
  eyebrow: string;
  loading?: boolean;
  scenario: DashboardOverviewV2Scenario;
  scenarios: DashboardOverviewV2Scenario[];
  subtitle: string;
  updatedAt?: number;
}>();

const emit = defineEmits<{
  refresh: [];
  select: [scenario: DashboardOverviewV2Scenario];
}>();

const RefreshIcon = createIconifyIcon('lucide:refresh-cw');
const SwitchIcon = createIconifyIcon('lucide:arrow-up-down');
const scenarioDialogVisible = ref(false);

const updatedText = computed(() => {
  if (!props.updatedAt) {
    return '等待数据';
  }
  return new Date(props.updatedAt).toLocaleString();
});

function selectScenario(scenario: DashboardOverviewV2Scenario) {
  scenarioDialogVisible.value = false;
  emit('select', scenario);
}
</script>

<template>
  <section class="scenario-header">
    <div class="scenario-copy">
      <span class="eyebrow">{{ eyebrow }}</span>
      <h2>
        <span>{{ scenario.code }}</span>
        {{ scenario.title }}
        <el-tooltip content="切换方案" placement="top">
          <el-button
            class="scenario-switch-button"
            circle
            :icon="SwitchIcon"
            size="small"
            type="primary"
            @click="scenarioDialogVisible = true"
          />
        </el-tooltip>
      </h2>
      <p>{{ subtitle }}</p>
      <div class="tag-row">
        <el-tag v-for="tag in scenario.tags" :key="tag" effect="light" size="small">
          {{ tag }}
        </el-tag>
      </div>
    </div>

    <div class="scenario-actions">
      <div class="meta-row">
        <span>{{ updatedText }}</span>
        <el-button :icon="RefreshIcon" :loading="loading" size="small" @click="emit('refresh')">
          刷新
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="scenarioDialogVisible"
      append-to-body
      class="dashboard-scenario-dialog"
      destroy-on-close
      title="切换方案"
      width="720px"
    >
      <div class="scenario-picker">
        <button
          v-for="item in scenarios"
          :key="item.code"
          class="scenario-picker-card"
          :class="{ 'is-active': item.code === scenario.code }"
          type="button"
          @click="selectScenario(item)"
        >
          <span class="scenario-picker-code">{{ item.code }}</span>
          <strong>{{ item.title }}</strong>
          <em>{{ item.description }}</em>
        </button>
      </div>
    </el-dialog>
  </section>
</template>

<style lang="scss" scoped>
.scenario-header {
  display: flex;
  min-height: 104px;
  gap: 20px;
  align-items: stretch;
  justify-content: space-between;
  padding: 16px 18px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-left: 4px solid var(--el-color-primary);
  border-radius: 8px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-color-primary) 8%, transparent), transparent 34%),
    var(--el-bg-color);
  box-shadow: 0 10px 28px rgb(15 23 42 / 8%);
}

.scenario-copy {
  display: grid;
  min-width: 0;
  align-content: center;

  h2 {
    display: flex;
    margin: 4px 0 8px;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 760;
    line-height: 1.22;

    span {
      display: inline-flex;
      min-width: 46px;
      min-height: 30px;
      align-items: center;
      justify-content: center;
      border: 1px solid color-mix(in srgb, var(--el-color-primary) 26%, var(--el-border-color));
      border-radius: 6px;
      background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
      color: var(--el-color-primary);
      font-size: 15px;
      font-weight: 800;
    }
  }

  p {
    max-width: 780px;
    margin: 0;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }
}

.scenario-switch-button {
  margin-left: 2px;
  vertical-align: middle;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--el-color-primary) 24%, transparent);
}

.eyebrow {
  display: block;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 760;
  text-transform: uppercase;
}

.tag-row {
  display: flex;
  margin-top: 10px;
  flex-wrap: wrap;
  gap: 6px;
}

.scenario-actions {
  display: flex;
  min-width: 210px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 10px;
}

.meta-row {
  display: flex;
  min-height: 42px;
  padding: 8px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-fill-color-lighter) 72%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 12px;

  > span {
    max-width: 148px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--el-text-color-primary);
    font-size: 14px;
  }
}

.scenario-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scenario-picker-card {
  display: grid;
  min-height: 118px;
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-left: 3px solid transparent;
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--el-fill-color-lighter) 64%, transparent), transparent),
    var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  gap: 8px;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;

  &:hover,
  &:focus-visible,
  &.is-active {
    border-color: var(--el-color-primary);
    border-left-color: var(--el-color-primary);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--el-color-primary) 10%, transparent), transparent),
      var(--el-bg-color);
    box-shadow: 0 10px 24px rgb(15 23 42 / 10%);
    outline: none;
  }

  strong {
    font-size: 15px;
  }

  em {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-style: normal;
    line-height: 1.6;
  }
}

.scenario-picker-code {
  display: inline-flex;
  width: fit-content;
  min-width: 38px;
  min-height: 26px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, var(--el-border-color));
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 800;
}

@media (max-width: 820px) {
  .scenario-header {
    flex-direction: column;
  }

  .scenario-actions {
    width: 100%;
    min-width: 0;
    align-items: flex-start;
  }

  .meta-row {
    width: 100%;
    justify-content: space-between;
  }

  .scenario-picker {
    grid-template-columns: 1fr;
  }
}
</style>
