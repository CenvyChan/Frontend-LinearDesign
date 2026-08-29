<script lang="ts" setup>
import type { MasterDataGroup, MasterDataItem } from './master-data-import-export-model';

import { computed, ref } from 'vue';

import { ElMessage } from 'element-plus';

import {
  confirmExcelImport,
  downloadExcelTemplate,
  exportExcel,
  previewExcelImport,
} from '#/api/excel';
import {
  exportOpeningReferenceReport,
  getOpeningReferenceStatus,
  refreshOpeningReferences,
  testOpeningReferenceConnection,
  type OpeningReferenceActionResult,
  type OpeningReferenceStatus,
} from '#/api/opening';
import ExcelImportDialog from '#/components/excel/ExcelImportDialog.vue';
import { downloadBlob } from '#/utils/download';

import {
  buildMasterDataGroups,
  countMasterDataItems,
} from './master-data-import-export-model';

defineOptions({ name: 'MasterDataImportExport' });

const groups = buildMasterDataGroups();
const activeGroupKey = ref(groups[0]?.key || 'factory');
const importDialogVisible = ref(false);
const activeImportItem = ref<MasterDataItem | null>(null);
const actionLoading = ref('');
const openingReferenceStatus = ref<OpeningReferenceStatus | null>(null);

const activeGroup = computed<MasterDataGroup | undefined>(() => {
  return groups.find((group) => group.key === activeGroupKey.value);
});

const activeItems = computed(() => activeGroup.value?.items || []);
const totalCount = countMasterDataItems(groups);

function loadingKey(item: MasterDataItem, action: string) {
  return `${item.key}:${action}`;
}

function isReferenceCheckItem(item: MasterDataItem) {
  return item.mode === 'reference-check';
}

function isExportOnlyItem(item: MasterDataItem) {
  return item.mode === 'export-only';
}

async function handleDownloadTemplate(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'template');
  try {
    const blob = await downloadExcelTemplate(item.basePath);
    downloadBlob(blob, `${item.filename}导入模板.xlsx`);
  } catch (error) {
    console.error(error);
    ElMessage.error(`${item.label}模板下载失败`);
  } finally {
    actionLoading.value = '';
  }
}

async function handleExport(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'export');
  try {
    const blob = await exportExcel(item.basePath);
    downloadBlob(blob, `${item.filename}导出.xlsx`);
  } catch (error) {
    console.error(error);
    ElMessage.error(`${item.label}导出失败`);
  } finally {
    actionLoading.value = '';
  }
}

function openImportDialog(item: MasterDataItem) {
  if (isReferenceCheckItem(item) || isExportOnlyItem(item)) {
    return;
  }
  activeImportItem.value = item;
  importDialogVisible.value = true;
}

async function handleReferenceStatus(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'status');
  try {
    const res = await getOpeningReferenceStatus();
    if (!res.success) {
      throw new Error(res.message || 'ERP缓存状态获取失败');
    }
    openingReferenceStatus.value = res.data || null;
    ElMessage.success(res.message || 'ERP缓存状态已刷新');
  } catch (error) {
    console.error(error);
    ElMessage.error(error instanceof Error ? error.message : 'ERP缓存状态获取失败');
  } finally {
    actionLoading.value = '';
  }
}

async function handleReferenceConnection(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'test');
  try {
    const res = await testOpeningReferenceConnection();
    const data: OpeningReferenceActionResult = res.data || {};
    if (!res.success || data.success === false) {
      throw new Error(String(data.message || res.message || 'ERP连接测试失败'));
    }
    ElMessage.success(String(data.message || res.message || 'ERP连接正常'));
  } catch (error) {
    console.error(error);
    ElMessage.error(error instanceof Error ? error.message : 'ERP连接测试失败');
  } finally {
    actionLoading.value = '';
  }
}

async function handleReferenceRefresh(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'refresh');
  try {
    const res = await refreshOpeningReferences();
    const data: OpeningReferenceActionResult = res.data || {};
    if (!res.success || data.success === false) {
      throw new Error(String(data.message || res.message || 'ERP缓存刷新失败'));
    }
    if (data.status) {
      openingReferenceStatus.value = data.status;
    }
    ElMessage.success(String(data.message || res.message || 'ERP缓存已刷新'));
  } catch (error) {
    console.error(error);
    ElMessage.error(error instanceof Error ? error.message : 'ERP缓存刷新失败');
  } finally {
    actionLoading.value = '';
  }
}

async function handleReferenceExport(item: MasterDataItem) {
  actionLoading.value = loadingKey(item, 'report');
  try {
    const blob = await exportOpeningReferenceReport();
    downloadBlob(blob, `${item.filename}.xlsx`);
  } catch (error) {
    console.error(error);
    ElMessage.error('ERP引用校验报告导出失败');
  } finally {
    actionLoading.value = '';
  }
}

