<script lang="ts" setup>
import type {
  ProcessStepPrice,
  ProcessWageSettlement,
  ProcessWageSheet,
  ProcessWageSheetDetail,
  ProcessWageSheetLine,
  ProcessWageSheetStatus,
  WageCalcStatus,
} from '#/api/processWage';
import { resolveStatus } from '#/shared/status/statusDictionary';

import { computed, onMounted, ref, watch } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  adjustProcessWageSheet,
  auditWageSettlement,
  recalculateProcessWageSheet,
  confirmProcessWageSheet,
  confirmWageSettlement,
  getPendingWageSettlements,
  getProcessStepPrices,
  getProcessWageSheetDetail,
  getProcessWageSheets,
  pushWageSettlementErp,
  recalculateProcessWage,
  rejectProcessWageSheet,
} from '#/api/processWage';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import {
  buildProcessWageV2Model,
  getProcessWageV2ActionState,
} from './process-wage-v2-model';
import {
  buildProcessWageSheetModel,
  getProcessWageSheetActionState,
} from './process-wage-sheet-model';

defineOptions({ name: 'ProcessWageV2' });

const loading = ref(false);
const actionLoading = ref(false);
const activeTab = ref('workflow');
const statusFilter = ref<'' | WageCalcStatus>('');
const sheetStatusFilter = ref<'' | ProcessWageSheetStatus>('');
const orderFilter = ref('');
const operatorFilter = ref('');
const workflowPage = ref(1);
const pricePage = ref(1);
const sheetPage = ref(1);
const pageSize = ref(20);
const settlements = ref<ProcessWageSettlement[]>([]);
const prices = ref<ProcessStepPrice[]>([]);
const sheets = ref<ProcessWageSheet[]>([]);
const selectedSheetDetail = ref<ProcessWageSheetDetail>();
const sheetDetailLoading = ref(false);
const sheetDetailVisible = ref(false);
const selectedRows = ref<ProcessWageSettlement[]>([]);

const model = computed(() => buildProcessWageV2Model(settlements.value, prices.value));
const sheetModel = computed(() => buildProcessWageSheetModel(sheets.value));
const metrics = computed(() => [
  { label: '待质检工资单', tone: 'info', value: sheetModel.value.summary.waitingQuality },
  { label: '待复核工资单', tone: 'warning', value: sheetModel.value.summary.pendingReview },
  { label: '待处理报工', value: model.value.summary.workflowTotal },
  { label: '可推 ERP', tone: 'warning', value: model.value.summary.canPushErp },
  { label: 'ERP 失败', tone: 'danger', value: model.value.summary.erpFailed },
  { label: '启用单价', tone: 'success', value: model.value.summary.activePriceCount },
  { label: '单价配置', value: model.value.summary.priceCount },
]);
const filteredSettlements = computed(() => settlements.value.filter((row) => {
  const matchStatus = !statusFilter.value || row.calcStatus === statusFilter.value;
  const matchOrder = !orderFilter.value || String(row.orderNo || '').includes(orderFilter.value);
  const matchOperator = !operatorFilter.value || String(row.operatorName || '').includes(operatorFilter.value);
  return matchStatus && matchOrder && matchOperator;
}));
const pagedSettlements = computed(() => paginateV2Rows(filteredSettlements.value, workflowPage.value, pageSize.value));
const pagedPrices = computed(() => paginateV2Rows(prices.value, pricePage.value, pageSize.value));
const filteredSheets = computed(() => sheets.value.filter((sheet) => {
  const matchStatus = !sheetStatusFilter.value || sheet.status === sheetStatusFilter.value;
  const matchOrder = !orderFilter.value || String(sheet.orderNo || '').includes(orderFilter.value);
  return matchStatus && matchOrder;
}));
const pagedSheets = computed(() => paginateV2Rows(filteredSheets.value, sheetPage.value, pageSize.value));
const chains = computed(() => settlements.value
  .filter((row) => row.erpReportBillNo || row.canPushErp || row.calcStatus === 'ERP_FAILED')
  .slice(0, 8)
  .map((row) => ({
    key: row.id,
    primary: row.orderNo || '-',
    secondary: row.erpReportBillNo || row.stepName || '-',
    status: row.calcStatus,
    tone: row.calcStatus === 'ERP_FAILED' ? 'danger' : row.erpReportBillNo ? 'success' : 'warning',
  })));

