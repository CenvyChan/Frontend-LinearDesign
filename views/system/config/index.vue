<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  getDefaultPassword,
  getFlowClaimModelingConfigs,
  getInventorySummaryBasis,
  getIntegrationConfig,
  getMaterialRequestPolicyConfig,
  refreshExistingStockSummary,
  updateInventorySummaryBasis,
  updateDefaultPassword,
  updateFlowClaimModelingConfig,
  updateIntegrationConfig,
  updateMaterialRequestPolicyConfig,
  type FlowClaimModelingConfig,
  type InventorySummaryBasisItem,
  type IntegrationConfig,
  type K3CloudAccountConfig,
  type MaterialRequestPolicyConfig,
} from '#/api/config';
import { getErpAccounts, getOrganizations, type ErpAcctOption, type ErpOrganization } from '#/api/erpData';

import {
  applyInventorySummaryBasisBatch,
  buildInventorySummaryBasisPayload,
  type InventorySummaryBasisBatchPatch,
} from './inventory-summary-basis-model';
import ErpUpstreamSync from './erp-upstream-sync.vue';

defineOptions({ name: 'SystemConfig' });

const activeTab = ref('integrations');
const loading = ref(false);
const integrationLoading = ref(false);
const materialRequestPolicyLoading = ref(false);
const materialRequestPolicySaving = ref(false);
const flowClaimModelingLoading = ref(false);
const flowClaimModelingUpdatingKey = ref('');
const flowClaimModelingConfigs = ref<FlowClaimModelingConfig[]>([]);
const defaultPasswordPlain = ref('');
const inventoryBasisLoading = ref(false);
const inventoryBasisSaving = ref(false);
const inventoryBasisRefreshing = ref(false);
const inventoryBasisAcctOptions = ref<ErpAcctOption[]>([]);
const inventoryBasisOrgOptions = ref<ErpOrganization[]>([]);
const inventoryBasisItems = ref<InventorySummaryBasisItem[]>([]);
const inventoryBasisSelectedRows = ref<InventorySummaryBasisItem[]>([]);
const inventoryBasisForm = reactive({
  demandOrgNumber: '',
  erpAcctCode: '',
});

const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const integrationForm = reactive<IntegrationConfig>({
  k3cloud: {
    enabled: true,
    defaultAcctCode: '',
    accounts: [],
  },
  aktools: {
    enabled: true,
    host: '',
    port: 18080,
    syncEnabled: true,
  },
  onlyoffice: {
    enabled: true,
    documentServerUrl: '',
    documentServerCallbackBaseUrl: '',
    jwtEnabled: true,
    jwtSecret: '',
    jwtSecretConfigured: false,
    jwtSecretMask: '',
  },
});

const materialRequestPolicyForm = reactive<MaterialRequestPolicyConfig>({
  integerUnitNumbers: 'PCS,pcs,Pcs,个,件,只,套',
  oneDecimalUnitNumbers: 'KG,kg,Kg,千克',
  urgentWeeklyLimit: 3,
});

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原默认密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新默认密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新默认密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

const accountCountText = computed(() => {
  const enabledCount = integrationForm.k3cloud.accounts.filter((item) => item.enabled).length;
  return `${integrationForm.k3cloud.accounts.length} 个账套，${enabledCount} 个启用`;
});

const inventoryBasisSelectedCount = computed(() => inventoryBasisSelectedRows.value.length);

function blankAccount(acctCode = ''): K3CloudAccountConfig {
  return {
    acctCode,
    displayName: acctCode ? `${acctCode}账套` : '',
    enabled: true,
    serverUrl: '',
    username: '',
    lcid: 2052,
    acctId: '',
    appId: '',
    appSec: '',
    analysisEnabled: false,
    analysisCron: '0 0 20 20 * ?',
  };
}

const flowClaimModelingFallbacks: FlowClaimModelingConfig[] = [
  {
    configKey: 'flow_claim_machine_modeling',
    configName: '机台建模介入',
    configValue: 'false',
    description: '开启后开始工序会校验/占用机台并更新机台状态；关闭后完全跳过机台建模信息。',
  },
  {
    configKey: 'flow_claim_tooling_modeling',
    configName: '工装建模介入',
    configValue: 'false',
    description: '开启后开始工序会校验/占用工装并更新工装状态；关闭后完全跳过工装建模信息。',
  },
  {
    configKey: 'flow_claim_gauge_modeling',
    configName: '量具建模介入',
    configValue: 'false',
    description: '开启后开始工序会校验/占用量具并写入领用记录；关闭后完全跳过量具建模信息。',
  },
  {
    configKey: 'flow_claim_mould_modeling',
    configName: '模具建模介入',
    configValue: 'false',
    description: '开启后开始工序会校验/占用模具并写入领用记录；关闭后完全跳过模具建模信息。',
  },
];

