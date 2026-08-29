<script lang="ts" setup>
import type { ProductionReportAggregate, ProductionReportAggregateCandidate, ProductionReportAggregateStatus } from '#/api/productionReportAggregate';
import type { ProductionReportTask } from '#/api/productionReportTask';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { cancelProductionReportAggregate, confirmProductionReportAggregates, getProductionReportAggregateCandidates, getProductionReportAggregateDetails, getProductionReportAggregates, retryProductionReportAggregate } from '#/api/productionReportAggregate';
import { getProductionReportTasks } from '#/api/productionReportTask';
import { resolveStatus } from '#/shared/status/statusDictionary';
import { buildProductionReportAggregatesModel, summarizeConfirmResults } from './production-report-aggregates-model';

defineOptions({ name: 'ProductionReportTasks' });
const activeTab = ref('pending');
const loading = ref(false);
const pendingRows = ref<ProductionReportAggregateCandidate[]>([]);
const aggregateRows = ref<ProductionReportAggregate[]>([]);
const historyRows = ref<ProductionReportTask[]>([]);
const selectedRows = ref<ProductionReportAggregateCandidate[]>([]);
const filters = reactive<{ orderNo?: string; status?: ProductionReportAggregateStatus }>({});
const model = computed(() => buildProductionReportAggregatesModel(pendingRows.value));
const details = ref<any[]>([]);
const detailVisible = ref(false);

async function loadPending() { const response: any = await getProductionReportAggregateCandidates({ orderNo: filters.orderNo }); if (!response.success) throw new Error(response.message); pendingRows.value = response.data || []; }
async function loadAggregates() { const response: any = await getProductionReportAggregates(filters); if (!response.success) throw new Error(response.message); aggregateRows.value = response.data || []; }
async function loadHistory() { const response: any = await getProductionReportTasks({ orderNo: filters.orderNo }); if (!response.success) throw new Error(response.message); historyRows.value = response.data || []; }
async function loadData() { loading.value = true; try { await Promise.all([loadPending(), loadAggregates(), loadHistory()]); } catch (error: any) { ElMessage.error(error?.message || '加载生产汇报失败'); } finally { loading.value = false; } }
function selectable(row: ProductionReportAggregateCandidate) { return row.confirmable; }
async function confirmSelected() { if (!selectedRows.value.length) return; await ElMessageBox.confirm(`共 ${selectedRows.value.length} 项，合计报工 ${model.value.totalReportQuantity}`, '批量确认', { type: 'warning' }); loading.value = true; try { const response: any = await confirmProductionReportAggregates(selectedRows.value.map(row => ({ orderId: row.orderId, erpSourceBillId: row.erpSourceBillId, erpSourceEntryId: row.erpSourceEntryId, reportTaskIds: row.reportTaskIds }))); if (!response.success) throw new Error(response.message); const summary = summarizeConfirmResults(response.data || []); ElMessage.info(`成功 ${summary.successCount} 项，失败 ${summary.failureCount} 项`); await loadData(); } catch (error: any) { if (error !== 'cancel') ElMessage.error(error?.message || '批量确认失败'); } finally { loading.value = false; } }
async function openDetails(row: ProductionReportAggregate) { const response: any = await getProductionReportAggregateDetails(row.id); if (!response.success) { ElMessage.error(response.message); return; } details.value = response.data || []; detailVisible.value = true; }
async function retry(row: ProductionReportAggregate) { try { await retryProductionReportAggregate(row.id); ElMessage.success('已发起重试'); await loadData(); } catch (error: any) { ElMessage.error(error?.message || '重试失败'); } }
async function cancel(row: ProductionReportAggregate) { try { await ElMessageBox.confirm('取消后将释放报工占用，是否继续？', '取消聚合单', { type: 'warning' }); await cancelProductionReportAggregate(row.id, '统计员在工作台取消'); ElMessage.success('已取消'); await loadData(); } catch (error: any) { if (error !== 'cancel') ElMessage.error(error?.message || '取消失败'); } }
function statusType(status?: string) { return status === 'INSPECTION_AUDITED' ? 'success' : status?.includes('FAILED') ? 'danger' : status === 'ERP_AUDITED' ? 'warning' : 'info'; }
function aggregateStatusText(status?: string) { return resolveStatus('productionReport', 'aggregateStatus', status); }
function taskStatusText(status?: string) { return resolveStatus('productionReport', 'taskStatus', status); }
onMounted(loadData);
</script>

