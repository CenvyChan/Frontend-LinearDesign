<script setup lang="ts">
import type { BomWhereUsedRow } from '#/api/bom';

import { computed, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import { queryBomWhereUsed } from '#/api/bom';

defineOptions({ name: 'BomWhereUsedDrawer' });

interface Props {
  modelValue: boolean;
  /** 待反查的物料编码 */
  materialNumber?: string;
  materialName?: string;
  /** 采购单据行上的采购组织编码，如 001 */
  orgNumber?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** 树节点：在扁平行上挂 id 与 children */
interface WhereUsedNode extends BomWhereUsedRow {
  id: string;
  children?: WhereUsedNode[];
}

const loading = ref(false);
const maxLevel = ref(10);
const treeData = ref<WhereUsedNode[]>([]);
const flatRows = ref<BomWhereUsedRow[]>([]);
const errorMessage = ref('');

// el-table 的 default-expand-all 不是响应式的，改值不会重新展开。
// 唯一可靠的做法是变更 :key 强制整表重渲染（沿用 bom-expand.vue 的既有解法）。
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

/**
 * 扁平行转树。
 *
 * 后端返回每行一条父子关系，并带一条 pathTree（形如 `顶层 -> 中间件 -> 输入物料`）。
 * 按 pathTree 的前缀建树比按 bomLevel 猜父子可靠：反查是多个顶层成品向下收敛到同一个
 * 输入物料，同一 bomLevel 上的行可能属于完全不同的分支。
 */
function buildTree(rows: BomWhereUsedRow[]): WhereUsedNode[] {
  const byPath = new Map<string, WhereUsedNode>();
  const roots: WhereUsedNode[] = [];

  // 先按层次升序，保证父节点总在子节点之前入表。
  const sorted = [...rows].sort((a, b) => (b.bomLevel ?? 0) - (a.bomLevel ?? 0));

  for (const row of sorted) {
    const path = row.pathTree ?? row.parentMaterialNumber;
    const segments = path
      .split(' -> ')
      .map((segment) => segment.trim())
      .filter(Boolean);
    // 路径本身就是唯一键：同一父项出现在不同分支上是两个节点，不能按物料编码去重。
    const selfPath = segments.join(' -> ');
    if (byPath.has(selfPath)) {
      continue;
    }
    const node: WhereUsedNode = { ...row, id: selfPath, children: [] };
    byPath.set(selfPath, node);

    // 去掉路径最后一段得到父路径；父路径存在则挂上去，否则视为一棵新树的根。
    const parentPath = segments.slice(0, -1).join(' -> ');
    const parent = parentPath ? byPath.get(parentPath) : undefined;
    if (parent) {
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // children 为空数组会让 el-table 画出多余的展开箭头，清掉。
  const prune = (nodes: WhereUsedNode[]) => {
    for (const node of nodes) {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        prune(node.children);
      }
    }
  };
  prune(roots);
  return roots;
}

async function load() {
  if (!props.materialNumber) {
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await queryBomWhereUsed({
      materialNumber: props.materialNumber,
      // 采购行上的采购组织编码，后端归一化成 ERP 内码后再过滤 T_ENG_BOM.FUSEORGID
      useOrgId: props.orgNumber,
      maxLevel: maxLevel.value,
    });
    if (!res?.success) {
      errorMessage.value = res?.message ?? '反查失败';
      flatRows.value = [];
      treeData.value = [];
      return;
    }
    flatRows.value = res.data ?? [];
    treeData.value = buildTree(flatRows.value);
    tableRerenderKey.value++;
    if (flatRows.value.length === 0) {
      errorMessage.value = '该物料没有被任何上级 BOM 使用（或在当前组织下无启用 BOM）';
    }
  } catch (error: any) {
    errorMessage.value = error?.message ?? '反查请求异常';
    flatRows.value = [];
    treeData.value = [];
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.materialNumber],
  ([open]) => {
    if (open) {
      load();
    }
  },
  { immediate: true },
);

/** 顶层成品数量：反查的核心结论 —— 这个物料最终影响几个成品 */
const topLevelCount = computed(() => treeData.value.length);
</script>

<template>
  <el-drawer v-model="visible" size="70%" :destroy-on-close="true">
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-base font-medium">BOM 反查</span>
        <el-tag v-if="materialNumber" type="info" size="small">
          {{ materialNumber }}
        </el-tag>
        <span v-if="materialName" class="text-sm text-gray-500">
          {{ materialName }}
        </span>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <el-alert type="info" :closable="false" show-icon>
        <template #title>
          查询这个物料被哪些上级 BOM 使用（向上追溯）。组织：{{
            orgNumber || '未指定'
          }}
        </template>
      </el-alert>

      <div class="flex items-center gap-3">
        <span class="text-sm">追溯层数</span>
        <el-input-number
          v-model="maxLevel"
          :min="1"
          :max="20"
          size="small"
          @change="load"
        />
        <el-button size="small" @click="handleExpandAll">展开全部</el-button>
        <el-button size="small" @click="handleCollapseAll">收起全部</el-button>
        <el-button size="small" type="primary" :loading="loading" @click="load">
          重新查询
        </el-button>
        <div class="ml-auto flex items-center gap-3 text-sm text-gray-500">
          <span>顶层成品 {{ topLevelCount }}</span>
          <span>关系行 {{ flatRows.length }}</span>
        </div>
      </div>

      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="warning"
        :closable="false"
        show-icon
      />

      <el-table
        :key="tableRerenderKey"
        v-loading="loading"
        :data="treeData"
        border
        row-key="id"
        :tree-props="{ children: 'children' }"
        :default-expand-all="expandAllFlag"
        height="calc(100vh - 320px)"
      >
        <el-table-column label="父项物料" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="font-mono text-sm">{{
                row.parentMaterialNumber
              }}</span>
              <span class="text-xs text-gray-500">{{
                row.parentMaterialName
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="parentMaterialModel"
          label="父项规格"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column label="层次" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.bomLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="子项物料" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="font-mono text-sm">{{
                row.childMaterialNumber
              }}</span>
              <span class="text-xs text-gray-500">{{
                row.childMaterialName
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="单位用量" width="110" align="right">
          <template #default="{ row }">
            <span class="font-mono">{{ row.unitUsage ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="unitName" label="单位" width="80" />
        <el-table-column label="分子/分母" width="110" align="center">
          <template #default="{ row }">
            <span class="font-mono text-xs"
              >{{ row.numerator ?? '-' }} / {{ row.denominator ?? '-' }}</span
            >
          </template>
        </el-table-column>
        <el-table-column
          prop="bomVersion"
          label="BOM版本"
          width="170"
          show-overflow-tooltip
        />
        <el-table-column
          prop="pathTree"
          label="路径"
          min-width="260"
          show-overflow-tooltip
        />
      </el-table>
    </div>
  </el-drawer>
</template>
