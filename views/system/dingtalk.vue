<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  adminBindDingTalk,
  adminUnbindDingTalk,
  batchBindDingTalk,
  batchUnbindDingTalk,
  bindByMobile,
  bindDingTalk,
  getCurrentUserBinding,
  getDingTalkBindingList,
  getDingTalkConfig,
  getDingTalkContactSyncTask,
  getDingTalkDepartmentTree,
  sendDingTalkNotice,
  sendDingTalkToAll,
  syncDingTalkContacts,
  testDingTalkConnection,
  unbindDingTalk,
  type DingTalkBindingItem,
  type DingTalkContactSyncTask,
  type DingTalkDepartmentNode,
} from '#/api/dingtalk';

defineOptions({ name: 'DingTalkConfig' });

const activeTab = ref('personal');
const loading = ref(false);
const bindingLoading = ref(false);
const adminLoading = ref(false);
const sending = ref(false);
const testing = ref(false);
const syncing = ref(false);
const treeLoading = ref(false);
const bindDialogVisible = ref(false);
const batchBindDialogVisible = ref(false);
const mobileFormRef = ref<FormInstance>();
const bindFormRef = ref<FormInstance>();
const selectedRows = ref<DingTalkBindingItem[]>([]);
const bindingList = ref<DingTalkBindingItem[]>([]);
const departmentTree = ref<DingTalkDepartmentNode[]>([]);
const currentBinding = ref<any>(null);
const syncTask = ref<DingTalkContactSyncTask | null>(null);
let syncPollTimer: number | undefined;

const config = reactive({
  agentId: '',
  corpId: '',
  enabled: false,
});

const mobileForm = reactive({ mobile: '' });
const manualForm = reactive({ dingtalkName: '', dingtalkUserid: '' });
const allMessageForm = reactive({ content: '', title: 'MES 通知' });
const bindForm = reactive({
  dingtalkName: '',
  dingtalkUserid: '',
  userId: null as null | number,
});
const batchBindText = ref('');
const autoCreate = ref(false);

const mobileRules: FormRules = {
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
};

const bindRules: FormRules = {
  dingtalkUserid: [{ required: true, message: '请输入钉钉 UserID', trigger: 'blur' }],
};

const boundCount = computed(() => bindingList.value.filter((item) => item.isBound === 1).length);
const selectedUserIds = computed(() => selectedRows.value.map((item) => item.userId));
const syncTaskStatusType = computed(() => {
  switch (syncTask.value?.status) {
    case 'SUCCESS':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'info';
  }
});

function formatTime(value?: null | number | string) {
  if (!value) return '-';
  if (typeof value === 'number') {
    return new Date(value).toLocaleString();
  }
  return value.replace('T', ' ').slice(0, 19);
}

async function fetchConfig() {
  loading.value = true;
  try {
    const res: any = await getDingTalkConfig();
    if (res.success) {
      config.enabled = !!(res.data?.enabled ?? res.enabled);
      config.corpId = res.data?.corpId ?? res.corpId ?? '';
      config.agentId = res.data?.agentId ?? res.agentId ?? '';
    }
  } finally {
    loading.value = false;
  }
}

async function fetchCurrentBinding() {
  bindingLoading.value = true;
  try {
    const res: any = await getCurrentUserBinding();
    currentBinding.value = res.success ? res : null;
  } finally {
    bindingLoading.value = false;
  }
}

async function fetchBindingList() {
  adminLoading.value = true;
  try {
    const res: any = await getDingTalkBindingList();
    if (res.success) {
      bindingList.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取绑定列表失败');
    }
  } finally {
    adminLoading.value = false;
  }
}

async function fetchDepartmentTree() {
  treeLoading.value = true;
  try {
    const res: any = await getDingTalkDepartmentTree();
    if (res.success) {
      departmentTree.value = res.data || res.departments || [];
    } else {
      ElMessage.error(res.message || '获取组织架构失败');
    }
  } finally {
    treeLoading.value = false;
  }
}

