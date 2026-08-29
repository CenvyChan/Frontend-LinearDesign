<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import {
  getNotificationLevels,
  getNotificationLogList,
  getTriggerTypes,
  type NotificationLogItem,
} from '#/api/notification';

defineOptions({ name: 'NotificationLog' });

const loading = ref(false);
const tableData = ref<NotificationLogItem[]>([]);
const total = ref(0);
const triggerTypes = ref<string[]>([]);
const notificationLevels = ref<string[]>([]);

const queryParams = reactive({
  dateRange: [] as string[],
  dingtalkSent: '' as '' | 'false' | 'true',
  keyword: '',
  notificationLevel: '',
  page: 1,
  sendSuccess: '' as '' | 'false' | 'true',
  size: 20,
  triggerType: '',
});

function unwrapList(res: any) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function formatTime(time?: number | string | null) {
  if (!time) return '-';
  const value = String(time);
  if (value.length === 14) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  }
  return typeof time === 'number' ? new Date(time).toLocaleString() : value;
}

function boolParam(value: '' | 'false' | 'true') {
  if (value === '') return undefined;
  return value === 'true';
}

async function fetchOptions() {
  const [triggerRes, levelRes]: any[] = await Promise.all([getTriggerTypes(), getNotificationLevels()]);
  triggerTypes.value = unwrapList(triggerRes);
  notificationLevels.value = unwrapList(levelRes);
}

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getNotificationLogList({
      dingtalkSent: boolParam(queryParams.dingtalkSent),
      endTime: queryParams.dateRange?.[1],
      keyword: queryParams.keyword || undefined,
      notificationLevel: queryParams.notificationLevel || undefined,
      page: queryParams.page - 1,
      sendSuccess: boolParam(queryParams.sendSuccess),
      size: queryParams.size,
      startTime: queryParams.dateRange?.[0],
      triggerType: queryParams.triggerType || undefined,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = res.total || res.data?.total || 0;
    } else {
      ElMessage.error(res.message || '获取通知记录失败');
    }
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.page = 1;
  fetchData();
}

function handleReset() {
  queryParams.dateRange = [];
  queryParams.dingtalkSent = '';
  queryParams.keyword = '';
  queryParams.notificationLevel = '';
  queryParams.sendSuccess = '';
  queryParams.triggerType = '';
  handleQuery();
}

onMounted(() => {
  fetchOptions();
  fetchData();
});
</script>

<template>
  <div class="p-5">
    <div class="mb-4">
      <h1 class="text-lg font-semibold">通知记录</h1>
    </div>

    <el-card class="mb-4" shadow="never">
      <el-form :inline="true" :model="queryParams">
        <el-form-item label="触发类型">
          <el-select v-model="queryParams.triggerType" clearable placeholder="全部" style="width: 150px">
            <el-option v-for="item in triggerTypes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="通知级别">
          <el-select v-model="queryParams.notificationLevel" clearable placeholder="全部" style="width: 130px">
            <el-option v-for="item in notificationLevels" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="发送状态">
          <el-select v-model="queryParams.sendSuccess" clearable placeholder="全部" style="width: 120px">
            <el-option label="成功" value="true" />
            <el-option label="失败" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="钉钉状态">
          <el-select v-model="queryParams.dingtalkSent" clearable placeholder="全部" style="width: 120px">
            <el-option label="已发送" value="true" />
            <el-option label="未发送" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="发送时间">
          <el-date-picker
            v-model="queryParams.dateRange"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            range-separator="至"
            start-placeholder="开始时间"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="queryParams.keyword" clearable placeholder="标题/内容/接收人" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="'Search'" type="primary" @click="handleQuery">查询</el-button>
          <el-button :icon="'RefreshRight'" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="tableData" border row-key="id" stripe>
        <el-table-column label="标题" min-width="180" prop="messageTitle" show-overflow-tooltip />
        <el-table-column label="触发类型" min-width="130" prop="triggerType" />
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="row.notificationLevel === 'CRITICAL' || row.notificationLevel === 'HIGH' ? 'danger' : 'info'" size="small">
              {{ row.notificationLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="接收人" min-width="160" prop="recipients" show-overflow-tooltip />
        <el-table-column label="发送" width="90">
          <template #default="{ row }">
            <el-tag :type="row.sendSuccess ? 'success' : 'danger'" size="small">
              {{ row.sendSuccess ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="钉钉" width="90">
          <template #default="{ row }">
            <el-tag :type="row.dingtalkSent ? 'success' : 'info'" size="small">
              {{ row.dingtalkSent ? '已发送' : '未发送' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发送时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.sendTime || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="内容" min-width="260" prop="messageContent" show-overflow-tooltip />
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="queryParams.page"
          v-model:page-size="queryParams.size"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchData"
          @size-change="() => { queryParams.page = 1; fetchData(); }"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}
</style>
