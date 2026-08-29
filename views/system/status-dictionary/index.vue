<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getStatusTextAudit,
  getStatusTextOverrides,
  resetStatusTextOverride,
  saveStatusTextOverride,
  type StatusTextAuditEntry,
  type StatusTextEntry,
} from '#/api/statusDictionary';
import {
  BUILTIN_STATUS_ENTRIES,
  DEFAULT_STATUS_LOCALE,
  REGISTERED_STATUS_FIELDS,
} from '#/shared/status/statusDictionary.generated';
import { refreshStatusTextDictionary } from '#/shared/status/statusDictionary';

defineOptions({ name: 'SystemStatusDictionary' });

const loading = ref(false);
const saving = ref(false);
const auditVisible = ref(false);
const auditRows = ref<StatusTextAuditEntry[]>([]);
const query = reactive({ code: '', field: '', overridden: 'all' });
const overrides = ref<StatusTextEntry[]>([]);
const form = reactive<StatusTextEntry>({
  code: '',
  domain: 'global',
  field: 'status',
  locale: DEFAULT_STATUS_LOCALE,
  text: '',
});

const fields = computed(() => [...REGISTERED_STATUS_FIELDS].map((key) => {
  const [domain = '', field = ''] = key.split('.');
  return { domain, field, key };
}));
const overrideByKey = computed(() => new Map(overrides.value.map((item) => [entryKey(item), item])));
const rows = computed(() => {
  const keys = new Set<string>();
  const merged: Array<StatusTextEntry & { builtinText: string; overridden: boolean }> = [];
  for (const entry of BUILTIN_STATUS_ENTRIES) {
    const key = entryKey(entry);
    keys.add(key);
    const override = overrideByKey.value.get(key);
    merged.push({ ...entry, builtinText: entry.text, overridden: Boolean(override), ...override });
  }
  for (const entry of overrides.value) {
    const key = entryKey(entry);
    if (!keys.has(key)) merged.push({ ...entry, builtinText: '未内置', overridden: true });
  }
  return merged.filter((row) => {
    const fieldKey = `${row.domain}.${row.field}`;
    const matchCode = !query.code || row.code.includes(query.code.trim().toUpperCase());
    const matchField = !query.field || fieldKey === query.field;
    const matchOverride = query.overridden === 'all' || (query.overridden === 'yes' ? row.overridden : !row.overridden);
    return matchCode && matchField && matchOverride;
  });
});

async function load() {
  loading.value = true;
  try {
    const response: any = await getStatusTextOverrides(DEFAULT_STATUS_LOCALE);
    if (!response?.success) throw new Error(response?.message || '加载状态文案失败');
    overrides.value = response.data || [];
  } catch (error: any) {
    ElMessage.error(error?.message || '加载状态文案失败');
  } finally {
    loading.value = false;
  }
}

function selectField(value: string) {
  const selected = fields.value.find((item) => item.key === value);
  if (!selected) return;
  form.domain = selected.domain;
  form.field = selected.field;
}

function edit(row: StatusTextEntry) {
  form.domain = row.domain;
  form.field = row.field;
  form.code = row.code;
  form.locale = row.locale;
  form.text = row.text;
}

async function save() {
  if (!REGISTERED_STATUS_FIELDS.has(`${form.domain}.${form.field}`)) {
    ElMessage.warning('请选择已注册的状态字段');
    return;
  }
  saving.value = true;
  try {
    const response: any = await saveStatusTextOverride({ ...form, code: form.code.trim().toUpperCase(), text: form.text.trim() });
    if (!response?.success) throw new Error(response?.message || '保存状态文案失败');
    ElMessage.success('状态文案已保存');
    await Promise.all([load(), refreshStatusTextDictionary()]);
  } catch (error: any) {
    ElMessage.error(error?.message || '保存状态文案失败');
  } finally {
    saving.value = false;
  }
}

