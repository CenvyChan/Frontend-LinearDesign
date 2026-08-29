<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  ERP_SOURCE_NOTICE_WATERMARK_FLOOR,
  createErpSourceNoticeCursor,
  getErpSourceNoticeCursors,
  getErpSourceNoticeFormIds,
  runErpSourceNoticeCursor,
  setErpSourceNoticeSyncEnabled,
  updateErpSourceNoticeWatermark,
  type ErpSourceNoticeCursorItem,
  type ErpSourceNoticeFormIdItem,
} from '#/api/erpSourceNotice';
import { getErpAccounts, getOrganizations, type ErpAcctOption, type ErpOrganization } from '#/api/erpData';

defineOptions({ name: 'ErpUpstreamSyncConfig' });

const loading = ref(false);
const runningId = ref(0);
const togglingId = ref(0);
const cursors = ref<ErpSourceNoticeCursorItem[]>([]);
const formIdOptions = ref<ErpSourceNoticeFormIdItem[]>([]);
const acctOptions = ref<ErpAcctOption[]>([]);
const orgOptions = ref<ErpOrganization[]>([]);
const acctFilter = ref('');

const createVisible = ref(false);
const createSaving = ref(false);
const createForm = reactive({
  erpAcctCode: '',
  erpOrgNumber: '',
  formId: '',
  lastModifyTime: '',
});

/**
 * el-date-picker 的 value-format，直接产出后端要的 `ISO_LOCAL_DATE_TIME`。
 *
 * 刻意让 picker 生成格式而不是让用户手写：后端那个「T 分隔 / 不带时区 / 毫秒可选」的形状
 * 是内部水位比较协议（纯 String.compareTo）的产物，不该暴露成人机界面。
 * 手写时最常见的两种错法——带 `Z` 与照抄文档里表示可选的方括号 `[.SSS]`——都会被后端拒。
 *
 * 不含毫秒：picker 精度到秒，后端 ISO_LOCAL_DATE_TIME 放行 0 位小数秒。需要精确到毫秒
 * （同一毫秒内多张单据靠 FID 续跑）时走「手动填毫秒」逃生舱。
 */
const WATERMARK_VALUE_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

const watermarkVisible = ref(false);
const watermarkSaving = ref(false);
/** true = 手填精确水位（可带毫秒），false = 时间选择器。默认走选择器。 */
const watermarkRawMode = ref(false);
const watermarkForm = reactive({ id: 0, label: '', lastModifyTime: '', lastFid: 0 });

/**
 * `responseReturn: 'body'` 的拦截器对任意 2xx 原样返回，**不会在 success:false 时 reject**。
 * 所有调用点都必须走这个判定，否则业务错误（水位格式不对、游标重复）会被静默吞掉。
 */
function ok(res: { message?: string; success: boolean }, fallback: string): boolean {
  if (res?.success) {
    return true;
  }
  ElMessage.error(res?.message || fallback);
  return false;
}

