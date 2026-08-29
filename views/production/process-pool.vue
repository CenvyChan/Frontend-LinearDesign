<script lang="ts" setup>
import type { ProcessPool, ProcessPoolReferences } from '#/api/processPool';
import type { WorkCenter } from '#/api/workCenter';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  createProcessPool,
  disableProcessPool,
  enableProcessPool,
  exportProcessPool,
  getProcessPoolList,
  getProcessPoolReferences,
  updateProcessPool,
} from '#/api/processPool';
import { resolveStatus } from '#/shared/status/statusDictionary';
import { getWorkCenterList } from '#/api/workCenter';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'ProcessPool' });

const loading = ref(false);
const referenceLoading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const referenceDialogVisible = ref(false);
const keyword = ref('');
const statusFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const tableData = ref<ProcessPool[]>([]);
const workCenters = ref<WorkCenter[]>([]);
const references = ref<ProcessPoolReferences | null>(null);

const form = reactive<Partial<ProcessPool>>({
  completeQuantity: 1,
  processCode: '',
  processName: '',
  setupTime: 0,
  setupTimeUnit: 'MINUTE',
  standardHours: 0,
  status: 'ACTIVE',
  timeUnit: 'MINUTE',
});

const summary = computed(() => {
  const active = tableData.value.filter(item => item.status === 'ACTIVE').length;
  return { active, total: total.value };
});

function resetForm(row?: ProcessPool) {
  Object.assign(form, {
    completeQuantity: row?.completeQuantity ?? 1,
    defectTypes: row?.defectTypes ?? '',
    id: row?.id,
    inspectionMethod: row?.inspectionMethod ?? '',
    processCode: row?.processCode ?? '',
    processName: row?.processName ?? '',
    processType: row?.processType ?? '',
    remark: row?.remark ?? '',
    reportMethod: row?.reportMethod ?? '',
    reportOrder: row?.reportOrder ?? '',
    setupDuration: row?.setupDuration,
    setupTime: row?.setupTime ?? 0,
    setupTimeUnit: row?.setupTimeUnit ?? 'MINUTE',
    sopFilePath: row?.sopFilePath ?? '',
    standardDuration: row?.standardDuration,
    standardHours: row?.standardHours ?? 0,
    status: row?.status ?? 'ACTIVE',
    timeUnit: row?.timeUnit ?? 'MINUTE',
    workCenterId: row?.workCenterId,
    workCenterName: row?.workCenterName ?? '',
  });
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: ProcessPool) {
  resetForm(row);
  dialogVisible.value = true;
}

function onWorkCenterChange(id?: number) {
  const workCenter = workCenters.value.find(item => item.id === id);
  form.workCenterName = workCenter?.name ?? '';
}

function formatTime(value?: number) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function loadWorkCenters() {
  const res = await getWorkCenterList();
  if (res?.success) {
    workCenters.value = res.data || [];
  }
}

