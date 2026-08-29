<script lang="ts" setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  getAllExceptions,
  handleException,
  resolveException,
  escalateException,
  type ExceptionItem,
} from '#/api/production';

defineOptions({ name: 'ExceptionDashboard' });

// ============ 常量 ============
const ExceptionTypeLabels: Record<string, string> = {
  EQUIPMENT: '设备故障',
  MOULD: '模具异常',
  GAUGE: '量具异常',
  QUALITY: '质量异常',
  ORDER: '工单异常',
  OTHER: '其他'
};

const HandlerStatus = {
  REPORTED: 'REPORTED',
  HANDLING: 'HANDLING',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED'
};

const HandlerStatusLabels: Record<string, string> = {
  REPORTED: '已上报',
  HANDLING: '处理中',
  RESOLVED: '已解决',
  ESCALATED: '已升级'
};

const exceptionTagType = (type: string) => {
  const map: Record<string, string> = {
    EQUIPMENT: 'danger',
    MOULD: 'warning',
    GAUGE: 'warning',
    QUALITY: 'danger',
    ORDER: 'info',
    OTHER: ''
  };
  return map[type] || '';
};

const handlerStatusTagType = (status: string) => {
  const map: Record<string, string> = {
    REPORTED: 'danger',
    HANDLING: 'warning',
    RESOLVED: 'success',
    ESCALATED: 'info'
  };
  return map[status] || '';
};

const formatTime = (timestamp: number | undefined | null) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleString('zh-CN', { hour12: false });
};

// ============ 状态 ============
const loading = ref(false);
const tableData = ref<ExceptionItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const filterType = ref('');
const filterStatus = ref('');
const searchOrderNo = ref('');
const autoRefresh = ref(true);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// 详情抽屉
const detailVisible = ref(false);
const detailData = ref<ExceptionItem | null>(null);

// 操作对话框
const actionDialog = reactive({
  visible: false,
  title: '',
  mode: '' as 'handle' | 'resolve' | 'escalate',
  form: {
    handlerName: '',
    remark: ''
  },
  currentItem: null as ExceptionItem | null
});
const actionSubmitting = ref(false);

// ============ 数据加载 ============
const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getAllExceptions({
      exceptionType: filterType.value || undefined,
      handlerStatus: filterStatus.value || undefined,
      orderNo: searchOrderNo.value || undefined,
      page: currentPage.value,
      size: pageSize.value
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = res.total || 0;
    } else {
      ElMessage.error(res.message || '查询异常列表失败');
    }
  } catch (e) {
    console.error(e);
    ElMessage.error('查询异常列表失败');
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  loadData();
};

const resetFilter = () => {
  filterType.value = '';
  filterStatus.value = '';
  searchOrderNo.value = '';
  currentPage.value = 1;
  loadData();
};

// ============ 详情抽屉 ============
const showDetail = (row: ExceptionItem) => {
  detailData.value = row;
  detailVisible.value = true;
};

// ============ 操作 ============
const handleExceptionAction = (item: ExceptionItem) => {
  actionDialog.mode = 'handle';
  actionDialog.title = '处理异常 - ' + item.orderNo;
  actionDialog.form = { handlerName: '', remark: '' };
  actionDialog.currentItem = item;
  actionDialog.visible = true;
};

const resolveExceptionAction = (item: ExceptionItem) => {
  actionDialog.mode = 'resolve';
  actionDialog.title = '解决异常 - ' + item.orderNo;
  actionDialog.form = { handlerName: '', remark: '' };
  actionDialog.currentItem = item;
  actionDialog.visible = true;
};

const escalateExceptionAction = (item: ExceptionItem) => {
  actionDialog.mode = 'escalate';
  actionDialog.title = '升级异常 - ' + item.orderNo;
  actionDialog.form = { handlerName: '', remark: '' };
  actionDialog.currentItem = item;
  actionDialog.visible = true;
};

