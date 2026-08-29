<script lang="ts" setup>
/**
 * 生产工单查询页面
 *
 * 一级查询条件（ERP查询）：
 * - 车间选择（单选，必选触发查询）
 * - 下达日期范围（可选）
 * - 工单状态（可选，默认 计划/计划确认/下达/开工/完工）
 *
 * 本地快速筛选：
 * - 物料选择（多选）
 * - 物料编码/名称/规格型号模糊搜索
 * - 工单编号关键字
 */
import { onMounted, reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import MaterialSelectDialog from '#/components/MaterialSelectDialog.vue';
import {
  exportProductionOrderExcel,
  queryProductionOrder,
  refreshProductionOrder,
  type ProductionOrderQueryParams,
  type ProductionOrderItem,
} from '#/api/production';
import { downloadBlob } from '#/utils/download';
import {
  getOrganizationById,
  getOrganizations,
  getWorkshopsByOrgNumber,
  type ErpWorkshop,
} from '#/api/erpData';

defineOptions({ name: 'ProductionOrder' });

const router = useRouter();

// ===================================================================
// 状态定义
// ===================================================================

const loading = ref(false);
const exportLoading = ref(false);
const workshopListLoading = ref(false);
const syncLoading = ref(false);

/** 本地缓存全量工单数据（来自ERP/Redis） */
const allCachedData = ref<ProductionOrderItem[]>([]);
/** 全量数据总数 */
const totalCount = ref(0);
const pageIndex = ref(1);
const pageSize = ref(50);

// ===================================================================
// 组织与车间
// ===================================================================

const erpOrgId = ref<string>('');
const erpOrgNumber = ref<string>('');
const erpAcctCode = ref<string>('');
const workshopOptions = ref<ErpWorkshop[]>([]);
const selectedWorkshopNumber = ref<string>('');
const dataLoaded = ref(false);

// ===================================================================
// 一级查询条件（参与ERP查询）
// ===================================================================

const dateRange = ref<[string, string] | null>(null);
const selectedStatusList = ref<string[]>(['2', '3', '4', '5']);

/** 状态选项（移除了'7': '部分完工'，'2'改为'计划确认'） */
const statusOptions = [
  { value: '1', label: '计划' },
  { value: '2', label: '计划确认' },
  { value: '3', label: '下达' },
  { value: '4', label: '开工' },
  { value: '5', label: '完工' },
  { value: '6', label: '结案' },
];

// ===================================================================
// 本地快速筛选（第二阶段）
// ===================================================================

const showLocalFilters = ref(false);
const localFilter = reactive({
  /** 选中的物料编码列表（多选） */
  materialNumbers: [] as string[],
  /** 物料编码/物料名称/规格型号模糊搜索 */
  keyword: '',
  /** 工单编号关键字 */
  orderNoKeyword: '',
});

// 物料选择弹窗
const materialDialogVisible = ref(false);
const selectedMaterials = ref<
  { number: string; name: string; specification: string }[]
>([]);

// ===================================================================
// 计算属性
// ===================================================================

/** 物料标签 */
const selectedMaterialTags = computed(() => {
  return selectedMaterials.value.map((m) => ({
    number: m.number,
    label: `${m.number} - ${m.name}`,
  }));
});

/** 是否有本地筛选条件 */
const hasLocalFilter = computed(() => {
  return (
    localFilter.materialNumbers.length > 0 ||
    localFilter.keyword.trim() !== '' ||
    localFilter.orderNoKeyword.trim() !== ''
  );
});

/** 本地筛选条件描述 */
const localFilterDesc = computed(() => {
  const conditions: string[] = [];
  if (localFilter.materialNumbers.length > 0) {
    conditions.push(`物料(${localFilter.materialNumbers.length}个)`);
  }
  if (localFilter.keyword.trim()) {
    conditions.push(`关键字:${localFilter.keyword.trim()}`);
  }
  if (localFilter.orderNoKeyword.trim()) {
    conditions.push(`工单号:${localFilter.orderNoKeyword.trim()}`);
  }
  return conditions.join(' + ');
});

/** ERP查询条件描述 */
const primaryConditionDesc = computed(() => {
  const parts: string[] = [];
  if (selectedWorkshopNumber.value) {
    const ws = workshopOptions.value.find(
      (w) => w.workshopNumber === selectedWorkshopNumber.value,
    );
    parts.push(`车间:${ws ? ws.workshopName : selectedWorkshopNumber.value}`);
  }
  if (dateRange.value) {
    parts.push(`下达日期:${dateRange.value[0]}~${dateRange.value[1]}`);
  }
  if (selectedStatusList.value.length > 0) {
    const labels = selectedStatusList.value
      .map((v) => statusOptions.find((o) => o.value === v)?.label || v)
      .join('、');
    parts.push(`状态:${labels}`);
  }
  return parts.join(' | ');
});

/** 本地筛选后的数据（实时响应） */
const filteredData = computed(() => {
  let result = [...allCachedData.value];

  // 1. 物料编码多选筛选
  if (localFilter.materialNumbers.length > 0) {
    const codeSet = new Set(localFilter.materialNumbers);
    result = result.filter((item) => codeSet.has(item.materialId));
  }

  // 2. 关键字模糊搜索（物料编码/物料名称/规格型号）
  if (localFilter.keyword.trim()) {
    const kw = localFilter.keyword.trim().toLowerCase();
    result = result.filter((item) => {
      return (
        (item.materialId || '').toLowerCase().includes(kw) ||
        (item.materialName || '').toLowerCase().includes(kw) ||
        (item.materialModel || '').toLowerCase().includes(kw)
      );
    });
  }

  // 3. 工单编号关键字
  if (localFilter.orderNoKeyword.trim()) {
    const kw = localFilter.orderNoKeyword.trim().toLowerCase();
    result = result.filter((item) => {
      return (item.moBillNo || '').toLowerCase().includes(kw);
    });
  }

  return result;
});

/** 当前页数据 */
const pagedData = computed(() => {
  const start = (pageIndex.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredData.value.slice(start, end);
});

// ===================================================================
// 初始化
// ===================================================================

const initOrgInfo = async () => {
  let orgId = '';
  const savedOrgId = localStorage.getItem('mes_current_org_id');
  if (savedOrgId) {
    orgId = savedOrgId;
  }

  if (orgId) {
    try {
      const resp = await getOrganizationById(orgId);
      if (resp.success && resp.data) {
        erpOrgId.value = resp.data.erpOrgId;
        erpOrgNumber.value = resp.data.erpOrgNumber;
        erpAcctCode.value = resp.data.erpAcctCode || '';
        await loadWorkshops();
        return;
      }
    } catch (error) {
      console.error('[工单查询] 获取组织详情失败:', error);
    }
  }

  try {
    const resp = await getOrganizations();
    if (resp.success) {
      const org =
        resp.defaultOrg || (resp.data?.length > 0 ? resp.data[0] : null);
      if (org) {
        erpOrgId.value = org.erpOrgId;
        erpOrgNumber.value = org.erpOrgNumber;
        erpAcctCode.value = org.erpAcctCode || '';
        localStorage.setItem('mes_current_org_id', org.erpOrgId);
        await loadWorkshops();
      }
    }
  } catch (error) {
    console.error('[工单查询] 获取组织列表失败:', error);
  }
};

/** 加载当前组织对应的车间列表 */
const loadWorkshops = async () => {
  if (!erpOrgNumber.value) return;

  workshopListLoading.value = true;
  try {
    const resp = await getWorkshopsByOrgNumber(erpOrgNumber.value);
    if (Array.isArray(resp)) {
      workshopOptions.value = resp;
    } else if (resp && Array.isArray((resp as any).data)) {
      workshopOptions.value = (resp as any).data;
    }
  } catch (error) {
    console.error('[工单查询] 加载车间列表失败:', error);
    workshopOptions.value = [];
  } finally {
    workshopListLoading.value = false;
  }
};

// ===================================================================
// 构建ERP查询参数
// ===================================================================

/** 构建ERP查询参数 */
const buildErpQueryParams = (): ProductionOrderQueryParams => {
  const params: ProductionOrderQueryParams = {
    // prdOrgId is the ERP internal id; erpOrgNumber is the FNumber value sent to K3Cloud.
    prdOrgId: erpOrgId.value || undefined,
    erpOrgNumber: erpOrgNumber.value || undefined,
    workshopNumbers: selectedWorkshopNumber.value
      ? [selectedWorkshopNumber.value]
      : undefined,
    pageIndex: 1,
    pageSize: 2000,
    isSuspend: '0',
  };

  // 状态条件：当用户手动调整了状态列表时才传递
  if (selectedStatusList.value.length > 0) {
    params.status = selectedStatusList.value.join(',');
  }

  // 日期条件
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    params.conveyDateBegin = dateRange.value[0];
    params.conveyDateEnd = dateRange.value[1];
    params.conveyDateInvolve = true;
  } else {
    params.conveyDateInvolve = false;
  }

  return params;
};

// ===================================================================
// ERP查询操作
// ===================================================================

/** 车间选择变化 - 自动查询工单（携带日期和状态条件） */
/** 点击"查询"按钮 - 使用当前一级条件重新查询ERP */
const handleQuery = async () => {
  if (!selectedWorkshopNumber.value) {
    ElMessage.warning('请先选择车间');
    return;
  }

  loading.value = true;
  dataLoaded.value = false;
  showLocalFilters.value = false;
  pageIndex.value = 1;
  clearLocalFilters();

  try {
    const params = buildErpQueryParams();
    console.log('[工单查询] 一级条件查询:', params);
    const res = await queryProductionOrder(params);
    if (!res?.success) {
      throw new Error(res?.message || '查询工单失败');
    }
    const items = res?.data || [];

    allCachedData.value = items;
    totalCount.value = items.length;
    dataLoaded.value = true;
    showLocalFilters.value = true;

    ElMessage.success(`查询完成（${items.length} 条）`);
  } catch (error) {
    console.error('[工单查询] 查询失败:', error);
    ElMessage.error('查询工单失败');
    allCachedData.value = [];
    dataLoaded.value = false;
  } finally {
    loading.value = false;
  }
};

/** 手动同步ERP数据（强制刷新缓存） */
const handleExport = async () => {
  if (!selectedWorkshopNumber.value) {
    ElMessage.warning('请先选择车间');
    return;
  }
  exportLoading.value = true;
  try {
    const blob = await exportProductionOrderExcel(buildErpQueryParams());
    downloadBlob(blob, '生产工单导出.xlsx');
  } catch (error) {
    console.error('[工单查询] 导出失败:', error);
    ElMessage.error('导出工单失败');
  } finally {
    exportLoading.value = false;
  }
};

const handleSyncErp = async () => {
  if (!selectedWorkshopNumber.value) {
    ElMessage.warning('请先选择车间');
    return;
  }

  syncLoading.value = true;
  try {
    const params = buildErpQueryParams();
    console.log('[工单查询] 手动同步ERP:', params);
    const res = await refreshProductionOrder(params);
    const items = res?.data || [];

    allCachedData.value = items;
    totalCount.value = items.length;
    dataLoaded.value = true;
    showLocalFilters.value = true;

    ElMessage.success(`已从ERP同步数据（${items.length} 条）`);
  } catch (error) {
    console.error('[工单查询] 同步ERP失败:', error);
    ElMessage.error('同步ERP数据失败');
  } finally {
    syncLoading.value = false;
  }
};

// ===================================================================
// 本地筛选操作
// ===================================================================

const openMaterialDialog = () => {
  materialDialogVisible.value = true;
};

const handleMaterialConfirm = (
  items: { number: string; name: string; specification: string }[],
) => {
  selectedMaterials.value = items;
  localFilter.materialNumbers = items.map((m) => m.number);
};

const removeMaterial = (number: string) => {
  selectedMaterials.value = selectedMaterials.value.filter(
    (m) => m.number !== number,
  );
  localFilter.materialNumbers = selectedMaterials.value.map((m) => m.number);
};

const clearAllMaterials = () => {
  selectedMaterials.value = [];
  localFilter.materialNumbers = [];
};

const clearLocalFilters = () => {
  localFilter.materialNumbers = [];
  localFilter.keyword = '';
  localFilter.orderNoKeyword = '';
  selectedMaterials.value = [];
  pageIndex.value = 1;
};

/** 重置：清空所有条件回到初始状态 */
const handleReset = () => {
  selectedWorkshopNumber.value = '';
  dateRange.value = null;
  selectedStatusList.value = ['2', '3', '4', '5'];
  allCachedData.value = [];
  totalCount.value = 0;
  dataLoaded.value = false;
  showLocalFilters.value = false;
  clearLocalFilters();
};

/** 跳转到工单详情页（在Vben Admin内部标签页打开） */
const handleDetail = (row: ProductionOrderItem) => {
  const tempData = {
    materialId: row.materialId,
    materialName: row.materialName,
    materialModel: row.materialModel,
    planQty: row.planQty,
    moBillNo: row.moBillNo,
    moEntrySeq: row.moEntrySeq,
    erpAcctCode: erpAcctCode.value || undefined,
    prdOrgId: erpOrgId.value || undefined,
    prdOrgNumber: erpOrgNumber.value || undefined,
    workshopNumber: selectedWorkshopNumber.value || undefined,
  };
  localStorage.setItem('order_detail_temp', JSON.stringify(tempData));
  router.push({ path: `/production/order/${row.moBillNo}` });
};

// ===================================================================
// 统计
// ===================================================================

const showQueryStats = () => {
  ElMessageBox.alert(
    `<div style="line-height: 1.8">
      <div><strong>组织编码：</strong>${erpOrgNumber.value || '-'}</div>
      <div><strong>当前查询：</strong>${primaryConditionDesc.value || '-'}</div>
      <div><strong>缓存总数：</strong>${totalCount.value} 条</div>
      <div><strong>筛选后记录：</strong>${filteredData.value.length} 条</div>
      <div v-if="hasLocalFilter"><strong>本地筛选：</strong>${localFilterDesc.value || '无'}</div>
    </div>`,
    '查询统计',
    {
      confirmButtonText: '确定',
      dangerouslyUseHTMLString: true,
    },
  );
};

// ===================================================================
// 工具函数
// ===================================================================

const formatNumber = (val: any) => {
  if (val === null || val === undefined) return '-';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toLocaleString();
};

const getStatusType = (status: string): string => {
  const map: Record<string, string> = {
    计划: 'info',
    '计划确认': 'warning',
    下达: 'primary',
    开工: 'success',
    完工: '',
    结案: 'success',
  };
  return map[status] || 'info';
};

/**
 * 获取工单类型对应的 element-plus tag 类型
 * 普通生产 → success, 返工生产 → warning, 委托加工 → primary
 */
const getOrderTypeType = (typeId: string): string => {
  if (!typeId) return 'info';
  if (typeId.includes('返工')) return 'warning';
  if (typeId.includes('委托')) return 'primary';
  // 默认普通生产
  return 'success';
};

/**
 * 简化工单类型显示标签
 */
const getOrderTypeLabel = (typeId: string): string => {
  if (!typeId) return '-';
  if (typeId.includes('普通生产')) return '普';
  if (typeId.includes('返工生产')) return '返';
  if (typeId.includes('委托加工')) return '委';
  return typeId;
};

// ===================================================================
// 分页
// ===================================================================

const handleSizeChange = () => {
  pageIndex.value = 1;
};

const handlePageChange = () => {
  /* 前端分页 */
};

// ===================================================================
// 生命周期
// ===================================================================

onMounted(() => {
  initOrgInfo();
});
</script>

<template>
  <div class="p-5">
    <!-- ================================================================ -->
    <!-- 页面标题 + 一级查询条件 + 操作按钮                                -->
    <!-- ================================================================ -->
    <div class="mb-4 flex items-center gap-3 flex-wrap">
      <h1 class="text-lg font-semibold whitespace-nowrap">工单查询</h1>

      <!-- 车间选择（单选，flex-1占剩余空间） -->
      <div class="flex-1 min-w-[160px]">
        <el-select
          v-model="selectedWorkshopNumber"
          placeholder="请选择车间"
          filterable
          clearable
          :loading="workshopListLoading"
          :disabled="loading"
          style="width: 100%"
          @change=""
        >
          <el-option
            v-for="ws in workshopOptions"
            :key="ws.workshopNumber"
            :label="`${ws.workshopNumber} - ${ws.workshopName}`"
            :value="ws.workshopNumber"
          />
        </el-select>
      </div>

      <!-- 下达日期范围 -->
      <div class="min-w-[220px]">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="下达开始日期"
          end-placeholder="下达结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          :disabled="loading"
        />
      </div>

      <!-- 工单状态 -->
      <div class="min-w-[160px]">
        <el-select
          v-model="selectedStatusList"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="工单状态"
          clearable
          style="width: 100%"
          :disabled="loading"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>

      <!-- 操作按钮组 -->
      <div class="flex items-center gap-2 whitespace-nowrap">
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!selectedWorkshopNumber"
          @click="handleQuery"
        >
          <i class="i-ep-search mr-1" />
          查询
        </el-button>
        <el-button @click="handleReset">
          <i class="i-ep-refresh mr-1" />
          重置
        </el-button>
        <el-button
          type="warning"
          :loading="syncLoading"
          :disabled="!selectedWorkshopNumber"
          @click="handleSyncErp"
        >
          <i class="i-ep-download mr-1" />
          手动同步ERP
        </el-button>
        <el-button
          :loading="exportLoading"
          :disabled="!selectedWorkshopNumber"
          @click="handleExport"
        >
          <i class="i-ep-download mr-1" />
          导出
        </el-button>
        <el-button
          v-if="dataLoaded && filteredData.length > 0"
          link
          type="info"
          @click="showQueryStats"
        >
          <i class="i-ep-data-analysis mr-1" />
          统计
        </el-button>
      </div>
    </div>

    <!-- 提示：等待加载 -->
    <div
      v-if="selectedWorkshopNumber && !dataLoaded && !loading"
      class="mb-4 text-sm text-gray-400"
    >
      <i class="i-ep-info-filled mr-1" />
      请等待工单数据加载完成
    </div>

    <!-- ERP级条件摘要 -->
    <div
      v-if="dataLoaded"
      class="mb-3 text-sm text-gray-500"
    >
      <i class="i-ep-info-filled mr-1" />
      {{ primaryConditionDesc }}
    </div>

    <!-- ================================================================ -->
    <!-- 本地快速筛选卡片（数据加载完成后显示）                            -->
    <!-- ================================================================ -->
    <el-card v-if="showLocalFilters && dataLoaded" shadow="never" class="mb-4">
      <div class="grid grid-cols-12 gap-4">
        <!-- 物料选择（5列） -->
        <div class="col-span-5">
          <label class="mb-1 block text-sm text-gray-600">物料编码</label>
          <div
            class="flex min-h-[32px] flex-wrap items-center gap-1 rounded border border-dashed px-2 py-1"
            :class="selectedMaterials.length > 0 ? 'border-primary' : 'border-gray-300'"
          >
            <span
              v-if="selectedMaterials.length === 0"
              class="text-xs text-gray-400"
            >
              点击按钮选择物料（支持多选和模糊搜索）
            </span>
            <el-tag
              v-for="tag in selectedMaterialTags"
              :key="tag.number"
              closable
              size="small"
              type="primary"
              @close="removeMaterial(tag.number)"
            >
              <el-tooltip :content="tag.label" placement="top" :show-after="300">
                <span class="max-w-28 truncate">{{ tag.number }}</span>
              </el-tooltip>
            </el-tag>
          </div>
          <div class="mt-1">
            <el-button size="small" plain @click="openMaterialDialog">
              <i class="i-ep-plus mr-1" />
              {{ selectedMaterials.length > 0 ? '追加物料' : '选择物料' }}
            </el-button>
            <el-button
              v-if="selectedMaterials.length > 0"
              :icon="'Delete'"
              size="small"
              link
              type="danger"
              @click="clearAllMaterials"
            >
              清空 (<span class="font-mono">{{ selectedMaterials.length }}</span>)
            </el-button>
          </div>
        </div>

        <!-- 关键字模糊搜索（4列） -->
        <div class="col-span-4">
          <label class="mb-1 block text-sm text-gray-600"
            >物料编码/名称/规格型号</label
          >
          <el-input
            v-model="localFilter.keyword"
            placeholder="输入关键字模糊搜索"
            clearable
          >
            <template #prefix>
              <i class="i-ep-search" />
            </template>
          </el-input>
        </div>

        <!-- 工单编号（3列） -->
        <div class="col-span-3">
          <label class="mb-1 block text-sm text-gray-600">工单编号</label>
          <el-input
            v-model="localFilter.orderNoKeyword"
            placeholder="输入工单号"
            clearable
          />
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="mt-3">
        <div class="flex items-center text-sm text-gray-400">
          <i class="i-ep-info-filled mr-1" />
          <span v-if="hasLocalFilter">
            当前本地筛选：{{ localFilterDesc }}
          </span>
          <span v-else>本地实时过滤，无需点击查询按钮</span>
        </div>
      </div>
    </el-card>

    <!-- ================================================================ -->
    <!-- 数据表格                                                         -->
    <!-- ================================================================ -->
    <el-card shadow="never" class="w-full">
      <!-- 表格上方信息栏 -->
      <div v-if="dataLoaded" class="mb-3 flex items-center justify-between">
        <div class="text-sm text-gray-600">
          <span class="font-medium text-gray-800">{{
            filteredData.length
          }}</span>
          条
          <span v-if="totalCount > filteredData.length" class="text-gray-400">
            （已从 {{ totalCount }} 条中筛选，
            <template v-if="hasLocalFilter">含本地条件过滤</template>
            <template v-else>已排除无关数据</template>
            ）
          </span>
          <span v-if="hasLocalFilter" class="ml-2 text-primary text-xs">
            本地实时筛选
          </span>
        </div>
      </div>

      <el-table
        :data="pagedData"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
        max-height="calc(100vh - 340px)"
        empty-text="暂无数据"
      >
        <el-table-column
          prop="moBillNo"
          label="工单编号"
          width="200"
          fixed="left"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px">
              <span>{{ row.moBillNo }}</span>
              <el-tag
                v-if="row.moBillTypeId"
                :type="getOrderTypeType(row.moBillTypeId)"
                size="small"
                :disable-transitions="true"
                style="flex-shrink:0;font-size:11px"
              >
                {{ getOrderTypeLabel(row.moBillTypeId) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="materialId"
          label="物料编码"
          width="130"
          show-overflow-tooltip
        />
        <el-table-column
          prop="materialName"
          label="物料名称"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="materialModel"
          label="规格型号"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column prop="prdUnitId" label="单位" width="70" />
        <el-table-column prop="workshopId" label="车间" width="100" />
        <el-table-column prop="planQty" label="计划数量" width="85" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.planQty) }}
          </template>
        </el-table-column>
        <el-table-column prop="finishQty" label="完工数量" width="85" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.finishQty) }}
          </template>
        </el-table-column>
        <el-table-column prop="pickedQty" label="已领数量" width="85" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.pickedQty) }}
          </template>
        </el-table-column>
        <el-table-column label="领料进度" width="110" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="
                row.planQty > 0
                  ? Math.min(
                      Math.round(((row.pickedQty || 0) / row.planQty) * 100),
                      100,
                    )
                  : 0
              "
              :stroke-width="14"
              :text-inside="true"
              :status="
                row.planQty > 0 && (row.pickedQty || 0) >= row.planQty
                  ? 'success'
                  : ''
              "
            />
          </template>
        </el-table-column>
        <el-table-column prop="reportQty" label="汇报数量" width="85" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.reportQty) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="stockInQuaQty"
          label="合格入库"
          width="85"
          align="right"
        >
          <template #default="{ row }">
            {{ formatNumber(row.stockInQuaQty) }}
          </template>
        </el-table-column>
        <el-table-column prop="conveyDate" label="下达日期" width="140" />
        <el-table-column prop="startDate" label="开工日期" width="140" />
        <el-table-column prop="finishDate" label="完工日期" width="140" />
        <el-table-column prop="statusName" label="状态" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.statusName)" size="small">
              {{ row.statusName || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="closeTypeName"
          label="结案方式"
          width="90"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="handleDetail(row)" :icon="'View'">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && dataLoaded && filteredData.length === 0"
        :description="hasLocalFilter ? '没有符合筛选条件的工单记录' : '当前条件无工单数据'"
        :image-size="80"
      />
      <el-empty
        v-if="!loading && !dataLoaded && !selectedWorkshopNumber"
        description="请在上方选择车间并点击查询"
        :image-size="80"
      />

      <!-- 分页 -->
      <div
        v-if="dataLoaded && filteredData.length > 0"
        class="mt-4 flex items-center justify-between"
      >
        <div class="text-sm text-gray-500">
          显示
          {{ (pageIndex - 1) * pageSize + 1 }}
          -
          {{ Math.min(pageIndex * pageSize, filteredData.length) }}
          条，共 {{ filteredData.length }} 条
        </div>
        <el-pagination
          v-model:current-page="pageIndex"
          v-model:page-size="pageSize"
          :total="filteredData.length"
          :page-sizes="[20, 50, 100, 200]"
          :pager-count="5"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 物料选择弹窗 -->
    <MaterialSelectDialog
      v-model:visible="materialDialogVisible"
      :selected="localFilter.materialNumbers"
      @confirm="handleMaterialConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

:deep(.el-table) {
  .cell {
    white-space: nowrap;
  }
}
</style>
