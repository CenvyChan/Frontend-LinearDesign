<script lang="ts" setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { ResourceBizAction } from '#/api/resourceBiz';
import {
  ensureLocalMould,
  exportMould,
  getErpMouldList,
  refreshMouldCache,
  type MouldItem,
} from '#/api/mould';
import { downloadBlob } from '#/utils/download';
import ResourceBizActions from './components/ResourceBizActions.vue';
import ResourceBizDialog from './components/ResourceBizDialog.vue';
import ResourceBizRecordTab from './components/ResourceBizRecordTab.vue';
import { getResourceStatusView } from './components/resource-biz-rules';

defineOptions({ name: 'FactoryMould' });

const loading = ref(false);
const tableData = ref<MouldItem[]>([]);
const searchKeyword = ref('');
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);
const detailVisible = ref(false);
const detailTab = ref('base');
const currentRow = ref<MouldItem | null>(null);
const bizDialogVisible = ref(false);
const currentBizAction = ref<ResourceBizAction | null>(null);
const recordTabRef = ref<InstanceType<typeof ResourceBizRecordTab>>();

const fetchData = async () => {
  loading.value = true;
  try {
    const res: any = await getErpMouldList({
      keyword: searchKeyword.value || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = Number(res.total || 0);
    } else {
      ElMessage.error(res.message || '获取模具列表失败');
    }
  } catch {
    ElMessage.error('获取模具列表失败');
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async () => {
  try {
    const res: any = await refreshMouldCache();
    if (res.success) {
      ElMessage.success(res.message || '缓存刷新成功');
      await fetchData();
    } else {
      ElMessage.error(res.message || '刷新缓存失败');
    }
  } catch {
    ElMessage.error('刷新缓存失败');
  }
};

const handleExport = async () => {
  try {
    const blob = await exportMould();
    downloadBlob(blob, '模具导出.xlsx');
  } catch {
    ElMessage.error('导出失败');
  }
};

const handleSearchChange = () => {
  currentPage.value = 1;
  fetchData();
};

const openDetail = (row: MouldItem) => {
  currentRow.value = row;
  detailTab.value = 'base';
  detailVisible.value = true;
};

const openBizDialog = async (row: MouldItem, action: ResourceBizAction) => {
  try {
    let target = row;
    if (!target.id) {
      const res: any = await ensureLocalMould(target);
      if (!res.success || !res.data?.id) {
        ElMessage.error(res.message || '缺少本地模具ID，无法执行业务操作');
        return;
      }
      target = { ...target, ...res.data };
      const index = tableData.value.findIndex((item) => item.mouldCode === row.mouldCode);
      if (index >= 0) tableData.value[index] = target;
    }
    currentRow.value = target;
    currentBizAction.value = action;
    bizDialogVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '准备本地模具档案失败');
  }
};

const handleBizSuccess = async () => {
  const selectedId = currentRow.value?.id;
  const selectedCode = currentRow.value?.mouldCode;
  await fetchData();
  currentRow.value = tableData.value.find((item) =>
    selectedId ? item.id === selectedId : item.mouldCode === selectedCode,
  ) || currentRow.value;
  await nextTick();
  recordTabRef.value?.reload();
};

watch([currentPage, pageSize], () => {
  fetchData();
});

onMounted(() => { fetchData(); });
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">模具管理</h1>
      <div class="flex gap-2">
        <el-input v-model="searchKeyword" placeholder="搜索模具编号/名称/物料" clearable style="width: 260px" @input="handleSearchChange" />
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-button type="primary" @click="handleRefresh" :icon="'Refresh'">刷新缓存</el-button>
      </div>
    </div>
    <el-card shadow="never" class="w-full">
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%" row-key="mouldCode">
        <el-table-column prop="mouldCode" label="模具编号" width="120" show-overflow-tooltip />
        <el-table-column prop="mouldName" label="模具名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="materialCode" label="物料编码" width="120" show-overflow-tooltip />
        <el-table-column prop="materialName" label="物料名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格型号" width="120" show-overflow-tooltip />
        <el-table-column prop="cavityCount" label="腔数" width="80" align="right" />
        <el-table-column prop="productType" label="产品类型" width="105" show-overflow-tooltip />
        <el-table-column label="操作" width="380" fixed="right">
          <template #default="{ row }">
            <div class="mould-actions">
              <ResourceBizActions resource-type="MOULD" :row="row" @action="(action) => openBizDialog(row, action)" />
              <el-button size="small" type="info" link @click="openDetail(row)" :icon="'View'">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="mould-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[50, 100, 200, 500]"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" title="模具详情" size="760px">
      <el-tabs v-model="detailTab">
        <el-tab-pane label="基本信息" name="base">
          <el-descriptions v-if="currentRow" :column="2" border>
            <el-descriptions-item label="模具编号">{{ currentRow.mouldCode }}</el-descriptions-item>
            <el-descriptions-item label="模具名称">{{ currentRow.mouldName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物料编码">{{ currentRow.materialCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物料名称">{{ currentRow.materialName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="规格型号">{{ currentRow.specification || '-' }}</el-descriptions-item>
            <el-descriptions-item label="腔数">{{ currentRow.cavityCount ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ getResourceStatusView('MOULD', currentRow).statusText }}</el-descriptions-item>
            <el-descriptions-item label="产品类型">{{ currentRow.productType || currentRow.produceType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="权属">{{ currentRow.ownerName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="位置">{{ currentRow.location || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="业务记录" name="records">
          <ResourceBizRecordTab
            ref="recordTabRef"
            :active="detailTab === 'records'"
            :resource-id="currentRow?.id"
            resource-type="MOULD"
          />
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <ResourceBizDialog
      v-model="bizDialogVisible"
      :action="currentBizAction"
      :resource="currentRow"
      resource-type="MOULD"
      @success="handleBizSuccess"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) { border: 1px solid #e4e7ed; }
.mould-actions { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.mould-pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
