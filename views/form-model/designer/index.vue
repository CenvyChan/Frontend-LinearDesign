<script setup lang="ts">
import type { DraftFormSummary } from '#/api/formModelDesigner';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  copyDesignerFormApi,
  createDesignerFormApi,
  disableDesignerFormApi,
  getDesignerListApi,
  getOwnerAcctOptionsApi,
} from '#/api/formModelDesigner';

defineOptions({ name: 'FormModelDesigner' });

const router = useRouter();
const loading = ref(false);
const forms = ref<DraftFormSummary[]>([]);
const ownerAcctOptions = ref<Array<{ acctCode: string; isDefault: boolean }>>([]);
const createVisible = ref(false);
const copyVisible = ref(false);
const createModel = ref({ formKey: '', formName: '', ownerAcctCode: '', remark: '' });
const copyModel = ref({ sourceKey: '', formKey: '', formName: '', ownerAcctCode: '' });
const createRules = {
  formKey: [
    { required: true, message: '请输入表单 Key', trigger: 'blur' },
    {
      pattern: /^[a-z][a-z0-9_]{2,23}$/,
      message: '只能小写字母开头，含小写字母/数字/下划线，长度 3-24',
      trigger: 'blur',
    },
  ],
  formName: [{ required: true, message: '请输入表单名称', trigger: 'blur' }],
  ownerAcctCode: [{ required: true, message: '请选择归属账套', trigger: 'change' }],
};

const formRef = ref();

async function load() {
  loading.value = true;
  try {
    forms.value = await getDesignerListApi();
  } catch (error: any) {
    ElMessage.error(error?.message || '加载设计器列表失败');
  } finally {
    loading.value = false;
  }
}

async function loadOwnerAccts() {
  try {
    ownerAcctOptions.value = await getOwnerAcctOptionsApi();
  } catch (error: any) {
    ElMessage.error(error?.message || '加载归属账套失败');
  }
}

function openCreate() {
  const fallback =
    ownerAcctOptions.value.find((item) => item.isDefault) ?? ownerAcctOptions.value[0];
  createModel.value = {
    formKey: '',
    formName: '',
    ownerAcctCode: fallback?.acctCode ?? '',
    remark: '',
  };
  createVisible.value = true;
}

async function create() {
  try {
    await formRef.value?.validate();
    const created = await createDesignerFormApi(createModel.value);
    createVisible.value = false;
    createModel.value = { formKey: '', formName: '', ownerAcctCode: '', remark: '' };
    await router.push(`/form-model/designer/${created.formKey}`);
  } catch (error: any) {
    ElMessage.error(error?.message || '新建表单失败');
  }
}

async function copy() {
  try {
    const created = await copyDesignerFormApi(copyModel.value.sourceKey, {
      formKey: copyModel.value.formKey,
      formName: copyModel.value.formName,
      ownerAcctCode: copyModel.value.ownerAcctCode,
    });
    copyVisible.value = false;
    copyModel.value = { sourceKey: '', formKey: '', formName: '', ownerAcctCode: '' };
    await router.push(`/form-model/designer/${created.formKey}`);
  } catch (error: any) {
    ElMessage.error(error?.message || '复制表单失败');
  }
}

function openCopy(form: DraftFormSummary) {
  copyModel.value = {
    sourceKey: form.formKey,
    formKey: `${form.formKey}_copy`,
    formName: `${form.formName}副本`,
    ownerAcctCode: form.ownerAcctCode,
  };
  copyVisible.value = true;
}

async function disable(form: DraftFormSummary) {
  try {
    await ElMessageBox.confirm(`确认作废表单“${form.formName}”？`, '作废确认');
    await disableDesignerFormApi(form.formKey);
    ElMessage.success('已作废');
    await load();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '作废表单失败');
  }
}

onMounted(() => {
  load();
  loadOwnerAccts();
});
</script>

<template>
  <div class="designer-page">
    <div class="page-header">
      <div>
        <h1>表单设计器</h1>
        <p>维护草稿字段与布局，保存后通过 Phase 1 发布链路上线。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建表单</el-button>
    </div>

    <el-table v-loading="loading" :data="forms" border>
      <el-table-column prop="formKey" label="表单 Key" min-width="180" />
      <el-table-column prop="formName" label="表单名称" min-width="180" />
      <el-table-column prop="ownerAcctCode" label="归属账套" width="140" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column prop="draftRevision" label="草稿版本" width="110" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="actions">
            <el-button link type="primary" @click="router.push(`/form-model/designer/${row.formKey}`)">
              编辑
            </el-button>
            <el-button link @click="openCopy(row)">复制</el-button>
            <el-button link type="danger" @click="disable(row)">作废</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createVisible" title="新建表单" width="520px">
      <el-form ref="formRef" :model="createModel" :rules="createRules" label-position="top">
        <el-form-item prop="formKey" label="表单 Key" required><el-input v-model="createModel.formKey" /></el-form-item>
        <el-form-item prop="formName" label="表单名称" required><el-input v-model="createModel.formName" /></el-form-item>
        <el-form-item prop="ownerAcctCode" label="归属账套" required>
          <el-select
            v-model="createModel.ownerAcctCode"
            :disabled="ownerAcctOptions.length === 0"
            :placeholder="ownerAcctOptions.length === 0 ? '当前用户未绑定任何账套' : '请选择归属账套'"
            style="width: 100%"
          >
            <el-option
              v-for="item in ownerAcctOptions"
              :key="item.acctCode"
              :label="item.isDefault ? `${item.acctCode}（默认）` : item.acctCode"
              :value="item.acctCode"
            />
          </el-select>
          <div v-if="ownerAcctOptions.length === 0" class="acct-hint">
            请联系管理员为当前用户绑定账套后再新建表单。
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="createModel.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="copyVisible" title="复制表单" width="520px">
      <el-form :model="copyModel" label-position="top">
        <el-form-item label="新表单 Key" required><el-input v-model="copyModel.formKey" /></el-form-item>
        <el-form-item label="新表单名称" required><el-input v-model="copyModel.formName" /></el-form-item>
        <el-form-item label="归属账套" required>
          <el-select
            v-model="copyModel.ownerAcctCode"
            :disabled="ownerAcctOptions.length === 0"
            placeholder="请选择归属账套"
            style="width: 100%"
          >
            <el-option
              v-for="item in ownerAcctOptions"
              :key="item.acctCode"
              :label="item.isDefault ? `${item.acctCode}（默认）` : item.acctCode"
              :value="item.acctCode"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyVisible = false">取消</el-button>
        <el-button type="primary" @click="copy">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.designer-page { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
h1 { margin: 0; font-size: 20px; }
p { margin: 8px 0 0; color: var(--el-text-color-secondary); }
.actions { display: inline-flex; gap: 8px; white-space: nowrap; }
.acct-hint { margin-top: 4px; font-size: 12px; color: var(--el-color-warning); }
</style>