async function handleTestConnection() {
  testing.value = true;
  try {
    const res: any = await testDingTalkConnection();
    if (res.success) {
      ElMessage.success(res.message || '钉钉连接正常');
    } else {
      ElMessage.error(res.message || '连接失败');
    }
  } finally {
    testing.value = false;
  }
}

async function handleMobileBind(formRef?: FormInstance) {
  if (!formRef) return;
  await formRef.validate(async (valid) => {
    if (!valid) return;
    bindingLoading.value = true;
    try {
      const res: any = await bindByMobile(mobileForm.mobile);
      if (res.success) {
        ElMessage.success('绑定成功');
        await fetchCurrentBinding();
      } else {
        ElMessage.error(res.message || '绑定失败');
      }
    } finally {
      bindingLoading.value = false;
    }
  });
}

async function handleManualBind() {
  if (!manualForm.dingtalkUserid.trim()) {
    ElMessage.warning('请输入钉钉 UserID');
    return;
  }
  bindingLoading.value = true;
  try {
    const res: any = await bindDingTalk(manualForm);
    if (res.success) {
      ElMessage.success('绑定成功');
      await fetchCurrentBinding();
    } else {
      ElMessage.error(res.message || '绑定失败');
    }
  } finally {
    bindingLoading.value = false;
  }
}

async function handleUnbindCurrent() {
  await ElMessageBox.confirm('确定解除当前账号的钉钉绑定吗？', '提示', { type: 'warning' });
  const res: any = await unbindDingTalk();
  if (res.success) {
    ElMessage.success('解绑成功');
    await fetchCurrentBinding();
  } else {
    ElMessage.error(res.message || '解绑失败');
  }
}

function openBindDialog(row: DingTalkBindingItem) {
  bindForm.userId = row.userId;
  bindForm.dingtalkUserid = row.dingtalkUserid || '';
  bindForm.dingtalkName = row.dingtalkName || '';
  bindDialogVisible.value = true;
}

async function handleAdminBind() {
  if (!bindFormRef.value || !bindForm.userId) return;
  await bindFormRef.value.validate(async (valid) => {
    if (!valid) return;
    const res: any = await adminBindDingTalk({
      dingtalkName: bindForm.dingtalkName,
      dingtalkUserid: bindForm.dingtalkUserid,
      userId: bindForm.userId!,
    });
    if (res.success) {
      ElMessage.success('绑定成功');
      bindDialogVisible.value = false;
      await fetchBindingList();
    } else {
      ElMessage.error(res.message || '绑定失败');
    }
  });
}

async function handleAdminUnbind(row: DingTalkBindingItem) {
  await ElMessageBox.confirm(`确定解除「${row.realName || row.username}」的钉钉绑定吗？`, '提示', { type: 'warning' });
  const res: any = await adminUnbindDingTalk(row.userId);
  if (res.success) {
    ElMessage.success('解绑成功');
    await fetchBindingList();
  } else {
    ElMessage.error(res.message || '解绑失败');
  }
}

async function handleBatchUnbind() {
  if (selectedUserIds.value.length === 0) return;
  await ElMessageBox.confirm(`确定批量解绑 ${selectedUserIds.value.length} 个用户吗？`, '提示', { type: 'warning' });
  const res: any = await batchUnbindDingTalk(selectedUserIds.value);
  if (res.success) {
    ElMessage.success('批量解绑完成');
    await fetchBindingList();
  } else {
    ElMessage.error(res.message || '批量解绑失败');
  }
}

function parseBatchBindRows() {
  const items: Array<{ dingtalkName?: string; dingtalkUserid: string; userId: number }> = [];
  batchBindText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [userIdText, dingtalkUseridText, dingtalkName] = line.split(',').map((item) => item.trim());
      const userId = Number(userIdText);
      if (userId && dingtalkUseridText) {
        items.push({ dingtalkName, dingtalkUserid: dingtalkUseridText, userId });
      }
    });
  return items;
}

