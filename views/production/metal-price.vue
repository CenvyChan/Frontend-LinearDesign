<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';
import type {
  HistoryItem,
  MetalCategory,
  MetalCategoryType,
  MetalLatestItem,
  SyncStatus,
  TrendPoint,
  TrendResponse,
} from '#/api/metalPrice';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';

import {
  cleanMetalHistory,
  getLatestPrices,
  getMetalCategories,
  getMetalHistory,
  getMetalSyncStatus,
  getMetalTrend,
  syncMetalInit,
  syncMetalPrices,
} from '#/api/metalPrice';

defineOptions({ name: 'MetalPrice' });

const TYPE_LABELS: Record<string, string> = {
  BASE: '基本金属',
  PRECIOUS: '贵金属',
  SMALL: '小金属',
};

const TYPE_TAGS: Record<string, '' | 'danger' | 'info' | 'success' | 'warning'> = {
  BASE: 'warning',
  PRECIOUS: 'danger',
  SMALL: 'info',
};

const DISPLAY_MODE_LABELS: Record<string, string> = {
  benchmark: '基准价',
  daily_spot: '日线现货',
  minute_realtime: '分钟实时',
};

const loading = ref(false);
const syncLoading = ref(false);
const initSyncLoading = ref(false);
const cleanLoading = ref(false);

const activeType = ref<MetalCategoryType>('');
const lastSyncTime = ref('');
const latestList = ref<MetalLatestItem[]>([]);
const categories = ref<MetalCategory[]>([]);

const currentPage = ref(1);
const pageSize = ref(20);

const drawerVisible = ref(false);
const currentRow = ref<MetalLatestItem | null>(null);
const historyLoading = ref(false);
const historyList = ref<HistoryItem[]>([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyPageSize = ref(20);
const historyViewMode = ref<'daily' | 'detail'>('daily');

const miniTrendVisibleCode = ref('');
const miniTrendLoading = ref(false);
const miniTrendData = ref<TrendPoint[]>([]);
const miniTrendMeta = ref<null | TrendResponse>(null);
const miniChartRef = ref<EchartsUIType>();
const detailTodayChartRef = ref<EchartsUIType>();
const detailMonthChartRef = ref<EchartsUIType>();
const { renderEcharts: renderMiniChart } = useEcharts(miniChartRef);
const { renderEcharts: renderTodayChart } = useEcharts(detailTodayChartRef);
const { renderEcharts: renderMonthChart } = useEcharts(detailMonthChartRef);
type ChartOption = Parameters<typeof renderMiniChart>[0];

const todayTrendLoading = ref(false);
const monthTrendLoading = ref(false);
const todayTrendData = ref<TrendPoint[]>([]);
const monthTrendData = ref<TrendPoint[]>([]);
const detailTrendMeta = ref<null | TrendResponse>(null);

const cleanDialogVisible = ref(false);
const cleanForm = reactive({
  categoryCode: '',
  endDate: '',
  startDate: '',
});

const syncStatus = ref<null | SyncStatus>(null);

const filteredList = computed(() => {
  if (!activeType.value) {
    return latestList.value;
  }
  return latestList.value.filter((item) => item.categoryType === activeType.value);
});

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
});

const syncStatusText = computed(() => {
  const status = syncStatus.value;
  if (!status) return '';
  if (!status.aktoolsEnabled) return 'AKTools 未启用';
  if (status.latestStatus === 'FAILED') return `最近同步失败 ${status.failedCount} 次`;
  if (status.latestStatus === 'PARTIAL') return `最近同步部分成功 ${status.partialCount} 次`;
  if (status.latestStatus === 'SUCCESS') return `最近同步成功 ${status.successCount} 次`;
  return '等待同步';
});

const syncStatusType = computed(() => {
  const status = syncStatus.value;
  if (!status || !status.aktoolsEnabled) return 'danger';
  if (status.latestStatus === 'FAILED') return 'danger';
  if (status.latestStatus === 'PARTIAL') return 'warning';
  return 'success';
});

watch(activeType, () => {
  currentPage.value = 1;
});

watch(drawerVisible, (visible) => {
  if (!visible) {
    currentRow.value = null;
    todayTrendData.value = [];
    monthTrendData.value = [];
    historyList.value = [];
    detailTrendMeta.value = null;
    historyViewMode.value = 'daily';
  }
});

function getTypeText(type: string) {
  return TYPE_LABELS[type] || type || '-';
}

function getTypeTag(type: string) {
  return TYPE_TAGS[type] || '';
}

