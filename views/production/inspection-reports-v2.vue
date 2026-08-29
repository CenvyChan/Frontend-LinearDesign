<script lang="ts" setup>
import type {
  InspectionEfficiencyReport,
  InspectionEfficiencyRow,
  InspectionQualityReport,
  InspectionQualityRow,
} from '#/api/inspectionReport';

import { computed, onMounted, ref } from 'vue';

import { ElMessage } from 'element-plus';

import {
  getInspectionEfficiencyReport,
  getInspectionQualityReport,
} from '#/api/inspectionReport';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import { buildInspectionReportsV2Model } from './inspection-reports-v2-model';

defineOptions({ name: 'InspectionReportsV2' });

const activeTab = ref('efficiency');
const loading = ref(false);
const efficiencyPage = ref(1);
const qualityPage = ref(1);
const pageSize = ref(20);
const efficiency = ref<InspectionEfficiencyReport>({});
const quality = ref<InspectionQualityReport>({});

const model = computed(() => buildInspectionReportsV2Model(efficiency.value, quality.value));
const metrics = computed(() => [
  { label: '任务总数', value: model.value.summary.totalTasks },
  { label: '已完成', tone: 'success', value: model.value.summary.completed },
  { label: '平均等待(分)', tone: 'warning', value: formatNumber(model.value.summary.avgWaitMinutes) },
  { label: '平均检验(分)', value: formatNumber(model.value.summary.avgInspectMinutes) },
  { label: '项目合格率', tone: model.value.summary.passRate >= 95 ? 'success' : 'warning', value: `${formatNumber(model.value.summary.passRate)}%` },
]);
const chains = computed(() => model.value.hotspots.map((item, index) => ({
  key: `${item.label}-${index}`,
  primary: item.label,
  secondary: `${item.count} 次异常`,
  status: '质量热点',
  tone: item.tone,
})));
const inspectorRows = computed(() => Object.entries(efficiency.value.byInspector || {})
  .map(([inspectorName, count]) => ({ count, inspectorName }))
  .sort((left, right) => Number(right.count) - Number(left.count)));
const efficiencyRows = computed<InspectionEfficiencyRow[]>(() => efficiency.value.rows || []);
const qualityRows = computed<InspectionQualityRow[]>(() => quality.value.rows || []);
const pagedEfficiencyRows = computed(() => paginateV2Rows(efficiencyRows.value, efficiencyPage.value, pageSize.value));
const pagedQualityRows = computed(() => paginateV2Rows(qualityRows.value, qualityPage.value, pageSize.value));

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
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
    const [efficiencyRes, qualityRes]: any[] = await Promise.all([
      getInspectionEfficiencyReport(),
      getInspectionQualityReport(),
    ]);
    if (!efficiencyRes.success) throw new Error(efficiencyRes.message || '获取检验效率报表失败');
    if (!qualityRes.success) throw new Error(qualityRes.message || '获取检验质量报表失败');
    efficiency.value = efficiencyRes.data || {};
    quality.value = qualityRes.data || {};
    efficiencyPage.value = 1;
    qualityPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取检验报表失败');
  } finally {
    loading.value = false;
  }
}

function handleEfficiencySizeChange(size: number) {
  pageSize.value = size;
  efficiencyPage.value = 1;
}

function handleQualitySizeChange(size: number) {
  pageSize.value = size;
  qualityPage.value = 1;
}

onMounted(loadData);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="质量热点"
    description="检验效率与合格率统计。等待时长和检验时长分开算，前者反映派工积压，后者反映执行速度。"
    eyebrow="质量 · 检验报表"
    issue-title="报表异常优先区"
    :chains="chains"
    :issues="model.issueGroups"
    :metrics="metrics"
    :stages="model.stages"
    title="检验报表"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
    </template>

    <section class="v2-panel" v-loading="loading">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="效率诊断" name="efficiency">
          <section class="report-grid">
            <div>
              <div class="section-title">检验员产出</div>
              <el-table :data="inspectorRows" border size="small" stripe>
                <el-table-column prop="inspectorName" label="检验员" min-width="120" />
                <el-table-column prop="count" label="任务数" width="100" align="right" />
              </el-table>
            </div>
            <div>
              <div class="section-title">任务效率明细</div>
              <el-table :data="pagedEfficiencyRows" border height="500" size="small" stripe>
                <el-table-column label="来源/工单" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="inline-info">
                      <strong>{{ row.sourceBillNo || row.orderNo || '-' }}</strong>
                      <span>{{ row.materialName || row.materialCode || '-' }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="inspectorName" label="检验员" width="110" />
                <el-table-column prop="waitMinutes" label="等待(分)" width="100" align="right" />
                <el-table-column prop="inspectMinutes" label="检验(分)" width="100" align="right" />
                <el-table-column label="完成时间" width="170">
                  <template #default="{ row }">{{ formatTime(row.completeTime) }}</template>
                </el-table-column>
              </el-table>
              <div class="pagination-row">
                <el-pagination
                  v-model:current-page="efficiencyPage"
                  :page-size="pageSize"
                  :page-sizes="[20, 50, 100]"
                  :total="efficiencyRows.length"
                  background
                  layout="total, sizes, prev, pager, next, jumper"
                  size="small"
                  @size-change="handleEfficiencySizeChange"
                />
              </div>
            </div>
          </section>
        </el-tab-pane>
        <el-tab-pane label="质量诊断" name="quality">
          <div class="section-title">项目质量明细</div>
          <el-table :data="pagedQualityRows" border height="500" size="small" stripe>
            <el-table-column label="项目" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="inline-info">
                  <strong>{{ row.itemName || '-' }}</strong>
                  <span>{{ row.itemCode || '-' }} / {{ row.valueType || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="标准" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.standardValue || '-' }} / {{ row.lowerLimit ?? '-' }} ~ {{ row.upperLimit ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column label="判定" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="judgementType(row.judgement)" size="small">{{ row.judgement || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="abnormalCount" label="异常数" width="100" align="right" />
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="qualityPage"
              :page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="qualityRows.length"
              background
              layout="total, sizes, prev, pager, next, jumper"
              size="small"
              @size-change="handleQualitySizeChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </V2DiagnosticsShell>
</template>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
}

.section-title {
  margin-bottom: 10px;
  color: #111827;
  font-weight: 700;
}

.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.inline-info span {
  color: #6b7280;
  font-size: 12px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

@media (max-width: 1100px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
