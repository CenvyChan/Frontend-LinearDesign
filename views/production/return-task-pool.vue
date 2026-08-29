<template>
  <div class="return-task-pool-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <span>退料处理池</span>
          <div class="header-actions">
            <el-button size="small" @click="loadSummary" :loading="loading" :icon="'Refresh'">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        title="仓库与检验在退料处理池按物料汇总处理退料申请，MES 只跟踪 ERP 审批与检验结论。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom:12px"
      />

      <el-table :data="summaryList" v-loading="loading" border size="small" row-key="materialCode" max-height="620" empty-text="暂无退料任务">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border size="small" max-height="320">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="退料量" width="90" align="right" />
              <el-table-column prop="warehouseNumber" label="退料仓库" width="120" />
              <el-table-column prop="sourceQrToken" label="来源条码A" min-width="150" show-overflow-tooltip />
              <el-table-column label="ERP状态" width="110">
                <template #default="{ row: task }">
                  <el-tag :type="returnTaskStatusType(task.taskStatus)" size="small">{{ returnTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="检验状态" width="120">
                <template #default="{ row: task }">
                  {{ returnInspectionStatusText(task.inspectionStatus) }}
                </template>
              </el-table-column>
              <el-table-column label="申请时间" min-width="140">
                <template #default="{ row: task }">
                  {{ formatTime(task.createTime) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="340" fixed="right">
                <template #default="{ row: task }">
                  <el-button size="small" type="primary" @click="handlePreview(task)" :disabled="!['APPLIED','FAILED'].includes(task.taskStatus)" :icon="'View'">预览</el-button>
                  <el-button size="small" type="success" @click="handleSubmit(task)" :disabled="!['APPLIED','PREVIEWED','FAILED'].includes(task.taskStatus)" :icon="'Check'">提交ERP</el-button>
                  <el-button size="small" @click="handleQueryStatus(task)" :disabled="!task.erpBillId" :icon="'Refresh'">查状态</el-button>
                  <el-button size="small" type="warning" @click="openInspection(task)" :disabled="task.erpBillStatus !== 'APPROVED'">检验</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="totalRequestQty" label="待处理总量" width="110" align="right" />
        <el-table-column prop="taskCount" label="关联任务数" width="100" align="center" />
        <el-table-column label="最早申请时间" min-width="140">
          <template #default="{ row }">
            {{ formatTime(row.earliestApplyTime) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="previewDialogVisible" title="ERP生产退料单预览" width="80%">
      <div v-if="previewData?.result">
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="ERP单号">{{ previewData.erpBillNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ERP内码">{{ previewData.erpBillId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据状态">{{ previewData.documentStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据日期">{{ previewData.billDate || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="previewData.result.Entity || []" border size="small" max-height="360" style="margin-top:12px">
          <el-table-column prop="Seq" label="序号" width="60" />
          <el-table-column label="物料编码" min-width="120">
            <template #default="{ row }">{{ row.MaterialId?.Number || '-' }}</template>
          </el-table-column>
          <el-table-column label="物料名称" min-width="140">
            <template #default="{ row }">{{ row.MaterialId?.Name?.[0]?.Value || '-' }}</template>
          </el-table-column>
          <el-table-column prop="APPQty" label="申请数" width="100" align="right" />
          <el-table-column prop="Qty" label="退料数" width="100" align="right" />
          <el-table-column label="仓库" min-width="120">
            <template #default="{ row }">{{ row.StockId?.Name?.[0]?.Value || '-' }}</template>
          </el-table-column>
          <el-table-column label="批号" min-width="120">
            <template #default="{ row }">{{ row.Lot?.Number || row.Lot_Text || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else style="color:#909399;padding:16px 0">暂无ERP草稿单数据</div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectionDialogVisible" title="退料检验结果" width="520px">
      <el-form :model="inspectionForm" label-width="110px" size="small">
        <el-form-item label="检验结论">
          <el-select v-model="inspectionForm.inspectionStatus" style="width:100%">
            <el-option label="合格返库" value="INSPECT_PASS_RETURN_TO_STOCK" />
            <el-option label="不合格报废" value="INSPECT_FAIL_TO_SCRAP" />
            <el-option label="来料不良退供方" value="INSPECT_FAIL_TO_VENDOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="检验员">
          <el-input v-model="inspectionForm.inspectorName" />
        </el-form-item>
        <el-form-item label="来源分类">
          <el-input v-model="inspectionForm.sourceCategory" placeholder="如：供方来料不良/上道工序来料不良" />
        </el-form-item>
        <el-form-item label="返库仓库">
          <el-input v-model="inspectionForm.targetWarehouseNumber" placeholder="仓库编码" />
        </el-form-item>
        <el-form-item label="返库仓库名称">
          <el-input v-model="inspectionForm.targetWarehouseName" />
        </el-form-item>
        <el-form-item label="报废去向">
          <el-input v-model="inspectionForm.scrapTarget" />
        </el-form-item>
        <el-form-item label="供应商去向">
          <el-input v-model="inspectionForm.vendorTarget" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="inspectionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="inspectionSubmitting" @click="submitInspection" :icon="'Check'">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { resolveStatus } from '#/shared/status/statusDictionary'
import {
  getReturnTaskMaterialSummary,
  previewReturnBill,
  submitReturnBill,
  getReturnErpStatus,
  submitReturnInspectionResult,
  type ReturnTaskItem,
  type ReturnTaskMaterialSummaryItem,
} from '@/api/production'

type InspectionStatus = Parameters<typeof submitReturnInspectionResult>[1]['inspectionStatus']

const loading = ref(false)
const summaryList = ref<ReturnTaskMaterialSummaryItem[]>([])
const previewDialogVisible = ref(false)
const inspectionDialogVisible = ref(false)
const inspectionSubmitting = ref(false)
const currentTask = ref<ReturnTaskItem | null>(null)
const previewData = ref<any>(null)
const inspectionForm = reactive<{
  inspectionStatus: InspectionStatus
  inspectorName: string
  sourceCategory: string
  targetWarehouseNumber: string
  targetWarehouseName: string
  scrapTarget: string
  vendorTarget: string
  remark: string
}>({
  inspectionStatus: 'INSPECT_PASS_RETURN_TO_STOCK',
  inspectorName: '',
  sourceCategory: '',
  targetWarehouseNumber: '',
  targetWarehouseName: '',
  scrapTarget: '',
  vendorTarget: '',
  remark: '',
})

onMounted(() => {
  loadSummary()
})

async function loadSummary() {
  loading.value = true
  try {
    const res = await getReturnTaskMaterialSummary()
    if (res.success) {
      summaryList.value = res.data || []
    }
  } finally {
    loading.value = false
  }
}

async function handlePreview(task: ReturnTaskItem) {
  try {
    const res = await previewReturnBill(task.id)
    if (showMappingPrompt(res)) return
    if (res.success) {
      currentTask.value = task
      previewData.value = res.data
      previewDialogVisible.value = true
      await loadSummary()
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || 'ERP退料预览失败')
  }
}

async function handleSubmit(task: ReturnTaskItem) {
  try {
    const res = await submitReturnBill(task.id)
    if (showMappingPrompt(res)) return
    if (res.success) {
      ElMessage.success(res.message || 'ERP退料单已提交')
      await loadSummary()
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || '提交ERP退料单失败')
  }
}

async function handleQueryStatus(task: ReturnTaskItem) {
  try {
    const res = await getReturnErpStatus(task.id)
    if (res.success) {
      ElMessage.success('ERP状态已同步')
      await loadSummary()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '查询ERP状态失败')
  }
}

function openInspection(task: ReturnTaskItem) {
  currentTask.value = task
  inspectionForm.inspectionStatus = task.inspectionStatus === 'INSPECT_FAIL_TO_SCRAP' || task.inspectionStatus === 'INSPECT_FAIL_TO_VENDOR'
    ? task.inspectionStatus
    : 'INSPECT_PASS_RETURN_TO_STOCK'
  inspectionForm.inspectorName = task.inspectorName || ''
  inspectionForm.sourceCategory = task.inspectionSourceCategory || ''
  inspectionForm.targetWarehouseNumber = task.targetWarehouseNumber || ''
  inspectionForm.targetWarehouseName = task.targetWarehouseName || ''
  inspectionForm.scrapTarget = task.scrapTarget || ''
  inspectionForm.vendorTarget = task.vendorTarget || ''
  inspectionForm.remark = task.inspectionRemark || ''
  inspectionDialogVisible.value = true
}

async function submitInspection() {
  if (!currentTask.value) return
  inspectionSubmitting.value = true
  try {
    const res = await submitReturnInspectionResult(currentTask.value.id, { ...inspectionForm })
    if (res.success) {
      ElMessage.success(res.message || '检验结果已提交')
      inspectionDialogVisible.value = false
      await loadSummary()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '提交检验结果失败')
  } finally {
    inspectionSubmitting.value = false
  }
}

function returnTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'returnStatus', status)
}

function returnTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREVIEWED: 'primary',
    SUBMITTED: 'primary',
    APPROVING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TERMINATED: 'info',
    INSPECTING: 'warning',
    INSPECTED: 'success',
    CLOSED: 'info',
    FAILED: 'danger',
  }
  return map[status] || 'info'
}

function returnInspectionStatusText(status?: string) {
  return resolveStatus('inspection', 'returnStatus', status)
}

function formatTime(ts?: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

function showMappingPrompt(payload: any) {
  const data = payload?.response?.data || payload?.data || payload
  if (!data || data.success !== false || !data.missingRole) {
    return false
  }
  const orgText = [data.erpOrgNumber, data.erpOrgName].filter(Boolean).join(' / ') || '通用'
  ElMessageBox.alert(
    `${data.message || '当前用户缺少ERP人员映射'}\n\n角色：${data.missingRoleText || data.missingRole}\nERP组织编码：${orgText}\n维护入口：系统管理 > MES 职责与数据范围`,
    '缺少ERP人员映射',
    { type: 'warning' },
  )
  return true
}
</script>

<style scoped>
.return-task-pool-page {
  padding: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>
