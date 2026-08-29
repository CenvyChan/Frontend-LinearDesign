<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  createUser,
  deleteUser,
  getUserList,
  resetPassword,
  type QueryParams,
  type UserItem,
  updateUser,
} from '#/api/user';
import { getRoleList } from '#/api/role';
import {
  getAvailableErpAcctsApi,
  getUserAcctBindingsApi,
  saveUserAcctBindingsApi,
  type ErpAcctOption,
} from '#/api/userAcct';

defineOptions({ name: 'SystemUser' });

type LoginType = 'ALL' | 'MOBILE' | 'WEB';

const loginTypeOptions: Array<{ label: string; value: LoginType }> = [
  { label: '全部端', value: 'ALL' },
  { label: '仅 Web', value: 'WEB' },
  { label: '仅移动端', value: 'MOBILE' },
];

const loading = ref(false);
const tableData = ref<UserItem[]>([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const currentId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const roleList = ref<Array<{ id: number; role_key: string; role_name: string }>>([]);

const searchForm = reactive({
  realName: '',
  status: undefined as number | undefined,
  username: '',
});

// ── 归属账套授权（sys_user_acct）────────────────────────────────────────────
// 单独一个弹窗而不是并入用户编辑表单：这是另一条写路径（另一个端点、另一张表），
// 混进用户表单会让「保存用户」这一个动作同时改两处，其中一处失败时状态不明。
const acctDialogVisible = ref(false);
const acctLoading = ref(false);
const acctSaving = ref(false);
const acctUser = ref<null | UserItem>(null);
const acctOptions = ref<ErpAcctOption[]>([]);
const selectedAccts = ref<string[]>([]);
const defaultAcct = ref<string>('');

async function openAcctDialog(row: UserItem) {
  acctUser.value = row;
  acctDialogVisible.value = true;
  acctLoading.value = true;
  selectedAccts.value = [];
  defaultAcct.value = '';
  try {
    // 候选与已授权分开请求：候选是租户配置，已授权是这个用户的数据
    const [options, bindings] = await Promise.all([
      getAvailableErpAcctsApi(),
      getUserAcctBindingsApi(row.id),
    ]);
    acctOptions.value = options;
    selectedAccts.value = bindings.map((item) => item.erpAcctCode);
    defaultAcct.value = bindings.find((item) => item.isDefault)?.erpAcctCode ?? '';
  } catch (error: any) {
    ElMessage.error(error?.message || '加载账套授权失败');
  } finally {
    acctLoading.value = false;
  }
}

// 取消勾选的账套若正是默认账套，默认必须一起清掉：
// 后端拒绝「默认不在已选之内」，留着只会在保存时才报错。
watch(selectedAccts, (next) => {
  if (defaultAcct.value && !next.includes(defaultAcct.value)) {
    defaultAcct.value = '';
  }
});

async function saveAcctBindings() {
  if (!acctUser.value) return;
  acctSaving.value = true;
  try {
    await saveUserAcctBindingsApi(
      acctUser.value.id,
      selectedAccts.value,
      defaultAcct.value || null,
    );
    ElMessage.success('账套授权已保存');
    acctDialogVisible.value = false;
  } catch (error: any) {
    // 保留弹窗：账套不在租户配置里、默认不在已选内都需要用户在原选择上修正
    ElMessage.error(error?.message || '保存账套授权失败');
  } finally {
    acctSaving.value = false;
  }
}

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
});

const formData = reactive({
  allowedLoginType: 'ALL' as LoginType,
  email: '',
  phone: '',
  realName: '',
  roleIds: [] as number[],
  status: 1,
  username: '',
});

const rules: FormRules = {
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
};

function formatTime(time?: number | string | null) {
  if (!time) return '-';
  const value = String(time);
  if (value.length === 14) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  }
  return value;
}

function getLoginType(row: UserItem): LoginType {
  return (row.allowedLoginType || row.allowed_login_type || 'ALL') as LoginType;
}

