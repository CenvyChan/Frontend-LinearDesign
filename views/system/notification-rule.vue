<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  batchEnableRules,
  batchUpsertRules,
  createNotificationRule,
  deleteNotificationRule,
  getAllRules,
  getNotificationLevels,
  getRecipientOptions,
  getRulesByFilter,
  getTriggerTypes,
  toggleRuleEnabled,
  type NotificationRecipientOption,
  type NotificationRuleItem,
  updateNotificationRule,
} from '#/api/notification';
import {
  buildRecipientKeys,
  buildRecipientTransferData,
  parseRecipientIds,
  splitRecipientKeys,
  type RecipientTransferKey,
} from './notification-rule-model';

defineOptions({ name: 'NotificationRule' });

type RecipientMode = 'ALL' | 'ASSIGNED';
type RecipientType = 'ALL' | 'ROLE' | 'USER' | 'USER,ROLE';

const triggerLabels: Record<string, string> = {
  EQUIPMENT_MISSING: '设备缺失',
  FQC_TASK_CREATED: 'FQC产品检验任务创建',
  GAUGE_CALIBRATION: '量具校准',
  IQC_TASK_CREATED: 'IQC来料检验任务创建',
  LQC_TASK_CREATED: 'LQC产线巡检任务创建',
  MOULD_MAINTENANCE: '模具保养',
  OQC_TASK_CREATED: 'OQC发货检验任务创建',
  ORDER_EXCEPTION: '工单异常',
  PQC_TASK_CREATED: 'PQC制程检验任务创建',
  PROCESS_INSPECTION_TASK: '检验任务创建',
  QUALITY_ALERT: '质量预警',
  REPORT_SUBMITTED: '生产汇报',
  TOOLING_MISSING: '工装缺失',
};

const levelTagMap: Record<string, string> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  INFO: 'info',
  LOW: 'info',
  MEDIUM: 'warning',
  WARNING: 'warning',
};

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const currentId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const tableData = ref<NotificationRuleItem[]>([]);
const selectedRows = ref<NotificationRuleItem[]>([]);
const triggerTypes = ref<string[]>([]);
const notificationLevels = ref<string[]>([]);
const userOptions = ref<NotificationRecipientOption[]>([]);
const roleOptions = ref<NotificationRecipientOption[]>([]);

const filterForm = reactive({
  keyword: '',
  notificationLevel: '',
  triggerType: '',
});

const formData = reactive({
  dingtalkEnabled: true,
  dingtalkMsgType: 'text',
  isEnabled: true,
  messageTemplate: '',
  messageTitle: '',
  notificationLevel: 'INFO',
  recipientIds: '',
  recipientMode: 'ASSIGNED' as RecipientMode,
  recipientType: 'USER' as RecipientType,
  remark: '',
  roleIds: [] as number[],
  ruleName: '',
  triggerType: 'ORDER_EXCEPTION',
  userIds: [] as number[],
});

const rules: FormRules = {
  messageTemplate: [{ required: true, message: '请输入消息模板', trigger: 'blur' }],
  messageTitle: [{ required: true, message: '请输入消息标题', trigger: 'blur' }],
  notificationLevel: [{ required: true, message: '请选择通知级别', trigger: 'change' }],
  recipientMode: [{ required: true, message: '请选择通知范围', trigger: 'change' }],
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  triggerType: [{ required: true, message: '请选择触发类型', trigger: 'change' }],
};

const selectedIds = computed(() => selectedRows.value.map((row) => row.id).filter(Boolean) as number[]);
const recipientTransferData = computed(() => buildRecipientTransferData(userOptions.value, roleOptions.value));
const recipientKeys = computed<RecipientTransferKey[]>({
  get: () => buildRecipientKeys(formData.userIds, formData.roleIds),
  set: (keys) => {
    const recipient = splitRecipientKeys(keys);
    formData.userIds = recipient.userIds;
    formData.roleIds = recipient.roleIds;
  },
});

