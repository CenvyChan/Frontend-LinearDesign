<script lang="ts" setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { ResourceBizAction } from '#/api/resourceBiz';
import type { Gauge } from '#/api/gauge';
import {
  createGauge,
  deleteGauge,
  ensureLocalGauge,
  exportGauge,
  getGaugeList,
  updateGauge,
} from '#/api/gauge';
import { downloadBlob } from '#/utils/download';
import ResourceBizActions from './components/ResourceBizActions.vue';
import ResourceBizDialog from './components/ResourceBizDialog.vue';
import ResourceBizRecordTab from './components/ResourceBizRecordTab.vue';

defineOptions({ name: 'FactoryGauge' });

const loading = ref(false);
const tableData = ref<Gauge[]>([]);
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
const currentRow = ref<Gauge | null>(null);
const bizDialogVisible = ref(false);
const currentBizAction = ref<ResourceBizAction | null>(null);
const recordTabRef = ref<InstanceType<typeof ResourceBizRecordTab>>();

const formData = reactive<Partial<Gauge>>({
  code: '',
  name: '',
  type: '',
  specification: '',
  accuracy: '',
  status: 'NORMAL',
  calCycle: 12,
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
    const res: any = await getGaugeList({
      page: currentPage.value,
      pageSize: pageSize.value,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = Number(res.total || 0);
    } else {
      ElMessage.error(res.message || '获取量具检具列表失败');
    }
  } catch {
    ElMessage.error('获取量具检具列表失败');
  } finally {
    loading.value = false;
  }
};

const openDialog = (row?: Gauge) => {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    dialogTitle.value = '编辑量具检具';
    Object.assign(formData, {
      code: row.code, name: row.name, type: row.type || '',
      specification: row.specification || '', accuracy: row.accuracy || '',
      status: row.status || 'NORMAL', calCycle: row.calCycle || 12,
      location: row.location || '', remark: row.remark || '',
    });
  } else {
    isEdit.value = false;
    currentId.value = null;
    dialogTitle.value = '新建量具检具';
    formData.code = ''; formData.name = ''; formData.type = '';
    formData.specification = ''; formData.accuracy = '';
    formData.status = 'NORMAL'; formData.calCycle = 12;
    formData.location = ''; formData.remark = '';
  }
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (isEdit.value && currentId.value) {
        await updateGauge(currentId.value, formData);
        ElMessage.success('更新成功');
      } else {
        await createGauge(formData);
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
    await ElMessageBox.confirm('确认删除该量具检具？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    });
    await deleteGauge(id);
    ElMessage.success('删除成功');
    await fetchData();
  } catch { /* cancelled */ }
};

const getNextCalibrationDate = (row: Gauge) => row.nextCalibrationDate ?? row.nextCalDate;

const formatDate = (value?: number) => {
  if (!value) return '-';
  const time = dayjs(value);
  return time.isValid() ? time.format('YYYY-MM-DD') : '-';
};

const getCalibrationTag = (row: Gauge) => {
  const nextDate = getNextCalibrationDate(row);
  if (!nextDate) return { label: '未设置', type: 'info' };
  const days = dayjs(nextDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0) return { label: '已过期', type: 'danger' };
  if (days <= 30) return { label: `${days}天到期`, type: 'warning' };
  return { label: '有效', type: 'success' };
};

const openDetail = (row: Gauge) => {
  currentRow.value = row;
  detailTab.value = 'base';
  detailVisible.value = true;
};

const openBizDialog = async (row: Gauge, action: ResourceBizAction) => {
  try {
    let target = row;
    if (!target.id) {
      const res: any = await ensureLocalGauge(target);
      if (!res.success || !res.data?.id) {
        ElMessage.error(res.message || '缺少本地量具ID，无法执行业务操作');
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
    ElMessage.error(error?.message || '准备本地量具档案失败');
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
    const blob = await exportGauge();
    downloadBlob(blob, '量具检具导出.xlsx');
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
      <h1 class="text-lg font-semibold">量具检具</h1>
      <div class="flex gap-2">
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-button type="primary" @click="openDialog()" :icon="'Plus'">新建量具检具</el-button>
      </div>
    </div>
    <el-card shadow="never" class="w-full">
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%" row-key="id">
        <el-table-column prop="code" label="编码" min-width="120" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="specification" label="规格" min-width="120" />
        <el-table-column prop="accuracy" label="精度" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.statusTagType || (row.status === 'NORMAL' ? 'success' : 'info')" size="small">
              {{ row.statusText || (row.status === 'NORMAL' ? '正常' : '其他') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="calCycle" label="校准周期(月)" width="120" align="right" />
        <el-table-column label="校准到期" min-width="150">
          <template #default="{ row }">
            <div class="calibration-cell">
              <el-tag :type="getCalibrationTag(row).type" size="small">
                {{ getCalibrationTag(row).label }}
              </el-tag>
              <span class="calibration-cell__date">{{ formatDate(getNextCalibrationDate(row)) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="位置" min-width="120" />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="业务操作" width="260" fixed="right">
          <template #default="{ row }">
            <ResourceBizActions resource-type="GAUGE" :row="row" @action="(action) => openBizDialog(row, action)" />
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
        <el-form-item label="编码" prop="code"><el-input v-model="formData.code" placeholder="请输入编码" /></el-form-item>
        <el-form-item label="名称" prop="name"><el-input v-model="formData.name" placeholder="请输入名称" /></el-form-item>
        <el-form-item label="类型" prop="type"><el-input v-model="formData.type" placeholder="请输入类型" /></el-form-item>
        <el-form-item label="规格" prop="specification"><el-input v-model="formData.specification" placeholder="请输入规格" /></el-form-item>
        <el-form-item label="精度" prop="accuracy"><el-input v-model="formData.accuracy" placeholder="请输入精度" /></el-form-item>
        <el-form-item label="校准周期" prop="calCycle">
          <el-input-number v-model="formData.calCycle" :min="1" :max="60" style="width: 100%" />
        </el-form-item>
        <el-form-item label="位置" prop="location"><el-input v-model="formData.location" placeholder="请输入位置" /></el-form-item>
        <el-form-item label="备注" prop="remark"><el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="loading" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="量具详情" size="720px">
      <el-tabs v-model="detailTab">
        <el-tab-pane label="基本信息" name="base">
          <el-descriptions v-if="currentRow" :column="2" border>
            <el-descriptions-item label="编码">{{ currentRow.code }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ currentRow.name }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ currentRow.type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="规格">{{ currentRow.specification || '-' }}</el-descriptions-item>
            <el-descriptions-item label="精度">{{ currentRow.accuracy || currentRow.precision || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ currentRow.statusText || currentRow.status || '-' }}</el-descriptions-item>
            <el-descriptions-item label="校准周期">{{ currentRow.calCycle || '-' }}</el-descriptions-item>
            <el-descriptions-item label="下次校准">{{ formatDate(getNextCalibrationDate(currentRow)) }}</el-descriptions-item>
            <el-descriptions-item label="位置">{{ currentRow.location || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="业务记录" name="records">
          <ResourceBizRecordTab
            ref="recordTabRef"
            :active="detailTab === 'records'"
            :resource-id="currentRow?.id"
            resource-type="GAUGE"
          />
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <ResourceBizDialog
      v-model="bizDialogVisible"
      :action="currentBizAction"
      :resource="currentRow"
      resource-type="GAUGE"
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

.calibration-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calibration-cell__date {
  color: #606266;
  font-size: 12px;
}
</style>