function statusText(status?: string) {
  return resolveStatus('processWage', 'calcStatus', status);
}

function statusType(status?: string) {
  const map: Record<string, string> = {
    WAIT_QUALITY: 'info',
    PENDING_REVIEW: 'warning',
    REJECTED: 'danger',
    AUDITED: 'warning',
    AUDIT_REJECTED: 'danger',
    CONFIRMED: 'primary',
    CONFIRM_REJECTED: 'danger',
    ERP_FAILED: 'danger',
    ERP_PUSHED: 'success',
    FAILED: 'danger',
    SUBMITTED: 'info',
  };
  return map[status || ''] || 'info';
}

function formatMoney(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function errorText(row: ProcessWageSettlement) {
  return row.rawErpError || row.failureReason || row.rejectReason || '';
}

function formatDate(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function loadData() {
  loading.value = true;
  try {
    const [workflowRes, priceRes, sheetRes]: any[] = await Promise.all([
      getPendingWageSettlements(),
      getProcessStepPrices(),
      getProcessWageSheets(),
    ]);
    if (!workflowRes.success) throw new Error(workflowRes.message || '获取工资审核数据失败');
    if (!priceRes.success) throw new Error(priceRes.message || '获取工序单价失败');
    settlements.value = workflowRes.data || [];
    prices.value = priceRes.data || [];
    if (!sheetRes.success) throw new Error(sheetRes.message || '获取工资单失败');
    sheets.value = sheetRes.data || [];
    selectedRows.value = [];
    workflowPage.value = 1;
    pricePage.value = 1;
    sheetPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取工资核算数据失败');
  } finally {
    loading.value = false;
  }
}

function onSelectionChange(rows: ProcessWageSettlement[]) {
  selectedRows.value = rows;
}

async function runRows(actionName: string, predicate: (row: ProcessWageSettlement) => boolean, action: (row: ProcessWageSettlement) => Promise<any>) {
  const rows = selectedRows.value.filter((row) => filteredSettlements.value.some((item) => item.id === row.id));
  if (!rows.length) {
    ElMessage.warning('请先勾选报工记录');
    return;
  }
  const invalid = rows.filter((row) => !predicate(row));
  if (invalid.length) {
    ElMessage.warning(`${actionName}包含不可操作记录，请先过滤状态`);
    return;
  }
  actionLoading.value = true;
  try {
    for (const row of rows) {
      const res: any = await action(row);
      if (!res?.success) throw new Error(`${row.orderNo || row.id}: ${res?.message || `${actionName}失败`}`);
    }
    ElMessage.success(`${actionName}完成，共处理 ${rows.length} 条`);
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || `${actionName}失败`);
  } finally {
    actionLoading.value = false;
  }
}

function batchConfirm() {
  runRows('确认', (row) => getProcessWageV2ActionState(row).canConfirm, (row) => confirmWageSettlement(row.id));
}

function batchAudit() {
  runRows('审核', (row) => getProcessWageV2ActionState(row).canAudit, (row) => auditWageSettlement(row.id));
}

function batchPushErp() {
  runRows('推 ERP', (row) => getProcessWageV2ActionState(row).canPushErp, (row) => pushWageSettlementErp(row.id));
}

function batchRecalculate() {
  runRows('重算', (row) => getProcessWageV2ActionState(row).canRecalculate, (row) => recalculateProcessWage(row.flowId));
}

function resetFilters() {
  statusFilter.value = '';
  orderFilter.value = '';
  operatorFilter.value = '';
  workflowPage.value = 1;
}

function handleWorkflowSizeChange(size: number) {
  pageSize.value = size;
  workflowPage.value = 1;
}

function handlePriceSizeChange(size: number) {
  pageSize.value = size;
  pricePage.value = 1;
}

function resetSheetFilters() {
  sheetStatusFilter.value = '';
  sheetPage.value = 1;
}

function handleSheetSizeChange(size: number) {
  pageSize.value = size;
  sheetPage.value = 1;
}

async function confirmSheet(sheet: ProcessWageSheet) {
  try {
    await ElMessageBox.confirm(`确认工单 ${sheet.orderNo} 的工资单？`, '确认工资单', { type: 'warning' });
    const response: any = await confirmProcessWageSheet(sheet.id);
    if (!response?.success) throw new Error(response?.message || '确认失败');
    ElMessage.success('工资单已确认');
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '确认失败');
  }
}