function unwrapList(res: any) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function labelTrigger(value?: string) {
  return value ? triggerLabels[value] || value : '-';
}

function tagType(level?: string) {
  return level ? levelTagMap[level] || 'info' : 'info';
}

function recipientTypeLabel(type?: string) {
  if (type === 'ALL') return '全员';
  const labels: string[] = [];
  if (type?.includes('USER')) labels.push('用户');
  if (type?.includes('ROLE')) labels.push('角色');
  return labels.length > 0 ? labels.join(' + ') : '-';
}

function parseRecipient(row: NotificationRuleItem) {
  formData.userIds = [];
  formData.roleIds = [];
  const type = row.recipientType || 'USER';
  if (type === 'ALL') {
    formData.recipientMode = 'ALL';
    formData.recipientType = 'ALL';
    return;
  }
  formData.recipientMode = 'ASSIGNED';
  formData.recipientType = normalizeRecipientType(type);
  // 解析逻辑在 model 层，便于单测覆盖「旧格式 ROLE」这条路径
  const recipient = parseRecipientIds(row.recipientIds, type);
  formData.userIds = recipient.userIds;
  formData.roleIds = recipient.roleIds;
}

function buildRecipientPayload() {
  if (formData.recipientMode === 'ALL') {
    return { recipientIds: '', recipientType: 'ALL' };
  }
  const hasUsers = formData.userIds.length > 0;
  const hasRoles = formData.roleIds.length > 0;
  let recipientType: RecipientType = 'USER';
  if (hasUsers && hasRoles) {
    recipientType = 'USER,ROLE';
  } else if (hasRoles) {
    recipientType = 'ROLE';
  }
  return {
    recipientIds: JSON.stringify({
      r: formData.roleIds.join(','),
      u: formData.userIds.join(','),
    }),
    recipientType,
  };
}

function normalizeRecipientType(type: string): RecipientType {
  const hasUser = type.includes('USER');
  const hasRole = type.includes('ROLE');
  if (hasUser && hasRole) return 'USER,ROLE';
  if (hasRole) return 'ROLE';
  return 'USER';
}

function resetForm() {
  Object.assign(formData, {
    dingtalkEnabled: true,
    dingtalkMsgType: 'text',
    isEnabled: true,
    messageTemplate: '',
    messageTitle: '',
    notificationLevel: 'INFO',
    recipientIds: '',
    recipientMode: 'ASSIGNED',
    recipientType: 'USER',
    remark: '',
    roleIds: [],
    ruleName: '',
    triggerType: triggerTypes.value[0] || 'ORDER_EXCEPTION',
    userIds: [],
  });
}

async function loadOptions() {
  const [triggerRes, levelRes, recipientRes]: any[] = await Promise.all([
    getTriggerTypes(),
    getNotificationLevels(),
    getRecipientOptions(),
  ]);
  triggerTypes.value = unwrapList(triggerRes);
  notificationLevels.value = unwrapList(levelRes);
  userOptions.value = recipientRes?.data?.users || [];
  roleOptions.value = recipientRes?.data?.roles || [];
}

