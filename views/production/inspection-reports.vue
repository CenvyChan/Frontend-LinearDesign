<script lang="ts" setup>
import type {
  InspectionEfficiencyReport,
  InspectionEfficiencyRow,
  InspectionQualityReport,
  InspectionQualityRow,
} from '#/api/inspectionReport';

import { computed, onMounted, ref } from 'vue';

import { ElMessage } from 'element-plus';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  getInspectionEfficiencyReport,
  getInspectionQualityReport,
} from '#/api/inspectionReport';

defineOptions({ name: 'InspectionReports' });

const activeTab = ref('efficiency');
const loading = ref(false);
const efficiency = ref<InspectionEfficiencyReport>({});
const quality = ref<InspectionQualityReport>({});

const inspectorRows = computed(() => Object.entries(efficiency.value.byInspector || {})
  .map(([inspectorName, count]) => ({ count, inspectorName }))
  .sort((left, right) => right.count - left.count));

const failItemRows = computed(() => Object.entries(quality.value.failByItem || {})
  .map(([itemName, count]) => ({ count, itemName }))
  .sort((left, right) => right.count - left.count));

const efficiencyRows = computed<InspectionEfficiencyRow[]>(() => efficiency.value.rows || []);
const qualityRows = computed<InspectionQualityRow[]>(() => quality.value.rows || []);

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatInteger(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function inspectionTypeText(type?: string) {
  const map: Record<string, string> = {
    FQC: '产品检验',
    IQC: '来料检验',
    LQC: '产线巡检',
    OQC: '发货检验',
    PQC: '制程检验',
  };
  return map[type || ''] || type || '-';
}

function taskStatusText(status?: string) {
  return resolveStatus('inspection', 'taskStatus', status);
}

function judgementText(status?: string) {
  return resolveStatus('inspection', 'judgement', status);
}

function judgementType(status?: string) {
  const map: Record<string, string> = {
    FAIL: 'danger',
    NA: 'info',
    PASS: 'success',
    PENDING: 'warning',
  };
  return map[status || ''] || 'info';
}

async function loadData() {
  loading.value = true;
  try {
    const [efficiencyRes, qualityRes] = await Promise.all([
      getInspectionEfficiencyReport(),
      getInspectionQualityReport(),
    ]);
    if (!efficiencyRes.success) throw new Error(efficiencyRes.message || '获取检验效率报表失败');
    if (!qualityRes.success) throw new Error(qualityRes.message || '获取检验质量报表失败');
    efficiency.value = efficiencyRes.data || {};
    quality.value = qualityRes.data || {};
  } catch (error: any) {
    ElMessage.error(error.message || '获取检验报表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="inspection-report-page" v-loading="loading">
    <section class="toolbar-panel">
      <div class="toolbar-title">
        <strong>检验报表</strong>
        <span>基于统一检验任务、项目和样本记录统计</span>
      </div>
      <el-button type="primary" :icon="'Refresh'" @click="loadData">刷新</el-button>
    </section>

    <el-tabs v-model="activeTab" class="report-tabs">
      <el-tab-pane label="效率报表" name="efficiency">
        <section class="summary-row">
          <div class="summary-item"><span>任务总数</span><strong>{{ formatInteger(efficiency.total) }}</strong></div>
          <div class="summary-item"><span>已完成</span><strong>{{ formatInteger(efficiency.completed) }}</strong></div>
          <div class="summary-item"><span>超时待检</span><strong>{{ formatInteger(efficiency.overdue) }}</strong></div>
          <div class="summary-item"><span>平均待检(分)</span><strong>{{ formatNumber(efficiency.avgWaitMinutes) }}</strong></div>
          <div class="summary-item"><span>平均检验(分)</span><strong>{{ formatNumber(efficiency.avgInspectMinutes) }}</strong></div>
        </section>

        <section class="content-grid">
          <div class="table-panel">
            <div class="section-head"><strong>检验员产出</strong></div>
            <el-table :data="inspectorRows" border stripe size="small">
              <el-table-column prop="inspectorName" label="检验员" min-width="120" />
              <el-table-column prop="count" label="任务数" width="100" align="right" />
            </el-table>
          </div>

          <div class="table-panel">
            <div class="section-head"><strong>任务效率明细</strong></div>
            <el-table :data="efficiencyRows" border stripe size="small">
              <el-table-column label="类型" width="100">
                <template #default="{ row }">{{ inspectionTypeText(row.inspectionType) }}</template>
              </el-table-column>
              <el-table-column label="来源/工单" min-width="170" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="inline-info">
                    <strong>{{ row.sourceBillNo || row.orderNo || '-' }}</strong>
                    <span>{{ row.materialName || row.materialCode || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="inspectorName" label="检验员" width="110" />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">{{ taskStatusText(row.taskStatus) }}</template>
              </el-table-column>
              <el-table-column prop="waitMinutes" label="待检(分)" width="100" align="right" />
              <el-table-column prop="inspectMinutes" label="检验(分)" width="100" align="right" />
              <el-table-column label="完成时间" width="170">
                <template #default="{ row }">{{ formatTime(row.completeTime) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="质量报表" name="quality">
        <section class="summary-row">
          <div class="summary-item"><span>项目总数</span><strong>{{ formatInteger(quality.totalItems) }}</strong></div>
          <div class="summary-item"><span>异常项目</span><strong>{{ formatInteger(quality.failItems) }}</strong></div>
          <div class="summary-item"><span>项目合格率</span><strong>{{ formatNumber(quality.passRate) }}%</strong></div>
        </section>

        <section class="content-grid">
          <div class="table-panel">
            <div class="section-head"><strong>异常项目排行</strong></div>
            <el-table :data="failItemRows" border stripe size="small">
              <el-table-column prop="itemName" label="项目" min-width="160" />
              <el-table-column prop="count" label="异常次数" width="110" align="right" />
            </el-table>
          </div>

          <div class="table-panel">
            <div class="section-head"><strong>项目质量明细</strong></div>
            <el-table :data="qualityRows" border stripe size="small">
              <el-table-column label="项目" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="inline-info">
                    <strong>{{ row.itemName }}</strong>
                    <span>{{ row.itemCode }} / {{ row.valueType || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="标准" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.standardValue || '-' }} / {{ row.lowerLimit ?? '-' }} ~ {{ row.upperLimit ?? '-' }}
                </template>
              </el-table-column>
              <el-table-column label="判定" width="100" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="judgementType(row.judgement)">{{ judgementText(row.judgement) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="abnormalCount" label="异常数" width="90" align="right" />
            </el-table>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.inspection-report-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.toolbar-panel,
.summary-item,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px;
}

.toolbar-title,
.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.toolbar-title span,
.inline-info span,
.summary-item span {
  color: #606266;
  font-size: 13px;
}

.report-tabs {
  padding: 0;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.summary-item strong {
  color: #1f2937;
  font-size: 22px;
}

.content-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
}

.table-panel {
  min-width: 0;
  padding: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

@media (max-width: 1100px) {
  .summary-row,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