async function reset(row: StatusTextEntry) {
  try {
    await ElMessageBox.confirm(`恢复 ${row.code} 的内置文案？`, '恢复默认', { type: 'warning' });
    const response: any = await resetStatusTextOverride(row);
    if (!response?.success) throw new Error(response?.message || '恢复默认失败');
    ElMessage.success(response.message || '已恢复内置文案');
    await Promise.all([load(), refreshStatusTextDictionary()]);
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '恢复默认失败');
  }
}

async function openAudit(row: StatusTextEntry) {
  try {
    const response: any = await getStatusTextAudit(row);
    if (!response?.success) throw new Error(response?.message || '加载审计记录失败');
    auditRows.value = response.data || [];
    auditVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error?.message || '加载审计记录失败');
  }
}

function entryKey(entry: Pick<StatusTextEntry, 'code' | 'domain' | 'field' | 'locale'>) {
  return `${entry.domain}.${entry.field}.${entry.code}.${entry.locale}`;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="status-dictionary-page">
    <section class="toolbar">
      <el-select v-model="query.field" clearable placeholder="状态字段">
        <el-option v-for="item in fields" :key="item.key" :label="item.key" :value="item.key" />
      </el-select>
      <el-input v-model="query.code" clearable placeholder="状态编码" />
      <el-segmented v-model="query.overridden" :options="[{ label: '全部', value: 'all' }, { label: '已覆盖', value: 'yes' }, { label: '内置', value: 'no' }]" />
      <el-button type="primary" @click="load">刷新</el-button>
    </section>

    <section class="editor">
      <el-select :model-value="`${form.domain}.${form.field}`" @update:model-value="selectField">
        <el-option v-for="item in fields" :key="item.key" :label="item.key" :value="item.key" />
      </el-select>
      <el-input v-model="form.code" maxlength="80" placeholder="状态编码，例如 PUSH_FAILED" />
      <el-input v-model="form.text" maxlength="120" placeholder="中文文案" />
      <el-button :loading="saving" type="primary" @click="save">保存文案</el-button>
    </section>

    <el-table :data="rows" border row-key="code">
      <el-table-column label="领域" min-width="150"><template #default="{ row }">{{ row.domain }}.{{ row.field }}</template></el-table-column>
      <el-table-column prop="code" label="编码" min-width="150" />
      <el-table-column prop="builtinText" label="内置文案" min-width="160" />
      <el-table-column prop="text" label="当前文案" min-width="160" />
      <el-table-column label="覆盖" width="90"><template #default="{ row }"><el-tag :type="row.overridden ? 'success' : 'info'">{{ row.overridden ? '已覆盖' : '内置' }}</el-tag></template></el-table-column>
      <el-table-column label="最近修改" min-width="180"><template #default="{ row }">{{ row.updatedByName || '-' }} / {{ formatTime(row.updatedTime) }}</template></el-table-column>
      <el-table-column fixed="right" label="操作" width="220"><template #default="{ row }"><el-button link type="primary" @click="edit(row)">编辑</el-button><el-button link type="primary" @click="openAudit(row)">记录</el-button><el-button v-if="row.overridden" link type="warning" @click="reset(row)">恢复默认</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="auditVisible" title="状态文案修改记录" width="680px">
      <el-table :data="auditRows" border>
        <el-table-column prop="action" label="操作" width="90" />
        <el-table-column prop="oldText" label="旧文案" min-width="150" />
        <el-table-column prop="newText" label="新文案" min-width="150" />
        <el-table-column prop="operatorName" label="操作人" width="120" />
        <el-table-column label="时间" min-width="170"><template #default="{ row }">{{ formatTime(row.operateTime) }}</template></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.status-dictionary-page { display: flex; flex-direction: column; gap: 14px; min-height: 100%; padding: 16px; }
.toolbar, .editor { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.toolbar .el-input, .editor .el-input { width: 260px; }
</style>
