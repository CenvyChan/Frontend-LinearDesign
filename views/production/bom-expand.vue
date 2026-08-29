<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Connection, Goods } from '@element-plus/icons-vue';
import { useAccessStore } from '@vben/stores';
import {
  exportBomExpandExcel,
  submitBomExpandExcelTask,
  downloadBomExpandExcelTemplate,
  searchMaterials,
  searchBomVersions,
  queryBomExpandTree,
  type MaterialItem,
  type BomVersionItem,
  type BomTreeNode,
  type BomQueryParams,
} from '#/api/bom';
import BomDocumentStep from '#/views/production/components/BomDocumentStep.vue';
import { mergeSelectedBomVersions, mergeSelectedMaterials } from './bom-expand-selection';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'BomExpand' });

const accessStore = useAccessStore();
const router = useRouter();
const DOCUMENT_MAINTAIN_PERMISSION = 'production:bom-document:maintain';
const canMaintainDocuments = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes(DOCUMENT_MAINTAIN_PERMISSION));

// ==================== 步骤状态 ====================
const currentStep = ref(0);

// ==================== 已选项目 ====================
const selectedMaterials = ref<MaterialItem[]>([]);
const selectedBomVersions = ref<BomVersionItem[]>([]);
const maxLevel = ref(3);

// ==================== 物料搜索对话框 ====================
const materialDialogVisible = ref(false);
const materialKeyword = ref('');
const materialResults = ref<MaterialItem[]>([]);
const materialLoading = ref(false);
const materialTempSelection = ref<MaterialItem[]>([]);
const materialTableRef = ref<SelectionTable<MaterialItem>>();

// ==================== BOM版本搜索对话框 ====================
const bomDialogVisible = ref(false);
const bomKeyword = ref('');
const bomResults = ref<BomVersionItem[]>([]);
const bomLoading = ref(false);
const bomTempSelection = ref<BomVersionItem[]>([]);
const bomTableRef = ref<SelectionTable<BomVersionItem>>();

// ==================== BOM展开树数据 ====================
const treeData = ref<BomTreeNode[]>([]);
const tableLoading = ref(false);
const exportLoading = ref(false);
const sheet9ExportLoading = ref(false);
const sheet9TemplateLoading = ref(false);
const sheet9FileInput = ref<HTMLInputElement | null>(null);

type SelectionTable<T> = {
  clearSelection: () => void;
  toggleRowSelection: (row: T, selected?: boolean) => void;
};

function syncMaterialSelection() {
  materialTempSelection.value = mergeSelectedMaterials(
    selectedMaterials.value,
    materialTempSelection.value,
  );
  void nextTick(() => {
    const selectedNumbers = new Set(materialTempSelection.value.map((item) => item.number));
    materialTableRef.value?.clearSelection();
    for (const row of materialResults.value) {
      if (selectedNumbers.has(row.number)) {
        materialTableRef.value?.toggleRowSelection(row, true);
      }
    }
  });
}

function syncBomSelection() {
  bomTempSelection.value = mergeSelectedBomVersions(
    selectedBomVersions.value,
    bomTempSelection.value,
  );
  void nextTick(() => {
    const selectedNumbers = new Set(bomTempSelection.value.map((item) => item.bomNumber));
    bomTableRef.value?.clearSelection();
    for (const row of bomResults.value) {
      if (selectedNumbers.has(row.bomNumber)) {
        bomTableRef.value?.toggleRowSelection(row, true);
      }
    }
  });
}

// ==================== 物料搜索 ====================
async function handleSearchMaterial() {
  if (!materialKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键字');
    return;
  }
  const orgId = localStorage.getItem('mes_current_org_id') || undefined;
  materialLoading.value = true;
  try {
    const res: any = await searchMaterials(materialKeyword.value.trim(), orgId);
    materialResults.value = Array.isArray(res) ? res : (res?.data ?? []);
    syncMaterialSelection();
    if (materialResults.value.length === 0) {
      ElMessage.info('未找到匹配的物料');
    }
  } catch {
    ElMessage.error('搜索物料失败');
    materialResults.value = [];
  } finally {
    materialLoading.value = false;
  }
}

function confirmMaterialSelection() {
  const selected = materialTempSelection.value;
  if (selected.length === 0) {
    ElMessage.warning('请先在搜索结果中选择物料');
    return;
  }
  selectedMaterials.value = mergeSelectedMaterials(selectedMaterials.value, selected);
  materialTempSelection.value = [...selectedMaterials.value];
  materialDialogVisible.value = false;
  ElMessage.success(`已确认 ${selected.length} 项物料编码`);
}

function removeMaterial(index: number) {
  selectedMaterials.value.splice(index, 1);
}

// ==================== BOM版本搜索 ====================
async function handleSearchBom() {
  if (!bomKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键字');
    return;
  }
  const orgId = localStorage.getItem('mes_current_org_id') || undefined;
  bomLoading.value = true;
  try {
    const res: any = await searchBomVersions(bomKeyword.value.trim(), orgId);
    bomResults.value = Array.isArray(res) ? res : (res?.data ?? []);
    syncBomSelection();
    if (bomResults.value.length === 0) {
      ElMessage.info('未找到匹配的BOM版本');
    }
  } catch {
    ElMessage.error('搜索BOM版本失败');
    bomResults.value = [];
  } finally {
    bomLoading.value = false;
  }
}

function confirmBomSelection() {
  const selected = bomTempSelection.value;
  if (selected.length === 0) {
    ElMessage.warning('请先在搜索结果中选择BOM版本');
    return;
  }
  selectedBomVersions.value = mergeSelectedBomVersions(selectedBomVersions.value, selected);
  bomTempSelection.value = [...selectedBomVersions.value];
  bomDialogVisible.value = false;
  ElMessage.success(`已确认 ${selected.length} 项BOM版本号`);
}

function removeBomVersion(index: number) {
  selectedBomVersions.value.splice(index, 1);
}

// ==================== 步骤导航 ====================
function goToStep2() {
  if (selectedMaterials.value.length === 0 && selectedBomVersions.value.length === 0) {
    ElMessage.warning('请至少选择物料编码或BOM版本号');
    return;
  }
  loadTreeData();
}

function goBackToStep1() {
  currentStep.value = 0;
}

// ==================== 查询BOM展开 ====================
function buildBomQueryParams(): BomQueryParams {
  const materialNumber = selectedMaterials.value
    .map((m) => m.number)
    .filter(Boolean)
    .join(',');
  const bomNumber = selectedBomVersions.value
    .map((b) => b.bomNumber)
    .filter(Boolean)
    .join(',');
  return {
    materialNumber: materialNumber || undefined,
    bomNumber: bomNumber || undefined,
    materialQuantities: selectedMaterials.value.map((material) => ({
      materialNumber: material.number,
      finishedQuantity: finishedProductQty.value,
    })),
    includeScrap: considerScrap.value,
    maxLevel: maxLevel.value,
    useOrgId: parseInt(localStorage.getItem('mes_current_org_id') || '', 10) || undefined,
  };
}

