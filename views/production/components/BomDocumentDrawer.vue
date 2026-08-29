<script lang="ts" setup>
import { computed } from 'vue';

import {
  getMaterialDocumentFileUrl,
  getMaterialDocumentVersionDownloadUrl,
  type MaterialDocumentItem,
  type MaterialDocumentType,
  type MaterialDocumentVersion,
} from '#/api/materialDocument';
import { openDocumentPreview } from '#/utils/documentPreview';

defineOptions({ name: 'BomDocumentDrawer' });

const props = defineProps<{
  canMaintainDocuments: boolean;
  canDownloadDocuments: boolean;
  documentType: MaterialDocumentType | null;
  documents: MaterialDocumentItem[];
  history: any[];
  loading: boolean;
  materialCode: string;
  materialName: string;
  mode: 'maintain' | 'query';
  modelValue: boolean;
}>();

const emit = defineEmits<{
  addDocument: [type: MaterialDocumentType];
  uploadVersion: [item: MaterialDocumentItem];
  voidVersion: [version: MaterialDocumentVersion];
  'update:modelValue': [value: boolean];
}>();

const drawerVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const drawerTitle = computed(() => `图文档资料 - ${props.materialCode || ''}`);

const versionById = computed(() => {
  const map = new Map<number, MaterialDocumentVersion>();
  props.documents.forEach((item) => {
    item.versions?.forEach((version) => {
      map.set(version.id, version);
    });
  });
  return map;
});

function isProcessType(type?: MaterialDocumentType | null) {
  return type?.typeCode === 'PROCESS';
}

function isReadonlyDocumentItem(item?: MaterialDocumentItem | null) {
  return Boolean(item?.readonly || item?.sourceType === 'PROCESS_ROUTE_DOCUMENT' || item?.documentTypeCode === 'PROCESS');
}

function formatFileSize(size?: number) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function actionLabel(action?: string) {
  const labels: Record<string, string> = {
    CREATE: '新建',
    VERSION: '升版',
    VOID: '作废资料',
    VOID_VERSION: '作废文件',
    RESTORE: '恢复',
  };
  if (!action) {
    return '-';
  }
  return `${labels[action] || '变更'}（${action}）`;
}

function historyVersion(log: any) {
  return log?.versionId ? versionById.value.get(Number(log.versionId)) ?? null : null;
}

async function openHistoryVersion(log: any) {
  const version = historyVersion(log);
  if (version) {
    await previewVersion(version);
  }
}

function handleAddDocument() {
  if (props.documentType) {
    emit('addDocument', props.documentType);
  }
}

async function previewVersion(version: MaterialDocumentVersion) {
  await openDocumentPreview({
    documentId: version.id,
    fileExt: version.fileExt,
    fileName: version.fileName,
    source: version.sourceType === 'PROCESS_ROUTE_DOCUMENT' ? 'process-route-document' : 'material-document',
    url: version.sourceType === 'PROCESS_ROUTE_DOCUMENT'
      ? getMaterialDocumentFileUrl(version.filePath)
      : getMaterialDocumentVersionDownloadUrl('MATERIAL_DOCUMENT_VERSION', version.id),
  });
}

function downloadVersion(version: MaterialDocumentVersion) {
  const link = document.createElement('a');
  link.href = version.sourceType === 'PROCESS_ROUTE_DOCUMENT'
    ? getMaterialDocumentFileUrl(version.filePath)
    : getMaterialDocumentVersionDownloadUrl('MATERIAL_DOCUMENT_VERSION', version.id);
  link.download = version.fileName;
  link.click();
}

