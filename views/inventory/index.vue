<script lang="ts" setup>
/**
 * 库存查询页面 - 优化版
 *
 * 流程：
 * 1. 页面加载 → 仅显示仓库选择器（位于标题右侧、查询按钮左侧）
 * 2. 选择仓库 → 自动向ERP发起全仓查询 → Redis缓存 → 展示数据
 * 3. 条件筛选 → 本地快速过滤（实时响应，无需点击查询按钮）
 *
 * 核心逻辑：
 * - 初始查询：ERP → 选定仓库全量数据 → Redis缓存
 * - 后续筛选：本地缓存/Redis → 快速条件筛选
 * - 数据隔离：只能访问当前组织（localStorage中mes_current_org_id）对应仓库
 * - 性能优化：避免重复ERP查询，充分利用缓存
 */
import { onMounted, reactive, ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MaterialSelectDialog from '#/components/MaterialSelectDialog.vue';
import { useErpAcctStore } from '#/store';
import {
  exportInventoryExcel,
  queryInventory,
  type InventoryQueryParams,
  type InventoryItem,
  getMaterialCode,
  getMaterialName,
  getMaterialModel,
  getStockNumber,
  getStockName,
  getStockLoc,
  getLotNo,
  getUnit,
  getQty,
  getAvailableQty,
  getLockQty,
} from '#/api/inventory';
import { getOrganizationById, getOrganizations, getWarehouses, type ErpWarehouse } from '#/api/erpData';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'InventoryQuery' });

const erpAcctStore = useErpAcctStore();

// ===================================================================
// 状态定义
// ===================================================================

// 加载状态
const loading = ref(false);
const exportLoading = ref(false);
const warehouseListLoading = ref(false);

// 表格数据
/** 本地缓存全量数据（来自Redis/ERP） */
const allCachedData = ref<InventoryItem[]>([]);
/** 全量数据总数 */
const totalCount = ref(0);
const pageIndex = ref(1);
const pageSize = ref(50);

// ===================================================================
// 组织与仓库
// ===================================================================

const erpOrgId = ref<string>('');         // ERP 组织 ID（如 "100071"）
const erpOrgNumber = ref<string>('');     // ERP 组织编码（如 "001"），用于查询
const warehouseOptions = ref<ErpWarehouse[]>([]); // Redis 全局仓库列表
const selectedWarehouseNumbers = ref<string[]>([]);  // 选中的仓库编码（多选）
const warehouseInitialized = ref(false);  // 仓库列表是否已初始化
const dataLoaded = ref(false);            // 仓库数据是否已加载

// ===================================================================
// 筛选条件（第二阶段：仓库数据加载完成后显示）
// ===================================================================

const showFilters = ref(false);
const filterForm = reactive({
  erpAcctCode: '',
  /** 选中的物料编码列表（多选） */
  materialNumbers: [] as string[],
  /** 物料编码/物料名称/规格型号模糊搜索 */
  keyword: '',
  /** 批次号 */
  lotNo: '',
});

// 物料选择弹窗
const materialDialogVisible = ref(false);
const selectedMaterials = ref<{ number: string; name: string; specification: string }[]>([]);

// ===================================================================
// 计算属性
// ===================================================================

// 物料标签（用于显示已选物料）
const selectedMaterialTags = computed(() => {
  return selectedMaterials.value.map((m) => ({
    number: m.number,
    label: `${m.number} - ${m.name}`,
  }));
});

// 是否有筛选条件
const hasFilterCondition = computed(() => {
  return (
    filterForm.materialNumbers.length > 0 ||
    filterForm.keyword.trim() !== '' ||
    filterForm.lotNo.trim() !== ''
  );
});

// 筛选条件描述
const filterConditionDesc = computed(() => {
  const conditions: string[] = [];
  if (filterForm.materialNumbers.length > 0) {
    conditions.push(`物料(${filterForm.materialNumbers.length}个)`);
  }
  if (filterForm.keyword.trim()) {
    conditions.push(`关键字:${filterForm.keyword.trim()}`);
  }
  if (filterForm.lotNo.trim()) {
    conditions.push(`批次号:${filterForm.lotNo.trim()}`);
  }
  return conditions.join(' + ');
});