async function loadTreeData() {
  const materialNumber = selectedMaterials.value
    .map((m) => m.number)
    .filter(Boolean)
    .join(',');
  const bomNumber = selectedBomVersions.value
    .map((b) => b.bomNumber)
    .filter(Boolean)
    .join(',');

  if (!materialNumber && !bomNumber) {
    ElMessage.warning('请至少选择物料编码或BOM版本号');
    return;
  }

  tableLoading.value = true;
  try {
    const params = buildBomQueryParams();
    const res: any = await queryBomExpandTree(params);
    treeData.value = Array.isArray(res) ? res : (res?.data ?? []);
    if (treeData.value.length === 0) {
      ElMessage.info('未查询到BOM展开数据');
    }
    currentStep.value = 1;
  } catch {
    ElMessage.error('查询BOM展开失败');
    treeData.value = [];
  } finally {
    tableLoading.value = false;
  }
}

// ==================== 层级颜色映射 ====================
async function handleExportBom() {
  if (treeData.value.length === 0) {
    ElMessage.warning('请先查询BOM展开数据');
    return;
  }
  exportLoading.value = true;
  try {
    const blob = await exportBomExpandExcel(buildBomQueryParams());
    downloadBlob(blob, 'BOM展开导出.xlsx');
  } catch (error) {
    console.error(error);
    ElMessage.error('导出BOM失败');
  } finally {
    exportLoading.value = false;
  }
}

function openSheet9FilePicker() {
  sheet9FileInput.value?.click();
}

async function handleDownloadSheet9Template() {
  sheet9TemplateLoading.value = true;
  try {
    const blob = await downloadBomExpandExcelTemplate();
    downloadBlob(blob, '物料清单导出模板.xlsx');
    ElMessage.success('模板已下载');
  } catch (error) {
    console.error(error);
    ElMessage.error('下载物料清单导出模板失败');
  } finally {
    sheet9TemplateLoading.value = false;
  }
}

async function handleSheet9Export(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  sheet9ExportLoading.value = true;
  try {
    await submitBomExpandExcelTask(file, {
      includeScrap: considerScrap.value,
      maxLevel: maxLevel.value,
      useOrgId: parseInt(localStorage.getItem('mes_current_org_id') || '', 10) || undefined,
    });
    ElMessage.success('Sheet9 BOM展开任务已提交，请到导出任务中心查看进度');
    await router.push('/document/export-tasks');
  } catch (error) {
    console.error(error);
    ElMessage.error('Sheet9 BOM展开失败');
  } finally {
    sheet9ExportLoading.value = false;
    input.value = '';
  }
}

const LEVEL_COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399'];
function getLevelColor(level: number): string {
  return LEVEL_COLORS[level % LEVEL_COLORS.length]!;
}

// ==================== 树形表格行样式（含搜索高亮 + 过滤隐藏） ====================
function treeRowClassName({ row }: { row: BomTreeNode }) {
  const classes: string[] = [];
  if (row.isRoot) {
    classes.push('tree-row-root');
  } else {
    const level = row.bomLevel ?? 0;
    classes.push(`tree-row-level-${level % 4}`, `tree-row-depth-${Math.min(level, 4)}`);
  }
  const meta = nodeMeta.value.get(row.id);
  if (meta) {
    if (filterMode.value === 'filter' && !meta.highlight && !meta.hasMatchingDescendant && (materialSearchKeyword.value.trim() || parentSearchKeyword.value.trim())) {
      classes.push('row-hidden');
    }
    if (meta.highlight) {
      classes.push('row-highlight');
    }
  }
  return classes.join(' ');
}

// ==================== 深度指示器点数 ====================
function getDepthDots(level: number): number[] {
  const dots: number[] = [];
  for (let i = 0; i <= level; i++) {
    dots.push(i);
  }
  return dots;
}

// ==================== 格式化用量 ====================
function formatQuantity(row: BomTreeNode) {
  if (row.isRoot) return '-';
  const numerator = row.numerator ?? 1;
  const denominator = row.denominator ?? 1;
  const qty = row.quantity ?? (numerator / denominator);
  if (qty == null) return '-';
  const formatted = Number(qty).toLocaleString(undefined, { maximumFractionDigits: 6 });
  // 当分子分母不都是1时，显示完整用量表达式
  if (numerator !== 1 || denominator !== 1) {
    return `${formatted} (${numerator}/${denominator})`;
  }
  return formatted;
}

// ==================== 格式化损耗（合并固定+变动） ====================
function formatScrap(row: BomTreeNode): string {
  if (row.isRoot) return '-';
  const fixed = row.fixedScrap != null ? Number(row.fixedScrap) : 0;
  const variable = row.variableScrap != null ? Number(row.variableScrap) : 0;
  if (fixed === 0 && variable === 0) return '0%';
  const parts: string[] = [];
  if (fixed > 0) parts.push(`固${fixed}%`);
  if (variable > 0) parts.push(`变${variable}%`);
  return parts.join(' + ');
}

// ==================== BOM路径摘要 ====================
// function getBomPathSummary(row: BomTreeNode): string {
//   if (row.isRoot) return row.parentMaterialName || row.inputMaterialCode || '';
//   const parent = row.parentMaterialName || row.parentMaterialNumber || '';
//   const child = row.childMaterialName || row.childMaterialNumber || '';
//   return `${parent} → ${child}`;
// }

// ==================== 展开/收起控制 ====================
const tableRef = ref();
void tableRef; // suppress TS6133 - used in template via ref="tableRef"
const expandAllFlag = ref(true);
const tableRerenderKey = ref(0);

function handleExpandAll() {
  expandAllFlag.value = true;
  tableRerenderKey.value++;
}

function handleCollapseAll() {
  expandAllFlag.value = false;
  tableRerenderKey.value++;
}

// ==================== 节点类型判断 ====================
function isLeafNode(row: BomTreeNode): boolean {
  return !row.children || row.children.length === 0;
}

// ==================== 物料类别识别（按编码前缀） ====================
interface MaterialCategory {
  label: string;
  type: 'success' | 'warning' | 'danger' | 'info' | '';
}

function getMaterialCategory(code: string): MaterialCategory {
  if (!code) return { label: '', type: '' };
  const prefix = code.split('.')[0];
  switch (prefix) {
    case '1': return { label: '成品', type: '' };
    case '2': return { label: '半成品', type: 'warning' };
    case '3': return { label: '原材料', type: 'success' };
    default: return { label: '其他', type: 'info' };
  }
}

// ==================== 成品数量与损耗开关 ====================
const finishedProductQty = ref(1);
const considerScrap = ref(true);

// ==================== 需求量计算 ====================
function calcScrapRate(fixed: number | null | undefined, variable: number | null | undefined): number {
  return ((fixed ?? 0) + (variable ?? 0)) / 100;
}

