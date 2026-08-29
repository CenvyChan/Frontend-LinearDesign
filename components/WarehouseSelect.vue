<script lang="ts" setup>
/**
 * 仓库多选组件
 * 支持模糊搜索，最多选择3个仓库
 * 支持根据组织ID加载对应仓库列表
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';

interface Warehouse {
  warehouseNumber: string;
  warehouseName: string;
  stockProperty?: number;
  erpOrgId?: string;
}

interface Props {
  modelValue: string[]; // 选中的仓库编码列表
  max?: number; // 最大选择数量，默认3
  erpOrgId?: string; // 组织ID，用于加载对应仓库
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  max: 3,
  erpOrgId: '',
});

const emit = defineEmits<Emits>();

const loading = ref(false);
const warehouseList = ref<Warehouse[]>([]);
const searchKeyword = ref('');
const selectedValues = ref<string[]>([...props.modelValue]);
const dropdownVisible = ref(false);
const isLoading = ref(false);

// 过滤后的仓库列表
const filteredList = computed(() => {
  if (!searchKeyword.value) return warehouseList.value;
  const kw = searchKeyword.value.toLowerCase();
  return warehouseList.value.filter(
    (w) =>
      w.warehouseNumber.toLowerCase().includes(kw) ||
      w.warehouseName.toLowerCase().includes(kw),
  );
});

// 监听外部值变化
watch(
  () => props.modelValue,
  (val) => {
    selectedValues.value = [...val];
  },
);

// 监听组织ID变化，重新加载仓库
watch(
  () => props.erpOrgId,
  async (newOrgId) => {
    if (newOrgId) {
      console.log('[仓库选择] 组织ID变化，加载仓库:', newOrgId);
      await loadWarehousesByOrg(newOrgId);
    }
  },
  { immediate: true },
);

/**
 * 加载所有仓库列表
 */
const loadWarehouses = async () => {
  if (warehouseList.value.length > 0) return;

  loading.value = true;
  try {
    const resp = await fetch('/api/erp/warehouses');
    const result = await resp.json();

    if (result.success && result.data) {
      warehouseList.value = result.data;
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error);
  } finally {
    loading.value = false;
  }
};

/**
 * 根据组织ID加载仓库列表
 */
const loadWarehousesByOrg = async (erpOrgId: string) => {
  isLoading.value = true;
  try {
    const resp = await fetch(`/api/erp/warehouses/${erpOrgId}`);
    const result = await resp.json();

    if (result.success && result.data) {
      warehouseList.value = result.data;
      // 清空已选（因为仓库列表变了）
      selectedValues.value = [];
      emit('update:modelValue', []);
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error);
  } finally {
    isLoading.value = false;
  }
};

/**
 * 选中仓库
 */
const handleSelect = (warehouseNumber: string) => {
  if (selectedValues.value.includes(warehouseNumber)) {
    // 取消选中
    selectedValues.value = selectedValues.value.filter((n) => n !== warehouseNumber);
  } else {
    // 选中
    if (selectedValues.value.length >= props.max) {
      ElMessage.warning(`最多只能选择 ${props.max} 个仓库`);
      return;
    }
    selectedValues.value.push(warehouseNumber);
  }
  emit('update:modelValue', selectedValues.value);
};

/**
 * 移除仓库
 */
const handleRemove = (warehouseNumber: string) => {
  selectedValues.value = selectedValues.value.filter((n) => n !== warehouseNumber);
  emit('update:modelValue', selectedValues.value);
};

/**
 * 清空选择
 */
const handleClear = () => {
  selectedValues.value = [];
  emit('update:modelValue', []);
};

/**
 * 全选
 */
const handleSelectAll = () => {
  const allNumbers = filteredList.value.map((w) => w.warehouseNumber);
  selectedValues.value = allNumbers.slice(0, props.max); // 最多选max个
  emit('update:modelValue', selectedValues.value);
};

/**
 * 下拉菜单显示时加载数据
 */
const handleDropdownVisibleChange = async (visible: boolean) => {
  if (visible) {
    dropdownVisible.value = true;
    searchKeyword.value = '';
    // 如果有组织ID，按组织加载；否则加载全部
    if (props.erpOrgId) {
      await loadWarehousesByOrg(props.erpOrgId);
    } else {
      await loadWarehouses();
    }
  } else {
    dropdownVisible.value = false;
    searchKeyword.value = '';
  }
};
</script>

<template>
  <div class="warehouse-select">
    <!-- 已选标签区域 -->
    <div v-if="selectedValues.length > 0" class="mb-2 flex flex-wrap gap-1">
      <el-tag
        v-for="num in selectedValues"
        :key="num"
        closable
        size="default"
        type="primary"
        @close="handleRemove(num)"
      >
        {{ warehouseList.find((w) => w.warehouseNumber === num)?.warehouseName || num }}
      </el-tag>
      <el-button link type="danger" size="small" class="ml-1" @click="handleClear" :icon="'Delete'">
        清空
      </el-button>
    </div>

    <!-- 下拉选择器 -->
    <el-select
      v-model="selectedValues"
      multiple
      collapse-tags
      collapse-tags-tooltip
      placeholder="选择仓库"
      :max-collapse-tags="2"
      filterable
      :loading="isLoading"
      style="width: 100%"
      @visible-change="handleDropdownVisibleChange"
      @change="emit('update:modelValue', selectedValues)"
    >
      <template #header>
        <div class="flex items-center justify-between px-1">
          <span class="text-xs text-gray-500">仓库列表</span>
          <el-button link type="primary" size="small" @click="handleSelectAll">
            全选
          </el-button>
        </div>
      </template>

      <el-input
        v-model="searchKeyword"
        placeholder="搜索仓库"
        clearable
        class="m-2 w-auto"
      />

      <el-option
        v-for="item in filteredList"
        :key="item.warehouseNumber"
        :label="`${item.warehouseNumber} - ${item.warehouseName}`"
        :value="item.warehouseNumber"
        :disabled="!selectedValues.includes(item.warehouseNumber) && selectedValues.length >= max"
      >
        <div
          class="flex items-center justify-between"
          :class="{ 'text-gray-300': !selectedValues.includes(item.warehouseNumber) && selectedValues.length >= max }"
          @click.stop="handleSelect(item.warehouseNumber)"
        >
          <span>{{ item.warehouseNumber }} - {{ item.warehouseName }}</span>
          <el-icon v-if="selectedValues.includes(item.warehouseNumber)" class="ml-2 text-primary">
            <i class="i-ep-check" />
          </el-icon>
        </div>
      </el-option>
    </el-select>

    <!-- 提示信息 -->
    <div class="mt-1 text-xs text-gray-400">
      最多选择 {{ max }} 个仓库，已选 {{ selectedValues.length }}/{{ max }}
    </div>
  </div>
</template>
