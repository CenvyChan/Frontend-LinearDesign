<script lang="ts" setup>
import type {
  ErpOperatorItem,
  ErpOperatorMappingItem,
} from '#/api/erpOperatorMapping';
import type { ErpOrganization } from '#/api/erpData';
import type { UserItem } from '#/api/user';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';

import {
  getErpOperatorMappings,
  saveErpOperatorMapping,
  searchErpOperators,
} from '#/api/erpOperatorMapping';
import { getOrganizations, getErpAccounts, getWarehousesByOrgId, getWorkshopsByOrgNumber } from '#/api/erpData';
import { getUserList } from '#/api/user';
import {
  getEmployeeParticipationRecords,
  exportMesResponsibilityIntegrityReport,
  getMesResponsibilities,
  getMesResourceResponsibilityOwners,
  getMesResponsibilityIntegrityReport,
  getMesUserResponsibilities,
  saveMesResponsibility,
  saveMesResourceResponsibilityOwner,
  importFromErpWarehouse,
  type MesResponsibility,
  type MesResourceResponsibilityOwner,
  type MesUserResponsibility,
} from '#/api/mesResponsibility';

import MesResponsibilityWorkbench from './components/MesResponsibilityWorkbench.vue';
import V2DiagnosticsShell from '../production/components/V2DiagnosticsShell.vue';
import { paginateV2Rows } from '../production/components/v2-workbench-model';
import {
  buildErpOperatorMappingV2Model,
  formatErpMappingUserName,
  pickResourceOwnerPayload,
  pickResponsibilityPayload,
  resolveResponsibilityView,
} from './erp-operator-mapping-v2-model';
import {
  formatErpOrganizationLabel,
  resolveDefaultErpOrgId,
  resolveErpOrganizationLabel,
} from './erp-operator-mapping-model';

defineOptions({ name: 'ErpOperatorMappingV2' });

const loading = ref(false);
const usersLoading = ref(false);
const operatorLoading = ref(false);
const organizationsLoading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const rows = ref<ErpOperatorMappingItem[]>([]);
const allMappings = ref<ErpOperatorMappingItem[]>([]);
const users = ref<UserItem[]>([]);
const operators = ref<ErpOperatorItem[]>([]);
const organizations = ref<ErpOrganization[]>([]);
const responsibilities = ref<MesResponsibility[]>([]);
const userResponsibilities = ref<MesUserResponsibility[]>([]);
const resourceOwners = ref<MesResourceResponsibilityOwner[]>([]);
const integrityIssues = ref<any[]>([]);
const participationRecords = ref<any[]>([]);
const participationPage = ref(1);
const participationPageSize = ref(20);
const route = useRoute();
const activeView = ref<string>(resolveResponsibilityView(route.path));
const legacyCompatibilityView = computed(() => activeView.value === 'ERP_BINDING');
const configDialogVisible = ref(false);
const configSaving = ref(false);
const configForm = reactive<Record<string, any>>({});
const defaultErpOrgId = ref('');
const accounts = ref<any[]>([]);
const warehouseCandidates = ref<any[]>([]);
const workshopCandidates = ref<any[]>([]);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const importFailedRows = ref<any[]>([]);
const importForm = reactive<{ erpAcctCode: string; erpOrgId: string }>({
  erpAcctCode: '',
  erpOrgId: '',
});
const filteredUserResponsibilities = ref<MesUserResponsibility[]>([]);
const filteredOrganizations = ref<ErpOrganization[]>([]);

const searchForm = reactive({
  erpOrgId: '',
  mappingRole: '',
});

const formData = reactive<Partial<ErpOperatorMappingItem>>({
  erpFormId: 'BD_OPERATOR',
  erpOperatorType: 'WHY',
  mappingRole: 'STOCKER',
});

const operatorSearch = reactive({
  erpOrgId: '',
  keyword: '',
});

const participationSearch = reactive({
  businessNo: '',
  businessType: '',
  erpAcctCode: '',
  erpOrgId: '',
  eventStatus: '',
  fromTime: null as Date | null,
  responsibilityCode: '',
  resourceCode: '',
  resourceType: '',
  toTime: null as Date | null,
  userId: undefined as number | undefined,
});