function calcDemand(row: BomTreeNode, parentDemand: number): number {
  if (row.isRoot) {
    return finishedProductQty.value;
  }
  const numerator = row.numerator ?? 1;
  const denominator = row.denominator ?? 1;
  const qty = row.quantity ?? (numerator / denominator);
  const scrapRate = considerScrap.value ? calcScrapRate(row.fixedScrap, row.variableScrap) : 0;
  return parentDemand * qty * (1 + scrapRate);
}

function formatDemand(value: number): string {
  if (value == null || isNaN(value)) return '-';
  if (Number.isInteger(value) && value < 999999) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}

// ==================== 树内搜索 ====================
const materialSearchKeyword = ref('');
const parentSearchKeyword = ref('');
type FilterMode = 'highlight' | 'filter';
const filterMode = ref<FilterMode>('highlight');
const showSearch = ref(false);

function matchesSearch(
  row: BomTreeNode,
  mKw: string,
  pKw: string,
): boolean {
  const m = mKw.toLowerCase().trim();
  const p = pKw.toLowerCase().trim();
  if (!m && !p) return false;

  let materialMatch = true;
  if (m) {
    const code = row.isRoot ? (row.inputMaterialCode || '') : (row.childMaterialNumber || '');
    const name = row.isRoot ? (row.parentMaterialName || '') : (row.childMaterialName || '');
    const model = row.materialModel || '';
    materialMatch = code.toLowerCase().includes(m) || name.toLowerCase().includes(m) || model.toLowerCase().includes(m);
  }

  let parentMatch = true;
  if (p && !row.isRoot) {
    const pCode = row.parentMaterialNumber || '';
    const pName = row.parentMaterialName || '';
    parentMatch = pCode.toLowerCase().includes(p) || pName.toLowerCase().includes(p);
  } else if (p && row.isRoot) {
    parentMatch = false; // Root nodes don't have a parent
  }

  return materialMatch && parentMatch;
}

// ==================== 节点元数据（需求 + 搜索匹配）响应式计算 ====================
const nodeMeta = computed(() => {
  type NodeInfo = { demand: number; highlight: boolean; hasMatchingDescendant: boolean };
  const meta = new Map<string, NodeInfo>();
  const mKw = materialSearchKeyword.value;
  const pKw = parentSearchKeyword.value;
  const isSearching = !!(mKw.trim() || pKw.trim());

  function traverse(nodes: BomTreeNode[], parentDemand?: number): boolean {
    let anyChildMatch = false;
    for (const node of nodes) {
      const demand = node.requiredQuantity ?? calcDemand(node, parentDemand ?? finishedProductQty.value);
      const selfMatch = isSearching ? matchesSearch(node, mKw, pKw) : false;

      let hasMatchingDescendant = false;
      if (node.children && node.children.length > 0) {
        hasMatchingDescendant = traverse(node.children, demand);
      }

      const highlight = isSearching && (selfMatch || hasMatchingDescendant);
      meta.set(node.id, { demand, highlight, hasMatchingDescendant });
      if (selfMatch || hasMatchingDescendant) anyChildMatch = true;
    }
    return anyChildMatch;
  }

  traverse(treeData.value);
  return meta;
});

// ==================== 树统计（响应式） ====================
const treeStats = computed(() => {
  function traverse(nodes: BomTreeNode[]): { total: number; leaves: number; maxDepth: number; byLevel: Record<number, number>; branches: number } {
    let total = 0, leaves = 0, branches = 0, maxDepth = 0;
    const byLevel: Record<number, number> = {};
    function walk(list: BomTreeNode[], depth: number) {
      for (const node of list) {
        total++;
        const lvl = node.bomLevel ?? 0;
        byLevel[lvl] = (byLevel[lvl] || 0) + 1;
        if (depth > maxDepth) maxDepth = depth;
        if (node.children && node.children.length > 0) {
          branches++;
          walk(node.children, depth + 1);
        } else {
          leaves++;
        }
      }
    }
    walk(nodes, 0);
    return { total, leaves, maxDepth, byLevel, branches };
  }
  const stats = traverse(treeData.value);
  return {
    totalNodes: stats.total,
    leafCount: stats.leaves,
    maxDepth: stats.maxDepth,
    rootCount: treeData.value.length,
    byLevel: stats.byLevel,
    branchCount: stats.branches,
  };
});

// ==================== 紧凑/宽松视图切换 ====================
const isCompactView = ref(false);

function toggleDensity() {
  isCompactView.value = !isCompactView.value;
}

// ==================== 单元格 class 回调（首列深度偏移） ====================
function cellClassName({ row, columnIndex }: { row: BomTreeNode; columnIndex: number }) {
  if (columnIndex === 0 && !row.isRoot) {
    return `cell-depth-${Math.min(row.bomLevel ?? 0, 4)}`;
  }
  return '';
}

// ==================== 图文档查询与维护 ====================
const selectedRootNode = ref<BomTreeNode | null>(null);
const documentMode = ref<'maintain' | 'query'>('query');

function enterDocumentStep(root: BomTreeNode, mode: 'query' | 'maintain') {
  selectedRootNode.value = root;
  documentMode.value = mode;
  currentStep.value = 2;
}

// ==================== 向导状态持久化（sessionStorage）====================
// 仅持久化第一步的选择条件（物料/BOM版本/参数），treeData 不缓存（可重新查询）。
// 缓存附带 orgId，切换组织后自动失效，避免用不同组织的条件做查询。
const BOM_WIZARD_CACHE_KEY = 'bom_expand_wizard_state';

interface BomWizardCache {
  orgId: string;
  selectedMaterials: MaterialItem[];
  selectedBomVersions: BomVersionItem[];
  maxLevel: number;
  finishedProductQty: number;
  considerScrap: boolean;
  currentStep: number; // 只还原 step 0/1（step 2 是图文档，刷新后无意义）
  cacheTime: number;
}

function saveBomWizardState() {
  const orgId = localStorage.getItem('mes_current_org_id') || '';
  const cache: BomWizardCache = {
    orgId,
    selectedMaterials: selectedMaterials.value,
    selectedBomVersions: selectedBomVersions.value,
    maxLevel: maxLevel.value,
    finishedProductQty: finishedProductQty.value,
    considerScrap: considerScrap.value,
    currentStep: Math.min(currentStep.value, 1), // step 2 不缓存
    cacheTime: Date.now(),
  };
  sessionStorage.setItem(BOM_WIZARD_CACHE_KEY, JSON.stringify(cache));
}

