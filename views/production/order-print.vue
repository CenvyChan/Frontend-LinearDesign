<template>
  <div class="print-container">
    <div class="no-print" style="text-align:center;padding:12px;background:#f5f5f5;margin-bottom:16px">
      <el-button type="primary" @click="handlePrint" size="large" :icon="'Printer'">打印</el-button>
      <el-button @click="handleClose" size="large" style="margin-left:12px">关闭</el-button>
      <span style="margin-left:20px;color:#909399;font-size:13px">打印份数：
        <el-input-number v-model="printCopies" :min="1" :max="10" size="small" style="width:100px" />
      </span>
    </div>

    <div v-if="loading" style="text-align:center;padding:60px;color:#909399">加载中...</div>

    <div v-else id="printContent" class="print-content">
      <!-- 标题 -->
      <div class="print-title">生产工单流转卡</div>
      <div class="print-order-no">工单编号: {{ orderInfo?.orderNo || '' }}</div>

      <!-- 工单基本信息 -->
      <table class="print-table">
        <tr>
          <td class="label">产品编码</td>
          <td class="value">{{ orderInfo?.productCode || '' }}</td>
          <td class="label">产品名称</td>
          <td class="value">{{ orderInfo?.productName || '' }}</td>
        </tr>
        <tr>
          <td class="label">计划数量</td>
          <td class="value">{{ orderInfo?.planQty ?? '-' }}</td>
          <td class="label">已完数量</td>
          <td class="value">{{ orderInfo?.completedQty ?? '-' }}</td>
        </tr>
        <tr>
          <td class="label">工艺路线</td>
          <td class="value" colspan="3">{{ routeInfo?.routeName || '' }} ({{ routeInfo?.version || '' }})</td>
        </tr>
      </table>

      <!-- 工序流转卡列表 -->
      <div class="section-title">工序流转</div>
      <table class="print-table print-table-steps">
        <thead>
          <tr>
            <th style="width:50px">序号</th>
            <th>工序名称</th>
            <th style="width:80px">工时</th>
            <th style="width:80px">状态</th>
            <th style="width:80px">完成数</th>
            <th style="width:80px">操作员</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in flowCards" :key="item.id">
            <td style="text-align:center">{{ item.stepNo }}</td>
            <td>{{ item.stepName }}<span v-if="item.stepType==='INSPECTION'" style="color:#e6a23c;margin-left:4px">[检验]</span></td>
            <td style="text-align:center">{{ formatStandardHours(item) }}</td>
            <td style="text-align:center">{{ flowStatusText(item.flowStatus) }}</td>
            <td style="text-align:center">{{ item.actualQuantity ?? '-' }}</td>
            <td style="text-align:center">{{ item.operatorName || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- 用料清单 -->
      <div v-if="materialList.length > 0" class="section-title">用料清单</div>
      <table v-if="materialList.length > 0" class="print-table print-table-material">
        <thead>
          <tr>
            <th>物料编码</th>
            <th>物料名称</th>
            <th>规格型号</th>
            <th style="width:70px">标准用量</th>
            <th style="width:70px">应发数量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in materialList" :key="idx">
            <td>{{ item.materialCode }}</td>
            <td>{{ item.materialName }}</td>
            <td>{{ item.specification }}</td>
            <td style="text-align:center">{{ item.stdBomQty ?? '-' }}</td>
            <td style="text-align:center">{{ item.stdReqQty ?? '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- 二维码区域 -->
      <div class="qrcode-section">
        <div class="qrcode-box" v-if="qrCodeUrl">
          <img :src="qrCodeUrl" alt="工单二维码" style="width:120px;height:120px" />
          <div style="font-size:11px;color:#666;margin-top:4px">扫码查看工单详情及工艺文件</div>
        </div>
        <div class="order-summary">
          <div>工单编号: {{ orderInfo?.orderNo || '' }}</div>
          <div>产品名称: {{ orderInfo?.productName || '' }}</div>
          <div>计划数量: {{ orderInfo?.planQty ?? '' }}</div>
          <div>打印时间: {{ printTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  ensureLocalOrder,
  getFlowCards,
  getMaterialList,
  getOrderQrCodeUrl,
  getOrderSteps,
  type FlowCardItem,
  type MaterialUsageItem,
} from '#/api/production';

defineOptions({ name: 'ProductionOrderPrint' });

const route = useRoute();
const orderNo = String(route.params.id);
const moEntrySeq = ref(Number(route.query.moEntrySeq) || 1);
const prdOrgId = ref(route.query.prdOrgId ? String(route.query.prdOrgId) : '');
const erpAcctCode = String(route.query.erpAcctCode || route.query.acctCode || '');
const prdOrgNumber = String(route.query.prdOrgNumber || '');
const workshopNumber = String(route.query.workshopNumber || '');

const loading = ref(true);
const orderInfo = ref<any>(null);
const routeInfo = ref<any>(null);
const flowCards = ref<FlowCardItem[]>([]);
const materialList = ref<MaterialUsageItem[]>([]);
const qrCodeUrl = ref('');
const printCopies = ref(1);
const printTime = ref('');

onMounted(async () => {
  printTime.value = new Date().toLocaleString();
  try {
    const localResp: any = await ensureLocalOrder({
      orderNo,
      erpAcctCode: erpAcctCode || undefined,
      prdOrgNumber,
      workshopNumber,
    });
    const localOrder = localResp?.data ?? localResp;
    if (!localOrder || !localOrder.id) {
      ElMessage.error(localResp?.message || '无法获取工单信息');
      loading.value = false;
      return;
    }
    const localId = localOrder.id;
    orderInfo.value = localOrder;

    // 尝试加载工艺路线信息 (getOrderSteps uses baseRequestClient, returns full body)
    try {
      const stepsRes: any = await getOrderSteps(localId);
      if (stepsRes?.success && stepsRes?.data) {
        routeInfo.value = {
          routeName: stepsRes.data.routeName,
          version: stepsRes.data.routeVersion || stepsRes.data.version,
          routeStatus: stepsRes.data.routeStatus,
          stepCount: stepsRes.data.totalSteps || stepsRes.data.stepCount,
        };
      }
    } catch {
      // ignore
    }

    // getFlowCards uses requestClient (auto-extract data)
    try {
      const flows: any = await getFlowCards(localId);
      flowCards.value = flows?.data ?? (Array.isArray(flows) ? flows : []) ?? [];
    } catch {
      flowCards.value = [];
    }

    if (moEntrySeq.value > 0) {
      try {
        const mats: any = await getMaterialList({
          moBillNo: orderNo,
          moEntrySeq: moEntrySeq.value,
          prdOrgId: prdOrgId.value || undefined,
        });
        materialList.value = mats?.data ?? (Array.isArray(mats) ? mats : []) ?? [];
      } catch {
        materialList.value = [];
      }
    }

    // 二维码
    qrCodeUrl.value = getOrderQrCodeUrl(localId) + '?t=' + Date.now();
  } catch (e: any) {
    console.error('加载打印数据失败', e);
    ElMessage.error('加载数据失败: ' + (e.message || '未知错误'));
  } finally {
    loading.value = false;
  }
});

function formatStandardHours(row: FlowCardItem): string {
  if (!row.standardHours || row.standardHours <= 0) return '未设置';
  let seconds = row.standardHours;
  if (row.timeUnit === 'MINUTE') seconds = row.standardHours * 60;
  else if (row.timeUnit === 'HOUR') seconds = row.standardHours * 3600;
  if (row.completeQuantity && row.completeQuantity > 0) {
    const secPerItem = seconds / row.completeQuantity;
    if (secPerItem < 1) return '< 1秒/个';
    return Math.round(secPerItem) + '秒/个';
  }
  return seconds + '秒';
}

function flowStatusText(s: string) {
  const map: Record<string, string> = {
    PENDING: '待开始',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    SKIPPED: '已跳过',
  };
  return map[s] || s;
}

function handlePrint() {
  window.print();
}

function handleClose() {
  window.close();
}
</script>

<style scoped>
.print-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

.print-content {
  background: #fff;
  padding: 24px 32px;
  border: 1px solid #ddd;
}

.print-title {
  text-align: center;
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 4px;
}

.print-order-no {
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: bold;
  margin: 16px 0 8px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}

.print-table td,
.print-table th {
  border: 1px solid #000;
  padding: 6px 10px;
  font-size: 13px;
}

.print-table .label {
  width: 100px;
  background: #f9f9f9;
  font-weight: 500;
  text-align: right;
  padding-right: 12px;
}

.print-table .value {
  text-align: left;
}

.print-table-steps th,
.print-table-material th {
  background: #f0f0f0;
  font-weight: bold;
  text-align: center;
}

.qrcode-section {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  border-top: 1px dashed #ccc;
  padding-top: 16px;
}

.qrcode-box {
  text-align: center;
}

.order-summary {
  font-size: 13px;
  line-height: 1.8;
  color: #333;
}

/* 打印样式 */
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 12mm;
  }

  .no-print {
    display: none !important;
  }

  .print-container {
    max-width: 100%;
    padding: 0;
    margin: 0;
  }

  .print-content {
    border: none;
    padding: 0;
  }

  .print-table td,
  .print-table th {
    border-color: #000;
  }

  .qrcode-section {
    page-break-inside: avoid;
  }

  .print-table-steps {
    page-break-inside: auto;
  }

  .print-table-steps tr {
    page-break-inside: avoid;
  }
}
</style>