// 本地筛选后的数据（实时响应，无需点击查询按钮）
const filteredData = computed(() => {
  let result = [...allCachedData.value];

  // 1. 过滤库存为0的记录
  result = result.filter((item) => getQty(item) > 0);

  // 2. 物料编码多选筛选
  if (filterForm.materialNumbers.length > 0) {
    const codeSet = new Set(filterForm.materialNumbers);
    result = result.filter((item) => codeSet.has(getMaterialCode(item)));
  }

  // 3. 关键字模糊搜索（物料编码/物料名称/规格型号）
  if (filterForm.keyword.trim()) {
    const kw = filterForm.keyword.trim().toLowerCase();
    result = result.filter((item) => {
      return (
        getMaterialCode(item).toLowerCase().includes(kw) ||
        getMaterialName(item).toLowerCase().includes(kw) ||
        getMaterialModel(item).toLowerCase().includes(kw)
      );
    });
  }

  // 4. 批次号模糊搜索
  if (filterForm.lotNo.trim()) {
    const kw = filterForm.lotNo.trim().toLowerCase();
    result = result.filter((item) => getLotNo(item).toLowerCase().includes(kw));
  }

  return result;
});

// 当前页数据
const pagedData = computed(() => {
  const start = (pageIndex.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredData.value.slice(start, end);
});

// 当前选中仓库的显示名称
const selectedWarehouseLabel = computed(() => {
  if (selectedWarehouseNumbers.value.length === 0) return '';
  const names = selectedWarehouseNumbers.value.map((num) => {
    const w = warehouseOptions.value.find((item) => item.warehouseNumber === num);
    return w ? `${w.warehouseNumber} - ${w.warehouseName}` : num;
  });
  if (names.length <= 2) return names.join('、');
  return `${names.length}个仓库（${names[0]} 等）`;
});

// ===================================================================
// 初始化：加载组织与仓库列表
// ===================================================================

/**
 * 初始化组织信息
 * 1. 从 localStorage 获取 erpOrgId（mes_current_org_id）
 * 2. 调用 API 获取组织详情（取得 erpOrgNumber）
 * 3. 加载 Redis 全局仓库列表（mes:erp:warehouse:list）
 */
const initOrgInfo = async () => {
  let orgId = '';
  const savedOrgId = localStorage.getItem('mes_current_org_id');
  if (savedOrgId) {
    orgId = savedOrgId;
    console.log('[库存查询] 从localStorage获取到组织ID:', orgId);
  }

  if (orgId) {
    try {
      const resp = await getOrganizationById(orgId);
      if (resp.success && resp.data) {
        erpOrgId.value = resp.data.erpOrgId;
        erpOrgNumber.value = resp.data.erpOrgNumber;
        console.log('[库存查询] 获取组织详情成功:', {
          erpOrgId: erpOrgId.value,
          erpOrgNumber: erpOrgNumber.value,
        });
        // 仓库下拉来自 Redis 全局仓库列表，组织仅用于库存查询入参。
        await loadWarehouses();
        tryRestoreFromCache();
        return;
      }
    } catch (error) {
      console.error('[库存查询] 获取组织详情失败:', error);
    }
  }

  // 降级：尝试获取默认组织
  try {
    const resp = await getOrganizations();
    if (resp.success) {
      const org = resp.defaultOrg || (resp.data?.length > 0 ? resp.data[0] : null);
      if (org) {
        erpOrgId.value = org.erpOrgId;
        erpOrgNumber.value = org.erpOrgNumber;
        localStorage.setItem('mes_current_org_id', org.erpOrgId);
        console.log('[库存查询] 使用默认组织:', {
          erpOrgId: erpOrgId.value,
          erpOrgNumber: erpOrgNumber.value,
        });
      }
    }
  } catch (error) {
    console.error('[库存查询] 获取组织列表失败:', error);
  } finally {
    if (!warehouseInitialized.value) {
      await loadWarehouses();
    }
    tryRestoreFromCache();
    warehouseInitialized.value = true;
  }
};

/**
 * 加载 Redis 全局仓库列表（mes:erp:warehouse:list）
 */
const loadWarehouses = async () => {
  warehouseListLoading.value = true;
  try {
    const resp = await getWarehouses();
    // requestClient 设置了 responseReturn: 'data'，所以 resp 直接是 data 字段
    if (Array.isArray(resp)) {
      warehouseOptions.value = resp;
    } else if (resp && Array.isArray((resp as any).data)) {
      // 兼容不同响应格式
      warehouseOptions.value = (resp as any).data;
    }
    console.log('[库存查询] 加载仓库列表成功:', warehouseOptions.value.length, '个仓库');
  } catch (error) {
    console.error('[库存查询] 加载仓库列表失败:', error);
    warehouseOptions.value = [];
  } finally {
    warehouseListLoading.value = false;
    warehouseInitialized.value = true;
  }
};

// ===================================================================
// 核心数据加载
// ===================================================================

/**
 * 仓库选择变化 - 立即向ERP发起全仓查询
 * @param warehouseNumbers 选中仓库编码的数组
 */
const handleWarehouseChange = async (warehouseNumbers: string[]) => {
  // 限制最多选择5个仓库
  if (warehouseNumbers.length > 5) {
    selectedWarehouseNumbers.value = warehouseNumbers.slice(0, 5);
    ElMessage.warning('最多只能选择5个仓库');
    return;
  }

  // 如果清空了选择，回到阶段一
  if (warehouseNumbers.length === 0) {
    handleReset();
    return;
  }

  selectedWarehouseNumbers.value = warehouseNumbers;
  const stockNumberParam = warehouseNumbers.join(',');

  loading.value = true;
  dataLoaded.value = false;
  showFilters.value = false;

  // 重置分页与筛选
  pageIndex.value = 1;
  clearAllFilters();

  try {
    const params: InventoryQueryParams = {
      erpAcctCode: filterForm.erpAcctCode || erpAcctStore.acctCode || '',
      erpOrgId: erpOrgNumber.value || erpOrgId.value || undefined,
      stockNumber: stockNumberParam,
      pageIndex: 1,
      pageSize: 5000, // 大分页获取全量数据
      isShowStockLoc: true,
    };

    console.log('[库存查询] 加载仓库库存:', stockNumberParam, params);
    const res = await queryInventory(params);
    const items = res?.data || [];

    // 缓存全量数据到本地
    allCachedData.value = items;
    totalCount.value = items.length;
    dataLoaded.value = true;
    showFilters.value = true;
    saveInventoryCache();

    console.log(`[库存查询] 已加载 ${items.length} 条库存数据`);
    ElMessage.success(`已加载库存数据（${items.length} 条）`);
  } catch (error) {
    console.error('[库存查询] 加载库存失败:', error);
    ElMessage.error('加载库存数据失败，请重试');
    allCachedData.value = [];
    dataLoaded.value = false;
  } finally {
    loading.value = false;
  }
};

// ===================================================================
// 筛选操作
// ===================================================================

/**
 * 打开物料选择弹窗
 */
const openMaterialDialog = () => {
  materialDialogVisible.value = true;
};

/**
 * 物料选择确认
 */
const handleMaterialConfirm = (items: { number: string; name: string; specification: string }[]) => {
  selectedMaterials.value = items;
  filterForm.materialNumbers = items.map((m) => m.number);
};

/**
 * 移除已选物料
 */
const removeMaterial = (number: string) => {
  selectedMaterials.value = selectedMaterials.value.filter((m) => m.number !== number);
  filterForm.materialNumbers = selectedMaterials.value.map((m) => m.number);
};

/**
 * 清空所有物料选择
 */
const clearAllMaterials = () => {
  selectedMaterials.value = [];
  filterForm.materialNumbers = [];
};

/**
 * 清空所有筛选条件
 */
const clearAllFilters = () => {
  filterForm.materialNumbers = [];
  filterForm.keyword = '';
  filterForm.lotNo = '';
  selectedMaterials.value = [];
  pageIndex.value = 1;
};

/**
 * 重置：清空筛选并回到阶段一（仅仓库选择）
 */
const handleReset = () => {
  selectedWarehouseNumbers.value = [];
  allCachedData.value = [];
  totalCount.value = 0;
  dataLoaded.value = false;
  showFilters.value = false;
  clearAllFilters();
  clearInventoryCache();
};

// ===================================================================
// 刷新操作
// ===================================================================

/**
 * 查看查询统计
 */
const buildInventoryExportParams = (): InventoryQueryParams => ({
  erpAcctCode: filterForm.erpAcctCode || erpAcctStore.acctCode || '',
  erpOrgId: erpOrgNumber.value || erpOrgId.value || undefined,
  stockNumber: selectedWarehouseNumbers.value.length > 0 ? selectedWarehouseNumbers.value.join(',') : undefined,
  materialNumbers: filterForm.materialNumbers.length > 0 ? filterForm.materialNumbers : undefined,
  lotNo: filterForm.lotNo.trim() || undefined,
  pageIndex: 1,
  pageSize: 10000,
  isShowStockLoc: true,
});

const handleExport = async () => {
  if (selectedWarehouseNumbers.value.length === 0) {
    ElMessage.warning('请先选择仓库');
    return;
  }
  exportLoading.value = true;
  try {
    const blob = await exportInventoryExcel(buildInventoryExportParams());
    downloadBlob(blob, '库存查询导出.xlsx');
  } catch (error) {
    console.error(error);
    ElMessage.error('导出库存失败');
  } finally {
    exportLoading.value = false;
  }
};

const showQueryStats = () => {
  ElMessageBox.alert(
    `<div style="line-height: 1.8">
      <div><strong>组织编码：</strong>${erpOrgNumber.value || '-'}</div>
      <div><strong>当前仓库：</strong>${selectedWarehouseLabel.value || '-'}</div>
      <div><strong>缓存总数：</strong>${totalCount.value} 条</div>
      <div><strong>有效库存（库存>0）：</strong>${allCachedData.value.filter((item) => getQty(item) > 0).length} 条</div>
      <div><strong>筛选后记录：</strong>${filteredData.value.length} 条</div>
      <div v-if="hasFilterCondition"><strong>筛选条件：</strong>${filterConditionDesc.value || '无'}</div>
    </div>`,
    '查询统计',
    {
      confirmButtonText: '确定',
      dangerouslyUseHTMLString: true,
    },
  );
};

// ===================================================================
// 分页
// ===================================================================

const handleSizeChange = () => {
  pageIndex.value = 1;
};

const handlePageChange = () => {
  // 前端分页
};

// ===================================================================
// 工具函数
// ===================================================================

const formatNumber = (val: number | undefined | null) => {
  if (val === null || val === undefined) return '-';
  return Number(val).toLocaleString();
};

// ===================================================================
// sessionStorage 持久化（KeepAlive 兜底方案）
// ===================================================================
const INVENTORY_CACHE_KEY = 'inventory_query_cache';

interface InventoryCache {
  acctCode?: string;
  allCachedData: InventoryItem[];
  selectedWarehouseNumbers: string[];
  totalCount: number;
  dataLoaded: boolean;
  showFilters: boolean;
  cacheTime: number;
}

function saveInventoryCache(): void {
  const cache: InventoryCache = {
    acctCode: filterForm.erpAcctCode || erpAcctStore.acctCode || '',
    allCachedData: allCachedData.value,
    selectedWarehouseNumbers: selectedWarehouseNumbers.value,
    totalCount: totalCount.value,
    dataLoaded: dataLoaded.value,
    showFilters: showFilters.value,
    cacheTime: Date.now(),
  };
  sessionStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(cache));
}

