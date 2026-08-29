<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import type { ErpOrganization } from '#/api/erpData';

import { getErpAccounts, getOrganizations } from '#/api/erpData';
import { useErpAcctStore } from '#/store';

const erpAcctStore = useErpAcctStore();
const loading = ref(false);
const orgLoading = ref(false);
const orgOptions = ref<ErpOrganization[]>([]);

const options = computed(() => erpAcctStore.options);
const modelValue = computed({
  get: () => erpAcctStore.acctCode,
  set: (value: string) => {
    void handleAcctChange(value);
  },
});
const orgModelValue = ref(localStorage.getItem('mes_current_org_id') || '');

async function ensureAccountsLoaded() {
  if (erpAcctStore.options.length > 0) {
    return;
  }
  loading.value = true;
  try {
    const resp = await getErpAccounts();
    if (!resp.success) {
      throw new Error(resp.message || '加载ERP账套失败');
    }
    erpAcctStore.setOptions(resp.data || []);
    if (resp.defaultAcctCode && !erpAcctStore.acctCode) {
      erpAcctStore.setAcctCode(resp.defaultAcctCode);
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载ERP账套失败');
  } finally {
    loading.value = false;
  }
}

async function syncDefaultOrgForAcct() {
  const resp = await getOrganizations(erpAcctStore.acctCode);
  if (!resp.success) {
    throw new Error(resp.message || '加载账套组织失败');
  }
  const org = resp.defaultOrg || resp.data?.[0];
  if (org?.erpOrgId) {
    localStorage.setItem('mes_current_org_id', String(org.erpOrgId));
  } else {
    localStorage.removeItem('mes_current_org_id');
  }
}

async function loadOrganizationsForAcct() {
  const acctCode = `${erpAcctStore.acctCode || ''}`.trim();
  if (!acctCode) {
    orgOptions.value = [];
    return;
  }
  orgLoading.value = true;
  try {
    const resp = await getOrganizations(acctCode);
    if (!resp.success) {
      throw new Error(resp.message || '加载ERP组织失败');
    }
    orgOptions.value = resp.data || [];
    const savedOrgId = localStorage.getItem('mes_current_org_id');
    const selectedOrg = orgOptions.value.find((item) => String(item.erpOrgId) === savedOrgId);
    const fallbackOrg = selectedOrg || resp.defaultOrg || orgOptions.value[0];
    if (fallbackOrg?.erpOrgId) {
      orgModelValue.value = String(fallbackOrg.erpOrgId);
      localStorage.setItem('mes_current_org_id', orgModelValue.value);
    } else {
      orgModelValue.value = '';
      localStorage.removeItem('mes_current_org_id');
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载ERP组织失败');
  } finally {
    orgLoading.value = false;
  }
}

async function handleAcctChange(value: string) {
  const nextAcctCode = `${value || ''}`.trim();
  if (nextAcctCode === erpAcctStore.acctCode) {
    return;
  }
  loading.value = true;
  try {
    erpAcctStore.setAcctCode(nextAcctCode);
    await syncDefaultOrgForAcct();
    window.location.reload();
  } catch (error: any) {
    ElMessage.error(error.message || '切换ERP账套失败');
  } finally {
    loading.value = false;
  }
}

function handleOrgChange(value: string) {
  const nextOrgId = `${value || ''}`.trim();
  if (nextOrgId) {
    orgModelValue.value = nextOrgId;
    localStorage.setItem('mes_current_org_id', nextOrgId);
  } else {
    orgModelValue.value = '';
    localStorage.removeItem('mes_current_org_id');
  }
  window.location.reload();
}

watch(
  () => erpAcctStore.options.length,
  (count) => {
    if (count > 0 && !erpAcctStore.acctCode) {
      const defaultOption =
        erpAcctStore.options.find((item) => item.isDefault) ??
        erpAcctStore.options[0];
      erpAcctStore.setAcctCode(defaultOption?.acctCode || '');
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await ensureAccountsLoaded();
  await loadOrganizationsForAcct();
});
</script>

<template>
  <div class="flex items-center gap-2 px-1">
    <span class="text-xs text-muted-foreground">账套</span>
    <el-select
      v-model="modelValue"
      :loading="loading"
      class="erp-acct-switcher"
      placeholder="账套"
      size="small"
      style="width: 110px"
    >
      <el-option
        v-for="item in options"
        :key="item.acctCode"
        :label="item.acctCode"
        :value="item.acctCode"
      />
    </el-select>
    <span class="text-xs text-muted-foreground">组织</span>
    <el-select
      v-model="orgModelValue"
      :loading="orgLoading"
      class="erp-org-switcher"
      placeholder="组织"
      size="small"
      style="width: 150px"
      @change="handleOrgChange"
    >
      <el-option
        v-for="item in orgOptions"
        :key="item.erpOrgId"
        :label="`${item.erpOrgNumber || item.erpOrgId} / ${item.erpOrgName || '-'}`"
        :value="String(item.erpOrgId)"
      />
    </el-select>
  </div>
</template>
