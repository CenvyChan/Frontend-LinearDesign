<script lang="ts" setup>
import type { ErpWarehouse } from '#/api/erpData';
import type {
  WmsInventoryBalance,
  WmsInventoryTransaction,
  WmsReconcileLine,
  WmsReconcileQuery,
  WmsReconcileRun,
  WmsReconcileStatus,
  WmsReconcileTrace,
} from '#/api/wms';

import type { WmsAdjustFormState, WmsMoveFormState } from './wms-reconcile-model';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Download, Edit, Refresh, Search, Sort, Tickets, Upload, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import { getOrganizationById, getOrganizations, getWarehouses } from '#/api/erpData';
import {
  adjustWmsInventoryFromErp,
  exportWmsReconcileExcel,
  getWmsReconcileTrace,
  moveWmsInventory,
  queryWmsWarehouseReconcile,
  syncWmsInventoryFromErp,
} from '#/api/wms';
import { downloadBlob } from '#/utils/download';
import { useErpAcctStore } from '#/store';
import { resolveStatus } from '#/shared/status/statusDictionary';

import {
  buildWmsAdjustPayloadFromLine,
  buildWmsInventorySyncPayloadFromLine,
  buildWmsReconcileQueryPayload,
  buildWmsMovePayloadFromLine,
  getWmsReconcileRowActions,
  WMS_MANUAL_SYNC_ACTIONS,
} from './wms-reconcile-model';

defineOptions({ name: 'WmsReconcile' });

const erpAcctStore = useErpAcctStore();

const router = useRouter();
const loading = ref(false);
const exportLoading = ref(false);
const traceLoading = ref(false);
const drawerVisible = ref(false);
const moveDialogVisible = ref(false);
const moveSubmitting = ref(false);
const adjustDialogVisible = ref(false);
const adjustSubmitting = ref(false);
const currentAdjustLine = ref<WmsReconcileLine | null>(null);
const syncLoadingId = ref<number | null>(null);
const warehouseLoading = ref(false);
const warehouses = ref<ErpWarehouse[]>([]);
const run = ref<WmsReconcileRun | null>(null);
const currentLine = ref<WmsReconcileLine | null>(null);
const currentMoveLine = ref<WmsReconcileLine | null>(null);
const trace = ref<WmsReconcileTrace | null>(null);

const queryForm = reactive<WmsReconcileQuery>({
  erpAcctCode: '',
  erpOrgNumber: '',
  forceRefreshErp: false,
  keeperNumber: '',
  lotNo: '',
  materialCode: '',
  ownerNumber: '',
  showAll: false,
  stockNumber: '',
  stockStatusNumber: '',
});

queryForm.erpAcctCode = erpAcctStore.acctCode || '';

const moveForm = reactive<WmsMoveFormState>({
  qty: 0,
  remark: '',
  toLocationCode: '',
  toLocationName: '',
});

const adjustForm = reactive<WmsAdjustFormState>({
  reason: '',
});

const lines = computed(() => run.value?.lines || []);
const displayLines = computed(() => (
  queryForm.showAll ? lines.value : lines.value.filter((line) => line.reconcileStatus !== 'MATCHED')
));

const metrics = computed(() => {
  const data = run.value;
  const unallocatedQty = lines.value.reduce((total, line) => total + Number(line.wmsUnallocatedQty || 0), 0);
  return [
    { key: 'diff', label: '差异行', tone: data?.diffLines ? 'danger' : 'success', value: data?.diffLines || 0 },
    { key: 'erp', label: 'ERP多', tone: data?.erpOnlyLines ? 'warning' : 'stable', value: data?.erpOnlyLines || 0 },
    { key: 'wms', label: 'WMS多', tone: data?.wmsOnlyLines ? 'danger' : 'stable', value: data?.wmsOnlyLines || 0 },
    { key: 'unallocated', label: '未分配量', tone: unallocatedQty ? 'primary' : 'stable', value: formatNumber(unallocatedQty) },
    { key: 'recent', label: '24小时风险', tone: data?.recentMovementRiskLines ? 'warning' : 'stable', value: data?.recentMovementRiskLines || 0 },
  ];
});

const selectedWarehouseName = computed(() => {
  const option = warehouses.value.find((item) => item.warehouseNumber === queryForm.stockNumber);
  return option?.warehouseName || '';
});

const detailTitle = computed(() => {
  if (!currentLine.value) return '差异追踪';
  return `${currentLine.value.materialCode || '-'} / ${currentLine.value.lotNo || '无批次'}`;
});