const model = computed(() => buildErpOperatorMappingV2Model(rows.value, users.value.length));
const metrics = computed(() => {
  if (!legacyCompatibilityView.value) {
    const enabledCount = userResponsibilities.value.filter((item) => item.status === 1).length;
    return [
      { label: '职责范围', value: userResponsibilities.value.length },
      { label: '已启用', tone: 'success', value: enabledCount },
      { label: '已停用', tone: 'warning', value: userResponsibilities.value.length - enabledCount },
      { label: '组织范围', tone: 'stable', value: userResponsibilities.value.filter((item) => item.scopeType === 'ORGANIZATION').length },
      { label: '资源范围', value: userResponsibilities.value.filter((item) => item.scopeType !== 'ORGANIZATION').length },
    ];
  }
  return [
    { label: '映射数', value: model.value.summary.mappingCount },
    { label: '已映射用户', tone: 'success', value: model.value.summary.mappedUserCount },
    { label: '未映射用户', tone: 'warning', value: model.value.summary.unmappedUserCount },
    { label: '组织限定', tone: 'stable', value: model.value.summary.scopedOrgCount },
    { label: '通用组织', tone: 'warning', value: model.value.summary.genericOrgCount },
  ];
});
const chains = computed(() => {
  if (!legacyCompatibilityView.value) {
    return userResponsibilities.value.slice(0, 8).map((row) => ({
      key: row.id || `${row.userId}-${row.responsibilityCode}-${row.scopeType}-${row.scopeKey || ''}`,
      primary: `${formatErpMappingUserName({ userId: row.userId }, users.value)} / ${row.responsibilityCode}`,
      secondary: [row.erpAcctCode, formatOrganization(row.erpOrgId), `${row.scopeType}:${row.scopeKey || '组织'}`].join(' / '),
      status: row.status === 1 ? '已启用' : '已停用',
      tone: row.status === 1 ? 'success' : 'warning',
    }));
  }
  return rows.value.slice(0, 8).map((row) => ({
    key: row.id || `${row.userId}-${row.erpOperatorNumber}`,
    primary: formatErpMappingUserName(row, users.value),
    secondary: [formatOrganization(row.erpOrgId), row.erpOperatorNumber, row.erpOperatorName].filter(Boolean).join(' / '),
    status: row.erpOperatorEntryId ? 'Entry 已绑定' : '缺 EntryId',
    tone: row.erpOperatorEntryId ? 'success' : 'danger',
  }));
});
const pagedRows = computed(() => paginateV2Rows(rows.value, currentPage.value, pageSize.value));
const pagedParticipationRecords = computed(() => paginateV2Rows(
  participationRecords.value,
  participationPage.value,
  participationPageSize.value,
));
const filteredImportOrganizations = computed(() => {
  if (!importForm.erpAcctCode) return [];
  return organizations.value.filter((org) => org.erpAcctCode === importForm.erpAcctCode);
});

function formatUserName(
  row: Pick<ErpOperatorMappingItem, 'realName' | 'userId' | 'username'>,
) {
  return formatErpMappingUserName(row, users.value);
}

function formatUserOption(user: UserItem) {
  return [user.username, user.real_name || user.nickname].filter(Boolean).join(' / ');
}

function responsibilityLabel(item: MesResponsibility) {
  return `${item.responsibilityCode} / ${item.responsibilityName}`;
}

async function loadResponsibilities() {
  try {
    const res: any = await getMesResponsibilities();
    if (!res.success) throw new Error(res.message || '获取职责目录失败');
    responsibilities.value = (res.data || []).filter((item: MesResponsibility) => item.status === 1);
  } catch (error: any) {
    ElMessage.error(error?.message || '获取职责目录失败');
  }
}

async function loadResponsibilityViews() {
  try {
    const [assignments, owners, integrity, participation, mappings] = await Promise.all([
      getMesUserResponsibilities(),
      getMesResourceResponsibilityOwners(),
      getMesResponsibilityIntegrityReport(),
      getEmployeeParticipationRecords({}),
      getErpOperatorMappings(),
    ]);
    userResponsibilities.value = assignments.success ? assignments.data || [] : [];
    resourceOwners.value = owners.success ? owners.data || [] : [];
    integrityIssues.value = integrity.success ? integrity.data || [] : [];
    participationRecords.value = participation.success ? participation.data || [] : [];
    allMappings.value = mappings.success ? mappings.data || [] : [];
  } catch (error: any) {
    ElMessage.error(error?.message || '获取职责配置数据失败');
  }
}

async function loadParticipationRecords() {
  try {
    const response: any = await getEmployeeParticipationRecords({
      ...participationSearch,
      fromTime: participationSearch.fromTime?.getTime(),
      toTime: participationSearch.toTime?.getTime(),
    });
    if (!response.success) throw new Error(response.message || '获取员工参与记录失败');
    participationRecords.value = response.data || [];
    participationPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取员工参与记录失败');
  }
}

function resetParticipationSearch() {
  Object.assign(participationSearch, {
    businessNo: '', businessType: '', erpAcctCode: '', erpOrgId: '', eventStatus: '', fromTime: null,
    responsibilityCode: '', resourceCode: '', resourceType: '', toTime: null, userId: undefined,
  });
  void loadParticipationRecords();
}

