<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  getResourceBizRecords,
  type BizRecordItem,
  type ResourceType,
} from '#/api/resourceBiz';

import { resourceBizActionLabels } from './resource-biz-rules';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    resourceId?: number | null;
    resourceType: ResourceType;
  }>(),
  {
    active: true,
    resourceId: null,
  },
);

const loading = ref(false);
const records = ref<BizRecordItem[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);

const hasResource = computed(() => Boolean(props.resourceId));

function getRecordBizType(record: BizRecordItem) {
  return (record.bizType || record.businessType || '').toUpperCase();
}

function getRecordBizLabel(record: BizRecordItem) {
  const type = getRecordBizType(record);
  return resourceBizActionLabels[type as keyof typeof resourceBizActionLabels] || type || '-';
}

function getRecordTime(record: BizRecordItem) {
  const value = record.bizTime ?? record.businessDate ?? record.createTime ?? record.createdTime;
  if (!value) return '-';
  const time = typeof value === 'number' ? dayjs(value) : dayjs(value);
  return time.isValid() ? time.format('YYYY-MM-DD HH:mm') : String(value);
}

async function loadRecords() {
  if (!props.resourceId || !props.active) return;
  loading.value = true;
  try {
    const res = await getResourceBizRecords(
      props.resourceType,
      props.resourceId,
      page.value - 1,
      size.value,
    );
    if (res.success) {
      records.value = res.data || [];
      total.value = res.total || 0;
    } else {
      ElMessage.error(res.message || '获取业务记录失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取业务记录失败');
  } finally {
    loading.value = false;
  }
}

function refresh() {
  page.value = 1;
  return loadRecords();
}

watch(
  () => [props.resourceId, props.active, props.resourceType],
  () => {
    if (props.active && props.resourceId) {
      refresh();
    } else {
      records.value = [];
      total.value = 0;
    }
  },
  { immediate: true },
);

defineExpose({ reload: refresh });
</script>

<template>
  <div class="resource-biz-record-tab">
    <div v-if="hasResource" class="resource-biz-record-tab__toolbar">
      <el-button :loading="loading" size="small" @click="refresh" :icon="'Refresh'">刷新</el-button>
    </div>
    <el-empty v-if="!hasResource" description="请选择资源" />
    <template v-else>
      <el-table
        v-loading="loading"
        :data="records"
        border
        max-height="420"
        size="small"
        stripe
      >
        <el-table-column label="业务" width="92">
          <template #default="{ row }">
            <el-tag size="small">{{ getRecordBizLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发生时间" min-width="150">
          <template #default="{ row }">{{ getRecordTime(row) }}</template>
        </el-table-column>
        <el-table-column label="操作员" min-width="100" prop="operatorName" />
        <el-table-column label="状态变化" min-width="130">
          <template #default="{ row }">
            <span v-if="row.statusBefore || row.statusAfter">
              {{ row.statusBefore || '-' }} -> {{ row.statusAfter || '-' }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="业务详情" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.bizDetail || row.resultDescription || row.remark || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="下次日期" min-width="120">
          <template #default="{ row }">
            {{ row.nextBizDate || row.nextCalibrationDate || '-' }}
          </template>
        </el-table-column>
      </el-table>
      <div class="resource-biz-record-tab__pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :page-sizes="[10, 20, 50]"
          :total="total"
          background
          layout="total, sizes, prev, pager, next"
          size="small"
          @current-change="loadRecords"
          @size-change="refresh"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.resource-biz-record-tab {
  min-height: 240px;
}

.resource-biz-record-tab__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.resource-biz-record-tab__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