async function initFilters() {
  await loadOrg();
  await loadWarehouses();
}

async function loadOrg() {
  const savedOrgId = localStorage.getItem('mes_current_org_id');
  if (savedOrgId) {
    try {
      const resp = await getOrganizationById(savedOrgId);
      if (resp.success && resp.data) {
        queryForm.erpOrgNumber = resp.data.erpOrgNumber || resp.data.erpOrgId;
        return;
      }
    } catch {
      // Fallback below.
    }
  }

  const resp = await getOrganizations();
  const org = resp.defaultOrg || resp.data?.[0];
  if (org) {
    queryForm.erpOrgNumber = org.erpOrgNumber || org.erpOrgId;
    localStorage.setItem('mes_current_org_id', org.erpOrgId);
  }
}

async function loadWarehouses() {
  warehouseLoading.value = true;
  try {
    const resp: any = await getWarehouses();
    warehouses.value = Array.isArray(resp) ? resp : (resp?.data || []);
  } catch {
    warehouses.value = [];
  } finally {
    warehouseLoading.value = false;
  }
}

async function handleQuery() {
  if (!queryForm.erpOrgNumber) {
    ElMessage.warning('请选择ERP组织');
    return;
  }
  if (!queryForm.stockNumber) {
    ElMessage.warning('请选择仓库');
    return;
  }
  loading.value = true;
  try {
    const resp = await queryWmsWarehouseReconcile(
      buildWmsReconcileQueryPayload(queryForm, erpAcctStore.acctCode || ''),
    );
    if (!resp.success) throw new Error(resp.message || '定仓差异查询失败');
    run.value = resp.data;
    ElMessage.success(resp.message || '对账完成');
  } catch (error: any) {
    ElMessage.error(error.message || '定仓差异查询失败');
  } finally {
    loading.value = false;
  }
}

async function handleRefreshErpSnapshot() {
  queryForm.forceRefreshErp = true;
  await handleQuery();
}

async function handleExport() {
  if (!queryForm.erpOrgNumber || !queryForm.stockNumber) {
    ElMessage.warning('请先选择ERP组织和仓库');
    return;
  }
  exportLoading.value = true;
  try {
    const blob = await exportWmsReconcileExcel(
      buildWmsReconcileQueryPayload(queryForm, erpAcctStore.acctCode || ''),
    );
    downloadBlob(blob, '定仓差异导出.xlsx');
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败');
  } finally {
    exportLoading.value = false;
  }
}

async function openTrace(row: WmsReconcileLine) {
  currentLine.value = row;
  trace.value = null;
  drawerVisible.value = true;
  traceLoading.value = true;
  try {
    const resp = await getWmsReconcileTrace(row.id);
    if (!resp.success) throw new Error(resp.message || '获取追踪失败');
    trace.value = resp.data;
  } catch (error: any) {
    ElMessage.error(error.message || '获取追踪失败');
  } finally {
    traceLoading.value = false;
  }
}

function resetQuery() {
  queryForm.keeperNumber = '';
  queryForm.materialCode = '';
  queryForm.lotNo = '';
  queryForm.ownerNumber = '';
  queryForm.stockStatusNumber = '';
  queryForm.forceRefreshErp = false;
  queryForm.showAll = false;
}

function jumpInventoryQuery() {
  router.push('/inventory/query');
}

async function handleSyncFromErp(row: WmsReconcileLine) {
  syncLoadingId.value = row.id;
  try {
    const resp = await syncWmsInventoryFromErp(
      buildWmsInventorySyncPayloadFromLine(row, queryForm.erpAcctCode || erpAcctStore.acctCode || ''),
    );
    if (!resp.success) throw new Error(resp.message || '同步到未分配失败');
    ElMessage.success(`已拉取 ${resp.data?.createdLines ?? 0} 行到WMS未分配库位`);
    await handleQuery();
  } catch (error: any) {
    ElMessage.error(error.message || '同步到未分配失败');
  } finally {
    syncLoadingId.value = null;
  }
}

function openMoveDialog(row: WmsReconcileLine) {
  currentMoveLine.value = row;
  moveForm.qty = Number(row.wmsUnallocatedQty || 0);
  moveForm.toLocationCode = '';
  moveForm.toLocationName = '';
  moveForm.remark = '定仓差异未分配上架';
  moveDialogVisible.value = true;
}

