<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import {
  getErpMouldList,
  refreshMouldCache,
  getMouldCost,
  getMouldBusiness,
  createMouldCost,
  deleteMouldCost,
  getMouldDocumentList,
  deleteMouldDocument,
  getDocumentFileInfo,
  uploadMouldDocument,
  type MouldItem,
  type MouldCostItem,
  type MouldBusinessItem,
  type MouldDocumentItem,
} from '#/api/mould';
import { openDocumentPreview } from '#/utils/documentPreview';

defineOptions({ name: 'ProductionMould' });

// ============ 搜索条件 ============
const searchMouldCode = ref('');
const searchMouldName = ref('');
const searchOwnerName = ref('');
const searchStatus = ref('');
const searchProduceType = ref('');
const searchProduceMaterialType = ref('');
const refreshLoading = ref(false);

// ============ 表格数据 ============
const loading = ref(false);
const allData = ref<MouldItem[]>([]);
const currentPage = ref(1);
const pageSize = ref(50);

const filteredData = computed(() => {
  let data = allData.value;
  if (searchMouldCode.value) {
    const kw = searchMouldCode.value.toLowerCase();
    data = data.filter(item => item.mouldCode?.toLowerCase().includes(kw));
  }
  if (searchMouldName.value) {
    const kw = searchMouldName.value.toLowerCase();
    data = data.filter(item => item.mouldName?.toLowerCase().includes(kw));
  }
  if (searchOwnerName.value) {
    const kw = searchOwnerName.value.toLowerCase();
    data = data.filter(item => item.ownerName?.toLowerCase().includes(kw));
  }
  if (searchStatus.value) {
    data = data.filter(item => item.status === searchStatus.value);
  }
  if (searchProduceType.value) {
    data = data.filter(item => {
      if (!item.produceType) return false;
      return item.produceType.split(',').some(t => t.trim() === searchProduceType.value);
    });
  }
  if (searchProduceMaterialType.value) {
    data = data.filter(item => item.produceMaterialType === searchProduceMaterialType.value);
  }
  return data;
});

const filteredTotal = computed(() => filteredData.value.length);
const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredData.value.slice(start, end);
});

// ============ 抽屉面板 ============
const drawerVisible = ref(false);
const currentMould = ref<MouldItem | null>(null);
const activeTab = ref('basic');

// ============ 基本信息 ============
const getStatusType = (status: string) => {
  const map: Record<string, string> = { ZC: 'success', YMC: 'warning', YMR: 'info', SZ: 'danger', DZ: 'warning' };
  return map[status] || '';
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = { ZC: '正常', YMC: '移模出', YMR: '移模入', SZ: '寿终', DZ: '呆滞' };
  return map[status] || status;
};

const getProduceTypeText = (type: string) => {
  if (!type) return '';
  const map: Record<string, string> = { GYWW: '工艺委外', WG: '外购', ZZ: '自制' };
  return type.split(',').map(t => map[t] || t).join(',');
};

const getProduceMaterialTypeText = (type: string) => {
  if (!type) return '';
  const map: Record<string, string> = { CY: '冲压', ZS: '注塑', YZ: '压铸', LJ: '铝挤', XSP: '吸塑盘', ZD: '载带', QT: '其他' };
  return type.split(',').map(t => map[t] || t).join(',');
};

// ============ 成本信息 ============
const costData = ref<MouldCostItem[]>([]);
const costLoading = ref(false);
const costErpCount = ref(0);
const costMesCount = ref(0);
const costForm = ref({
  mouldCode: '',
  materialCode: '',
  specification: '',
  costType: '',
  quantity: 0,
  unitPrice: 0,
  amount: 0,
  sourceBill: '',
  remark: ''
});
const addCostDialogVisible = ref(false);
const addCostLoading = ref(false);

const getCostTypeText = (type: string) => {
  const map: Record<string, string> = { XMCG: '修模采购', XMWW: '修模委外', KMCG: '开模采购', KMWW: '开模委外' };
  return map[type] || type;
};

// ============ 业务记录 ============
const businessData = ref<MouldBusinessItem[]>([]);
const businessLoading = ref(false);
const businessTotal = ref(0);
const businessPage = ref(1);
const businessPageSize = ref(20);
const businessMesCount = ref(0);
const businessErpCount = ref(0);

