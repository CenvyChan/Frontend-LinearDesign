<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';

import {
  getMaterialDocumentExportDownloadUrl,
  listMaterialDocumentExportTasks,
  type ExportTask,
} from '#/api/materialDocument';
import {
  deleteBomExportTask,
  downloadBomExportTask,
  listBomExportTasks,
  type BomExportTask,
} from '#/api/bom';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'MaterialDocumentExportTasks' });

const loading = ref(false);
const tasks = ref<ExportTask[]>([]);
const bomTasks = ref<BomExportTask[]>([]);
const bomTaskStatuses = new Map<number, string>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

async function loadTasks() {
  loading.value = true;
  try {
    const [materialResult, bomResult] = await Promise.all([
      listMaterialDocumentExportTasks(),
      listBomExportTasks(),
    ]);
    tasks.value = Array.isArray(materialResult) ? materialResult : ((materialResult as any)?.data ?? []);
    bomTasks.value = Array.isArray(bomResult) ? bomResult : ((bomResult as any)?.data ?? []);
    notifyCompletedBomTasks();
  } catch (error) {
    console.error(error);
    ElMessage.error('加载导出任务失败');
  } finally {
    loading.value = false;
    scheduleRefresh();
  }
}

function notifyCompletedBomTasks() {
  for (const task of bomTasks.value) {
    const previousStatus = bomTaskStatuses.get(task.id);
    if (previousStatus && previousStatus !== 'SUCCESS' && task.status === 'SUCCESS') {
      ElNotification.success({
        title: 'BOM 展开任务已完成',
        message: `任务 ${task.taskNo} 已生成 ${task.resultRowCount || 0} 行结果，请下载。`,
        duration: 6000,
      });
    }
    bomTaskStatuses.set(task.id, task.status);
  }
}

function scheduleRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
  if (bomTasks.value.some((task) => task.status === 'PENDING' || task.status === 'RUNNING')) {
    refreshTimer = setTimeout(loadTasks, 5000);
  }
}

function statusType(status: string) {
  switch (status) {
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'EXPIRED':
      return 'info';
    case 'RUNNING':
      return 'warning';
    default:
      return '';
  }
}

function statusText(status: string) {
  return {
    PENDING: '等待中',
    RUNNING: '生成中',
    SUCCESS: '已完成',
    FAILED: '失败',
    EXPIRED: '已过期',
  }[status] || status;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : '-';
}

function progressPercentage(task: BomExportTask) {
  if (!task.inputCount) {
    return task.status === 'SUCCESS' ? 100 : 0;
  }
  return Math.max(0, Math.min(100, Math.round((task.processedCount || 0) * 100 / task.inputCount)));
}

function progressStatus(task: BomExportTask) {
  if (task.status === 'SUCCESS') return 'success';
  if (task.status === 'FAILED' || task.status === 'EXPIRED') return 'exception';
  return undefined;
}

function downloadTask(task: ExportTask) {
  if (task.status !== 'SUCCESS') {
    ElMessage.warning('任务未完成，暂不可下载');
    return;
  }
  window.open(getMaterialDocumentExportDownloadUrl(task.id), '_blank');
}

async function downloadBomTask(task: BomExportTask) {
  if (task.status !== 'SUCCESS') {
    ElMessage.warning('任务尚未完成，暂不可下载');
    return;
  }
  try {
    const blob = await downloadBomExportTask(task.id);
    const filename = task.taskNo
      ? `BOM展开_${task.taskNo}.xlsx`
      : `BOM展开任务_${task.id}.xlsx`;
    downloadBlob(blob, filename);
  } catch (error) {
    console.error(error);
    ElMessage.error('下载 BOM 展开结果失败');
  }
}

function canDeleteBomTask(task: BomExportTask) {
  return task.status !== 'PENDING' && task.status !== 'RUNNING';
}

async function removeBomTask(task: BomExportTask) {
  if (!canDeleteBomTask(task)) {
    ElMessage.warning('任务处理中，暂不可删除');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认删除任务 ${task.taskNo || task.id}？删除后不可恢复。`,
      '删除 BOM 导出任务',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    const res: any = await deleteBomExportTask(task.id);
    if (res && res.success === false) {
      ElMessage.error(res.message || '删除失败');
      return;
    }
    bomTasks.value = bomTasks.value.filter((item) => item.id !== task.id);
    bomTaskStatuses.delete(task.id);
    ElMessage.success('已删除');
  } catch (error) {
    console.error(error);
    ElMessage.error('删除 BOM 导出任务失败');
  }
}

onMounted(loadTasks);
onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
});
</script>

<template>
  <div class="document-export-tasks">
    <div class="page-toolbar">
      <div>
        <h2>导出任务中心</h2>
        <p>查看 BOM 根节点资料包导出进度，已完成的 ZIP 文件保留 7 天。</p>
      </div>
      <el-button type="primary" :loading="loading" :icon="'Refresh'" @click="loadTasks">刷新</el-button>
    </div>

    <section class="export-section">
      <h3>BOM展开任务</h3>
      <el-table v-loading="loading" :data="bomTasks" border>
        <el-table-column prop="taskNo" label="任务编号" min-width="190" show-overflow-tooltip />
        <el-table-column prop="sourceFileName" label="源文件" min-width="160" show-overflow-tooltip />
        <el-table-column prop="inputCount" label="输入物料" width="100" align="right" />
        <el-table-column prop="processedCount" label="已处理" width="90" align="right" />
        <el-table-column label="进度" min-width="185">
          <template #default="{ row }">
            <el-progress
              :percentage="progressPercentage(row)"
              :status="progressStatus(row) as any"
              :stroke-width="10"
            />
            <span class="progress-count">{{ row.processedCount || 0 }}/{{ row.inputCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="resultRowCount" label="结果行数" width="100" align="right" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status) as any">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.finishTime) }}</template>
        </el-table-column>
        <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status !== 'SUCCESS'" :icon="'Download'" @click="downloadBomTask(row)">下载</el-button>
            <el-button link type="danger" :disabled="!canDeleteBomTask(row)" :icon="'Delete'" @click="removeBomTask(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="export-section">
      <h3>图文档导出任务</h3>
      <el-table v-loading="loading" :data="tasks" border>
      <el-table-column prop="taskNo" label="任务编号" min-width="190" show-overflow-tooltip />
      <el-table-column prop="rootMaterialCode" label="根物料编码" width="150" show-overflow-tooltip />
      <el-table-column prop="rootMaterialName" label="根物料名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="createdByName" label="创建人" width="110" />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column prop="fileCount" label="文件数" width="90" align="right" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status) as any">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="完成时间" width="170">
        <template #default="{ row }">{{ formatTime(row.finishTime) }}</template>
      </el-table-column>
      <el-table-column label="过期时间" width="170">
        <template #default="{ row }">{{ formatTime(row.expireTime) }}</template>
      </el-table-column>
      <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="110" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="row.status !== 'SUCCESS'" :icon="'Download'" @click="downloadTask(row)">下载</el-button>
        </template>
      </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.document-export-tasks {
  padding: 16px;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-toolbar h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 650;
}

.page-toolbar p {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.export-section + .export-section {
  margin-top: 24px;
}

.export-section h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.progress-count {
  display: block;
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: right;
}
</style>