async function loadData() {
  loading.value = true;
  try {
    const res = await getProcessPoolList({
      keyword: keyword.value || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = res.total || 0;
    } else {
      ElMessage.error(res.message || '查询工序池失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('查询工序池失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadData();
}

async function handleSave() {
  if (!form.processCode || !form.processName) {
    ElMessage.warning('请填写工序代码和工序名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form };
    const res = form.id
      ? await updateProcessPool(form.id, payload)
      : await createProcessPool(payload);
    if (res.success) {
      ElMessage.success(res.message || '保存成功');
      dialogVisible.value = false;
      await loadData();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: ProcessPool) {
  if (!row.id) return;
  const nextActive = row.status !== 'ACTIVE';
  try {
    await ElMessageBox.confirm(
      `确定${nextActive ? '启用' : '停用'}工序 [${row.processCode}] 吗？`,
      '状态确认',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  const res = nextActive ? await enableProcessPool(row.id) : await disableProcessPool(row.id);
  if (res.success) {
    ElMessage.success(res.message || '操作成功');
    await loadData();
  } else {
    ElMessage.error(res.message || '操作失败');
  }
}

async function handleExport() {
  try {
    const blob = await exportProcessPool({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
    });
    downloadBlob(blob, '工序池导出.xlsx');
  } catch (error) {
    console.error(error);
    ElMessage.error('导出失败');
  }
}

async function openReferences(row: ProcessPool) {
  if (!row.id) return;
  referenceDialogVisible.value = true;
  referenceLoading.value = true;
  references.value = null;
  try {
    const res = await getProcessPoolReferences(row.id);
    if (res.success) {
      references.value = res.data;
    } else {
      ElMessage.error(res.message || '查询引用情况失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('查询引用情况失败');
  } finally {
    referenceLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadWorkCenters(), loadData()]);
});
</script>

<template>
  <div class="process-pool-page">
    <div class="summary-row">
      <div class="summary-item">
        <span>启用工序</span>
        <strong>{{ summary.active }}</strong>
      </div>
      <div class="summary-item">
        <span>工序总数</span>
        <strong>{{ summary.total }}</strong>
      </div>
    </div>

    <div class="toolbar-panel">
      <div class="toolbar-left">
        <el-input v-model="keyword" clearable placeholder="搜索工序代码、名称、工作中心" style="width: 280px" @keyup.enter="handleSearch" />
        <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 130px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
        <el-button @click="handleSearch" :icon="'Search'">搜索</el-button>
      </div>
      <div class="toolbar-right">
        <el-button :icon="'Refresh'" @click="loadData">刷新</el-button>
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openCreate">新增工序</el-button>
      </div>
    </div>

    <div class="table-panel">
      <el-table :data="tableData" v-loading="loading" border size="small" stripe>
        <el-table-column prop="processCode" label="工序代码" width="130" />
        <el-table-column prop="processName" label="工序名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="processType" label="类型" width="100" />
        <el-table-column prop="workCenterName" label="工作中心" min-width="140" show-overflow-tooltip />
        <el-table-column label="默认标准" width="130">
          <template #default="{ row }">
            {{ row.standardDuration ?? row.standardHours ?? 0 }} {{ row.timeUnit || 'MINUTE' }}
          </template>
        </el-table-column>
        <el-table-column label="默认准备" width="130">
          <template #default="{ row }">
            {{ row.setupDuration ?? row.setupTime ?? 0 }} {{ row.setupTimeUnit || 'MINUTE' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
              {{ resolveStatus('processPool', 'status', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right" align="center">
          <template #default="{ row }">
            <div class="pool-action-cell">
              <el-button size="small" text type="primary" @click="openEdit(row)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" text type="primary" @click="openReferences(row)" :icon="'View'">引用</el-button>
              <el-button size="small" text :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStatus(row)" :icon="'RefreshRight'">
                {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-area">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑工序' : '新增工序'" width="760px" destroy-on-close>
      <el-form :model="form" label-width="110px" size="small">
        <div class="form-grid">
          <el-form-item label="工序代码" required>
            <el-input v-model="form.processCode" />
          </el-form-item>
          <el-form-item label="工序名称" required>
            <el-input v-model="form.processName" />
          </el-form-item>
          <el-form-item label="工序类型">
            <el-input v-model="form.processType" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="工作中心">
            <el-select v-model="form.workCenterId" clearable filterable style="width: 100%" @change="onWorkCenterChange">
              <el-option v-for="item in workCenters" :key="item.id" :label="`${item.code} ${item.name}`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="工作中心名">
            <el-input v-model="form.workCenterName" />
          </el-form-item>
          <el-form-item label="默认标准单位">
            <el-select v-model="form.timeUnit" style="width: 100%">
              <el-option label="秒" value="SECOND" />
              <el-option label="分钟" value="MINUTE" />
              <el-option label="小时" value="HOUR" />
            </el-select>
          </el-form-item>
          <el-form-item label="默认标准时长">
            <el-input-number v-model="form.standardDuration" :min="0" :precision="2" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="产出数量">
            <el-input-number v-model="form.completeQuantity" :min="1" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="默认准备单位">
            <el-select v-model="form.setupTimeUnit" style="width: 100%">
              <el-option label="秒" value="SECOND" />
              <el-option label="分钟" value="MINUTE" />
              <el-option label="小时" value="HOUR" />
            </el-select>
          </el-form-item>
          <el-form-item label="默认准备时长">
            <el-input-number v-model="form.setupDuration" :min="0" :precision="2" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="检验方式">
            <el-input v-model="form.inspectionMethod" />
          </el-form-item>
          <el-form-item label="汇报方式">
            <el-input v-model="form.reportMethod" />
          </el-form-item>
          <el-form-item label="汇报控制">
            <el-input v-model="form.reportOrder" />
          </el-form-item>
          <el-form-item label="SOP路径">
            <el-input v-model="form.sopFilePath" />
          </el-form-item>
        </div>
        <el-form-item label="缺陷类型">
          <el-input v-model="form.defectTypes" placeholder="多个类型用英文逗号分隔" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="referenceDialogVisible" title="工序引用情况" width="860px" destroy-on-close>
      <div v-loading="referenceLoading">
        <div v-if="references" class="reference-summary">
          <div class="reference-card">
            <span>引用路线</span>
            <strong>{{ references.routeCount }}</strong>
          </div>
          <div class="reference-card">
            <span>路线工序</span>
            <strong>{{ references.stepCount }}</strong>
          </div>
          <div class="reference-card">
            <span>单价配置</span>
            <strong>{{ references.priceCount }}</strong>
          </div>
          <div class="reference-card">
            <span>历史流转</span>
            <strong>{{ references.flowCount }}</strong>
          </div>
        </div>
        <el-table v-if="references" :data="references.routeSteps" border max-height="360" size="small" stripe>
          <el-table-column prop="routeCode" label="路线编码" width="130" />
          <el-table-column prop="routeName" label="路线名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column prop="materialCode" label="物料编码" width="130" />
          <el-table-column prop="materialName" label="物料名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="stepNo" label="序号" width="70" align="center" />
          <el-table-column prop="stepName" label="路线工序" min-width="140" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="90" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="referenceDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.process-pool-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item,
.toolbar-panel,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.summary-item span {
  color: #606266;
  font-size: 13px;
}

.summary-item strong {
  color: #1f2937;
  font-size: 22px;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
}

.toolbar-left,
.toolbar-right,
.pool-action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pool-action-cell {
  justify-content: center;
  white-space: nowrap;
}

.pool-action-cell :deep(.el-button),
.pool-action-cell :deep(.el-button + .el-button) {
  margin-left: 0;
}

.table-panel {
  padding: 12px;
}

.reference-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.reference-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f8fafc;
}

.reference-card span {
  color: #606266;
  font-size: 13px;
}

.reference-card strong {
  color: #1f2937;
  font-size: 20px;
}

.pagination-area {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}

@media (max-width: 900px) {
  .summary-row,
  .reference-summary,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    flex-wrap: wrap;
  }
}
</style>
