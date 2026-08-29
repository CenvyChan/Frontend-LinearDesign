<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useAccessStore } from '@vben/stores';
import {
  getMaterialDocumentHistory,
  getMaterialDocumentSummary,
  getMaterialDocuments,
  getMaterialDocumentTypes,
  previewMaterialDocumentExport,
  submitMaterialDocumentExport,
  uploadMaterialDocument,
  uploadMaterialDocumentVersion,
  voidMaterialDocumentVersion,
  type DocumentSummaryCell,
  type ExportPreview,
  type MaterialDocumentItem,
  type MaterialDocumentType,
  type MaterialDocumentVersion,
} from '#/api/materialDocument';
import type { BomTreeNode } from '#/api/bom';
import BomDocumentDrawer from '#/views/production/components/BomDocumentDrawer.vue';
import {
  bomDocumentMaterialCode,
  bomDocumentMaterialName,
  buildBomDocumentMaterialNodes,
  buildBomDocumentTreeRows,
  flattenBomDocumentTree,
} from './bom-document-model';

defineOptions({ name: 'BomDocumentStep' });

const props = defineProps<{
  mode: 'maintain' | 'query';
  rootNode: BomTreeNode | null;
}>();

const emit = defineEmits<{
  back: [];
}>();

const accessStore = useAccessStore();

const DOCUMENT_MAINTAIN_PERMISSION = 'production:bom-document:maintain';
const DOCUMENT_EXPORT_PERMISSION = 'production:bom-document:export';
const DOCUMENT_DOWNLOAD_PERMISSION = 'production:bom-document:download';
const canMaintainDocuments = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes(DOCUMENT_MAINTAIN_PERMISSION));
const canExportDocuments = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes(DOCUMENT_EXPORT_PERMISSION));
const canDownloadDocuments = computed(() => accessStore.accessCodes.includes('*') || accessStore.accessCodes.includes(DOCUMENT_DOWNLOAD_PERMISSION));

const documentTypes = ref<MaterialDocumentType[]>([]);
const documentSummary = ref<Record<string, Record<string, DocumentSummaryCell>>>({});
const documentLoading = ref(false);

const documentDrawerVisible = ref(false);
const documentDrawerLoading = ref(false);
const drawerMaterial = ref<BomTreeNode | null>(null);
const drawerDocumentType = ref<MaterialDocumentType | null>(null);
const drawerDocuments = ref<MaterialDocumentItem[]>([]);
const drawerHistory = ref<any[]>([]);

const uploadDialogVisible = ref(false);
const uploadTargetItem = ref<MaterialDocumentItem | null>(null);
const uploadForm = ref({
  documentTypeId: undefined as number | undefined,
  documentName: '',
  externalVersion: '',
  changeReason: '',
  printQuotaPerUser: 2,
  file: null as File | null,
});

const exportDialogVisible = ref(false);
const exportPreview = ref<ExportPreview | null>(null);
const exportSubmitting = ref(false);
const selectedExportFileKeys = ref<string[]>([]);

const documentRows = computed(() => {
  if (!props.rootNode) {
    return [];
  }
  return buildBomDocumentTreeRows(props.rootNode);
});

const documentNodeCount = computed(() => {
  if (!props.rootNode) {
    return 0;
  }
  return flattenBomDocumentTree(props.rootNode).filter((row) => Boolean(materialCodeOf(row))).length;
});

function isProcessType(type?: MaterialDocumentType | null) {
  return type?.typeCode === 'PROCESS';
}

function isReadonlyDocumentItem(item?: MaterialDocumentItem | null) {
  return Boolean(item?.readonly || item?.sourceType === 'PROCESS_ROUTE_DOCUMENT' || item?.documentTypeCode === 'PROCESS');
}

function exportKeyOf(version: MaterialDocumentVersion) {
  return version.exportKey || `M:${version.id}`;
}

function materialCodeOf(row: BomTreeNode) {
  return bomDocumentMaterialCode(row);
}

function materialNameOf(row: BomTreeNode) {
  return bomDocumentMaterialName(row);
}

function exportMaterialNodes(root: BomTreeNode) {
  return buildBomDocumentMaterialNodes(root);
}

