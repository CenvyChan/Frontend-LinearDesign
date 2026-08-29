<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  changeFeedbackStatus,
  createFeedback,
  deleteFeedbackAttachment,
  getFeedbackDetail,
  getFeedbackPage,
  replyFeedback,
  updateFeedback,
  uploadFeedbackAttachment,
  type FeedbackDetail,
  type FeedbackItem,
  type FeedbackPriority,
  type FeedbackStatus,
} from '#/api/feedback';

defineOptions({ name: 'SystemFeedback' });

const router = useRouter();

const statusOptions: Array<{ label: string; value: FeedbackStatus }> = [
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已受理', value: 'ACCEPTED' },
  { label: '评估中', value: 'EVALUATING' },
  { label: '开发中', value: 'DEVELOPING' },
  { label: '已完成', value: 'DONE' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已暂缓', value: 'DEFERRED' },
];

const priorityOptions: Array<{ label: string; value: FeedbackPriority }> = [
  { label: '低', value: 'LOW' },
  { label: '普通', value: 'NORMAL' },
  { label: '高', value: 'HIGH' },
  { label: '紧急', value: 'URGENT' },
];

const transitionMap: Record<FeedbackStatus, FeedbackStatus[]> = {
  ACCEPTED: ['EVALUATING', 'REJECTED', 'DEFERRED'],
  DEFERRED: ['ACCEPTED', 'EVALUATING', 'DEVELOPING', 'REJECTED'],
  DEVELOPING: ['DONE', 'DEFERRED', 'REJECTED'],
  DONE: [],
  EVALUATING: ['DEVELOPING', 'REJECTED', 'DEFERRED'],
  REJECTED: [],
  SUBMITTED: ['ACCEPTED', 'REJECTED'],
};

const loading = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const tableData = ref<FeedbackItem[]>([]);
const total = ref(0);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const currentId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const createFileInputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();
const detail = ref<FeedbackDetail | null>(null);
const initialFiles = ref<File[]>([]);

const query = reactive({
  keyword: '',
  page: 1,
  priority: '' as '' | FeedbackPriority,
  size: 20,
  status: '' as '' | FeedbackStatus,
});

const formData = reactive({
  description: '',
  menuPath: '',
  priority: 'NORMAL' as FeedbackPriority,
  remark: '',
  title: '',
});

const statusForm = reactive({
  remark: '',
  status: '' as '' | FeedbackStatus,
});

const replyForm = reactive({
  content: '',
  expectedDeliveryDate: '',
});

const rules: FormRules = {
  menuPath: [{ required: true, message: '请选择菜单路径', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
};

const menuOptions = computed(() => {
  return router
    .getRoutes()
    .filter((route) => {
      const path = route.path || '';
      return Boolean(path && !path.includes(':') && !route.meta?.hideInMenu && route.meta?.title);
    })
    .map((route) => ({
      label: String(route.meta?.title || route.path),
      value: route.path,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
});

function statusLabel(status?: FeedbackStatus) {
  return statusOptions.find((item) => item.value === status)?.label || status || '-';
}

function statusTag(status?: FeedbackStatus) {
  if (status === 'DONE') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'DEFERRED') return 'warning';
  if (status === 'DEVELOPING') return 'primary';
  return 'info';
}

function priorityLabel(priority?: FeedbackPriority) {
  return priorityOptions.find((item) => item.value === priority)?.label || priority || '-';
}

function priorityTag(priority?: FeedbackPriority) {
  if (priority === 'URGENT') return 'danger';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'LOW') return 'info';
  return 'primary';
}

function formatTime(time?: number | string | null) {
  if (!time) return '-';
  const value = String(time);
  if (value.length === 14) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  }
  return typeof time === 'number' ? new Date(time).toLocaleString() : value;
}

function nextStatuses(status?: FeedbackStatus) {
  return status ? transitionMap[status] || [] : [];
}

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getFeedbackPage({
      keyword: query.keyword || undefined,
      page: query.page - 1,
      priority: query.priority || undefined,
      size: query.size,
      status: query.status || undefined,
    });
    if (res.success) {
      tableData.value = res.data || [];
      total.value = res.total || 0;
    } else {
      ElMessage.error(res.message || '获取改进建议失败');
    }
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.page = 1;
  fetchData();
}

function handleReset() {
  query.keyword = '';
  query.priority = '';
  query.status = '';
  handleQuery();
}

function resetForm() {
  formData.description = '';
  formData.menuPath = '';
  formData.priority = 'NORMAL';
  formData.remark = '';
  formData.title = '';
  initialFiles.value = [];
  if (createFileInputRef.value) {
    createFileInputRef.value.value = '';
  }
}

function openDialog(row?: FeedbackItem) {
  resetForm();
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    formData.description = row.description || '';
    formData.menuPath = row.menuPath || '';
    formData.priority = row.priority || 'NORMAL';
    formData.remark = row.remark || '';
    formData.title = row.title || '';
  } else {
    isEdit.value = false;
    currentId.value = null;
  }
  dialogVisible.value = true;
}

async function handleSave() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    if (!isEdit.value && initialFiles.value.length === 0) {
      ElMessage.warning('请至少上传一个附件');
      return;
    }
    saving.value = true;
    try {
      const payload = {
        description: formData.description,
        menuPath: formData.menuPath,
        priority: formData.priority,
        remark: formData.remark,
        title: formData.title,
      };
      const res: any = isEdit.value && currentId.value
        ? await updateFeedback(currentId.value, payload)
        : await createFeedback(payload, initialFiles.value);
      if (res.success) {
        ElMessage.success('保存成功');
        dialogVisible.value = false;
        await fetchData();
      } else {
        ElMessage.error(res.message || '保存失败');
      }
    } finally {
      saving.value = false;
    }
  });
}

function handleInitialFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  const existing = new Set(initialFiles.value.map((file) => `${file.name}_${file.size}_${file.lastModified}`));
  for (const file of files) {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    if (!existing.has(key)) {
      initialFiles.value.push(file);
      existing.add(key);
    }
  }
  input.value = '';
}

function removeInitialFile(index: number) {
  initialFiles.value.splice(index, 1);
}

async function openDetail(row: FeedbackItem) {
  detailVisible.value = true;
  currentId.value = row.id;
  await loadDetail(row.id);
}

async function loadDetail(id: number) {
  detailLoading.value = true;
  try {
    const res: any = await getFeedbackDetail(id);
    if (res.success) {
      detail.value = res.data;
      statusForm.status = '';
      statusForm.remark = '';
      replyForm.content = '';
      replyForm.expectedDeliveryDate = '';
    } else {
      ElMessage.error(res.message || '获取详情失败');
    }
  } finally {
    detailLoading.value = false;
  }
}

async function handleStatusChange() {
  if (!currentId.value || !statusForm.status) {
    ElMessage.warning('请选择目标状态');
    return;
  }
  const res: any = await changeFeedbackStatus(currentId.value, {
    remark: statusForm.remark,
    status: statusForm.status,
  });
  if (res.success) {
    ElMessage.success('状态已更新');
    await loadDetail(currentId.value);
    await fetchData();
  } else {
    ElMessage.error(res.message || '状态更新失败');
  }
}

async function handleReply() {
  if (!currentId.value || !replyForm.content.trim()) {
    ElMessage.warning('请输入回复内容');
    return;
  }
  const res: any = await replyFeedback(currentId.value, {
    content: replyForm.content,
    expectedDeliveryDate: replyForm.expectedDeliveryDate || undefined,
  });
  if (res.success) {
    ElMessage.success('回复成功');
    await loadDetail(currentId.value);
    await fetchData();
  } else {
    ElMessage.error(res.message || '回复失败');
  }
}