function getDisplayModeText(mode?: string) {
  if (!mode) return '未定义';
  return DISPLAY_MODE_LABELS[mode] || mode;
}

function getTrendActionText(row: MetalLatestItem) {
  return row.priceTime ? '盘中趋势' : '近30天';
}

function getHistoryViewLabel() {
  return historyViewMode.value === 'daily' ? '日汇总' : '采样明细';
}

function formatPrice(value: null | number | string, digits = 2) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return num.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value: null | number | string) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function formatVolume(value: null | number | string) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return num.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: null | string) {
  if (!value) return '--';
  return value.replace('T', ' ');
}

function formatUpdateTime(row: MetalLatestItem) {
  if (row.priceTime) return row.priceTime.slice(0, 5);
  if (row.priceDate) return row.priceDate;
  return '--';
}

function resolveChangePct(row: MetalLatestItem) {
  if (row.changePct !== null && row.changePct !== undefined) {
    return Number(row.changePct);
  }
  const openPrice = Number(row.openPrice);
  const closePrice = Number(row.closePrice);
  if (!Number.isNaN(openPrice) && !Number.isNaN(closePrice) && openPrice !== 0) {
    return ((closePrice - openPrice) / openPrice) * 100;
  }
  return null;
}

function resolveChangeClass(value: null | number) {
  if (value === null || value === undefined) return 'is-flat';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function buildLineOption(
  labels: string[],
  values: Array<null | number>,
  color: string,
  compact = false,
): ChartOption {
  const valid = values.filter((item) => item !== null) as number[];
  const min = valid.length > 0 ? Math.min(...valid) : 0;
  const max = valid.length > 0 ? Math.max(...valid) : 0;
  const padding = valid.length > 0 ? Math.max((max - min) * 0.12, max * 0.002, 1) : 1;
  const labelStep = compact ? Math.max(1, Math.ceil(labels.length / 6)) : Math.max(1, Math.ceil(labels.length / 8));

  return {
    animationDuration: 300,
    grid: compact
      ? { bottom: 10, left: 8, right: 8, top: 20 }
      : { bottom: 30, containLabel: true, left: 16, right: 16, top: 40 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => formatPrice(value as null | number | string),
    },
    xAxis: {
      axisLabel: {
        color: '#6b7280',
        fontSize: compact ? 10 : 12,
        interval: (_index: number, value: string) => {
          const index = labels.indexOf(value);
          return index % labelStep !== 0;
        },
        rotate: compact ? 0 : labels.length > 18 ? 35 : 0,
      },
      axisLine: { lineStyle: { color: '#d0d5dd' } },
      axisTick: { show: false },
      boundaryGap: false,
      data: labels,
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        color: '#6b7280',
        fontSize: compact ? 10 : 12,
        formatter: (value: number) => formatPrice(value),
      },
      splitLine: {
        lineStyle: {
          color: '#e5e7eb',
          type: 'dashed',
        },
      },
      type: 'value',
      min: valid.length > 0 ? min - padding : undefined,
      max: valid.length > 0 ? max + padding : undefined,
    },
    series: [
      {
        areaStyle: {
          color: compact ? 'rgba(15, 118, 110, 0.10)' : 'rgba(15, 118, 110, 0.12)',
        },
        data: values,
        itemStyle: { color },
        lineStyle: {
          color,
          width: compact ? 2 : 3,
        },
        showSymbol: !compact,
        smooth: true,
        symbolSize: 6,
        type: 'line',
      },
    ],
  };
}

async function loadCategories() {
  const res = await getMetalCategories();
  if (res.success) {
    categories.value = res.data || [];
  }
}

async function loadSyncStatus() {
  const res = await getMetalSyncStatus();
  if (res.success) {
    syncStatus.value = res.data;
  }
}