function previewImport(file: File) {
  if (!activeImportItem.value) {
    return Promise.resolve({ success: false, message: '请选择主数据类型' });
  }
  return previewExcelImport(activeImportItem.value.basePath, file);
}

function confirmImport(batchId: string) {
  if (!activeImportItem.value) {
    return Promise.resolve({ success: false, message: '请选择主数据类型' });
  }
  return confirmExcelImport(activeImportItem.value.basePath, batchId);
}
</script>

<template>
  <div class="master-data-page">
    <div class="master-data-page__header">
      <div>
        <h1>基础资料导入导出</h1>
        <p>系统主数据统一入口</p>
      </div>
      <div class="master-data-page__summary">
        <span>已接入</span>
        <strong>{{ totalCount }}</strong>
      </div>
    </div>

    <el-tabs v-model="activeGroupKey" class="master-data-page__tabs">
      <el-tab-pane
        v-for="group in groups"
        :key="group.key"
        :label="group.label"
        :name="group.key"
      />
    </el-tabs>

    <section class="master-data-page__section">
      <div class="master-data-page__section-head">
        <div>
          <h2>{{ activeGroup?.label }}</h2>
          <p>{{ activeGroup?.description }}</p>
        </div>
      </div>

      <div v-if="openingReferenceStatus" class="master-data-reference-status">
        <span>ERP：{{ openingReferenceStatus.enabled ? '已启用' : '未启用' }}</span>
        <span>组织 {{ openingReferenceStatus.organizations ?? 0 }}</span>
        <span>仓库 {{ openingReferenceStatus.warehouses ?? 0 }}</span>
        <span>车间 {{ openingReferenceStatus.workshops ?? 0 }}</span>
      </div>

      <el-table :data="activeItems" border stripe>
        <el-table-column label="资料类型" min-width="180">
          <template #default="{ row }">
            <div class="master-data-item">
              <el-tag :type="row.tone" effect="light">{{ row.label }}</el-tag>
              <span>{{ row.description }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="导入安全边界" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'master-data-warning': row.warning }">
              {{ row.warning || '按模板列预览校验，确认后写入。' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="420" fixed="right" align="center">
          <template #default="{ row }">
            <div v-if="isReferenceCheckItem(row)" class="master-data-actions master-data-actions--reference">
              <el-button
                v-if="!isExportOnlyItem(row)"
                size="small"
                :loading="actionLoading === loadingKey(row, 'status')"
                @click="handleReferenceStatus(row)"
              >
                状态
              </el-button>
              <el-button
                size="small"
                :loading="actionLoading === loadingKey(row, 'test')"
                @click="handleReferenceConnection(row)"
              >
                测试连接
              </el-button>
              <el-button
                size="small"
                type="warning"
                :loading="actionLoading === loadingKey(row, 'refresh')"
                @click="handleReferenceRefresh(row)"
              >
                刷新缓存
              </el-button>
              <el-button
                size="small"
                type="primary"
                :loading="actionLoading === loadingKey(row, 'report')"
                @click="handleReferenceExport(row)"
              >
                导出报告
              </el-button>
            </div>
            <div v-else class="master-data-actions">
              <el-button
                size="small"
                :icon="'Download'"
                :loading="actionLoading === loadingKey(row, 'template')"
                @click="handleDownloadTemplate(row)"
              >
                模板
              </el-button>
              <el-button v-if="!isExportOnlyItem(row)" size="small" :icon="'Upload'" @click="openImportDialog(row)">
                导入
              </el-button>
              <el-button
                size="small"
                type="primary"
                :icon="'Download'"
                :loading="actionLoading === loadingKey(row, 'export')"
                @click="handleExport(row)"
              >
                导出
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <ExcelImportDialog
      v-if="activeImportItem"
      v-model="importDialogVisible"
      :title="`导入${activeImportItem.label}`"
      :preview-import="previewImport"
      :confirm-import="confirmImport"
    />
  </div>
</template>

<style scoped>
.master-data-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.master-data-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.master-data-page__header h1,
.master-data-page__section-head h2 {
  margin: 0;
  color: #111827;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: 0;
}

.master-data-page__header p,
.master-data-page__section-head p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.master-data-page__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 96px;
  justify-content: flex-end;
  color: #606266;
}

.master-data-page__summary strong {
  color: #111827;
  font-size: 24px;
}

.master-data-page__tabs {
  min-height: 42px;
}

.master-data-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.master-data-page__section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.master-data-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.master-data-item span:last-child {
  overflow: hidden;
  color: #374151;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.master-data-warning {
  color: #b45309;
}

.master-data-reference-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #374151;
  font-size: 13px;
}

.master-data-reference-status span {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
}

.master-data-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 8px;
}

.master-data-actions--reference {
  min-width: 280px;
}

@media (max-width: 760px) {
  .master-data-page {
    padding: 12px;
  }

  .master-data-page__header,
  .master-data-page__section-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .master-data-page__summary {
    justify-content: flex-start;
  }
}
</style>