async function handleFileChange(event: Event) {
  if (!currentId.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const res: any = await uploadFeedbackAttachment(currentId.value, file);
  input.value = '';
  if (res.success) {
    ElMessage.success('附件已上传');
    await loadDetail(currentId.value);
  } else {
    ElMessage.error(res.message || '上传失败');
  }
}

async function handleDeleteAttachment(id: number) {
  if (!currentId.value) return;
  await ElMessageBox.confirm('确定删除该附件吗？', '提示', { type: 'warning' });
  const res: any = await deleteFeedbackAttachment(id);
  if (res.success) {
    ElMessage.success('附件已删除');
    await loadDetail(currentId.value);
  } else {
    ElMessage.error(res.message || '删除失败');
  }
}

function openAttachment(path?: string) {
  if (!path) return;
  window.open(`/api/uploads/${path}`, '_blank');
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">改进建议</h1>
      <el-button :icon="'Plus'" type="primary" @click="openDialog()">提交建议</el-button>
    </div>

    <el-card class="mb-4" shadow="never">
      <el-form :inline="true" :model="query">
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" clearable placeholder="标题/描述/提交人" style="width: 200px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="query.priority" clearable placeholder="全部" style="width: 120px">
            <el-option v-for="item in priorityOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button :icon="'Search'" type="primary" @click="handleQuery">查询</el-button>
          <el-button :icon="'RefreshRight'" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="tableData" border row-key="id" stripe>
        <el-table-column label="标题" min-width="220" prop="title" show-overflow-tooltip />
        <el-table-column label="菜单路径" min-width="180" prop="menuPath" show-overflow-tooltip>
          <template #default="{ row }">{{ row.menuPath || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="priorityTag(row.priority)" size="small">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交人" min-width="120" prop="submitterName" show-overflow-tooltip />
        <el-table-column label="处理人" min-width="120" prop="handlerName" show-overflow-tooltip>
          <template #default="{ row }">{{ row.handlerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="预计交期" width="120">
          <template #default="{ row }">{{ row.expectedDeliveryDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">查看</el-button>
            <el-button link type="primary" :icon="'Edit'" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchData"
          @size-change="() => { query.page = 1; fetchData(); }"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :close-on-click-modal="false" :title="isEdit ? '编辑建议' : '提交建议'" width="620px">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="formData.title" maxlength="200" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="菜单路径" prop="menuPath">
          <el-select
            v-model="formData.menuPath"
            filterable
            placeholder="请选择发生问题或建议对应的菜单"
            style="width: 100%"
          >
            <el-option
              v-for="item in menuOptions"
              :key="item.value"
              :label="`${item.label} (${item.value})`"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="formData.priority" style="width: 100%">
            <el-option v-for="item in priorityOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" :rows="6" placeholder="请描述问题、建议或期望效果" type="textarea" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formData.remark" :rows="2" type="textarea" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="附件" required>
          <div class="initial-attachments">
            <el-button :icon="'Upload'" @click="createFileInputRef?.click()">选择附件</el-button>
            <span class="muted">必须至少上传一张截图、录屏或相关文件</span>
            <input ref="createFileInputRef" class="hidden-file" multiple type="file" @change="handleInitialFileChange" />
            <div v-if="initialFiles.length > 0" class="initial-file-list">
              <el-tag
                v-for="(file, index) in initialFiles"
                :key="`${file.name}-${file.size}-${index}`"
                closable
                type="info"
                @close="removeInitialFile(index)"
              >
                {{ file.name }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :icon="'Check'" :loading="saving" type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" size="720px" title="建议详情">
      <div v-loading="detailLoading" v-if="detail" class="detail-panel">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题" :span="2">{{ detail.feedback.title }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detail.feedback.status)">{{ statusLabel(detail.feedback.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="priorityTag(detail.feedback.priority)">{{ priorityLabel(detail.feedback.priority) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交人">{{ detail.feedback.submitterName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="预计交期">{{ detail.feedback.expectedDeliveryDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="菜单路径" :span="2">{{ detail.feedback.menuPath || '-' }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ detail.feedback.description || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-card class="mt-4" shadow="never">
          <template #header>状态流转</template>
          <el-form :inline="true" :model="statusForm">
            <el-form-item label="目标状态">
              <el-select v-model="statusForm.status" placeholder="请选择" style="width: 150px">
                <el-option
                  v-for="status in nextStatuses(detail.feedback.status)"
                  :key="status"
                  :label="statusLabel(status)"
                  :value="status"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="statusForm.remark" placeholder="可选" style="width: 240px" />
            </el-form-item>
            <el-form-item>
              <el-button :disabled="!statusForm.status" type="primary" @click="handleStatusChange">更新状态</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="mt-4" shadow="never">
          <template #header>回复</template>
          <el-form :model="replyForm" label-width="90px">
            <el-form-item label="预计交期">
              <el-date-picker v-model="replyForm.expectedDeliveryDate" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="回复内容">
              <el-input v-model="replyForm.content" :rows="3" type="textarea" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleReply">提交回复</el-button>
            </el-form-item>
          </el-form>
          <el-timeline>
            <el-timeline-item v-for="reply in detail.replies" :key="reply.id" :timestamp="formatTime(reply.createTime)">
              <b>{{ reply.replierName || '系统' }}</b>
              <div>{{ reply.replyContent }}</div>
              <div v-if="reply.expectedDeliveryDate" class="muted">预计交期：{{ reply.expectedDeliveryDate }}</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card class="mt-4" shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span>附件</span>
              <el-button :icon="'Upload'" size="small" @click="fileInputRef?.click()">上传附件</el-button>
            </div>
          </template>
          <input ref="fileInputRef" class="hidden-file" type="file" @change="handleFileChange" />
          <el-table :data="detail.attachments" border size="small">
            <el-table-column label="文件名" min-width="220" prop="fileName" show-overflow-tooltip />
            <el-table-column label="上传人" width="120" prop="createdByName" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary" @click="openAttachment(row.filePath)">打开</el-button>
                <el-button link type="danger" @click="handleDeleteAttachment(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="mt-4" shadow="never">
          <template #header>流转记录</template>
          <el-timeline>
            <el-timeline-item v-for="log in detail.statusLogs" :key="log.id" :timestamp="formatTime(log.createTime)">
              {{ statusLabel(log.fromStatus) }} -> {{ statusLabel(log.toStatus) }}
              <span class="muted"> {{ log.operatorName || '系统' }}</span>
              <div v-if="log.remark">{{ log.remark }}</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

.detail-panel {
  padding-right: 8px;
}

.hidden-file {
  display: none;
}

.initial-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.initial-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.muted {
  color: #909399;
}
</style>