function normalizeAccounts(accounts?: K3CloudAccountConfig[]) {
  return (accounts || [])
    .filter((item) => item && (item.acctCode || item.serverUrl || item.username))
    .map((item) => ({
      ...blankAccount(item.acctCode?.trim() || ''),
      ...item,
      acctCode: (item.acctCode || '').trim(),
      displayName: (item.displayName || item.acctCode || '').trim(),
      acctId: '',
      appId: '',
      appSec: '',
    }));
}

function addAccountRow() {
  integrationForm.k3cloud.accounts.push(blankAccount());
}

function removeAccountRow(index: number) {
  integrationForm.k3cloud.accounts.splice(index, 1);
}

function addDefaultAccountRows() {
  const existing = new Set(integrationForm.k3cloud.accounts.map((item) => item.acctCode));
  for (const acctCode of ['FNS', 'HH']) {
    if (!existing.has(acctCode)) {
      integrationForm.k3cloud.accounts.push({
        ...blankAccount(acctCode),
        displayName: acctCode === 'FNS' ? '飞诺斯账套' : '汇慧账套',
      });
    }
  }
  if (!integrationForm.k3cloud.defaultAcctCode) {
    integrationForm.k3cloud.defaultAcctCode = 'FNS';
  }
}

async function loadPasswordConfig() {
  try {
    const res: any = await getDefaultPassword();
    if (res.success && res.data) {
      defaultPasswordPlain.value = res.data.defaultPasswordPlain || '';
    }
  } catch (error) {
    console.error('加载默认密码配置失败', error);
  }
}

async function loadIntegrationConfig() {
  integrationLoading.value = true;
  try {
    const res: any = await getIntegrationConfig();
    if (!res.success || !res.data) {
      ElMessage.error(res.message || '加载集成配置失败');
      return;
    }
    const data = res.data as IntegrationConfig;
    integrationForm.k3cloud.enabled = data.k3cloud?.enabled ?? true;
    integrationForm.k3cloud.defaultAcctCode = data.k3cloud?.defaultAcctCode || '';
    integrationForm.k3cloud.accounts = normalizeAccounts(data.k3cloud?.accounts);
    integrationForm.aktools.enabled = data.aktools?.enabled ?? true;
    integrationForm.aktools.host = data.aktools?.host || '';
    integrationForm.aktools.port = Number(data.aktools?.port || 18080);
    integrationForm.aktools.syncEnabled = data.aktools?.syncEnabled ?? true;
    integrationForm.onlyoffice.enabled = data.onlyoffice?.enabled ?? true;
    integrationForm.onlyoffice.documentServerUrl = data.onlyoffice?.documentServerUrl || '';
    integrationForm.onlyoffice.documentServerCallbackBaseUrl =
      data.onlyoffice?.documentServerCallbackBaseUrl || data.onlyoffice?.publicBaseUrl || '';
    integrationForm.onlyoffice.jwtEnabled = data.onlyoffice?.jwtEnabled ?? true;
    integrationForm.onlyoffice.jwtSecret = '';
    integrationForm.onlyoffice.jwtSecretConfigured = data.onlyoffice?.jwtSecretConfigured ?? false;
    integrationForm.onlyoffice.jwtSecretMask = data.onlyoffice?.jwtSecretMask || '';
  } catch (error: any) {
    ElMessage.error(error.message || '加载集成配置失败');
  } finally {
    integrationLoading.value = false;
  }
}

async function loadMaterialRequestPolicyConfig() {
  materialRequestPolicyLoading.value = true;
  try {
    const res: any = await getMaterialRequestPolicyConfig();
    if (!res.success || !res.data) {
      ElMessage.error(res.message || '加载生产领补料策略配置失败');
      return;
    }
    materialRequestPolicyForm.integerUnitNumbers = res.data.integerUnitNumbers || 'PCS,pcs,Pcs,个,件,只,套';
    materialRequestPolicyForm.oneDecimalUnitNumbers = res.data.oneDecimalUnitNumbers || 'KG,kg,Kg,千克';
    materialRequestPolicyForm.urgentWeeklyLimit = Number(res.data.urgentWeeklyLimit ?? 3);
  } catch (error: any) {
    ElMessage.error(error.message || '加载生产领补料策略配置失败');
  } finally {
    materialRequestPolicyLoading.value = false;
  }
}