function loginTypeLabel(value?: string) {
  return loginTypeOptions.find((item) => item.value === value)?.label || '全部端';
}

function loginTypeTag(value?: string) {
  if (value === 'WEB') return 'warning';
  if (value === 'MOBILE') return 'success';
  return 'info';
}

function getRoleTagType(index: number) {
  return ['primary', 'success', 'warning', 'danger', 'info'][index % 5] || 'info';
}

async function fetchData() {
  loading.value = true;
  try {
    const params: QueryParams = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      realName: searchForm.realName || undefined,
      status: searchForm.status,
      username: searchForm.username || undefined,
    };
    const res: any = await getUserList(params);
    if (res.success) {
      const data = res.data;
      tableData.value = Array.isArray(data) ? data : data?.list || [];
      pagination.total = data?.total || tableData.value.length;
    } else {
      ElMessage.error(res.message || '获取用户列表失败');
    }
  } finally {
    loading.value = false;
  }
}

async function loadRoles() {
  try {
    const res: any = await getRoleList();
    if (res.success) {
      roleList.value = res.data || [];
    }
  } catch (e: any) {
    console.error('获取角色列表失败', e);
  }
}

function handleSearch() {
  pagination.pageNum = 1;
  fetchData();
}

function handleReset() {
  searchForm.username = '';
  searchForm.realName = '';
  searchForm.status = undefined;
  handleSearch();
}

function resetForm() {
  formData.username = '';
  formData.realName = '';
  formData.email = '';
  formData.phone = '';
  formData.status = 1;
  formData.roleIds = [];
  formData.allowedLoginType = 'ALL';
}

function openDialog(row?: UserItem) {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    Object.assign(formData, {
      allowedLoginType: getLoginType(row),
      email: row.email || '',
      phone: row.phone || '',
      realName: row.real_name || row.nickname || '',
      roleIds: row.roles?.map((role) => role.id) || [],
      status: row.status,
      username: row.username,
    });
  } else {
    isEdit.value = false;
    currentId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

async function handleSave() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    const payload = {
      allowedLoginType: formData.allowedLoginType,
      allowed_login_type: formData.allowedLoginType,
      email: formData.email,
      phone: formData.phone,
      realName: formData.realName,
      roleIds: formData.roleIds,
      status: formData.status,
      username: formData.username,
    };
    try {
      if (isEdit.value && currentId.value) {
        await updateUser(currentId.value, payload);
        ElMessage.success('更新成功');
      } else {
        await createUser({ ...payload, tenantId: 1 });
        ElMessage.success('创建成功');
      }
      dialogVisible.value = false;
      await fetchData();
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败');
    }
  });
}

