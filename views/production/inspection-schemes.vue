<script lang="ts" setup>
import type {
  InspectionItemValueType,
  InspectionScheme,
  InspectionSchemeItem,
  InspectionType,
} from '#/api/inspectionScheme';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { downloadBlob } from '#/utils/download';

import {
  createInspectionScheme,
  createInspectionSchemeItem,
  exportInspectionSchemes,
  getInspectionSchemeItems,
  getInspectionSchemes,
  updateInspectionScheme,
  updateInspectionSchemeItem,
} from '#/api/inspectionScheme';

defineOptions({ name: 'InspectionSchemes' });

const INSPECTION_TYPES: Array<{ label: string; value: InspectionType }> = [
  { label: '来料检验', value: 'IQC' },
  { label: '制程检验', value: 'PQC' },
  { label: '产品检验', value: 'FQC' },
  { label: '发货检验', value: 'OQC' },
  { label: '产线巡检', value: 'LQC' },
];

const VALUE_TYPES: Array<{ label: string; value: InspectionItemValueType }> = [
  { label: '数值', value: 'NUMERIC' },
  { label: '文本', value: 'TEXT' },
  { label: '枚举', value: 'ENUM' },
  { label: '布尔', value: 'BOOLEAN' },
  { label: '附件', value: 'ATTACHMENT' },
];

const loading = ref(false);
const itemLoading = ref(false);
const saving = ref(false);
const schemeDialogVisible = ref(false);
const itemDialogVisible = ref(false);
const schemes = ref<InspectionScheme[]>([]);
const items = ref<InspectionSchemeItem[]>([]);
const selectedScheme = ref<InspectionScheme | null>(null);
const typeFilter = ref<'' | InspectionType>('');

const schemeForm = reactive<Partial<InspectionScheme>>({
  inspectionType: 'PQC',
  schemeCode: '',
  schemeName: '',
  version: 'V1',
  status: 'ACTIVE',
});

const itemForm = reactive<Partial<InspectionSchemeItem>>({
  itemCode: '',
  itemName: '',
  valueType: 'NUMERIC',
  requiredFlag: true,
  sampleCount: 1,
  sortOrder: 1,
});

const summary = computed(() => ({
  active: schemes.value.filter((item) => item.status !== 'DISABLED').length,
  itemCount: items.value.length,
  total: schemes.value.length,
}));

function inspectionTypeText(type?: string) {
  return INSPECTION_TYPES.find((item) => item.value === type)?.label || type || '-';
}

