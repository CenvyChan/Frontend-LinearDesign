<script lang="ts" setup>
import type { ApiResult, ImportPreviewResult, ImportPreviewRow } from '#/api/excel';

import { computed, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

const props = defineProps<{
  confirmImport: (batchId: string) => Promise<ApiResult<{ count: number }>>;
  modelValue: boolean;
  previewImport: (file: File) => Promise<ApiResult<ImportPreviewResult>>;
  title: string;
}>();

const emit = defineEmits<{
  success: [];
  'update:modelValue': [value: boolean];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const loading = ref(false);
const preview = ref<ImportPreviewResult | null>(null);

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

const canConfirm = computed(() => {
  return !!preview.value && preview.value.totalRows > 0 && preview.value.errorRows === 0;
});

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      fileName.value = '';
      preview.value = null;
    }
  },
);

function triggerFileSelect() {
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  loading.value = true;
  try {
    const res = await props.previewImport(file);
    if (res.success && res.data) {
      preview.value = res.data;
      ElMessage.success('预览完成');
    } else {
      preview.value = null;
      ElMessage.error(res.message || '预览失败');
    }
  } catch (error) {
    console.error(error);
    preview.value = null;
    ElMessage.error('预览失败');
  } finally {
    loading.value = false;
    input.value = '';
  }
}

async function handleConfirm() {
  if (!preview.value?.batchId) return;
  loading.value = true;
  try {
    const res = await props.confirmImport(preview.value.batchId);
    if (res.success) {
      ElMessage.success(res.message || `导入成功：${res.data?.count ?? 0} 条`);
      visible.value = false;
      emit('success');
    } else {
      ElMessage.error(res.message || '导入失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('导入失败');
  } finally {
    loading.value = false;
  }
}

function formatErrors(row: ImportPreviewRow) {
  if (!row.errors?.length) return '-';
  return row.errors.map(error => `${error.columnName}: ${error.message}`).join('；');
}

function rawSummary(row: ImportPreviewRow) {
  const entries = Object.entries(row.rawData || {})
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim() !== '')
    .slice(0, 6);
  if (entries.length === 0) return '-';
  return entries.map(([key, value]) => `${key}: ${value}`).join('；');
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="920px" destroy-on-close>
    <div v-loading="loading" class="excel-import">
      <div class="excel-import__toolbar">
        <input
          ref="fileInputRef"
          accept=".xlsx"
          class="excel-import__file"
          type="file"
          @change="handleFileChange"
        />
        <el-button type="primary" :icon="'Upload'" @click="triggerFileSelect">选择文件</el-button>
        <span class="excel-import__filename">{{ fileName || '未选择文件' }}</span>
      </div>

      <div v-if="preview" class="excel-import__summary">
        <div class="excel-import__stat">
          <span>总行数</span>
          <strong>{{ preview.totalRows }}</strong>
        </div>
        <div class="excel-import__stat">
          <span>有效行</span>
          <strong>{{ preview.validRows }}</strong>
        </div>
        <div class="excel-import__stat">
          <span>错误行</span>
          <strong>{{ preview.errorRows }}</strong>
        </div>
      </div>

      <el-table v-if="preview" :data="preview.rows" border max-height="380" size="small" stripe>
        <el-table-column prop="rowIndex" label="行号" width="80" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.valid ? 'success' : 'danger'" size="small">
              {{ row.valid ? '有效' : '错误' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="原始数据" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ rawSummary(row) }}</template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ formatErrors(row) }}</template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="请选择 .xlsx 文件进行导入预览" />
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :disabled="!canConfirm" :loading="loading" @click="handleConfirm" :icon="'Upload'">
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.excel-import {
  min-height: 260px;
}

.excel-import__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.excel-import__file {
  display: none;
}

.excel-import__filename {
  color: #606266;
  font-size: 13px;
}

.excel-import__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.excel-import__stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f8fafc;
}

.excel-import__stat span {
  color: #606266;
  font-size: 13px;
}

.excel-import__stat strong {
  color: #1f2937;
  font-size: 20px;
}

@media (max-width: 760px) {
  .excel-import__summary {
    grid-template-columns: 1fr;
  }

  .excel-import__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
