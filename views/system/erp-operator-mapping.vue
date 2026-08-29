<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  exportErpOperatorMappings,
  getErpOperatorMappings,
  saveErpOperatorMapping,
  searchErpOperators,
  type ErpOperatorItem,
  type ErpOperatorMappingItem,
} from '#/api/erpOperatorMapping';
import { getOrganizations, type ErpOrganization } from '#/api/erpData';
import { getUserList, type UserItem } from '#/api/user';
import { downloadBlob } from '#/utils/download';

import {
  formatErpOrganizationLabel,
  resolveDefaultErpOrgId,
  resolveErpOrganizationLabel,
} from './erp-operator-mapping-model';

defineOptions({ name: 'ErpOperatorMapping' });

const loading = ref(false);
const saving = ref(false);
const usersLoading = ref(false);
const operatorLoading = ref(false);
const organizationsLoading = ref(false);
const tableData = ref<ErpOperatorMappingItem[]>([]);
const users = ref<UserItem[]>([]);
const operators = ref<ErpOperatorItem[]>([]);
const organizations = ref<ErpOrganization[]>([]);
const defaultErpOrgId = ref('');
const dialogVisible = ref(false);

const operatorTypeOptions = [
  { label: '销售员', value: 'XSY' },
  { label: '采购员', value: 'CGY' },
  { label: '仓管员', value: 'WHY' },
  { label: '计划员', value: 'JHY' },
  { label: '财务人员', value: 'CWRY' },
  { label: '质检员', value: 'ZJY' },
  { label: '服务人员', value: 'FWRY' },
  { label: '驾驶员', value: 'JSY' },
  { label: '程序员', value: 'CXY' },
];

const searchForm = reactive({
  erpOrgId: '',
  mappingRole: 'STOCKER',
});

const formData = reactive<Partial<ErpOperatorMappingItem>>({
  id: undefined,
  userId: undefined,
  erpOrgId: '',
  mappingRole: 'STOCKER',
  erpFormId: 'BD_OPERATOR',
  erpOperatorType: 'WHY',
  erpOperatorEntryId: undefined,
  erpOperatorId: undefined,
  erpOperatorNumber: '',
  erpOperatorName: '',
});

const operatorSearch = reactive({
  keyword: '',
  erpOrgId: '',
});

