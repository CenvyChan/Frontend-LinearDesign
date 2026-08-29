<script lang="ts" setup>
import type { ProcessTimeReportRow, ProcessTimeReportSummary } from '#/api/processTimeReport';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { queryProcessTimeReport } from '#/api/processTimeReport';

defineOptions({ name: 'ProcessTimeReport' });

const loading = ref(false);
const rows = ref<ProcessTimeReportRow[]>([]);
const summary = ref<ProcessTimeReportSummary>({
  abnormalCount: 0,
  normalCount: 0,
  totalCount: 0,
  totalQuantity: 0,
});

const queryForm = reactive({
  operatorName: '',
  orderNo: '',
  processKeyword: '',
  timeRange: [] as number[],
});

const abnormalRate = computed(() => {
  if (!summary.value.totalCount) return '0.00%';
  return `${((summary.value.abnormalCount / summary.value.totalCount) * 100).toFixed(2)}%`;
});

function formatNumber(value?: number, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatInteger(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatPercent(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return `${formatNumber(value, 2)}%`;
}

function formatTime(value?: number) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatDuration(seconds?: number, fallbackMinutes?: number) {
  const totalSeconds = seconds && seconds > 0
    ? Math.round(seconds)
    : Math.round(Number(fallbackMinutes || 0) * 60);
  if (totalSeconds <= 0) return '--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const restSeconds = totalSeconds % 60;
  return `${hours}时${minutes}分${restSeconds}秒`;
}

function unitText(unit?: string) {
  const map: Record<string, string> = {
    HOUR: '小时',
    MINUTE: '分钟',
    SECOND: '秒',
  };
  return unit ? map[unit] || unit : '分钟';
}

function anomalyTagType(level?: string) {
  const map: Record<string, string> = {
    MAJOR: 'warning',
    MINOR: 'info',
    NO_ACTUAL_TIME: 'danger',
    NO_QUANTITY: 'danger',
    NO_STANDARD: 'danger',
    NORMAL: 'success',
    SEVERE: 'danger',
  };
  return map[level || ''] || 'info';
}

async function loadData() {
  loading.value = true;
  try {
    const [startTime, endTime] = queryForm.timeRange || [];
    const res = await queryProcessTimeReport({
      endTime,
      operatorName: queryForm.operatorName || undefined,
      orderNo: queryForm.orderNo || undefined,
      processKeyword: queryForm.processKeyword || undefined,
      startTime,
    });
    rows.value = res?.rows || [];
    summary.value = res?.summary || {
      abnormalCount: 0,
      normalCount: 0,
      totalCount: 0,
      totalQuantity: 0,
    };
  } catch (error) {
    console.error(error);
    ElMessage.error('获取工时节拍报表失败');
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  queryForm.operatorName = '';
  queryForm.orderNo = '';
  queryForm.processKeyword = '';
  queryForm.timeRange = [];
  loadData();
}

onMounted(loadData);
</script>

<template>
  <div class="process-time-report-page">
    <section class="hero-panel">
      <div>
        <p class="eyebrow">PROCESS TAKT REPORT</p>
        <h2>工序工时节拍报表</h2>
        <p class="hero-desc">
          按员工报工填写的实际工时与完成数量，核对工艺标准工时和标准产出，暂不使用开始/完成时刻与准备工时。
        </p>
      </div>
      <div class="hero-metric">
        <span>异常占比</span>
        <strong>{{ abnormalRate }}</strong>
      </div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span>报工记录</span>
        <strong>{{ formatInteger(summary.totalCount) }}</strong>
      </div>
      <div class="summary-card">
        <span>完成数量</span>
        <strong>{{ formatInteger(summary.totalQuantity) }}</strong>
      </div>
      <div class="summary-card">
        <span>标准工时(分)</span>
        <strong>{{ formatNumber(summary.totalStandardMinutes) }}</strong>
      </div>
      <div class="summary-card">
        <span>实际工时(分)</span>
        <strong>{{ formatNumber(summary.totalActualMinutes) }}</strong>
      </div>
      <div class="summary-card">
        <span>偏差工时(分)</span>
        <strong :class="Number(summary.totalVarianceMinutes || 0) > 0 ? 'danger-text' : 'success-text'">
          {{ formatNumber(summary.totalVarianceMinutes) }}
        </strong>
      </div>
      <div class="summary-card">
        <span>总体效率</span>
        <strong>{{ formatPercent(summary.overallEfficiencyRate) }}</strong>
      </div>
    </section>

    <section class="query-panel">
      <el-form :model="queryForm" class="query-form" inline>
        <el-form-item label="完成时间">
          <el-date-picker
            v-model="queryForm.timeRange"
            end-placeholder="结束时间"
            range-separator="至"
            start-placeholder="开始时间"
            type="datetimerange"
            value-format="x"
          />
        </el-form-item>
        <el-form-item label="工单号">
          <el-input v-model="queryForm.orderNo" clearable placeholder="输入工单号" />
        </el-form-item>
        <el-form-item label="员工">
          <el-input v-model="queryForm.operatorName" clearable placeholder="输入员工姓名" />
        </el-form-item>
        <el-form-item label="工序">
          <el-input v-model="queryForm.processKeyword" clearable placeholder="名称/编码" />
        </el-form-item>
        <el-form-item>
          <div class="query-actions">
            <el-button type="primary" @click="loadData" :icon="'Refresh'">查询</el-button>
            <el-button @click="resetQuery" :icon="'RefreshRight'">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <el-table :data="rows" v-loading="loading" border stripe size="small">
        <el-table-column label="工单/产品" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.orderNo || '-' }}</strong>
              <span>{{ row.productName || row.productCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工序" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <strong>{{ row.stepNo }}. {{ row.stepName || '-' }}</strong>
              <span>{{ row.processCode || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="operatorName" label="员工" width="110" />
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.actualEndTime) }}</template>
        </el-table-column>
        <el-table-column prop="actualQuantity" label="完成数" width="90" align="right" />
        <el-table-column prop="defectQuantity" label="不良数" width="90" align="right" />
        <el-table-column label="标准配置" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="inline-info">
              <span>{{ formatNumber(row.standardDuration ?? row.standardHours, 4) }} {{ unitText(row.timeUnit) }}</span>
              <span>产出 {{ row.standardQuantity || 1 }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="标准总工时(分)" width="130" align="right">
          <template #default="{ row }">{{ formatNumber(row.standardMinutes) }}</template>
        </el-table-column>
        <el-table-column label="实际工时" width="150" align="right">
          <template #default="{ row }">{{ formatDuration(row.actualWorkSeconds, row.actualMinutes) }}</template>
        </el-table-column>
        <el-table-column label="工时偏差(分)" width="120" align="right">
          <template #default="{ row }">
            <span :class="Number(row.varianceMinutes || 0) > 0 ? 'danger-text' : 'success-text'">
              {{ formatNumber(row.varianceMinutes) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="标准节拍" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.standardTaktMinutes, 4) }}</template>
        </el-table-column>
        <el-table-column label="实际节拍" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.actualTaktMinutes, 4) }}</template>
        </el-table-column>
        <el-table-column label="节拍偏差率" width="120" align="right">
          <template #default="{ row }">{{ formatPercent(row.taktVarianceRate) }}</template>
        </el-table-column>
        <el-table-column label="效率" width="100" align="right">
          <template #default="{ row }">{{ formatPercent(row.efficiencyRate) }}</template>
        </el-table-column>
        <el-table-column label="异常" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <el-tag :type="anomalyTagType(row.anomalyLevel)" size="small">
              {{ row.anomalyText }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.process-time-report-page {
  min-height: 100%;
  padding: 16px;
  background:
    radial-gradient(circle at 12% 8%, rgb(46 125 98 / 14%), transparent 26%),
    linear-gradient(135deg, #f4f0e8 0%, #eef4ef 48%, #f8fafc 100%);
}

.hero-panel,
.query-panel,
.table-panel,
.summary-card {
  border: 1px solid rgb(28 45 36 / 10%);
  border-radius: 14px;
  background: rgb(255 255 255 / 86%);
  box-shadow: 0 14px 35px rgb(37 48 42 / 8%);
}

.hero-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
  padding: 22px 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2e7d62;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.hero-panel h2 {
  margin: 0;
  color: #18231d;
  font-size: 26px;
  font-weight: 800;
}

.hero-desc {
  max-width: 720px;
  margin: 8px 0 0;
  color: #5d6b62;
  font-size: 14px;
}

.hero-metric {
  display: flex;
  min-width: 150px;
  flex-direction: column;
  align-items: flex-end;
  color: #5d6b62;
}

.hero-metric strong {
  color: #c05734;
  font-size: 32px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.summary-card {
  display: flex;
  min-height: 86px;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
}

.summary-card span {
  color: #68756d;
  font-size: 13px;
}

.summary-card strong {
  margin-top: 6px;
  color: #1f2a24;
  font-size: 22px;
}

.query-panel {
  margin-bottom: 14px;
  padding: 14px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.query-actions {
  display: flex;
  gap: 8px;
}

.table-panel {
  padding: 14px;
}

.inline-info {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.inline-info span {
  color: #7a8580;
  font-size: 12px;
}

.danger-text {
  color: #c05734;
  font-weight: 700;
}

.success-text {
  color: #2e7d62;
  font-weight: 700;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .hero-panel {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-metric {
    align-items: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