const getBusinessTypeText = (type: string) => {
  const map: Record<string, string> = { SCSJ: '生产上机', BY: '保养', XM: '修模', LSJL: '历史记录', PD: '盘点' };
  return map[type] || type;
};

// ============ 档案资料 ============
const documentData = ref<MouldDocumentItem[]>([]);
const documentLoading = ref(false);
const addDocumentDialogVisible = ref(false);
const addDocumentLoading = ref(false);
const fileList = ref<any[]>([]);
const selectedFile = ref<File | null>(null);
const documentForm = ref({
  mouldCode: '',
  docName: '',
  docType: '',
  filePath: '',
  fileSize: 0,
  fileExt: '',
  remark: ''
});

const getDocTypeText = (type: string) => {
  const map: Record<string, string> = { IMAGE: '图片', DOCUMENT: '文档', VIDEO: '视频', OTHER: '其他' };
  return map[type] || type;
};

const previewLoading = ref(false);

// ============ 工具函数 ============
const formatDate = (dateStr: string | number | null | undefined) => {
  if (dateStr == null) return '';
  const str = String(dateStr);
  if (str.includes('T')) return str.split('T')[0];
  return str;
};

const formatDateTime = (dateStr: string | number | null | undefined) => {
  if (dateStr == null) return '';
  const str = String(dateStr);
  if (str.includes('T')) return str.replace('T', ' ').substring(0, 19);
  return str;
};

const formatNumber = (val: number | null | undefined) => {
  if (val == null) return '';
  return Number(val).toFixed(2);
};

const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const isMaintainWarning = (dateStr: string | null | undefined) => {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  } catch {
    return false;
  }
};

// ============ 路由 ============
const router = useRouter();
const goToSyncMonitor = () => {
  router.push('/production/mould-sync');
};