async function loadMappings() {
  loading.value = true;
  try {
    const res: any = await getErpOperatorMappings({
      erpOrgId: searchForm.erpOrgId || undefined,
      mappingRole: searchForm.mappingRole,
    });
    if (res.success) {
      tableData.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取ERP人员映射失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取ERP人员映射失败');
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    const res: any = await getUserList({ pageNum: 1, pageSize: 500, status: 1 });
    if (res.success) {
      users.value = Array.isArray(res.data) ? res.data : (res.data?.list || []);
    }
  } finally {
    usersLoading.value = false;
  }
}

async function loadOrganizations() {
  organizationsLoading.value = true;
  try {
    const res = await getOrganizations();
    if (!res.success) {
      ElMessage.error(res.message || '获取 ERP 组织失败');
      return;
    }
    organizations.value = res.data || [];
    defaultErpOrgId.value = resolveDefaultErpOrgId(
      res.defaultOrg,
      organizations.value,
      localStorage.getItem('mes_current_org_id'),
    );
    if (!searchForm.erpOrgId) {
      searchForm.erpOrgId = defaultErpOrgId.value;
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取 ERP 组织失败');
  } finally {
    organizationsLoading.value = false;
  }
}

function openDialog(row?: ErpOperatorMappingItem) {
  Object.assign(formData, {
    id: row?.id,
    userId: row?.userId,
    erpOrgId: row?.erpOrgId || searchForm.erpOrgId || '',
    mappingRole: row?.mappingRole || 'STOCKER',
    erpFormId: row?.erpFormId || 'BD_OPERATOR',
    erpOperatorType: row?.erpOperatorType || 'WHY',
    erpOperatorEntryId: row?.erpOperatorEntryId,
    erpOperatorId: row?.erpOperatorId,
    erpOperatorNumber: row?.erpOperatorNumber || '',
    erpOperatorName: row?.erpOperatorName || '',
  });
  operatorSearch.keyword = row?.erpOperatorName || row?.erpOperatorNumber || '';
  operatorSearch.erpOrgId = formData.erpOrgId || '';
  operators.value = [];
  dialogVisible.value = true;
}

async function handleSearchOperators() {
  operatorLoading.value = true;
  try {
    const res: any = await searchErpOperators({
      keyword: operatorSearch.keyword || undefined,
      erpOrgId: operatorSearch.erpOrgId || undefined,
      mappingRole: formData.mappingRole || 'STOCKER',
      limit: 200,
    });
    if (res.success) {
      operators.value = res.data || [];
    } else {
      ElMessage.error(res.message || '搜索ERP操作员失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '搜索ERP操作员失败');
  } finally {
    operatorLoading.value = false;
  }
}

function chooseOperator(row: ErpOperatorItem) {
  formData.erpOperatorId = row.operatorId;
  formData.erpOperatorEntryId = row.entryId;
  formData.erpOperatorNumber = row.number;
  formData.erpOperatorName = row.name;
  formData.erpOperatorType = row.operatorType || formData.erpOperatorType || 'WHY';
  if (!formData.erpOrgId && row.bizOrgId) {
    formData.erpOrgId = row.bizOrgId;
    operatorSearch.erpOrgId = row.bizOrgId;
  }
}

async function handleSave() {
  if (!formData.userId) {
    ElMessage.warning('请选择MES用户');
    return;
  }
  if (!formData.erpOperatorNumber) {
    ElMessage.warning('请选择ERP人员');
    return;
  }
  saving.value = true;
  try {
    const res: any = await saveErpOperatorMapping(formData);
    if (res.success) {
      ElMessage.success(res.message || '保存成功');
      dialogVisible.value = false;
      await loadMappings();
    } else {
      ElMessage.error(res.message || '保存失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleExport() {
  try {
    const blob = await exportErpOperatorMappings();
    downloadBlob(blob, 'ERP人员映射导出.xlsx');
  } catch (error: any) {
    ElMessage.error(error?.message || '导出失败');
  }
}

function formatUserName(row: ErpOperatorMappingItem) {
  return [row.username, row.realName].filter(Boolean).join(' / ') || row.userId;
}

function formatUserOption(user: UserItem) {
  return [user.username, user.real_name || user.nickname].filter(Boolean).join(' / ');
}

function formatTime(value?: number) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatOperatorType(code?: string, text?: string) {
  if (!code && !text) return '-';
  const normalizedCode = code?.toUpperCase();
  const typeText = text || operatorTypeOptions.find((item) => item.value === normalizedCode)?.label;
  return [code, typeText].filter(Boolean).join(' / ');
}

function formatOrganization(erpOrgId?: string) {
  return resolveErpOrganizationLabel(organizations.value, erpOrgId);
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadOrganizations()]);
  await loadMappings();
});
</script>

<template>
  <div class="erp-personnel-page">
    <div class="page-title">
      <div>
        <h1>ERP人员映射</h1>
        <p>用于维护MES用户与ERP单据业务人员的关系。当前首期强校验仓管员，ERP创建人/审核人仍由WebAPI登录账号与ERP流程决定。</p>
      </div>
      <div class="page-actions">
        <el-button @click="handleExport" :icon="'Download'">导出</el-button>
        <el-button type="primary" @click="openDialog()" :icon="'Plus'">新增映射</el-button>
      </div>
    </div>

    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="角色">
          <el-select v-model="searchForm.mappingRole" style="width: 140px">
            <el-option label="仓管员" value="STOCKER" />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP组织">
          <el-select
            v-model="searchForm.erpOrgId"
            clearable
            filterable
            :loading="organizationsLoading"
            placeholder="请选择 ERP 组织"
            style="width: 220px"
          >
            <el-option
              v-for="organization in organizations"
              :key="organization.erpOrgId"
              :label="formatErpOrganizationLabel(organization)"
              :value="organization.erpOrgId"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMappings" :icon="'Refresh'">查询</el-button>
          <el-button @click="searchForm.erpOrgId = defaultErpOrgId; loadMappings()" :icon="'RefreshRight'">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableData" v-loading="loading" border row-key="id" empty-text="暂无ERP人员映射">
        <el-table-column label="MES用户" min-width="180">
          <template #default="{ row }">{{ formatUserName(row) }}</template>
        </el-table-column>
        <el-table-column prop="mappingRoleText" label="映射角色" width="110" />
        <el-table-column label="ERP组织" width="180">
          <template #default="{ row }">{{ formatOrganization(row.erpOrgId) }}</template>
        </el-table-column>
        <el-table-column prop="erpFormId" label="ERP来源" width="130" />
        <el-table-column label="人员类型" width="140">
          <template #default="{ row }">{{ formatOperatorType(row.erpOperatorType, row.erpOperatorTypeText) }}</template>
        </el-table-column>
        <el-table-column prop="erpOperatorNumber" label="ERP人员编码" width="160" />
        <el-table-column prop="erpOperatorName" label="ERP人员名称" min-width="160" />
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openDialog(row)" :icon="'Edit'">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="维护ERP人员映射" width="860px">
      <el-alert
        title="本页面维护的是ERP单据业务人员字段，不会改变ERP WebAPI的创建人、提交人或审核人。"
        type="info"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <el-form :model="formData" label-width="110px">
        <el-form-item label="MES用户" required>
          <el-select v-model="formData.userId" filterable :loading="usersLoading" style="width: 100%">
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="formatUserOption(user)"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="映射角色" required>
          <el-select v-model="formData.mappingRole" style="width: 100%">
            <el-option label="仓管员" value="STOCKER" />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP组织">
          <el-select
            v-model="formData.erpOrgId"
            clearable
            filterable
            :loading="organizationsLoading"
            placeholder="为空时作为该角色的通用映射"
            style="width: 100%"
          >
            <el-option
              v-for="organization in organizations"
              :key="organization.erpOrgId"
              :label="formatErpOrganizationLabel(organization)"
              :value="organization.erpOrgId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP人员">
          <el-input v-model="formData.erpOperatorNumber" readonly placeholder="请从下方ERP搜索结果选择">
            <template #append>{{ formData.erpOperatorName || '-' }}</template>
          </el-input>
        </el-form-item>
        <el-form-item label="人员类型">
          <el-select v-model="formData.erpOperatorType" disabled style="width: 100%">
            <el-option
              v-for="item in operatorTypeOptions"
              :key="item.value"
              :label="`${item.value} / ${item.label}`"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="operator-search">
        <el-input v-model="operatorSearch.keyword" clearable placeholder="ERP编码/姓名/员工编号" />
        <el-select
          v-model="operatorSearch.erpOrgId"
          filterable
          :loading="organizationsLoading"
          placeholder="请选择 ERP 组织"
        >
          <el-option
            v-for="organization in organizations"
            :key="organization.erpOrgId"
            :label="formatErpOrganizationLabel(organization)"
            :value="organization.erpOrgId"
          />
        </el-select>
        <el-button type="primary" :loading="operatorLoading" @click="handleSearchOperators" :icon="'Search'">搜索ERP人员</el-button>
      </div>
      <el-table :data="operators" v-loading="operatorLoading" border height="260" empty-text="请搜索ERP人员">
        <el-table-column prop="number" label="编码" width="150" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column label="人员类型" width="140">
          <template #default="{ row }">{{ formatOperatorType(row.operatorType, row.operatorTypeText) }}</template>
        </el-table-column>
        <el-table-column prop="employeeNumber" label="员工编号" width="140" />
        <el-table-column label="业务组织" width="180">
          <template #default="{ row }">{{ formatOrganization(row.bizOrgId) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="chooseOperator(row)" :icon="'Check'">选择</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.erp-personnel-page {
  padding: 20px;
}

.page-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.page-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.page-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
}

.page-title p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

.operator-search {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 10px;
  margin: 12px 0;
}
</style>
