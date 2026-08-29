<script lang="ts" setup>
import type { PreCheckConfig } from '#/api/config';

import { onMounted, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { getPreCheckConfigs, updatePreCheckConfig } from '#/api/config';

defineOptions({ name: 'FactoryPreCheck' });

interface PreCheckConfigRecord extends PreCheckConfig {
  config_key?: string;
  config_name?: string;
  config_value?: string;
}

interface NormalizedPreCheckConfig {
  configKey: string;
  configName: string;
  configValue: string;
  description: string;
  id?: number;
}

const PRECHECK_DEFINITIONS: Record<string, { description: string; name: string; value: string }> = {
  precheck_equipment: {
    description: '绑定机台设备/工装夹具时检查可用状态',
    name: '装备预检开关',
    value: 'true',
  },
  precheck_gauge: {
    description: '绑定量具检具时检查校准有效期',
    name: '量具校准检查开关',
    value: 'true',
  },
  precheck_mould: {
    description: '绑定模具时检查模次寿命与保养状态',
    name: '模具状态检查开关',
    value: 'true',
  },
};

const PRECHECK_KEYS = ['precheck_equipment', 'precheck_mould', 'precheck_gauge'];

const loading = ref(false);
const updatingKey = ref('');
const configList = ref<NormalizedPreCheckConfig[]>([]);

function normalizeConfig(item: PreCheckConfigRecord): NormalizedPreCheckConfig | null {
  const configKey = item.configKey || item.config_key || '';
  if (!configKey) return null;

  const definition = PRECHECK_DEFINITIONS[configKey];
  return {
    configKey,
    configName: item.configName || item.config_name || definition?.name || configKey,
    configValue: item.configValue || item.config_value || definition?.value || 'false',
    description: item.description || definition?.description || '',
    id: item.id,
  };
}

function sortConfigs(items: NormalizedPreCheckConfig[]) {
  return [...items].sort((a, b) => PRECHECK_KEYS.indexOf(a.configKey) - PRECHECK_KEYS.indexOf(b.configKey));
}

async function fetchData(allowAutoInit = true) {
  loading.value = true;
  try {
    const res: any = await getPreCheckConfigs();
    if (res.success) {
      const normalizedList = sortConfigs(
        ((res.data || []) as PreCheckConfigRecord[])
          .map((item) => normalizeConfig(item))
          .filter((item): item is NormalizedPreCheckConfig => Boolean(item)),
      );
      configList.value = normalizedList;
      if (allowAutoInit && normalizedList.length === 0) {
        await initDefaultConfigs(false);
      }
    } else {
      ElMessage.error(res.message || '获取异常预检配置失败');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('获取异常预检配置失败');
  } finally {
    loading.value = false;
  }
}

async function handleSwitchChange(item: NormalizedPreCheckConfig, enabled: boolean) {
  updatingKey.value = item.configKey;
  const configValue = enabled ? 'true' : 'false';
  try {
    const res: any = await updatePreCheckConfig({
      configKey: item.configKey,
      configValue,
    });
    if (res.success) {
      item.configValue = configValue;
      ElMessage.success(`${item.configName}${enabled ? '已开启' : '已关闭'}`);
    } else {
      ElMessage.error(res.message || '更新异常预检配置失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '更新异常预检配置失败');
  } finally {
    updatingKey.value = '';
  }
}

async function initDefaultConfigs(showSuccess = true) {
  loading.value = true;
  try {
    for (const configKey of PRECHECK_KEYS) {
      const definition = PRECHECK_DEFINITIONS[configKey];
      const res: any = await updatePreCheckConfig({
        configKey,
        configValue: definition?.value || 'true',
      });
      if (!res.success) {
        throw new Error(res.message || `${definition?.name || configKey}初始化失败`);
      }
    }
    if (showSuccess) {
      ElMessage.success('默认预检配置已初始化');
    }
    await fetchData(false);
  } catch (error: any) {
    ElMessage.error(error?.message || '初始化默认预检配置失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="precheck-config-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>异常预检配置</span>
          <el-tag size="small" type="info">装备绑定预检</el-tag>
        </div>
      </template>

      <el-alert class="intro-alert" :closable="false" show-icon title="功能介绍" type="info">
        <p>异常预检在装备绑定时自动执行，检查装备状态是否满足生产要求。</p>
      </el-alert>

      <div v-loading="loading">
        <div v-if="configList.length > 0" class="config-list">
          <div v-for="item in configList" :key="item.configKey" class="config-item">
            <div class="config-info">
              <span class="config-name">{{ item.configName }}</span>
              <span class="config-desc">{{ item.description }}</span>
            </div>
            <el-switch
              :active-value="true"
              active-text="已开启"
              :inactive-value="false"
              inactive-text="已关闭"
              inline-prompt
              :loading="updatingKey === item.configKey"
              :model-value="item.configValue === 'true'"
              @change="(value: boolean) => handleSwitchChange(item, value)"
            />
          </div>
        </div>
        <el-empty v-else description="暂无异常预检配置">
          <el-button type="primary" @click="() => initDefaultConfigs()" :icon="'Check'">初始化默认配置</el-button>
        </el-empty>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.precheck-config-page {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.intro-alert {
  margin-bottom: 20px;
}

.intro-alert p {
  margin: 0;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.config-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.config-name {
  color: #303133;
  font-size: 15px;
  font-weight: 600;
}

.config-desc {
  color: #909399;
  font-size: 13px;
}
</style>
