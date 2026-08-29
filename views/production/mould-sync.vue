<script lang="ts" setup>
import { ref, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getSyncStatus,
  getSyncHistory,
  getBusinessHistory,
  retryFailedRecord,
  syncMouldMasterData,
  type SyncStatusOverview,
} from '#/api/mould';

defineOptions({ name: 'MouldSync' });

// ============ 公共方法 ============
const getSyncStatusType = (status: string) => {
  const map: Record<string, string> = { SUCCESS: 'success', FAILED: 'danger', PROCESSING: 'warning', PENDING: 'info' };
  return map[status] || '';
};

const getSyncStatusText = (status: string) => {
  const map: Record<string, string> = { SUCCESS: '成功', FAILED: '失败', PROCESSING: '处理中', PENDING: '待处理' };
  return map[status] || status;
};

const getDataSourceText = (source: string | null) => {
  const map: Record<string, string> = { ERP_PLUGIN: 'ERP插件', ERP_WEBHOOK: 'ERP Webhook', MANUAL: '手动' };
  return source ? (map[source] || source) : '-';
};

const getBusinessTypeText = (type: string) => {
  const map: Record<string, string> = { SCSJ: '生产上机', BY: '保养', XM: '修模', LSJL: '历史记录' };
  return map[type] || type;
};

const formatJson = (str: string | null) => {
  if (!str) return '';
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
};

// ============ Tab 管理 ============
const activeTab = ref('status');

// ============ Tab1: 同步状态监控 ============
const statusLoading = ref(false);
const masterSyncLoading = ref(false);
const statusData = ref<SyncStatusOverview>({} as SyncStatusOverview);

const loadSyncStatus = async () => {
  statusLoading.value = true;
  try {
    const res: any = await getSyncStatus();
    if (res.success) {
      statusData.value = res.data || {};
    }
  } catch (error) {
    console.error('加载同步状态失败:', error);
  } finally {
    statusLoading.value = false;
  }
};

const handleMasterSync = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要手动同步模具主数据吗？这会重新从 ERP 拉取模具主数据并归集同步结果。',
      '手动主数据同步',
      { type: 'warning' },
    );
    masterSyncLoading.value = true;
    const res: any = await syncMouldMasterData();
    if (res.success) {
      ElMessage.success(res.message || '主数据同步已完成');
    } else {
      ElMessage.error(res.message || res.failedSummary || '主数据同步失败');
    }
    await loadSyncStatus();
    if (activeTab.value === 'syncHistory') {
      await loadSyncHistory(1);
    } else if (activeTab.value === 'errorLog') {
      await loadErrorLogs(1);
    }
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '主数据同步失败');
    }
  } finally {
    masterSyncLoading.value = false;
  }
};

// ============ Tab2: 同步历史记录 ============
const syncHistoryLoading = ref(false);
const syncHistoryData = ref<any[]>([]);
const syncHistoryTotal = ref(0);
const syncHistoryPage = ref(1);
const syncHistoryPageSize = ref(20);
const syncHistoryFilter = reactive({
  status: '',
  dataSource: ''
});

const loadSyncHistory = async (page?: number) => {
  if (page) syncHistoryPage.value = page;
  syncHistoryLoading.value = true;
  try {
    const params: any = { page: syncHistoryPage.value, pageSize: syncHistoryPageSize.value };
    if (syncHistoryFilter.status) params.status = syncHistoryFilter.status;
    if (syncHistoryFilter.dataSource) params.dataSource = syncHistoryFilter.dataSource;
    const res: any = await getSyncHistory(params);
    if (res.success) {
      syncHistoryData.value = res.data || [];
      syncHistoryTotal.value = res.total || 0;
    }
  } catch (error) {
    console.error('加载同步历史失败:', error);
  } finally {
    syncHistoryLoading.value = false;
  }
};

const resetSyncHistoryFilter = () => {
  syncHistoryFilter.status = '';
  syncHistoryFilter.dataSource = '';
  loadSyncHistory(1);
};

// ============ Tab3: 业务记录历史 ============
const bizLoading = ref(false);
const businessHistoryData = ref<any[]>([]);
const bizTotal = ref(0);
const bizPage = ref(1);
const bizPageSize = ref(20);
const bizDateRange = ref<string[]>([]);
const bizFilter = reactive({
  mouldCode: '',
  businessType: '',
  sourceBillNo: ''
});