function restoreBomWizardState() {
  try {
    const raw = sessionStorage.getItem(BOM_WIZARD_CACHE_KEY);
    if (!raw) return;
    const cache: BomWizardCache = JSON.parse(raw);
    // 超过 4 小时或组织已变更时，丢弃缓存
    if (Date.now() - (cache.cacheTime || 0) > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(BOM_WIZARD_CACHE_KEY);
      return;
    }
    const currentOrgId = localStorage.getItem('mes_current_org_id') || '';
    if (cache.orgId !== currentOrgId) {
      sessionStorage.removeItem(BOM_WIZARD_CACHE_KEY);
      return;
    }
    if (cache.selectedMaterials?.length) selectedMaterials.value = cache.selectedMaterials;
    if (cache.selectedBomVersions?.length) selectedBomVersions.value = cache.selectedBomVersions;
    if (cache.maxLevel) maxLevel.value = cache.maxLevel;
    if (cache.finishedProductQty) finishedProductQty.value = cache.finishedProductQty;
    considerScrap.value = cache.considerScrap ?? true;
    // 如果上次停在 step 1（结果页），自动重新查询并还原
    if (cache.currentStep === 1 && (cache.selectedMaterials?.length || cache.selectedBomVersions?.length)) {
      loadTreeData();
    }
  } catch {
    sessionStorage.removeItem(BOM_WIZARD_CACHE_KEY);
  }
}

onMounted(() => {
  restoreBomWizardState();
});

// 选择条件变化时即时保存
watch(
  [selectedMaterials, selectedBomVersions, maxLevel, finishedProductQty, considerScrap],
  () => { saveBomWizardState(); },
  { deep: true },
);

// 步骤变化时也保存一次，确保 currentStep 同步写入缓存
watch(currentStep, () => { saveBomWizardState(); });

</script>

