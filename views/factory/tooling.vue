<script lang="ts" setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { ResourceBizAction } from '#/api/resourceBiz';
import type { Tooling } from '#/api/tooling';
import {
  createTooling,
  deleteTooling,
  ensureLocalTooling,
  exportTooling,
  getToolingList,
  updateTooling,
} from '#/api/tooling';
import { downloadBlob } from '#/utils/download';
import ResourceBizActions from './components/ResourceBizActions.vue';
import ResourceBizDialog from './components/ResourceBizDialog.vue';
import ResourceBizRecordTab from './components/ResourceBizRecordTab.vue';

defineOptions({ name: 'FactoryTooling' });

const loading = ref(false);
const tableData = ref<Tooling[]>([]);
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const formRef = ref<FormInstance>();
const isEdit = ref(false);
const currentId = ref<number | null>(null);
const detailVisible = ref(false);
const detailTab = ref('base');
const currentRow = ref<Tooling | null>(null);
const bizDialogVisible = ref(false);
const currentBizAction = ref<ResourceBizAction | null>(null);
const recordTabRef = ref<InstanceType<typeof ResourceBizRecordTab>>();

const formData = reactive<Partial<Tooling>>({
  code: '',
  name: '',
  type: '',
  specification: '',
  quantity: 1,
  status: 'NORMAL',
  location: '',
  remark: '',
});

const rules: FormRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res: any = await getToolingList({
      page: currentPage.value,
      pageSize: pageSize.value,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = Number(res.total || 0);
    } else {
      ElMessage.error(res.message || '获取工装夹具列表失败');
    }
  } catch {
    ElMessage.error('获取工装夹具列表失败');
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: Tooling) => {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    dialogTitle.value = '编辑工装夹具';
    Object.assign(formData, {
      code: row.code,
      name: row.name,
      type: row.type || '',
      specification: row.specification || '',
      quantity: row.quantity || 1,
      status: row.status || 'NORMAL',
      location: row.location || '',
      remark: row.remark || '',
    });
  } else {
    isEdit.value = false;
    currentId.value = null;
    dialogTitle.value = '新建工装夹具';
    formData.code = '';
    formData.name = '';
    formData.type = '';
    formData.specification = '';
    formData.quantity = 1;
    formData.status = 'NORMAL';
    formData.location = '';
    formData.remark = '';
  }
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (isEdit.value && currentId.value) {
        await updateTooling(currentId.value, formData);
        ElMessage.success('更新成功');
      } else {
        await createTooling(formData);
        ElMessage.success('创建成功');
      }
      dialogVisible.value = false;
      await fetchData();
    } catch (error: any) {
      ElMessage.error(error?.message || '操作失败');
    }
  });
};

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确认删除该工装夹具？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await deleteTooling(id);
    ElMessage.success('删除成功');
    await fetchData();
  } catch { /* cancelled */ }
};

const openDetail = (row: Tooling) => {
  currentRow.value = row;
  detailTab.value = 'base';
  detailVisible.value = true;
};

const openBizDialog = async (row: Tooling, action: ResourceBizAction) => {
  try {
    let target = row;
    if (!target.id) {
      const res: any = await ensureLocalTooling(target);
      if (!res.success || !res.data?.id) {
        ElMessage.error(res.message || '缺少本地工装ID，无法执行业务操作');
        return;
      }
      target = { ...target, ...res.data };
      const index = tableData.value.findIndex((item) => item.code === row.code);
      if (index >= 0) tableData.value[index] = target;
    }
    currentRow.value = target;
    currentBizAction.value = action;
    bizDialogVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '准备本地工装档案失败');
  }
};

const handleBizSuccess = async () => {
  const selectedId = currentRow.value?.id;
  const selectedCode = currentRow.value?.code;
  await fetchData();
  currentRow.value = tableData.value.find((item) =>
    selectedId ? item.id === selectedId : item.code === selectedCode,
  ) || currentRow.value;
  await nextTick();
  recordTabRef.value?.reload();
};

const handleExport = async () => {
  try {
    const blob = await exportTooling();
    downloadBlob(blob, '工装夹具导出.xlsx');
  } catch {
    ElMessage.error('导出失败');
  }
};

watch([currentPage, pageSize], () => {
  fetchData();
});

onMounted(() => { fetchData(); });
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">工装夹具</h1>
      <div class="flex gap-2">
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-button type="primary" @click="openDialog()" :icon="'Plus'">新建工装夹具</el-button>
      </div>
    </div>
    <el-card shadow="never" class="w-full">
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%" row-key="id">
        <el-table-column prop="code" label="编码" min-width="120" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="specification" label="规格" min-width="140" />
        <el-table-column prop="quantity" label="数量" width="80" align="right" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.statusTagType || 'info'" size="small">
              {{ row.statusText || row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="位置" min-width="140" />
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="业务操作" width="260" fixed="right">
          <template #default="{ row }">
            <ResourceBizActions resource-type="TOOLING" :row="row" @action="(action) => openBizDialog(row, action)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" type="info" link @click="openDetail(row)" :icon="'View'">详情</el-button>
              <el-button size="small" type="primary" link @click="openDialog(row)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" type="danger" link @click="handleDelete(row.id)" :icon="'Delete'">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="factory-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[50, 100, 200, 500]"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-input v-model="formData.type" placeholder="请输入类型" />
        </el-form-item>
        <el-form-item label="规格" prop="specification">
          <el-input v-model="formData.specification" placeholder="请输入规格" />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="formData.quantity" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="formData.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="loading" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="工装详情" size="720px">
      <el-tabs v-model="detailTab">
        <el-tab-pane label="基本信息" name="base">
          <el-descriptions v-if="currentRow" :column="2" border>
            <el-descriptions-item label="编码">{{ currentRow.code }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ currentRow.name }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ currentRow.type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="规格">{{ currentRow.specification || '-' }}</el-descriptions-item>
            <el-descriptions-item label="数量">{{ currentRow.quantity ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ currentRow.statusText || currentRow.status || '-' }}</el-descriptions-item>
            <el-descriptions-item label="位置">{{ currentRow.location || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="业务记录" name="records">
          <ResourceBizRecordTab
            ref="recordTabRef"
            :active="detailTab === 'records'"
            :resource-id="currentRow?.id"
            resource-type="TOOLING"
          />
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <ResourceBizDialog
      v-model="bizDialogVisible"
      :action="currentBizAction"
      :resource="currentRow"
      resource-type="TOOLING"
      @success="handleBizSuccess"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) { border: 1px solid #e4e7ed; }
.factory-pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
