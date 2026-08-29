<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage } from 'element-plus';
import { useAccessStore } from '@vben/stores';

import {
  buildMaterialDocumentPrintEvidence,
  createMaterialDocumentPrintJob,
  getMaterialDocumentPrintCapability,
  getMaterialDocumentPrintHistory,
  type MaterialDocumentPrintCapability,
  type MaterialDocumentPrintHistory,
} from '#/api/materialDocument';
import {
  generateMaterialDocumentOnlyOfficeToken,
  getMaterialDocumentOnlyOfficeConfig,
} from '#/api/materialDocument';
import { createOnlyOfficePreviewSource } from '#/api/onlyoffice';
import {
  generateOnlyOfficeToken as generateMouldOnlyOfficeToken,
  getOnlyOfficeConfig as getMouldOnlyOfficeConfig,
} from '#/api/mould';
import {
  generateOnlyOfficeToken as generateProcessOnlyOfficeToken,
  getOnlyOfficeConfig as getProcessOnlyOfficeConfig,
} from '#/api/production';
import { openControlledPrintWindow, renderControlledPrintJob } from '#/utils/controlledPrint';
import { canPreviewInBrowser, canPreviewInOnlyOffice, normalizeFileExt } from '#/utils/documentPreview';
import {
  attachOnlyOfficeToken,
  buildOnlyOfficeEditorConfig,
  isOnlyOfficeJwt,
} from '#/utils/onlyofficePreview';

defineOptions({ name: 'UtilsDocumentPreview' });

type PreviewSource = 'material-document' | 'mould-document' | 'process-route-document';

const route = useRoute();
const accessStore = useAccessStore();
const loading = ref(true);
const message = ref('正在加载预览...');
const editor = ref<any>(null);
const printCapability = ref<MaterialDocumentPrintCapability | null>(null);
const printHistory = ref<MaterialDocumentPrintHistory | null>(null);
const printLoading = ref(false);

const queryValue = (key: string) => {
  const value = route.query[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
};

const fileUrl = computed(() => queryValue('url'));
const fileName = computed(() => queryValue('fileName') || 'document');
const fileExt = computed(() => normalizeFileExt(queryValue('fileExt') || fileName.value.split('.').pop()));
const documentId = computed(() => queryValue('documentId'));
const source = computed<PreviewSource>(() => {
  const value = queryValue('source');
  if (value === 'mould-document' || value === 'process-route-document') return value;
  return 'material-document';
});
const isImagePreview = computed(() => ['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(fileExt.value));
const isBrowserPreview = computed(() => canPreviewInBrowser(fileExt.value));
const isOnlyOfficePreview = computed(() => canPreviewInOnlyOffice(fileExt.value));
const canDownload = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes('production:bom-document:download'));
const canPrint = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes('production:bom-document:print'));
const printSourceType = computed(() => source.value === 'material-document' ? 'MATERIAL_DOCUMENT_VERSION' : source.value.toUpperCase().replaceAll('-', '_'));
const printEvidence = computed(() => buildMaterialDocumentPrintEvidence(printHistory.value, printCapability.value));
const latestPrintRecord = computed(() => printEvidence.value.latestRecord);
const printDisabledReason = computed(() => {
  if (!canPrint.value) return '当前账号没有受控打印权限';
  if (!documentId.value) return '缺少文档版本信息，无法受控打印';
  if (!printCapability.value) return '正在读取打印额度';
  if (!printCapability.value.printable) return printCapability.value.unavailableReason || '当前文件暂不支持受控打印';
  return '';
});

function configApi() {
  if (source.value === 'mould-document') return getMouldOnlyOfficeConfig;
  if (source.value === 'process-route-document') return getProcessOnlyOfficeConfig;
  return getMaterialDocumentOnlyOfficeConfig;
}

function tokenApi() {
  if (source.value === 'mould-document') return generateMouldOnlyOfficeToken;
  if (source.value === 'process-route-document') return generateProcessOnlyOfficeToken;
  return generateMaterialDocumentOnlyOfficeToken;
}

function unwrapResponse(res: any) {
  return res?.data ?? res;
}

function formatPrintTime(value?: number) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function loadScript(documentServerUrl: string) {
  if ((window as any).DocsAPI) return;
  const scriptId = 'onlyoffice-api-script';
  const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('OnlyOffice script load failed')), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${documentServerUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OnlyOffice script load failed'));
    document.body.appendChild(script);
  });
}