async function loadLatestData() {
  loading.value = true;
  try {
    const res = await getLatestPrices(activeType.value || undefined);
    if (res.success) {
      latestList.value = Array.isArray(res.data) ? res.data : [];
      lastSyncTime.value = res.lastSyncTime || '';
    } else {
      ElMessage.error(res.message || '获取金属价格失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('获取金属价格失败');
  } finally {
    loading.value = false;
  }
}

async function refreshPageData() {
  await Promise.all([loadCategories(), loadLatestData(), loadSyncStatus()]);
}

async function handleSync() {
  syncLoading.value = true;
  try {
    const res = await syncMetalPrices();
    if (res.success) {
      ElMessage.success(res.message || '同步任务已触发');
      window.setTimeout(() => {
        refreshPageData();
      }, 1200);
    } else {
      ElMessage.error(res.message || '触发同步失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('触发同步失败');
  } finally {
    syncLoading.value = false;
  }
}

async function handleInitSync() {
  initSyncLoading.value = true;
  try {
    const res = await syncMetalInit();
    if (res.success) {
      ElMessage.success(res.message || '首次全量同步已触发');
      window.setTimeout(() => {
        refreshPageData();
      }, 1200);
    } else {
      ElMessage.error(res.message || '首次全量同步失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('首次全量同步失败');
  } finally {
    initSyncLoading.value = false;
  }
}

async function handleShowMiniTrend(row: MetalLatestItem) {
  miniTrendVisibleCode.value = row.categoryCode;
  miniTrendLoading.value = true;
  miniTrendData.value = [];
  miniTrendMeta.value = null;
  try {
    const res = await getMetalTrend(row.categoryCode);
    if (res.success) {
      miniTrendMeta.value = res;
      miniTrendData.value = (res.points || res.data || []).filter((item) => item.price !== null);
    }
  } catch (error) {
    console.error(error);
  } finally {
    miniTrendLoading.value = false;
  }

  await nextTick();
  if (miniTrendVisibleCode.value !== row.categoryCode || miniTrendData.value.length === 0) {
    return;
  }
  await renderMiniChart(
    buildLineOption(
      miniTrendData.value.map((item) => item.time),
      miniTrendData.value.map((item) => item.price),
      '#0f766e',
      true,
    ),
  );
}

async function loadHistory(categoryCode: string) {
  historyLoading.value = true;
  try {
    const res = await getMetalHistory({
      categoryCode,
      dailyOnly: historyViewMode.value === 'daily',
      page: historyPage.value,
      pageSize: historyPageSize.value,
    });
    if (res.success) {
      historyList.value = res.data?.list || [];
      historyTotal.value = res.data?.total || 0;
    }
  } catch (error) {
    console.error(error);
  } finally {
    historyLoading.value = false;
  }
}

async function loadTrendPanels(categoryCode: string) {
  todayTrendLoading.value = true;
  monthTrendLoading.value = true;
  todayTrendData.value = [];
  monthTrendData.value = [];
  detailTrendMeta.value = null;
  try {
    const trendRes = await getMetalTrend(categoryCode);
    if (trendRes.success) {
      detailTrendMeta.value = trendRes;
      const points = (trendRes.points || trendRes.data || []).filter((item) => item.price !== null);
      if (trendRes.trendType === 'minute') {
        todayTrendData.value = points;
      } else {
        monthTrendData.value = points;
      }
    }

    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const historyRes = await getMetalHistory({
      categoryCode,
      dailyOnly: true,
      endDate,
      startDate,
    });
    if (historyRes.success) {
      monthTrendData.value = (historyRes.data?.list || [])
        .map((item) => ({
          price: item.closePrice,
          time: item.priceDate ? dayjs(item.priceDate).format('MM-DD') : '--',
        }))
        .filter((item) => item.price !== null);
    }
  } catch (error) {
    console.error(error);
  } finally {
    todayTrendLoading.value = false;
    monthTrendLoading.value = false;
  }

  await nextTick();
  if (todayTrendData.value.length > 0) {
    await renderTodayChart(
      buildLineOption(
        todayTrendData.value.map((item) => item.time),
        todayTrendData.value.map((item) => item.price),
        '#d97706',
      ),
    );
  }
  if (monthTrendData.value.length > 0) {
    await renderMonthChart(
      buildLineOption(
        monthTrendData.value.map((item) => item.time),
        monthTrendData.value.map((item) => item.price),
        '#2563eb',
      ),
    );
  }
}

async function handleOpenDetail(row: MetalLatestItem) {
  currentRow.value = row;
  historyPage.value = 1;
  historyViewMode.value = row.priceTime ? 'detail' : 'daily';
  drawerVisible.value = true;
  await nextTick();
  await Promise.all([loadTrendPanels(row.categoryCode), loadHistory(row.categoryCode)]);
}

async function handleHistoryPageChange() {
  if (!currentRow.value) return;
  await loadHistory(currentRow.value.categoryCode);
}

async function handleHistoryViewChange(mode: 'daily' | 'detail') {
  historyViewMode.value = mode;
  historyPage.value = 1;
  if (!currentRow.value) return;
  await loadHistory(currentRow.value.categoryCode);
}

function showCleanDialog() {
  cleanForm.categoryCode = '';
  cleanForm.startDate = dayjs().subtract(90, 'day').format('YYYY-MM-DD');
  cleanForm.endDate = dayjs().format('YYYY-MM-DD');
  cleanDialogVisible.value = true;
}

async function handleClean() {
  if (!cleanForm.startDate || !cleanForm.endDate) {
    ElMessage.warning('请选择完整的日期范围');
    return;
  }
  if (dayjs(cleanForm.startDate).isAfter(dayjs(cleanForm.endDate))) {
    ElMessage.warning('起始日期不能晚于结束日期');
    return;
  }
  try {
    await ElMessageBox.confirm(
      '此操作将删除选定范围内的价格数据，且不可恢复，是否继续？',
      '确认清理',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  cleanLoading.value = true;
  try {
    const res = await cleanMetalHistory({
      categoryCode: cleanForm.categoryCode || undefined,
      endDate: cleanForm.endDate,
      startDate: cleanForm.startDate,
    });
    if (res.success) {
      ElMessage.success(
        res.deletedCount !== undefined
          ? `清理完成，删除 ${res.deletedCount} 条数据`
          : res.message || '清理完成',
      );
      cleanDialogVisible.value = false;
      await refreshPageData();
      if (currentRow.value) {
        await handleOpenDetail(currentRow.value);
      }
    } else {
      ElMessage.error(res.message || '清理失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('清理失败');
  } finally {
    cleanLoading.value = false;
  }
}

onMounted(() => {
  refreshPageData();
});
</script>

<template>
  <div class="metal-price-page">
    <div class="hero-panel">
      <div class="hero-copy">
        <div class="hero-eyebrow">Production Intelligence</div>
        <h1>金属价格监控</h1>
        <p>
          按品种能力展示分钟实时、日线现货和基准价数据，优先把空值、趋势图和同步状态解释清楚。
        </p>
      </div>
      <div class="hero-metrics">
        <div class="metric-card">
          <span class="metric-label">最后同步</span>
          <strong class="metric-value">{{ formatDateTime(lastSyncTime) }}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">同步状态</span>
          <el-tag :type="syncStatusType" effect="dark" round>
            {{ syncStatusText || '加载中' }}
          </el-tag>
          <small class="metric-desc">{{ syncStatus?.latestStatusTime || '暂无记录' }}</small>
        </div>
        <div class="metric-card">
          <span class="metric-label">交易时段</span>
          <strong class="metric-value">
            {{ syncStatus?.tradingHours ? '交易中' : '非交易时段' }}
          </strong>
          <small class="metric-desc">
            {{ syncStatus?.latestStatusMessage || '最近状态无附加说明' }}
          </small>
        </div>
      </div>
      <div class="hero-actions">
        <el-button type="primary" :loading="syncLoading" @click="handleSync" :icon="'Refresh'">手动同步</el-button>
        <el-button type="success" plain :loading="initSyncLoading" @click="handleInitSync" :icon="'Refresh'">
          首次全量同步
        </el-button>
        <el-button type="danger" plain @click="showCleanDialog" :icon="'Delete'">清理数据</el-button>
      </div>
    </div>

    <div class="toolbar-panel">
      <div class="toolbar-left">
        <el-radio-group v-model="activeType" size="default">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="PRECIOUS">贵金属</el-radio-button>
          <el-radio-button value="BASE">基本金属</el-radio-button>
          <el-radio-button value="SMALL">小金属</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <span class="toolbar-summary">共 {{ filteredList.length }} 个监控品种</span>
        <el-button text @click="refreshPageData" :icon="'Refresh'">刷新</el-button>
      </div>
    </div>

    <div class="table-panel">
      <el-table
        :data="pagedList"
        v-loading="loading"
        border
        stripe
        highlight-current-row
        @row-click="handleOpenDetail"
      >
        <el-table-column label="分类" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTag(row.categoryType)" size="small" round>
              {{ getTypeText(row.categoryType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="品种" min-width="180" />
        <el-table-column prop="categoryCode" label="编码" width="130" align="center" />
        <el-table-column label="数据类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getDisplayModeText(row.displayMode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最新价" min-width="170" align="right">
          <template #default="{ row }">
            <div class="price-cell">
              <strong>{{ formatPrice(row.closePrice) }}</strong>
              <span>{{ row.unit || '--' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="涨跌幅" width="120" align="center">
          <template #default="{ row }">
            <span :class="['change-text', resolveChangeClass(resolveChangePct(row))]">
              {{ formatPercent(resolveChangePct(row)) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120" align="center">
          <template #default="{ row }">
            {{ formatUpdateTime(row) }}
          </template>
        </el-table-column>
        <el-table-column label="采集时间" min-width="180" align="center">
          <template #default="{ row }">
            {{ formatDateTime(row.fetchedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="趋势能力" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.supportsMinuteTrend ? 'success' : 'warning'" size="small">
              {{ row.supportsMinuteTrend ? '分钟趋势' : '日线趋势' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="走势" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-popover placement="left" :width="320" trigger="hover" @show="handleShowMiniTrend(row)">
              <template #reference>
                <el-button type="primary" text>{{ getTrendActionText(row) }}</el-button>
              </template>
                <div class="mini-chart-card">
                  <div class="mini-chart-title">{{ row.categoryName }} {{ getTrendActionText(row) }}走势</div>
                  <div class="mini-chart-subtitle">{{ getDisplayModeText(row.displayMode) }}</div>
                <div v-if="miniTrendLoading && miniTrendVisibleCode === row.categoryCode" class="mini-empty">
                  加载中...
                </div>
                <div
                  v-else-if="miniTrendVisibleCode === row.categoryCode && miniTrendData.length === 0"
                  class="mini-empty"
                >
                  {{ row.priceTime ? '暂无盘中采样趋势数据' : '当前仅有日线数据或暂无采样点' }}
                </div>
                <EchartsUI v-else ref="miniChartRef" class="mini-chart" />
              </div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-area">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="filteredList.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="currentRow ? `${currentRow.categoryName} 历史记录` : '历史记录'"
      direction="rtl"
      size="68%"
      destroy-on-close
    >
      <template v-if="currentRow">
        <div class="drawer-overview">
          <div class="overview-card">
            <span>品种编码</span>
            <strong>{{ currentRow.categoryCode }}</strong>
          </div>
          <div class="overview-card">
            <span>数据类型</span>
            <strong>{{ getDisplayModeText(currentRow.displayMode) }}</strong>
          </div>
          <div class="overview-card">
            <span>最新价格</span>
            <strong>{{ formatPrice(currentRow.closePrice) }} {{ currentRow.unit || '' }}</strong>
          </div>
          <div class="overview-card">
            <span>涨跌幅</span>
            <strong :class="['change-text', resolveChangeClass(resolveChangePct(currentRow))]">
              {{ formatPercent(resolveChangePct(currentRow)) }}
            </strong>
          </div>
        </div>

        <div class="detail-hint">
          {{
            todayTrendData.length > 0
              ? '左图展示库内采样形成的盘中趋势；即使不是官方分钟接口，只要存在带时间点的数据就会渲染。'
              : '当前未检测到可用于盘中趋势的采样点，左图不渲染；右图仍展示近30天走势。'
          }}
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <div class="card-title">
              {{ todayTrendData.length > 0 ? '盘中采样趋势' : '盘中趋势说明' }}
            </div>
            <div v-if="todayTrendLoading" class="chart-placeholder">加载中...</div>
            <div v-else-if="todayTrendData.length === 0" class="chart-placeholder">
              当前没有带时间戳的采样点，暂不渲染盘中趋势图
            </div>
            <EchartsUI v-else ref="detailTodayChartRef" class="detail-chart" />
          </div>
          <div class="detail-card">
            <div class="card-title">近30天走势</div>
            <div v-if="monthTrendLoading" class="chart-placeholder">加载中...</div>
            <div v-else-if="monthTrendData.length === 0" class="chart-placeholder">暂无近30天走势数据</div>
            <EchartsUI v-else ref="detailMonthChartRef" class="detail-chart" />
          </div>
        </div>

        <div class="detail-card history-card">
          <div class="history-header">
            <div class="card-title">历史记录</div>
            <el-radio-group :model-value="historyViewMode" size="small" @update:model-value="handleHistoryViewChange">
              <el-radio-button label="daily">日汇总</el-radio-button>
              <el-radio-button label="detail">采样明细</el-radio-button>
            </el-radio-group>
          </div>
          <div class="mini-chart-subtitle history-subtitle">
            当前查看：{{ getHistoryViewLabel() }}
          </div>
          <el-table :data="historyList" v-loading="historyLoading" border stripe size="small">
            <el-table-column prop="priceDate" label="日期" width="110" />
            <el-table-column prop="priceTime" label="时间" width="100" align="center" />
            <el-table-column label="开盘" width="110" align="right">
              <template #default="{ row }">{{ formatPrice(row.openPrice) }}</template>
            </el-table-column>
            <el-table-column label="收盘" width="110" align="right">
              <template #default="{ row }">{{ formatPrice(row.closePrice) }}</template>
            </el-table-column>
            <el-table-column label="最高" width="110" align="right">
              <template #default="{ row }">{{ formatPrice(row.highPrice) }}</template>
            </el-table-column>
            <el-table-column label="最低" width="110" align="right">
              <template #default="{ row }">{{ formatPrice(row.lowPrice) }}</template>
            </el-table-column>
            <el-table-column label="涨跌幅" width="100" align="center">
              <template #default="{ row }">
                <span :class="['change-text', resolveChangeClass(row.changePct)]">
                  {{ formatPercent(row.changePct) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="成交量" min-width="120" align="right">
              <template #default="{ row }">{{ formatVolume(row.volume) }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination-area inner">
            <el-pagination
              v-model:current-page="historyPage"
              v-model:page-size="historyPageSize"
              :page-sizes="[20, 50, 100]"
              :total="historyTotal"
              background
              layout="total, sizes, prev, pager, next"
              @current-change="handleHistoryPageChange"
              @size-change="handleHistoryPageChange"
            />
          </div>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="cleanDialogVisible" title="清理历史数据" width="520px" destroy-on-close>
      <el-form label-width="88px">
        <el-form-item label="品种">
          <el-select v-model="cleanForm.categoryCode" clearable placeholder="全部品种" style="width: 100%">
            <el-option
              v-for="item in categories"
              :key="item.categoryCode"
              :label="item.categoryName"
              :value="item.categoryCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker
            v-model="cleanForm.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择起始日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="cleanForm.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <el-alert
        title="此操作将删除选定范围内的价格数据，无法恢复。"
        type="warning"
        :closable="false"
        show-icon
      />
      <template #footer>
        <el-button @click="cleanDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="cleanLoading" @click="handleClean" :icon="'Delete'">
          确认清理
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.metal-price-page {
  min-height: 100%;
  padding: 18px;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 28%),
    radial-gradient(circle at right center, rgba(245, 158, 11, 0.14), transparent 24%),
    linear-gradient(180deg, #f8fbff 0%, #eef4f7 100%);
}

.hero-panel {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  gap: 16px;
  margin-bottom: 16px;
  padding: 20px 22px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 249, 255, 0.92));
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.hero-copy h1 {
  margin: 6px 0 10px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.2;
}

.hero-copy p {
  margin: 0;
  color: #475467;
  line-height: 1.7;
}

.hero-eyebrow {
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-metrics {
  display: grid;
  gap: 12px;
}

.metric-card,
.overview-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
}

.metric-label,
.overview-card span {
  color: #667085;
  font-size: 12px;
}

.metric-value,
.overview-card strong {
  color: #101828;
  font-size: 16px;
}

.metric-desc {
  color: #98a2b3;
  font-size: 12px;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}

.toolbar-panel,
.table-panel,
.detail-card,
.detail-hint {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 18px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-summary {
  color: #667085;
  font-size: 13px;
}

.table-panel {
  padding: 14px;
}

.price-cell {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
}

.price-cell strong {
  color: #111827;
  font-size: 16px;
}

.price-cell span {
  color: #667085;
  font-size: 12px;
}

.change-text {
  font-weight: 700;
}

.is-up {
  color: #dc2626;
}

.is-down {
  color: #059669;
}

.is-flat {
  color: #667085;
}

.mini-chart-card {
  padding: 6px 4px 2px;
}

.mini-chart-title,
.card-title {
  margin-bottom: 8px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.mini-chart-subtitle,
.detail-hint {
  color: #667085;
  font-size: 12px;
}

.detail-hint {
  margin-bottom: 16px;
  padding: 12px 14px;
}

.mini-chart {
  height: 180px;
}

.mini-empty,
.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 13px;
}

.chart-placeholder {
  min-height: 280px;
}

.pagination-area {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.pagination-area.inner {
  margin-top: 12px;
}

.drawer-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.detail-card {
  padding: 16px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.history-subtitle {
  margin-bottom: 10px;
}

.detail-chart {
  height: 280px;
}

.history-card {
  margin-bottom: 4px;
}

@media (max-width: 1200px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .drawer-overview,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .metal-price-page {
    padding: 12px;
  }

  .toolbar-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    justify-content: space-between;
  }
}
</style>
