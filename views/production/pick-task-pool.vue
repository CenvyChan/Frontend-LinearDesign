<template>
  <div class="pick-task-pool-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <span>备料任务池</span>
          <div class="header-actions">
            <el-button size="small" type="warning" :disabled="selectedSummaries.length === 0" @click="handleBatchPrepare">&#27719;&#24635;&#22791;&#26009;&#24320;&#22987;</el-button>
            <el-button size="small" type="primary" :disabled="selectedSummaries.length === 0" @click="handleBatchIssue" :icon="'Check'">汇总发料</el-button>
            <el-button size="small" @click="loadSummary" :loading="loading" :icon="'Refresh'">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        title="仓库按默认发料仓库与物料汇总处理备料任务；展开后查看具体工单申请明细，用于先进先出和优先级分配。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom:12px"
      />

      <el-table
        :data="summaryRows"
        v-loading="loading"
        border
        size="small"
        row-key="summaryKey"
        max-height="620"
        empty-text="暂无备料任务"
        @selection-change="handleSummarySelectionChange"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border size="small" max-height="280">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="申请量" width="90" align="right" />
              <el-table-column prop="reservedQty" label="占用量" width="90" align="right" />
              <el-table-column prop="priorityLevel" label="优先级" width="80" align="center" />
              <el-table-column prop="applyUserName" label="申请人" width="100" />
              <el-table-column label="状态" width="100">
                <template #default="{ row: task }">
                  <el-tag :type="pickTaskStatusType(task.taskStatus)" size="small">{{ pickTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="申请时间" min-width="140">
                <template #default="{ row: task }">
                  {{ formatTime(task.createTime) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="{ row: task }">
                  <div class="task-action-cell">
                    <el-button size="small" type="primary" @click="handlePrepare(task)" :disabled="!['APPLIED','PREPARING'].includes(task.taskStatus)" :icon="'Check'">备料</el-button>
                    <el-button size="small" type="success" @click="handleIssue(task)" :disabled="!canIssueTask(task)" :icon="'Check'">发料</el-button>
                    <el-button size="small" @click="handleSyncStatus(task)" :disabled="!task.erpBillId" :icon="'Refresh'">查状态</el-button>
                    <el-button size="small" type="danger" @click="handleClose(task)" :disabled="['SUBMITTED','CLOSED'].includes(task.taskStatus)">关闭</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="defaultStockNumber" label="默认发料仓库" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDefaultStock(row) }}</template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="totalReservedQty" label="待备总量" width="100" align="right" />
        <el-table-column prop="taskCount" label="关联任务数" width="100" align="center" />
        <el-table-column prop="highestPriority" label="最高优先级" width="100" align="center" />
        <el-table-column label="最早申请时间" min-width="140">
          <template #default="{ row }">
            {{ formatTime(row.earliestApplyTime) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="issueDialogVisible" title="ERP生产领料单预览" width="80%">
      <el-alert
        v-if="currentIssueTasks.length > 1"
        title="当前预览由多条备料任务合并生成，ERP请求报文会在后端日志输出。"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom:12px"
      />
      <div v-if="issuePreview?.result">
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="ERP单号">{{ issuePreview.erpBillNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ERP内码">{{ issuePreview.erpBillId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据状态">{{ issuePreview.documentStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单据日期">{{ issuePreview.billDate || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="issuePreview.result.Entity || []" border size="small" max-height="360" style="margin-top:12px">
          <el-table-column prop="Seq" label="序号" width="60" />
          <el-table-column label="物料编码" min-width="120">
            <template #default="{ row }">{{ row.MaterialId?.Number || '-' }}</template>
          </el-table-column>
          <el-table-column label="物料名称" min-width="140">
            <template #default="{ row }">{{ row.MaterialId?.Name?.[0]?.Value || '-' }}</template>
          </el-table-column>
          <el-table-column prop="AppQty" label="申请数" width="100" align="right" />
          <el-table-column prop="ActualQty" label="实发数" width="100" align="right" />
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
        <el-button @click="issueDialogVisible = false">关闭</el-button>
        <el-button :disabled="!currentIssueTasks.length" @click="handleRollback" :icon="'ArrowLeft'">回滚草稿</el-button>
        <el-button type="primary" :loading="issueSubmitting" :disabled="!currentIssueTasks.length" @click="handleSubmitIssue" :icon="'Check'">提交到ERP</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { resolveStatus } from '#/shared/status/statusDictionary'
import {
  getPickTaskMaterialSummary,
  closePickTask,
  preparePickTask,
  previewIssueBill,
  previewIssueBillsBatch,
  submitIssueBill,
  submitIssueBillsBatch,
  rollbackIssueBill,
  rollbackIssueBillsBatch,
  getPickErpStatus,
  type PickTaskItem,
  type PickTaskMaterialSummaryItem,
} from '@/api/production'

const loading = ref(false)
const summaryList = ref<PickTaskMaterialSummaryItem[]>([])
const selectedSummaries = ref<PickTaskMaterialSummaryItem[]>([])
const issueDialogVisible = ref(false)
const issueSubmitting = ref(false)
const currentIssueTasks = ref<PickTaskItem[]>([])
const issuePreview = ref<any>(null)

const summaryRows = computed(() => summaryList.value.map((item) => ({
  ...item,
  summaryKey: `${item.materialCode || ''}|${item.defaultStockNumber || ''}`,
})))

onMounted(() => {
  loadSummary()
})

async function loadSummary() {
  loading.value = true
  try {
    const res = await getPickTaskMaterialSummary()
    if (res.success) {
      summaryList.value = res.data || []
    }
  } finally {
    loading.value = false
  }
}

function handleSummarySelectionChange(rows: PickTaskMaterialSummaryItem[]) {
  selectedSummaries.value = rows
}

function canIssueTask(task: PickTaskItem) {
  return ['PREPARING', 'PREPARED', 'ISSUING'].includes(task.taskStatus)
}

function canPrepareTask(task: PickTaskItem) {
  return ['APPLIED', 'PREPARING'].includes(task.taskStatus)
}

function formatDefaultStock(row: PickTaskMaterialSummaryItem) {
  if (row.defaultStockNumber || row.defaultStockName) {
    return [row.defaultStockNumber, row.defaultStockName].filter(Boolean).join(' / ')
  }
  return '未获取'
}

async function handleBatchPrepare() {
  const taskMap = new Map<number, PickTaskItem>()
  selectedSummaries.value
    .flatMap((item) => item.tasks || [])
    .filter(canPrepareTask)
    .forEach((task) => taskMap.set(task.id, task))
  const tasks = Array.from(taskMap.values())
  if (tasks.length === 0) {
    ElMessage.warning('\u9009\u4e2d\u7684\u6c47\u603b\u884c\u6ca1\u6709\u53ef\u5f00\u59cb\u5907\u6599\u7684\u4efb\u52a1')
    return
  }
  try {
    for (const task of tasks) {
      await preparePickTask(task.id)
    }
    ElMessage.success(`\u5df2\u5f00\u59cb\u5907\u6599 ${tasks.length} \u6761\u4efb\u52a1`)
    await loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.message || '\u6c47\u603b\u5907\u6599\u5931\u8d25')
  }
}

async function handleBatchIssue() {
  const tasks = selectedSummaries.value.flatMap((item) => item.tasks || []).filter(canIssueTask)
  if (tasks.length === 0) {
    ElMessage.warning('选中的汇总行没有可发料任务')
    return
  }
  try {
    const res = await previewIssueBillsBatch(tasks.map((task) => task.id))
    if (showMappingPrompt(res)) return
    if (res.success) {
      currentIssueTasks.value = tasks
      issuePreview.value = res.data
      issueDialogVisible.value = true
      await loadSummary()
    } else {
      ElMessage.error(res.message || 'ERP汇总发料预览失败')
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || 'ERP汇总发料预览失败')
  }
}

async function handlePrepare(task: PickTaskItem) {
  try {
    await preparePickTask(task.id)
    ElMessage.success('任务已进入备料状态')
    await loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.message || '开始备料失败')
  }
}

async function handleIssue(task: PickTaskItem) {
  try {
    const res = await previewIssueBill(task.id)
    if (showMappingPrompt(res)) return
    if (res.success) {
      currentIssueTasks.value = [task]
      issuePreview.value = res.data
      issueDialogVisible.value = true
      await loadSummary()
    } else {
      ElMessage.error(res.message || 'ERP发料预览失败')
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || 'ERP发料预览失败')
  }
}

async function handleSubmitIssue() {
  if (!currentIssueTasks.value.length) return
  issueSubmitting.value = true
  try {
    const taskIds = currentIssueTasks.value.map((task) => task.id)
    const taskId = taskIds[0]
    if (taskId === undefined) return
    const res = taskIds.length > 1
      ? await submitIssueBillsBatch(taskIds)
      : await submitIssueBill(taskId, { preview: issuePreview.value })
    if (showMappingPrompt(res)) return
    if (res.success) {
      ElMessage.success(res.message || '生产领料单已提交')
      issueDialogVisible.value = false
      currentIssueTasks.value = []
      issuePreview.value = null
      await loadSummary()
    } else {
      ElMessage.error(res.message || '提交生产领料单失败')
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || '提交生产领料单失败')
  } finally {
    issueSubmitting.value = false
  }
}

async function handleRollback() {
  if (!currentIssueTasks.value.length) return
  try {
    const taskIds = currentIssueTasks.value.map((task) => task.id)
    const taskId = taskIds[0]
    if (taskId === undefined) return
    if (taskIds.length > 1) {
      await rollbackIssueBillsBatch(taskIds)
    } else {
      await rollbackIssueBill(taskId)
    }
    ElMessage.success('ERP草稿单已回滚')
    issueDialogVisible.value = false
    currentIssueTasks.value = []
    issuePreview.value = null
    await loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.message || '回滚ERP草稿单失败')
  }
}

async function handleSyncStatus(task: PickTaskItem) {
  try {
    const res = await getPickErpStatus(task.id)
    if (res.success) {
      ElMessage.success('ERP状态已同步')
      await loadSummary()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '查询ERP状态失败')
  }
}

async function handleClose(task: PickTaskItem) {
  try {
    await ElMessageBox.confirm(`确认关闭工单 ${task.orderNo} 的备料任务？`, '关闭任务', { type: 'warning' })
    await closePickTask(task.id)
    ElMessage.success('任务已关闭')
    await loadSummary()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '关闭任务失败')
    }
  }
}

function pickTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'pickStatus', status)
}

function pickTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREPARING: 'warning',
    PREPARED: 'success',
    ISSUING: 'primary',
    SUBMITTED: 'success',
    APPROVING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TERMINATED: 'info',
    CLOSED: 'info',
    FAILED: 'danger',
  }
  return map[status] || 'info'
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
.pick-task-pool-page {
  padding: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions,
.task-action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.task-action-cell .el-button + .el-button {
  margin-left: 0;
}
</style>