const loadBusinessHistory = async (page?: number) => {
  if (page) bizPage.value = page;
  bizLoading.value = true;
  try {
    const params: any = { page: bizPage.value, pageSize: bizPageSize.value };
    if (bizFilter.mouldCode) params.mouldCode = bizFilter.mouldCode;
    if (bizFilter.businessType) params.businessType = bizFilter.businessType;
    if (bizFilter.sourceBillNo) params.sourceBillNo = bizFilter.sourceBillNo;
    if (bizDateRange.value && bizDateRange.value.length === 2) {
      params.startDate = bizDateRange.value[0];
      params.endDate = bizDateRange.value[1];
    }
    const res: any = await getBusinessHistory(params);
    if (res.success) {
      businessHistoryData.value = res.data || [];
      bizTotal.value = res.total || 0;
    }
  } catch (error) {
    console.error('加载业务记录历史失败:', error);
  } finally {
    bizLoading.value = false;
  }
};

const resetBizFilter = () => {
  bizFilter.mouldCode = '';
  bizFilter.businessType = '';
  bizFilter.sourceBillNo = '';
  bizDateRange.value = [];
  loadBusinessHistory(1);
};

// ============ Tab4: 错误日志 ============
const errorLoading = ref(false);
const errorLogData = ref<any[]>([]);
const errorTotal = ref(0);
const errorPage = ref(1);
const errorPageSize = ref(20);

const loadErrorLogs = async (page?: number) => {
  if (page) errorPage.value = page;
  errorLoading.value = true;
  try {
    const res: any = await getSyncHistory({ status: 'FAILED', page: errorPage.value, pageSize: errorPageSize.value });
    if (res.success) {
      errorLogData.value = (res.data || []).map((r: any) => ({ ...r, _retrying: false }));
      errorTotal.value = res.total || 0;
    }
  } catch (error) {
    console.error('加载错误日志失败:', error);
  } finally {
    errorLoading.value = false;
  }
};