async function buildEditorConfig(jwtEnabled: boolean, sourceUrl: string) {
  const config = buildOnlyOfficeEditorConfig({
    documentId: documentId.value,
    fileExt: fileExt.value,
    fileName: fileName.value,
    source: source.value,
    sourceUrl,
  });
  if (!jwtEnabled) return config;

  const tokenRes = await tokenApi()(config);
  const tokenBody = unwrapResponse(tokenRes);
  if (!isOnlyOfficeJwt(tokenBody?.token)) {
    throw new Error('OnlyOffice 安全令牌格式无效，请联系文档服务器管理员。');
  }
  return attachOnlyOfficeToken(config, tokenBody.token);
}

async function initPreview() {
  console.info('[DocumentPreview] init', {
    ext: fileExt.value,
    fileName: fileName.value,
    source: source.value,
    url: fileUrl.value,
  });
  if (!fileUrl.value) {
    message.value = '文件地址缺失，请返回原页面下载查看。';
    loading.value = false;
    return;
  }
  try {
    await Promise.all([loadPrintCapability(), loadPrintHistory()]);
    if (isBrowserPreview.value) {
      message.value = '';
      return;
    }
    if (!isOnlyOfficePreview.value) {
      message.value = '当前文件类型不支持在线预览，请下载后查看。';
      return;
    }
    const previewDocumentId = Number(documentId.value);
    if (!Number.isSafeInteger(previewDocumentId) || previewDocumentId <= 0) {
      message.value = '缺少受控预览所需的文档标识，请返回原页面下载查看。';
      return;
    }
    console.info('[DocumentPreview] loading OnlyOffice config', source.value);
    const rawConfig = await configApi()();
    const config = unwrapResponse(rawConfig);
    console.info('[DocumentPreview] OnlyOffice config loaded', {
      enabled: !!config?.enabled,
      hasDocumentServerUrl: !!config?.documentServerUrl,
      jwtEnabled: !!config?.jwtEnabled,
    });
    if (!config?.enabled || !config?.documentServerUrl) {
      message.value = 'OnlyOffice 未启用或未配置文档服务地址，请下载查看。';
      return;
    }
    const previewSource = unwrapResponse(await createOnlyOfficePreviewSource({
      documentId: previewDocumentId,
      source: source.value,
    }));
    if (!previewSource?.sourceUrl) {
      throw new Error('OnlyOffice 预览源地址签发失败，请下载查看。');
    }
    console.info('[DocumentPreview] loading OnlyOffice script', config.documentServerUrl);
    await loadScript(config.documentServerUrl);
    if (!(window as any).DocsAPI?.DocEditor) {
      throw new Error('OnlyOffice DocsAPI.DocEditor is unavailable after script loaded');
    }
    await nextTick();
    const editorConfig = await buildEditorConfig(!!config.jwtEnabled, previewSource.sourceUrl);
    console.info('[DocumentPreview] creating OnlyOffice editor', {
      documentType: editorConfig.documentType,
      fileType: editorConfig.document?.fileType,
      hasToken: !!editorConfig.token,
    });
    editor.value = new (window as any).DocsAPI.DocEditor('onlyoffice-preview-container', editorConfig);
    message.value = '';
  } catch (error: any) {
    message.value = error?.message || 'OnlyOffice 预览加载失败，请下载查看。';
    ElMessage.error(message.value);
  } finally {
    loading.value = false;
  }
}

async function loadPrintCapability() {
  if (!canPrint.value || !documentId.value) {
    return;
  }
  try {
    printCapability.value = await getMaterialDocumentPrintCapability(printSourceType.value, documentId.value);
  } catch (error) {
    console.error(error);
    printCapability.value = {
      fileExt: fileExt.value,
      maxPrintCount: 0,
      printable: false,
      remainingPrintCount: 0,
      unavailableReason: '读取打印额度失败',
      usedPrintCount: 0,
    };
  }
}

async function loadPrintHistory() {
  if (!canPrint.value || !documentId.value) {
    return;
  }
  try {
    printHistory.value = await getMaterialDocumentPrintHistory(printSourceType.value, documentId.value);
  } catch (error) {
    console.error(error);
    printHistory.value = null;
  }
}

async function handleControlledPrint() {
  if (printDisabledReason.value || !documentId.value) {
    ElMessage.warning(printDisabledReason.value || '无法受控打印');
    return;
  }
  printLoading.value = true;
  let printWindow: Window | null = null;
  try {
    printWindow = openControlledPrintWindow();
    const job = await createMaterialDocumentPrintJob(printSourceType.value, documentId.value);
    await renderControlledPrintJob(printWindow, job);
    await Promise.all([loadPrintCapability(), loadPrintHistory()]);
  } catch (error: any) {
    console.error(error);
    try {
      printWindow?.close?.();
    } catch {
      // ignore close errors from popup blockers or already closed windows
    }
    ElMessage.error(error?.message || '创建受控打印任务失败');
  } finally {
    printLoading.value = false;
  }
}