async function handleBatchBind() {
  const items = parseBatchBindRows();
  if (items.length === 0) {
    ElMessage.warning('请输入有效的批量绑定数据');
    return;
  }
  const res: any = await batchBindDingTalk(items);
  if (res.success) {
    ElMessage.success('批量绑定完成');
    batchBindDialogVisible.value = false;
    batchBindText.value = '';
    await fetchBindingList();
  } else {
    ElMessage.error(res.message || '批量绑定失败');
  }
}

async function handleSendAll() {
  if (!allMessageForm.content.trim()) {
    ElMessage.warning('请输入通知内容');
    return;
  }
  sending.value = true;
  try {
    const res: any = await sendDingTalkToAll({
      content: allMessageForm.content,
      msgType: 'text',
      title: allMessageForm.title,
    });
    if (res.success) {
      ElMessage.success('全员通知已发送');
    } else {
      ElMessage.error(res.message || '发送失败');
    }
  } finally {
    sending.value = false;
  }
}

async function handleSendToUser(row: DingTalkBindingItem) {
  const result = await ElMessageBox.prompt('请输入通知内容', `发送给 ${row.realName || row.username}`, {
    confirmButtonText: '发送',
    inputValue: '这是一条来自 MES 系统的通知',
  });
  const res: any = await sendDingTalkNotice({ content: result.value, userId: row.userId });
  if (res.success) {
    ElMessage.success('发送成功');
  } else {
    ElMessage.error(res.message || '发送失败');
  }
}

function clearSyncPoll() {
  if (syncPollTimer !== undefined) {
    window.clearTimeout(syncPollTimer);
    syncPollTimer = undefined;
  }
}

function taskFromResponse(response: any): DingTalkContactSyncTask | null {
  const value = response?.data?.taskId ? response.data : response?.taskId ? response : null;
  return value as DingTalkContactSyncTask | null;
}

function isTerminalSyncStatus(status?: string) {
  return status === 'SUCCESS' || status === 'PARTIAL' || status === 'FAILED';
}

async function pollSyncTask(taskId: number) {
  try {
    const response: any = await getDingTalkContactSyncTask(taskId);
    if (!response.success) {
      throw new Error(response.message || '查询通讯录同步任务失败');
    }
    const task = taskFromResponse(response);
    if (!task) {
      throw new Error('通讯录同步任务响应无效');
    }
    syncTask.value = task;
    if (!isTerminalSyncStatus(task.status)) {
      syncPollTimer = window.setTimeout(() => void pollSyncTask(taskId), 1500);
      return;
    }

    syncing.value = false;
    clearSyncPoll();
    if (task.status === 'SUCCESS') {
      ElMessage.success('通讯录同步完成');
    } else if (task.status === 'PARTIAL') {
      ElMessage.warning(task.lastError || '通讯录同步部分完成');
    } else {
      ElMessage.error(task.lastError || '通讯录同步失败');
    }
    await fetchBindingList();
  } catch (error) {
    clearSyncPoll();
    syncing.value = false;
    ElMessage.error(error instanceof Error ? error.message : '查询通讯录同步任务失败');
  }
}

async function handleSyncContacts() {
  if (syncing.value) return;
  clearSyncPoll();
  syncTask.value = null;
  syncing.value = true;
  try {
    const response: any = await syncDingTalkContacts(autoCreate.value);
    if (!response.success) {
      throw new Error(response.message || '提交通讯录同步任务失败');
    }
    const task = taskFromResponse(response);
    if (!task?.taskId) {
      throw new Error('通讯录同步任务响应无效');
    }
    syncTask.value = task;
    await pollSyncTask(task.taskId);
  } catch (error) {
    syncing.value = false;
    ElMessage.error(error instanceof Error ? error.message : '提交通讯录同步任务失败');
  }
}

function handleTabChange(name: string) {
  if (name === 'bindings' && bindingList.value.length === 0) fetchBindingList();
  if (name === 'departments' && departmentTree.value.length === 0) fetchDepartmentTree();
}