function valueTypeText(type?: string) {
  return VALUE_TYPES.find((item) => item.value === type)?.label || type || '-';
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function loadSchemes() {
  loading.value = true;
  try {
    const res = await getInspectionSchemes(typeFilter.value || undefined);
    if (!res.success) throw new Error(res.message || '获取检验方案失败');
    schemes.value = res.data || [];
    if (selectedScheme.value) {
      const matched = schemes.value.find((item) => item.id === selectedScheme.value?.id);
      selectedScheme.value = matched || null;
    }
    const firstScheme = schemes.value[0];
    if (!selectedScheme.value && firstScheme) {
      await selectScheme(firstScheme);
    } else if (!selectedScheme.value) {
      items.value = [];
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取检验方案失败');
  } finally {
    loading.value = false;
  }
}

async function selectScheme(row: InspectionScheme) {
  selectedScheme.value = row;
  itemLoading.value = true;
  try {
    const res = await getInspectionSchemeItems(row.id!);
    if (!res.success) throw new Error(res.message || '获取检验项目失败');
    items.value = res.data || [];
  } catch (error: any) {
    ElMessage.error(error.message || '获取检验项目失败');
  } finally {
    itemLoading.value = false;
  }
}

function resetSchemeForm(row?: InspectionScheme) {
  Object.assign(schemeForm, {
    customerCode: row?.customerCode || '',
    customerName: row?.customerName || '',
    effectiveFrom: row?.effectiveFrom,
    effectiveTo: row?.effectiveTo,
    id: row?.id,
    inspectionType: row?.inspectionType || 'PQC',
    lineCode: row?.lineCode || '',
    lineName: row?.lineName || '',
    materialCode: row?.materialCode || '',
    materialName: row?.materialName || '',
    processCode: row?.processCode || '',
    processName: row?.processName || '',
    productCode: row?.productCode || '',
    productName: row?.productName || '',
    remark: row?.remark || '',
    schemeCode: row?.schemeCode || '',
    schemeName: row?.schemeName || '',
    status: row?.status || 'ACTIVE',
    supplierCode: row?.supplierCode || '',
    supplierName: row?.supplierName || '',
    version: row?.version || 'V1',
  });
}

function openSchemeDialog(row?: InspectionScheme) {
  resetSchemeForm(row);
  schemeDialogVisible.value = true;
}

async function submitScheme() {
  if (!schemeForm.schemeCode || !schemeForm.schemeName || !schemeForm.inspectionType || !schemeForm.version) {
    ElMessage.warning('请填写方案编码、名称、类型和版本');
    return;
  }
  saving.value = true;
  try {
    const res = schemeForm.id
      ? await updateInspectionScheme(schemeForm.id, schemeForm)
      : await createInspectionScheme(schemeForm);
    if (!res.success) throw new Error(res.message || '保存检验方案失败');
    ElMessage.success(res.message || '保存成功');
    schemeDialogVisible.value = false;
    await loadSchemes();
  } catch (error: any) {
    ElMessage.error(error.message || '保存检验方案失败');
  } finally {
    saving.value = false;
  }
}

function resetItemForm(row?: InspectionSchemeItem) {
  Object.assign(itemForm, {
    enumOptions: row?.enumOptions || '',
    id: row?.id,
    itemCode: row?.itemCode || '',
    itemName: row?.itemName || '',
    lowerLimit: row?.lowerLimit,
    methodName: row?.methodName || '',
    remark: row?.remark || '',
    requiredFlag: row?.requiredFlag ?? true,
    sampleCount: row?.sampleCount ?? 1,
    sortOrder: row?.sortOrder ?? (items.value.length + 1),
    standardValue: row?.standardValue || '',
    toleranceMinus: row?.toleranceMinus,
    tolerancePlus: row?.tolerancePlus,
    unit: row?.unit || '',
    upperLimit: row?.upperLimit,
    valueType: row?.valueType || 'NUMERIC',
  });
}

function openItemDialog(row?: InspectionSchemeItem) {
  if (!selectedScheme.value?.id) {
    ElMessage.warning('请先选择检验方案');
    return;
  }
  resetItemForm(row);
  itemDialogVisible.value = true;
}

async function submitItem() {
  if (!selectedScheme.value?.id) return;
  if (!itemForm.itemCode || !itemForm.itemName || !itemForm.valueType) {
    ElMessage.warning('请填写项目编码、名称和类型');
    return;
  }
  saving.value = true;
  try {
    const res = itemForm.id
      ? await updateInspectionSchemeItem(selectedScheme.value.id, itemForm.id, itemForm)
      : await createInspectionSchemeItem(selectedScheme.value.id, itemForm);
    if (!res.success) throw new Error(res.message || '保存检验项目失败');
    ElMessage.success(res.message || '保存成功');
    itemDialogVisible.value = false;
    await selectScheme(selectedScheme.value);
  } catch (error: any) {
    ElMessage.error(error.message || '保存检验项目失败');
  } finally {
    saving.value = false;
  }
}

async function handleExport() {
  try {
    const blob = await exportInspectionSchemes();
    downloadBlob(blob, '检验方案导出.xlsx');
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败');
  }
}

onMounted(loadSchemes);
</script>

<template>
  <div class="inspection-scheme-page">
    <section class="summary-row">
      <div class="summary-item"><span>方案总数</span><strong>{{ summary.total }}</strong></div>
      <div class="summary-item"><span>启用方案</span><strong>{{ summary.active }}</strong></div>
      <div class="summary-item"><span>当前项目</span><strong>{{ summary.itemCount }}</strong></div>
    </section>

    <section class="toolbar-panel">
      <el-form inline>
        <el-form-item label="检验类型">
          <el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="toolbar-actions">
            <el-button type="primary" :icon="'Search'" @click="loadSchemes">查询</el-button>
            <el-button type="success" :icon="'Plus'" @click="openSchemeDialog()">新建方案</el-button>
            <el-button :icon="'Download'" @click="handleExport">导出</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="content-grid">
      <div class="table-panel">
        <div class="section-head">
          <strong>检验方案</strong>
        </div>
        <el-table :data="schemes" v-loading="loading" border stripe highlight-current-row size="small" @row-click="selectScheme">
          <el-table-column label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ inspectionTypeText(row.inspectionType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="方案" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <strong>{{ row.schemeName }}</strong>
                <span>{{ row.schemeCode }} / {{ row.version }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="适用对象" min-width="230" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <span>物料：{{ row.materialCode || '*' }} {{ row.materialName || '' }}</span>
                <span>工序：{{ row.processCode || '*' }} {{ row.processName || '' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'DISABLED' ? 'info' : 'success'">{{ row.status === 'DISABLED' ? '停用' : '启用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button size="small" link type="primary" :icon="'Edit'" @click.stop="openSchemeDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-panel">
        <div class="section-head">
          <div class="inline-info">
            <strong>检验项目</strong>
            <span>{{ selectedScheme ? `${selectedScheme.schemeName} / ${selectedScheme.version}` : '请选择方案' }}</span>
          </div>
          <el-button size="small" type="success" :icon="'Plus'" @click="openItemDialog()">新增项目</el-button>
        </div>
        <el-table :data="items" v-loading="itemLoading" border stripe size="small">
          <el-table-column label="项目" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <strong>{{ row.itemName }}</strong>
                <span>{{ row.itemCode }} / {{ row.methodName || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">{{ valueTypeText(row.valueType) }}</template>
          </el-table-column>
          <el-table-column label="标准/公差" min-width="210" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <span>标准：{{ row.standardValue || '-' }} {{ row.unit || '' }}</span>
                <span>范围：{{ row.lowerLimit ?? '-' }} ~ {{ row.upperLimit ?? '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="sampleCount" label="样本数" width="80" align="right" />
          <el-table-column label="必检" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.requiredFlag ? 'success' : 'info'">{{ row.requiredFlag ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button size="small" link type="primary" :icon="'Edit'" @click="openItemDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <el-dialog v-model="schemeDialogVisible" title="检验方案" width="840px">
      <el-form :model="schemeForm" label-width="100px" size="small">
        <div class="form-grid">
          <el-form-item label="检验类型">
            <el-select v-model="schemeForm.inspectionType" style="width: 100%">
              <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="schemeForm.status" style="width: 100%">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="方案编码">
            <el-input v-model="schemeForm.schemeCode" />
          </el-form-item>
          <el-form-item label="方案名称">
            <el-input v-model="schemeForm.schemeName" />
          </el-form-item>
          <el-form-item label="版本">
            <el-input v-model="schemeForm.version" />
          </el-form-item>
          <el-form-item label="物料编码">
            <el-input v-model="schemeForm.materialCode" />
          </el-form-item>
          <el-form-item label="物料名称">
            <el-input v-model="schemeForm.materialName" />
          </el-form-item>
          <el-form-item label="产品编码">
            <el-input v-model="schemeForm.productCode" />
          </el-form-item>
          <el-form-item label="产品名称">
            <el-input v-model="schemeForm.productName" />
          </el-form-item>
          <el-form-item label="工序编码">
            <el-input v-model="schemeForm.processCode" />
          </el-form-item>
          <el-form-item label="工序名称">
            <el-input v-model="schemeForm.processName" />
          </el-form-item>
          <el-form-item label="供应商">
            <el-input v-model="schemeForm.supplierName" />
          </el-form-item>
          <el-form-item label="客户">
            <el-input v-model="schemeForm.customerName" />
          </el-form-item>
          <el-form-item label="产线">
            <el-input v-model="schemeForm.lineName" />
          </el-form-item>
          <el-form-item label="备注" class="form-wide">
            <el-input v-model="schemeForm.remark" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="schemeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitScheme" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialogVisible" title="检验项目" width="760px">
      <el-form :model="itemForm" label-width="100px" size="small">
        <div class="form-grid">
          <el-form-item label="项目编码">
            <el-input v-model="itemForm.itemCode" />
          </el-form-item>
          <el-form-item label="项目名称">
            <el-input v-model="itemForm.itemName" />
          </el-form-item>
          <el-form-item label="检验方法">
            <el-input v-model="itemForm.methodName" />
          </el-form-item>
          <el-form-item label="值类型">
            <el-select v-model="itemForm.valueType" style="width: 100%">
              <el-option v-for="item in VALUE_TYPES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model="itemForm.unit" />
          </el-form-item>
          <el-form-item label="标准值">
            <el-input v-model="itemForm.standardValue" />
          </el-form-item>
          <el-form-item label="下限">
            <el-input-number v-model="itemForm.lowerLimit" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="上限">
            <el-input-number v-model="itemForm.upperLimit" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="负公差">
            <el-input-number v-model="itemForm.toleranceMinus" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="正公差">
            <el-input-number v-model="itemForm.tolerancePlus" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="枚举值">
            <el-input v-model="itemForm.enumOptions" placeholder="多个值用逗号分隔" />
          </el-form-item>
          <el-form-item label="样本数">
            <el-input-number v-model="itemForm.sampleCount" :min="1" :precision="0" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="itemForm.sortOrder" :min="1" :precision="0" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="是否必检">
            <el-switch v-model="itemForm.requiredFlag" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="备注" class="form-wide">
            <el-input v-model="itemForm.remark" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitItem" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.inspection-scheme-page {
  min-height: 100%;
  padding: 16px;
  background: #f5f7fb;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item,
.toolbar-panel,
.table-panel {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.summary-item span,
.inline-info span {
  color: #606266;
  font-size: 13px;
}

.summary-item strong {
  color: #1f2937;
  font-size: 22px;
}

.toolbar-panel,
.table-panel {
  padding: 12px;
}

.toolbar-panel {
  margin-bottom: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px;
}

.toolbar-actions,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap;
}

.section-head {
  margin-bottom: 10px;
}

.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.form-wide {
  grid-column: 1 / -1;
}

@media (max-width: 1100px) {
  .summary-row,
  .content-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