async function handleDelete(row: UserItem) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？`, '提示', { type: 'warning' });
    await deleteUser(row.id);
    ElMessage.success('删除成功');
    await fetchData();
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '删除失败');
    }
  }
}

async function handleResetPassword(row: UserItem) {
  try {
    await ElMessageBox.confirm(`确定重置用户「${row.username}」的密码吗？`, '提示', { type: 'warning' });
    const res: any = await resetPassword(row.id);
    if (res.success) {
      ElMessage.success('密码已重置');
    } else {
      ElMessage.error(res.message || '重置失败');
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '重置失败');
    }
  }
}

onMounted(() => {
  fetchData();
  loadRoles();
});
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">用户管理</h1>
      <el-button type="primary" :icon="'Plus'" @click="openDialog()">新建用户</el-button>
    </div>

    <el-card class="mb-4" shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" clearable placeholder="请输入用户名" style="width: 160px" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="searchForm.realName" clearable placeholder="请输入姓名" style="width: 160px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable placeholder="全部" style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="handleSearch">查询</el-button>
          <el-button :icon="'RefreshRight'" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="tableData" border row-key="id" stripe>
        <el-table-column label="用户名" min-width="120" prop="username" show-overflow-tooltip />
        <el-table-column label="姓名" min-width="110" prop="real_name" show-overflow-tooltip />
        <el-table-column label="手机" min-width="130" prop="phone">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="邮箱" min-width="170" prop="email" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" min-width="190">
          <template #default="{ row }">
            <div class="role-tags">
              <el-tag
                v-for="(role, index) in row.roles || []"
                :key="role.id"
                class="role-tag"
                effect="light"
                size="small"
                :type="getRoleTagType(index)"
              >
                {{ role.role_name }}
              </el-tag>
              <span v-if="!row.roles || row.roles.length === 0" class="muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="允许登录端" width="120">
          <template #default="{ row }">
            <el-tag :type="loginTypeTag(getLoginType(row))" size="small">
              {{ loginTypeLabel(getLoginType(row)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="330">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button link type="primary" :icon="'Edit'" @click="openDialog(row)">编辑</el-button>
              <el-button link type="primary" @click="openAcctDialog(row)">归属账套</el-button>
              <el-button link type="warning" :icon="'RefreshRight'" @click="handleResetPassword(row)">重置密码</el-button>
              <el-button link type="danger" :icon="'Delete'" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchData"
          @size-change="() => { pagination.pageNum = 1; fetchData(); }"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :close-on-click-modal="false" :title="isEdit ? '编辑用户' : '新建用户'" width="560px">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" :disabled="isEdit" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="formData.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="formData.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="formData.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="formData.roleIds" multiple placeholder="请选择角色" style="width: 100%">
            <el-option v-for="role in roleList" :key="role.id" :label="role.role_name" :value="role.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="允许登录端">
          <el-radio-group v-model="formData.allowedLoginType">
            <el-radio-button v-for="item in loginTypeOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" :icon="'Check'" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="acctDialogVisible"
      :close-on-click-modal="false"
      :title="`归属账套授权 — ${acctUser?.real_name || acctUser?.username || ''}`"
      width="560px"
    >
      <div class="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
        <span class="text-xs text-gray-500 font-medium">请勾选该用户有权访问的 ERP 业务账套</span>
        <el-tooltip
          content="账套授权规则：表单需满足已发布、用户绑定归属账套、且持有访问授权三项条件才会出现在菜单中。"
          effect="dark"
          placement="top"
        >
          <span class="help-badge" tabindex="0">
            <el-icon><QuestionFilled /></el-icon>
            <span>Help</span>
          </span>
        </el-tooltip>
      </div>

      <div v-loading="acctLoading" class="acct-body">
        <p v-if="acctOptions.length === 0" class="acct-empty">
          本租户还没有启用的 ERP 账套配置，请先到「系统管理 → 集成配置」添加。
        </p>
        <template v-else>
          <el-checkbox-group v-model="selectedAccts">
            <el-checkbox
              v-for="option in acctOptions"
              :key="option.acctCode"
              :value="option.acctCode"
              :label="option.acctCode"
            >
              {{ option.displayName }}（{{ option.acctCode }}）
              <el-tag v-if="option.isDefault" size="small" type="info">租户默认</el-tag>
            </el-checkbox>
          </el-checkbox-group>

          <div class="acct-default">
            <span class="acct-default__label">默认账套</span>
            <el-select
              v-model="defaultAcct"
              clearable
              placeholder="不指定"
              style="width: 220px"
            >
              <el-option
                v-for="code in selectedAccts"
                :key="code"
                :label="code"
                :value="code"
              />
            </el-select>
            <span class="acct-hint">只能从已勾选的账套中选。</span>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="acctDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="acctOptions.length === 0"
          :loading="acctSaving"
          @click="saveAcctBindings"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.action-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
}

.acct-body {
  min-height: 90px;
  padding-top: 12px;
}

.acct-empty {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.acct-default {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 14px;
}

.acct-default__label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.acct-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.role-tag {
  margin: 0;
}

.muted {
  color: #909399;
}

.help-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  cursor: help;
}

.help-badge:hover {
  background: var(--el-color-primary-light-8);
}
</style>