onMounted(() => {
  void initPreview();
});

onBeforeUnmount(() => {
  try {
    editor.value?.destroyEditor?.();
  } catch {
    // ignore destroy errors from OnlyOffice iframe teardown
  }
});
</script>

<template>
  <div class="document-preview-page">
    <div class="document-preview-toolbar">
      <span>{{ fileName }}</span>
      <div class="document-preview-actions">
        <el-tag v-if="printCapability" size="small" type="info">
          剩余打印 {{ printCapability.remainingPrintCount }}/{{ printCapability.maxPrintCount }}
        </el-tag>
        <el-button
          type="primary"
          :icon="'Printer'"
          :loading="printLoading"
          :disabled="Boolean(printDisabledReason)"
          @click="handleControlledPrint"
        >
          受控打印
        </el-button>
        <el-button v-if="fileUrl && canDownload" tag="a" :href="fileUrl" target="_blank" :icon="'Download'">
          下载原件
        </el-button>
      </div>
    </div>
    <div v-if="printHistory || printCapability" class="document-print-evidence">
      <div class="print-evidence-summary">
        <div>
          <span>总额度</span>
          <strong>{{ printEvidence.maxPrintCount }}</strong>
        </div>
        <div>
          <span>已打印</span>
          <strong>{{ printEvidence.usedPrintCount }}</strong>
        </div>
        <div>
          <span>剩余额度</span>
          <strong>{{ printEvidence.remainingPrintCount }}</strong>
        </div>
      </div>
      <div class="print-evidence-latest">
        <template v-if="latestPrintRecord">
          <span>最近一次打印证明</span>
          <strong>{{ latestPrintRecord.printerName }}</strong>
          <span>{{ formatPrintTime(latestPrintRecord.printTime) }}</span>
          <el-tag size="small" type="success">第 {{ latestPrintRecord.printCount }} 次</el-tag>
        </template>
        <template v-else>
          <span>最近一次打印证明</span>
          <strong>暂无打印记录</strong>
        </template>
      </div>
      <div v-if="printEvidence.records.length" class="print-history-list">
        <div v-for="item in printEvidence.records" :key="item.jobNo" class="print-history-row">
          <span>{{ item.printerName }}</span>
          <span>{{ formatPrintTime(item.printTime) }}</span>
          <span>第 {{ item.printCount }} 次</span>
          <span>{{ item.printCount }}/{{ item.maxPrintCount }}</span>
        </div>
      </div>
    </div>
    <div class="document-preview-body">
      <div v-if="loading || message" class="document-preview-state">
        {{ message }}
      </div>
      <img v-if="!loading && !message && isImagePreview" class="browser-image-preview" :src="fileUrl" :alt="fileName" />
      <iframe
        v-else-if="!loading && !message && isBrowserPreview"
        class="browser-file-preview"
        :src="fileUrl"
        :title="fileName"
      ></iframe>
      <div v-show="isOnlyOfficePreview" id="onlyoffice-preview-container" class="onlyoffice-preview-container"></div>
    </div>
  </div>
</template>

<style scoped>
.document-preview-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.document-preview-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--el-border-color);
  font-size: 14px;
  font-weight: 600;
}

.document-preview-toolbar span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-preview-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.document-print-evidence {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  grid-template-columns: minmax(260px, 360px) minmax(260px, 1fr);
}

.print-evidence-summary,
.print-evidence-latest,
.print-history-list {
  min-width: 0;
}

.print-evidence-summary {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.print-evidence-summary div {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.print-evidence-summary span,
.print-evidence-latest span,
.print-history-row span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.print-evidence-summary strong {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.1;
}

.print-evidence-latest {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.print-evidence-latest strong {
  color: var(--el-text-color-primary);
}

.print-history-list {
  display: grid;
  gap: 6px;
  grid-column: 1 / -1;
}

.print-history-row {
  display: grid;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  grid-template-columns: minmax(80px, 1fr) minmax(150px, 1.2fr) minmax(72px, 0.7fr) minmax(64px, 0.6fr);
}

.document-preview-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.document-preview-state {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.onlyoffice-preview-container {
  width: 100%;
  height: 100%;
}

.browser-file-preview,
.browser-image-preview {
  width: 100%;
  height: 100%;
  border: 0;
}

.browser-image-preview {
  object-fit: contain;
  background: var(--el-fill-color-lighter);
}

@media (max-width: 900px) {
  .document-preview-toolbar,
  .document-preview-actions,
  .print-evidence-latest {
    align-items: stretch;
    flex-direction: column;
  }

  .document-preview-actions {
    width: 100%;
  }

  .document-print-evidence,
  .print-evidence-summary,
  .print-history-row {
    grid-template-columns: 1fr;
  }
}
</style>
