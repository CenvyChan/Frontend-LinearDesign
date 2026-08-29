<script lang="ts" setup>
import type {
  InspectionScheme,
  InspectionSchemeItem,
  InspectionType,
} from '#/api/inspectionScheme';

import { computed, onMounted, ref } from 'vue';

import { ElMessage } from 'element-plus';

import {
  getInspectionSchemeItems,
  getInspectionSchemes,
} from '#/api/inspectionScheme';

import V2DiagnosticsShell from './components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from './components/v2-workbench-model';
import { buildInspectionSchemesV2Model } from './inspection-schemes-v2-model';

defineOptions({ name: 'InspectionSchemesV2' });

const INSPECTION_TYPES: Array<{ label: string; value: InspectionType }> = [
  { label: '来料检验', value: 'IQC' },
  { label: '制程检验', value: 'PQC' },
  { label: '成品检验', value: 'FQC' },
  { label: '发货检验', value: 'OQC' },
  { label: '产线巡检', value: 'LQC' },
];

const loading = ref(false);
const itemLoading = ref(false);
const schemePage = ref(1);
const itemPage = ref(1);
const pageSize = ref(20);
const schemes = ref<InspectionScheme[]>([]);
const items = ref<InspectionSchemeItem[]>([]);
const selectedScheme = ref<InspectionScheme | null>(null);
const typeFilter = ref<'' | InspectionType>('');

const model = computed(() => buildInspectionSchemesV2Model(schemes.value, items.value));
const pagedSchemes = computed(() => paginateV2Rows(schemes.value, schemePage.value, pageSize.value));
const pagedItems = computed(() => paginateV2Rows(items.value, itemPage.value, pageSize.value));
const metrics = computed(() => [
  { label: '方案总数', value: model.value.summary.total },
  { label: '启用方案', tone: 'success', value: model.value.summary.active },
  { label: '停用方案', tone: 'warning', value: model.value.summary.disabled },
  { label: '当前项目', tone: 'primary', value: model.value.summary.selectedItemCount },
  { label: '必检项目', tone: 'stable', value: model.value.summary.requiredItemCount },
]);
const chains = computed(() => model.value.coverageByType.map((item) => ({
  key: item.key,
  primary: item.label,
  secondary: `${item.count} 个方案`,
  status: item.count > 0 ? '已覆盖' : '未覆盖',
  tone: item.tone,
})));

function inspectionTypeText(type?: string) {
  return INSPECTION_TYPES.find((item) => item.value === type)?.label || type || '-';
}

function valueTypeText(type?: string) {
  const map: Record<string, string> = {
    ATTACHMENT: '附件',
    BOOLEAN: '布尔',
    ENUM: '枚举',
    NUMERIC: '数值',
    TEXT: '文本',
  };
  return map[type || ''] || type || '-';
}

function formatScope(row: InspectionScheme) {
  return [
    row.materialCode || row.productCode,
    row.processCode,
    row.supplierCode,
    row.customerCode,
    row.lineCode,
  ].filter(Boolean).join(' / ') || '通用';
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

async function loadItems(row: InspectionScheme) {
  if (!row.id) return;
  selectedScheme.value = row;
  itemLoading.value = true;
  try {
    const res: any = await getInspectionSchemeItems(row.id);
    if (!res.success) throw new Error(res.message || '获取检验项目失败');
    items.value = res.data || [];
    itemPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取检验项目失败');
  } finally {
    itemLoading.value = false;
  }
}

async function loadSchemes() {
  loading.value = true;
  try {
    const res: any = await getInspectionSchemes(typeFilter.value || undefined);
    if (!res.success) throw new Error(res.message || '获取检验方案失败');
    schemes.value = res.data || [];
    schemePage.value = 1;
    const first = schemes.value[0];
    if (first) {
      await loadItems(first);
    } else {
      selectedScheme.value = null;
      items.value = [];
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取检验方案失败');
  } finally {
    loading.value = false;
  }
}

function handleSchemeSizeChange(size: number) {
  pageSize.value = size;
  schemePage.value = 1;
}

function handleItemSizeChange(size: number) {
  pageSize.value = size;
  itemPage.value = 1;
}

onMounted(loadSchemes);
</script>

<template>
  <V2DiagnosticsShell
    chain-title="检验类型覆盖"
    description="检验方案与项目标准维护。链路区按检验类型显示覆盖情况，未覆盖的类型意味着该类任务在现场拿不到方案。"
    eyebrow="质量 · 检验方案"
    issue-title="方案风险优先区"
    :chains="chains"
    :issues="model.issueGroups"
    :metrics="metrics"
    title="检验方案"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="loadSchemes" :icon="'Refresh'">刷新</el-button>
    </template>

    <template #toolbar>
      <section class="v2-panel">
        <el-form inline>
          <el-form-item label="检验类型">
            <el-select v-model="typeFilter" clearable placeholder="全部类型" style="width: 150px">
              <el-option v-for="item in INSPECTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadSchemes" :icon="'Refresh'">查询</el-button>
          </el-form-item>
        </el-form>
      </section>
    </template>

    <section class="scheme-grid">
      <div class="v2-panel">
        <div class="section-title">检验方案</div>
        <el-table :data="pagedSchemes" v-loading="loading" border height="500" highlight-current-row size="small" stripe @row-click="loadItems">
          <el-table-column label="类型" width="105" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ inspectionTypeText(row.inspectionType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="方案" min-width="210" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="inline-info">
                <strong>{{ row.schemeName }}</strong>
                <span>{{ row.schemeCode }} / {{ row.version }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="适用范围" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatScope(row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'DISABLED' ? 'info' : 'success'" size="small">
                {{ row.status === 'DISABLED' ? '停用' : '启用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="schemePage"
            :page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="schemes.length"
            background
            layout="total, sizes, prev, pager, next, jumper"
            size="small"
            @size-change="handleSchemeSizeChange"
          />
        </div>
      </div>

      <div class="v2-panel">
        <div class="section-title">
          <span>检验项目</span>
          <small>{{ selectedScheme ? `${selectedScheme.schemeCode} / ${selectedScheme.version}` : '未选择方案' }}</small>
        </div>
        <el-table :data="pagedItems" v-loading="itemLoading" border height="500" size="small" stripe>
          <el-table-column label="项目" min-width="170" show-overflow-tooltip>
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
          <el-table-column label="标准" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.standardValue || '-' }} / {{ row.lowerLimit ?? '-' }} ~ {{ row.upperLimit ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="sampleCount" label="样本" width="80" align="right" />
          <el-table-column label="必检" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.requiredFlag === false ? 'info' : 'success'" size="small">
                {{ row.requiredFlag === false ? '否' : '是' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="itemPage"
            :page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="items.length"
            background
            layout="total, sizes, prev, pager, next, jumper"
            size="small"
            @size-change="handleItemSizeChange"
          />
        </div>
      </div>
    </section>
  </V2DiagnosticsShell>
</template>

<style scoped>
.scheme-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: #111827;
  font-weight: 700;
}

.section-title small,
.inline-info span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.inline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

@media (max-width: 1100px) {
  .scheme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
