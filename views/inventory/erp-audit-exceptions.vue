<script lang="ts" setup>
import type {
  ErpAuditException,
  ErpAuditExceptionDetail,
  ErpAuditExceptionHandlePayload,
  ErpAuditExceptionRecheckResult,
  ErpAuditExceptionStatus,
} from '#/api/inventory';

import { computed, onMounted, reactive, ref } from 'vue';

import { Document, Refresh, Search, Select } from '@element-plus/icons-vue';
import { useAccessStore, useUserStore } from '@vben/stores';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getErpAuditExceptionDetail,
  getErpAuditExceptions,
  handleErpAuditException,
  recheckErpAuditException,
} from '#/api/inventory';

import {
  buildAuditExceptionMetrics,
  canHandleAuditException,
  canRecheckAuditException,
  getAuditExceptionActionOptions,
  getExceptionTypeTone,
  getStatusTone,
} from './erp-audit-exceptions-model';

defineOptions({ name: 'ErpAuditExceptions' });

type StatusFilter = '' | ErpAuditExceptionStatus;

const TEXT = {
  action: '操作',
  afterHash: '变更后',
  all: '全部',
  beforeHash: '变更前',
  bill: 'ERP 单据',
  close: '取消',
  confirmRelease: '释放 WMS 预占后，需要人工确认后续单据或库存处理，是否继续？',
  currentHandler: '当前用户',
  detail: '详情',
  detailTitle: '异常凭证详情',
  dialogTitle: '处理 ERP 异常凭证',
  error: '异常说明',
  exceptionNo: '凭证号',
  formId: '单据类型',
  handled: '已处理',
  handleRemark: '处理备注',
  handleRemarkPlaceholder: '记录处理依据，例如 ERP 已改单或已释放 WMS 预占',
  highRisk: '高风险',
  keyword: '搜单号 / 账套 / 凭证',
  loadDetailFail: '加载异常凭证详情失败',
  loadFail: '加载 ERP 异常凭证失败',
  open: '待处理',
  recheck: '回查 ERP 状态',
  recheckFail: 'ERP 回查失败',
  recheckNoPermission: '缺少 ERP 回查权限',
  releaseTitle: '释放 WMS 预占',
  resolved: '已关闭',
  retry: '刷新',
  status: '状态',
  submit: '确认处理',
  submitFail: '处理 ERP 异常凭证失败',
  submitOk: '已更新异常凭证',
  subtitle: '待处理 ERP 改单、反审、删除与 WMS 预占闭环',
  title: 'ERP 异常凭证',
  total: '全部凭证',
  type: '异常类型',
  wmsTask: 'WMS 任务',
};

const STATUS_LABEL: Record<ErpAuditExceptionStatus, string> = {
  IGNORED: '已忽略',
  OPEN: TEXT.open,
  PROCESSING: '处理中',
  RESOLVED: TEXT.resolved,
};

const TYPE_LABEL: Record<ErpAuditException['exceptionType'], string> = {
  ERP_CHANGED: 'ERP 已改单',
  ERP_DELETED_OR_MISSING: 'ERP 单据缺失',
  ERP_POLL_FAILED: 'ERP 查询失败',
  ERP_POLL_TIMEOUT_PERMANENT: 'ERP 轮询超时',
  ERP_REJECTED: 'ERP 拒绝',
  ERP_REOPENED_OR_UNAUDITED: 'ERP 反审或未审核',
  ERP_TERMINATED: 'ERP 已终止',
  ERP_WRITE_FAILED: 'ERP 写入失败',
};

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: TEXT.open, value: 'OPEN' },
  { label: TEXT.all, value: '' },
  { label: TEXT.resolved, value: 'RESOLVED' },
  { label: '已忽略', value: 'IGNORED' },
];

const userStore = useUserStore();
const accessStore = useAccessStore();
const loading = ref(false);
const submitting = ref(false);
const detailVisible = ref(false);
const detailLoading = ref(false);
const rechecking = ref(false);
const rows = ref<ErpAuditException[]>([]);
const keyword = ref('');
const statusFilter = ref<StatusFilter>('OPEN');
const dialogVisible = ref(false);
const currentRow = ref<ErpAuditException | null>(null);
const detail = ref<ErpAuditExceptionDetail | null>(null);
const recheckResult = ref<ErpAuditExceptionRecheckResult | null>(null);

