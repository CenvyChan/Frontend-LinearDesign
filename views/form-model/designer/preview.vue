<script setup lang="ts">
import type { FormFieldSchema, FormSchemaResponse } from '#/api/form-model';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getDesignerPreviewSchemaApi } from '#/api/formModelDesigner';

defineOptions({ name: 'FormModelDesignerPreview' });

const route = useRoute();
const schema = ref<FormSchemaResponse>();
const loading = ref(false);
const error = ref('');
const formKey = computed(() => String(route.params.formKey ?? ''));
const fields = computed(() =>
  [...(schema.value?.fields ?? [])]
    .filter((field) => field.isVisible !== false)
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0)),
);



function optionValues(field: FormFieldSchema) {
  const configured = field.optionConfig?.options;
  if (!Array.isArray(configured)) return [];
  return configured.filter(
    (option): option is { code: string; label: string } =>
      typeof option?.code === 'string' && typeof option?.label === 'string',
  );
}

function booleanValue(field: FormFieldSchema) {
  return field.defaultValue === 'true' || field.defaultValue === '1';
}

async function loadPreview() {
  if (!formKey.value) {
    error.value = '缺少 formKey';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    schema.value = await getDesignerPreviewSchemaApi(formKey.value);
  } catch (caught: any) {
    error.value = caught?.message || '加载草稿预览失败';
    ElMessage.error(error.value);
  } finally {
    loading.value = false;
  }
}

onMounted(loadPreview);
</script>

<template>
  <main class="preview-page" v-loading="loading">
    <header class="preview-header">
      <div>
        <h1>{{ schema?.formName || '表单草稿预览' }}</h1>
        <p>草稿版本 {{ schema?.schemaVersion ?? '-' }} · 未发布</p>
      </div>
    </header>

    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-empty v-else-if="!loading && !schema" description="未找到草稿" />
    <el-form v-else label-position="top" class="preview-form">
      <el-form-item v-for="field in fields" :key="field.fieldKey" :label="field.fieldLabel">
        <el-input
          v-if="['TEXT', 'TEXTAREA', 'RICH_TEXT', 'DATE', 'DATETIME', 'REFERENCE'].includes(field.fieldType?.toUpperCase() ?? '')"
          :model-value="field.defaultValue"
          :type="['TEXTAREA', 'RICH_TEXT'].includes(field.fieldType?.toUpperCase() ?? '') ? 'textarea' : 'text'"
          disabled
        />
        <el-input-number
          v-else-if="['INTEGER', 'NUMBER', 'MONEY'].includes(field.fieldType?.toUpperCase() ?? '')"
          :model-value="Number(field.defaultValue ?? 0)"
          disabled
        />
        <el-switch
          v-else-if="field.fieldType?.toUpperCase() === 'BOOLEAN'"
          :model-value="booleanValue(field)"
          disabled
        />
        <el-select
          v-else-if="['SELECT', 'MULTI_SELECT'].includes(field.fieldType?.toUpperCase() ?? '')"
          :model-value="field.defaultValue"
          disabled
        >
          <el-option v-for="option in optionValues(field)" :key="option.code" :label="option.label" :value="option.code" />
        </el-select>
        <el-radio-group
          v-else-if="field.fieldType?.toUpperCase() === 'RADIO'"
          :model-value="field.defaultValue"
          disabled
        >
          <el-radio v-for="option in optionValues(field)" :key="option.code" :value="option.code">{{ option.label }}</el-radio>
        </el-radio-group>
        <el-input v-else :model-value="field.defaultValue" disabled />
      </el-form-item>
    </el-form>
  </main>
</template>

<style scoped>
.preview-page {
  min-height: 100%;
  padding: 24px;
  background: var(--el-bg-color-page);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.preview-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.preview-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.preview-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0 16px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}
</style>
