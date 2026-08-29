<script lang="ts" setup>
import type { WmsOperationTaskLine } from '#/api/wms';

import { computed, ref, watch } from 'vue';

import { ElMessage } from 'element-plus';

import { completeIncomingInspection } from '#/api/wms';

import {
  inspectionQtyMatches,
  qualifiedQtyFromRejected,
} from '../wms-task-action-model';

/**
 * 来料检验录入。采购收料与销售退货共用（后端 InspectionCompletionRouter 按 sourceFormId 分流）。
 *
 * 从 `wms-task-pool.vue` 的内联 dialog 抽出来，因为链路作业台的抽屉也要用同一份表单 ——
 * 此前它是全前端唯一一处检验录入，复制一份必然漂移。
 */
defineOptions({ name: 'IncomingInspectionDialog' });

const props = defineProps<{
  /** 任务行。计划数量取自它的 planQty */
  line?: null | WmsOperationTaskLine;
  taskId?: number;
}>();

const visible = defineModel<boolean>('visible', { default: false });

const emit = defineEmits<{
  /** 提交成功。父组件据此刷新列表；rejectedQty > 0 时后端已自动生成退料任务 */
  submitted: [{ qualifiedQty: number; rejectedQty: number }];
}>();

const loading = ref(false);
const qualifiedQty = ref(0);
const rejectedQty = ref(0);

/**
 * 计划数量 = ERP 的交货数量（`FActReceiveQty - FCheckQty`，同步时算好写在任务行上）。
 *
 * 后端要求「合格 + 判退 == 计划」，所以这个值是两个输入框的唯一基准。
 */
const planQty = computed(() => Number(props.line?.planQty || 0));

const totalQty = computed(() => Number(qualifiedQty.value || 0) + Number(rejectedQty.value || 0));

// 判据放在 wms-task-action-model.ts 里由 spec 钉住，这里只做绑定 —— 不在模板层再写一份。
const qtyMatches = computed(() =>
  inspectionQtyMatches(planQty.value, qualifiedQty.value, rejectedQty.value),
);

// 打开时重置为「全合格」——最常见的情形是零判退，默认填好省一次输入。
watch(
  visible,
  (open) => {
    if (open) {
      qualifiedQty.value = planQty.value;
      rejectedQty.value = 0;
    }
  },
  { immediate: true },
);

/**
 * 判退数量联动合格数量：合格 = 计划 - 判退。
 *
 * 现场只会数出「坏了几个」，合格数是算出来的。此前两个框都要手填，
 * 而后端要求两者之和恰好等于计划量 —— 各填一次必然凑不上、提交按钮一直是禁用的。
 *
 * 只做单向联动（改判退带动合格）：反向也联动会让两个 watch 互相触发。
 * 合格数仍可手改，用于「样品损耗」这类两者之和小于计划量的场景 —— 那时提交按钮会禁用，
 * 由「合计」标签变红提示，而不是静默改掉用户输入。
 */
watch(rejectedQty, (rejected) => {
  qualifiedQty.value = qualifiedQtyFromRejected(planQty.value, rejected);
});

async function submit() {
  if (!props.taskId || !props.line?.id) return;
  if (!qtyMatches.value) {
    ElMessage.warning(`合格数 + 判退数必须等于计划数 ${planQty.value}`);
    return;
  }
  loading.value = true;
  try {
    const payload = {
      qualifiedQty: Number(qualifiedQty.value || 0),
      rejectedQty: Number(rejectedQty.value || 0),
    };
    const response = await completeIncomingInspection(props.taskId, props.line.id, payload);
    if (!response.success) throw new Error(response.message || '录入检验结果失败');
    ElMessage.success(
      payload.rejectedQty > 0
        ? '检验结果已录入，判退数量已生成退料任务'
        : '检验结果已录入',
    );
    visible.value = false;
    emit('submitted', payload);
  } catch (error: any) {
    ElMessage.error(error.message || '录入检验结果失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="录入来料检验结果" width="520px">
    <el-alert
      :closable="false"
      class="inspection-hint"
      show-icon
      title="合格数量放行入库，判退数量将自动生成采购退料任务（检验退料）。"
      type="info"
    />
    <el-form label-width="96px">
      <el-form-item label="物料">
        <span>{{ line?.materialCode }} {{ line?.materialName }}</span>
      </el-form-item>
      <el-form-item label="交货数量">
        <span>{{ planQty }} {{ line?.unitName || '' }}</span>
      </el-form-item>
      <el-form-item label="判退数量">
        <el-input-number v-model="rejectedQty" :max="planQty" :min="0" class="full-control" />
      </el-form-item>
      <el-form-item label="合格数量">
        <el-input-number v-model="qualifiedQty" :max="planQty" :min="0" class="full-control" />
      </el-form-item>
      <el-form-item label="合计">
        <el-tag :type="qtyMatches ? 'success' : 'danger'" effect="plain">
          {{ totalQty }} / {{ planQty }}
        </el-tag>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button :disabled="!qtyMatches" :loading="loading" type="primary" @click="submit">
        提交检验结果
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.inspection-hint {
  margin-bottom: 12px;
}

.full-control {
  width: 100%;
}
</style>