// ============ 数据加载 ============
const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getErpMouldList();
    if (res.success) {
      allData.value = res.data || [];
      currentPage.value = 1;
    }
  } catch (error) {
    console.error('加载模具列表失败:', error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
};

const handleReset = () => {
  searchMouldCode.value = '';
  searchMouldName.value = '';
  searchOwnerName.value = '';
  searchStatus.value = '';
  searchProduceType.value = '';
  searchProduceMaterialType.value = '';
  currentPage.value = 1;
};

const handleRefreshCache = async () => {
  refreshLoading.value = true;
  try {
    const res: any = await refreshMouldCache();
    if (res.success) {
      ElMessage.success(res.message || '缓存刷新成功');
      loadData();
    } else {
      ElMessage.error(res.message || '刷新失败');
    }
  } catch (error) {
    console.error('刷新缓存失败:', error);
    ElMessage.error('刷新缓存失败');
  } finally {
    refreshLoading.value = false;
  }
};

// ============ 点击行展开抽屉 ============
const handleRowClick = async (row: MouldItem) => {
  currentMould.value = row;
  activeTab.value = 'basic';
  drawerVisible.value = true;
  const mouldCode = row.mouldCode;
  if (mouldCode) {
    loadCostData(mouldCode);
    loadBusinessData(mouldCode);
    loadDocumentData(mouldCode);
  }
};

const loadCostData = async (mouldCode: string) => {
  costLoading.value = true;
  try {
    const res: any = await getMouldCost(mouldCode, 1, 50);
    if (res.success) {
      costData.value = res.data || [];
      costErpCount.value = res.erpCount || 0;
      costMesCount.value = res.mesCount || 0;
    }
  } catch (error) {
    console.error('加载模具成本信息失败:', error);
  } finally {
    costLoading.value = false;
  }
};

const loadBusinessData = async (mouldCode?: string) => {
  const code = mouldCode || currentMould.value?.mouldCode;
  if (!code) return;
  businessLoading.value = true;
  try {
    const res: any = await getMouldBusiness({ mouldNumber: code, page: businessPage.value, pageSize: businessPageSize.value });
    if (res.success) {
      businessData.value = res.data || [];
      businessTotal.value = res.total || 0;
      businessMesCount.value = res.mesCount || 0;
      businessErpCount.value = res.erpCount || 0;
    }
  } catch (error) {
    console.error('加载模具业务记录失败:', error);
  } finally {
    businessLoading.value = false;
  }
};

const loadDocumentData = async (mouldCode: string) => {
  documentLoading.value = true;
  try {
    const res: any = await getMouldDocumentList(mouldCode);
    if (res.success) {
      documentData.value = res.data || [];
    }
  } catch (error) {
    console.error('加载档案资料失败:', error);
  } finally {
    documentLoading.value = false;
  }
};

// ============ 新增成本记录 ============
const showAddCostDialog = () => {
  costForm.value = {
    mouldCode: currentMould.value?.mouldCode || '',
    materialCode: '',
    specification: '',
    costType: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    sourceBill: '',
    remark: ''
  };
  addCostDialogVisible.value = true;
};

const handleAddCost = async () => {
  if (!costForm.value.materialCode || !costForm.value.costType) {
    ElMessage.warning('请填写物料代码和费用类型');
    return;
  }
  addCostLoading.value = true;
  try {
    const res: any = await createMouldCost(costForm.value);
    if (res.success) {
      ElMessage.success('新增成功');
      addCostDialogVisible.value = false;
      if (currentMould.value?.mouldCode) {
        loadCostData(currentMould.value.mouldCode);
      }
    } else {
      ElMessage.error(res.message || '新增失败');
    }
  } catch (error) {
    console.error('新增模具成本记录失败:', error);
    ElMessage.error('新增失败');
  } finally {
    addCostLoading.value = false;
  }
};

const handleDeleteCost = async (row: MouldCostItem) => {
  try {
    await ElMessageBox.confirm('确定要删除该MES成本记录吗？', '提示', { type: 'warning' });
    const res: any = await deleteMouldCost(row.id!);
    if (res.success) {
      ElMessage.success('删除成功');
      if (currentMould.value?.mouldCode) {
        loadCostData(currentMould.value.mouldCode);
      }
    } else {
      ElMessage.error(res.message || '删除失败');
    }
  } catch {
    // 取消操作
  }
};

// ============ 档案资料操作 ============
const showAddDocumentDialog = () => {
  documentForm.value = {
    mouldCode: currentMould.value?.mouldCode || '',
    docName: '',
    docType: '',
    filePath: '',
    fileSize: 0,
    fileExt: '',
    remark: ''
  };
  fileList.value = [];
  selectedFile.value = null;
  addDocumentDialogVisible.value = true;
};

const handleFileChange = (file: any, files: any[]) => {
  selectedFile.value = file.raw;
  fileList.value = files;
};

const handleFileRemove = () => {
  selectedFile.value = null;
  fileList.value = [];
};

const handleAddDocument = async () => {
  if (!documentForm.value.docName || !documentForm.value.docType) {
    ElMessage.warning('请填写资料名称和资料类型');
    return;
  }
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的文件');
    return;
  }
  addDocumentLoading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('mouldCode', documentForm.value.mouldCode);
    formData.append('docName', documentForm.value.docName);
    formData.append('docType', documentForm.value.docType);
    if (documentForm.value.remark) {
      formData.append('remark', documentForm.value.remark);
    }
    const res: any = await uploadMouldDocument(formData);
    if (res.success) {
      ElMessage.success('上传成功');
      addDocumentDialogVisible.value = false;
      if (currentMould.value?.mouldCode) {
        loadDocumentData(currentMould.value.mouldCode);
      }
    } else {
      ElMessage.error(res.message || '上传失败');
    }
  } catch (error: any) {
    console.error('上传档案资料失败:', error);
    ElMessage.error(error.response?.data?.message || '上传失败');
  } finally {
    addDocumentLoading.value = false;
  }
};

const handlePreviewDocument = async (row: MouldDocumentItem) => {
  if (!row.id || !row.filePath) {
    ElMessage.warning('该资料暂无文件路径，无法预览');
    return;
  }
  previewLoading.value = true;
  try {
    const res: any = await getDocumentFileInfo(row.id);
    if (res.success && res.data) {
      const fileInfo = res.data;
      await openDocumentPreview({
        documentId: fileInfo.id,
        fileExt: fileInfo.fileExt,
        fileName: fileInfo.fileName,
        source: 'mould-document',
        url: `/api/uploads/${fileInfo.filePath}`,
      });
    } else {
      ElMessage.error(res.message || '获取文件信息失败');
    }
  } catch (error: any) {
    console.error('获取文件信息失败:', error);
    ElMessage.error('获取文件信息失败');
  } finally {
    previewLoading.value = false;
  }
};