onMounted(() => {
  fetchConfig();
  fetchCurrentBinding();
});

onBeforeUnmount(() => {
  clearSyncPoll();
});
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">钉钉集成</h1>
      <el-button :icon="'PlugZap'" :loading="testing" type="primary" @click="handleTestConnection">测试连接</el-button>
    </div>

    <el-alert
      v-if="!config.enabled"
      class="mb-4"
      :closable="false"
      show-icon
      title="钉钉集成未启用"
      type="warning"
    />

    <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
      <el-tab-pane label="个人绑定" name="personal">
        <el-descriptions v-loading="bindingLoading" :column="2" border>
          <el-descriptions-item label="绑定状态">
            <el-tag :type="currentBinding?.binding ? 'success' : 'info'">
              {{ currentBinding?.binding ? '已绑定' : '未绑定' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="钉钉 UserID">{{ currentBinding?.dingtalkUserid || '-' }}</el-descriptions-item>
          <el-descriptions-item label="钉钉名称">{{ currentBinding?.dingtalkName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="绑定时间">{{ currentBinding?.bindTime || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentBinding?.binding" class="mt-4">
          <el-button :icon="'Unlink'" type="danger" @click="handleUnbindCurrent">解除绑定</el-button>
        </div>

        <el-row v-else class="mt-4" :gutter="20">
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>手机号绑定</template>
              <el-form ref="mobileFormRef" :model="mobileForm" :rules="mobileRules" label-width="90px">
                <el-form-item label="手机号" prop="mobile">
                  <el-input v-model="mobileForm.mobile" maxlength="11" placeholder="请输入钉钉手机号" />
                </el-form-item>
                <el-form-item>
                  <el-button
                    :icon="'Link'"
                    :loading="bindingLoading"
                    type="primary"
                    @click="handleMobileBind(mobileFormRef)"
                  >
                    绑定
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>手动绑定</template>
              <el-form :model="manualForm" label-width="110px">
                <el-form-item label="钉钉 UserID">
                  <el-input v-model="manualForm.dingtalkUserid" placeholder="请输入钉钉 UserID" />
                </el-form-item>
                <el-form-item label="钉钉名称">
                  <el-input v-model="manualForm.dingtalkName" placeholder="可选" />
                </el-form-item>
                <el-form-item>
                  <el-button :icon="'Link'" :loading="bindingLoading" type="primary" @click="handleManualBind">绑定</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="全员通知" name="allNotice">
        <el-form :model="allMessageForm" label-width="90px" class="notice-form">
          <el-form-item label="标题">
            <el-input v-model="allMessageForm.title" />
          </el-form-item>
          <el-form-item label="内容">
            <el-input v-model="allMessageForm.content" :rows="5" placeholder="请输入通知内容" type="textarea" />
          </el-form-item>
          <el-form-item>
            <el-button :icon="'Send'" :loading="sending" type="primary" @click="handleSendAll">发送全员通知</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="通讯录同步" name="sync">
        <div class="sync-actions">
          <el-switch v-model="autoCreate" active-text="自动创建未匹配用户" />
          <el-button :icon="'RefreshCw'" :loading="syncing" type="primary" @click="handleSyncContacts">同步通讯录</el-button>
        </div>
        <div v-if="syncTask" class="mt-4 rounded border border-gray-200 p-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-sm font-medium">任务 {{ syncTask.taskNo }}</span>
            <el-tag :type="syncTaskStatusType">{{ syncTask.status }}</el-tag>
          </div>
          <el-progress v-if="syncing" :indeterminate="true" :percentage="0" />
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-5">
            <span>部门 {{ syncTask.departmentCount }}</span>
            <span>扫描 {{ syncTask.scannedCount }}</span>
            <span>绑定 {{ syncTask.boundCount }}</span>
            <span>新建 {{ syncTask.createdCount }}</span>
            <span>失败 {{ syncTask.failedCount }}</span>
          </div>
          <el-alert
            v-if="syncTask.lastError"
            class="mt-3"
            :closable="false"
            :description="syncTask.lastError"
            show-icon
            :title="syncTask.status === 'FAILED' ? '同步失败' : '同步存在失败明细'"
            :type="syncTask.status === 'FAILED' ? 'error' : 'warning'"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="组织架构" name="departments">
        <el-tree
          v-loading="treeLoading"
          :data="departmentTree"
          default-expand-all
          node-key="deptId"
          :props="{ children: 'children', label: 'name' }"
        />
      </el-tab-pane>

      <el-tab-pane label="绑定管理" name="bindings">
        <div class="mb-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">已绑定 {{ boundCount }} / {{ bindingList.length }}</span>
          <div class="flex gap-2">
            <el-button :icon="'RefreshCw'" @click="fetchBindingList">刷新</el-button>
            <el-button :icon="'Rows3'" @click="batchBindDialogVisible = true">批量绑定</el-button>
            <el-button :disabled="selectedUserIds.length === 0" :icon="'Unlink'" type="danger" @click="handleBatchUnbind">
              批量解绑
            </el-button>
          </div>
        </div>
        <el-table
          v-loading="adminLoading"
          :data="bindingList"
          border
          row-key="userId"
          stripe
          @selection-change="(rows: DingTalkBindingItem[]) => { selectedRows = rows; }"
        >
          <el-table-column type="selection" width="44" />
          <el-table-column label="用户名" min-width="120" prop="username" show-overflow-tooltip />
          <el-table-column label="姓名" min-width="110" prop="realName" show-overflow-tooltip />
          <el-table-column label="手机号" min-width="120" prop="phone" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isBound === 1 ? 'success' : 'info'" size="small">
                {{ row.isBound === 1 ? '已绑定' : '未绑定' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="钉钉 UserID" min-width="160" prop="dingtalkUserid" show-overflow-tooltip />
          <el-table-column label="钉钉名称" min-width="120" prop="dingtalkName" show-overflow-tooltip />
          <el-table-column label="绑定时间" min-width="160">
            <template #default="{ row }">{{ formatTime(row.bindTime) }}</template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="210">
            <template #default="{ row }">
              <el-button link type="primary" :icon="'Edit'" @click="openBindDialog(row)">
                {{ row.isBound === 1 ? '修改' : '绑定' }}
              </el-button>
              <el-button v-if="row.isBound === 1" link type="success" :icon="'Send'" @click="handleSendToUser(row)">发送</el-button>
              <el-button v-if="row.isBound === 1" link type="danger" :icon="'Unlink'" @click="handleAdminUnbind(row)">解绑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="bindDialogVisible" :close-on-click-modal="false" title="钉钉绑定" width="460px">
      <el-form ref="bindFormRef" :model="bindForm" :rules="bindRules" label-width="110px">
        <el-form-item label="用户 ID">
          <el-input :model-value="bindForm.userId" disabled />
        </el-form-item>
        <el-form-item label="钉钉 UserID" prop="dingtalkUserid">
          <el-input v-model="bindForm.dingtalkUserid" />
        </el-form-item>
        <el-form-item label="钉钉名称">
          <el-input v-model="bindForm.dingtalkName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogVisible = false">取消</el-button>
        <el-button :icon="'Check'" type="primary" @click="handleAdminBind">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchBindDialogVisible" :close-on-click-modal="false" title="批量绑定" width="560px">
      <el-input
        v-model="batchBindText"
        :rows="8"
        placeholder="每行一条：用户ID,钉钉UserID,钉钉名称"
        type="textarea"
      />
      <template #footer>
        <el-button @click="batchBindDialogVisible = false">取消</el-button>
        <el-button :icon="'Check'" type="primary" @click="handleBatchBind">确认绑定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

.notice-form {
  max-width: 720px;
}

.sync-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style>
