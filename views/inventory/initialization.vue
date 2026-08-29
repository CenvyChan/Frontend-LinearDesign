<script lang="ts" setup>
import type { WmsInventoryInitializationBatch, WmsInventoryInitializationWarehouse } from '#/api/wms';

import { computed, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import { confirmWmsInventoryInitialization, previewWmsInventoryInitialization } from '#/api/wms';
import { useErpAcctStore } from '#/store';

defineOptions({ name: 'InitialInventorySync' });

const acct = useErpAcctStore();
const loading = ref(false);
const batch = ref<WmsInventoryInitializationBatch>();
const selected = ref<string[]>([]);
const reinitialize = ref(false);
const form = reactive({ erpOrgNumber: '' });

const eligible = computed(
  () => batch.value?.warehouses.filter((item) => item.status === 'ELIGIBLE').map((item) => item.stockNumber) || [],
);

const alreadyInitialized = computed(
  () => batch.value?.warehouses.filter((item) => item.status === 'ALREADY_INITIALIZED').map((item) => item.stockNumber) || [],
);

function updateSelected(rows: WmsInventoryInitializationWarehouse[]) {
  selected.value = rows.map((row) => row.stockNumber);
}

function selectable(row: WmsInventoryInitializationWarehouse) {
  return reinitialize.value ? row.status === 'ALREADY_INITIALIZED' : row.status === 'ELIGIBLE';
}

async function preview() {
  if (!form.erpOrgNumber.trim()) {
    return ElMessage.warning('请输入 ERP 库存组织编码');
  }
  loading.value = true;
  try {
    const res = await previewWmsInventoryInitialization({
      erpAcctCode: acct.acctCode || '',
      erpOrgNumber: form.erpOrgNumber.trim(),
    });
    if (!res.success) throw new Error(res.message);
    batch.value = res.data;
    reinitialize.value = false;
    selected.value = eligible.value;
    ElMessage.success('ERP 快照已生成，请核对后确认');
  } catch (error: any) {
    ElMessage.error(error.message || '读取 ERP 快照失败');
  } finally {
    loading.value = false;
  }
}

async function confirm() {
  if (!batch.value || !selected.value.length) {
    return ElMessage.warning('请选择可同步仓库');
  }
  try {
    await ElMessageBox.confirm(
      `ERP 库存必须继续冻结。确认将把 ${selected.value.length} 个仓库的库存投影${reinitialize.value ? '重新' : ''}写入未分配库位。`,
      reinitialize.value ? '确认重新初始化' : '确认初始库存同步',
      { type: 'warning' },
    );
    loading.value = true;
    const res = await confirmWmsInventoryInitialization({
      batchId: batch.value.batchId,
      stockNumbers: selected.value,
      reinitialize: reinitialize.value,
    });
    if (!res.success) throw new Error(res.message);
    batch.value = res.data;
    ElMessage.success('同步请求已完成，请核对逐仓结果');
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '同步失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <h1>初始库存同步</h1>
    <p>以 ERP 即时库存建立 WMS 库位库存投影，ERP 库存数量不会被修改。</p>
    <el-alert
      type="warning"
      :closable="false"
      title="执行预览和确认期间，请冻结 ERP 目标组织的库存变动。"
    />
    <el-form inline class="filters">
      <el-form-item label="当前账套"><el-input :model-value="acct.acctCode" disabled /></el-form-item>
      <el-form-item label="ERP 库存组织"><el-input v-model="form.erpOrgNumber" placeholder="组织编码" /></el-form-item>
      <el-button type="primary" :loading="loading" @click="preview">读取 ERP 快照</el-button>
    </el-form>
    <template v-if="batch">
      <el-descriptions :column="4" border>
        <el-descriptions-item label="批次">{{ batch.batchId }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ batch.status }}</el-descriptions-item>
        <el-descriptions-item label="快照时间">{{ new Date(batch.snapshotTime).toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="过期时间">{{ new Date(batch.expiresTime).toLocaleString() }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="alreadyInitialized.length > 0" type="info" :closable="false">
        <template #title>
          {{ alreadyInitialized.length }} 个仓库已完成初始投影。如需更新，请勾选"重新初始化"并选择对应仓库。
        </template>
      </el-alert>
      <el-checkbox v-model="reinitialize" @change="selected = reinitialize ? alreadyInitialized : eligible">
        重新初始化（覆盖已有投影）
      </el-checkbox>
      <el-table :data="batch.warehouses" @selection-change="updateSelected">
        <el-table-column type="selection" :selectable="selectable" width="55" />
        <el-table-column prop="stockNumber" label="仓库" />
        <el-table-column prop="stockName" label="名称" />
        <el-table-column prop="lineCount" label="库存行" />
        <el-table-column prop="totalQty" label="ERP 即时库存" />
        <el-table-column prop="erpLockedQty" label="ERP 锁定" />
        <el-table-column prop="wmsQty" label="现有 WMS 汇总" />
        <el-table-column prop="wmsReservedQty" label="WMS 预约" />
        <el-table-column prop="status" label="状态" />
        <el-table-column prop="message" label="说明" min-width="220" />
      </el-table>
      <el-button type="danger" :loading="loading" @click="confirm">确认同步选中仓库</el-button>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.filters { margin-top: 8px; }
</style>
