<script setup lang="ts">
import type { PurchaseOrderRow, PurchaseRequisitionRow } from '#/api/purchase';

import { onMounted, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import { getPurchaseOrderPage, getPurchaseRequisitionPage } from '#/api/purchase';
import BomWhereUsedDrawer from '#/views/inventory/components/BomWhereUsedDrawer.vue';

// 组件名必须与路由 name 一致，否则 KeepAlive 静默失效（同 purchase-receive.vue 的约定）。
defineOptions({ name: 'PurchaseQuery' });

type TabName = 'orders' | 'requisitions';

const activeTab = ref<TabName>('requisitions');

/** 数据状态选项，取自 ERP PUR_Requisition / PUR_PurchaseOrder 的 FDocumentStatus 枚举 */
const statusOptions = [
  { label: '暂存', value: 'Z' },
  { label: '创建', value: 'A' },
  { label: '审核中', value: 'B' },
  { label: '已审核', value: 'C' },
  { label: '重新审核', value: 'D' },
];

const statusLabels: Record<string, string> = {
  A: '创建',
  B: '审核中',
  C: '已审核',
  D: '重新审核',
  Z: '暂存',
};

const filters = ref({
  billNo: '',
  materialNumber: '',
  documentStatus: '',
  orgNumber: '',
  supplierNumber: '',
  dateRange: [] as string[],
});

const loading = ref(false);
const requisitionRows = ref<PurchaseRequisitionRow[]>([]);
const orderRows = ref<PurchaseOrderRow[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// 反查抽屉
const drawerVisible = ref(false);
const drawerMaterialNumber = ref('');
const drawerMaterialName = ref('');
const drawerOrgNumber = ref('');

function statusType(status?: string) {
  if (status === 'C') return 'success';
  if (status === 'B' || status === 'D') return 'warning';
  return 'info';
}

function buildParams() {
  const [dateFrom, dateTo] = filters.value.dateRange ?? [];
  return {
    billNo: filters.value.billNo || undefined,
    materialNumber: filters.value.materialNumber || undefined,
    documentStatus: filters.value.documentStatus || undefined,
    orgNumber: filters.value.orgNumber || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: currentPage.value,
    pageSize: pageSize.value,
  };
}

async function load() {
  loading.value = true;
  try {
    if (activeTab.value === 'requisitions') {
      const res = await getPurchaseRequisitionPage(buildParams());
      if (!res?.success) {
        ElMessage.warning(res?.message ?? '采购申请查询失败');
        requisitionRows.value = [];
        total.value = 0;
        return;
      }
      requisitionRows.value = res.data ?? [];
      total.value = res.total ?? 0;
    } else {
      const res = await getPurchaseOrderPage({
        ...buildParams(),
        supplierNumber: filters.value.supplierNumber || undefined,
      });
      if (!res?.success) {
        ElMessage.warning(res?.message ?? '采购订单查询失败');
        orderRows.value = [];
        total.value = 0;
        return;
      }
      orderRows.value = res.data ?? [];
      total.value = res.total ?? 0;
    }
  } catch (error: any) {
    ElMessage.error(error?.message ?? '查询异常');
    requisitionRows.value = [];
    orderRows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** 筛选条件变化时回到第 1 页再查，否则会停在越界页上显示空列表 */
function reloadFromFirstPage() {
  currentPage.value = 1;
  load();
}

watch(
  () => [
    filters.value.billNo,
    filters.value.materialNumber,
    filters.value.supplierNumber,
  ],
  () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reloadFromFirstPage, 250);
  },
);

watch(
  () => [
    filters.value.documentStatus,
    filters.value.orgNumber,
    filters.value.dateRange,
  ],
  reloadFromFirstPage,
);

watch(activeTab, () => {
  // 供应商筛选只对订单有意义，切回申请时清掉避免残留影响下次查询
  if (activeTab.value === 'requisitions') {
    filters.value.supplierNumber = '';
  }
  reloadFromFirstPage();
});

function handleSizeChange(size: number) {
  pageSize.value = size;
  reloadFromFirstPage();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  load();
}

function resetFilters() {
  filters.value = {
    billNo: '',
    materialNumber: '',
    documentStatus: '',
    orgNumber: '',
    supplierNumber: '',
    dateRange: [],
  };
  reloadFromFirstPage();
}

/**
 * 打开 BOM 反查抽屉。
 *
 * 必须把该行的采购组织一起传下去：同一 BOM 在集团与子公司下各存一份，
 * 不传组织后端就不过滤，递归结果会翻倍。
 */
function openWhereUsed(row: PurchaseOrderRow | PurchaseRequisitionRow) {
  if (!row.materialNumber) {
    ElMessage.warning('该行没有物料编码，无法反查');
    return;
  }
  drawerMaterialNumber.value = row.materialNumber;
  drawerMaterialName.value = row.materialName ?? '';
  drawerOrgNumber.value = row.purchaseOrgNumber ?? '';
  drawerVisible.value = true;
}

onMounted(load);
</script>

<template>
  <div class="flex flex-col gap-3 p-4">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <el-input
          v-model="filters.billNo"
          placeholder="单据编号"
          clearable
          style="width: 180px"
        />
        <el-input
          v-model="filters.materialNumber"
          placeholder="物料编码"
          clearable
          style="width: 180px"
        />
        <el-input
          v-if="activeTab === 'orders'"
          v-model="filters.supplierNumber"
          placeholder="供应商编码"
          clearable
          style="width: 160px"
        />
        <el-select
          v-model="filters.documentStatus"
          placeholder="数据状态"
          clearable
          style="width: 130px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="filters.orgNumber"
          placeholder="采购组织编码"
          clearable
          style="width: 150px"
        />
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="起始日期"
          end-placeholder="结束日期(不含)"
          style="width: 260px"
        />
        <el-button @click="resetFilters">重置</el-button>
        <el-button type="primary" :loading="loading" @click="load">
          查询
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="采购申请" name="requisitions">
          <el-table
            v-loading="loading"
            :data="requisitionRows"
            border
            height="calc(100vh - 400px)"
          >
            <el-table-column
              prop="billNo"
              label="申请单号"
              width="170"
              fixed="left"
            />
            <el-table-column label="物料编码" width="160" fixed="left">
              <template #default="{ row }">
                <el-link
                  type="primary"
                  :underline="false"
                  @click="openWhereUsed(row)"
                >
                  {{ row.materialNumber }}
                </el-link>
              </template>
            </el-table-column>
            <el-table-column
              prop="materialName"
              label="物料名称"
              width="150"
              show-overflow-tooltip
            />
            <el-table-column
              prop="materialModel"
              label="规格型号"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.documentStatus)" size="small">
                  {{ statusLabels[row.documentStatus] ?? row.documentStatus }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="reqQty"
              label="申请数量"
              width="100"
              align="right"
            />
            <el-table-column
              prop="approveQty"
              label="批准数量"
              width="100"
              align="right"
            />
            <el-table-column
              prop="orderQty"
              label="已下推"
              width="90"
              align="right"
            />
            <el-table-column
              prop="remainQty"
              label="剩余"
              width="90"
              align="right"
            />
            <el-table-column prop="unitName" label="单位" width="70" />
            <el-table-column
              prop="arrivalDate"
              label="到货日期"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="purchaseOrgNumber"
              label="采购组织"
              width="100"
            />
            <el-table-column
              prop="srcBillNo"
              label="源单号"
              width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="createDate"
              label="创建时间"
              width="170"
              show-overflow-tooltip
            />
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="openWhereUsed(row)"
                >
                  BOM反查
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="采购订单" name="orders">
          <el-table
            v-loading="loading"
            :data="orderRows"
            border
            height="calc(100vh - 400px)"
          >
            <el-table-column
              prop="billNo"
              label="订单号"
              width="170"
              fixed="left"
            />
            <el-table-column label="物料编码" width="160" fixed="left">
              <template #default="{ row }">
                <el-link
                  type="primary"
                  :underline="false"
                  @click="openWhereUsed(row)"
                >
                  {{ row.materialNumber }}
                </el-link>
              </template>
            </el-table-column>
            <el-table-column
              prop="materialName"
              label="物料名称"
              width="150"
              show-overflow-tooltip
            />
            <el-table-column
              prop="materialModel"
              label="规格型号"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.documentStatus)" size="small">
                  {{ statusLabels[row.documentStatus] ?? row.documentStatus }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="supplierName"
              label="供应商"
              width="180"
              show-overflow-tooltip
            />
            <el-table-column prop="qty" label="数量" width="90" align="right" />
            <el-table-column
              prop="remainReceiveQty"
              label="待收货"
              width="90"
              align="right"
            />
            <el-table-column prop="unitName" label="单位" width="70" />
            <el-table-column
              prop="taxPrice"
              label="含税单价"
              width="100"
              align="right"
            />
            <el-table-column
              prop="amount"
              label="金额"
              width="110"
              align="right"
            />
            <el-table-column prop="billDate" label="单据日期" width="120" />
            <el-table-column
              prop="deliveryDate"
              label="交货日期"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="purchaseOrgNumber"
              label="采购组织"
              width="100"
            />
            <el-table-column
              prop="srcBillNo"
              label="源单号"
              width="170"
              show-overflow-tooltip
            />
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="openWhereUsed(row)"
                >
                  BOM反查
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <div class="mt-3 flex justify-end">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100, 200]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <BomWhereUsedDrawer
      v-model="drawerVisible"
      :material-number="drawerMaterialNumber"
      :material-name="drawerMaterialName"
      :org-number="drawerOrgNumber"
    />
  </div>
</template>
