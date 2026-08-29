<template>
  <el-dialog v-model="visible" title="任务转仓" width="460px" :close-on-click-modal="false" @close="resetForm">
    <el-form ref="formRef" :model="form" label-width="90px" style="padding: 0 12px">
      <el-form-item
        label="目标仓库编码"
        prop="targetStockNumber"
        :rules="[{ required: true, message: '请输入目标仓库编码', trigger: 'blur' }]"
      >
        <el-input v-model="form.targetStockNumber" placeholder="请输入目标仓库编码" clearable />
      </el-form-item>
      <el-form-item label="目标仓库名称">
        <el-input v-model="form.targetStockName" placeholder="可选，仅作记录用" clearable />
      </el-form-item>
      <el-form-item label="转仓原因">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="2"
          placeholder="可选，说明转仓原因"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">确认转仓</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  /**
   * 调用对应的转仓 API，由父组件传入，保证对话框与具体任务类型解耦。
   * 签名: (taskId: number, data: TransferPayload) => Promise<any>
   */
  doTransfer: (taskId: number, data: TransferPayload) => Promise<any>
  taskId: number
}>()

const emit = defineEmits<{ success: [] }>()

const visible = defineModel<boolean>({ default: false })

interface TransferPayload {
  targetStockNumber: string
  targetStockName?: string
  reason?: string
  clientRequestId: string
}

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ targetStockNumber: '', targetStockName: '', reason: '' })

function resetForm() {
  formRef.value?.clearValidate()
  form.targetStockNumber = ''
  form.targetStockName = ''
  form.reason = ''
}

async function handleConfirm() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await props.doTransfer(props.taskId, {
      targetStockNumber: form.targetStockNumber.trim(),
      targetStockName: form.targetStockName.trim() || undefined,
      reason: form.reason.trim() || undefined,
      clientRequestId: `${props.taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
    ElMessage.success('转仓成功')
    visible.value = false
    resetForm()
    emit('success')
  } catch (e: any) {
    ElMessage.error(e?.message || e?.data?.message || '转仓失败')
  } finally {
    loading.value = false
  }
}
</script>