async function loadFlowClaimModelingConfig() {
  flowClaimModelingLoading.value = true;
  try {
    const res: any = await getFlowClaimModelingConfigs();
    if (!res.success) {
      ElMessage.error(res.message || '加载流转卡任务认领配置失败');
      flowClaimModelingConfigs.value = flowClaimModelingFallbacks.map((item) => ({ ...item }));
      return;
    }
    const remoteItems = (res.data || []) as FlowClaimModelingConfig[];
    const remoteMap = new Map(remoteItems.map((item) => [item.configKey, item]));
    flowClaimModelingConfigs.value = flowClaimModelingFallbacks.map((fallback) => ({
      ...fallback,
      ...remoteMap.get(fallback.configKey),
      configValue: remoteMap.get(fallback.configKey)?.configValue ?? fallback.configValue,
    }));
  } catch (error: any) {
    ElMessage.error(error.message || '加载流转卡任务认领配置失败');
    flowClaimModelingConfigs.value = flowClaimModelingFallbacks.map((item) => ({ ...item }));
  } finally {
    flowClaimModelingLoading.value = false;
  }
}

async function loadInventoryBasisContext() {
  try {
    const accounts = await getErpAccounts();
    inventoryBasisAcctOptions.value = accounts.data || [];
    inventoryBasisForm.erpAcctCode = accounts.defaultAcctCode || inventoryBasisAcctOptions.value[0]?.acctCode || '';
    await loadInventoryBasisOrganizations();
    await loadInventorySummaryBasis();
  } catch (error: any) {
    ElMessage.error(error.message || '加载现有库存汇总依据上下文失败');
  }
}

async function loadInventoryBasisOrganizations() {
  if (!inventoryBasisForm.erpAcctCode) {
    inventoryBasisOrgOptions.value = [];
    return;
  }
  const resp = await getOrganizations(inventoryBasisForm.erpAcctCode);
  inventoryBasisOrgOptions.value = resp.data || [];
  if (!inventoryBasisForm.demandOrgNumber) {
    inventoryBasisForm.demandOrgNumber =
      resp.defaultOrg?.erpOrgNumber || inventoryBasisOrgOptions.value[0]?.erpOrgNumber || '';
  }
}

async function handleInventoryBasisAcctChange() {
  inventoryBasisForm.demandOrgNumber = '';
  inventoryBasisItems.value = [];
  inventoryBasisSelectedRows.value = [];
  await loadInventoryBasisOrganizations();
  await loadInventorySummaryBasis();
}

async function loadInventorySummaryBasis() {
  if (!inventoryBasisForm.erpAcctCode || !inventoryBasisForm.demandOrgNumber) {
    inventoryBasisItems.value = [];
    inventoryBasisSelectedRows.value = [];
    return;
  }
  inventoryBasisLoading.value = true;
  try {
    const res: any = await getInventorySummaryBasis({
      demandOrgNumber: inventoryBasisForm.demandOrgNumber,
      erpAcctCode: inventoryBasisForm.erpAcctCode,
    });
    if (!res.success) {
      ElMessage.error(res.message || '加载现有库存汇总依据失败');
      return;
    }
    inventoryBasisItems.value = res.data?.items || [];
    inventoryBasisSelectedRows.value = [];
  } catch (error: any) {
    ElMessage.error(error.message || '加载现有库存汇总依据失败');
  } finally {
    inventoryBasisLoading.value = false;
  }
}

async function handleRefreshExistingStockSummary() {
  if (!inventoryBasisForm.erpAcctCode || !inventoryBasisForm.demandOrgNumber) {
    ElMessage.warning('请先选择账套和需求组织');
    return;
  }
  inventoryBasisRefreshing.value = true;
  try {
    const res = await refreshExistingStockSummary({
      demandOrgNumber: inventoryBasisForm.demandOrgNumber,
      erpAcctCode: inventoryBasisForm.erpAcctCode,
    });
    if (!res.success) {
      ElMessage.error(res.message || '刷新现有库存汇总失败');
      return;
    }
    const count = res.resultCount ?? 0;
    if (count === 0) {
      ElMessage.warning('刷新完成，但未生成汇总结果。请确认白名单仓库已完成初始库存同步。');
      return;
    }
    ElMessage.success(`刷新成功，生成 ${count} 条汇总结果`);
  } catch (error: any) {
    ElMessage.error(error.message || '刷新现有库存汇总失败');
  } finally {
    inventoryBasisRefreshing.value = false;
  }
}