async function submitMove() {
  if (!currentMoveLine.value) return;
  moveSubmitting.value = true;
  try {
    const resp = await moveWmsInventory(buildWmsMovePayloadFromLine(currentMoveLine.value, moveForm));
    if (!resp.success) throw new Error(resp.message || '上架/移库失败');
    ElMessage.success('未分配库存已上架');
    moveDialogVisible.value = false;
    await handleQuery();
  } catch (error: any) {
    ElMessage.error(error.message || '上架/移库失败');
  } finally {
    moveSubmitting.value = false;
  }
}

function openAdjustDialog(row: WmsReconcileLine) {
  currentAdjustLine.value = row;
  adjustForm.reason = '';
  adjustDialogVisible.value = true;
}

async function submitAdjust() {
  if (!currentAdjustLine.value) return;
  if (!adjustForm.reason.trim()) {
    ElMessage.warning('调整原因不能为空');
    return;
  }
  adjustSubmitting.value = true;
  try {
    const resp = await adjustWmsInventoryFromErp(
      buildWmsAdjustPayloadFromLine(
        currentAdjustLine.value,
        adjustForm,
        queryForm.erpAcctCode || erpAcctStore.acctCode || '',
        run.value?.id,
      ),
    );
    if (!resp.success) throw new Error(resp.message || '覆盖同步失败');
    if (resp.data?.adjusted === false) {
      ElMessage.info(resp.data?.message || 'ERP与WMS数量已一致，无需调整');
    } else {
      ElMessage.success(`已将WMS数量覆盖为ERP当前值 ${resp.data?.newWmsQty ?? '-'}`);
    }
    adjustDialogVisible.value = false;
    await handleQuery();
  } catch (error: any) {
    ElMessage.error(error.message || '覆盖同步失败');
  } finally {
    adjustSubmitting.value = false;
  }
}

function statusLabel(status?: WmsReconcileStatus) {
  return status ? resolveStatus('wms', 'reconcileStatus', status) : '未知状态';
}

function statusType(status?: WmsReconcileStatus) {
  const map: Record<WmsReconcileStatus, string> = {
    ERP_ONLY: 'warning',
    MATCHED: 'success',
    QTY_DIFF: 'danger',
    RECENT_MOVEMENT_RISK: 'warning',
    UNALLOCATED_ONLY: 'primary',
    WMS_ONLY: 'danger',
  };
  return status ? map[status] : 'info';
}

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

function erpField(row: Record<string, any>, key: string) {
  return row?.[key] ?? '-';
}

function locationText(row: WmsInventoryBalance) {
  return [row.locationCode, row.locationName].filter(Boolean).join(' / ') || '-';
}

function movementText(row: WmsInventoryTransaction) {
  return [row.fromLocationCode || '-', row.toLocationCode || '-'].join(' -> ');
}

onMounted(initFilters);
</script>