const handleRetry = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要重试源单据号 "${row.sourceBillNo}" 的同步记录吗？`,
      '确认重试',
      { type: 'warning' }
    );
    if (row._retrying !== undefined) row._retrying = true;
    const res: any = await retryFailedRecord(row.id);
    if (res.success) {
      ElMessage.success('重试成功');
    } else {
      ElMessage.error(res.message || '重试失败');
    }
    loadSyncStatus();
    if (activeTab.value === 'errorLog') {
      loadErrorLogs();
    } else if (activeTab.value === 'syncHistory') {
      loadSyncHistory();
    }
  } catch {
    // 取消
  } finally {
    if (row._retrying !== undefined) row._retrying = false;
  }
};

// ============ 请求详情弹窗 ============
const detailDialogVisible = ref(false);
const currentRecord = ref<any>(null);

const showRequestDetail = (row: any) => {
  currentRecord.value = row;
  detailDialogVisible.value = true;
};

// ============ 初始化 ============
onMounted(() => {
  loadSyncStatus();
});
</script>

<template>
  <div class="sync-container">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- Tab 1: 同步状态监控 -->
      <el-tab-pane label="同步状态监控" name="status">
        <div class="status-cards" v-loading="statusLoading">
          <el-row :gutter="16">
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-value">{{ statusData.totalCount || 0 }}</div>
                <div class="stat-label">总记录数</div>
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card stat-success">
                <div class="stat-value">{{ statusData.successCount || 0 }}</div>
                <div class="stat-label">成功</div>
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card stat-danger">
                <div class="stat-value">{{ statusData.failedCount || 0 }}</div>
                <div class="stat-label">失败</div>
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card stat-warning">
                <div class="stat-value">{{ statusData.processingCount || 0 }}</div>
                <div class="stat-label">处理中</div>
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card">
                <el-button type="primary" @click="loadSyncStatus" :loading="statusLoading" style="width: 100%" :icon="'Refresh'">刷新状态</el-button>
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-card">
                <el-button type="warning" @click="handleMasterSync" :loading="masterSyncLoading" style="width: 100%" :icon="'RefreshRight'">手动同步</el-button>
              </el-card>
            </el-col>
          </el-row>
          <el-alert
            v-if="statusData.hasFailedRecords"
            :title="statusData.warningMessage || '存在失败的同步记录'"
            type="error"
            show-icon
            :closable="false"
            style="margin-top: 16px"
          />
        </div>
      </el-tab-pane>

      <!-- Tab 2: 同步历史记录 -->
      <el-tab-pane label="同步历史记录" name="syncHistory">
        <div class="search-area">
          <el-select v-model="syncHistoryFilter.status" placeholder="同步状态" clearable style="width: 130px">
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAILED" />
            <el-option label="处理中" value="PROCESSING" />
          </el-select>
          <el-select v-model="syncHistoryFilter.dataSource" placeholder="数据来源" clearable style="width: 130px; margin-left: 8px">
            <el-option label="ERP插件" value="ERP_PLUGIN" />
            <el-option label="ERP Webhook" value="ERP_WEBHOOK" />
            <el-option label="手动" value="MANUAL" />
          </el-select>
          <el-button type="primary" style="margin-left: 8px" @click="loadSyncHistory(1)" :icon="'Search'">查询</el-button>
          <el-button @click="resetSyncHistoryFilter" :icon="'RefreshRight'">重置</el-button>
        </div>
        <el-table :data="syncHistoryData" v-loading="syncHistoryLoading" border stripe style="width: 100%" max-height="500">
          <el-table-column prop="sourceBillNo" label="源单据号" width="180" show-overflow-tooltip />
          <el-table-column prop="auditTime" label="审核时间" width="170" />
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getSyncStatusType(row.status)" size="small">{{ getSyncStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="syncCount" label="同步条数" width="90" align="center" />
          <el-table-column prop="dataSource" label="来源" width="110" align="center">
            <template #default="{ row }">
              {{ getDataSourceText(row.dataSource) }}
            </template>
          </el-table-column>
          <el-table-column prop="retryCount" label="重试次数" width="90" align="center" />
          <el-table-column prop="errorMessage" label="错误信息" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.errorMessage" class="text-danger">{{ row.errorMessage }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdTime" label="创建时间" width="170" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'FAILED'"
                type="warning"
                size="small"
                link
                @click="handleRetry(row)" :icon="'RefreshRight'">重试</el-button>
              <el-button
                size="small"
                link
                @click="showRequestDetail(row)" :icon="'View'">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-area" v-if="syncHistoryTotal > 0">
          <el-pagination
            v-model:current-page="syncHistoryPage"
            v-model:page-size="syncHistoryPageSize"
            :total="syncHistoryTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
            @size-change="() => loadSyncHistory(1)"
            @current-change="() => loadSyncHistory()"
          />
        </div>
      </el-tab-pane>

      <!-- Tab 3: 业务记录历史 -->
      <el-tab-pane label="业务记录查询" name="businessHistory">
        <div class="search-area">
          <el-input v-model="bizFilter.mouldCode" placeholder="模具编码" clearable style="width: 140px" />
          <el-select v-model="bizFilter.businessType" placeholder="业务类型" clearable style="width: 120px; margin-left: 8px">
            <el-option label="生产上机" value="SCSJ" />
            <el-option label="保养" value="BY" />
            <el-option label="修模" value="XM" />
            <el-option label="历史记录" value="LSJL" />
          </el-select>
          <el-input v-model="bizFilter.sourceBillNo" placeholder="源单据号" clearable style="width: 160px; margin-left: 8px" />
          <el-date-picker
            v-model="bizDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="margin-left: 8px"
          />
          <el-button type="primary" style="margin-left: 8px" @click="loadBusinessHistory(1)" :icon="'Search'">查询</el-button>
          <el-button @click="resetBizFilter" :icon="'RefreshRight'">重置</el-button>
        </div>
        <el-table :data="businessHistoryData" v-loading="bizLoading" border stripe style="width: 100%" max-height="500">
          <el-table-column prop="mouldCode" label="模具编码" width="140" />
          <el-table-column prop="businessType" label="业务类型" width="100" align="center">
            <template #default="{ row }">
              {{ getBusinessTypeText(row.businessType) }}
            </template>
          </el-table-column>
          <el-table-column prop="businessDate" label="业务日期" width="120" />
          <el-table-column prop="mouldCount" label="模次" width="80" align="right" />
          <el-table-column prop="sourceBillNo" label="源单据号" width="180" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="250" show-overflow-tooltip />
          <el-table-column prop="createdTime" label="创建时间" width="170" />
        </el-table>
        <div class="pagination-area" v-if="bizTotal > 0">
          <el-pagination
            v-model:current-page="bizPage"
            v-model:page-size="bizPageSize"
            :total="bizTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
            @size-change="() => loadBusinessHistory(1)"
            @current-change="() => loadBusinessHistory()"
          />
        </div>
      </el-tab-pane>

      <!-- Tab 4: 错误日志 -->
      <el-tab-pane label="错误日志" name="errorLog">
        <div class="search-area">
          <el-button type="danger" plain @click="loadErrorLogs(1)" :loading="errorLoading" :icon="'Search'">查询失败记录</el-button>
          <el-button type="primary" plain @click="loadSyncStatus" :icon="'Refresh'">刷新状态</el-button>
        </div>
        <el-table :data="errorLogData" v-loading="errorLoading" border stripe style="width: 100%" max-height="500">
          <el-table-column prop="sourceBillNo" label="源单据号" width="180" show-overflow-tooltip />
          <el-table-column prop="auditTime" label="审核时间" width="170" />
          <el-table-column prop="errorMessage" label="错误信息" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-danger">{{ row.errorMessage || '未知错误' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="retryCount" label="重试次数" width="90" align="center" />
          <el-table-column prop="dataSource" label="来源" width="110" align="center">
            <template #default="{ row }">
              {{ getDataSourceText(row.dataSource) }}
            </template>
          </el-table-column>
          <el-table-column prop="createdTime" label="创建时间" width="170" />
          <el-table-column prop="updatedTime" label="更新时间" width="170" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button type="warning" size="small" link @click="handleRetry(row)" :loading="row._retrying" :icon="'RefreshRight'">重试</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-area" v-if="errorTotal > 0">
          <el-pagination
            v-model:current-page="errorPage"
            v-model:page-size="errorPageSize"
            :total="errorTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
            @size-change="() => loadErrorLogs(1)"
            @current-change="() => loadErrorLogs()"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 请求详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="同步请求详情" width="700px" destroy-on-close>
      <el-descriptions :column="2" border size="small" v-if="currentRecord">
        <el-descriptions-item label="源单据号">{{ currentRecord.sourceBillNo }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ currentRecord.auditTime }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getSyncStatusType(currentRecord.status)" size="small">{{ getSyncStatusText(currentRecord.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="同步条数">{{ currentRecord.syncCount }}</el-descriptions-item>
        <el-descriptions-item label="数据来源">{{ getDataSourceText(currentRecord.dataSource) }}</el-descriptions-item>
        <el-descriptions-item label="重试次数">{{ currentRecord.retryCount }}</el-descriptions-item>
        <el-descriptions-item label="处理开始">{{ currentRecord.processStartTime }}</el-descriptions-item>
        <el-descriptions-item label="处理完成">{{ currentRecord.processEndTime }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2" v-if="currentRecord.errorMessage">
          <span class="text-danger">{{ currentRecord.errorMessage }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="currentRecord?.requestData" style="margin-top: 16px">
        <div style="font-weight: bold; margin-bottom: 8px">请求数据：</div>
        <el-input type="textarea" :model-value="formatJson(currentRecord.requestData)" :rows="10" readonly />
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.sync-container {
  padding: 16px;
  height: 100%;
}

.search-area {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.pagination-area {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.stat-card {
  text-align: center;
  padding: 12px 0;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.stat-success .stat-value { color: #67c23a; }
.stat-danger .stat-value { color: #f56c6c; }
.stat-warning .stat-value { color: #e6a23c; }
.stat-info .stat-value { color: #909399; }

.text-danger {
  color: #f56c6c;
}

.text-muted {
  color: #c0c4cc;
}

.status-cards {
  margin-bottom: 16px;
}
</style>