async function handleInventoryBasisSubmit() {
  if (!inventoryBasisForm.erpAcctCode || !inventoryBasisForm.demandOrgNumber) {
    ElMessage.warning('请先选择账套和需求组织');
    return;
  }
  inventoryBasisSaving.value = true;
  try {
    const payload = buildInventorySummaryBasisPayload(
      inventoryBasisForm.erpAcctCode,
      inventoryBasisForm.demandOrgNumber,
      inventoryBasisItems.value,
    );
    const res: any = await updateInventorySummaryBasis(payload);
    if (!res.success) {
      ElMessage.error(res.message || '保存现有库存汇总依据失败');
      return;
    }
    inventoryBasisItems.value = res.data?.items || inventoryBasisItems.value;
    ElMessage.success('现有库存汇总依据已保存');
  } catch (error: any) {
    ElMessage.error(error.message || '保存现有库存汇总依据失败');
  } finally {
    inventoryBasisSaving.value = false;
  }
}

function inventoryBasisRowKey(row: InventorySummaryBasisItem) {
  return `${row.sourceUseOrgNumber || ''}|${row.warehouseNumber || ''}`;
}

function handleInventoryBasisSelectionChange(rows: InventorySummaryBasisItem[]) {
  inventoryBasisSelectedRows.value = rows;
}

function applyInventoryBasisBatch(patch: InventorySummaryBasisBatchPatch, message: string) {
  const selectedKeys = inventoryBasisSelectedRows.value
    .map((item) => item.warehouseNumber || '')
    .filter(Boolean);
  if (selectedKeys.length === 0) {
    ElMessage.warning('请先勾选需要批量设定的仓库');
    return;
  }
  inventoryBasisItems.value = applyInventorySummaryBasisBatch(
    inventoryBasisItems.value,
    selectedKeys,
    patch,
  );
  ElMessage.success(`${message}，点击保存依据后生效`);
}

async function handleFlowClaimModelingChange(item: FlowClaimModelingConfig, enabled: boolean) {
  flowClaimModelingUpdatingKey.value = item.configKey;
  try {
    const res: any = await updateFlowClaimModelingConfig({
      configKey: item.configKey,
      configValue: String(enabled),
    });
    if (!res.success) {
      ElMessage.error(res.message || '保存流转卡任务认领配置失败');
      await loadFlowClaimModelingConfig();
      return;
    }
    item.configValue = String(enabled);
    ElMessage.success('流转卡任务认领配置已保存');
  } catch (error: any) {
    ElMessage.error(error.message || '保存流转卡任务认领配置失败');
    await loadFlowClaimModelingConfig();
  } finally {
    flowClaimModelingUpdatingKey.value = '';
  }
}

function buildIntegrationPayload(): IntegrationConfig {
  return {
    k3cloud: {
      enabled: integrationForm.k3cloud.enabled,
      defaultAcctCode: integrationForm.k3cloud.defaultAcctCode.trim(),
      accounts: integrationForm.k3cloud.accounts.map((item) => {
        const account: K3CloudAccountConfig = {
          acctCode: item.acctCode.trim(),
          displayName: item.displayName?.trim() || item.acctCode.trim(),
          enabled: item.enabled,
          serverUrl: item.serverUrl.trim(),
          username: item.username.trim(),
          lcid: Number(item.lcid || 2052),
          analysisEnabled: item.analysisEnabled ?? false,
          analysisCron: item.analysisCron?.trim() || '0 0 20 20 * ?',
        };
        if (item.acctId) account.acctId = item.acctId;
        if (item.appId) account.appId = item.appId;
        if (item.appSec) account.appSec = item.appSec;
        return account;
      }),
    },
    aktools: {
      enabled: integrationForm.aktools.enabled,
      host: integrationForm.aktools.host.trim(),
      port: Number(integrationForm.aktools.port || 18080),
      syncEnabled: integrationForm.aktools.syncEnabled,
    },
    onlyoffice: {
      enabled: integrationForm.onlyoffice.enabled,
      documentServerUrl: integrationForm.onlyoffice.documentServerUrl.trim(),
      documentServerCallbackBaseUrl: (integrationForm.onlyoffice.documentServerCallbackBaseUrl || '').trim(),
      jwtEnabled: integrationForm.onlyoffice.jwtEnabled,
      jwtSecret: integrationForm.onlyoffice.jwtSecret || undefined,
    },
  };
}