const handleForm = reactive<ErpAuditExceptionHandlePayload>({
  handleAction: 'IGNORE',
  handleRemark: '',
  handlerId: undefined,
  handlerName: '',
});

const metrics = computed(() => buildAuditExceptionMetrics(rows.value));
const canHandle = computed(() => canHandleAuditException(accessStore.accessCodes || []));
const canRecheck = computed(() => canRecheckAuditException(accessStore.accessCodes || []));
const metricItems = computed(() => [
  { key: 'total', label: TEXT.total, tone: 'primary', value: metrics.value.total },
  { key: 'open', label: TEXT.open, tone: metrics.value.open ? 'danger' : 'stable', value: metrics.value.open },
  { key: 'risk', label: TEXT.highRisk, tone: metrics.value.highRisk ? 'danger' : 'stable', value: metrics.value.highRisk },
  { key: 'resolved', label: TEXT.handled, tone: 'success', value: metrics.value.resolved },
]);

const actionOptions = computed(() => (
  currentRow.value ? getAuditExceptionActionOptions(currentRow.value, accessStore.accessCodes || []) : []
));

const filteredRows = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return rows.value;
  return rows.value.filter((row) => [
    row.exceptionNo,
    row.erpAcctCode,
    row.formId,
    row.billId,
    row.billNo,
    row.wmsTaskNo,
    row.translatedError,
    row.rawError,
  ].some((value) => String(value || '').toLowerCase().includes(query)));
});

async function loadData() {
  loading.value = true;
  try {
    rows.value = await getErpAuditExceptions({
      status: statusFilter.value || undefined,
    });
  } catch (error: any) {
    ElMessage.error(error?.message || TEXT.loadFail);
  } finally {
    loading.value = false;
  }
}

function openHandleDialog(row: ErpAuditException) {
  currentRow.value = row;
  const firstAction = getAuditExceptionActionOptions(row, accessStore.accessCodes || [])[0];
  const userInfo: any = userStore.userInfo || {};
  handleForm.handleAction = firstAction?.value || 'IGNORE';
  handleForm.handleRemark = '';
  handleForm.handlerId = userInfo.id;
  handleForm.handlerName = userInfo.realName || userInfo.nickname || userInfo.username || '';
  dialogVisible.value = true;
}

async function openDetail(row: ErpAuditException) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  recheckResult.value = null;
  try {
    detail.value = await getErpAuditExceptionDetail(row.exceptionNo);
  } catch (error: any) {
    ElMessage.error(error?.message || TEXT.loadDetailFail);
  } finally {
    detailLoading.value = false;
  }
}

async function recheckDetail() {
  if (!detail.value) return;
  if (!canRecheck.value) {
    ElMessage.warning(TEXT.recheckNoPermission);
    return;
  }
  rechecking.value = true;
  try {
    recheckResult.value = await recheckErpAuditException(detail.value.exception.exceptionNo);
  } catch (error: any) {
    ElMessage.error(error?.message || TEXT.recheckFail);
  } finally {
    rechecking.value = false;
  }
}