<template>
  <div class="wms-reconcile-page">
    <section class="reconcile-header">
      <div>
        <p class="eyebrow">WMS Reconcile</p>
        <h1>定仓差异</h1>
        <p class="header-subtitle">
          {{ queryForm.erpOrgNumber || '-' }} / {{ queryForm.stockNumber || '-' }} {{ selectedWarehouseName }}
        </p>
      </div>
      <div class="header-actions">
        <el-switch
          v-model="queryForm.showAll"
          active-text="显示全部"
          inactive-text="只看异常"
        />
        <el-button :icon="Tickets" @click="jumpInventoryQuery">库存查询</el-button>
        <el-button :icon="Download" :loading="exportLoading" @click="handleExport">导出</el-button>
        <el-button :icon="Refresh" :loading="loading" type="primary" @click="handleQuery">刷新对账</el-button>
      </div>
    </section>

    <section class="filter-band">
      <el-form :model="queryForm" label-width="82px">
        <div class="filter-grid">
          <el-form-item label="账套">
            <el-select v-model="queryForm.erpAcctCode" clearable placeholder="账套">
              <el-option :label="erpAcctStore.acctCode || '请选择账套'" :value="erpAcctStore.acctCode || ''" />
            </el-select>
          </el-form-item>
          <el-form-item label="ERP组织">
            <el-input v-model="queryForm.erpOrgNumber" placeholder="组织编码" />
          </el-form-item>
          <el-form-item label="仓库">
            <el-select
              v-model="queryForm.stockNumber"
              clearable
              filterable
              :loading="warehouseLoading"
              placeholder="选择仓库"
            >
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.warehouseNumber"
                :label="`${warehouse.warehouseNumber} - ${warehouse.warehouseName}`"
                :value="warehouse.warehouseNumber"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="物料">
            <el-input v-model="queryForm.materialCode" clearable placeholder="物料编码" />
          </el-form-item>
          <el-form-item label="批次">
            <el-input v-model="queryForm.lotNo" clearable placeholder="批次号" />
          </el-form-item>
          <el-form-item label="状态">
            <el-input v-model="queryForm.stockStatusNumber" clearable placeholder="库存状态编码" />
          </el-form-item>
          <el-form-item label="货主">
            <el-input v-model="queryForm.ownerNumber" clearable placeholder="货主编码" />
          </el-form-item>
          <el-form-item label="保管者">
            <el-input v-model="queryForm.keeperNumber" clearable placeholder="保管者编码" />
          </el-form-item>
          <el-form-item label="强刷ERP">
            <el-switch v-model="queryForm.forceRefreshErp" />
          </el-form-item>
        </div>
        <div class="filter-actions">
          <el-button :icon="Search" :loading="loading" type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="resetQuery">重置条件</el-button>
        </div>
      </el-form>
    </section>

    <section class="metric-grid">
      <div v-for="item in metrics" :key="item.key" class="metric-item" :class="`metric-item--${item.tone}`">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="manual-sync-band">
      <div
        v-for="action in WMS_MANUAL_SYNC_ACTIONS"
        :key="action.key"
        class="manual-sync-item"
      >
        <div>
          <strong>{{ action.title }}</strong>
          <span>{{ action.description }}</span>
        </div>
        <el-button
          v-if="action.key === 'REFRESH_ERP_SNAPSHOT'"
          :icon="Refresh"
          :loading="loading"
          @click="handleRefreshErpSnapshot"
        >
          刷新快照
        </el-button>
        <el-tag v-else type="warning">按差异行执行</el-tag>
      </div>
    </section>

    <section class="table-panel">
      <div class="table-toolbar">
        <div>
          <strong>差异明细</strong>
          <span>共 {{ displayLines.length }} 行 / 批次 {{ run?.id || '-' }}</span>
        </div>
        <span>ERP 数量与 WMS 库位汇总按固定维度对齐</span>
      </div>

      <el-table
        v-loading="loading"
        border
        :data="displayLines"
        empty-text="暂无差异数据"
        height="560"
        row-key="id"
      >
        <el-table-column fixed label="状态" min-width="126">
          <template #default="{ row }">
            <el-tag :type="statusType(row.reconcileStatus)">
              {{ statusLabel(row.reconcileStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="物料" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="material-cell">
              <strong>{{ row.materialCode || '-' }}</strong>
              <span>{{ row.materialName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="规格" min-width="160" prop="materialSpecification" show-overflow-tooltip />
        <el-table-column label="批次" min-width="130" prop="lotNo" show-overflow-tooltip />
        <el-table-column label="库存状态" min-width="128" prop="stockStatusNumber" />
        <el-table-column align="right" label="ERP" min-width="110">
          <template #default="{ row }">{{ formatNumber(row.erpQty) }}</template>
        </el-table-column>
        <el-table-column align="right" label="WMS" min-width="110">
          <template #default="{ row }">{{ formatNumber(row.wmsQty) }}</template>
        </el-table-column>
        <el-table-column align="right" label="差异" min-width="110">
          <template #default="{ row }">
            <span :class="{ danger: Number(row.diffQty || 0) !== 0 }">{{ formatNumber(row.diffQty) }}</span>
          </template>
        </el-table-column>
        <el-table-column align="right" label="未分配" min-width="110">
          <template #default="{ row }">{{ formatNumber(row.wmsUnallocatedQty) }}</template>
        </el-table-column>
        <el-table-column align="right" label="锁定" min-width="100">
          <template #default="{ row }">{{ formatNumber(row.wmsLockedQty) }}</template>
        </el-table-column>
        <el-table-column label="主要库位" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.mainLocationCode || '-' }}</template>
        </el-table-column>
        <el-table-column label="最近流水" min-width="170">
          <template #default="{ row }">{{ formatTime(row.recentTransactionTime) }}</template>
        </el-table-column>
        <el-table-column label="处置建议" min-width="190" prop="suggestion" show-overflow-tooltip />
        <el-table-column align="center" fixed="right" label="操作" width="230">
          <template #default="{ row }">
            <el-button :icon="View" link type="primary" @click="openTrace(row)">追踪</el-button>
            <el-button
              v-if="getWmsReconcileRowActions(row).canSyncFromErp"
              :icon="Upload"
              :loading="syncLoadingId === row.id"
              link
              type="warning"
              @click="handleSyncFromErp(row)"
            >
              拉取到WMS
            </el-button>
            <el-button
              v-if="getWmsReconcileRowActions(row).canMoveUnallocated"
              :icon="Sort"
              link
              type="success"
              @click="openMoveDialog(row)"
            >
              上架
            </el-button>
            <el-button
              v-if="getWmsReconcileRowActions(row).canAdjustFromErp"
              :icon="Edit"
              link
              type="danger"
              @click="openAdjustDialog(row)"
            >
              覆盖同步
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerVisible" :title="detailTitle" size="72%">
      <div v-loading="traceLoading" class="trace-drawer">
        <div v-if="currentLine" class="trace-summary">
          <el-tag :type="statusType(currentLine.reconcileStatus)">
            {{ statusLabel(currentLine.reconcileStatus) }}
          </el-tag>
          <span>ERP {{ formatNumber(currentLine.erpQty) }}</span>
          <span>WMS {{ formatNumber(currentLine.wmsQty) }}</span>
          <span>差异 {{ formatNumber(currentLine.diffQty) }}</span>
          <strong>{{ currentLine.suggestion }}</strong>
        </div>

        <el-tabs>
          <el-tab-pane label="ERP明细">
            <el-table border :data="trace?.erpRows || []" height="360">
              <el-table-column label="物料" min-width="160">
                <template #default="{ row }">{{ erpField(row, 'fmaterialNumber') }}</template>
              </el-table-column>
              <el-table-column label="名称" min-width="180">
                <template #default="{ row }">{{ erpField(row, 'fmaterialName') }}</template>
              </el-table-column>
              <el-table-column label="批次" min-width="130">
                <template #default="{ row }">{{ erpField(row, 'flotNumber') }}</template>
              </el-table-column>
              <el-table-column label="库存状态" min-width="120">
                <template #default="{ row }">{{ erpField(row, 'fstockStatusNumber') }}</template>
              </el-table-column>
              <el-table-column align="right" label="数量" min-width="110">
                <template #default="{ row }">{{ formatNumber(erpField(row, 'fqty')) }}</template>
              </el-table-column>
              <el-table-column label="单位" min-width="90">
                <template #default="{ row }">{{ erpField(row, 'fbaseUnitName') }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="WMS库位">
            <el-table border :data="trace?.wmsBalances || []" height="360">
              <el-table-column label="库位" min-width="180">
                <template #default="{ row }">{{ locationText(row) }}</template>
              </el-table-column>
              <el-table-column label="容器" min-width="130" prop="containerCode" />
              <el-table-column label="条码" min-width="160" prop="barcode" show-overflow-tooltip />
              <el-table-column align="right" label="数量" min-width="110">
                <template #default="{ row }">{{ formatNumber(row.qty) }}</template>
              </el-table-column>
              <el-table-column align="right" label="锁定" min-width="110">
                <template #default="{ row }">{{ formatNumber(row.lockedQty) }}</template>
              </el-table-column>
              <el-table-column label="更新时间" min-width="170">
                <template #default="{ row }">{{ formatTime(row.lastTransactionTime) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="最近流水">
            <el-table border :data="trace?.transactions || []" height="360">
              <el-table-column label="类型" min-width="120" prop="transactionType" />
              <el-table-column label="库位变化" min-width="180">
                <template #default="{ row }">{{ movementText(row) }}</template>
              </el-table-column>
              <el-table-column align="right" label="数量" min-width="110">
                <template #default="{ row }">{{ formatNumber(row.qty) }}</template>
              </el-table-column>
              <el-table-column label="业务来源" min-width="140" prop="businessSource" />
              <el-table-column label="单据号" min-width="140" prop="businessBillNo" />
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatTime(row.occurredTime) }}</template>
              </el-table-column>
              <el-table-column label="备注" min-width="220" prop="remark" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="关联任务">
            <el-table border :data="trace?.relatedTasks || []" height="360">
              <el-table-column label="来源" min-width="140" prop="source" />
              <el-table-column label="单据ID" min-width="120" prop="billId" />
              <el-table-column label="单据号" min-width="160" prop="billNo" />
              <el-table-column label="流水类型" min-width="130" prop="transactionType" />
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatTime(row.time) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="moveDialogVisible" title="未分配库存上架" width="560px">
      <el-form :model="moveForm" label-width="108px">
        <el-form-item label="物料">
          <el-input :model-value="currentMoveLine?.materialCode || '-'" disabled />
        </el-form-item>
        <el-form-item label="来源库位">
          <el-input model-value="UNALLOCATED / 未分配库位" disabled />
        </el-form-item>
        <el-form-item label="目标库位">
          <el-input v-model="moveForm.toLocationCode" placeholder="扫描或录入库位编码" />
        </el-form-item>
        <el-form-item label="库位名称">
          <el-input v-model="moveForm.toLocationName" placeholder="可选" />
        </el-form-item>
        <el-form-item label="上架数量">
          <el-input-number v-model="moveForm.qty" :min="0" class="full-control" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="moveForm.remark" :rows="2" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="moveDialogVisible = false">取消</el-button>
        <el-button :loading="moveSubmitting" type="primary" @click="submitMove">确认上架</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustDialogVisible" title="覆盖同步（按行修正差异）" width="560px">
      <el-alert
        title="将 WMS 数量直接改成 ERP 当前值，不经过任何出入库单据。仅适用于该维度只落在单一库位的情况；存在锁定量（预留/处理中任务）时会被后端拒绝。"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom:14px"
      />
      <el-form :model="adjustForm" label-width="108px">
        <el-form-item label="物料">
          <el-input :model-value="currentAdjustLine?.materialCode || '-'" disabled />
        </el-form-item>
        <el-form-item label="批次/状态">
          <el-input :model-value="`${currentAdjustLine?.lotNo || '无批次'} / ${currentAdjustLine?.stockStatusNumber || '-'}`" disabled />
        </el-form-item>
        <el-form-item label="ERP数量">
          <el-input :model-value="formatNumber(currentAdjustLine?.erpQty)" disabled />
        </el-form-item>
        <el-form-item label="WMS当前">
          <el-input :model-value="formatNumber(currentAdjustLine?.wmsQty)" disabled />
        </el-form-item>
        <el-form-item label="调整原因" required>
          <el-input v-model="adjustForm.reason" :rows="2" type="textarea" placeholder="必填：说明为何需要覆盖同步，便于账务追溯" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button :loading="adjustSubmitting" type="primary" @click="submitAdjust">确认覆盖同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wms-reconcile-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 16px;
  background: #f6f7fb;
}