async function rejectSheet(sheet: ProcessWageSheet) {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因（可选）', `驳回 ${sheet.orderNo}`, {
      inputPlaceholder: '驳回原因',
      inputValue: sheet.correctionReason || '',
    });
    const response: any = await rejectProcessWageSheet(sheet.id, value || undefined);
    if (!response?.success) throw new Error(response?.message || '驳回失败');
    ElMessage.success('工资单已驳回');
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '驳回失败');
  }
}

async function recalculateSheet(sheet: ProcessWageSheet) {
  try {
    await ElMessageBox.confirm(`重算工单 ${sheet.orderNo} 的工资单？`, '重算工资单', { type: 'warning' });
    const response: any = await recalculateProcessWageSheet(sheet.id);
    if (!response?.success) throw new Error(response?.message || '重算失败');
    ElMessage.success('工资单已重算');
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '重算失败');
  }
}

async function openSheetDetail(sheet: ProcessWageSheet) {
  sheetDetailVisible.value = true;
  sheetDetailLoading.value = true;
  try {
    const response: any = await getProcessWageSheetDetail(sheet.id);
    if (!response?.success) throw new Error(response?.message || '获取工资单明细失败');
    selectedSheetDetail.value = response.data;
  } catch (error: any) {
    sheetDetailVisible.value = false;
    ElMessage.error(error?.message || '获取工资单明细失败');
  } finally {
    sheetDetailLoading.value = false;
  }
}

async function adjustSheetLine(line: ProcessWageSheetLine) {
  const detail = selectedSheetDetail.value;
  if (!detail || detail.sheet.status !== 'PENDING_REVIEW') return;
  try {
    const amountInput = await ElMessageBox.prompt('请输入调整后的最终金额', `调整 ${line.employeeName || line.employeeId || '-'}`, {
      inputPattern: /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/,
      inputErrorMessage: '请输入最多四位小数的非负金额',
      inputValue: String(line.finalAmount ?? line.ruleAmount ?? 0),
    });
    const finalAmount = Number(amountInput.value);
    let reason: string | undefined;
    if (finalAmount !== Number(line.ruleAmount ?? 0)) {
      const reasonInput = await ElMessageBox.prompt('金额与规则金额不同，必须填写调整理由', '调整理由', {
        inputPattern: /\S/,
        inputErrorMessage: '调整理由不能为空',
      });
      reason = reasonInput.value.trim();
    }
    const response: any = await adjustProcessWageSheet(detail.sheet.id, { finalAmount, lineId: line.id, reason });
    if (!response?.success) throw new Error(response?.message || '调整失败');
    ElMessage.success('工资行已调整');
    await Promise.all([loadData(), openSheetDetail(detail.sheet)]);
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '调整失败');
  }
}

watch([statusFilter, orderFilter, operatorFilter], () => {
  workflowPage.value = 1;
});

watch([sheetStatusFilter, orderFilter], () => {
  sheetPage.value = 1;
});