async function handleIntegrationSubmit() {
  integrationLoading.value = true;
  try {
    const res: any = await updateIntegrationConfig(buildIntegrationPayload());
    if (!res.success) {
      ElMessage.error(res.message || '保存集成配置失败');
      return;
    }
    ElMessage.success('集成配置已保存');
    await loadIntegrationConfig();
  } catch (error: any) {
    ElMessage.error(error.message || '保存集成配置失败');
  } finally {
    integrationLoading.value = false;
  }
}

async function handleMaterialRequestPolicySubmit() {
  materialRequestPolicySaving.value = true;
  try {
    const res: any = await updateMaterialRequestPolicyConfig({
      integerUnitNumbers: materialRequestPolicyForm.integerUnitNumbers.trim(),
      oneDecimalUnitNumbers: materialRequestPolicyForm.oneDecimalUnitNumbers.trim(),
      urgentWeeklyLimit: Number(materialRequestPolicyForm.urgentWeeklyLimit || 0),
    });
    if (!res.success) {
      ElMessage.error(res.message || '保存生产领补料策略配置失败');
      return;
    }
    ElMessage.success('生产领补料策略配置已保存');
    await loadMaterialRequestPolicyConfig();
  } catch (error: any) {
    ElMessage.error(error.message || '保存生产领补料策略配置失败');
  } finally {
    materialRequestPolicySaving.value = false;
  }
}

async function handlePasswordSubmit() {
  if (!passwordFormRef.value) return;
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const res: any = await updateDefaultPassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      if (res.success) {
        ElMessage.success('默认密码已更新');
        defaultPasswordPlain.value = passwordForm.newPassword;
        passwordForm.oldPassword = '';
        passwordForm.newPassword = '';
        passwordForm.confirmPassword = '';
      } else {
        ElMessage.error(res.message || '修改失败');
      }
    } catch (error: any) {
      ElMessage.error(error.message || '修改失败');
    } finally {
      loading.value = false;
    }
  });
}

onMounted(() => {
  loadPasswordConfig();
  loadIntegrationConfig();
  loadMaterialRequestPolicyConfig();
  loadFlowClaimModelingConfig();
  loadInventoryBasisContext();
});
</script>