const handleDeleteDocument = async (row: MouldDocumentItem) => {
  try {
    await ElMessageBox.confirm('确定要删除该档案资料吗？', '提示', { type: 'warning' });
    const res: any = await deleteMouldDocument(row.id!);
    if (res.success) {
      ElMessage.success('删除成功');
      if (currentMould.value?.mouldCode) {
        loadDocumentData(currentMould.value.mouldCode);
      }
    } else {
      ElMessage.error(res.message || '删除失败');
    }
  } catch {
    // 取消操作
  }
};

// ============ 初始化 ============
onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="mould-container">
    <!-- 搜索区域 -->
    <div class="search-area">
      <el-input v-model="searchMouldCode" placeholder="模具编码" clearable style="width: 140px" @keyup.enter="handleSearch" />
      <el-input v-model="searchMouldName" placeholder="模具名称" clearable style="width: 140px; margin-left: 8px" @keyup.enter="handleSearch" />
      <el-input v-model="searchOwnerName" placeholder="模具归属" clearable style="width: 140px; margin-left: 8px" @keyup.enter="handleSearch" />
      <el-select v-model="searchStatus" placeholder="状态" clearable style="width: 110px; margin-left: 8px">
        <el-option label="正常" value="ZC" />
        <el-option label="移模出" value="YMC" />
        <el-option label="移模入" value="YMR" />
        <el-option label="寿终" value="SZ" />
        <el-option label="呆滞" value="DZ" />
      </el-select>
      <el-select v-model="searchProduceType" placeholder="产出方式" clearable style="width: 120px; margin-left: 8px">
        <el-option label="工艺委外" value="GYWW" />
        <el-option label="外购" value="WG" />
        <el-option label="自制" value="ZZ" />
      </el-select>
      <el-select v-model="searchProduceMaterialType" placeholder="产出物料类型" clearable style="width: 130px; margin-left: 8px">
        <el-option label="冲压" value="CY" />
        <el-option label="注塑" value="ZS" />
        <el-option label="压铸" value="YZ" />
        <el-option label="铝挤" value="LJ" />
        <el-option label="吸塑盘" value="XSP" />
        <el-option label="载带" value="ZD" />
        <el-option label="其他" value="QT" />
      </el-select>
      <el-button type="primary" style="margin-left: 8px" @click="handleSearch" :icon="'Search'">搜索</el-button>
      <el-button @click="handleReset" :icon="'RefreshRight'">重置</el-button>
      <el-button type="warning" plain style="margin-left: 8px" @click="handleRefreshCache" :loading="refreshLoading" :icon="'Refresh'">刷新缓存</el-button>
      <el-button type="success" plain style="margin-left: 8px" @click="goToSyncMonitor" :icon="'Refresh'">模具同步监控</el-button>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <el-table
        :data="pagedData"
        v-loading="loading"
        border
        stripe
        highlight-current-row
        @row-click="handleRowClick"
        style="width: 100%"
        height="100%"
      >
        <el-table-column prop="mouldCode" label="模具编码" width="140" />
        <el-table-column prop="mouldName" label="模具名称" width="180" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="模具归属" min-width="200" show-overflow-tooltip />
        <el-table-column prop="location" label="存放地点" width="100" />
        <el-table-column prop="openDate" label="开模日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.openDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="cavityCount" label="模穴数" width="80" align="center" />
        <el-table-column prop="nextMaintainDate" label="下次保养日期" width="130">
          <template #default="{ row }">
            <span :class="{ 'text-warning': isMaintainWarning(row.nextMaintainDate) }">
              {{ formatDate(row.nextMaintainDate) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="produceType" label="产出方式" width="100">
          <template #default="{ row }">
            {{ getProduceTypeText(row.produceType) }}
          </template>
        </el-table-column>
        <el-table-column prop="produceMaterialType" label="产出物料类型" width="120">
          <template #default="{ row }">
            {{ getProduceMaterialTypeText(row.produceMaterialType) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页组件 -->
    <div class="pagination-area">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredTotal"
        :page-sizes="[50, 100, 200, 500]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        size="small"
      />
    </div>

    <!-- 右侧滑出面板 - TAB布局 -->
    <el-drawer
      v-model="drawerVisible"
      :title="`模具详情 - ${currentMould?.mouldCode || ''}`"
      direction="rtl"
      size="70%"
      destroy-on-close
    >
      <template v-if="currentMould">
        <el-tabs v-model="activeTab" type="border-card">
          <!-- TAB1: 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <el-descriptions :column="3" border size="small">
              <el-descriptions-item label="模具编码">{{ currentMould.mouldCode }}</el-descriptions-item>
              <el-descriptions-item label="模具名称">{{ currentMould.mouldName }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(currentMould.status)" size="small">{{ getStatusText(currentMould.status) }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="模具归属">{{ currentMould.ownerName }}</el-descriptions-item>
              <el-descriptions-item label="存放地点">{{ currentMould.location }}</el-descriptions-item>
              <el-descriptions-item label="开模日期">{{ formatDate(currentMould.openDate) }}</el-descriptions-item>
              <el-descriptions-item label="模穴数">{{ currentMould.cavityCount }}</el-descriptions-item>
              <el-descriptions-item label="下次保养日期">
                <span :class="{ 'text-warning': isMaintainWarning(currentMould.nextMaintainDate) }">
                  {{ formatDate(currentMould.nextMaintainDate) }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="产出方式">{{ getProduceTypeText(currentMould.produceType || '') }}</el-descriptions-item>
              <el-descriptions-item label="产出物料类型">{{ getProduceMaterialTypeText(currentMould.produceMaterialType || '') }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <!-- TAB2: 成本信息 -->
          <el-tab-pane label="成本信息" name="cost">
            <div class="tab-header">
              <span class="tab-summary">ERP {{ costErpCount }} 条 / MES {{ costMesCount }} 条</span>
              <el-button type="primary" size="small" @click="showAddCostDialog" :icon="'Plus'">MES新增</el-button>
            </div>
            <el-table :data="costData" v-loading="costLoading" border size="small" max-height="500">
              <el-table-column prop="materialCode" label="物料代码" width="140" show-overflow-tooltip />
              <el-table-column prop="specification" label="规格型号" min-width="200" show-overflow-tooltip />
              <el-table-column prop="costType" label="费用类型" width="120">
                <template #default="{ row }">
                  {{ getCostTypeText(row.costType) }}
                </template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="100" align="right">
                <template #default="{ row }">
                  {{ formatNumber(row.quantity) }}
                </template>
              </el-table-column>
              <el-table-column prop="unitPrice" label="单价" width="100" align="right">
                <template #default="{ row }">
                  {{ formatNumber(row.unitPrice) }}
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="金额" width="110" align="right">
                <template #default="{ row }">
                  {{ formatNumber(row.amount) }}
                </template>
              </el-table-column>
              <el-table-column prop="sourceBill" label="来源单据" width="180" show-overflow-tooltip />
              <el-table-column prop="dataSource" label="来源" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.dataSource === 'ERP' ? 'info' : 'success'" size="small">
                    {{ row.dataSource }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.dataSource === 'MES'"
                    type="danger"
                    size="small"
                    link
                    @click="handleDeleteCost(row)" :icon="'Delete'">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- TAB3: 业务记录 -->
          <el-tab-pane label="业务记录" name="business">
            <div class="tab-header">
              <span class="tab-summary">MES {{ businessMesCount }} 条 / ERP {{ businessErpCount }} 条</span>
            </div>
            <el-table :data="businessData" v-loading="businessLoading" border size="small" max-height="500">
              <el-table-column prop="businessType" label="业务类型" width="120">
                <template #default="{ row }">
                  {{ getBusinessTypeText(row.businessType) }}
                </template>
              </el-table-column>
              <el-table-column prop="businessDate" label="发生日期" width="120">
                <template #default="{ row }">
                  {{ formatDate(row.businessDate) }}
                </template>
              </el-table-column>
              <el-table-column prop="mouldCount" label="模次" width="100" align="right" />
              <el-table-column prop="sourceBillNo" label="源单据号" width="160" show-overflow-tooltip />
              <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
              <el-table-column prop="dataSource" label="来源" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.dataSource === 'ERP' ? 'info' : 'success'" size="small">
                    {{ row.dataSource }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-area" v-if="businessTotal > 0">
              <el-pagination
                v-model:current-page="businessPage"
                v-model:page-size="businessPageSize"
                :total="businessTotal"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                @size-change="loadBusinessData()"
                @current-change="loadBusinessData()"
                size="small"
              />
            </div>
          </el-tab-pane>

          <!-- TAB4: 档案资料 -->
          <el-tab-pane label="档案资料" name="document">
            <div class="tab-header">
              <span class="tab-summary">共 {{ documentData.length }} 条资料</span>
              <el-button type="primary" size="small" @click="showAddDocumentDialog" :icon="'Plus'">新增资料</el-button>
            </div>
            <el-table :data="documentData" v-loading="documentLoading" border size="small" max-height="500">
              <el-table-column prop="docName" label="资料名称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="docType" label="资料类型" width="100" align="center">
                <template #default="{ row }">
                  {{ getDocTypeText(row.docType) }}
                </template>
              </el-table-column>
              <el-table-column prop="fileExt" label="格式" width="70" align="center">
                <template #default="{ row }">
                  <el-tag size="small" v-if="row.fileExt">{{ row.fileExt.toUpperCase() }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="fileSize" label="大小" width="100" align="right">
                <template #default="{ row }">
                  {{ formatFileSize(row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column prop="createdByName" label="上传人" width="100" />
              <el-table-column prop="createdTime" label="上传时间" width="170">
                <template #default="{ row }">
                  {{ formatDateTime(row.createdTime) }}
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" width="150" show-overflow-tooltip />
              <el-table-column label="操作" width="160" fixed="right">
                <template #default="{ row }">
                  <div class="document-actions">
                    <el-button type="primary" size="small" link @click="handlePreviewDocument(row)" :loading="previewLoading" :icon="'View'">预览</el-button>
                    <el-button type="danger" size="small" link @click="handleDeleteDocument(row)" :icon="'Delete'">删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- 新增成本记录弹窗 -->
    <el-dialog v-model="addCostDialogVisible" title="新增模具成本记录" width="600px" destroy-on-close>
      <el-form :model="costForm" label-width="100px" size="default">
        <el-form-item label="物料代码" required>
          <el-input v-model="costForm.materialCode" placeholder="请输入物料代码" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="costForm.specification" placeholder="请输入规格型号" />
        </el-form-item>
        <el-form-item label="费用类型" required>
          <el-select v-model="costForm.costType" placeholder="请选择费用类型" style="width: 100%">
            <el-option label="修模采购" value="XMCG" />
            <el-option label="修模工艺委外" value="XMWW" />
            <el-option label="开模采购" value="KMCG" />
            <el-option label="开模工艺委外" value="KMWW" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="数量" required>
              <el-input-number v-model="costForm.quantity" :precision="4" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单价">
              <el-input-number v-model="costForm.unitPrice" :precision="4" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="金额">
              <el-input-number v-model="costForm.amount" :precision="4" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="来源单据">
          <el-input v-model="costForm.sourceBill" placeholder="请输入来源单据" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="costForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addCostDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddCost" :loading="addCostLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新增档案资料弹窗 -->
    <el-dialog v-model="addDocumentDialogVisible" title="新增档案资料" width="600px" destroy-on-close>
      <el-form :model="documentForm" label-width="100px" size="default">
        <el-form-item label="资料名称" required>
          <el-input v-model="documentForm.docName" placeholder="请输入资料名称" />
        </el-form-item>
        <el-form-item label="资料类型" required>
          <el-select v-model="documentForm.docType" placeholder="请选择资料类型" style="width: 100%">
            <el-option label="文档" value="DOCUMENT" />
            <el-option label="图纸" value="DRAWING" />
            <el-option label="视频" value="VIDEO" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="上传文件" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :file-list="fileList"
            accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.dwg"
            drag
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持格式：Word、Excel、PPT、PDF、DWG，单个文件不超过5000KB（约4.9MB）
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="documentForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDocumentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddDocument" :loading="addDocumentLoading">确定</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style lang="scss" scoped>
.mould-container {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-area {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
}

.pagination-area {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tab-summary {
  font-size: 13px;
  color: #909399;
}

.document-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.text-warning {
  color: #e6a23c;
  font-weight: bold;
}

/* 文件上传样式 */
.el-icon--upload {
  font-size: 67px;
  color: #c0c4cc;
  margin: 40px 0 16px;
  line-height: 50px;
}

.el-upload__text {
  color: #606266;
  font-size: 14px;
}

.el-upload__text em {
  color: #409eff;
  font-style: normal;
}

</style>
