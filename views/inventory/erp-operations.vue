<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getErpOperationEvents, getErpOperationsHealth, retryErpOperationEvents, type ErpOperationEvent, type ErpOperationsHealth } from '#/api/erpOperations';
import { useErpAcctStore } from '#/store';

defineOptions({ name: 'ErpOperations' });
const acctStore = useErpAcctStore();
const loading = ref(false);
const health = ref<ErpOperationsHealth>();
const events = ref<ErpOperationEvent[]>([]);
const selected = ref<ErpOperationEvent[]>([]);
const acctCode = ref(acctStore.acctCode || '');
const failedEvents = computed(() => events.value.filter(item => item.eventStatus === 'FAILED'));

async function load() {
  loading.value = true;
  try {
    [health.value, events.value] = await Promise.all([getErpOperationsHealth(), getErpOperationEvents(acctCode.value || undefined)]);
  } catch (error: any) {
    ElMessage.error(error?.message || '加载 ERP/WMS 运维数据失败');
  } finally { loading.value = false; }
}
async function retry(row?: ErpOperationEvent) {
  const rows = row ? [row] : selected.value.filter(item => item.eventStatus === 'FAILED');
  if (!rows.length || !acctCode.value) return ElMessage.warning('请选择失败事件并确认 ERP 账套');
  await ElMessageBox.confirm(`将重试 ${rows.length} 条失败事件。服务端会再次校验账套、重试上限与幂等状态。`, '受控重试', { type: 'warning' });
  await retryErpOperationEvents(acctCode.value, rows.map(item => item.eventId));
  ElMessage.success('重试请求已提交');
  await load();
}
onMounted(load);
</script>

<template>
  <div class="erp-operations-page">
    <section class="header"><div><h2>ERP/WMS 运维台</h2><p>查看事件、Saga 与异常积压，所有重试均由服务端控制。</p></div><el-button :icon="Refresh" :loading="loading" type="primary" @click="load">刷新</el-button></section>
    <section class="metrics"><div v-for="item in [
      ['失败事件', health?.failedEventCount], ['重试积压', health?.retryBacklogCount], ['Saga 死信', health?.dlqCount], ['待处理凭证', health?.openExceptionCount], ['ERP 不可达', health?.erpUnavailableCount]
    ]" :key="item[0]" class="metric"><span>{{ item[0] }}</span><strong>{{ item[1] ?? '-' }}</strong></div></section>
    <section class="toolbar"><el-input v-model="acctCode" placeholder="ERP 账套" clearable /><el-button :icon="Refresh" :disabled="!failedEvents.length" type="warning" @click="retry()">重试已选失败事件</el-button></section>
    <el-table v-loading="loading" :data="events" border @selection-change="selected = $event"><el-table-column type="selection" width="46" /><el-table-column prop="eventId" label="事件" min-width="180" /><el-table-column prop="erpAcctCode" label="账套" width="90" /><el-table-column prop="billNo" label="单据" min-width="140" /><el-table-column prop="formId" label="类型" min-width="130" /><el-table-column prop="eventStatus" label="状态" width="120" /><el-table-column prop="retryCount" label="重试" width="90" /><el-table-column prop="traceId" label="链路" min-width="180" show-overflow-tooltip /><el-table-column prop="lastError" label="最近错误" min-width="240" show-overflow-tooltip /><el-table-column fixed="right" label="操作" width="80"><template #default="{ row }"><el-button v-if="row.eventStatus === 'FAILED'" text type="warning" @click="retry(row)">重试</el-button></template></el-table-column></el-table>
  </div>
</template>

<style scoped>
.erp-operations-page { display:flex; flex-direction:column; gap:12px; padding:16px; }
.header { display:flex; justify-content:space-between; align-items:center; } .header h2 { margin:0; } .header p { color:var(--el-text-color-secondary); margin:6px 0 0; }
.metrics { display:grid; grid-template-columns:repeat(5,minmax(120px,1fr)); gap:10px; } .metric { padding:12px; border:1px solid var(--el-border-color-light); border-radius:6px; background:var(--el-bg-color); } .metric span { color:var(--el-text-color-secondary); font-size:12px; } .metric strong { display:block; margin-top:6px; font-size:24px; }
.toolbar { display:flex; gap:10px; } .toolbar .el-input { width:180px; } @media (max-width:900px) { .metrics { grid-template-columns:repeat(2,1fr); } }
</style>
