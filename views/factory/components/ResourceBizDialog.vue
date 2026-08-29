<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

import {
  performResourceBiz,
  type BizActionParam,
  type ResourceBizAction,
  type ResourceType,
} from '#/api/resourceBiz';

import { getResourceBizRule } from './resource-biz-rules';

const props = defineProps<{
  action?: ResourceBizAction | null;
  modelValue: boolean;
  resource?: Record<string, any> | null;
  resourceType: ResourceType;
}>();

const emit = defineEmits<{
  success: [];
  'update:modelValue': [value: boolean];
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);

const formData = reactive<BizActionParam>({
  operatorName: '',
  bizDetail: '',
  remark: '',
  orderId: undefined,
  nextBizDate: undefined,
});

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const actionRule = computed(() =>
  props.action ? getResourceBizRule(props.action) : undefined,
);

const resourceName = computed(() =>
  props.resource?.name
  ?? props.resource?.machineName
  ?? props.resource?.toolingName
  ?? props.resource?.gaugeName
  ?? props.resource?.mouldName
  ?? props.resource?.mouldCode
  ?? '',
);

const dialogTitle = computed(() => {
  const label = actionRule.value?.label || '业务操作';
  return resourceName.value ? `${label} - ${resourceName.value}` : label;
});

const showOrderId = computed(() => props.action === 'RECEIVE');
const showNextBizDate = computed(() => Boolean(actionRule.value?.nextBizDateLabel));

const rules = computed<FormRules>(() => ({
  operatorName: [{ required: true, message: '请输入操作员', trigger: 'blur' }],
  bizDetail: props.action === 'SCRAP' || props.action === 'REPAIR'
    ? [{ required: true, message: `请输入${actionRule.value?.detailLabel || '业务详情'}`, trigger: 'blur' }]
    : [],
  nextBizDate: actionRule.value?.nextBizDateRequired
    ? [{ required: true, message: `请选择${actionRule.value.nextBizDateLabel}`, trigger: 'change' }]
    : [],
}));

watch(
  () => [props.modelValue, props.action, props.resource?.id],
  ([open]) => {
    if (!open) return;
    formData.bizDetail = '';
    formData.remark = '';
    formData.orderId = undefined;
    formData.nextBizDate = undefined;
  },
);

async function submit() {
  if (!props.action) return;
  const resourceId = Number(props.resource?.id);
  if (!resourceId) {
    ElMessage.error('缺少资源ID，无法执行操作');
    return;
  }
  if (!formRef.value) return;

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  if (props.action === 'SCRAP') {
    try {
      await ElMessageBox.confirm(
        actionRule.value?.confirmMessage || '确认报废该资源？',
        '报废确认',
        {
          cancelButtonText: '取消',
          confirmButtonText: '确认报废',
          type: 'warning',
        },
      );
    } catch {
      return;
    }
  }

  submitting.value = true;
  try {
    const payload: BizActionParam = {
      operatorName: formData.operatorName,
      bizDetail: formData.bizDetail,
      remark: formData.remark,
      orderId: formData.orderId,
      nextBizDate: formData.nextBizDate ? Number(formData.nextBizDate) : undefined,
    };
    const res = await performResourceBiz(props.resourceType, resourceId, props.action, payload);
    if (res.success) {
      ElMessage.success(res.message || actionRule.value?.label || '操作成功');
      visible.value = false;
      emit('success');
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :close-on-click-modal="false"
    :title="dialogTitle"
    width="560px"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="112px"
    >
      <el-form-item label="操作员" prop="operatorName">
        <el-input v-model="formData.operatorName" placeholder="请输入操作员" />
      </el-form-item>
      <el-form-item v-if="showOrderId" label="关联工单" prop="orderId">
        <el-input-number
          v-model="formData.orderId"
          :min="1"
          controls-position="right"
          placeholder="请输入工单ID"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item
        v-if="showNextBizDate"
        :label="actionRule?.nextBizDateLabel"
        prop="nextBizDate"
      >
        <el-date-picker
          v-model="formData.nextBizDate"
          placeholder="请选择日期"
          style="width: 100%"
          type="date"
          value-format="x"
        />
      </el-form-item>
      <el-form-item :label="actionRule?.detailLabel || '业务详情'" prop="bizDetail">
        <el-input
          v-model="formData.bizDetail"
          :placeholder="actionRule?.detailPlaceholder"
          :rows="3"
          type="textarea"
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          placeholder="填写补充说明"
          :rows="2"
          type="textarea"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button :loading="submitting" type="primary" @click="submit" :icon="'Check'">提交</el-button>
    </template>
  </el-dialog>
</template>
