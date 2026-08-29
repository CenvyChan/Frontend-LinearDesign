<template>
  <div class="feed-task-pool-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <span>补料任务池</span>
          <div class="header-actions">
            <el-button size="small" @click="loadSummary" :loading="loading" :icon="'Refresh'">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        title="补料任务默认生成 ERP 生产补料单 PRD_FeedMtrl；预览默认走下推后保存，必要时可改用直接关联保存。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom:12px"
      />

      <el-table :data="summaryList" v-loading="loading" border size="small" row-key="materialCode" max-height="620" empty-text="暂无补料任务">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.tasks || []" border size="small" max-height="320">
              <el-table-column prop="orderNo" label="工单号" width="130" />
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="requestQty" label="补料量" width="90" align="right" />
              <el-table-column prop="preparedQty" label="备料量" width="90" align="right" />
              <el-table-column prop="reasonText" label="补料原因" min-width="160" show-overflow-tooltip />
              <el-table-column prop="applyUserName" label="申请人" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row: task }">
                  <el-tag :type="feedTaskStatusType(task.taskStatus)" size="small">{{ feedTaskStatusText(task.taskStatus) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpBillNo" label="ERP单号" width="130" />
              <el-table-column label="申请时间" min-width="140">
                <template #default="{ row: task }">{{ formatTime(task.createTime) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="330" fixed="right">
                <template #default="{ row: task }">
                  <div class="task-action-cell">
                    <el-button size="small" type="primary" @click="handlePrepare(task)" :disabled="!['APPLIED','PREPARING'].includes(task.taskStatus)" :icon="'Check'">备料</el-button>
                    <el-button size="small" type="success" @click="handlePreview(task)" :disabled="!['PREPARING','PREPARED','FAILED'].includes(task.taskStatus)" :icon="'View'">预览</el-button>
                    <el-button size="small" @click="handlePreview(task, 'SAVE')" :disabled="!['PREPARING','PREPARED','FAILED'].includes(task.taskStatus)" :icon="'Check'">直接保存</el-button>
                    <el-button size="small" type="warning" @click="handleSubmit(task)" :disabled="!task.erpBillId" :icon="'Check'">提交</el-button>
                    <el-button size="small" @click="handleQueryStatus(task)" :disabled="!task.erpBillId" :icon="'Refresh'">查状态</el-button>
                    <el-button size="small" type="danger" @click="handleRollback(task)" :disabled="!task.erpBillId" :icon="'ArrowLeft'">回滚</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialSpecification" label="规格型号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="defaultStockNumber" label="默认仓库" width="120" />
        <el-table-column prop="totalRequestQty" label="待补总量" width="110" align="right" />
        <el-table-column prop="taskCount" label="任务数" width="90" align="center" />
        <el-table-column label="最早申请时间" min-width="140">
          <template #default="{ row }">{{ formatTime(row.earliestApplyTime) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="previewDialogVisible" title="ERP生产补料单预览" width="80%">
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
          <el-table-column prop="ActualQty" label="补料数量" width="100" align="right" />
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { resolveStatus } from '#/shared/status/statusDictionary'
import {
  getFeedTaskMaterialSummary,
  prepareFeedTask,
  previewFeedBill,
  submitFeedBill,
  rollbackFeedBill,
  getFeedErpStatus,
  type FeedTaskItem,
  type FeedTaskMaterialSummaryItem,
} from '@/api/production'

const loading = ref(false)
const summaryList = ref<FeedTaskMaterialSummaryItem[]>([])
const previewDialogVisible = ref(false)
const previewData = ref<any>(null)

onMounted(() => {
  loadSummary()
})

async function loadSummary() {
  loading.value = true
  try {
    const res = await getFeedTaskMaterialSummary()
    if (res.success) {
      summaryList.value = res.data || []
    }
  } finally {
    loading.value = false
  }
}

async function handlePrepare(task: FeedTaskItem) {
  try {
    await prepareFeedTask(task.id)
    ElMessage.success('补料任务已进入备料状态')
    await loadSummary()
  } catch (e: any) {
    ElMessage.error(e?.message || '开始备料失败')
  }
}

async function handlePreview(task: FeedTaskItem, mode?: 'SAVE') {
  try {
    const res = await previewFeedBill(task.id, mode)
    if (showMappingPrompt(res)) return
    if (res.success) {
      previewData.value = res.data
      previewDialogVisible.value = true
      await loadSummary()
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || 'ERP补料预览失败')
  }
}

async function handleSubmit(task: FeedTaskItem) {
  try {
    const res = await submitFeedBill(task.id)
    if (showMappingPrompt(res)) return
    if (res.success) {
      ElMessage.success(res.message || '生产补料单已提交')
      await loadSummary()
    }
  } catch (e: any) {
    if (showMappingPrompt(e)) return
    ElMessage.error(e?.message || '提交ERP补料单失败')
  }
}

async function handleRollback(task: FeedTaskItem) {
  try {
    await ElMessageBox.confirm(`确认回滚补料草稿单 ${task.erpBillNo || task.id}？`, '回滚补料单', { type: 'warning' })
    await rollbackFeedBill(task.id)
    ElMessage.success('ERP补料单已回滚')
    await loadSummary()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '回滚ERP补料单失败')
    }
  }
}

async function handleQueryStatus(task: FeedTaskItem) {
  try {
    const res = await getFeedErpStatus(task.id)
    if (res.success) {
      ElMessage.success('ERP状态已同步')
      await loadSummary()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '查询ERP状态失败')
  }
}

function feedTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'feedStatus', status)
}

function feedTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREPARING: 'warning',
    PREPARED: 'success',
    PREVIEWED: 'primary',
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
.feed-task-pool-page {
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