async function loadCursors() {
  loading.value = true;
  try {
    const res = await getErpSourceNoticeCursors(acctFilter.value || undefined);
    if (ok(res, '加载同步游标失败')) {
      cursors.value = res.data ?? [];
    }
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const [formIds, accounts] = await Promise.all([getErpSourceNoticeFormIds(), getErpAccounts()]);
  if (ok(formIds, '加载单据类型失败')) {
    formIdOptions.value = formIds.data ?? [];
  }
  if (accounts?.success) {
    acctOptions.value = accounts.data ?? [];
    const preferred = accounts.defaultAcctCode || acctOptions.value[0]?.acctCode || '';
    createForm.erpAcctCode = preferred;
    await loadOrganizations(preferred);
  }
}

async function loadOrganizations(acctCode: string) {
  if (!acctCode) {
    orgOptions.value = [];
    return;
  }
  const res = await getOrganizations(acctCode);
  if (res?.success) {
    orgOptions.value = res.data ?? [];
  }
}

function openCreate() {
  createForm.erpOrgNumber = orgOptions.value[0]?.erpOrgNumber ?? '';
  createForm.formId = formIdOptions.value[0]?.formId ?? '';
  createForm.lastModifyTime = '';
  createVisible.value = true;
}

async function submitCreate() {
  if (!createForm.erpAcctCode || !createForm.erpOrgNumber || !createForm.formId) {
    ElMessage.warning('账套、组织与单据类型均为必填');
    return;
  }
  createSaving.value = true;
  try {
    const res = await createErpSourceNoticeCursor({
      erpAcctCode: createForm.erpAcctCode,
      erpOrgNumber: createForm.erpOrgNumber,
      formId: createForm.formId,
      lastModifyTime: createForm.lastModifyTime || undefined,
    });
    if (ok(res, '新建同步游标失败')) {
      ElMessage.success('同步游标已创建，可点「立即同步」拉取存量');
      createVisible.value = false;
      await loadCursors();
    }
  } finally {
    createSaving.value = false;
  }
}

function openWatermark(row: ErpSourceNoticeCursorItem) {
  watermarkForm.id = row.id;
  watermarkForm.label = `${row.erpAcctCode} / ${row.erpOrgNumber} / ${row.formLabel}`;
  watermarkForm.lastModifyTime = row.lastModifyTime ?? '';
  watermarkForm.lastFid = row.lastFid ?? 0;
  // 现有水位带毫秒时直接进手填模式：picker 精度到秒，交给它会把毫秒静默抹掉，
  // 而水位是「大于」比较，抹掉毫秒会让同一秒内已同步的单据被重复拉一遍。
  watermarkRawMode.value = watermarkForm.lastModifyTime.includes('.');
  watermarkVisible.value = true;
}

function resetWatermarkToFloor() {
  watermarkForm.lastModifyTime = ERP_SOURCE_NOTICE_WATERMARK_FLOOR;
  watermarkForm.lastFid = 0;
  // FLOOR 带 .000，picker 显示不了，切到手填模式保持所见即所得
  watermarkRawMode.value = true;
}

async function submitWatermark() {
  watermarkSaving.value = true;
  try {
    const res = await updateErpSourceNoticeWatermark(watermarkForm.id, {
      lastModifyTime: watermarkForm.lastModifyTime || undefined,
      lastFid: watermarkForm.lastFid,
    });
    if (ok(res, '更新水位失败')) {
      ElMessage.success('水位已更新');
      watermarkVisible.value = false;
      await loadCursors();
    }
  } finally {
    watermarkSaving.value = false;
  }
}

async function handleToggle(row: ErpSourceNoticeCursorItem, next: boolean) {
  togglingId.value = row.id;
  try {
    const res = await setErpSourceNoticeSyncEnabled(row.id, next);
    if (ok(res, '切换同步开关失败')) {
      row.syncEnabled = next;
      ElMessage.success(next ? '已启用定时同步' : '已暂停定时同步');
    } else {
      // 后端拒绝时把开关拨回去，否则界面显示的状态与库里不一致。
      row.syncEnabled = !next;
    }
  } finally {
    togglingId.value = 0;
  }
}

async function handleRun(row: ErpSourceNoticeCursorItem) {
  await ElMessageBox.confirm(
    `将从水位 ${row.lastModifyTime || '(空)'} 开始，最多拉取 5 轮（每轮 200 张）。`,
    `立即同步 ${row.formLabel}`,
    { confirmButtonText: '开始同步', cancelButtonText: '取消', type: 'info' },
  );
  runningId.value = row.id;
  try {
    const res = await runErpSourceNoticeCursor(row.id, 5);
    if (ok(res, '同步失败')) {
      const result = res.data;
      ElMessage.success(
        `同步完成：${result.rounds} 轮、${result.processedDocuments} 张单据、${result.processedLines} 行`,
      );
      await loadCursors();
    }
  } finally {
    runningId.value = 0;
  }
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

onMounted(async () => {
  await loadOptions();
  await loadCursors();
});
</script>

<template>
  <section v-loading="loading" class="config-section">
    <div class="section-title">
      <div>
        <h2>ERP 上游单据同步</h2>
        <p>
          按「账套 + 组织 + 单据类型」维护同步游标。定时器只遍历已存在且已启用的游标，
          没有游标行的组织不会被同步；水位留空表示从 1970 起拉全量。
        </p>
      </div>
      <div class="section-actions">
        <el-select
          v-model="acctFilter"
          class="acct-filter"
          clearable
          placeholder="全部账套"
          @change="loadCursors"
        >
          <el-option v-for="acct in acctOptions" :key="acct.acctCode" :label="acct.acctCode" :value="acct.acctCode" />
        </el-select>
        <el-button round :loading="loading" @click="loadCursors">重新加载</el-button>
        <el-button type="primary" round @click="openCreate">新建游标</el-button>
      </div>
    </div>

    <el-table :data="cursors" border stripe size="small">
      <el-table-column prop="erpAcctCode" label="账套" width="110" />
      <el-table-column prop="erpOrgNumber" label="组织编码" width="110" />
      <el-table-column label="单据类型" min-width="180">
        <template #default="{ row }">
          <div>{{ row.formLabel }}</div>
          <div class="cell-sub">{{ row.formId }}</div>
        </template>
      </el-table-column>
      <el-table-column label="定时同步" width="100">
        <template #default="{ row }">
          <el-switch
            :model-value="row.syncEnabled"
            :loading="togglingId === row.id"
            @update:model-value="(next: boolean | number | string) => handleToggle(row, Boolean(next))"
          />
        </template>
      </el-table-column>
      <el-table-column label="当前水位" min-width="200">
        <template #default="{ row }">
          <div>{{ row.lastModifyTime || '-' }}</div>
          <div class="cell-sub">FID {{ row.lastFid ?? 0 }}</div>
        </template>
      </el-table-column>
      <el-table-column label="最近成功" min-width="160">
        <template #default="{ row }">{{ formatTime(row.lastSuccessTime) }}</template>
      </el-table-column>
      <el-table-column label="最近错误" min-width="200">
        <template #default="{ row }">
          <el-tooltip v-if="row.lastError" :content="row.lastError" placement="top">
            <el-tag type="danger" effect="plain">有错误</el-tag>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openWatermark(row)">改水位</el-button>
          <el-button link type="primary" :loading="runningId === row.id" @click="handleRun(row)">立即同步</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <div class="empty-hint">
          还没有任何同步游标 —— 这就是「MES 端看不到上游单据」的原因。点右上角「新建游标」。
        </div>
      </template>
    </el-table>

    <el-dialog v-model="createVisible" title="新建同步游标" width="520px">
      <el-form label-width="110px">
        <el-form-item label="账套" required>
          <el-select v-model="createForm.erpAcctCode" filterable @change="loadOrganizations">
            <el-option v-for="acct in acctOptions" :key="acct.acctCode" :label="acct.acctCode" :value="acct.acctCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="组织" required>
          <el-select v-model="createForm.erpOrgNumber" filterable>
            <el-option
              v-for="org in orgOptions"
              :key="org.erpOrgNumber"
              :label="`${org.erpOrgNumber} - ${org.erpOrgName}`"
              :value="org.erpOrgNumber"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="单据类型" required>
          <el-select v-model="createForm.formId">
            <el-option v-for="item in formIdOptions" :key="item.formId" :label="item.label" :value="item.formId" />
          </el-select>
        </el-form-item>
        <el-form-item label="起始水位">
          <el-date-picker
            v-model="createForm.lastModifyTime"
            type="datetime"
            placeholder="留空 = 从 1970 拉全量"
            :value-format="WATERMARK_VALUE_FORMAT"
            :clearable="true"
          />
          <div class="form-hint">
            只同步这个时间之后修改的单据。留空拉全部历史。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="createVisible = false">取消</el-button>
        <el-button type="primary" round :loading="createSaving" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="watermarkVisible" title="调整同步水位" width="520px">
      <el-form label-width="110px">
        <el-form-item label="游标">
          <span>{{ watermarkForm.label }}</span>
        </el-form-item>
        <el-form-item label="水位时间">
          <el-date-picker
            v-if="!watermarkRawMode"
            v-model="watermarkForm.lastModifyTime"
            type="datetime"
            placeholder="选择时间"
            :value-format="WATERMARK_VALUE_FORMAT"
            :clearable="true"
          />
          <el-input
            v-else
            v-model="watermarkForm.lastModifyTime"
            placeholder="2026-05-01T00:00:00.427"
          />
          <div class="form-hint">
            <el-button link type="primary" @click="resetWatermarkToFloor">重置到 1970（重拉全量）</el-button>
            <el-button link type="primary" @click="watermarkRawMode = !watermarkRawMode">
              {{ watermarkRawMode ? '用时间选择器' : '手动填毫秒' }}
            </el-button>
          </div>
          <div v-if="watermarkRawMode" class="form-hint">
            本地时间、<strong>不带 Z 或时区偏移</strong>。带 Z 会让 ERP 侧放行但 MES 侧全部滤掉
            （同步 0 条且不报错）。毫秒位数不限，可直接粘列表里的当前水位。
          </div>
        </el-form-item>
        <el-form-item label="水位 FID">
          <el-input-number v-model="watermarkForm.lastFid" :min="0" :controls="false" />
          <div class="form-hint">
            同一时间戳内有多张单据时，从这个 FID 之后继续。改时间通常填 0。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="watermarkVisible = false">取消</el-button>
        <el-button type="primary" round :loading="watermarkSaving" @click="submitWatermark">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style lang="scss" scoped>
.config-section {
  padding: 4px 0;
}

.section-title {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 {
    margin: 0 0 4px;
    color: var(--el-text-color-primary);
    font-size: 16px;
    font-weight: 600;
  }

  p {
    max-width: 720px;
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
  }
}

.section-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
}

.acct-filter {
  width: 160px;
}

.cell-sub {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.form-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.empty-hint {
  padding: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