async function submitHandle() {
  if (!currentRow.value) return;
  if (handleForm.handleAction === 'RELEASE_RESERVATION') {
    await ElMessageBox.confirm(TEXT.confirmRelease, TEXT.releaseTitle, { type: 'warning' });
  }

  submitting.value = true;
  try {
    await handleErpAuditException(currentRow.value.exceptionNo, {
      handleAction: handleForm.handleAction,
      handleRemark: handleForm.handleRemark,
      handlerId: handleForm.handlerId,
      handlerName: handleForm.handlerName || TEXT.currentHandler,
    });
    ElMessage.success(TEXT.submitOk);
    dialogVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || TEXT.submitFail);
  } finally {
    submitting.value = false;
  }
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function formatJson(value?: Record<string, unknown> | string) {
  if (!value) return '-';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function shortHash(hash?: string) {
  return hash ? hash.slice(0, 12) : '-';
}

function statusLabel(status: ErpAuditExceptionStatus) {
  return STATUS_LABEL[status] || status;
}

function typeLabel(type: ErpAuditException['exceptionType']) {
  return TYPE_LABEL[type] || type;
}

onMounted(loadData);
</script>

<template>
  <div class="erp-audit-page">
    <section class="summary-band">
      <div>
        <h2>{{ TEXT.title }}</h2>
        <p>{{ TEXT.subtitle }}</p>
      </div>
      <div class="metric-grid">
        <div v-for="item in metricItems" :key="item.key" class="metric-item" :class="`is-${item.tone}`">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <section class="toolbar-band">
      <el-select v-model="statusFilter" class="status-select" @change="loadData">
        <el-option
          v-for="option in statusOptions"
          :key="option.value || 'ALL'"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-input v-model="keyword" clearable :placeholder="TEXT.keyword">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">{{ TEXT.retry }}</el-button>
    </section>

    <section class="table-band">
      <el-table v-loading="loading" :data="filteredRows" border height="calc(100vh - 310px)">
        <el-table-column fixed min-width="220" prop="exceptionNo" show-overflow-tooltip :label="TEXT.exceptionNo" />
        <el-table-column min-width="116" :label="TEXT.status">
          <template #default="{ row }">
            <el-tag :type="getStatusTone(row.exceptionStatus)">{{ statusLabel(row.exceptionStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column min-width="160" :label="TEXT.type">
          <template #default="{ row }">
            <el-tag effect="plain" :type="getExceptionTypeTone(row.exceptionType)">
              {{ typeLabel(row.exceptionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column min-width="150" :label="TEXT.bill" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="stack-cell">
              <strong>{{ row.billNo || row.billId || '-' }}</strong>
              <span>{{ row.erpAcctCode }} / {{ row.formId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column min-width="220" :label="TEXT.error" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.translatedError || row.createdReason || row.rawError || '-' }}
          </template>
        </el-table-column>
        <el-table-column min-width="160" :label="TEXT.wmsTask" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.wmsTaskNo || row.wmsTaskId || '-' }}
          </template>
        </el-table-column>
        <el-table-column min-width="190" :label="TEXT.beforeHash" show-overflow-tooltip>
          <template #default="{ row }">{{ shortHash(row.beforeSnapshotHash) }}</template>
        </el-table-column>
        <el-table-column min-width="190" :label="TEXT.afterHash" show-overflow-tooltip>
          <template #default="{ row }">{{ shortHash(row.afterSnapshotHash) }}</template>
        </el-table-column>
        <el-table-column min-width="160" :label="TEXT.handled">
          <template #default="{ row }">
            <div class="stack-cell">
              <strong>{{ row.handlerName || '-' }}</strong>
              <span>{{ formatTime(row.handledTime) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column align="center" fixed="right" width="116" :label="TEXT.action">
          <template #default="{ row }">
            <div class="operation-actions">
              <el-tooltip :content="TEXT.detail" placement="top">
                <el-button :aria-label="TEXT.detail" :icon="Document" circle size="small" @click="openDetail(row)" />
              </el-tooltip>
              <el-tooltip v-if="canHandle" :content="TEXT.submit" placement="top">
                <el-button
                  :aria-label="TEXT.submit"
                  :disabled="row.exceptionStatus !== 'OPEN'"
                  :icon="Select"
                  circle
                  size="small"
                  type="primary"
                  @click="openHandleDialog(row)"
                />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" :title="TEXT.dialogTitle" width="560px">
      <div v-if="currentRow" class="dialog-summary">
        <strong>{{ currentRow.exceptionNo }}</strong>
        <span>{{ typeLabel(currentRow.exceptionType) }} / {{ currentRow.billNo || currentRow.billId }}</span>
        <p>{{ currentRow.translatedError || currentRow.createdReason || currentRow.rawError || '-' }}</p>
      </div>
      <el-form label-width="96px">
        <el-form-item :label="TEXT.action">
          <el-select v-model="handleForm.handleAction" class="full-width">
            <el-option
              v-for="option in actionOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="TEXT.currentHandler">
          <el-input v-model="handleForm.handlerName" />
        </el-form-item>
        <el-form-item :label="TEXT.handleRemark">
          <el-input
            v-model="handleForm.handleRemark"
            :placeholder="TEXT.handleRemarkPlaceholder"
            :rows="4"
            type="textarea"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ TEXT.close }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submitHandle">{{ TEXT.submit }}</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="TEXT.detailTitle" size="min(720px, 92vw)">
      <div v-loading="detailLoading" class="detail-drawer">
        <template v-if="detail">
          <section class="detail-section">
            <div class="detail-section-title">异常摘要</div>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="凭证号">{{ detail.exception.exceptionNo }}</el-descriptions-item>
              <el-descriptions-item label="ERP 单据">
                {{ detail.exception.billNo || detail.exception.billId || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="账套 / 类型">
                {{ detail.exception.erpAcctCode }} / {{ detail.exception.formId }}
              </el-descriptions-item>
              <el-descriptions-item label="异常原因">
                {{ detail.exception.translatedError || detail.exception.createdReason || detail.exception.rawError || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="detail-section">
            <div class="detail-section-title">WMS 与镜像</div>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="WMS 状态">{{ detail.wmsDocument?.wmsStatus || '-' }}</el-descriptions-item>
              <el-descriptions-item label="ERP 同步状态">
                {{ detail.wmsDocument?.erpSyncStatus || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="最近同步">
                {{ formatTime(detail.wmsDocument?.lastSyncTime) }}
              </el-descriptions-item>
              <el-descriptions-item label="最近错误">
                {{ detail.wmsDocument?.lastError || '-' }}
              </el-descriptions-item>
            </el-descriptions>
            <pre class="json-block">{{ formatJson(detail.exception.diffJson || detail.wmsDocument?.snapshotJson) }}</pre>
          </section>

          <section class="detail-section">
            <div class="detail-toolbar">
              <div class="detail-section-title">ERP 回查摘要</div>
              <el-button
                v-if="canRecheck"
                :icon="Refresh"
                :loading="rechecking"
                size="small"
                type="primary"
                @click="recheckDetail"
              >
                {{ TEXT.recheck }}
              </el-button>
            </div>
            <el-alert
              v-if="recheckResult?.error"
              :closable="false"
              :title="`${TEXT.recheckFail}：${recheckResult.error}`"
              type="error"
            />
            <div v-else-if="recheckResult" class="recheck-result">
              <span>{{ formatTime(recheckResult.checkedAt) }}</span>
              <pre class="json-block">{{ formatJson(recheckResult.erpStatus) }}</pre>
            </div>
            <el-empty v-else :image-size="64" description="-" />
          </section>

          <section class="detail-section">
            <div class="detail-section-title">处置记录</div>
            <el-timeline v-if="detail.operationLogs.length">
              <el-timeline-item
                v-for="item in detail.operationLogs"
                :key="`${item.operatedTime}-${item.operationAction}`"
                :timestamp="formatTime(item.operatedTime)"
              >
                <strong>{{ item.operatorName || item.operatorId || '-' }}</strong>
                <span>：{{ item.operationAction || '-' }} {{ item.operationRemark || '' }}</span>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else :image-size="64" description="-" />
          </section>
        </template>
        <el-empty v-else-if="!detailLoading" :image-size="80" description="-" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.erp-audit-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.summary-band,
.toolbar-band,
.table-band {
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.summary-band {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(420px, 1.4fr);
  gap: 16px;
  padding: 16px;
}

.summary-band h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 650;
}

.summary-band p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(96px, 1fr));
  gap: 8px;
}

.metric-item {
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.metric-item span {
  display: block;
  margin-bottom: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-item strong {
  font-size: 24px;
  line-height: 1;
}

.metric-item.is-danger {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
}

.metric-item.is-success {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}

.metric-item.is-primary {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.toolbar-band {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
}

.status-select {
  width: 150px;
  flex: 0 0 auto;
}

.table-band {
  padding: 12px;
}

.stack-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.stack-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-cell span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.dialog-summary {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.dialog-summary strong,
.dialog-summary span {
  display: block;
}

.dialog-summary span,
.dialog-summary p {
  color: var(--el-text-color-secondary);
}

.dialog-summary p {
  margin: 8px 0 0;
}

.full-width {
  width: 100%;
}

.detail-drawer {
  min-height: 360px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section-title {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 650;
}

.detail-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.json-block {
  max-height: 220px;
  margin: 10px 0 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-regular);
  font-size: 12px;
  white-space: pre-wrap;
}

.recheck-result > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .summary-band {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .toolbar-band {
    align-items: stretch;
    flex-direction: column;
  }

  .status-select {
    width: 100%;
  }
}
</style>