function clearInventoryCache(): void {
  sessionStorage.removeItem(INVENTORY_CACHE_KEY);
}

function restoreInventoryCache(): InventoryCache | null {
  try {
    const raw = sessionStorage.getItem(INVENTORY_CACHE_KEY);
    if (!raw) return null;
    const cache: InventoryCache = JSON.parse(raw);
    if ((cache as any).acctCode && (cache as any).acctCode !== (erpAcctStore.acctCode || '')) {
      sessionStorage.removeItem(INVENTORY_CACHE_KEY);
      return null;
    }
    // 缓存30分钟内有效
    if (cache.cacheTime && Date.now() - cache.cacheTime < 30 * 60 * 1000) {
      return cache;
    }
    sessionStorage.removeItem(INVENTORY_CACHE_KEY); // 过期清理
    return null;
  } catch {
    return null;
  }
}

function tryRestoreFromCache(): void {
  const cache = restoreInventoryCache();
  if (!cache) return;
  if ((cache as any).acctCode && (cache as any).acctCode !== (erpAcctStore.acctCode || '')) {
    clearInventoryCache();
    return;
  }
  // 检查缓存的仓库是否在当前仓库列表中
  if (cache.selectedWarehouseNumbers.length > 0) {
    const allExist = cache.selectedWarehouseNumbers.every((num) =>
      warehouseOptions.value.some((w) => w.warehouseNumber === num),
    );
    if (allExist) {
      selectedWarehouseNumbers.value = cache.selectedWarehouseNumbers;
      allCachedData.value = cache.allCachedData;
      totalCount.value = cache.totalCount;
      dataLoaded.value = true;
      showFilters.value = true;
      console.log(
        '[库存查询] 从sessionStorage恢复缓存数据:',
        cache.allCachedData.length,
        '条',
      );
    }
  }
}