const confirmAction = async () => {
  const item = actionDialog.currentItem;
  if (!item) return;
  actionSubmitting.value = true;
  try {
    let res: any;
    const mode = actionDialog.mode;
    if (mode === 'handle') {
      res = await handleException(item.id, {
        handlerName: actionDialog.form.handlerName || '系统管理员',
        handlerId: undefined
      });
    } else if (mode === 'resolve') {
      res = await resolveException(item.id, actionDialog.form.remark || '已解决');
    } else {
      res = await escalateException(item.id, {
        handlerName: actionDialog.form.handlerName || '系统管理员',
        remark: actionDialog.form.remark
      });
    }
    if (res.success) {
      ElMessage.success('操作成功');
      actionDialog.visible = false;
      loadData();
      if (detailVisible.value && detailData.value?.id === item.id) {
        detailData.value = res.data || { ...detailData.value, ...res.data };
      }
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } catch (e) {
    console.error(e);
    ElMessage.error('操作失败');
  } finally {
    actionSubmitting.value = false;
  }
};

// ============ 自动刷新 ============
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) {
      loadData();
    }
  }, 30000);
};

onMounted(() => {
  loadData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <div class="exception-dashboard-container">
    <!-- 筛选区域 -->
    <div class="filter-area">
      <el-select v-model="filterType" placeholder="异常类型" clearable style="width:140px">
        <el-option v-for="(label, key) in ExceptionTypeLabels" :key="key" :label="label" :value="key" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="处理状态" clearable style="width:140px">
        <el-option v-for="(label, key) in HandlerStatusLabels" :key="key" :label="label" :value="key" />
      </el-select>
      <el-input v-model="searchOrderNo" placeholder="工单号搜索" clearable style="width:180px" @keyup.enter="handleSearch" />
      <el-button type="primary" @click="handleSearch" :icon="'Search'">查询</el-button>
      <el-button @click="resetFilter" :icon="'RefreshRight'">重置</el-button>
      <el-button type="default" @click="loadData" :loading="loading" :icon="'Refresh'">刷新</el-button>
      <span style="margin-left:12px;color:#909399;font-size:13px">自动刷新: {{ autoRefresh ? '每30s' : '已暂停' }}</span>
      <el-switch v-model="autoRefresh" style="margin-left:4px" />
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">异常总数</div>
          <div class="stat-value text-primary">{{ total }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">已上报</div>
          <div class="stat-value text-danger">{{ tableData.filter(e => e.handlerStatus === HandlerStatus.REPORTED).length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">处理中</div>
          <div class="stat-value text-warning">{{ tableData.filter(e => e.handlerStatus === HandlerStatus.HANDLING).length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">已解决</div>
          <div class="stat-value text-success">{{ tableData.filter(e => e.handlerStatus === HandlerStatus.RESOLVED).length }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 异常列表 -->
    <el-table
      :data="tableData"
      v-loading="loading"
      border
      stripe
      highlight-current-row
      @row-click="showDetail"
      style="margin-top: 16px"
    >
      <el-table-column label="异常类型" width="110">
        <template #default="{ row }">
          <el-tag :type="exceptionTagType(row.exceptionType)" size="small">
            {{ ExceptionTypeLabels[row.exceptionType] || row.exceptionType }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="工单号" width="180" />
      <el-table-column label="工序号" width="90">
        <template #default="{ row }">
          {{ row.stepNo ? '#' + row.stepNo : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="stepName" label="工序名称" width="120" show-overflow-tooltip />
      <el-table-column prop="exceptionDesc" label="异常描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="处理状态" width="110">
        <template #default="{ row }">
          <el-tag :type="handlerStatusTagType(row.handlerStatus)" size="small">
            {{ HandlerStatusLabels[row.handlerStatus] || row.handlerStatus }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="阻断" width="70">
        <template #default="{ row }">
          <el-tag :type="row.isBlocking ? 'danger' : 'info'" size="small">{{ row.isBlocking ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="handlerName" label="处理人" width="100" />
      <el-table-column label="上报时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            size="small"
            type="warning"
            @click.stop="handleExceptionAction(row)"
            v-if="row.handlerStatus === HandlerStatus.REPORTED" :icon="'Check'">处理</el-button>
          <el-button
            size="small"
            type="success"
            @click.stop="resolveExceptionAction(row)"
            v-if="row.handlerStatus === HandlerStatus.HANDLING || row.handlerStatus === HandlerStatus.REPORTED" :icon="'Check'">解决</el-button>
          <el-button
            size="small"
            type="danger"
            @click.stop="escalateExceptionAction(row)"
            v-if="row.handlerStatus !== HandlerStatus.RESOLVED"
          >升级</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-area">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </div>

    <!-- 异常详情抽屉 -->
    <el-drawer v-model="detailVisible" title="异常详情" size="400px" destroy-on-close>
      <template v-if="detailData">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="异常ID">{{ detailData.id }}</el-descriptions-item>
          <el-descriptions-item label="工单号">{{ detailData.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="工序">
            {{ detailData.stepNo ? '工序#' + detailData.stepNo : '工单级' }}
            <span v-if="detailData.stepName" style="margin-left:8px;color:#909399">({{ detailData.stepName }})</span>
          </el-descriptions-item>
          <el-descriptions-item label="异常类型">
            <el-tag :type="exceptionTagType(detailData.exceptionType)" size="small">
              {{ ExceptionTypeLabels[detailData.exceptionType] || detailData.exceptionType }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="异常描述">{{ detailData.exceptionDesc || '-' }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">
            <el-tag :type="handlerStatusTagType(detailData.handlerStatus)" size="small">
              {{ HandlerStatusLabels[detailData.handlerStatus] || detailData.handlerStatus }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="是否阻断">
            <el-tag :type="detailData.isBlocking ? 'danger' : 'info'" size="small">{{ detailData.isBlocking ? '是' : '否' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="处理人">{{ detailData.handlerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="处理备注">{{ detailData.handleRemark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="上报时间">{{ formatTime(detailData.createTime) }}</el-descriptions-item>
          <el-descriptions-item label="处理时间">{{ formatTime(detailData.handleTime) }}</el-descriptions-item>
        </el-descriptions>

        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center">
          <el-button
            type="warning"
            @click="handleExceptionAction(detailData)"
            v-if="detailData.handlerStatus === HandlerStatus.REPORTED" :icon="'Check'">处理</el-button>
          <el-button
            type="success"
            @click="resolveExceptionAction(detailData)"
            v-if="detailData.handlerStatus === HandlerStatus.HANDLING || detailData.handlerStatus === HandlerStatus.REPORTED" :icon="'Check'">解决</el-button>
          <el-button
            type="danger"
            @click="escalateExceptionAction(detailData)"
            v-if="detailData.handlerStatus !== HandlerStatus.RESOLVED"
          >升级</el-button>
        </div>
      </template>
      <div v-else style="text-align:center;color:#999;padding:40px">加载中...</div>
    </el-drawer>

    <!-- 处理/解决/升级对话框 -->
    <el-dialog v-model="actionDialog.visible" :title="actionDialog.title" width="450px" destroy-on-close>
      <el-form :model="actionDialog.form" label-width="100px" size="default">
        <el-form-item label="处理人" v-if="actionDialog.mode !== 'resolve'">
          <el-input v-model="actionDialog.form.handlerName" placeholder="输入处理人姓名" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="actionDialog.form.remark" type="textarea" :rows="3" :placeholder="actionDialog.mode === 'handle' ? '输入处理备注' : actionDialog.mode === 'resolve' ? '输入解决备注' : '输入升级原因'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="actionSubmitting" @click="confirmAction">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.exception-dashboard-container {
  padding: 16px;
  height: 100%;
}

.filter-area {
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.text-primary { color: #409eff; }
.text-danger { color: #f56c6c; }
.text-warning { color: #e6a23c; }
.text-success { color: #67c23a; }

.pagination-area {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-card) {
  border: 1px solid #e4e7ed;
}
</style>