<template>
  <div v-loading="loading" class="production-report-page">
    <div class="toolbar"><div><h2>生产汇报聚合工作台</h2><span>按工单、ERP 源单 FID 与分录聚合后批量确认</span></div><el-button type="primary" @click="loadData">刷新</el-button></div>
    <div class="filters"><el-input v-model="filters.orderNo" clearable placeholder="工单号" @keyup.enter="loadData" /><el-select v-model="filters.status" clearable placeholder="聚合状态"><el-option v-for="status in ['PUSH_FAILED','ERP_STATUS_PENDING','ERP_AUDITED','INSPECTION_FAILED','INSPECTION_AUDITED']" :key="status" :label="aggregateStatusText(status)" :value="status" /></el-select><el-button @click="loadData">查询</el-button></div>
    <div class="metrics"><div v-for="metric in model.metrics" :key="metric.label"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div></div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="待确认聚合" name="pending"><div class="tab-toolbar"><el-button type="primary" :disabled="!selectedRows.length" @click="confirmSelected">批量确认</el-button></div><el-table :data="pendingRows" border stripe @selection-change="selectedRows = $event"><el-table-column type="selection" width="48" :selectable="selectable" /><el-table-column prop="materialNumber" label="物料编码" min-width="120" /><el-table-column prop="materialName" label="物料名称" min-width="150" /><el-table-column prop="specification" label="规格" min-width="150" /><el-table-column label="来源" min-width="150"><template #default="{ row }">{{ row.orderNo }} / {{ row.erpSourceEntryId || '-' }}</template></el-table-column><el-table-column prop="reportQuantity" label="汇总报工数" width="110" align="right" /><el-table-column label="质量" min-width="180"><template #default="{ row }">合格 {{ row.goodQuantity }} / 不良 {{ row.defectQuantity }} / 报废 {{ row.scrapQuantity }}</template></el-table-column><el-table-column label="状态" width="160"><template #default="{ row }"><el-tag v-if="row.confirmable" type="success">待确认</el-tag><span v-else class="blocked">{{ row.blockedReason }}</span></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="聚合单跟踪" name="tracking"><el-table :data="aggregateRows" border stripe><el-table-column prop="orderNo" label="工单" min-width="130" /><el-table-column prop="materialNumber" label="物料" min-width="130" /><el-table-column prop="reportQuantity" label="汇总报工数" width="110" align="right" /><el-table-column prop="status" label="状态" width="160"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ aggregateStatusText(row.status) }}</el-tag></template></el-table-column><el-table-column prop="erpReportBillNo" label="ERP 汇报单" min-width="130" /><el-table-column prop="erpInspectionBillNo" label="ERP 检验单" min-width="130" /><el-table-column prop="retryCount" label="重试次数" width="90" /><el-table-column prop="lastError" label="ERP 错误" min-width="180" show-overflow-tooltip /><el-table-column label="操作" width="230" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openDetails(row)">查看</el-button><el-button v-if="row.status === 'PUSH_FAILED' || row.status === 'INSPECTION_FAILED'" link type="warning" @click="retry(row)">重试</el-button><el-button v-if="row.status === 'PUSH_FAILED'" link type="danger" @click="cancel(row)">取消</el-button></template></el-table-column></el-table></el-tab-pane>
      <el-tab-pane label="历史报工任务" name="history"><el-table :data="historyRows" border stripe><el-table-column prop="orderNo" label="工单" /><el-table-column prop="reportQuantity" label="报工数" /><el-table-column label="状态"><template #default="{ row }">{{ taskStatusText(row.status) }}</template></el-table-column><el-table-column prop="erpReportBillNo" label="ERP 汇报单" /></el-table></el-tab-pane>
    </el-tabs>
    <el-drawer v-model="detailVisible" title="聚合明细" size="560px"><el-table :data="details" border stripe><el-table-column prop="reportTime" label="报工时间" /><el-table-column prop="operatorName" label="操作人员" /><el-table-column prop="employeeNumber" label="工号" /><el-table-column prop="reportQuantity" label="报工数" /><el-table-column prop="inspectionResult" label="检验结论" /></el-table></el-drawer>
  </div>
</template>

<style scoped>
.production-report-page{min-height:100%;padding:16px;background:var(--el-bg-color-page)}.toolbar,.filters,.metrics,.tab-toolbar{display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:12px;background:var(--el-bg-color);border:1px solid var(--el-border-color-light);border-radius:6px}.toolbar{justify-content:space-between}.toolbar h2{margin:0 0 4px;font-size:18px}.toolbar span{color:var(--el-text-color-secondary);font-size:12px}.filters .el-input{max-width:240px}.filters .el-select{width:180px}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.metrics div{display:flex;flex-direction:column;gap:4px;padding:4px 12px;border-left:3px solid var(--el-color-info)}.metrics strong{font-size:22px}.blocked{color:var(--el-color-danger)}@media(max-width:760px){.metrics{grid-template-columns:1fr 1fr}.filters{flex-wrap:wrap}}
</style>