// ===================================================================
// 生命周期
// ===================================================================

onMounted(() => {
  filterForm.erpAcctCode = erpAcctStore.acctCode || '';
  initOrgInfo();
});
</script>

<template>
  <div class="p-5">
    <!-- ================================================================ -->
    <!-- 页面标题 + 仓库选择 + 操作按钮（始终显示）                         -->
    <!-- ================================================================ -->
    <div class="mb-4 flex items-center gap-3">
      <!-- 标题 -->
      <h1 class="text-lg font-semibold whitespace-nowrap">库存查询</h1>

      <!-- 仓库选择（位于标题右侧、按钮左侧，尽可能宽，支持多选） -->
      <div class="w-28 shrink-0">
        <el-select v-model="filterForm.erpAcctCode" placeholder="账套" @change="handleReset">
          <el-option :label="erpAcctStore.acctCode || '请选择账套'" :value="erpAcctStore.acctCode || ''" />
        </el-select>
      </div>

      <div class="flex-1 min-w-0">
        <el-select
          v-model="selectedWarehouseNumbers"
          placeholder="请选择仓库以加载库存数据"
          multiple
          filterable
          clearable
          :loading="warehouseListLoading"
          :disabled="loading"
          style="width: 100%"
          @change="handleWarehouseChange"
        >
          <el-option
            v-for="w in warehouseOptions"
            :key="w.warehouseNumber"
            :label="`${w.warehouseNumber} - ${w.warehouseName}`"
            :value="w.warehouseNumber"
          />
        </el-select>
      </div>

      <!-- 操作按钮组 -->
      <div class="flex items-center gap-2 whitespace-nowrap">
        <el-button
          v-if="dataLoaded"
          type="primary"
          :loading="loading"
          @click="handleWarehouseChange(selectedWarehouseNumbers)"
        >
          <i class="i-ep-search mr-1" />
          查询
        </el-button>
        <el-button @click="handleReset">
          <i class="i-ep-refresh mr-1" />
          重置
        </el-button>
        <el-button
          v-if="dataLoaded && filteredData.length > 0"
          :loading="exportLoading"
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

    <!-- 仓库信息提示 -->
    <div v-if="selectedWarehouseNumbers.length > 0 && !dataLoaded && !loading" class="mb-4 text-sm text-gray-400">
      <i class="i-ep-info-filled mr-1" />
      请等待数据加载完成
    </div>

    <!-- ================================================================ -->
    <!-- 筛选条件卡片（第二阶段：仓库数据加载完成后显示）                   -->
    <!-- ================================================================ -->
    <el-card v-if="showFilters && dataLoaded" shadow="never" class="mb-4">
      <div class="grid grid-cols-12 gap-4">
        <!-- 物料编码选择（5列） -->
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
              点击下方按钮选择物料（支持多选和模糊搜索）
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

        <!-- 模糊搜索（4列） -->
        <div class="col-span-4">
          <label class="mb-1 block text-sm text-gray-600">物料编码/名称/规格型号</label>
          <el-input
            v-model="filterForm.keyword"
            placeholder="输入关键字模糊搜索"
            clearable

          >
            <template #prefix>
              <i class="i-ep-search" />
            </template>
          </el-input>
        </div>

        <!-- 批次号（3列） -->
        <div class="col-span-3">
          <label class="mb-1 block text-sm text-gray-600">批次号</label>
          <el-input
            v-model="filterForm.lotNo"
            placeholder="输入批次号"
            clearable
          />
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="mt-3">
        <div class="flex items-center text-sm text-gray-400">
          <i class="i-ep-info-filled mr-1" />
          <span v-if="hasFilterCondition">
            当前筛选：{{ filterConditionDesc }}
          </span>
          <span v-else>所有筛选均为本地实时过滤，无需点击查询按钮</span>
          <span class="ml-3 text-xs text-gray-300">
            仓库：{{ selectedWarehouseLabel }}
          </span>
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
          <span class="font-medium text-gray-800">{{ filteredData.length }}</span> 条
          <span v-if="totalCount > filteredData.length" class="text-gray-400">
            （已从 {{ totalCount }} 条中筛选，
            <template v-if="hasFilterCondition">含条件过滤</template>
            <template v-else>已排除库存为0的记录</template>
            ）
          </span>
          <span v-if="hasFilterCondition" class="ml-2 text-primary text-xs">
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
      >
        <el-table-column prop="fmaterialNumber" label="物料编码" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ getMaterialCode(row) }}</template>
        </el-table-column>
        <el-table-column prop="fmaterialName" label="物料名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ getMaterialName(row) }}</template>
        </el-table-column>
        <el-table-column prop="fmaterialModel" label="规格型号" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ getMaterialModel(row) }}</template>
        </el-table-column>
        <el-table-column prop="fstockNumber" label="仓库编码" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ getStockNumber(row) }}</template>
        </el-table-column>
        <el-table-column prop="fstockName" label="仓库名称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ getStockName(row) }}</template>
        </el-table-column>
        <el-table-column prop="fstockLoc" label="库位" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ getStockLoc(row) }}</template>
        </el-table-column>
        <el-table-column prop="flotNumber" label="批次号" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ getLotNo(row) }}</template>
        </el-table-column>
        <el-table-column prop="fbaseUnitName" label="单位" width="70" align="center">
          <template #default="{ row }">{{ getUnit(row) }}</template>
        </el-table-column>
        <el-table-column prop="fqty" label="库存数量" width="110" align="right">
          <template #default="{ row }">
            <span class="font-medium">{{ formatNumber(getQty(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="favbQty" label="可用数量" width="110" align="right">
          <template #default="{ row }">
            <span class="font-medium text-success">{{ formatNumber(getAvailableQty(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="flockQty" label="锁定数量" width="100" align="right">
          <template #default="{ row }">
            <span class="text-warning">{{ formatNumber(getLockQty(row)) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && dataLoaded && filteredData.length === 0"
        :description="hasFilterCondition ? '没有符合筛选条件的库存记录' : '当前仓库无有效库存数据'"
        :image-size="80"
      />
      <el-empty
        v-if="!loading && !dataLoaded && selectedWarehouseNumbers.length === 0"
        description="请在上方选择一个仓库以加载库存数据"
        :image-size="80"
      />

      <!-- 分页 -->
      <div v-if="dataLoaded && filteredData.length > 0" class="mt-4 flex items-center justify-between">
        <div class="text-sm text-gray-500">
          显示 {{ (pageIndex - 1) * pageSize + 1 }} - {{ Math.min(pageIndex * pageSize, filteredData.length) }} 条，
          共 {{ filteredData.length }} 条
        </div>
        <el-pagination
          v-model:current-page="pageIndex"
          v-model:page-size="pageSize"
          :total="filteredData.length"
          :page-sizes="[20, 50, 100, 200, 500]"
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
      :selected="filterForm.materialNumbers"
      @confirm="handleMaterialConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-table) {
  .cell {
    white-space: nowrap;
  }
}

:deep(.el-tag) {
  max-width: 130px;
  .el-tag__content {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