<template>
  <div class="system-config-page">
    <div class="page-heading">
      <div>
        <h1>系统配置</h1>
        <p>集中维护 K3Cloud、AKTools、OnlyOffice 与默认密码。密钥只写入，不回显明文。</p>
      </div>
      <el-tag type="info" effect="plain">CONFIG_MASTER_KEY 仍走环境变量</el-tag>
    </div>

    <el-card shadow="never" class="system-config">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="集成配置" name="integrations">
          <el-alert
            class="mb-4"
            title="K3Cloud 使用类 Excel 的账套行维护方式；AcctId、AppId、AppSec、JWT Secret 保存后会加密入库，列表不返回明文。"
            type="info"
            :closable="false"
            show-icon
          />

          <el-form label-width="132px" :disabled="integrationLoading">
            <section class="config-section">
              <div class="section-title">
                <div>
                  <h2>K3Cloud WEBAPI 账套维护</h2>
                  <p>{{ accountCountText }}。真实账套编码按组织表使用 FNS / HH，不再使用 A / B 占位。</p>
                </div>
                <div class="section-actions">
                  <el-button round @click="addDefaultAccountRows">补齐 FNS / HH 行</el-button>
                  <el-button type="primary" round @click="addAccountRow">新增账套行</el-button>
                </div>
              </div>

              <div class="k3-toolbar">
                <el-form-item label="启用 K3Cloud">
                  <el-switch v-model="integrationForm.k3cloud.enabled" />
                </el-form-item>
                <el-form-item label="默认账套编码">
                  <el-input
                    v-model="integrationForm.k3cloud.defaultAcctCode"
                    class="compact-input"
                    placeholder="例如：FNS"
                  />
                </el-form-item>
              </div>

              <div class="table-shell">
                <el-table
                  :data="integrationForm.k3cloud.accounts"
                  border
                  class="excel-table"
                  empty-text="暂无账套，请点击“补齐 FNS / HH 行”或“新增账套行”"
                >
                  <el-table-column label="启用" width="78" fixed>
                    <template #default="{ row }">
                      <el-switch v-model="row.enabled" />
                    </template>
                  </el-table-column>
                  <el-table-column label="账套编码" min-width="128" fixed>
                    <template #default="{ row }">
                      <el-input v-model="row.acctCode" placeholder="FNS / HH" />
                    </template>
                  </el-table-column>
                  <el-table-column label="显示名" min-width="150">
                    <template #default="{ row }">
                      <el-input v-model="row.displayName" placeholder="飞诺斯账套" />
                    </template>
                  </el-table-column>
                  <el-table-column label="经营分析" width="96">
                    <template #default="{ row }">
                      <el-switch v-model="row.analysisEnabled" />
                    </template>
                  </el-table-column>
                  <el-table-column label="分析 cron" min-width="168">
                    <template #default="{ row }">
                      <el-input
                        v-model="row.analysisCron"
                        placeholder="0 0 20 20 * ?"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="WEBAPI 地址" min-width="240">
                    <template #default="{ row }">
                      <el-input v-model="row.serverUrl" placeholder="http://k3-host:3288/K3Cloud" />
                    </template>
                  </el-table-column>
                  <el-table-column label="用户名" min-width="150">
                    <template #default="{ row }">
                      <el-input v-model="row.username" placeholder="K3Cloud 用户名" />
                    </template>
                  </el-table-column>
                  <el-table-column label="LCID" width="120">
                    <template #default="{ row }">
                      <el-input-number v-model="row.lcid" :min="1" :controls="false" />
                    </template>
                  </el-table-column>
                  <el-table-column label="AcctId" min-width="160">
                    <template #default="{ row }">
                      <el-input v-model="row.acctId" show-password placeholder="留空不覆盖" />
                    </template>
                  </el-table-column>
                  <el-table-column label="AppId" min-width="160">
                    <template #default="{ row }">
                      <el-input v-model="row.appId" show-password placeholder="留空不覆盖" />
                    </template>
                  </el-table-column>
                  <el-table-column label="AppSec" min-width="180">
                    <template #default="{ row }">
                      <el-input v-model="row.appSec" show-password placeholder="留空不覆盖" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="90" fixed="right">
                    <template #default="{ $index }">
                      <el-button text type="danger" @click="removeAccountRow($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </section>

            <section class="config-section two-column">
              <el-card shadow="never" class="integration-card">
                <template #header>
                  <div class="card-header">
                    <span>AKTools</span>
                    <el-switch v-model="integrationForm.aktools.enabled" />
                  </div>
                </template>
                <el-form-item label="Host">
                  <el-input v-model="integrationForm.aktools.host" placeholder="localhost" />
                </el-form-item>
                <el-form-item label="Port">
                  <el-input-number
                    v-model="integrationForm.aktools.port"
                    :min="1"
                    :max="65535"
                    class="compact-input"
                  />
                </el-form-item>
                <el-form-item label="定时同步">
                  <el-switch v-model="integrationForm.aktools.syncEnabled" />
                </el-form-item>
                <p class="hint">AKTools 当前后端没有独立 secret 字段，只维护服务地址和同步开关。</p>
              </el-card>

              <el-card shadow="never" class="integration-card">
                <template #header>
                  <div class="card-header">
                    <span>OnlyOffice</span>
                    <el-switch v-model="integrationForm.onlyoffice.enabled" />
                  </div>
                </template>
                <el-form-item label="Document Server">
                  <el-input v-model="integrationForm.onlyoffice.documentServerUrl" placeholder="http://onlyoffice-host" />
                </el-form-item>
                <el-form-item label="MES Callback URL">
                  <el-input
                    v-model="integrationForm.onlyoffice.documentServerCallbackBaseUrl"
                    placeholder="http://mes-backend:8080"
                  />
                </el-form-item>
                <el-form-item label="JWT">
                  <el-switch v-model="integrationForm.onlyoffice.jwtEnabled" />
                </el-form-item>
                <el-form-item label="JWT Secret">
                  <el-input
                    v-model="integrationForm.onlyoffice.jwtSecret"
                    :placeholder="integrationForm.onlyoffice.jwtSecretConfigured ? '留空表示不覆盖现有密钥' : '请输入 JWT Secret'"
                    show-password
                  >
                    <template #append>
                      {{ integrationForm.onlyoffice.jwtSecretConfigured ? integrationForm.onlyoffice.jwtSecretMask || '已设置' : '未设置' }}
                    </template>
                  </el-input>
                </el-form-item>
              </el-card>
            </section>

            <section class="config-section">
              <el-card shadow="never" class="integration-card" v-loading="materialRequestPolicyLoading">
                <template #header>
                  <div class="card-header">
                    <span>生产领补料策略</span>
                    <el-button size="small" round :loading="materialRequestPolicyLoading" @click="loadMaterialRequestPolicyConfig">
                      重新加载
                    </el-button>
                  </div>
                </template>
                <el-form-item label="整数单位">
                  <el-input
                    v-model="materialRequestPolicyForm.integerUnitNumbers"
                    placeholder="PCS,pcs,Pcs,个,件,只,套"
                  />
                </el-form-item>
                <el-form-item label="1位小数单位">
                  <el-input
                    v-model="materialRequestPolicyForm.oneDecimalUnitNumbers"
                    placeholder="KG,kg,Kg,千克"
                  />
                </el-form-item>
                <el-form-item label="紧急周额度">
                  <el-input-number
                    v-model="materialRequestPolicyForm.urgentWeeklyLimit"
                    :min="0"
                    :precision="0"
                    class="compact-input"
                  />
                </el-form-item>
                <div class="card-actions">
                  <el-button type="primary" round :loading="materialRequestPolicySaving" @click="handleMaterialRequestPolicySubmit">
                    保存领补料策略
                  </el-button>
                </div>
              </el-card>
            </section>

            <div class="footer-actions">
              <el-button type="primary" round :loading="integrationLoading" @click="handleIntegrationSubmit">
                保存集成配置
              </el-button>
              <el-button round :loading="integrationLoading" @click="loadIntegrationConfig">
                重新加载
              </el-button>
            </div>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="流转卡任务认领" name="flowClaimModeling">
          <section v-loading="flowClaimModelingLoading" class="config-section">
            <div class="section-title">
              <div>
                <h2>流转卡任务认领</h2>
                <p>控制开始工序时是否介入工厂建模资源；关闭时对应资源完全不参与认领流程。</p>
              </div>
              <el-button round :loading="flowClaimModelingLoading" @click="loadFlowClaimModelingConfig">
                重新加载
              </el-button>
            </div>

            <div class="switch-list">
              <div v-for="item in flowClaimModelingConfigs" :key="item.configKey" class="switch-row">
                <div class="switch-copy">
                  <h3>{{ item.configName || item.configKey }}</h3>
                  <p>{{ item.description }}</p>
                </div>
                <el-switch
                  :model-value="item.configValue === 'true'"
                  :loading="flowClaimModelingUpdatingKey === item.configKey"
                  @change="(value: boolean | string | number) => handleFlowClaimModelingChange(item, value === true)"
                />
              </div>
            </div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="现有库存汇总依据" name="inventorySummaryBasis">
          <section v-loading="inventoryBasisLoading" class="config-section">
            <div class="section-title">
              <div>
                <h2>现有库存汇总依据</h2>
                <p>按账套 + 需求组织维护可参与领料、退料、补料库存候选的仓库白名单，仓库使用组织来自 K3Cloud FUseOrgId。</p>
              </div>
              <div class="section-actions">
                <el-button round :loading="inventoryBasisLoading" @click="loadInventorySummaryBasis">重新加载</el-button>
                <el-button
                  round
                  :loading="inventoryBasisRefreshing"
                  @click="handleRefreshExistingStockSummary"
                >
                  刷新库存汇总
                </el-button>
                <el-button type="primary" round :loading="inventoryBasisSaving" @click="handleInventoryBasisSubmit">
                  保存依据
                </el-button>
              </div>
            </div>

            <div class="k3-toolbar basis-filter-toolbar">
              <el-form-item label="账套">
                <el-select
                  v-model="inventoryBasisForm.erpAcctCode"
                  class="basis-filter-select basis-filter-select--acct"
                  filterable
                  @change="handleInventoryBasisAcctChange"
                >
                  <el-option
                    v-for="acct in inventoryBasisAcctOptions"
                    :key="acct.acctCode"
                    :label="acct.acctCode"
                    :value="acct.acctCode"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="需求组织">
                <el-select
                  v-model="inventoryBasisForm.demandOrgNumber"
                  class="basis-filter-select basis-filter-select--org"
                  filterable
                  @change="loadInventorySummaryBasis"
                >
                  <el-option
                    v-for="org in inventoryBasisOrgOptions"
                    :key="org.erpOrgNumber"
                    :label="`${org.erpOrgNumber} - ${org.erpOrgName}`"
                    :value="org.erpOrgNumber"
                  />
                </el-select>
              </el-form-item>
              <div class="basis-bulk-actions">
                <el-tag effect="plain">已选 {{ inventoryBasisSelectedCount }} 个仓库</el-tag>
                <el-button
                  round
                  :disabled="inventoryBasisSelectedCount === 0"
                  @click="applyInventoryBasisBatch({ enabled: true }, '已批量纳入')"
                >
                  纳入
                </el-button>
                <el-button
                  round
                  :disabled="inventoryBasisSelectedCount === 0"
                  @click="applyInventoryBasisBatch({ enabled: false }, '已批量移出')"
                >
                  移出
                </el-button>
                <el-button
                  round
                  :disabled="inventoryBasisSelectedCount === 0"
                  @click="applyInventoryBasisBatch({ warehouseType: 'PHYSICAL' }, '已批量设为实仓')"
                >
                  设为实仓
                </el-button>
                <el-button
                  round
                  :disabled="inventoryBasisSelectedCount === 0"
                  @click="applyInventoryBasisBatch({ warehouseType: 'WORKSHOP' }, '已批量设为线边/车间仓')"
                >
                  设为线边/车间仓
                </el-button>
              </div>
            </div>

            <div class="table-shell">
              <el-table
                :data="inventoryBasisItems"
                border
                class="basis-table"
                empty-text="暂无仓库，请刷新 ERP 基础数据缓存"
                :row-key="inventoryBasisRowKey"
                @selection-change="handleInventoryBasisSelectionChange"
              >
                <el-table-column type="selection" width="48" fixed />
                <el-table-column label="纳入状态" width="96" fixed>
                  <template #default="{ row }">
                    <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
                      {{ row.enabled ? '已纳入' : '未纳入' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="sourceUseOrgNumber" label="使用组织 FUseOrgId" min-width="150" fixed />
                <el-table-column prop="sourceUseOrgName" label="使用组织名称" min-width="180" show-overflow-tooltip />
                <el-table-column prop="warehouseNumber" label="仓库编码" min-width="140" />
                <el-table-column prop="warehouseName" label="仓库名称" min-width="180" show-overflow-tooltip />
                <el-table-column label="仓库类型" width="150">
                  <template #default="{ row }">
                    <el-tag :type="row.warehouseType === 'WORKSHOP' ? 'warning' : 'info'" effect="plain">
                      {{ row.warehouseType === 'WORKSHOP' ? '线边/车间仓' : '实仓' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="备注" min-width="220">
                  <template #default="{ row }">
                    <el-input v-model="row.remark" placeholder="可选" />
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="默认密码" name="password">
          <el-descriptions :column="1" border class="mb-4">
            <el-descriptions-item label="当前默认密码">
              <span class="mono">{{ defaultPasswordPlain || '未设置' }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="120px"
            class="narrow-form"
          >
            <el-form-item label="原默认密码" prop="oldPassword">
              <el-input v-model="passwordForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新默认密码" prop="newPassword">
              <el-input v-model="passwordForm.newPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" round :loading="loading" @click="handlePasswordSubmit">
                保存修改
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!--
          逻辑全在子组件里：本文件已超 1100 行，再塞一套表格 + 两个 dialog 会难以维护。
          TAB 挂在 /system/config 内即自动继承 system:config 的菜单权限，无需新增权限行。
        -->
        <el-tab-pane label="ERP上游单据同步" name="erpUpstreamSync">
          <ErpUpstreamSync v-if="activeTab === 'erpUpstreamSync'" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.system-config-page {
  padding: 20px;
}

.page-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;

  h1 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 20px;
    font-weight: 700;
  }

  p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}

.system-config,
.integration-card {
  border: 1px solid var(--el-border-color);
}

.config-section {
  padding: 18px;
  margin-bottom: 18px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.section-title,
.card-header,
.footer-actions,
.k3-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin-bottom: 14px;

  h2 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.k3-toolbar {
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 12px 0 4px;
}

.basis-filter-toolbar {
  align-items: flex-start;
}

.basis-filter-select {
  width: 220px;
}

.basis-filter-select--org {
  width: 320px;
}

.basis-bulk-actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 420px;
  padding-top: 1px;
}

.table-shell {
  overflow-x: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
}

.excel-table {
  min-width: 1500px;
}

.basis-table {
  min-width: 1080px;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  background: transparent;
  border: none;
  padding: 0;
}

.hint {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.footer-actions {
  justify-content: flex-end;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.switch-list {
  display: grid;
  gap: 12px;
}

.switch-row {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.switch-copy {
  min-width: 0;

  h3 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
}

.narrow-form {
  max-width: 560px;
}

.compact-input {
  max-width: 360px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 768px) {
  .system-config-page {
    padding: 12px;
  }

  .page-heading,
  .section-title,
  .k3-toolbar,
  .footer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .section-actions,
  .footer-actions {
    justify-content: flex-start;
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .basis-filter-select,
  .basis-filter-select--org,
  .basis-bulk-actions {
    width: 100%;
    min-width: 0;
  }
}
</style>