watch(
  () => [props.rootNode?.id, props.rootNode?.bomVersion, props.mode],
  async () => {
    if (!props.rootNode) {
      documentSummary.value = {};
      drawerDocuments.value = [];
      drawerHistory.value = [];
      return;
    }
    await loadDocumentStepData();
  },
  { immediate: true },
);

async function ensureDocumentTypes() {
  if (documentTypes.value.length > 0) {
    return;
  }
  documentTypes.value = await getMaterialDocumentTypes(true);
}

async function loadDocumentStepData() {
  if (!props.rootNode) {
    return;
  }
  documentLoading.value = true;
  try {
    await ensureDocumentTypes();
    const nodes = exportMaterialNodes(props.rootNode);
    documentSummary.value = await getMaterialDocumentSummary(
      nodes.map((node) => node.materialCode),
      nodes.map((node) => ({ bomVersion: node.bomVersion, materialCode: node.materialCode })),
    );
  } catch (error) {
    console.error(error);
    ElMessage.error('加载图文档摘要失败');
  } finally {
    documentLoading.value = false;
  }
}

function documentCellCount(row: BomTreeNode, type: MaterialDocumentType) {
  return documentSummary.value[materialCodeOf(row)]?.[type.typeCode]?.count ?? 0;
}

function hasDocumentCell(row: BomTreeNode, type: MaterialDocumentType) {
  const cell = documentSummary.value[materialCodeOf(row)]?.[type.typeCode];
  return cell && cell.count > 0;
}

async function openDocumentDrawer(row: BomTreeNode, type?: MaterialDocumentType) {
  drawerMaterial.value = row;
  drawerDocumentType.value = type ?? null;
  documentDrawerVisible.value = true;
  documentDrawerLoading.value = true;
  try {
    const materialCode = materialCodeOf(row);
    const docs = await getMaterialDocuments(materialCode, row.bomVersion);
    drawerDocuments.value = type ? docs.filter((doc) => doc.documentTypeCode === type.typeCode) : docs;
    drawerHistory.value = await getMaterialDocumentHistory(materialCode);
  } catch (error) {
    console.error(error);
    ElMessage.error('加载资料详情失败');
  } finally {
    documentDrawerLoading.value = false;
  }
}

function openUploadDialog(type?: MaterialDocumentType, item?: MaterialDocumentItem) {
  if (isProcessType(type) || isReadonlyDocumentItem(item)) {
    ElMessage.warning('工艺资料来源于工艺路线工序文档，请到工艺路线维护界面更新。');
    return;
  }
  uploadTargetItem.value = item ?? null;
  uploadForm.value = {
    documentTypeId: type?.id,
    documentName: item?.documentName ?? '',
    externalVersion: '',
    changeReason: '',
    printQuotaPerUser: item?.versions?.[0]?.printQuotaPerUser ?? 2,
    file: null,
  };
  uploadDialogVisible.value = true;
}

function onUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadForm.value.file = input.files?.[0] ?? null;
}

