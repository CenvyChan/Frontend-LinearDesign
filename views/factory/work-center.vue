<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { WorkCenter } from '#/api/workCenter';
import {
  createWorkCenter,
  deleteWorkCenter,
  exportWorkCenter,
  getWorkCenterList,
  updateWorkCenter,
} from '#/api/workCenter';
import { downloadBlob } from '#/utils/download';

defineOptions({ name: 'FactoryWorkCenter' });

const loading = ref(false);
const tableData = ref<WorkCenter[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const formRef = ref<FormInstance>();
const isEdit = ref(false);
const currentId = ref<number | null>(null);

const formData = reactive<Partial<WorkCenter>>({
  code: '',
  name: '',
  location: '',
  capacity: 0,
  remark: '',
});

const rules: FormRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res: any = await getWorkCenterList();
    if (res.success) {
      tableData.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取工作中心列表失败');
    }
  } catch (error: any) {
    ElMessage.error('获取工作中心列表失败');
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: WorkCenter) => {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    dialogTitle.value = '编辑工作中心';
    Object.assign(formData, {
      code: row.code,
      name: row.name,
      location: row.location || '',
      capacity: row.capacity || 0,
      remark: row.remark || '',
    });
  } else {
    isEdit.value = false;
    currentId.value = null;
    dialogTitle.value = '新建工作中心';
    resetForm();
  }
  dialogVisible.value = true;
};

const resetForm = () => {
  formData.code = '';
  formData.name = '';
  formData.location = '';
  formData.capacity = 0;
  formData.remark = '';
};

const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (isEdit.value && currentId.value) {
        await updateWorkCenter(currentId.value, formData);
        ElMessage.success('更新成功');
      } else {
        await createWorkCenter(formData);
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
    await ElMessageBox.confirm('确认删除该工作中心？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await deleteWorkCenter(id);
    ElMessage.success('删除成功');
    await fetchData();
  } catch {
    // cancelled
  }
};

const handleExport = async () => {
  try {
    const blob = await exportWorkCenter();
    downloadBlob(blob, '工作中心导出.xlsx');
  } catch {
    ElMessage.error('导出失败');
  }
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">工作中心</h1>
      <div class="flex gap-2">
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-button type="primary" @click="openDialog()" :icon="'Plus'">新建工作中心</el-button>
      </div>
    </div>

    <el-card shadow="never" class="w-full">
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%" row-key="id">
        <el-table-column prop="code" label="编码" min-width="120" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="location" label="位置" min-width="160" />
        <el-table-column prop="capacity" label="产能" width="100" align="right" />
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" type="primary" link @click="openDialog(row)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" type="danger" link @click="handleDelete(row.id)" :icon="'Delete'">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
        <el-form-item label="编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="formData.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="产能" prop="capacity">
          <el-input-number v-model="formData.capacity" :min="0" style="width: 100%" />
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
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