onMounted(loadData);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="ERP 工资单据链"
    description="计件工资从报工到 ERP 推送，支持批量确认与复核。工序缺启用单价时核算会失败，单价配置数单列在指标里。"
    eyebrow="生产 · 工资核算"
    issue-title="工资核算风险"
    :chains="chains"
    :issues="model.issueGroups"
    :metrics="metrics"
    :stages="model.stages"
    title="工资核算"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadData" :icon="'Refresh'">刷新</el-button>
    </template>

    <section class="v2-panel">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="工资流程" name="workflow">
          <div class="toolbar-row">
            <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 150px">
              <el-option label="待统计确认" value="SUBMITTED" />
              <el-option label="待主管审核" value="CONFIRMED" />
              <el-option label="待推 ERP" value="AUDITED" />
              <el-option label="ERP 失败" value="ERP_FAILED" />
              <el-option label="核算失败" value="FAILED" />
            </el-select>
            <el-input v-model="orderFilter" clearable placeholder="工单号" style="width: 160px" />
            <el-input v-model="operatorFilter" clearable placeholder="操作工" style="width: 130px" />
            <el-button @click="resetFilters" :icon="'RefreshRight'">重置</el-button>
            <span class="toolbar-spacer" />
            <el-button type="primary" :loading="actionLoading" @click="batchConfirm" :icon="'Check'">确认</el-button>
            <el-button type="success" :loading="actionLoading" @click="batchAudit" :icon="'Check'">审核</el-button>
            <el-button type="warning" :loading="actionLoading" @click="batchPushErp">推 ERP</el-button>
            <el-button :loading="actionLoading" @click="batchRecalculate">重算</el-button>
          </div>
          <el-table
            :data="pagedSettlements"
            v-loading="loading"
            border
            height="520"
            row-key="id"
            size="small"
            stripe
            @selection-change="onSelectionChange"
          >
            <el-table-column type="selection" width="46" />
            <el-table-column prop="orderNo" label="工单号" width="145" />
            <el-table-column label="工序" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ row.stepNo }}. {{ row.stepName || row.processCode || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tooltip v-if="errorText(row)" :content="errorText(row)" placement="top">
                  <el-tag :type="statusType(row.calcStatus)" size="small">{{ statusText(row.calcStatus) }}</el-tag>
                </el-tooltip>
                <el-tag v-else :type="statusType(row.calcStatus)" size="small">{{ statusText(row.calcStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operatorName" label="操作工" width="110" />
            <el-table-column prop="actualQuantity" label="完成" width="80" align="right" />
            <el-table-column prop="defectQuantity" label="不良" width="80" align="right" />
            <el-table-column label="工资金额" width="110" align="right">
              <template #default="{ row }"><strong>{{ formatMoney(row.wageAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="ERP 范围" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.lastProductionStep ? 'success' : 'info'" size="small">
                  {{ row.lastProductionStep ? '末道' : '内部' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="erpReportBillNo" label="ERP 单据" min-width="160" show-overflow-tooltip />
            <el-table-column label="失败信息" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ errorText(row) || '-' }}</template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="workflowPage"
              :page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="filteredSettlements.length"
              background
              layout="total, sizes, prev, pager, next, jumper"
              size="small"
              @size-change="handleWorkflowSizeChange"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane label="单价覆盖" name="price">
          <el-table :data="pagedPrices" v-loading="loading" border height="520" size="small" stripe>
            <el-table-column label="工序池" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ row.processPoolName || row.processPoolCode || '-' }}</template>
            </el-table-column>
            <el-table-column prop="processCode" label="工序代码" width="130" />
            <el-table-column prop="processName" label="工序名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="workCenterName" label="工作中心" min-width="140" show-overflow-tooltip />
            <el-table-column prop="priceType" label="计价方式" width="100" />
            <el-table-column label="计件单价" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.piecePrice) }}</template>
            </el-table-column>
            <el-table-column label="小时单价" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.hourPrice) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'DISABLED' ? 'info' : 'success'" size="small">
                  {{ row.status === 'DISABLED' ? '停用' : '启用' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="pricePage"
              :page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="prices.length"
              background
              layout="total, sizes, prev, pager, next, jumper"
              size="small"
              @size-change="handlePriceSizeChange"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane label="工资单" name="sheets">
          <div class="toolbar-row">
            <el-select v-model="sheetStatusFilter" clearable placeholder="状态" style="width: 150px">
              <el-option label="待质检" value="WAIT_QUALITY" />
              <el-option label="待复核" value="PENDING_REVIEW" />
              <el-option label="已确认" value="CONFIRMED" />
              <el-option label="已驳回" value="REJECTED" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
            <el-input v-model="orderFilter" clearable placeholder="工单号" style="width: 160px" />
            <el-button @click="resetSheetFilters" :icon="'RefreshRight'">重置</el-button>
          </div>
          <el-table :data="pagedSheets" v-loading="loading" border height="520" row-key="id" size="small" stripe>
            <el-table-column prop="orderNo" label="工单号" width="145" />
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="formulaMode" label="算法" width="140" />
            <el-table-column prop="goodQuantity" label="合格" width="90" align="right" />
            <el-table-column prop="defectQuantity" label="不良" width="90" align="right" />
            <el-table-column prop="scrapQuantity" label="报废" width="90" align="right" />
            <el-table-column label="原始金额" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.originalAmount) }}</template>
            </el-table-column>
            <el-table-column label="规则金额" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.calculatedAmount) }}</template>
            </el-table-column>
            <el-table-column label="冻结金额" width="120" align="right">
              <template #default="{ row }"><strong>{{ formatMoney(row.finalAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="确认时间" width="170">
              <template #default="{ row }">{{ formatDate(row.confirmedTime) }}</template>
            </el-table-column>
            <el-table-column prop="correctionReason" label="驳回原因" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link size="small" @click="openSheetDetail(row)">明细</el-button>
                <el-button
                  v-if="getProcessWageSheetActionState(row).canRecalculate"
                  link
                  size="small"
                  @click="recalculateSheet(row)"
                >重算</el-button>
                <el-button
                  v-if="getProcessWageSheetActionState(row).canConfirm"
                  link
                  size="small"
                  type="primary"
                  @click="confirmSheet(row)"
                >确认</el-button>
                <el-button
                  v-if="getProcessWageSheetActionState(row).canReject"
                  link
                  size="small"
                  type="danger"
                  @click="rejectSheet(row)"
                >驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="sheetPage"
              :page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="filteredSheets.length"
              background
              layout="total, sizes, prev, pager, next, jumper"
              size="small"
              @size-change="handleSheetSizeChange"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
    <el-drawer v-model="sheetDetailVisible" :title="`工资单明细 ${selectedSheetDetail?.sheet.orderNo || ''}`" size="760px">
      <el-table :data="selectedSheetDetail?.lines || []" v-loading="sheetDetailLoading" border size="small" stripe>
        <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip />
        <el-table-column label="原始金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.originalAmount) }}</template>
        </el-table-column>
        <el-table-column label="规则金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.calculatedAmount ?? row.ruleAmount) }}</template>
        </el-table-column>
        <el-table-column label="最终金额" width="110" align="right">
          <template #default="{ row }"><strong>{{ formatMoney(row.finalAmount) }}</strong></template>
        </el-table-column>
        <el-table-column prop="adjustmentReason" label="调整理由" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="selectedSheetDetail?.sheet.status === 'PENDING_REVIEW'"
              link
              size="small"
              type="primary"
              @click="adjustSheetLine(row)"
            >调整</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </V2DiagnosticsShell>
</template>

<style scoped>
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.toolbar-spacer {
  flex: 1;
  min-width: 12px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}
</style>