<template>
  <div class="bom-expand-wizard">
    <!-- 步骤指示器 -->
    <el-steps
      :active="currentStep"
      finish-status="success"
      simple
      class="wizard-steps"
    >
      <el-step title="第一步：条件设置" />
      <el-step title="第二步：BOM展开结果" />
      <el-step title="第三步：图文查询与维护" />
    </el-steps>

    <!-- ==================== 第一步：条件设置 ==================== -->
    <div v-show="currentStep === 0" class="step-content">
      <el-card shadow="never">
        <template #header>
          <span class="step-title">设置查询条件</span>
        </template>

        <el-form label-width="120px" label-position="top">
          <!-- 物料编码 -->
          <el-form-item label="物料编码">
            <el-input
              :model-value="selectedMaterials.map(m => m.number).join('、')"
              placeholder="点击展开物料搜索对话框"
              readonly
              @click="materialDialogVisible = true"
              clearable
              @clear="selectedMaterials = []"
            >
              <template #prefix>
                <el-icon><Goods /></el-icon>
              </template>
            </el-input>
            <!-- 已选物料编码列表 -->
            <div v-if="selectedMaterials.length > 0" class="selected-tags mt-2">
              <el-tag
                v-for="(item, idx) in selectedMaterials"
                :key="item.number"
                closable
                type="success"
                size="small"
                @close="removeMaterial(idx)"
              >
                {{ item.number }} - {{ item.name }}
              </el-tag>
            </div>
            <div v-else class="selected-empty">尚未选择物料编码</div>
          </el-form-item>

          <!-- BOM版本号 -->
          <el-form-item label="BOM版本号">
            <el-input
              :model-value="selectedBomVersions.map(b => b.bomNumber).join('、')"
              placeholder="点击展开BOM版本搜索对话框"
              readonly
              @click="bomDialogVisible = true"
              clearable
              @clear="selectedBomVersions = []"
            >
              <template #prefix>
                <span class="bom-input-prefix">BOM</span>
              </template>
            </el-input>
            <!-- 已选BOM版本号列表 -->
            <div v-if="selectedBomVersions.length > 0" class="selected-tags mt-2">
              <el-tag
                v-for="(item, idx) in selectedBomVersions"
                :key="item.bomNumber"
                closable
                type="warning"
                size="small"
                @close="removeBomVersion(idx)"
              >
                {{ item.bomNumber }} - {{ item.materialName }}
              </el-tag>
            </div>
            <div v-else class="selected-empty">尚未选择BOM版本号</div>
          </el-form-item>

          <!-- 最大展开层级 -->
          <el-form-item label="最大展开层级">
            <el-input-number
              v-model="maxLevel"
              :min="1"
              :max="20"
              :step="1"
            />
            <span class="form-help">默认3层，范围1~20</span>
          </el-form-item>

          <el-form-item label="Sheet9批量展开">
            <div class="sheet9-actions">
              <input
                ref="sheet9FileInput"
                type="file"
                accept=".xlsx"
                class="sheet9-file-input"
                @change="handleSheet9Export"
              />
              <el-button
                :loading="sheet9TemplateLoading"
                :icon="'Download'"
                @click="handleDownloadSheet9Template"
              >
                下载物料清单导出模板
              </el-button>
              <el-button
                type="primary"
                :loading="sheet9ExportLoading"
                :icon="'Upload'"
                @click="openSheet9FilePicker"
              >
                导入Sheet9并导出全部结果
              </el-button>
            </div>
            <span class="form-help">模板工作表名 Sheet9；A=物料编码，B=成品数量；数据从第4行起（A4:B1023）</span>
          </el-form-item>
        </el-form>

        <div class="step-footer">
          <el-button
            type="primary"
            size="large"
            :disabled="selectedMaterials.length === 0 && selectedBomVersions.length === 0"
            @click="goToStep2" :icon="'Search'">
            下一步 — 查询BOM展开
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- ==================== 第二步：BOM展开结果 ==================== -->
    <div v-show="currentStep === 1" class="step-content">
      <el-card shadow="never">
        <template #header>
          <div class="step2-header">
            <span class="step-title">BOM展开结果</span>
            <div class="step2-actions">
              <el-tag type="info" size="small">
                层级上限: {{ maxLevel }}
              </el-tag>
              <el-button size="small" @click="goBackToStep1" :icon="'ArrowLeft'">
                返回上一步
              </el-button>
            </div>
          </div>
        </template>

        <div class="query-summary">
          <template v-if="selectedMaterials.length > 0">
            <span class="summary-label">物料编码：</span>
            <span class="summary-value">{{ selectedMaterials.map(m => m.number).join('、') }}</span>
          </template>
          <template v-if="selectedBomVersions.length > 0">
            <span v-if="selectedMaterials.length > 0" class="summary-sep">|</span>
            <span class="summary-label">BOM版本：</span>
            <span class="summary-value">{{ selectedBomVersions.map(b => b.bomNumber).join('、') }}</span>
          </template>
        </div>

        <!-- BOM 树表格工具栏（合并行内布局） -->
        <div v-if="treeData.length > 0" class="tree-toolbar">
          <div class="toolbar-row">
            <!-- 左侧：成品数量 + 损耗开关 + 搜索切换 -->
            <div class="toolbar-left">
              <div class="toolbar-qty">
                <span class="toolbar-label">成品数</span>
                <el-input-number v-model="finishedProductQty" :min="1" :max="999999" size="small" class="qty-input" controls-position="right" />
              </div>
              <el-checkbox v-model="considerScrap" size="small" class="toolbar-scrap-cb">考虑损耗</el-checkbox>
              <el-divider direction="vertical" />
              <el-button size="small" :type="showSearch ? 'primary' : 'default'" @click="showSearch = !showSearch" class="toolbar-search-btn" :icon="'Search'">
                搜索
              </el-button>
              <el-button-group size="small">
                <el-button :type="expandAllFlag ? 'primary' : 'default'" @click="handleExpandAll" :title="'全部展开'">
                  <span class="toolbar-btn-icon">⊞</span>
                </el-button>
                <el-button :type="!expandAllFlag ? 'primary' : 'default'" @click="handleCollapseAll" :title="'全部收起'">
                  <span class="toolbar-btn-icon">⊟</span>
                </el-button>
              </el-button-group>
              <el-divider direction="vertical" />
              <el-tooltip :content="isCompactView ? '切换为宽松视图' : '切换为紧凑视图'" placement="top">
                <el-button size="small" @click="toggleDensity" :title="'切换视图密度'" :icon="'RefreshRight'">
                  {{ isCompactView ? '⊞⊟' : '⊟⊞' }}
                </el-button>
              </el-tooltip>
              <el-button size="small" :loading="exportLoading" @click="handleExportBom" :icon="'Download'">导出</el-button>
            </div>
            <!-- 右侧：统计信息 -->
            <div class="toolbar-right">
              <span class="toolbar-stat">{{ treeStats.totalNodes }} 节点</span>
              <span class="toolbar-sep">|</span>
              <span class="toolbar-stat">{{ treeStats.leafCount }} 叶</span>
              <span class="toolbar-sep">|</span>
              <span class="toolbar-stat">L{{ treeStats.maxDepth }}</span>
            </div>
          </div>
          <!-- 搜索面板（可折叠） -->
          <div v-if="showSearch" class="toolbar-search-panel">
            <div class="search-row">
              <div class="search-item">
                <span class="search-label">物料</span>
                <el-input v-model="materialSearchKeyword" placeholder="编码/名称/规格" size="small" clearable class="search-input" @clear="materialSearchKeyword = ''">
                  <template #prefix><el-icon><Goods /></el-icon></template>
                </el-input>
              </div>
              <div class="search-item">
                <span class="search-label">父项</span>
                <el-input v-model="parentSearchKeyword" placeholder="编码/名称" size="small" clearable class="search-input" @clear="parentSearchKeyword = ''">
                  <template #prefix><el-icon><Connection /></el-icon></template>
                </el-input>
              </div>
              <div class="search-item">
                <el-radio-group v-model="filterMode" size="small">
                  <el-radio-button value="highlight">高亮</el-radio-button>
                  <el-radio-button value="filter">过滤</el-radio-button>
                </el-radio-group>
              </div>
              <span v-if="materialSearchKeyword.trim() || parentSearchKeyword.trim()" class="search-clear-all">
                <el-button size="small" text @click="materialSearchKeyword = ''; parentSearchKeyword = ''" :icon="'Search'">
                  清除
                </el-button>
              </span>
            </div>
            <div v-if="materialSearchKeyword.trim() || parentSearchKeyword.trim()" class="search-hint">
              {{ filterMode === 'highlight' ? '匹配节点以蓝色高亮显示，层级关系保持不变' : '仅显示匹配节点及其所有上级，其他行自动隐藏' }}
            </div>
          </div>
        </div>

        <el-table
          ref="tableRef"
          :key="tableRerenderKey"
          v-loading="tableLoading"
          :data="treeData"
          border
          row-key="id"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          :default-expand-all="expandAllFlag"
          :row-class-name="treeRowClassName"
          height="calc(100vh - 460px)"
          class="bom-tree-table"
          :class="{ 'compact-view': isCompactView }"
          :cell-class-name="cellClassName"
        >
          <!-- 列1：物料编码（固定左侧）+ 树连线圆点 + 叶子/分支图标 -->
          <el-table-column label="物料编码" width="170" fixed="left" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="material-code-cell" :class="{ 'is-root': row.isRoot }">
                <!-- 根节点：单一强调圆点 -->
                <span
                  v-if="row.isRoot"
                  class="tc-dot tc-dot-root"
                  :style="{ backgroundColor: '#409EFF' }"
                />
                <!-- 子节点：连线圆点链 -->
                <span v-else class="tree-chain">
                  <template v-for="(dot, idx) in getDepthDots(row.bomLevel ?? 0)" :key="dot">
                    <span class="tc-dot" :style="{ backgroundColor: getLevelColor(dot) }"></span>
                    <span v-if="idx < (row.bomLevel ?? 0)" class="tc-line"></span>
                  </template>
                </span>
                <!-- 叶子/分支图标 -->
                <span v-if="!row.isRoot" class="node-type-icon" :class="{ 'is-leaf': isLeafNode(row) }">
                  <template v-if="isLeafNode(row)">▪</template>
                  <template v-else>▸</template>
                </span>
                <span class="material-number" :class="{ 'is-root': row.isRoot }">
                  {{ row.isRoot ? row.inputMaterialCode : row.childMaterialNumber }}
                </span>
              </div>
            </template>
          </el-table-column>

          <!-- 列2：物料名称（含类别标签） -->
          <el-table-column label="物料名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="material-name-cell" :class="{ 'is-root': row.isRoot }">
                <!-- 根节点标签 -->
                <el-tag
                  v-if="row.isRoot"
                  type="info"
                  size="small"
                  effect="dark"
                  class="root-badge"
                >
                  顶层
                </el-tag>
                <!-- 物料类别标签（非根节点） -->
                <el-tag
                  v-else-if="getMaterialCategory(row.childMaterialNumber).label"
                  :type="getMaterialCategory(row.childMaterialNumber).type || 'info'"
                  size="small"
                  effect="plain"
                  class="category-badge"
                >
                  {{ getMaterialCategory(row.childMaterialNumber).label }}
                </el-tag>
                <span class="material-name" :class="{ 'is-root': row.isRoot }">
                  {{ row.isRoot ? (row.parentMaterialName || row.inputMaterialCode) : row.childMaterialName }}
                </span>
              </div>
            </template>
          </el-table-column>

          <!-- 列3：层级 -->
          <el-table-column label="层级" width="80" align="center">
            <template #default="{ row }">
              <div v-if="row.isRoot" class="level-badge level-badge-root">根</div>
              <div v-else class="level-badge" :style="{ backgroundColor: getLevelColor(row.bomLevel ?? 0) }">
                L{{ row.bomLevel }}
              </div>
            </template>
          </el-table-column>

          <!-- 列4：规格型号 -->
          <el-table-column prop="materialModel" label="规格型号" width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.isRoot" class="text-muted">-</span>
              <span v-else>{{ row.materialModel || '-' }}</span>
            </template>
          </el-table-column>

          <!-- 列5：单位 -->
          <el-table-column label="单位" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.isRoot" class="text-muted">-</span>
              <span v-else>{{ row.unitNumber || row.unitName || '-' }}</span>
            </template>
          </el-table-column>

          <!-- 列5：所属父项（仅子节点显示） -->
          <el-table-column label="所属父项" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <template v-if="row.isRoot">
                <span class="text-muted">-</span>
              </template>
              <template v-else>
                <el-tooltip
                  :content="`${row.parentMaterialNumber} ${row.parentMaterialName || ''}`"
                  placement="top"
                  :show-after="500"
                >
                  <span class="parent-ref">{{ row.parentMaterialName || row.parentMaterialNumber }}</span>
                </el-tooltip>
              </template>
            </template>
          </el-table-column>

          <!-- 列6：用量 -->
          <el-table-column label="用量" width="140" align="right">
            <template #default="{ row }">
              <span v-if="row.isRoot" class="text-muted">-</span>
              <span v-else class="quantity-value">{{ formatQuantity(row) }}</span>
            </template>
          </el-table-column>

          <!-- 列7：损耗（固定+变动合并） -->
          <el-table-column label="损耗" width="110" align="center">
            <template #default="{ row }">
              <span v-if="row.isRoot" class="text-muted">-</span>
              <span v-else class="scrap-value" :class="{ 'has-scrap': formatScrap(row) !== '0%' }">
                {{ formatScrap(row) }}
              </span>
            </template>
          </el-table-column>

          <!-- 列8：需求量（层级联动计算） -->
          <el-table-column label="需求量" width="110" align="right">
            <template #default="{ row }">
              <el-tooltip
                v-if="nodeMeta.get(row.id) && !row.isRoot"
                :content="`${formatDemand(nodeMeta.get(row.id)!.demand)}`"
                placement="top"
                :show-after="300"
              >
                <span class="demand-value">{{ formatDemand(nodeMeta.get(row.id)!.demand) }}</span>
              </el-tooltip>
              <span v-else-if="row.isRoot" class="demand-value demand-root">{{ formatDemand(finishedProductQty) }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>

          <!-- 列9：BOM版本 -->
          <el-table-column prop="bomVersion" label="BOM版本" width="170" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.bomVersion || '-' }}</span>
            </template>
          </el-table-column>

          <!-- 列9：行号 -->
          <el-table-column prop="seq" label="行号" width="60" align="center">
            <template #default="{ row }">
              <span v-if="row.isRoot" class="text-muted">-</span>
              <span v-else>{{ row.seq }}</span>
            </template>
          </el-table-column>
          <el-table-column label="图文档" width="230" align="center" fixed="right">
            <template #default="{ row }">
              <div v-if="row.isRoot" class="document-root-actions">
                <el-button size="small" type="primary" plain :icon="'Search'" @click="enterDocumentStep(row, 'query')">查询</el-button>
                <el-button v-if="canMaintainDocuments" size="small" type="warning" plain :icon="'Edit'" @click="enterDocumentStep(row, 'maintain')">维护</el-button>
              </div>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="treeData.length > 0" class="stats-bar">
          <el-tag type="info">根节点 {{ treeStats.rootCount }}</el-tag>
          <el-tag
            v-for="(cnt, lvl) in treeStats.byLevel"
            :key="lvl"
            :type="['success', 'warning', 'danger', '', 'info'][Math.min(Number(lvl), 4)] as any"
            size="small"
          >
            L{{ lvl }}: {{ cnt }}
          </el-tag>
          <el-tag v-if="treeStats.branchCount > 0" type="" size="small">{{ treeStats.branchCount }} 分支</el-tag>
          <el-tag v-if="treeStats.leafCount > 0" type="success" size="small">{{ treeStats.leafCount }} 叶子</el-tag>
        </div>
      </el-card>
    </div>

    <!-- ==================== 第三步：图文档查询与维护 ==================== -->
    <div v-show="currentStep === 2" class="step-content">
      <BomDocumentStep
        :mode="documentMode"
        :root-node="selectedRootNode"
        @back="currentStep = 1"
      />
    </div>

    <!-- ==================== 物料搜索对话框 ==================== -->
    <el-dialog
      v-model="materialDialogVisible"
      title="物料搜索"
      width="700px"
      :close-on-click-modal="false"
      @open="syncMaterialSelection"
    >
      <div class="dialog-search-bar">
        <el-input
          v-model="materialKeyword"
          placeholder="输入物料编码/名称/规格型号关键字"
          clearable
          @keyup.enter="handleSearchMaterial"
        >
          <template #append>
            <el-button
              :loading="materialLoading"
              @click="handleSearchMaterial" :icon="'Search'">
              搜索
            </el-button>
          </template>
        </el-input>
      </div>

      <el-table
        ref="materialTableRef"
        :data="materialResults"
        v-loading="materialLoading"
        border
        size="small"
        height="300"
        row-key="number"
        @selection-change="materialTempSelection = $event"
      >
        <el-table-column type="selection" width="45" :reserve-selection="true" />
        <el-table-column prop="number" label="物料编码" width="160" show-overflow-tooltip />
        <el-table-column prop="name" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格型号" min-width="160" show-overflow-tooltip />
      </el-table>

      <div class="dialog-tip">
        支持多选，已选项目在再次搜索时会被保留
      </div>

      <template #footer>
        <el-button @click="materialDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmMaterialSelection" :icon="'Check'">
          确认选择 ({{ materialTempSelection.length }}项)
        </el-button>
      </template>
    </el-dialog>

    <!-- ==================== BOM版本搜索对话框 ==================== -->
    <el-dialog
      v-model="bomDialogVisible"
      title="BOM版本搜索"
      width="750px"
      :close-on-click-modal="false"
      @open="syncBomSelection"
    >
      <div class="dialog-search-bar">
        <el-input
          v-model="bomKeyword"
          placeholder="输入BOM版本号/父项物料编码/名称/规格型号关键字"
          clearable
          @keyup.enter="handleSearchBom"
        >
          <template #append>
            <el-button
              :loading="bomLoading"
              @click="handleSearchBom" :icon="'Search'">
              搜索
            </el-button>
          </template>
        </el-input>
      </div>

      <el-table
        ref="bomTableRef"
        :data="bomResults"
        v-loading="bomLoading"
        border
        size="small"
        height="300"
        row-key="bomNumber"
        @selection-change="bomTempSelection = $event"
      >
        <el-table-column type="selection" width="45" :reserve-selection="true" />
        <el-table-column prop="bomNumber" label="BOM版本号" width="150" show-overflow-tooltip />
        <el-table-column prop="materialName" label="父项物料名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="materialNumber" label="父项物料编码" width="140" show-overflow-tooltip />
        <el-table-column prop="specification" label="规格型号" min-width="140" show-overflow-tooltip />
      </el-table>

      <div class="dialog-tip">
        支持多选，已选项目在再次搜索时会被保留
      </div>

      <template #footer>
        <el-button @click="bomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBomSelection" :icon="'Check'">
          确认选择 ({{ bomTempSelection.length }}项)
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style lang="scss" scoped>
.bom-input-prefix {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.bom-expand-wizard {
  padding: 16px;

  .wizard-steps {
    margin-bottom: 20px;
  }

  .step-title {
    font-weight: 600;
    font-size: 15px;
  }

  .step-content {
    :deep(.el-card) {
      border: 1px solid #e4e7ed;
    }
  }

  .form-help {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }

  .sheet9-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sheet9-actions .el-button + .el-button {
    margin-left: 0;
  }

  .sheet9-actions + .form-help {
    display: block;
    margin-left: 0;
    margin-top: 6px;
  }

  .sheet9-file-input {
    display: none;
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    :deep(.el-tag) {
      max-width: 100%;
    }
  }

  .selected-empty {
    color: #c0c4cc;
    font-size: 12px;
    margin-top: 4px;
  }

  .mt-2 {
    margin-top: 8px;
  }

  .step-footer {
    margin-top: 24px;
    display: flex;
    justify-content: center;
    padding: 8px 0;
  }

  .step2-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .step2-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .query-summary {
    background: var(--el-fill-color-lighter, #f5f7fa);
    padding: 10px 14px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.6;

    .summary-label {
      color: var(--el-text-color-secondary, #606266);
      font-weight: 500;
    }

    .summary-value {
      color: var(--el-text-color-primary, #303133);
    }

    .summary-sep {
      margin: 0 8px;
      color: var(--el-border-color-lighter, #dcdfe6);
    }
  }

  .stats-bar {
    margin-top: 16px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  // ==================== 树表格工具栏（行内合并布局） ====================
  .tree-toolbar {
    padding: 6px 0;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);

    .toolbar-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: nowrap;
      gap: 8px;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--el-text-color-secondary, #909399);
      white-space: nowrap;
    }

    .toolbar-qty {
      display: flex;
      align-items: center;
      gap: 4px;

      .qty-input {
        width: 90px;

        :deep(.el-input__inner) {
          text-align: center;
          font-size: 12px;
        }

        :deep(.el-input-number__decrease),
        :deep(.el-input-number__increase) {
          width: 22px;
        }
      }
    }

    .toolbar-label {
      font-size: 12px;
      color: var(--el-text-color-secondary, #606266);
      white-space: nowrap;
    }

    .toolbar-scrap-cb {
      :deep(.el-checkbox__label) {
        font-size: 12px;
      }
    }

    .toolbar-btn-icon {
      font-size: 14px;
      letter-spacing: 0;
    }

    .toolbar-stat {
      white-space: nowrap;
    }

    .toolbar-sep {
      color: var(--el-border-color, #dcdfe6);
    }

    // ==================== 搜索面板 ====================
    .toolbar-search-panel {
      margin-top: 8px;
      padding: 8px 10px;
      background: var(--el-fill-color-lighter, #f5f7fa);
      border-radius: 4px;
      border: 1px solid var(--el-border-color-light, #e4e7ed);

      .search-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .search-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .search-label {
        font-size: 12px;
        color: var(--el-text-color-secondary, #606266);
        white-space: nowrap;
      }

      .search-input {
        width: 140px;

        :deep(.el-input__inner) {
          font-size: 12px;
        }

        :deep(.el-input__prefix) {
          font-size: 12px;
        }
      }

      .search-clear-all {
        margin-left: auto;
      }

      .search-hint {
        margin-top: 6px;
        font-size: 11px;
        color: var(--el-text-color-placeholder, #909399);
        line-height: 1.4;
      }
    }
  }

  .dialog-search-bar {
    margin-bottom: 12px;
  }

  .dialog-tip {
    margin-top: 8px;
    color: var(--el-text-color-placeholder, #909399);
    font-size: 12px;
  }
}

// ==================== BOM 树表格通用文本 ====================
.text-muted {
  color: var(--el-text-color-placeholder, #c0c4cc);
  font-style: italic;
}

// ==================== 物料编码单元格 ====================
.material-code-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;

  &.is-root {
    padding-left: 0;
  }
}

.material-number {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12.5px;
  letter-spacing: 0.3px;

  &.is-root {
    font-size: 13px;
    font-weight: 700;
    color: var(--el-color-primary, #409eff);
  }
}

// ==================== 树连线圆点链 ====================
.tree-chain {
  display: inline-flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.tc-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.8;
  transition: transform 0.15s ease, opacity 0.15s ease;

  &-root {
    width: 10px;
    height: 10px;
    opacity: 1;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.25);
  }
}

.tc-line {
  display: inline-block;
  width: 10px;
  height: 1px;
  border-top: 1.5px solid;
  flex-shrink: 0;
  opacity: 0.3;
  margin: 0 1px;
  border-color: var(--el-text-color-placeholder, #c0c4cc);
}

// ==================== 节点类型图标（叶子/分支） ====================
.node-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  flex-shrink: 0;
  color: var(--el-color-primary, #409eff);
  margin: 0 2px;
  transition: transform 0.2s ease;

  &.is-leaf {
    color: var(--el-text-color-placeholder, #909399);
    font-size: 14px;
    margin-top: -2px;
  }
}

// ==================== 物料名称单元格 ====================
.material-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.material-name {
  font-weight: 500;
  font-size: 13px;

  &.is-root {
    font-size: 14px;
    font-weight: 700;
  }
}

.root-badge {
  flex-shrink: 0;
  font-weight: 600;
}

// ==================== 层级标签 ====================
.level-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
  min-width: 28px;
  text-align: center;

  &-root {
    background: #909399;
    letter-spacing: 1px;
  }
}

// ==================== 所属父项引用 ====================
.parent-ref {
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
  cursor: default;
  border-bottom: 1px dashed var(--el-border-color, #dcdfe6);
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-primary, #409eff);
  }
}

.preview-panel {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 4px;
  padding: 12px;
}

.preview-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.preview-frame,
.onlyoffice-preview-wrap,
.onlyoffice-preview-container {
  width: 100%;
  height: 520px;
  border: 0;
}

.onlyoffice-preview-wrap {
  position: relative;
}

.preview-tip {
  padding: 24px;
  color: var(--el-text-color-secondary, #909399);
  text-align: center;
  background: var(--el-fill-color-lighter, #f5f7fa);
  border-radius: 4px;
}

// ==================== 用量数值 ====================
.quantity-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12.5px;
  color: var(--el-text-color-primary, #303133);
  font-weight: 500;
  word-break: break-all;
}

// ==================== 损耗数值 ====================
.scrap-value {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);

  &.has-scrap {
    color: var(--el-color-warning, #e6a23c);
    font-weight: 600;
  }
}

// ==================== 需求量数值 ====================
.demand-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12.5px;
  color: var(--el-color-primary, #409eff);
  font-weight: 600;

  &.demand-root {
    font-size: 13px;
    font-weight: 700;
  }
}

// ==================== BOM 树表格 ====================
:deep(.bom-tree-table) {
  // 层级左边框强调（通过 row-class-name）
  .tree-row-root td {
    background-color: #ecf5ff;
    border-bottom: 2px solid var(--el-color-primary-light-5, #a0cfff) !important;

    &:first-child {
      border-left: 3px solid var(--el-color-primary, #409eff) !important;
    }
  }

  // 子节点：层级着色 + 左边框强调
  .tree-row-depth-0 td {
    background-color: #f0f9eb;

    &:first-child {
      border-left: 3px solid #67C23A !important;
    }
  }

  .tree-row-depth-1 td {
    background-color: #f4f8ff;

    &:first-child {
      border-left: 3px solid #409EFF !important;
    }
  }

  .tree-row-depth-2 td {
    background-color: #fef6ec;

    &:first-child {
      border-left: 3px solid #E6A23C !important;
    }
  }

  .tree-row-depth-3 td {
    background-color: #fef0f0;

    &:first-child {
      border-left: 3px solid #F56C6C !important;
    }
  }

  .tree-row-depth-4 td {
    background-color: #f5f5f5;

    &:first-child {
      border-left: 3px solid #909399 !important;
    }
  }

  // 垂直树形引导线（在 Element Plus 的 indent 区域绘制）
  .el-table__indent {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--el-border-color-light, #e4e7ed);
      transform: translateX(-50%);
      pointer-events: none;
    }
  }

  // 缩进增强
  .cell-depth-1 { padding-left: 30px !important; }
  .cell-depth-2 { padding-left: 44px !important; }
  .cell-depth-3 { padding-left: 58px !important; }
  .cell-depth-4 { padding-left: 72px !important; }

  // 展开图标优化
  .el-table__expand-icon {
    width: 18px;
    height: 18px;
    font-size: 12px;
    color: var(--el-color-primary, #409eff);

    & > .el-icon {
      font-size: 12px;
    }
  }

  // 搜索高亮行
  .row-highlight td {
    background-color: #e6f7ff !important;
    box-shadow: inset 3px 0 0 var(--el-color-primary, #409eff);
  }

  // 过滤隐藏行
  .row-hidden {
    display: none !important;
  }

  // 表格 hover 不影响层级色
}

// ==================== 紧凑视图 ====================
.bom-tree-table.compact-view {
  :deep(.el-table__body) {
    .el-table__row td {
      padding-top: 2px !important;
      padding-bottom: 2px !important;
    }
  }

  :deep(.el-table__expand-icon) {
    width: 14px;
    height: 14px;

    & > .el-icon {
      font-size: 10px;
    }
  }

  .material-number {
    font-size: 11.5px !important;

    &.is-root {
      font-size: 12px !important;
    }
  }

  .material-name {
    font-size: 12px !important;

    &.is-root {
      font-size: 13px !important;
    }
  }

  .tc-dot {
    width: 6px !important;
    height: 6px !important;

    &-root {
      width: 8px !important;
      height: 8px !important;
    }
  }

  .tc-line {
    width: 7px !important;
  }

  .node-type-icon {
    width: 11px !important;
    height: 11px !important;
    font-size: 9px !important;
  }

  .level-badge {
    font-size: 10px !important;
    padding: 0 5px !important;
    min-width: 22px !important;
  }

  .category-badge {
    font-size: 9px !important;
    padding: 0 4px !important;
  }

  .quantity-value {
    font-size: 11.5px !important;
  }

  .scrap-value {
    font-size: 11px !important;
  }

  .demand-value {
    font-size: 11.5px !important;
  }

  .parent-ref {
    font-size: 11px !important;
  }
}

// ==================== 查询摘要信息提示 ====================
.dark .bom-expand-wizard .query-summary {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}
</style>

<!-- 非 scoped 样式：暗色主题适配，不会被 Vue 的作用域约束 -->
<style lang="scss">
// ==================== 暗色主题：树表格层级左边框 + 行背景 ====================
.dark .bom-expand-wizard .bom-tree-table {
  // 根节点暗色
  .tree-row-root td {
    background-color: rgba(64, 158, 255, 0.10) !important;
    border-bottom-color: rgba(64, 158, 255, 0.3) !important;

    &:first-child {
      border-left-color: rgba(64, 158, 255, 0.6) !important;
    }
  }

  // 深度 0
  .tree-row-depth-0 td {
    background-color: rgba(103, 194, 58, 0.07) !important;

    &:first-child {
      border-left-color: rgba(103, 194, 58, 0.5) !important;
    }
  }

  // 深度 1
  .tree-row-depth-1 td {
    background-color: rgba(64, 158, 255, 0.06) !important;

    &:first-child {
      border-left-color: rgba(64, 158, 255, 0.4) !important;
    }
  }

  // 深度 2
  .tree-row-depth-2 td {
    background-color: rgba(230, 162, 60, 0.07) !important;

    &:first-child {
      border-left-color: rgba(230, 162, 60, 0.5) !important;
    }
  }

  // 深度 3
  .tree-row-depth-3 td {
    background-color: rgba(245, 108, 108, 0.07) !important;

    &:first-child {
      border-left-color: rgba(245, 108, 108, 0.5) !important;
    }
  }

  // 深度 4
  .tree-row-depth-4 td {
    background-color: rgba(255, 255, 255, 0.03) !important;

    &:first-child {
      border-left-color: rgba(144, 147, 153, 0.4) !important;
    }
  }
}

// ==================== 暗色主题：行 hover 高亮保持可见 ====================
.dark .bom-expand-wizard .bom-tree-table .el-table__body tr:hover > td {
  background-color: var(--el-table-row-hover-bg-color) !important;
}

// ==================== 暗色主题：树表格工具栏 ====================
.dark .bom-expand-wizard .tree-toolbar {
  border-bottom-color: var(--el-border-color-darker) !important;
}

// ==================== 暗色主题：搜索面板 ====================
.dark .bom-expand-wizard .toolbar-search-panel {
  background: var(--el-fill-color, #1d1e1f) !important;
  border-color: var(--el-border-color-darker, #333) !important;
}

// ==================== 暗色主题：需求量数值 ====================
.dark .bom-expand-wizard .demand-value {
  color: var(--el-color-primary-light-5, #a0cfff) !important;
}

// ==================== 暗色主题：搜索高亮行 ====================
.dark .bom-expand-wizard .bom-tree-table .row-highlight td {
  background-color: rgba(64, 158, 255, 0.15) !important;
  box-shadow: inset 3px 0 0 var(--el-color-primary, #409eff);
}

// ==================== 暗色主题：树连线圆点对比度增强 ====================
.dark .bom-expand-wizard .tc-dot {
  opacity: 0.95;
}

.dark .bom-expand-wizard .tc-line {
  opacity: 0.45;
  border-color: var(--el-text-color-placeholder);
}

// ==================== 暗色主题：节点类型图标 ====================
.dark .bom-expand-wizard .node-type-icon.is-leaf {
  color: var(--el-text-color-regular);
}

// ==================== 暗色主题：所属父项引用可读性 ====================
.dark .bom-expand-wizard .parent-ref {
  color: var(--el-text-color-regular) !important;
}
</style>
