<script lang="ts" setup>
/**
 * 物料选择弹窗组件
 * 支持按物料编码/名称/规格型号搜索，支持多选和跨搜索累积
 */
import { ref, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';

interface MaterialItem {
  number: string;
  name: string;
  specification: string;
}

interface Props {
  visible: boolean;
  selected?: string[]; // 已选择的物料编码列表
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', items: MaterialItem[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  selected: () => [],
});

const emit = defineEmits<Emits>();

const dialogVisible = ref(props.visible);
const keyword = ref('');
const loading = ref(false);
const tableData = ref<MaterialItem[]>([]);
const tableRef = ref();
const selectedNumbers = ref<string[]>([]); // 弹窗内累积选择

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val;
    if (val) {
      // 打开弹窗时，初始化已选项
      selectedNumbers.value = [...props.selected];
      keyword.value = '';
      tableData.value = [];
    }
  },
);

watch(dialogVisible, (val) => {
  emit('update:visible', val);
});

/**
 * 搜索物料
 */
const handleSearch = async () => {
  const kw = keyword.value.trim();
  if (!kw) {
    ElMessage.warning('请输入搜索关键字');
    return;
  }

  loading.value = true;
  tableData.value = [];

  try {
    const resp = await fetch(`/api/bom/materials/search?keyword=${encodeURIComponent(kw)}`);
    const result = await resp.json();

    if (result.success && result.data) {
      tableData.value = result.data;
      // 恢复选择状态
      await nextTick();
      restoreSelection();

      if (tableData.value.length === 0) {
        ElMessage.info('未找到匹配的物料');
      }
    } else {
      ElMessage.warning(result.message || '搜索失败');
    }
  } catch (error) {
    console.error('物料搜索失败:', error);
    ElMessage.error('物料搜索失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 恢复表格中的选中状态
 */
const restoreSelection = () => {
  if (!tableRef.value || tableData.value.length === 0) return;

  const selectedSet = new Set(selectedNumbers.value);
  tableData.value.forEach((item) => {
    if (selectedSet.has(item.number)) {
      tableRef.value.toggleRowSelection(item, true);
    }
  });
};

/**
 * 选择变化处理（跨搜索累积）
 */
const handleSelectionChange = (selection: MaterialItem[]) => {
  // 当前搜索结果中存在的物料编码
  const currentSet = new Set(tableData.value.map((item) => item.number));

  // 保留之前选择但不在当前搜索结果中的编码
  const kept = selectedNumbers.value.filter((n) => !currentSet.has(n));

  // 合并：已选（不在当前结果中） + 当前选中的
  selectedNumbers.value = [...kept, ...selection.map((item) => item.number)];
};

/**
 * 清空所有选择
 */
const handleClearAll = () => {
  if (tableRef.value) {
    tableRef.value.clearSelection();
  }
  selectedNumbers.value = [];
};

/**
 * 确认选择
 */
const handleConfirm = () => {
  const selectedSet = new Set(selectedNumbers.value);
  const selectedItems = tableData.value.filter((item) => selectedSet.has(item.number));

  emit('confirm', selectedItems);
  dialogVisible.value = false;
};

/**
 * 关闭弹窗
 */
const handleClose = () => {
  dialogVisible.value = false;
};

/**
 * 回车搜索
 */
const handleKeyup = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleSearch();
  }
};
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="选择物料"
    width="720px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- 搜索区域 -->
    <div class="mb-4 flex items-center gap-3">
      <el-input
        v-model="keyword"
        placeholder="输入物料编码/名称/规格型号关键字"
        clearable
        style="width: 400px"
        @keyup="handleKeyup"
      >
        <template #prefix>
          <i class="i-ep-search" />
        </template>
      </el-input>
      <el-button type="primary" :loading="loading" @click="handleSearch" :icon="'Search'">
        搜索
      </el-button>
      <el-button @click="handleClearAll" :disabled="selectedNumbers.length === 0" :icon="'Delete'">
        清空选择
      </el-button>
    </div>

    <!-- 搜索结果表格 -->
    <el-table
      ref="tableRef"
      :data="tableData"
      v-loading="loading"
      border
      stripe
      max-height="400"
      row-key="number"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="45" />
      <el-table-column prop="number" label="物料编码" min-width="160" show-overflow-tooltip />
      <el-table-column prop="name" label="物料名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="specification" label="规格型号" min-width="160" show-overflow-tooltip />
    </el-table>

    <!-- 空状态提示 -->
    <div
      v-if="tableData.length === 0 && !loading"
      class="py-8 text-center text-gray-400"
    >
      请输入关键字后点击搜索
    </div>

    <!-- 已选提示 -->
    <div v-if="selectedNumbers.length > 0" class="mt-3 text-sm text-primary">
      已选择 {{ selectedNumbers.length }} 个物料（跨搜索累积）
    </div>

    <!-- 弹窗底部 -->
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :icon="'Check'">
        确定 ({{ selectedNumbers.length }})
      </el-button>
    </template>
  </el-dialog>
</template>