function exportParticipationRecords() {
  const headers = ['业务单号', '业务类型', '参与槽位', 'MES 用户', '职责', 'ERP 账套', 'ERP 组织', '资源类型', '资源编码', 'ERP 人员编码', '推送状态', '发生时间'];
  const rows = participationRecords.value.map((row) => [
    row.businessNo, row.businessType, row.slotCode, row.userName, row.responsibilityCode, row.erpAcctCode,
    formatOrganization(row.erpOrgId), row.resourceType, row.resourceCode, row.erpOperatorNumber, row.eventStatus,
    formatTime(row.occurredTime),
  ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));
  const blob = new Blob([`\uFEFF${headers.join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `员工参与记录_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openConfigDialog(row?: any) {
  if (!['RESPONSIBILITY', 'RESOURCE_OWNER'].includes(activeView.value)) return;
  Object.keys(configForm).forEach((key) => delete configForm[key]);
  Object.assign(configForm, row || {
    status: 1,
    scopeType: 'ORGANIZATION',
    resourceType: 'WAREHOUSE',
  });

  // 资源负责人表单：预加载数据
  if (activeView.value === 'RESOURCE_OWNER') {
    if (configForm.erpAcctCode) {
      void onConfigAccountChange(configForm.erpAcctCode);
    }
    if (configForm.responsibilityCode) {
      filterUserResponsibilities();
    }
  }

  configDialogVisible.value = true;
}

function openBindingFromTree(payload: {
  node: { erpOrgId?: string; responsibilityCode?: string };
  userId: number;
}) {
  const existing = allMappings.value.find(
    (row) =>
      row.userId === payload.userId &&
      (row.erpOrgId || '') === (payload.node.erpOrgId || '') &&
      (row.responsibilityCode || row.mappingRole || '') === (payload.node.responsibilityCode || ''),
  );
  openDialog(
    existing || ({
      erpOperatorNumber: '',
      erpOrgId: payload.node.erpOrgId || '',
      responsibilityCode: payload.node.responsibilityCode || '',
      userId: payload.userId,
    } as ErpOperatorMappingItem),
  );
}

async function saveConfig() {
  configSaving.value = true;
  try {
    let res: any;
    if (activeView.value === 'RESPONSIBILITY') res = await saveMesResponsibility(pickResponsibilityPayload(configForm));
    if (activeView.value === 'RESOURCE_OWNER') res = await saveMesResourceResponsibilityOwner(pickResourceOwnerPayload(configForm));
    if (!res?.success) throw new Error(res?.message || '保存职责配置失败');
    ElMessage.success('保存成功');
    configDialogVisible.value = false;
    await Promise.all([loadResponsibilities(), loadResponsibilityViews()]);
  } catch (error: any) {
    ElMessage.error(error?.message || '保存职责配置失败');
  } finally {
    configSaving.value = false;
  }
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatOrganization(erpOrgId?: string) {
  if (!erpOrgId) return '通用';
  return resolveErpOrganizationLabel(organizations.value, erpOrgId);
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
    if (!res.success) throw new Error(res.message || '获取 ERP 组织失败');
    organizations.value = res.data || [];
    defaultErpOrgId.value = resolveDefaultErpOrgId(
      res.defaultOrg,
      organizations.value,
      localStorage.getItem('mes_current_org_id'),
    );
    if (!searchForm.erpOrgId) searchForm.erpOrgId = defaultErpOrgId.value;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取 ERP 组织失败');
  } finally {
    organizationsLoading.value = false;
  }
}

async function loadAccounts() {
  try {
    const res = await getErpAccounts();
    if (res.success) {
      accounts.value = res.data || [];
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取 ERP 账套失败');
  }
}

async function onConfigAccountChange(acctCode: string) {
  configForm.erpOrgId = '';
  configForm.resourceCode = '';
  filteredOrganizations.value = [];
  warehouseCandidates.value = [];
  workshopCandidates.value = [];
  filteredUserResponsibilities.value = [];

  if (!acctCode) return;

  try {
    const res = await getOrganizations(acctCode);
    if (res.success) {
      filteredOrganizations.value = res.data || [];
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '获取组织列表失败');
  }
}

async function onConfigOrgChange() {
  configForm.resourceCode = '';
  warehouseCandidates.value = [];
  workshopCandidates.value = [];
  filterUserResponsibilities();

  if (!configForm.erpOrgId || !configForm.resourceType) return;

  await loadResourceCandidates();
}

async function onConfigResourceTypeChange() {
  configForm.resourceCode = '';
  warehouseCandidates.value = [];
  workshopCandidates.value = [];
  filterUserResponsibilities();

  if (!configForm.erpOrgId || !configForm.resourceType) return;

  await loadResourceCandidates();
}

async function loadResourceCandidates() {
  if (!configForm.erpAcctCode || !configForm.erpOrgId || !configForm.resourceType) return;

  try {
    if (configForm.resourceType === 'WAREHOUSE') {
      const warehouses = await getWarehousesByOrgId(configForm.erpOrgId, configForm.erpAcctCode);
      warehouseCandidates.value = (warehouses || []).map((warehouse) => ({
        value: warehouse.warehouseNumber,
        label: `${warehouse.warehouseNumber} / ${warehouse.warehouseName}`,
      }));
      return;
    }
    if (configForm.resourceType === 'WORKSHOP') {
      const orgMatch = filteredOrganizations.value.find((o) => o.erpOrgId === configForm.erpOrgId);
      if (orgMatch?.erpOrgNumber) {
        const workshops = await getWorkshopsByOrgNumber(orgMatch.erpOrgNumber, configForm.erpAcctCode);
        workshopCandidates.value = (workshops || []).map((w: any) => ({
          value: w.workshopNumber,
          label: `${w.workshopNumber} / ${w.workshopName}`,
        }));
      }
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载资源候选失败');
  }
}

function onConfigResourceCodeChange() {
  filterUserResponsibilities();
}

function onConfigResponsibilityChange() {
  filterUserResponsibilities();
}

function filterUserResponsibilities() {
  if (!configForm.erpAcctCode || !configForm.erpOrgId || !configForm.responsibilityCode) {
    filteredUserResponsibilities.value = [];
    return;
  }

  filteredUserResponsibilities.value = userResponsibilities.value.filter((item) => {
    if (item.erpAcctCode !== configForm.erpAcctCode) return false;
    if (item.erpOrgId !== configForm.erpOrgId) return false;
    if (item.responsibilityCode !== configForm.responsibilityCode) return false;

    if (configForm.resourceType && configForm.resourceCode) {
      if (item.scopeType === 'ORGANIZATION') return true;
      if (item.scopeType === configForm.resourceType && item.scopeKey === configForm.resourceCode) return true;
      return false;
    }

    return true;
  });
}

async function loadMappings() {
  loading.value = true;
  try {
    const res: any = await getErpOperatorMappings({
      erpOrgId: searchForm.erpOrgId || undefined,
      mappingRole: searchForm.mappingRole,
    });
    if (!res.success) throw new Error(res.message || '获取 ERP 人员映射失败');
    rows.value = res.data || [];
    currentPage.value = 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '获取 ERP 人员映射失败');
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: ErpOperatorMappingItem) {
  Object.assign(formData, {
    erpFormId: row?.erpFormId || 'BD_OPERATOR',
    erpOperatorEntryId: row?.erpOperatorEntryId,
    erpOperatorId: row?.erpOperatorId,
    erpOperatorName: row?.erpOperatorName || '',
    erpOperatorNumber: row?.erpOperatorNumber || '',
    erpOperatorType: row?.erpOperatorType || 'WHY',
    erpOrgId: row?.erpOrgId || searchForm.erpOrgId || '',
    id: row?.id,
    mappingRole: row?.mappingRole || 'STOCKER',
    responsibilityCode: row?.responsibilityCode || row?.mappingRole || 'STOCKER',
    userId: row?.userId,
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
      erpOrgId: operatorSearch.erpOrgId || undefined,
      keyword: operatorSearch.keyword || undefined,
      mappingRole: formData.responsibilityCode || formData.mappingRole || 'STOCKER',
      limit: 200,
    });
    if (!res.success) throw new Error(res.message || '搜索 ERP 人员失败');
    operators.value = res.data || [];
  } catch (error: any) {
    ElMessage.error(error?.message || '搜索 ERP 人员失败');
  } finally {
    operatorLoading.value = false;
  }
}

function chooseOperator(row: ErpOperatorItem) {
  formData.erpOperatorEntryId = row.entryId;
  formData.erpOperatorId = row.operatorId;
  formData.erpOperatorName = row.name;
  formData.erpOperatorNumber = row.number;
  formData.erpOperatorType = row.operatorType || formData.erpOperatorType || 'WHY';
  if (!formData.erpOrgId && row.bizOrgId) {
    formData.erpOrgId = row.bizOrgId;
    operatorSearch.erpOrgId = row.bizOrgId;
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

async function handleSave() {
  if (!formData.userId) {
    ElMessage.warning('请选择 MES 用户');
    return;
  }
  if (!formData.erpOrgId) {
    ElMessage.warning('请选择 ERP 组织');
    return;
  }
  if (!formData.responsibilityCode) {
    ElMessage.warning('请选择职责');
    return;
  }
  if (!formData.erpOperatorNumber) {
    ElMessage.warning('请选择 ERP 人员');
    return;
  }
  saving.value = true;
  try {
    const res: any = await saveErpOperatorMapping(formData);
    if (!res.success) throw new Error(res.message || '保存映射失败');
    ElMessage.success(res.message || '保存成功');
    dialogVisible.value = false;
    await loadMappings();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存映射失败');
  } finally {
    saving.value = false;
  }
}

const IMPORT_STAGE_TEXT: Record<string, string> = {
  FPRINCIPAL_EMPTY: 'ERP 仓库未维护负责人',
  WAREHOUSE_WORKER_NOT_FOUND: '负责人无仓管员任岗',
  ERP_MAPPING_NOT_FOUND: '缺 ERP 人员绑定',
  USER_RESPONSIBILITY_NOT_FOUND: '缺用户职责范围',
};

function importStageText(stage?: string) {
  return (stage && IMPORT_STAGE_TEXT[stage]) || stage || '-';
}

function openImportDialog() {
  importForm.erpAcctCode = '';
  importForm.erpOrgId = '';
  importFailedRows.value = [];
  importDialogVisible.value = true;
}

function onImportAccountChange() {
  importForm.erpOrgId = '';
  importFailedRows.value = [];
}

async function handleImport() {
  if (!importForm.erpAcctCode) {
    ElMessage.warning('请选择 ERP 账套');
    return;
  }
  if (!importForm.erpOrgId) {
    ElMessage.warning('请选择 ERP 组织');
    return;
  }

  importLoading.value = true;
  try {
    const result: any = await importFromErpWarehouse({
      erpAcctCode: importForm.erpAcctCode,
      erpOrgId: importForm.erpOrgId,
    });

    if (!result?.success) {
      throw new Error(result?.message || '导入失败');
    }

    const succeeded = result.data?.succeeded ?? [];
    const failed = result.data?.failed ?? [];
    importFailedRows.value = failed;

    if (succeeded.length === 0 && failed.length === 0) {
      ElMessage.warning('该组织下没有已维护负责人的仓库，请先在 ERP 中维护仓库负责人');
    } else if (failed.length === 0) {
      ElMessage.success(`导入完成：成功 ${succeeded.length} 条`);
      importDialogVisible.value = false;
    } else {
      ElMessage.warning(`导入完成：成功 ${succeeded.length} 条，失败 ${failed.length} 条，详见下方清单`);
    }

    await loadResponsibilityViews();
  } catch (error: any) {
    ElMessage.error(error?.message || '导入失败');
  } finally {
    importLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadOrganizations(), loadAccounts(), loadResponsibilities(), loadResponsibilityViews()]);
  await loadMappings();
});
</script>

<template>
  <V2DiagnosticsShell
    chain-title="MES 用户职责与数据范围"
    description="维护 MES 用户在账套、组织和业务范围内的职责，不依赖 ERP 登录用户。"
    eyebrow="系统 · 职责范围"
    :issue-title="legacyCompatibilityView ? '映射风险优先区' : '职责范围状态'"
    :chains="chains"
    :issues="legacyCompatibilityView ? model.issueGroups : []"
    :metrics="metrics"
    :stages="legacyCompatibilityView ? model.stages : []"
    title="MES 职责与数据范围"
  >
    <template #actions>
      <el-button size="small" :loading="loading" @click="legacyCompatibilityView ? loadMappings() : loadResponsibilityViews()" :icon="'Refresh'">刷新</el-button>
      <el-button v-if="activeView === 'ERP_BINDING'" size="small" type="primary" @click="openDialog()" :icon="'Plus'">新增映射</el-button>
      <el-button v-else-if="['RESPONSIBILITY', 'RESOURCE_OWNER'].includes(activeView)" size="small" type="primary" @click="openConfigDialog()" :icon="'Plus'">新增配置</el-button>
      <el-button v-else-if="activeView === 'INTEGRITY'" size="small" type="primary" @click="exportMesResponsibilityIntegrityReport" :icon="'Download'">导出整改报告</el-button>
      <el-button v-else-if="activeView === 'PARTICIPATION'" size="small" type="primary" @click="exportParticipationRecords" :icon="'Download'">导出记录</el-button>
    </template>

    <template #toolbar>
      <section class="v2-panel toolbar-row">
        <el-tabs v-model="activeView" class="responsibility-tabs">
          <el-tab-pane label="用户职责与数据范围" name="USER_RESPONSIBILITY" />
          <el-tab-pane label="职责目录" name="RESPONSIBILITY" />
          <el-tab-pane label="资源负责人" name="RESOURCE_OWNER" />
          <el-tab-pane label="ERP 人员绑定" name="ERP_BINDING" />
          <el-tab-pane label="配置完整性" name="INTEGRITY" />
          <el-tab-pane label="员工参与记录" name="PARTICIPATION" />
        </el-tabs>
        <template v-if="activeView === 'ERP_BINDING'">
        <el-select v-model="searchForm.mappingRole" clearable placeholder="角色" style="width: 140px">
          <el-option v-for="item in responsibilities" :key="item.responsibilityCode" :label="responsibilityLabel(item)" :value="item.responsibilityCode" />
        </el-select>
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
        <el-button type="primary" @click="loadMappings" :icon="'Refresh'">查询</el-button>
        </template>
        <template v-else-if="activeView === 'PARTICIPATION'">
          <el-select v-model="participationSearch.userId" clearable filterable placeholder="MES 用户" style="width: 160px">
            <el-option v-for="user in users" :key="user.id" :label="formatUserOption(user)" :value="user.id" />
          </el-select>
          <el-select v-model="participationSearch.responsibilityCode" clearable placeholder="职责" style="width: 150px">
            <el-option v-for="item in responsibilities" :key="item.responsibilityCode" :label="responsibilityLabel(item)" :value="item.responsibilityCode" />
          </el-select>
          <el-select v-model="participationSearch.erpOrgId" clearable filterable placeholder="ERP 组织" style="width: 200px">
            <el-option v-for="organization in organizations" :key="organization.erpOrgId" :label="formatErpOrganizationLabel(organization)" :value="organization.erpOrgId" />
          </el-select>
          <el-input v-model="participationSearch.businessNo" clearable placeholder="业务单号" style="width: 150px" />
          <el-select v-model="participationSearch.eventStatus" clearable placeholder="推送状态" style="width: 120px">
            <el-option label="成功" value="SUCCESS" /><el-option label="失败" value="FAILED" /><el-option label="待处理" value="PENDING" />
          </el-select>
          <el-date-picker v-model="participationSearch.fromTime" type="datetime" value-format="" placeholder="开始时间" style="width: 180px" />
          <el-date-picker v-model="participationSearch.toTime" type="datetime" value-format="" placeholder="结束时间" style="width: 180px" />
          <el-button type="primary" @click="loadParticipationRecords" :icon="'Search'">查询</el-button>
          <el-button @click="resetParticipationSearch" :icon="'RefreshLeft'">重置</el-button>
        </template>
      </section>
    </template>

    <section v-if="activeView === 'ERP_BINDING'" class="v2-panel v2-table-panel">
      <el-table :data="pagedRows" v-loading="loading" border height="520" row-key="id" size="small" stripe>
        <el-table-column label="MES 用户" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatUserName(row) }}</template>
        </el-table-column>
        <el-table-column prop="mappingRoleText" label="角色" width="110" />
        <el-table-column label="ERP 组织" width="180">
          <template #default="{ row }">{{ formatOrganization(row.erpOrgId) }}</template>
        </el-table-column>
        <el-table-column prop="erpFormId" label="ERP 来源" width="120" />
        <el-table-column prop="erpOperatorNumber" label="ERP 编码" width="150" />
        <el-table-column prop="erpOperatorName" label="ERP 人员" min-width="150" show-overflow-tooltip />
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)" :icon="'Edit'">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="rows.length"
          background
          layout="total, sizes, prev, pager, next, jumper"
          size="small"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <section v-else-if="activeView === 'RESPONSIBILITY'" class="v2-panel v2-table-panel">
      <el-table :data="responsibilities" border size="small" stripe>
        <el-table-column prop="responsibilityCode" label="职责编码" width="170" />
        <el-table-column prop="responsibilityName" label="职责名称" min-width="180" />
        <el-table-column prop="sourceType" label="来源" width="120" />
        <el-table-column label="状态" width="100"><template #default="{ row }">{{ row.status === 1 ? '启用' : '停用' }}</template></el-table-column>
        <el-table-column prop="sort" label="排序" width="90" />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openConfigDialog(row)">编辑</el-button></template></el-table-column>
      </el-table>
    </section>

    <section v-else-if="activeView === 'USER_RESPONSIBILITY'" class="v2-panel v2-table-panel">
      <MesResponsibilityWorkbench
        :assignments="userResponsibilities"
        :erp-bindings="allMappings"
        :responsibilities="responsibilities"
        :users="users"
        @maintain-erp-binding="openBindingFromTree"
        @saved="loadResponsibilityViews"
      />
    </section>

    <section v-else-if="activeView === 'RESOURCE_OWNER'" class="v2-panel v2-table-panel">
      <div style="margin-bottom: 16px; display: flex; gap: 8px;">
        <el-button type="primary" @click="openConfigDialog(null)">新增</el-button>
        <el-button type="success" @click="openImportDialog" :loading="importLoading">从ERP仓库负责人导入</el-button>
      </div>
      <el-table :data="resourceOwners" border size="small" stripe>
        <el-table-column prop="erpAcctCode" label="账套" width="120" />
        <el-table-column label="ERP 组织" width="200"><template #default="{ row }">{{ formatOrganization(row.erpOrgId) }}</template></el-table-column>
        <el-table-column prop="resourceType" label="资源类型" width="130" />
        <el-table-column prop="resourceCode" label="资源编码" width="160" />
        <el-table-column prop="responsibilityCode" label="职责" width="150" />
        <el-table-column prop="userResponsibilityId" label="用户职责" width="130" />
        <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openConfigDialog(row)">编辑</el-button></template></el-table-column>
      </el-table>
    </section>

    <section v-else-if="activeView === 'INTEGRITY'" class="v2-panel v2-table-panel">
      <el-table :data="integrityIssues" border size="small" stripe>
        <el-table-column prop="severity" label="级别" width="110" />
        <el-table-column prop="category" label="整改类别" width="180" />
        <el-table-column prop="recordId" label="记录ID" width="120" />
        <el-table-column prop="message" label="整改说明" min-width="340" show-overflow-tooltip />
      </el-table>
    </section>

    <section v-else class="v2-panel v2-table-panel">
      <el-table :data="pagedParticipationRecords" border size="small" stripe>
        <el-table-column prop="businessNo" label="业务单号" width="170" />
        <el-table-column prop="businessType" label="业务类型" width="160" />
        <el-table-column prop="slotCode" label="参与槽位" width="140" />
        <el-table-column prop="userName" label="MES 用户" width="150" />
        <el-table-column prop="responsibilityCode" label="职责" width="130" />
        <el-table-column label="ERP 组织" width="200"><template #default="{ row }">{{ formatOrganization(row.erpOrgId) }}</template></el-table-column>
        <el-table-column prop="resourceCode" label="资源" width="140" />
        <el-table-column prop="erpOperatorNumber" label="ERP 人员编码" width="160" />
        <el-table-column prop="eventStatus" label="推送状态" width="120" />
        <el-table-column label="发生时间" width="180"><template #default="{ row }">{{ formatTime(row.occurredTime) }}</template></el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination v-model:current-page="participationPage" v-model:page-size="participationPageSize"
          :page-sizes="[20, 50, 100]" :total="participationRecords.length" background layout="total, sizes, prev, pager, next" />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" title="维护 ERP 人员映射" width="860px">
      <el-form :model="formData" label-width="110px">
        <el-form-item label="MES 用户" required>
          <el-select v-model="formData.userId" filterable :loading="usersLoading" style="width: 100%">
            <el-option v-for="user in users" :key="user.id" :label="formatUserOption(user)" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="映射角色" required>
          <el-select v-model="formData.responsibilityCode" style="width: 100%">
            <el-option v-for="item in responsibilities" :key="item.responsibilityCode" :label="responsibilityLabel(item)" :value="item.responsibilityCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP 组织" required>
          <el-select
            v-model="formData.erpOrgId"
            clearable
            filterable
            :loading="organizationsLoading"
            placeholder="请选择 ERP 组织"
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
        <el-form-item label="ERP 人员">
          <el-input v-model="formData.erpOperatorNumber" readonly placeholder="从搜索结果选择 ERP 人员">
            <template #append>{{ formData.erpOperatorName || '-' }}</template>
          </el-input>
        </el-form-item>
      </el-form>
      <div class="operator-search">
        <el-input v-model="operatorSearch.keyword" clearable placeholder="ERP 编码/姓名/员工编码" />
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
        <el-button type="primary" :loading="operatorLoading" @click="handleSearchOperators" :icon="'Search'">搜索 ERP 人员</el-button>
      </div>
      <el-table :data="operators" v-loading="operatorLoading" border height="260" size="small">
        <el-table-column prop="number" label="编码" width="150" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="employeeNumber" label="员工编码" width="130" />
        <el-table-column label="业务组织" width="180">
          <template #default="{ row }">{{ formatOrganization(row.bizOrgId) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="chooseOperator(row)" :icon="'Check'">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="configDialogVisible" :title="activeView === 'RESPONSIBILITY' ? '维护职责' : '维护资源负责人'" width="680px">
      <el-form :model="configForm" label-width="110px">
        <template v-if="activeView === 'RESPONSIBILITY'">
          <el-form-item label="职责编码" required><el-input v-model="configForm.responsibilityCode" :disabled="configForm.sourceType === 'SYSTEM'" /></el-form-item>
          <el-form-item label="职责名称" required><el-input v-model="configForm.responsibilityName" /></el-form-item>
          <el-form-item label="状态"><el-switch v-model="configForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="configForm.sort" :min="0" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="configForm.remark" type="textarea" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="ERP 账套" required>
            <el-select v-model="configForm.erpAcctCode" filterable style="width:100%" @change="onConfigAccountChange">
              <el-option v-for="item in accounts" :key="item.acctCode" :label="item.acctCode" :value="item.acctCode" />
            </el-select>
          </el-form-item>
          <el-form-item label="ERP 组织" required>
            <el-select v-model="configForm.erpOrgId" filterable style="width:100%" @change="onConfigOrgChange">
              <el-option v-for="item in filteredOrganizations" :key="item.erpOrgId" :label="formatErpOrganizationLabel(item)" :value="item.erpOrgId" />
            </el-select>
          </el-form-item>
          <el-form-item label="资源类型">
            <el-select v-model="configForm.resourceType" style="width:100%" @change="onConfigResourceTypeChange">
              <el-option label="仓库" value="WAREHOUSE" />
              <el-option label="车间" value="WORKSHOP" />
            </el-select>
          </el-form-item>
          <el-form-item label="资源编码" required>
            <el-select v-model="configForm.resourceCode" filterable style="width:100%" @change="onConfigResourceCodeChange">
              <el-option
                v-for="item in (configForm.resourceType === 'WAREHOUSE' ? warehouseCandidates : workshopCandidates)"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="职责" required>
            <el-select v-model="configForm.responsibilityCode" style="width:100%" @change="onConfigResponsibilityChange">
              <el-option v-for="item in responsibilities" :key="item.responsibilityCode" :label="responsibilityLabel(item)" :value="item.responsibilityCode" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户职责" required>
            <el-select v-model="configForm.userResponsibilityId" filterable style="width:100%">
              <el-option
                v-for="item in filteredUserResponsibilities"
                :key="item.id"
                :label="`${formatUserName({ userId: item.userId })} / ${item.responsibilityCode} / ${item.scopeType}:${item.scopeKey || '组织'}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="configDialogVisible = false">取消</el-button><el-button type="primary" :loading="configSaving" @click="saveConfig">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="从ERP仓库负责人导入" width="500px">
      <el-form label-width="100px">
        <el-form-item label="ERP 账套" required>
          <el-select v-model="importForm.erpAcctCode" filterable style="width:100%" @change="onImportAccountChange">
            <el-option v-for="item in accounts" :key="item.acctCode" :label="item.acctCode" :value="item.acctCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="ERP 组织" required>
          <el-select v-model="importForm.erpOrgId" filterable style="width:100%">
            <el-option v-for="item in filteredImportOrganizations" :key="item.erpOrgId" :label="formatErpOrganizationLabel(item)" :value="item.erpOrgId" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" style="margin-top: 12px;">
          <p>读取 ERP 仓库负责人（BD_STOCK.FPrincipal），按仓管员任岗与 ERP 人员绑定解析出 MES 用户，自动创建 STOCKER 资源负责人配置。</p>
          <p style="margin-top: 8px;">四个前提缺一不可，缺哪一环会在失败清单中标出：</p>
          <ul style="margin: 4px 0 0 20px; padding: 0;">
            <li>ERP 仓库已维护负责人（BD_STOCK.FPrincipal）</li>
            <li>该负责人在本组织有启用的仓管员任岗（BD_WAREHOUSEWORKERS）</li>
            <li>该仓管员已绑定 MES 用户（ERP 人员绑定 tab）</li>
            <li>该 MES 用户有 STOCKER 职责范围（覆盖该仓或整组织）</li>
          </ul>
        </el-alert>
      </el-form>

      <section v-if="importFailedRows.length" style="margin-top: 12px;">
        <el-table :data="importFailedRows" border height="240" size="small" stripe>
          <el-table-column prop="warehouseNumber" label="仓库" width="120" />
          <el-table-column prop="warehouseName" label="仓库名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="缺失环节" width="150">
            <template #default="{ row }">
              <el-tag disable-transitions size="small" type="warning">{{ importStageText(row.stage) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="说明" min-width="260" show-overflow-tooltip />
        </el-table>
      </section>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importLoading" @click="handleImport">开始导入</el-button>
      </template>
    </el-dialog>
  </V2DiagnosticsShell>
</template>

<style scoped>
.toolbar-row,
.operator-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.operator-search {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  margin: 12px 0;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}
</style>
