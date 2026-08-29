<script lang="ts" setup>
import { computed } from 'vue';

import type { ResourceBizAction, ResourceType } from '#/api/resourceBiz';

import {
  getResourceBizActions,
  getResourceBizDisabledReason,
  isResourceBizActionDisabled,
} from './resource-biz-rules';

const props = defineProps<{
  resourceType: ResourceType;
  row: Record<string, any>;
}>();

const emit = defineEmits<{
  action: [action: ResourceBizAction];
}>();

const actionItems = computed(() =>
  getResourceBizActions(props.resourceType).map((item) => {
    const disabled = isResourceBizActionDisabled(props.resourceType, props.row, item.action);
    return {
      ...item,
      disabled,
      reason: disabled
        ? getResourceBizDisabledReason(props.resourceType, props.row, item.action)
        : '',
    };
  }),
);
</script>

<template>
  <div class="resource-biz-actions">
    <el-tooltip
      v-for="item in actionItems"
      :key="item.action"
      :content="item.reason || item.label"
      :disabled="!item.disabled"
      placement="top"
    >
      <span class="resource-biz-actions__item">
        <el-button
          :disabled="item.disabled"
          :icon="item.icon"
          :type="item.buttonType"
          link
          size="small"
          @click="emit('action', item.action)"
        >
          {{ item.label }}
        </el-button>
      </span>
    </el-tooltip>
  </div>
</template>

<style scoped>
.resource-biz-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 2px 6px;
  line-height: 1;
}

.resource-biz-actions__item {
  display: inline-flex;
}
</style>