.reconcile-header,
.filter-band,
.table-panel {
  border: 1px solid #d9e0ea;
  border-radius: 8px;
  background: #ffffff;
}

.reconcile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
}

.header-subtitle {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.header-actions,
.filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.filter-band {
  padding: 16px 16px 12px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 2px 14px;
}

.filter-grid :deep(.el-form-item) {
  margin-bottom: 12px;
}

.filter-actions {
  padding-left: 82px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  border: 1px solid #d9e0ea;
  border-left: 4px solid #94a3b8;
  border-radius: 8px;
  padding: 12px 14px;
  background: #ffffff;
}

.metric-item span {
  color: #64748b;
  font-size: 13px;
}

.metric-item strong {
  color: #111827;
  font-size: 24px;
  font-weight: 700;
}

.metric-item--danger {
  border-left-color: #dc2626;
}

.metric-item--warning {
  border-left-color: #d97706;
}

.metric-item--primary {
  border-left-color: #2563eb;
}

.metric-item--success {
  border-left-color: #16a34a;
}

.metric-item--stable {
  border-left-color: #64748b;
}

.manual-sync-band {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 12px;
}

.manual-sync-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  border: 1px solid #d9e0ea;
  border-radius: 8px;
  padding: 12px 14px;
  background: #ffffff;
}

.manual-sync-item div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.manual-sync-item strong {
  color: #111827;
  font-size: 15px;
}

.manual-sync-item span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.table-panel {
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  color: #64748b;
  font-size: 13px;
}

.table-toolbar div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-toolbar strong {
  color: #111827;
  font-size: 15px;
}

.material-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

.material-cell strong {
  color: #111827;
}

.material-cell span {
  color: #64748b;
  font-size: 12px;
}

.danger {
  color: #dc2626;
  font-weight: 700;
}

.trace-drawer {
  min-height: 420px;
}

.trace-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 0 16px;
  color: #374151;
}

.trace-summary strong {
  color: #111827;
}

.full-control {
  width: 100%;
}

@media (max-width: 1180px) {
  .reconcile-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .filter-grid,
  .metric-grid,
  .manual-sync-band {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 720px) {
  .filter-grid,
  .metric-grid,
  .manual-sync-band {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    padding-left: 0;
  }
}
</style>
