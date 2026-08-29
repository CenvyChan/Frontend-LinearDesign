<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, nextTick, onMounted, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getErpAccounts, getOrganizations } from '#/api/erpData';
import type { ErpAcctOption, ErpOrganization } from '#/api/erpData';
import { useAuthStore, useErpAcctStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const erpAcctStore = useErpAcctStore();

const acctList = ref<ErpAcctOption[]>([]);
const orgList = ref<ErpOrganization[]>([]);
const defaultOrgId = ref('');
const loginRef = ref<{ getFormApi: () => any }>();

const formSchema = computed((): VbenFormSchema[] => {
  const acctOptions = acctList.value.map((acct) => ({
    label: acct.acctCode,
    value: acct.acctCode,
  }));
  const orgOptions = orgList.value.map((org) => ({
    label: `${org.erpOrgName} (${org.erpOrgNumber})`,
    value: org.erpOrgId,
  }));

  return [
    {
      component: 'Select',
      componentProps: {
        onChange: handleAcctChange,
        options: acctOptions,
        placeholder: '请选择账套',
      },
      fieldName: 'erpAcctCode',
      label: '账套',
      rules: z.string().min(1, { message: '请选择账套' }),
    },
    {
      component: 'Select',
      componentProps: {
        options: orgOptions,
        placeholder: '请选择组织',
      },
      fieldName: 'orgId',
      label: '组织',
      rules: z.string().min(1, { message: '请选择组织' }),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.username'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

async function loadOrganizations(acctCode = erpAcctStore.acctCode) {
  console.info('[Login] loading organizations for ERP account:', acctCode);
  const res = await getOrganizations(acctCode);
  if (!res.success || !res.data) {
    throw new Error(res.message || '获取组织列表失败');
  }
  orgList.value = res.data;
  const org = res.defaultOrg || res.data[0];
  if (org?.erpOrgId) {
    const id = String(org.erpOrgId);
    defaultOrgId.value = id;
    localStorage.setItem('mes_current_org_id', id);
  } else {
    defaultOrgId.value = '';
    localStorage.removeItem('mes_current_org_id');
  }
}

async function handleAcctChange(acctCode: string) {
  console.info('[Login] ERP account changed:', acctCode);
  erpAcctStore.setAcctCode(acctCode);
  await loadOrganizations(acctCode);
  await nextTick();
  loginRef.value?.getFormApi().setFieldValue('erpAcctCode', acctCode);
  loginRef.value?.getFormApi().setFieldValue('orgId', defaultOrgId.value);
}

onMounted(async () => {
  try {
    const acctResp = await getErpAccounts();
    if (acctResp.success) {
      acctList.value = acctResp.data || [];
      erpAcctStore.setOptions(acctList.value);
      const preferredAcctCode =
        erpAcctStore.acctCode ||
        acctResp.defaultAcctCode ||
        acctList.value.find((item) => item.isDefault)?.acctCode ||
        acctList.value[0]?.acctCode ||
        '';
      erpAcctStore.setAcctCode(preferredAcctCode);
    }

    await loadOrganizations();
    await nextTick();
    const formApi = loginRef.value?.getFormApi();
    formApi?.setFieldValue('erpAcctCode', erpAcctStore.acctCode);
    formApi?.setFieldValue('orgId', defaultOrgId.value);
  } catch (error: any) {
    console.warn('获取账套或组织列表失败:', error?.message || error);
  }
});
</script>

<template>
  <AuthenticationLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="authStore.authLogin"
  />
</template>