</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    size="58%"
    :title="drawerTitle"
    destroy-on-close
  >
    <div v-loading="loading" class="document-drawer">
      <div class="drawer-toolbar">
        <div>
          <strong>{{ materialName || '-' }}</strong>
          <el-tag v-if="documentType" size="small" type="info">{{ documentType.typeName }}</el-tag>
        </div>
        <el-button
          v-if="mode === 'maintain' && canMaintainDocuments && documentType && !isProcessType(documentType)"
          type="primary"
          size="small"
          :icon="'Plus'"
          @click="handleAddDocument"
        >
          新增资料
        </el-button>
      </div>

      <el-alert
        v-if="mode === 'maintain' && isProcessType(documentType)"
        type="info"
        show-icon
        :closable="false"
        title="工艺资料来源于工艺路线工序文档，请到工艺路线维护界面更新。"
      />

      <el-empty v-if="documents.length === 0" description="暂无资料" />
      <div v-for="item in documents" :key="item.id" class="document-item">
        <div class="document-item-head">
          <div>
            <strong>{{ item.documentName }}</strong>
            <el-tag size="small" type="info">{{ item.documentTypeName }}</el-tag>
            <el-tag v-if="item.sourceType === 'PROCESS_ROUTE_DOCUMENT'" size="small" type="success">
              来源：工艺路线 / 工序 {{ item.stepNo }} {{ item.stepName }}
            </el-tag>
          </div>
          <div v-if="mode === 'maintain' && canMaintainDocuments && !isReadonlyDocumentItem(item)" class="document-item-actions">
            <el-button
              size="small"
              type="primary"
              plain
              :icon="'Upload'"
              @click="emit('uploadVersion', item)"
            >
              上传新版本
            </el-button>
          </div>
        </div>
        <el-table :data="item.versions" border size="small">
          <el-table-column
            v-if="item.sourceType === 'PROCESS_ROUTE_DOCUMENT'"
            prop="stepNo"
            label="工序号"
            width="90"
          />
          <el-table-column
            v-if="item.sourceType === 'PROCESS_ROUTE_DOCUMENT'"
            prop="stepName"
            label="工序名称"
            width="130"
            show-overflow-tooltip
          />
          <el-table-column label="版本" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isLatest ? 'success' : 'info'" size="small">{{ row.systemVersion }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="externalVersion" label="外部版本" width="120" show-overflow-tooltip />
          <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column prop="uploaderName" label="上传者" width="110" />
          <el-table-column prop="changeReason" label="变更说明" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="132" align="center">
            <template #default="{ row }">
              <div class="version-actions">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  circle
                  :icon="'View'"
                  title="预览"
                  aria-label="预览"
                  @click="previewVersion(row)"
                />
                <el-button
                  v-if="canDownloadDocuments"
                  size="small"
                  plain
                  circle
                  :icon="'Download'"
                  title="下载"
                  aria-label="下载"
                  @click="downloadVersion(row)"
                />
                <el-button
                  v-if="mode === 'maintain' && canMaintainDocuments && !row.readonly && row.sourceType !== 'PROCESS_ROUTE_DOCUMENT'"
                  size="small"
                  type="danger"
                  plain
                  circle
                  :icon="'Delete'"
                  title="作废"
                  aria-label="作废"
                  @click="emit('voidVersion', row)"
                />
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-divider>变更历史</el-divider>
      <el-timeline>
        <el-timeline-item
          v-for="log in history"
          :key="log.id"
          :timestamp="log.operateTime ? new Date(log.operateTime).toLocaleString() : ''"
        >
          <div class="history-entry">
            <span class="history-operator">{{ log.operatorName || '-' }}</span>
            <span class="history-action">{{ actionLabel(log.action) }}</span>
            <el-button
              v-if="historyVersion(log)"
              link
              type="primary"
              class="history-document-link"
              @click="openHistoryVersion(log)"
            >
              {{ log.documentName || historyVersion(log)?.fileName || '-' }}
            </el-button>
            <span v-else class="history-document-name">{{ log.documentName || '-' }}</span>
            <el-tag v-if="log.systemVersion" size="small" type="info">{{ log.systemVersion }}</el-tag>
            <span v-if="log.changeReason" class="history-reason">{{ log.changeReason }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>
  </el-drawer>
</template>

<style lang="scss" scoped>
.document-drawer {
  .drawer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .document-item {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 4px;
  }

  .document-item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .document-item-actions {
    display: flex;
    gap: 8px;
    flex-wrap: nowrap;
  }

  .version-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: nowrap;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    line-height: 1.6;
  }

  .history-operator,
  .history-action {
    color: var(--el-text-color-primary, #303133);
    font-weight: 500;
  }

  .history-document-link {
    padding: 0;
  }

  .history-document-name,
  .history-reason {
    color: var(--el-text-color-secondary, #606266);
  }
}

</style>
