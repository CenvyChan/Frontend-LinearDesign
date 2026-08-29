<script lang="ts" setup>
import type { ProcessPool, ProcessPoolReferences } from '#/api/processPool';

import { computed, onMounted, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  disableProcessPool,
  enableProcessPool,
  getProcessPoolList,
  getProcessPoolReferences,
} from '#/api/processPool';
import { resolveStatus } from '#/shared/status/statusDictionary';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import { buildProcessPoolV2Model } from './process-pool-v2-model';

defineOptions({ name: 'ProcessPoolV2' });

const loading = ref(false);
const referenceLoading = ref(false);
const referenceVisible = ref(false);
const keyword = ref('');
const statusFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const rows = ref<ProcessPool[]>([]);
const references = ref<ProcessPoolReferences | null>(null);

const model = computed(() => buildProcessPoolV2Model(rows.value));
const metrics = computed(() => [
  { label: '工序总数', value: model.value.summary.total },
  { label: '启用工序', tone: 'success', value: model.value.summary.active },
  { label: '停用工序', tone: 'warning', value: model.value.summary.disabled },
  { label: '已绑定中心', tone: 'stable', value: model.value.summary.withWorkCenter },
  { label: '缺少标准', tone: 'danger', value: model.value.summary.missingStandard },
]);
const chains = computed(() => rows.value.slice(0, 8).map((row) => ({
  key: row.id || row.processCode,
  primary: row.processName || row.processCode,
  secondary: row.workCenterName || '未绑定工作中心',
  status: row.status || 'ACTIVE',
  tone: row.status === 'DISABLED' ? 'warning' : 'success',
})));

const pagedRows = computed(() => paginateV2Rows(rows.value, currentPage.value, pageSize.value));

function processPoolStatusText(status?: string) {
  return resolveStatus('processPool', 'status', status);
}

function formatDuration(row: ProcessPool) {
  const value = row.standardDuration ?? row.standardHours ?? 0;
  return `${value || 0} ${row.timeUnit || 'MINUTE'}`;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function loadData() {
  loading.value = true;
  try {
    const res: any = await getProcessPoolList({
      keyword: keyword.value || undefined,
      page: 1,
      pageSize: 500,
      status: statusFilter.value || undefined,
    });
    if (!res.success) throw new Error(res.message || '获取工序池失败');
    rows.value = res.data || [];
    currentPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取工序池失败');
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function toggleStatus(row: ProcessPool) {
  if (!row.id) return;
  const enable = row.status === 'DISABLED';
  try {
    await ElMessageBox.confirm(`确认${enable ? '启用' : '停用'}工序 ${row.processCode}？`, '工序状态确认', {
      type: 'warning',
    });
    const res: any = enable ? await enableProcessPool(row.id) : await disableProcessPool(row.id);
    if (!res.success) throw new Error(res.message || '操作失败');
    ElMessage.success(res.message || '操作成功');
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '操作失败');
  }
}

async function openReferences(row: ProcessPool) {
  if (!row.id) return;
  referenceVisible.value = true;
  referenceLoading.value = true;
  references.value = null;
  try {
    const res: any = await getProcessPoolReferences(row.id);
    if (!res.success) throw new Error(res.message || '获取引用情况失败');
    references.value = res.data || null;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取引用情况失败');
  } finally {
    referenceLoading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="工序与工作中心链路"
    description="工序主数据维护。未绑定工作中心或缺标准工时的工序会让排产和计件工资算不出来，这两项单列为风险。"
    eyebrow="生产 · 工序池"
    issue-title="工序配置风险"
    :chains="chains"
    :issues="model.issueGroups"
    :metrics="metrics"
    :stages="model.stages"
    title="工序池"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
    </template>

    <template #toolbar>
      <section class="v2-panel toolbar-row">
        <el-input v-model="keyword" clearable placeholder="工序代码/名称/工作中心" style="width: 280px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 130px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
        <el-button type="primary" @click="loadData" :icon="'Refresh'">查询</el-button>
      </section>
    </template>

    <section class="v2-panel v2-table-panel">
      <el-table :data="pagedRows" v-loading="loading" border height="520" size="small" stripe>
        <el-table-column prop="processCode" label="工序代码" width="130" />
        <el-table-column prop="processName" label="工序名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="processType" label="类型" width="110" />
        <el-table-column prop="workCenterName" label="工作中心" min-width="140" show-overflow-tooltip />
        <el-table-column label="标准工时" width="130">
          <template #default="{ row }">{{ formatDuration(row) }}</template>
        </el-table-column>
        <el-table-column prop="inspectionMethod" label="检验方式" width="120" show-overflow-tooltip />
        <el-table-column prop="reportMethod" label="报工方式" width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'DISABLED' ? 'info' : 'success'" size="small">
              {{ processPoolStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button size="small" link type="primary" @click="openReferences(row)" :icon="'View'">引用</el-button>
              <el-button
                size="small"
                link
                :type="row.status === 'DISABLED' ? 'success' : 'danger'"
                @click="toggleStatus(row)" :icon="'RefreshRight'">
                {{ row.status === 'DISABLED' ? '启用' : '停用' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="rows.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="referenceVisible" title="工序引用情况" width="860px">
      <div v-loading="referenceLoading">
        <section v-if="references" class="reference-metrics">
          <div><span>路线</span><strong>{{ references.routeCount }}</strong></div>
          <div><span>路线工序</span><strong>{{ references.stepCount }}</strong></div>
          <div><span>单价配置</span><strong>{{ references.priceCount }}</strong></div>
          <div><span>历史流转</span><strong>{{ references.flowCount }}</strong></div>
        </section>
        <el-table v-if="references" :data="references.routeSteps" border max-height="360" size="small" stripe>
          <el-table-column prop="routeCode" label="路线编码" width="130" />
          <el-table-column prop="routeName" label="路线名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column prop="materialCode" label="物料编码" width="130" />
          <el-table-column prop="stepNo" label="序号" width="70" />
          <el-table-column prop="stepName" label="路线工序" min-width="140" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </div>
    </el-dialog>
  </V2DiagnosticsShell>
</template>

<style scoped>
.toolbar-row,
.action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-cell {
  justify-content: center;
  flex-wrap: nowrap;
}

.action-cell :deep(.el-button),
.action-cell :deep(.el-button + .el-button) {
  margin-left: 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.reference-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.reference-metrics div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}
</style>