async function submitUpload() {
  const material = drawerMaterial.value;
  const file = uploadForm.value.file;
  if (!material || !file) {
    ElMessage.warning('请选择文件');
    return;
  }
  if (!uploadForm.value.changeReason.trim()) {
    ElMessage.warning('请填写变更说明');
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('externalVersion', uploadForm.value.externalVersion || '');
  formData.append('changeReason', uploadForm.value.changeReason);
  formData.append('printQuotaPerUser', String(Math.max(0, Number(uploadForm.value.printQuotaPerUser) || 0)));
  try {
    if (uploadTargetItem.value) {
      await uploadMaterialDocumentVersion(uploadTargetItem.value.id, formData);
    } else {
      if (!uploadForm.value.documentTypeId || !uploadForm.value.documentName.trim()) {
        ElMessage.warning('请选择资料类型并填写资料名称');
        return;
      }
      formData.append('documentTypeId', String(uploadForm.value.documentTypeId));
      formData.append('materialCode', materialCodeOf(material));
      formData.append('materialName', materialNameOf(material));
      formData.append('documentName', uploadForm.value.documentName);
      await uploadMaterialDocument(formData);
    }
    ElMessage.success('保存成功');
    uploadDialogVisible.value = false;
    await openDocumentDrawer(material, drawerDocumentType.value ?? undefined);
    await loadDocumentStepData();
  } catch (error) {
    console.error(error);
    ElMessage.error('保存资料失败');
  }
}

async function handleVoidVersion(version: MaterialDocumentVersion) {
  if (version.readonly || version.sourceType === 'PROCESS_ROUTE_DOCUMENT') {
    ElMessage.warning('工艺资料来源于工艺路线工序文档，请到工艺路线维护界面更新。');
    return;
  }
  const reason = window.prompt('请输入作废原因');
  if (!reason?.trim()) {
    return;
  }
  try {
    await voidMaterialDocumentVersion(version.id, reason);
    ElMessage.success('已作废');
    if (drawerMaterial.value) {
      await openDocumentDrawer(drawerMaterial.value, drawerDocumentType.value ?? undefined);
      await loadDocumentStepData();
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('作废失败');
  }
}

async function openExportDialog(root: BomTreeNode) {
  if (!canExportDocuments.value) {
    ElMessage.warning('当前账号没有导出权限');
    return;
  }
  exportDialogVisible.value = true;
  exportPreview.value = null;
  selectedExportFileKeys.value = [];
  try {
    const nodes = exportMaterialNodes(root);
    const materialCodes = nodes.map((node) => node.materialCode);
    exportPreview.value = await previewMaterialDocumentExport({
      rootMaterialCode: materialCodeOf(root),
      rootMaterialName: materialNameOf(root),
      bomVersion: root.bomVersion,
      materialCodes,
      fileKeys: [],
      materialNodes: nodes,
    });
    selectedExportFileKeys.value = exportPreview.value.items
      .flatMap((item) => item.versions)
      .filter((version) => version.selectedByDefault)
      .map((version) => exportKeyOf(version.version));
  } catch (error) {
    console.error(error);
    ElMessage.error('加载导出预览失败');
  }
}

function toggleExportVersion(fileKey: string, checked: boolean) {
  const set = new Set(selectedExportFileKeys.value);
  if (checked) {
    set.add(fileKey);
  } else {
    set.delete(fileKey);
  }
  selectedExportFileKeys.value = [...set];
}

async function submitExportTask() {
  const root = props.rootNode;
  if (!root || selectedExportFileKeys.value.length === 0) {
    ElMessage.warning('请选择需要导出的版本文件');
    return;
  }
  exportSubmitting.value = true;
  try {
    const nodes = exportMaterialNodes(root);
    await submitMaterialDocumentExport({
      rootMaterialCode: materialCodeOf(root),
      rootMaterialName: materialNameOf(root),
      bomVersion: root.bomVersion,
      materialCodes: nodes.map((node) => node.materialCode),
      fileKeys: selectedExportFileKeys.value,
      materialNodes: nodes,
    });
    ElMessage.success('导出任务已提交，可到文档中心查看');
    exportDialogVisible.value = false;
  } catch (error) {
    console.error(error);
    ElMessage.error('提交导出任务失败');
  } finally {
    exportSubmitting.value = false;
  }
}

</script>

<template>
  <div class="bom-document-step">
    <el-card shadow="never">
      <template #header>
        <div class="step2-header">
          <span class="step-title">图文查询与维护</span>
          <div class="step2-actions">
            <el-tag v-if="rootNode" type="info" size="small">
              {{ materialCodeOf(rootNode) }}
            </el-tag>
            <el-tag :type="mode === 'maintain' ? 'warning' : 'success'" size="small">
              {{ mode === 'maintain' ? '维护模式' : '查询模式' }}
            </el-tag>
            <el-button size="small" :icon="'ArrowLeft'" @click="emit('back')">返回BOM结果</el-button>
            <el-button size="small" :loading="documentLoading" :icon="'Refresh'" @click="loadDocumentStepData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="mode === 'maintain'"
        type="info"
        show-icon
        :closable="false"
        title="维护模式下可新增、升版和作废普通资料；工艺资料来源于工艺路线工序文档，只读展示。"
        style="margin-bottom: 12px"
      />

      <div class="query-summary">
        <template v-if="rootNode">
          <span class="summary-label">根物料：</span>
          <span class="summary-value">{{ materialCodeOf(rootNode) }} {{ materialNameOf(rootNode) }}</span>
          <span class="summary-sep">|</span>
          <span class="summary-label">BOM版本：</span>
          <span class="summary-value">{{ rootNode.bomVersion || '-' }}</span>
        </template>
      </div>

      <div v-if="documentRows.length > 0" class="tree-toolbar">
        <div class="toolbar-row">
          <div class="toolbar-left">
            <el-button size="small" :loading="documentLoading" @click="loadDocumentStepData" :icon="'Refresh'">
              重新加载
            </el-button>
          </div>
          <div class="toolbar-right">
            <span class="toolbar-stat">{{ documentNodeCount }} 个节点</span>
            <span class="toolbar-sep">|</span>
            <span class="toolbar-stat">{{ documentTypes.length }} 类资料</span>
          </div>
        </div>
      </div>

      <el-table
        v-loading="documentLoading"
        :data="documentRows"
        border
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
        height="calc(100vh - 380px)"
        class="document-table bom-document-table"
      >
        <el-table-column label="物料编码" width="210" fixed="left" show-overflow-tooltip>
          <template #default="{ row }">{{ materialCodeOf(row) }}</template>
        </el-table-column>
        <el-table-column label="层级" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isRoot" size="small" type="info">根</el-tag>
            <span v-else>L{{ row.bomLevel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="物料名称" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ materialNameOf(row) }}</template>
        </el-table-column>
        <el-table-column prop="materialModel" label="规格型号" width="150" show-overflow-tooltip />
        <el-table-column label="父项物料" width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.isRoot ? '-' : `${row.parentMaterialNumber || ''} ${row.parentMaterialName || ''}` }}
          </template>
        </el-table-column>
        <el-table-column prop="bomVersion" label="BOM版本" width="150" show-overflow-tooltip />
        <el-table-column
          v-for="type in documentTypes"
          :key="type.id"
          :label="type.typeName"
          width="150"
          align="center"
        >
          <template #default="{ row }">
            <div class="doc-cell-actions">
              <div v-if="hasDocumentCell(row, type)" class="doc-preview-action">
                <el-button
                  type="primary"
                  link
                  size="small"
                  class="doc-icon-button"
                  :icon="'View'"
                  :title="`查看${type.typeName}`"
                  :aria-label="`查看${type.typeName}`"
                  @click="openDocumentDrawer(row, type)"
                />
                <span class="doc-count-chip">{{ documentCellCount(row, type) }}</span>
              </div>
              <el-button
                v-else-if="mode === 'maintain' && canMaintainDocuments && !isProcessType(type)"
                type="warning"
                link
                size="small"
                class="doc-icon-button"
                :icon="'Plus'"
                :title="`新增${type.typeName}`"
                :aria-label="`新增${type.typeName}`"
                @click="openDocumentDrawer(row, type)"
              />
              <span v-else class="text-muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="变更历史" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="info"
              link
              size="small"
              class="doc-icon-button history-icon-button"
              :icon="'CopyDocument'"
              title="查看变更历史"
              aria-label="查看变更历史"
              @click="openDocumentDrawer(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="step-footer">
        <el-button
          size="large"
          type="success"
          plain
          :icon="'Download'"
          :disabled="!rootNode || !canExportDocuments"
          @click="rootNode && openExportDialog(rootNode)"
        >
          导出资料包
        </el-button>
      </div>
    </el-card>

    <BomDocumentDrawer
      v-model="documentDrawerVisible"
      :can-maintain-documents="canMaintainDocuments"
      :can-download-documents="canDownloadDocuments"
      :document-type="drawerDocumentType"
      :documents="drawerDocuments"
      :history="drawerHistory"
      :loading="documentDrawerLoading"
      :material-code="drawerMaterial ? materialCodeOf(drawerMaterial) : ''"
      :material-name="drawerMaterial ? materialNameOf(drawerMaterial) : '-'"
      :mode="mode"
      @add-document="openUploadDialog"
      @upload-version="(item) => openUploadDialog(undefined, item)"
      @void-version="handleVoidVersion"
    />

    <el-dialog v-model="uploadDialogVisible" title="资料维护" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item v-if="!uploadTargetItem" label="资料类型">
          <el-select v-model="uploadForm.documentTypeId" placeholder="请选择资料类型" style="width:100%">
            <el-option v-for="type in documentTypes" :key="type.id" :label="type.typeName" :value="type.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!uploadTargetItem" label="资料名称">
          <el-input v-model="uploadForm.documentName" placeholder="请输入资料名称" />
        </el-form-item>
        <el-form-item label="外部版号">
          <el-input v-model="uploadForm.externalVersion" placeholder="如图纸版次、客户版次" />
        </el-form-item>
        <el-form-item label="每人打印次数">
          <el-input-number
            v-model="uploadForm.printQuotaPerUser"
            :min="0"
            :precision="0"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="变更说明">
          <el-input v-model="uploadForm.changeReason" type="textarea" :rows="3" placeholder="必填，说明本次上传或升版原因" />
        </el-form-item>
        <el-form-item label="文件">
          <input type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.dwg" @change="onUploadFileChange" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUpload">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exportDialogVisible" title="导出资料包" width="760px" destroy-on-close>
      <div v-if="exportPreview" class="export-preview">
        <el-alert type="info" show-icon :closable="false">
          默认已勾选所有最新版本，可展开资料条目选择历史版本。
        </el-alert>
        <div v-for="item in exportPreview.items" :key="item.item.id" class="export-item">
          <div class="export-item-head">
            <strong>{{ item.item.materialCode }} {{ item.item.materialName }}</strong>
            <el-tag size="small">{{ item.item.documentTypeName }}</el-tag>
            <span>{{ item.item.documentName }}</span>
          </div>
          <el-checkbox
            v-for="entry in item.versions"
            :key="exportKeyOf(entry.version)"
            :model-value="selectedExportFileKeys.includes(exportKeyOf(entry.version))"
            @change="(checked: boolean) => toggleExportVersion(exportKeyOf(entry.version), checked)"
          >
            <span v-if="entry.version.sourceType === 'PROCESS_ROUTE_DOCUMENT'">
              工序 {{ entry.version.stepNo }} {{ entry.version.stepName }} -
            </span>
            {{ entry.version.systemVersion }} {{ entry.version.externalVersion || '' }} - {{ entry.version.fileName }}
          </el-checkbox>
        </div>
      </div>
      <el-empty v-else description="正在加载导出预览" />
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="exportSubmitting" @click="submitExportTask">
          提交导出任务（{{ selectedExportFileKeys.length }}）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.bom-document-step {
  .step-title {
    font-weight: 600;
    font-size: 15px;
  }

  .step2-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .step2-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .query-summary {
    background: var(--el-fill-color-lighter, #f5f7fa);
    padding: 10px 14px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.6;
  }

  .summary-label {
    color: var(--el-text-color-secondary, #606266);
    font-weight: 500;
  }

  .summary-value {
    color: var(--el-text-color-primary, #303133);
  }

  .summary-sep {
    margin: 0 8px;
    color: var(--el-border-color-lighter, #dcdfe6);
  }

  .tree-toolbar {
    padding: 6px 0;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  }

  .toolbar-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary, #909399);
    white-space: nowrap;
  }

  .toolbar-sep {
    color: var(--el-border-color, #dcdfe6);
  }

  .toolbar-stat {
    white-space: nowrap;
  }

  .text-muted {
    color: var(--el-text-color-placeholder, #c0c4cc);
    font-style: italic;
  }

  .doc-cell-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: nowrap;
    min-height: 28px;
  }

  .doc-preview-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 34px;
    height: 24px;
  }

  .doc-count-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-5);
    font-size: 10px;
    line-height: 16px;
    font-weight: 600;
  }

  .doc-icon-button {
    width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 0;
    font-size: 14px;
  }

  .history-icon-button {
    color: var(--el-color-primary);
  }

  .step-footer {
    margin-top: 16px;
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }

  .export-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 520px;
    overflow: auto;
  }

  .export-item {
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 4px;
  }

  .export-item-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
}
</style>