async function fetchData() {
  loading.value = true;
  try {
    const hasFilter = filterForm.keyword || filterForm.triggerType || filterForm.notificationLevel;
    const res: any = hasFilter
      ? await getRulesByFilter({
          keyword: filterForm.keyword || undefined,
          notificationLevel: filterForm.notificationLevel || undefined,
          triggerType: filterForm.triggerType || undefined,
        })
      : await getAllRules();
    if (res.success) {
      tableData.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取通知规则失败');
    }
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  filterForm.keyword = '';
  filterForm.notificationLevel = '';
  filterForm.triggerType = '';
  fetchData();
}

function openDialog(row?: NotificationRuleItem) {
  resetForm();
  if (row) {
    isEdit.value = true;
    currentId.value = row.id || null;
    Object.assign(formData, {
      dingtalkEnabled: row.dingtalkEnabled ?? false,
      dingtalkMsgType: row.dingtalkMsgType || 'text',
      isEnabled: row.isEnabled ?? true,
      messageTemplate: row.messageTemplate || '',
      messageTitle: row.messageTitle || '',
      notificationLevel: row.notificationLevel || 'INFO',
      remark: row.remark || '',
      ruleName: row.ruleName || '',
      triggerType: row.triggerType || 'ORDER_EXCEPTION',
    });
    parseRecipient(row);
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
    if (formData.recipientMode === 'ASSIGNED' && formData.userIds.length === 0 && formData.roleIds.length === 0) {
      ElMessage.warning('请选择通知用户或角色');
      return;
    }
    saving.value = true;
    try {
      const recipient = buildRecipientPayload();
      const payload: NotificationRuleItem = {
        dingtalkEnabled: formData.dingtalkEnabled,
        dingtalkMsgType: formData.dingtalkMsgType,
        isEnabled: formData.isEnabled,
        messageTemplate: formData.messageTemplate,
        messageTitle: formData.messageTitle,
        notificationLevel: formData.notificationLevel,
        recipientIds: recipient.recipientIds,
        recipientType: recipient.recipientType,
        remark: formData.remark,
        ruleName: formData.ruleName,
        triggerType: formData.triggerType,
      };
      const res: any = isEdit.value && currentId.value
        ? await updateNotificationRule({ ...payload, id: currentId.value })
        : await createNotificationRule(payload);
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

async function handleDelete(row: NotificationRuleItem) {
  if (!row.id) return;
  try {
    await ElMessageBox.confirm(`确定删除规则「${row.ruleName}」吗？`, '提示', { type: 'warning' });
    const res: any = await deleteNotificationRule(row.id);
    if (res.success) {
      ElMessage.success('删除成功');
      await fetchData();
    } else {
      ElMessage.error(res.message || '删除失败');
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '删除失败');
    }
  }
}

async function handleToggle(row: NotificationRuleItem) {
  if (!row.id) return;
  try {
    const res: any = await toggleRuleEnabled(row.id);
    if (res.success) {
      ElMessage.success('状态已更新');
      await fetchData();
    } else {
      ElMessage.error(res.message || '状态更新失败');
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '状态更新失败');
  }
}

async function handleBatchEnable(enabled: boolean) {
  if (selectedIds.value.length === 0) return;
  const action = enabled ? '启用' : '禁用';
  try {
    await ElMessageBox.confirm(`确定批量${action}选中的 ${selectedIds.value.length} 条规则吗？`, '提示', { type: 'warning' });
    const res: any = await batchEnableRules(selectedIds.value, enabled);
    if (res.success) {
      ElMessage.success(`批量${action}成功`);
      await fetchData();
    } else {
      ElMessage.error(res.message || '批量操作失败');
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '批量操作失败');
    }
  }
}

async function handleBatchSave() {
  if (selectedRows.value.length === 0) return;
  const res: any = await batchUpsertRules(selectedRows.value);
  if (res.success) {
    ElMessage.success('批量保存成功');
    await fetchData();
  } else {
    ElMessage.error(res.message || '批量保存失败');
  }
}

onMounted(async () => {
  await loadOptions();
  await fetchData();
});
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">通知规则</h1>
      <div class="flex gap-2">
        <el-button :disabled="selectedIds.length === 0" :icon="'Check'" type="success" @click="handleBatchEnable(true)">
          批量启用
        </el-button>
        <el-button :disabled="selectedIds.length === 0" :icon="'Close'" type="warning" @click="handleBatchEnable(false)">
          批量禁用
        </el-button>
        <el-button :disabled="selectedIds.length === 0" :icon="'DocumentChecked'" @click="handleBatchSave">
          批量保存
        </el-button>
        <el-button :icon="'Plus'" type="primary" @click="openDialog()">新建规则</el-button>
      </div>
    </div>

    <el-card class="mb-4" shadow="never">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="规则名称">
          <el-input v-model="filterForm.keyword" clearable placeholder="规则名称" style="width: 180px" />
        </el-form-item>
        <el-form-item label="触发类型">
          <el-select v-model="filterForm.triggerType" clearable placeholder="全部" style="width: 160px">
            <el-option v-for="item in triggerTypes" :key="item" :label="labelTrigger(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="通知级别">
          <el-select v-model="filterForm.notificationLevel" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in notificationLevels" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button :icon="'Search'" type="primary" @click="fetchData">查询</el-button>
          <el-button :icon="'RefreshRight'" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        row-key="id"
        stripe
        @selection-change="(rows: NotificationRuleItem[]) => { selectedRows = rows; }"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column label="规则名称" min-width="160" prop="ruleName" show-overflow-tooltip />
        <el-table-column label="触发类型" min-width="130">
          <template #default="{ row }">{{ labelTrigger(row.triggerType) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="tagType(row.notificationLevel)" size="small">{{ row.notificationLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="通知对象" width="120">
          <template #default="{ row }">{{ recipientTypeLabel(row.recipientType) }}</template>
        </el-table-column>
        <el-table-column label="钉钉" width="80">
          <template #default="{ row }">
            <el-tag :type="row.dingtalkEnabled ? 'success' : 'info'" size="small">
              {{ row.dingtalkEnabled ? '启用' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.isEnabled" size="small" @change="handleToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="140">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" :icon="'Edit'" @click="openDialog(row)">编辑</el-button>
              <el-button link type="danger" :icon="'Delete'" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :title="isEdit ? '编辑通知规则' : '新建通知规则'"
      width="820px"
    >
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="formData.ruleName" maxlength="100" placeholder="请输入规则名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="触发类型" prop="triggerType">
              <el-select v-model="formData.triggerType" style="width: 100%">
                <el-option v-for="item in triggerTypes" :key="item" :label="labelTrigger(item)" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="通知级别" prop="notificationLevel">
              <el-select v-model="formData.notificationLevel" style="width: 100%">
                <el-option v-for="item in notificationLevels" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="通知范围" prop="recipientMode">
              <el-radio-group v-model="formData.recipientMode">
                <el-radio-button value="ASSIGNED">指定对象</el-radio-button>
                <el-radio-button value="ALL">全员</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <template v-if="formData.recipientMode === 'ASSIGNED'">
          <el-form-item label="通知对象">
            <el-transfer
              v-model="recipientKeys"
              class="recipient-transfer"
              filterable
              :data="recipientTransferData"
              :titles="['可选对象', '已选对象']"
            />
          </el-form-item>
        </template>
        <el-form-item label="消息标题" prop="messageTitle">
          <el-input v-model="formData.messageTitle" placeholder="可使用 {orderNo}、{time} 等占位符" />
        </el-form-item>
        <el-form-item label="消息模板" prop="messageTemplate">
          <el-input v-model="formData.messageTemplate" :rows="5" type="textarea" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="钉钉通知">
              <el-switch v-model="formData.dingtalkEnabled" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="消息格式">
              <el-select v-model="formData.dingtalkMsgType" :disabled="!formData.dingtalkEnabled" style="width: 100%">
                <el-option label="文本" value="text" />
                <el-option label="Markdown" value="markdown" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="启用">
              <el-switch v-model="formData.isEnabled" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="formData.remark" :rows="2" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :icon="'Check'" :loading="saving" type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

:deep(.recipient-transfer.el-transfer) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr);
  column-gap: 8px;
  align-items: center;
  width: 100%;
}

:deep(.recipient-transfer .el-transfer-panel) {
  width: auto;
  min-width: 0;
}

:deep(.recipient-transfer .el-transfer__buttons) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px;
}

:deep(.recipient-transfer .el-transfer__button) {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
}

.table-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.table-actions :deep(.el-button) {
  margin-left: 0;
}
</style>
