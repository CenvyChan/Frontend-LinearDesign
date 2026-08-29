<script lang="ts" setup>
import type {
  BarcodePrintJob,
  BarcodePrintJobPayload,
  BarcodeQuery,
  BarcodeScanCode,
  BarcodeTemplate,
  BarcodeTemplatePayload,
} from '#/api/barcode';
import type { MaterialItem } from '#/api/bom';
import type { ProductionOrderItem } from '#/api/production';
import type { WmsLocation } from '#/api/wms';

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import {
  CircleCheck,
  CircleClose,
  CirclePlus,
  CopyDocument,
  Delete,
  DocumentChecked,
  Grid,
  Picture,
  Refresh,
  RefreshRight,
  Search,
  Tickets,
  View,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import {
  createBarcodePrintJob,
  createBarcodeScanCode,
  disableBarcodeScanCode,
  disableBarcodeTemplate,
  enableBarcodeTemplate,
  getBarcodePrintJobs,
  getBarcodeScanCodes,
  getBarcodeTemplates,
  recordBarcodeReprint,
  saveBarcodeTemplate,
} from '#/api/barcode';
import { searchMaterials } from '#/api/bom';
import { queryProductionOrder } from '#/api/production';
import { getWmsLocations } from '#/api/wms';
import { useErpAcctStore } from '#/store';

import {
  BARCODE_BUSINESS_TYPES,
  PAPER_PRESETS,
  applyPaperPreset,
  buildBatchPrintJobPayloads,
  buildObjectVariableCatalog,
  buildSystemVariables,
  calculateQrSideMm,
  calculateTableCellLineClamp,
  clampDesignerElementPosition,
  createDefaultDesignerState,
  createDefaultTableCell,
  createScenarioCode,
  normalizeBusinessType,
  normalizeDesignerLayout,
  normalizeTableTrackSizes,
  renderLabelPreview,
  resizeAdjacentTableTrack,
  resolveBusinessTypeLabel,
  sampleKeyForBusinessType,
  toTemplatePayloadJson,
} from './barcode-design-print-model';
import type {
  BarcodeBusinessObject,
  BarcodeBusinessType,
  BarcodePaperPreset,
  BarcodeRenderedLabel,
  BarcodeTableCell,
  BarcodeVariable,
} from './barcode-design-print-model';

defineOptions({ name: 'BarcodeDesignPrint' });

const erpAcctStore = useErpAcctStore();
const DESIGN_CANVAS_SCALE = 5;
const RENDERED_LABEL_SCALE = 7;

const activeWorkspace = ref('design');
const activeOverviewTab = ref('templates');
const loading = ref(false);
const searchLoading = ref(false);
const submitLoading = ref(false);
const previewLoading = ref(false);
const disableCodeLoadingId = ref<number | null>(null);
const templateToggleLoadingId = ref<number | null>(null);
const reprintLoadingJobNo = ref('');
const rightPanelTab = ref('variables');
const currentStep = ref(0);
const objectDialogVisible = ref(false);
const objectDialogSelectionKey = ref('');
const objectDialogSelectionKeys = ref<string[]>([]);
const selectedCellId = ref('cell-0-0');
const selectedPreviewIndex = ref(0);

const templates = ref<BarcodeTemplate[]>([]);
const scanCodes = ref<BarcodeScanCode[]>([]);
const printJobs = ref<BarcodePrintJob[]>([]);
const businessObjects = ref<BarcodeBusinessObject[]>([]);
const selectedObject = ref<BarcodeBusinessObject | null>(null);
const selectedObjects = ref<BarcodeBusinessObject[]>([]);
const previewDialogVisible = ref(false);
const previewLabels = ref<BarcodeRenderedLabel[]>([]);
const qrCodeUrls = ref<Record<string, string>>({});
const generatedRawValue = ref('');

const selectedBusinessType = ref<BarcodeBusinessType>('MATERIAL');
const keyword = ref('');
const orgNumber = ref('');
const stockNumber = ref('');
const scenarioName = ref('默认标签');
const tableHeightInput = ref(36);
const tableWidthInput = ref(56);
const designer = reactive(createDefaultDesignerState());

const filters = reactive<Required<BarcodeQuery>>({
  businessKey: sampleKeyForBusinessType('MATERIAL'),
  businessType: 'MATERIAL',
  erpAcctCode: erpAcctStore.acctCode || '',
  scenarioCode: createScenarioCode('MATERIAL', '默认标签'),
  scenarioName: '默认标签',
  status: 'PENDING,FAILED',
  tenantId: 1,
});

const templateForm = reactive<BarcodeTemplatePayload>({
  businessType: 'MATERIAL',
  defaultFlag: true,
  enabled: true,
  erpAcctCode: '',
  layoutJson: '',
  paramSchemaJson: '',
  scenarioCode: createScenarioCode('MATERIAL', '默认标签'),
  scenarioName: '默认标签',
  templateCode: 'MATERIAL_LABEL_DEFAULT',
  templateName: '物料标签默认模板',
  tenantId: 1,
});

const scanCodeForm = reactive({
  businessKey: sampleKeyForBusinessType('MATERIAL'),
  businessType: 'MATERIAL',
  erpAcctCode: erpAcctStore.acctCode || '',
});

const printJobForm = reactive<BarcodePrintJobPayload>({
  businessKey: sampleKeyForBusinessType('MATERIAL'),
  businessType: 'MATERIAL',
  copies: 1,
  erpAcctCode: erpAcctStore.acctCode || '',
  idempotencyKey: '',
  maxReprintCount: 3,
  scenarioCode: createScenarioCode('MATERIAL', '默认标签'),
  scenarioName: '默认标签',
  templateId: undefined,
  tenantId: 1,
});

const selectedBusinessTypeOption = computed(() =>
  BARCODE_BUSINESS_TYPES.find((item) => item.value === selectedBusinessType.value)!,
);
const businessVariables = computed(() => buildObjectVariableCatalog(selectedBusinessType.value, selectedObject.value));
const systemVariables = computed(() => buildSystemVariables({
  businessKey: filters.businessKey,
  businessType: filters.businessType,
  erpAcctCode: filters.erpAcctCode,
  rawValue: generatedRawValue.value,
}));
const allVariables = computed(() => [...businessVariables.value, ...systemVariables.value]);
const templateOptions = computed(() =>
  templates.value.map((item) => ({ label: `${item.templateCode} / ${item.templateName}`, value: item.id })).filter((item) => item.value),
);
const sortedTemplates = computed(() => templates.value.slice().sort((a, b) => Number(b.defaultFlag) - Number(a.defaultFlag)));
const currentPreviewLabel = computed(() => previewLabels.value[selectedPreviewIndex.value]);
const tableResizeDrag = ref<{
  axis: 'col' | 'row';
  edge?: 'end' | 'start';
  index: number;
  startClient: number;
  tracks: number[];
  x?: number;
  y?: number;
} | null>(null);
const canvasStyle = computed(() => ({
  height: `${designer.paper.height * DESIGN_CANVAS_SCALE}px`,
  width: `${designer.paper.width * DESIGN_CANVAS_SCALE}px`,
}));
const normalizedDesignerTable = computed(() => normalizeTableTrackSizes(designer.table, designer.paper));
const tableContentWidthMm = computed(() => normalizedDesignerTable.value.columnWidths.reduce((sum, item) => sum + item, 0));
const tableContentHeightMm = computed(() => normalizedDesignerTable.value.rowHeights.reduce((sum, item) => sum + item, 0));

watch([tableContentWidthMm, tableContentHeightMm], ([width, height]) => {
  tableWidthInput.value = Number(width.toFixed(2));
  tableHeightInput.value = Number(height.toFixed(2));
}, { immediate: true });
const labelTableStyle = computed(() => ({
  gridTemplateColumns: normalizedDesignerTable.value.columnWidths.map((item) => `${item * DESIGN_CANVAS_SCALE}px`).join(' '),
  gridTemplateRows: normalizedDesignerTable.value.rowHeights.map((item) => `${item * DESIGN_CANVAS_SCALE}px`).join(' '),
  height: `${tableContentHeightMm.value * DESIGN_CANVAS_SCALE}px`,
  left: `${Math.max(0, normalizedDesignerTable.value.x || 0) * DESIGN_CANVAS_SCALE}px`,
  top: `${Math.max(0, designer.paper.height - (normalizedDesignerTable.value.y || 0) - tableContentHeightMm.value) * DESIGN_CANVAS_SCALE}px`,
  width: `${tableContentWidthMm.value * DESIGN_CANVAS_SCALE}px`,
}));
const columnResizeHandles = computed(() => {
  let offset = 0;
  return normalizedDesignerTable.value.columnWidths.slice(0, -1).map((width, index) => {
    offset += width;
    return { edge: undefined, index, left: offset * DESIGN_CANVAS_SCALE };
  });
});
const rowResizeHandles = computed(() => {
  let offset = 0;
  return normalizedDesignerTable.value.rowHeights.slice(0, -1).map((height, index) => {
    offset += height;
    return { edge: undefined, index, top: offset * DESIGN_CANVAS_SCALE };
  });
});
const paperSummary = computed(() => `${designer.paper.width} x ${designer.paper.height} mm`);
const selectedPaperPresetLabel = computed(() => {
  const preset = PAPER_PRESETS.find((item) =>
    item.width === designer.paper.width
    && item.height === designer.paper.height
    && item.margin === designer.paper.margin
    && item.orientation === designer.paper.orientation,
  );
  return preset?.label || '';
});
const selectedCell = computed(() => designer.cells.find((item) => item.id === selectedCellId.value));
const selectedScenarioCode = computed(() => createScenarioCode(selectedBusinessType.value, scenarioName.value));
const hasDesignedCells = computed(() => designer.cells.some((cell) => cell.type !== 'empty'));
const visibleTableCells = computed(() => designer.cells.filter((cell) => !isCellCoveredBySpan(cell)));
const selectedPrintTemplate = computed(() => sortedTemplates.value.find((item) => item.id === printJobForm.templateId));

watch(selectedBusinessType, (value) => {
  const businessType = normalizeBusinessType(value);
  selectedObject.value = null;
  selectedObjects.value = [];
  businessObjects.value = [];
  generatedRawValue.value = '';
  filters.businessType = businessType;
  filters.businessKey = sampleKeyForBusinessType(businessType);
  scanCodeForm.businessType = businessType;
  scanCodeForm.businessKey = filters.businessKey;
  printJobForm.businessType = businessType;
  printJobForm.businessKey = filters.businessKey;
  syncScenarioFromName(scenarioName.value, false);
  refreshAll();
});

watch(scenarioName, (value) => {
  syncScenarioFromName(value);
});

watch(activeWorkspace, (value) => {
  if (value === 'print') {
    currentStep.value = 2;
  } else if (currentStep.value === 2) {
    currentStep.value = 1;
  }
});

watch(
  () => [designer.paper.width, designer.paper.height, designer.paper.margin],
  () => {
    syncTableTracks();
    designer.elements.forEach((element) => clampDesignerElementPosition(element, designer.paper));
  },
);

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', moveTableTrackDrag);
  window.addEventListener('pointerup', endTableTrackDrag);
  window.addEventListener('pointercancel', endTableTrackDrag);
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', moveTableTrackDrag);
    window.removeEventListener('pointerup', endTableTrackDrag);
    window.removeEventListener('pointercancel', endTableTrackDrag);
  }
});

function syncTableTracks() {
  const table = normalizeTableTrackSizes(designer.table, designer.paper);
  designer.table.rows = table.rows;
  designer.table.cols = table.cols;
  designer.table.border = table.border;
  designer.table.height = table.height;
  designer.table.width = table.width;
  designer.table.x = table.x;
  designer.table.y = table.y;
  designer.table.columnWidths.splice(0, designer.table.columnWidths.length, ...table.columnWidths);
  designer.table.rowHeights.splice(0, designer.table.rowHeights.length, ...table.rowHeights);
}

function formatMm(value: number) {
  return `${Number(value.toFixed(1))}mm`;
}

function setTableFrame() {
  syncTableTracks();
}

function setTableSize(axis: 'height' | 'width', value?: number) {
  const table = normalizeTableTrackSizes(designer.table, designer.paper);
  const minSize = axis === 'width' ? table.cols * 4 : table.rows * 4;
  const origin = axis === 'width' ? table.x || 0 : table.y || 0;
  const paperSize = axis === 'width' ? designer.paper.width : designer.paper.height;
  const nextSize = Math.min(Math.max(Number(value) || minSize, minSize), Math.max(minSize, paperSize - origin));
  if (axis === 'width') {
    designer.table.width = Number(nextSize.toFixed(2));
    tableWidthInput.value = designer.table.width;
    designer.table.columnWidths.splice(0, designer.table.columnWidths.length, ...scaleTableTracks(table.columnWidths, nextSize));
  } else {
    designer.table.height = Number(nextSize.toFixed(2));
    tableHeightInput.value = designer.table.height;
    designer.table.rowHeights.splice(0, designer.table.rowHeights.length, ...scaleTableTracks(table.rowHeights, nextSize));
  }
  syncTableTracks();
}

function scaleTableTracks(tracks: number[], targetTotal: number) {
  const total = tracks.reduce((sum, item) => sum + item, 0) || 1;
  const scaled = tracks.map((item) => Number((item * targetTotal / total).toFixed(2)));
  const diff = Number((targetTotal - scaled.reduce((sum, item) => sum + item, 0)).toFixed(2));
  if (scaled.length > 0) scaled[scaled.length - 1] = Number(((scaled[scaled.length - 1] || 0) + diff).toFixed(2));
  return scaled;
}

function ensureSuccess<T>(resp: { data: T; message?: string; success: boolean }): T {
  if (!resp.success) throw new Error(resp.message || '操作失败');
  return resp.data;
}

function buildTemplateQuery(): BarcodeQuery {
  return {
    businessType: filters.businessType || undefined,
    erpAcctCode: filters.erpAcctCode || undefined,
    tenantId: filters.tenantId || undefined,
  };
}

function buildPrintQueueQuery(): BarcodeQuery {
  return {
    businessType: filters.businessType || undefined,
    erpAcctCode: filters.erpAcctCode || undefined,
    scenarioCode: filters.scenarioCode || undefined,
    scenarioName: filters.scenarioName || undefined,
    status: filters.status || undefined,
    tenantId: filters.tenantId || undefined,
  };
}

function buildScanCodeQuery(): BarcodeQuery | null {
  const businessKey = selectedObject.value?.key;
  if (!businessKey) return null;
  return {
    businessKey,
    businessType: filters.businessType || undefined,
    erpAcctCode: filters.erpAcctCode || undefined,
    tenantId: filters.tenantId || undefined,
  };
}

function currentOrgId() {
  return `${localStorage.getItem('mes_current_org_id') || ''}`.trim();
}

function currentMaterialOrgId() {
  return currentOrgId() || `${orgNumber.value || ''}`.trim();
}

function syncFormsFromSelection() {
  const businessType = selectedBusinessType.value;
  const businessKey = selectedObject.value?.key || filters.businessKey || sampleKeyForBusinessType(businessType);
  const erpAcctCode = filters.erpAcctCode || erpAcctStore.acctCode || '';
  const scenarioCode = selectedScenarioCode.value;
  filters.businessType = businessType;
  filters.businessKey = businessKey;
  filters.scenarioCode = scenarioCode;
  filters.scenarioName = scenarioName.value;
  filters.erpAcctCode = erpAcctCode;
  templateForm.tenantId = filters.tenantId;
  templateForm.businessType = businessType;
  templateForm.erpAcctCode = erpAcctCode;
  templateForm.scenarioCode = scenarioCode;
  templateForm.scenarioName = scenarioName.value;
  scanCodeForm.businessKey = businessKey;
  scanCodeForm.businessType = businessType;
  scanCodeForm.erpAcctCode = erpAcctCode;
  printJobForm.tenantId = filters.tenantId;
  printJobForm.businessKey = businessKey;
  printJobForm.businessType = businessType;
  printJobForm.erpAcctCode = erpAcctCode;
  printJobForm.scenarioCode = scenarioCode;
  printJobForm.scenarioName = scenarioName.value;
}

function syncScenarioFromName(value: string, updateTemplateCode = true) {
  const name = value.trim() || '默认标签';
  const code = createScenarioCode(selectedBusinessType.value, name);
  scenarioName.value = name;
  filters.scenarioCode = code;
  filters.scenarioName = name;
  templateForm.scenarioCode = code;
  templateForm.scenarioName = name;
  printJobForm.scenarioCode = code;
  printJobForm.scenarioName = name;
  if (updateTemplateCode && (!templateForm.id || !templateForm.templateCode)) {
    templateForm.templateCode = `${code}_DEFAULT`;
    templateForm.templateName = `${name}模板`;
  }
}

function goToSetupStep() {
  currentStep.value = 0;
}

function goToDesignStep() {
  if (!scenarioName.value.trim()) {
    ElMessage.warning('请先填写标签用途');
    return;
  }
  currentStep.value = 1;
}

async function goToOutputStep() {
  if (!hasDesignedCells.value) {
    ElMessage.warning('请先完成表格模板设计');
    return;
  }
  updateDesignerJson();
  await buildPreviewLabels();
  activeWorkspace.value = 'print';
  currentStep.value = 2;
}

async function refreshAll() {
  loading.value = true;
  try {
    syncFormsFromSelection();
    const templateQuery = buildTemplateQuery();
    const queueQuery = buildPrintQueueQuery();
    const scanCodeQuery = buildScanCodeQuery();
    const [templateResp, codeResp, jobResp] = await Promise.all([
      getBarcodeTemplates(templateQuery),
      scanCodeQuery
        ? getBarcodeScanCodes(scanCodeQuery)
        : Promise.resolve({ data: [] as BarcodeScanCode[], success: true }),
      getBarcodePrintJobs(queueQuery),
    ]);
    templates.value = ensureSuccess(templateResp) || [];
    scanCodes.value = ensureSuccess(codeResp) || [];
    printJobs.value = ensureSuccess(jobResp) || [];
  } catch (error: any) {
    ElMessage.error(error.message || '条码数据加载失败');
  } finally {
    loading.value = false;
  }
}

async function searchBusinessObjects() {
  const term = keyword.value.trim();
  if (!term && selectedBusinessType.value !== 'WMS_LOCATION') {
    ElMessage.warning('请输入关键字后再搜索');
    return;
  }
  searchLoading.value = true;
  try {
    if (selectedBusinessType.value === 'MATERIAL') {
      const resp: any = await searchMaterials(term, currentMaterialOrgId() || undefined);
      businessObjects.value = (resp.success ? resp.data || [] : []).map(mapMaterialObject);
    } else if (selectedBusinessType.value === 'WMS_LOCATION') {
      const resp = await getWmsLocations({ erpOrgNumber: orgNumber.value || undefined, stockNumber: stockNumber.value || undefined });
      const rows = ensureSuccess(resp) || [];
      businessObjects.value = rows
        .filter((item) => matchesKeyword([item.locationCode, item.locationName, item.stockNumber, item.stockName], term))
        .map(mapLocationObject);
    } else {
      const resp = await queryProductionOrder({
        erpAcctCode: filters.erpAcctCode || undefined,
        materialModel: term || undefined,
        pageIndex: 1,
        pageSize: 50,
        prdOrgId: orgNumber.value || undefined,
      });
      businessObjects.value = (resp?.data || [])
        .filter((item) => matchesKeyword([item.moBillNo, item.materialName, item.materialModel, item.statusName], term))
        .map(mapProductionOrderObject);
    }
    if (businessObjects.value.length === 0) ElMessage.warning('没有找到匹配的业务对象');
  } catch (error: any) {
    ElMessage.error(error.message || '业务对象搜索失败');
  } finally {
    searchLoading.value = false;
  }
}

function openObjectDialog() {
  objectDialogVisible.value = true;
  objectDialogSelectionKey.value = selectedObject.value?.key || '';
  objectDialogSelectionKeys.value = selectedObjects.value.map((item) => item.key);
}

function selectDialogObject(item: BarcodeBusinessObject) {
  objectDialogSelectionKey.value = item.key;
}

function handleDialogCurrentChange(row?: BarcodeBusinessObject) {
  if (row) selectDialogObject(row);
}

function handleDialogRowDblclick(row: BarcodeBusinessObject) {
  selectDialogObject(row);
  confirmDialogObject();
}

function confirmDialogObject() {
  const previousStep = currentStep.value;
  const items = businessObjects.value.filter((object) => objectDialogSelectionKeys.value.includes(object.key));
  const fallback = businessObjects.value.find((object) => object.key === objectDialogSelectionKey.value);
  if (items.length === 0 && fallback) items.push(fallback);
  if (items.length === 0) {
    ElMessage.warning('请至少选择一个业务对象');
    return;
  }
  selectedObjects.value = items;
  selectBusinessObject(items[0]!);
  objectDialogVisible.value = false;
  if (previousStep > 0) currentStep.value = 2;
}

function selectBusinessObject(item: BarcodeBusinessObject) {
  selectedObject.value = item;
  if (!selectedObjects.value.some((object) => object.key === item.key)) {
    selectedObjects.value = [item];
  }
  filters.businessKey = item.key;
  syncFormsFromSelection();
  refreshAll();
}

function handleDialogSelectionChange(rows: BarcodeBusinessObject[]) {
  objectDialogSelectionKeys.value = rows.map((row) => row.key);
  if (rows[0]) objectDialogSelectionKey.value = rows[0].key;
}

function mapMaterialObject(item: MaterialItem): BarcodeBusinessObject {
  return {
    key: item.number,
    raw: item as any,
    subtitle: [item.name, item.specification].filter(Boolean).join(' / '),
    title: `${item.number} / ${item.name || '-'}`,
    variables: { materialCode: item.number, materialName: item.name, materialSpec: item.specification },
  };
}

function mapLocationObject(item: WmsLocation): BarcodeBusinessObject {
  return {
    key: item.locationCode,
    raw: item as any,
    subtitle: [item.stockNumber, item.stockName].filter(Boolean).join(' / '),
    title: `${item.locationCode} / ${item.locationName || '-'}`,
    variables: {
      locationCode: item.locationCode,
      locationName: item.locationName,
      stockName: item.stockName,
      stockNumber: item.stockNumber,
    },
  };
}

function mapProductionOrderObject(item: ProductionOrderItem): BarcodeBusinessObject {
  return {
    key: item.moBillNo,
    raw: item as any,
    subtitle: [item.materialName, item.materialModel, item.statusName].filter(Boolean).join(' / '),
    title: `${item.moBillNo} / ${item.materialName || '-'}`,
    variables: {
      orderNo: item.moBillNo,
      planQty: item.planQty,
      productCode: item.materialId,
      productName: item.materialName,
      statusName: item.statusName,
    },
  };
}

function matchesKeyword(values: unknown[], term: string) {
  if (!term) return true;
  const normalized = term.toLowerCase();
  return values.some((value) => `${value ?? ''}`.toLowerCase().includes(normalized));
}

function applyTemplate(row: BarcodeTemplate) {
  Object.assign(templateForm, {
    businessType: row.businessType,
    defaultFlag: !!row.defaultFlag,
    enabled: row.enabled !== false,
    erpAcctCode: row.erpAcctCode,
    id: row.id,
    layoutJson: row.layoutJson,
    paramSchemaJson: row.paramSchemaJson || '',
    scenarioCode: row.scenarioCode,
    scenarioName: row.scenarioName || row.scenarioCode,
    templateCode: row.templateCode,
    templateName: row.templateName,
    tenantId: row.tenantId || filters.tenantId,
  });
  scenarioName.value = row.scenarioName || row.scenarioCode || scenarioName.value;
  Object.assign(designer, normalizeDesignerLayout(row.layoutJson));
  syncTableTracks();
  selectedCellId.value = designer.cells[0]?.id || '';
  printJobForm.templateId = row.id;
  ElMessage.success('模板已载入设计器');
}

function newTemplate() {
  Object.assign(templateForm, {
    businessType: selectedBusinessType.value,
    defaultFlag: false,
    enabled: true,
    erpAcctCode: filters.erpAcctCode || '',
    id: undefined,
    layoutJson: '',
    paramSchemaJson: '',
    scenarioCode: selectedScenarioCode.value,
    scenarioName: scenarioName.value,
    templateCode: `${selectedBusinessType.value}_LABEL_${Date.now().toString().slice(-4)}`,
    templateName: `${resolveBusinessTypeLabel(selectedBusinessType.value)}模板`,
    tenantId: filters.tenantId,
  });
  Object.assign(designer, createDefaultDesignerState());
  syncTableTracks();
  selectedCellId.value = designer.cells[0]?.id || '';
}

function copyTemplate() {
  updateDesignerJson();
  const suffix = Date.now().toString().slice(-4);
  Object.assign(templateForm, {
    ...templateForm,
    defaultFlag: false,
    id: undefined,
    templateCode: `${templateForm.templateCode || selectedBusinessType.value}_COPY_${suffix}`,
    templateName: `${templateForm.templateName || '标签模板'} 副本`,
  });
  printJobForm.templateId = undefined;
  ElMessage.success('已复制为新模板，请保存');
}

function ensureTableCells() {
  for (let row = 0; row < designer.table.rows; row += 1) {
    for (let col = 0; col < designer.table.cols; col += 1) {
      if (!designer.cells.some((cell) => cell.row === row && cell.col === col)) {
        designer.cells.push(createDefaultTableCell(`cell-${row}-${col}-${Date.now()}`, row, col));
      }
    }
  }
  const visibleCells = designer.cells.filter((cell) => cell.row < designer.table.rows && cell.col < designer.table.cols);
  designer.cells.splice(0, designer.cells.length, ...visibleCells);
  if (!designer.cells.some((cell) => cell.id === selectedCellId.value)) {
    selectedCellId.value = designer.cells[0]?.id || '';
  }
}

function resizeTable() {
  designer.table.rows = Math.max(1, Math.floor(Number(designer.table.rows) || 1));
  designer.table.cols = Math.max(1, Math.floor(Number(designer.table.cols) || 1));
  while (designer.table.rowHeights.length < designer.table.rows) designer.table.rowHeights.push(10);
  while (designer.table.columnWidths.length < designer.table.cols) designer.table.columnWidths.push(20);
  designer.table.rowHeights.splice(designer.table.rows);
  designer.table.columnWidths.splice(designer.table.cols);
  syncTableTracks();
  ensureTableCells();
}

function startTableTrackDrag(axis: 'col' | 'row', index: number, event: PointerEvent, edge?: 'end' | 'start') {
  event.preventDefault();
  event.stopPropagation();
  tableResizeDrag.value = {
    axis,
    edge,
    index,
    startClient: axis === 'col' ? event.clientX : event.clientY,
    tracks: axis === 'col' ? [...designer.table.columnWidths] : [...designer.table.rowHeights],
    x: designer.table.x,
    y: designer.table.y,
  };
}

function moveTableTrackDrag(event: PointerEvent) {
  const drag = tableResizeDrag.value;
  if (!drag) return;
  const deltaMm = (drag.axis === 'col' ? event.clientX : event.clientY) - drag.startClient;
  const trackDeltaMm = deltaMm / DESIGN_CANVAS_SCALE;
  const nextTracks = resizeAdjacentTableTrack(drag.tracks, drag.index, trackDeltaMm);
  if (drag.axis === 'col') {
    designer.table.columnWidths.splice(0, designer.table.columnWidths.length, ...nextTracks);
    designer.table.width = Number(nextTracks.reduce((sum, item) => sum + item, 0).toFixed(2));
  } else {
    designer.table.rowHeights.splice(0, designer.table.rowHeights.length, ...nextTracks);
    designer.table.height = Number(nextTracks.reduce((sum, item) => sum + item, 0).toFixed(2));
  }
}

function endTableTrackDrag() {
  tableResizeDrag.value = null;
}

function setCellStaticText() {
  if (!selectedCell.value) return;
  selectedCell.value.type = 'staticText';
  selectedCell.value.binding = undefined;
  selectedCell.value.text = selectedCell.value.text || '固定文本';
}

function setCellVariable(variable: BarcodeVariable, type: 'qr' | 'variableText' = 'variableText') {
  if (!selectedCell.value) return;
  selectedCell.value.type = type;
  selectedCell.value.binding = variable.key;
  selectedCell.value.text = undefined;
  if (type !== 'qr') selectedCell.value.qrSize = undefined;
}

function tableCellContent(cell: BarcodeTableCell) {
  if (cell.type === 'empty') return '';
  if (cell.type === 'staticText' || cell.type === 'textBox') return cell.text || '';
  if (cell.type === 'qr') return 'QR';
  const variable = allVariables.value.find((item) => item.key === cell.binding);
  return variable?.value || `{${cell.binding || ''}}`;
}

function tableCellStyle(cell: BarcodeTableCell) {
  const lineClampLayout = { paper: designer.paper, table: normalizedDesignerTable.value };
  return {
    '--cell-line-clamp': `${calculateTableCellLineClamp(cell, lineClampLayout, DESIGN_CANVAS_SCALE)}`,
    alignItems: cell.verticalAlign === 'top' ? 'flex-start' : cell.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    fontSize: `${Math.max(cell.fontSize, 2.4) * 4}px`,
    gridColumn: `${cell.col + 1} / span ${Math.max(cell.colSpan || 1, 1)}`,
    gridRow: `${cell.row + 1} / span ${Math.max(cell.rowSpan || 1, 1)}`,
    justifyContent: cell.align === 'center' ? 'center' : cell.align === 'right' ? 'flex-end' : 'flex-start',
    padding: `${cell.padding * 4}px`,
    textAlign: cell.align,
  };
}

function canvasQrStyle(cell: BarcodeTableCell) {
  const side = calculateQrSideMm(cell, { table: normalizedDesignerTable.value }) * DESIGN_CANVAS_SCALE;
  return {
    height: `${side}px`,
    width: `${side}px`,
  };
}

function renderedQrStyle(cell: BarcodeTableCell & { qrSide?: number }) {
  const side = (cell.qrSide || calculateQrSideMm(cell, { table: currentPreviewLabel.value?.table || normalizedDesignerTable.value })) * RENDERED_LABEL_SCALE;
  return {
    height: `${side}px`,
    width: `${side}px`,
  };
}

function selectedCellQrLimit() {
  if (!selectedCell.value) return 0;
  return calculateQrSideMm({ ...selectedCell.value, qrSize: undefined }, { table: normalizedDesignerTable.value });
}

function isCellCoveredBySpan(cell: BarcodeTableCell) {
  return designer.cells.some((other) =>
    other.id !== cell.id
    && (other.colSpan > 1 || other.rowSpan > 1)
    && cell.row >= other.row
    && cell.row < other.row + other.rowSpan
    && cell.col >= other.col
    && cell.col < other.col + other.colSpan,
  );
}

function onVariableDragStart(event: DragEvent, variable: BarcodeVariable, kind: 'qr' | 'text') {
  event.dataTransfer?.setData('application/json', JSON.stringify({ key: variable.key, kind }));
}

function onCellDrop(event: DragEvent, cell: BarcodeTableCell) {
  event.preventDefault();
  selectedCellId.value = cell.id;
  try {
    const payload = JSON.parse(event.dataTransfer?.getData('application/json') || '{}');
    const variable = allVariables.value.find((item) => item.key === payload.key);
    if (variable) setCellVariable(variable, payload.kind === 'qr' ? 'qr' : 'variableText');
  } catch {
    ElMessage.warning('变量拖放失败，请点击变量插入');
  }
}

function clearSelectedCell() {
  if (!selectedCell.value) return;
  selectedCell.value.type = 'empty';
  selectedCell.value.text = undefined;
  selectedCell.value.binding = undefined;
}

function setPaperPreset(preset: BarcodePaperPreset) {
  applyPaperPreset(designer.paper, preset);
  syncTableTracks();
  designer.elements.forEach((element) => clampDesignerElementPosition(element, designer.paper));
}

function setPaperPresetByLabel(label?: string) {
  const preset = PAPER_PRESETS.find((item) => item.label === label);
  if (preset) setPaperPreset(preset);
}

function handlePrintTemplateChange(templateId?: number) {
  const template = sortedTemplates.value.find((item) => item.id === templateId);
  if (!template) return;
  selectedBusinessType.value = normalizeBusinessType(template.businessType);
  scenarioName.value = template.scenarioName || template.scenarioCode || scenarioName.value;
  printJobForm.scenarioCode = template.scenarioCode;
  printJobForm.scenarioName = template.scenarioName || template.scenarioCode;
  previewLabels.value = [];
}

function updateDesignerJson() {
  const payload = toTemplatePayloadJson(designer);
  templateForm.layoutJson = payload.layoutJson;
  templateForm.paramSchemaJson = payload.paramSchemaJson;
}

async function buildPreviewLabels() {
  const objects = selectedObjects.value.length > 0 ? selectedObjects.value : (selectedObject.value ? [selectedObject.value] : []);
  if (objects.length === 0) {
    ElMessage.warning('请先选择要打印的业务对象');
    previewLabels.value = [];
    return;
  }
  const layoutJson = selectedPrintTemplate.value?.layoutJson || templateForm.layoutJson || toTemplatePayloadJson(designer).layoutJson;
  previewLabels.value = objects.map((object) => renderLabelPreview(layoutJson, object, {
    businessType: selectedBusinessType.value,
    erpAcctCode: printJobForm.erpAcctCode || filters.erpAcctCode,
  }));
  selectedPreviewIndex.value = Math.min(selectedPreviewIndex.value, Math.max(previewLabels.value.length - 1, 0));
  await ensureQrCodeUrls(previewLabels.value);
}

async function ensureQrCodeUrls(labels: BarcodeRenderedLabel[]) {
  const values = labels.flatMap((label) =>
    label.cells
      .filter((cell) => cell.type === 'qr' && cell.displayValue)
      .map((cell) => cell.displayValue),
  );
  const missing = Array.from(new Set(values.filter((value) => !qrCodeUrls.value[value])));
  if (missing.length === 0) return;
  const QRCode = await import('qrcode');
  const toDataURL = QRCode.toDataURL || QRCode.default?.toDataURL;
  if (!toDataURL) throw new Error('二维码预览组件加载失败');
  const entries = await Promise.all(missing.map(async (value) => [
    value,
    await toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: 160 }),
  ] as const));
  qrCodeUrls.value = { ...qrCodeUrls.value, ...Object.fromEntries(entries) };
}

function labelPreviewStyle(label: BarcodeRenderedLabel, scale = RENDERED_LABEL_SCALE) {
  return {
    height: `${label.paper.height * scale}px`,
    width: `${label.paper.width * scale}px`,
  };
}

function labelPreviewTableStyle(label: BarcodeRenderedLabel) {
  const height = label.table.rowHeights.reduce((sum, item) => sum + item, 0);
  const width = label.table.columnWidths.reduce((sum, item) => sum + item, 0);
  return {
    gridTemplateColumns: label.table.columnWidths.map((item) => `${item * RENDERED_LABEL_SCALE}px`).join(' '),
    gridTemplateRows: label.table.rowHeights.map((item) => `${item * RENDERED_LABEL_SCALE}px`).join(' '),
    height: `${height * RENDERED_LABEL_SCALE + 1}px`,
    left: `${(label.table.x || 0) * RENDERED_LABEL_SCALE}px`,
    top: `${Math.max(0, label.paper.height - (label.table.y || 0) - height) * RENDERED_LABEL_SCALE}px`,
    width: `${width * RENDERED_LABEL_SCALE + 1}px`,
  };
}

function renderedCellStyle(cell: BarcodeTableCell & { lineClamp?: number }, label?: BarcodeRenderedLabel) {
  const reachesLastColumn = label ? cell.col + Math.max(cell.colSpan || 1, 1) >= label.table.cols : false;
  const reachesLastRow = label ? cell.row + Math.max(cell.rowSpan || 1, 1) >= label.table.rows : false;
  const hideBorder = label?.table.border === false;
  return {
    ...tableCellStyle(cell),
    '--cell-line-clamp': `${label ? calculateTableCellLineClamp(cell, label, RENDERED_LABEL_SCALE) : cell.lineClamp || 1}`,
    borderBottom: hideBorder || reachesLastRow ? '0' : undefined,
    borderRight: hideBorder || reachesLastColumn ? '0' : undefined,
  };
}

function renderedVisibleCells(label: BarcodeRenderedLabel) {
  return label.cells.filter((cell) => !label.cells.some((other) =>
    other.id !== cell.id
    && (other.colSpan > 1 || other.rowSpan > 1)
    && cell.row >= other.row
    && cell.row < other.row + other.rowSpan
    && cell.col >= other.col
    && cell.col < other.col + other.colSpan,
  ));
}

async function handleSaveTemplate() {
  if (!scenarioName.value.trim()) {
    ElMessage.warning('请先填写标签用途');
    return;
  }
  if (!templateForm.templateCode || !templateForm.templateName) {
    ElMessage.warning('请填写模板编码和模板名称');
    return;
  }
  if (!hasDesignedCells.value) {
    ElMessage.warning('请至少设计一个表格单元格内容');
    return;
  }
  submitLoading.value = true;
  try {
    syncFormsFromSelection();
    updateDesignerJson();
    ensureSuccess(await saveBarcodeTemplate({ ...templateForm }));
    ElMessage.success('模板已保存');
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '模板保存失败');
  } finally {
    submitLoading.value = false;
  }
}

async function handleToggleTemplate(row: BarcodeTemplate) {
  if (!row.id) return;
  templateToggleLoadingId.value = row.id;
  try {
    if (row.enabled === false) ensureSuccess(await enableBarcodeTemplate(row.id));
    else ensureSuccess(await disableBarcodeTemplate(row.id));
    ElMessage.success(row.enabled === false ? '模板已启用' : '模板已停用');
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '模板状态更新失败');
  } finally {
    templateToggleLoadingId.value = null;
  }
}

async function handlePreviewTemplate(options: { openDialog?: boolean; silent?: boolean } = {}) {
  if (!hasDesignedCells.value) {
    ElMessage.warning('请先设计表格模板');
    return;
  }
  previewLoading.value = true;
  try {
    syncFormsFromSelection();
    updateDesignerJson();
    await buildPreviewLabels();
    previewDialogVisible.value = options.openDialog !== false;
    if (!options.silent) ElMessage.success('预览已刷新');
  } catch (error: any) {
    ElMessage.error(error.message || '预览生成失败');
  } finally {
    previewLoading.value = false;
  }
}

async function handleCreateScanCode() {
  syncFormsFromSelection();
  if (!scanCodeForm.businessKey) {
    ElMessage.warning('请先选择业务对象');
    return;
  }
  submitLoading.value = true;
  try {
    const code = ensureSuccess(await createBarcodeScanCode({ ...scanCodeForm }));
    generatedRawValue.value = code.rawValue;
    ElMessage.success('扫码码值已生成');
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '扫码码值生成失败');
  } finally {
    submitLoading.value = false;
  }
}

async function handleDisableScanCode(row: BarcodeScanCode) {
  if (!row.id) return;
  disableCodeLoadingId.value = row.id;
  try {
    ensureSuccess(await disableBarcodeScanCode(row.id));
    ElMessage.success('码值已停用');
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '码值停用失败');
  } finally {
    disableCodeLoadingId.value = null;
  }
}

async function handleCreatePrintJob() {
  syncFormsFromSelection();
  const objects = selectedObjects.value.length > 0 ? selectedObjects.value : (selectedObject.value ? [selectedObject.value] : []);
  if (objects.length === 0) {
    ElMessage.warning('请先多选业务对象');
    return;
  }
  if (!printJobForm.templateId) {
    const defaultTemplate = sortedTemplates.value.find((item) => item.defaultFlag && item.scenarioCode === selectedScenarioCode.value) || sortedTemplates.value.find((item) => item.scenarioCode === selectedScenarioCode.value);
    printJobForm.templateId = defaultTemplate?.id;
  }
  if (!printJobForm.templateId) {
    ElMessage.warning('请先选择或保存当前标签用途下的模板');
    return;
  }
  if (previewLabels.value.length === 0) {
    await buildPreviewLabels();
  }
  submitLoading.value = true;
  try {
    const payloads = buildBatchPrintJobPayloads({
      businessObjects: objects,
      businessType: selectedBusinessType.value,
      copies: printJobForm.copies,
      erpAcctCode: printJobForm.erpAcctCode,
      maxReprintCount: printJobForm.maxReprintCount,
      scenarioCode: selectedScenarioCode.value,
      scenarioName: scenarioName.value,
      templateId: printJobForm.templateId,
      tenantId: printJobForm.tenantId,
    });
    for (const payload of payloads) {
      ensureSuccess(await createBarcodePrintJob(payload));
    }
    ElMessage.success(`已加入打印队列 ${payloads.length} 条`);
    await refreshAll();
    activeOverviewTab.value = 'jobs';
  } catch (error: any) {
    ElMessage.error(error.message || '加入打印队列失败');
  } finally {
    submitLoading.value = false;
  }
}

async function handleReprint(row: BarcodePrintJob) {
  reprintLoadingJobNo.value = row.jobNo;
  try {
    ensureSuccess(await recordBarcodeReprint(row.jobNo));
    ElMessage.success('重打次数已记录');
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error.message || '重打记录失败');
  } finally {
    reprintLoadingJobNo.value = '';
  }
}

function formatTime(value?: number) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function copyText(text?: string) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
  ElMessage.success('已复制');
}

onMounted(() => {
  syncFormsFromSelection();
  refreshAll();
});
</script>

<template>
  <div class="barcode-page">
    <section class="page-header">
      <div>
        <p class="eyebrow">Barcode Designer</p>
        <h1>条码设计打印</h1>
        <p class="subtitle">先保存可复用的标签用途模板，再多选业务对象批量加入打印队列。</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="refreshAll">刷新记录</el-button>
        <el-button :icon="DocumentChecked" :loading="submitLoading" type="primary" @click="handleSaveTemplate">保存模板</el-button>
      </div>
    </section>

    <el-tabs v-model="activeOverviewTab" class="overview-tabs">
      <el-tab-pane :label="`模板 ${templates.length}`" name="templates">
        <el-table v-loading="loading" :data="sortedTemplates" max-height="220" size="small">
          <el-table-column label="模板" min-width="220"><template #default="{ row }"><div class="primary-cell"><strong>{{ row.templateCode }}</strong><span>{{ row.templateName }}</span></div></template></el-table-column>
          <el-table-column label="业务类型" width="140"><template #default="{ row }">{{ resolveBusinessTypeLabel(row.businessType) }}</template></el-table-column>
          <el-table-column label="账套" prop="erpAcctCode" width="100" />
          <el-table-column label="状态" width="132"><template #default="{ row }"><div class="status-tags"><el-tag :type="row.enabled === false ? 'info' : 'success'">{{ row.enabled === false ? '停用' : '启用' }}</el-tag><el-tag v-if="row.defaultFlag" type="warning">默认</el-tag></div></template></el-table-column>
          <el-table-column fixed="right" label="操作" width="96">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip content="载入模板" placement="top">
                  <el-button :icon="DocumentChecked" circle text type="primary" @click="applyTemplate(row)" />
                </el-tooltip>
                <el-tooltip :content="row.enabled === false ? '启用模板' : '停用模板'" placement="top">
                  <el-button
                    :icon="row.enabled === false ? CircleCheck : CircleClose"
                    :loading="templateToggleLoadingId === row.id"
                    circle
                    text
                    :type="row.enabled === false ? 'success' : 'warning'"
                    @click="handleToggleTemplate(row)"
                  />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`候选对象 ${businessObjects.length}`" name="objects">
        <div class="overview-actions">
          <span>{{ selectedBusinessTypeOption.label }} · {{ keyword || '未输入关键字' }}</span>
          <el-button :icon="Search" type="primary" @click="openObjectDialog">搜索并选择对象</el-button>
        </div>
        <el-table v-loading="searchLoading" :data="businessObjects" max-height="220" size="small">
          <el-table-column label="编码 / 名称" min-width="260"><template #default="{ row }"><div class="primary-cell"><strong>{{ row.title }}</strong><span>{{ row.subtitle || row.key }}</span></div></template></el-table-column>
          <el-table-column label="变量预览" min-width="260"><template #default="{ row }"><span class="object-variable-preview">{{ Object.values(row.variables).filter(Boolean).join(' / ') }}</span></template></el-table-column>
          <el-table-column fixed="right" label="操作" width="72">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip content="选择对象" placement="top">
                  <el-button :icon="CircleCheck" circle text type="primary" @click="selectBusinessObject(row)" />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`码值 ${scanCodes.length}`" name="codes">
        <el-table v-loading="loading" :data="scanCodes" max-height="220" size="small">
          <el-table-column label="Raw Value" min-width="320"><template #default="{ row }"><div class="copy-cell"><span>{{ row.rawValue }}</span><el-button :icon="CopyDocument" circle text @click="copyText(row.rawValue)" /></div></template></el-table-column>
          <el-table-column label="业务类型" prop="businessType" width="130" />
          <el-table-column label="业务对象" prop="businessKey" width="170" />
          <el-table-column label="扫码次数" prop="scanCount" width="100" />
          <el-table-column label="状态" prop="status" width="100" />
          <el-table-column fixed="right" label="操作" width="72">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip content="停用码值" placement="top">
                  <el-button
                    :disabled="row.status === 'DISABLED'"
                    :icon="CircleClose"
                    :loading="disableCodeLoadingId === row.id"
                    circle
                    text
                    type="warning"
                    @click="handleDisableScanCode(row)"
                  />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`打印任务 ${printJobs.length}`" name="jobs">
        <div class="job-form">
          <el-select v-model="printJobForm.templateId" clearable placeholder="选择模板"><el-option v-for="item in templateOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select>
          <el-input-number v-model="printJobForm.copies" :min="1" :max="99" controls-position="right" />
          <el-input-number v-model="printJobForm.maxReprintCount" :min="0" :max="99" controls-position="right" />
          <el-input v-model="printJobForm.idempotencyKey" clearable placeholder="幂等键，可留空" />
        </div>
        <el-table v-loading="loading" :data="printJobs" max-height="220" size="small">
          <el-table-column label="任务号" prop="jobNo" min-width="180" />
          <el-table-column label="业务对象" prop="businessKey" width="170" />
          <el-table-column label="份数" prop="copies" width="80" />
          <el-table-column label="状态" prop="status" width="100" />
          <el-table-column label="重打" width="110"><template #default="{ row }">{{ row.reprintCount }} / {{ row.maxReprintCount }}</template></el-table-column>
          <el-table-column label="创建时间" width="180"><template #default="{ row }">{{ formatTime(row.createTime) }}</template></el-table-column>
          <el-table-column fixed="right" label="操作" width="72">
            <template #default="{ row }">
              <div class="table-actions">
                <el-tooltip content="重打" placement="top">
                  <el-button
                    :icon="RefreshRight"
                    :loading="reprintLoadingJobNo === row.jobNo"
                    circle
                    text
                    type="warning"
                    @click="handleReprint(row)"
                  />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-steps :active="currentStep" class="wizard-steps" finish-status="success" simple>
      <el-step title="第一步：业务类型与用途" />
      <el-step title="第二步：设计表格模板" />
      <el-step title="第三步：多选对象入队" />
    </el-steps>

    <el-tabs v-model="activeWorkspace" class="workspace-tabs">
      <el-tab-pane label="模板设计" name="design">

    <section v-show="currentStep === 0" class="step-content">
      <div class="setup-card">
        <div class="step-heading">
          <div>
            <strong>选择业务类型与标签用途</strong>
            <span>标签用途由用户自定义，用于保存和选择可复用模板，不绑定某一个物料。</span>
          </div>
          <el-tag type="info">{{ selectedBusinessTypeOption.label }}</el-tag>
        </div>

        <div class="business-type-grid">
          <button v-for="item in BARCODE_BUSINESS_TYPES" :key="item.value" class="type-option" :class="{ active: selectedBusinessType === item.value }" type="button" @click="selectedBusinessType = item.value">
            <strong>{{ item.label }}</strong>
            <span>{{ item.description }}</span>
          </button>
        </div>

        <div class="scenario-form">
          <el-form label-position="top">
            <el-form-item label="标签用途"><el-input v-model="scenarioName" clearable placeholder="例如：采购标签、成品外箱标签、委外来料标签" /></el-form-item>
            <el-form-item label="用途编码"><el-input :model-value="selectedScenarioCode" disabled /></el-form-item>
          </el-form>
        </div>
        <div class="object-step-panel">
          <div class="selected-object-card" :class="{ empty: !selectedObject }">
            <strong>{{ selectedObject?.title || '尚未选择业务对象' }}</strong>
            <span>{{ selectedObject?.subtitle || '设计模板时可先不选对象；打印入队前再多选真实业务对象' }}</span>
          </div>
          <div class="step-actions">
            <el-button :icon="Search" type="primary" @click="openObjectDialog">搜索业务对象</el-button>
            <el-button type="success" @click="goToDesignStep">下一步：设计表格模板</el-button>
          </div>
        </div>
      </div>
    </section>

    <section v-show="currentStep === 1" class="step-content">
      <section class="designer-shell">
        <main class="canvas-panel">
        <div class="canvas-toolbar">
          <div>
            <strong>{{ selectedBusinessTypeOption.label }}</strong>
            <span>{{ selectedObject?.title || '尚未选择业务对象' }}</span>
          </div>
          <div class="toolbar-actions">
          <el-button @click="goToSetupStep">返回用途设置</el-button>
            <el-button :icon="Picture" @click="setCellVariable(systemVariables[0]!, 'qr')">二维码</el-button>
            <el-button :icon="View" :loading="previewLoading" @click="handlePreviewTemplate">预览</el-button>
            <el-button :icon="CirclePlus" :loading="submitLoading" type="success" @click="handleCreateScanCode">生成码值</el-button>
            <el-button :icon="Tickets" type="primary" @click="goToOutputStep">预览与打印</el-button>
          </div>
        </div>

        <div class="paper-config">
          <div class="paper-preview">
            <strong>{{ paperSummary }}</strong>
            <span>{{ designer.paper.orientation === 'landscape' ? '横向标签' : '纵向标签' }} · 边距 {{ designer.paper.margin }} mm</span>
          </div>
          <div class="paper-preset-select">
            <span>常用规格</span>
            <el-select
              :model-value="selectedPaperPresetLabel"
              clearable
              placeholder="自定义尺寸"
              @change="setPaperPresetByLabel"
            >
              <el-option
                v-for="preset in PAPER_PRESETS"
                :key="preset.label"
                :label="`${preset.label} mm`"
                :value="preset.label"
              >
                <div class="paper-option">
                  <strong>{{ preset.label }} mm</strong>
                  <span>{{ preset.description }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
          <el-form :model="designer.paper" class="paper-form" label-position="top">
            <el-form-item label="纸宽(mm)"><el-input v-model.number="designer.paper.width" inputmode="decimal" /></el-form-item>
            <el-form-item label="纸高(mm)"><el-input v-model.number="designer.paper.height" inputmode="decimal" /></el-form-item>
            <el-form-item label="边距(mm)"><el-input v-model.number="designer.paper.margin" inputmode="decimal" /></el-form-item>
            <el-form-item label="方向"><el-segmented v-model="designer.paper.orientation" :options="[{ label: '横向', value: 'landscape' }, { label: '纵向', value: 'portrait' }]" /></el-form-item>
          </el-form>
        </div>

        <div class="canvas-wrap">
          <div class="label-canvas table-label-canvas" :style="canvasStyle">
            <div class="canvas-ruler">{{ designer.paper.width }} x {{ designer.paper.height }} mm</div>
            <div class="label-table" :style="labelTableStyle" @pointermove="moveTableTrackDrag" @pointerup="endTableTrackDrag" @pointercancel="endTableTrackDrag">
              <button
                v-for="cell in visibleTableCells"
                :key="cell.id"
                class="label-cell"
                :class="[{ active: selectedCellId === cell.id }, `cell-${cell.type}`, `overflow-${cell.overflow}`]"
                :style="tableCellStyle(cell)"
                type="button"
                @dragover.prevent
                @drop="onCellDrop($event, cell)"
                @click="selectedCellId = cell.id"
              >
                <span v-if="cell.type === 'qr'" class="fake-qr" :style="canvasQrStyle(cell)">QR</span>
                <span v-else>{{ tableCellContent(cell) || '空单元格' }}</span>
              </button>
              <button
                v-for="handle in columnResizeHandles"
                :key="`col-handle-${handle.edge || 'inner'}-${handle.index}`"
                class="track-handle track-handle-col"
                :class="{ 'track-handle-edge': handle.edge }"
                :style="{ left: `${handle.left}px` }"
                type="button"
                @pointerdown="startTableTrackDrag('col', handle.index, $event, handle.edge)"
              >
                <span>调整列宽 {{ formatMm(normalizedDesignerTable.columnWidths[handle.index] || 0) }}</span>
              </button>
              <button
                v-for="handle in rowResizeHandles"
                :key="`row-handle-${handle.edge || 'inner'}-${handle.index}`"
                class="track-handle track-handle-row"
                :class="{ 'track-handle-edge': handle.edge }"
                :style="{ top: `${handle.top}px` }"
                type="button"
                @pointerdown="startTableTrackDrag('row', handle.index, $event, handle.edge)"
              >
                <span>调整行高 {{ formatMm(normalizedDesignerTable.rowHeights[handle.index] || 0) }}</span>
              </button>
            </div>
          </div>
        </div>
        </main>

        <aside class="right-panel">
          <el-tabs v-model="rightPanelTab" class="designer-side-tabs">
            <el-tab-pane label="取变量模板" name="variables">
              <div class="panel-section">
                <div class="variable-group">
                  <span>业务变量</span>
                  <button v-for="variable in businessVariables" :key="variable.key" class="variable-chip" draggable="true" type="button" @click="setCellVariable(variable)" @dragstart="onVariableDragStart($event, variable, 'text')">
                    {{ variable.label }}<small>{{ variable.value || '未选择' }}</small>
                  </button>
                </div>
                <div class="variable-group">
                  <span>系统变量</span>
                  <button v-for="variable in systemVariables" :key="variable.key" class="variable-chip" draggable="true" type="button" @click="setCellVariable(variable, variable.key === 'rawValue' ? 'qr' : 'variableText')" @dragstart="onVariableDragStart($event, variable, variable.key === 'rawValue' ? 'qr' : 'text')">
                    {{ variable.label }}<small>{{ variable.value }}</small>
                  </button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="元素属性" name="element">
              <div class="panel-section">
                <template v-if="selectedCell">
                  <el-form class="side-form" label-position="top">
                    <el-form-item label="行 / 列"><div class="xy-grid"><el-input v-model.number="selectedCell.row" disabled /><el-input v-model.number="selectedCell.col" disabled /></div></el-form-item>
                    <el-form-item label="内容类型"><el-select v-model="selectedCell.type"><el-option label="空" value="empty" /><el-option label="固定文本" value="staticText" /><el-option label="变量文本" value="variableText" /><el-option label="二维码" value="qr" /><el-option label="文本框" value="textBox" /></el-select></el-form-item>
                    <el-form-item v-if="selectedCell.type === 'staticText' || selectedCell.type === 'textBox'" label="固定文本"><el-input v-model="selectedCell.text" /></el-form-item>
                    <el-form-item v-if="selectedCell.type === 'variableText' || selectedCell.type === 'qr'" label="变量Key"><el-input v-model="selectedCell.binding" /></el-form-item>
                    <el-form-item label="字号"><el-input v-model.number="selectedCell.fontSize" inputmode="decimal" /></el-form-item>
                    <el-form-item v-if="selectedCell.type === 'qr'" :label="`二维码边长(mm)，最大 ${formatMm(selectedCellQrLimit())}`"><el-input-number v-model="selectedCell.qrSize" :max="selectedCellQrLimit() || undefined" :min="1" :step="0.5" controls-position="right" /></el-form-item>
                    <el-form-item label="显示策略"><el-select v-model="selectedCell.overflow"><el-option label="自动换行" value="wrap" /><el-option label="单行省略" value="ellipsis" /><el-option label="多行省略" value="multiline-ellipsis" /></el-select></el-form-item>
                    <el-form-item label="对齐"><el-segmented v-model="selectedCell.align" :options="[{ label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' }]" /></el-form-item>
                    <el-form-item label="内边距"><el-input v-model.number="selectedCell.padding" inputmode="decimal" /></el-form-item>
                    <div class="xy-grid">
                      <el-form-item label="跨列"><el-input v-model.number="selectedCell.colSpan" inputmode="numeric" /></el-form-item>
                      <el-form-item label="跨行"><el-input v-model.number="selectedCell.rowSpan" inputmode="numeric" /></el-form-item>
                    </div>
                    <div class="element-actions"><el-button :icon="Grid" @click="setCellStaticText">固定文本</el-button><el-button :icon="Delete" type="warning" @click="clearSelectedCell">清空</el-button></div>
                  </el-form>
                </template>
                <el-empty v-else :image-size="64" description="请先点击表格单元格" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="模板信息" name="template">
              <div class="panel-section">
                <el-form :model="templateForm" class="side-form" label-position="top">
                  <el-form-item label="标签用途"><el-input v-model="scenarioName" /></el-form-item>
                  <el-form-item label="用途编码"><el-input :model-value="selectedScenarioCode" disabled /></el-form-item>
                  <el-form-item label="模板编码"><el-input v-model="templateForm.templateCode" /></el-form-item>
                  <el-form-item label="模板名称"><el-input v-model="templateForm.templateName" /></el-form-item>
                  <el-form-item label="默认模板"><el-switch v-model="templateForm.defaultFlag" /></el-form-item>
                  <el-form-item label="启用"><el-switch v-model="templateForm.enabled" /></el-form-item>
                  <div class="table-frame-grid">
                    <el-form-item label="左下角X(mm)"><el-input v-model.number="designer.table.x" inputmode="decimal" @change="setTableFrame" /></el-form-item>
                    <el-form-item label="左下角Y(mm)"><el-input v-model.number="designer.table.y" inputmode="decimal" @change="setTableFrame" /></el-form-item>
                    <el-form-item label="表格宽(mm)"><el-input v-model.number="tableWidthInput" inputmode="decimal" @change="setTableSize('width', tableWidthInput)" /></el-form-item>
                    <el-form-item label="表格高(mm)"><el-input v-model.number="tableHeightInput" inputmode="decimal" @change="setTableSize('height', tableHeightInput)" /></el-form-item>
                  </div>
                  <div class="table-size-grid">
                    <el-form-item label="行数"><el-input v-model.number="designer.table.rows" inputmode="numeric" @change="resizeTable" /></el-form-item>
                    <el-form-item label="列数"><el-input v-model.number="designer.table.cols" inputmode="numeric" @change="resizeTable" /></el-form-item>
                    <el-form-item label="边框"><el-switch v-model="designer.table.border" /></el-form-item>
                  </div>
                  <div class="table-size-list">
                    <span>当前表格内容区：{{ formatMm(tableContentWidthMm) }} × {{ formatMm(tableContentHeightMm) }}</span>
                    <span>拖动画布中的列线/行线即可调整单元格宽高</span>
                  </div>
                  <div class="template-actions">
                    <el-button :icon="CirclePlus" @click="newTemplate">新建模板</el-button>
                    <el-button :icon="CopyDocument" @click="copyTemplate">复制模板</el-button>
                    <el-button :icon="DocumentChecked" :loading="submitLoading" type="primary" @click="handleSaveTemplate">保存模板</el-button>
                  </div>
                </el-form>
              </div>
            </el-tab-pane>
          </el-tabs>
        </aside>
      </section>
    </section>

      </el-tab-pane>
      <el-tab-pane label="标签打印" name="print">

    <section v-show="currentStep === 2" class="step-content output-step">
      <div class="print-workbench">
        <aside class="print-setup-panel">
          <div class="section-title">打印设置</div>
          <el-form class="side-form" label-position="top">
            <el-form-item label="选择模板">
              <el-select v-model="printJobForm.templateId" clearable filterable placeholder="先选择要套用的标签模板" @change="handlePrintTemplateChange">
                <el-option v-for="item in templateOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="业务类型">
              <el-select v-model="selectedBusinessType">
                <el-option v-for="item in BARCODE_BUSINESS_TYPES" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <div class="xy-grid">
              <el-form-item label="打印份数"><el-input v-model.number="printJobForm.copies" inputmode="numeric" /></el-form-item>
              <el-form-item label="最大重打"><el-input v-model.number="printJobForm.maxReprintCount" inputmode="numeric" /></el-form-item>
            </div>
            <el-form-item label="幂等键"><el-input v-model="printJobForm.idempotencyKey" clearable placeholder="可留空，系统按对象生成" /></el-form-item>
          </el-form>
          <div class="selected-object-card" :class="{ empty: selectedObjects.length === 0 }">
            <strong>已选 {{ selectedObjects.length }} 个业务对象</strong>
            <span>{{ selectedObjects[0]?.title || '先搜索并勾选要打印的物料/库位/工单' }}</span>
          </div>
          <div class="print-actions">
            <el-button :icon="Search" type="primary" @click="openObjectDialog">选择业务对象</el-button>
            <el-button :icon="View" :loading="previewLoading" @click="handlePreviewTemplate">生成标签预览</el-button>
            <el-button :icon="Tickets" :disabled="previewLabels.length === 0" :loading="submitLoading" type="success" @click="handleCreatePrintJob">确认加入队列</el-button>
          </div>
        </aside>

        <main class="print-preview-panel">
          <div class="print-preview-header">
            <div>
              <strong>标签图像预览</strong>
              <span>{{ selectedPrintTemplate?.templateName || '未选择模板' }} · {{ previewLabels.length }} 张</span>
            </div>
            <el-button :icon="Refresh" :loading="loading" @click="refreshAll">刷新队列</el-button>
          </div>
          <div v-if="previewLabels.length > 0" class="label-preview-layout">
            <div class="label-thumbnail-list">
              <button
                v-for="(label, index) in previewLabels"
                :key="`${label.businessKey}-${index}`"
                class="label-thumbnail"
                :class="{ active: selectedPreviewIndex === index }"
                type="button"
                @click="selectedPreviewIndex = index"
              >
                <span>{{ index + 1 }}</span>
                <strong>{{ label.businessKey }}</strong>
                <small>{{ label.objectTitle }}</small>
              </button>
            </div>
            <div class="label-detail-view">
              <div class="label-detail-toolbar">
                <el-button :disabled="selectedPreviewIndex <= 0" @click="selectedPreviewIndex -= 1">上一张</el-button>
                <span>{{ selectedPreviewIndex + 1 }} / {{ previewLabels.length }}</span>
                <el-button :disabled="selectedPreviewIndex >= previewLabels.length - 1" @click="selectedPreviewIndex += 1">下一张</el-button>
              </div>
              <div v-if="currentPreviewLabel" class="rendered-label-shell">
                <div class="rendered-label" :style="labelPreviewStyle(currentPreviewLabel, 7)">
                  <div class="rendered-label-table" :style="labelPreviewTableStyle(currentPreviewLabel)">
                    <div
                      v-for="cell in renderedVisibleCells(currentPreviewLabel)"
                      :key="cell.id"
                      class="rendered-label-cell"
                      :class="[`cell-${cell.type}`, `overflow-${cell.overflow}`]"
                      :style="renderedCellStyle(cell, currentPreviewLabel)"
                    >
                      <img v-if="cell.type === 'qr' && qrCodeUrls[cell.displayValue]" :src="qrCodeUrls[cell.displayValue]" :style="renderedQrStyle(cell)" alt="二维码" />
                      <span v-else>{{ cell.type === 'qr' ? cell.displayValue : cell.displayValue }}</span>
                    </div>
                  </div>
                </div>
                <div class="label-detail-meta">
                  <strong>{{ currentPreviewLabel.objectTitle }}</strong>
                  <span>{{ currentPreviewLabel.businessKey }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else :image-size="90" description="选择模板和业务对象后，点击“生成标签预览”查看实际标签图像" />
        </main>
      </div>
    </section>

      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="objectDialogVisible" :title="`选择${selectedBusinessTypeOption.label}`" width="760px" destroy-on-close>
      <div class="object-dialog-search">
        <el-input v-model="keyword" clearable :placeholder="selectedBusinessType === 'WMS_LOCATION' ? '库位/仓库关键字，可为空' : '输入编码、名称或规格关键字'" @keyup.enter="searchBusinessObjects">
          <template #append>
            <el-button :icon="Search" :loading="searchLoading" @click="searchBusinessObjects">搜索</el-button>
          </template>
        </el-input>
      </div>
      <div class="object-dialog-filters">
        <el-input v-model="filters.erpAcctCode" placeholder="ERP账套" @change="refreshAll" />
        <el-input v-if="selectedBusinessType !== 'MATERIAL'" v-model="orgNumber" placeholder="组织编码" />
        <el-input v-if="selectedBusinessType === 'WMS_LOCATION'" v-model="stockNumber" placeholder="仓库编码" />
      </div>
      <el-table
        v-loading="searchLoading"
        :data="businessObjects"
        highlight-current-row
        max-height="360"
        row-key="key"
        size="small"
        @current-change="handleDialogCurrentChange"
        @selection-change="handleDialogSelectionChange"
        @row-dblclick="handleDialogRowDblclick"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="编码 / 名称" min-width="260">
          <template #default="{ row }">
            <div class="primary-cell"><strong>{{ row.title }}</strong><span>{{ row.subtitle || row.key }}</span></div>
          </template>
        </el-table-column>
        <el-table-column label="变量预览" min-width="240">
          <template #default="{ row }">
            <span class="object-variable-preview">{{ Object.values(row.variables).filter(Boolean).join(' / ') }}</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="businessObjects.length === 0 && !searchLoading" :image-size="80" description="输入关键字后搜索业务对象" />
      <template #footer>
        <el-button @click="objectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmDialogObject">确认选择</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialogVisible" title="标签图像预览" width="980px" destroy-on-close>
      <div class="preview-dialog-summary">
        <strong>{{ selectedBusinessTypeOption.label }}</strong>
        <span>{{ selectedObject?.title || filters.businessKey }} · {{ previewLabels.length }} 张</span>
      </div>
      <div v-if="currentPreviewLabel" class="preview-dialog-visual">
        <div class="rendered-label" :style="labelPreviewStyle(currentPreviewLabel, 7)">
          <div class="rendered-label-table" :style="labelPreviewTableStyle(currentPreviewLabel)">
            <div
              v-for="cell in renderedVisibleCells(currentPreviewLabel)"
              :key="cell.id"
              class="rendered-label-cell"
              :class="[`cell-${cell.type}`, `overflow-${cell.overflow}`]"
              :style="renderedCellStyle(cell, currentPreviewLabel)"
            >
              <img v-if="cell.type === 'qr' && qrCodeUrls[cell.displayValue]" :src="qrCodeUrls[cell.displayValue]" :style="renderedQrStyle(cell)" alt="二维码" />
              <span v-else>{{ cell.displayValue }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else :image-size="90" description="暂无预览结果" />
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
        <el-button :icon="View" :loading="previewLoading" type="primary" @click="handlePreviewTemplate">刷新预览</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.barcode-page { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.page-header, .header-actions, .canvas-toolbar, .toolbar-actions, .copy-cell, .preview-dialog-summary { display: flex; align-items: center; }
.page-header, .canvas-toolbar { justify-content: space-between; gap: 16px; }
.header-actions, .toolbar-actions { flex-wrap: wrap; gap: 8px; }
.eyebrow { margin: 0 0 4px; color: var(--el-text-color-secondary); font-size: 12px; text-transform: uppercase; }
h1 { margin: 0; color: var(--el-text-color-primary); font-size: 24px; font-weight: 700; }
.subtitle, .canvas-toolbar span, .preview-dialog-summary span { color: var(--el-text-color-regular); }
.subtitle { margin: 6px 0 0; }
.overview-tabs, .designer-shell { border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); }
.overview-tabs { padding: 10px 14px 14px; }
.overview-tabs :deep(.el-tabs__header) { margin-bottom: 10px; }
.workspace-tabs { padding: 12px; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); }
.workspace-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.workspace-tabs :deep(.el-tabs__content) { overflow: visible; }
.overview-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.overview-actions span { min-width: 0; overflow: hidden; color: var(--el-text-color-secondary); text-overflow: ellipsis; white-space: nowrap; }
.wizard-steps { margin-bottom: 4px; }
.step-content { min-width: 0; }
.setup-card { padding: 18px; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); }
.step-heading, .object-step-panel, .output-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.step-heading strong, .output-toolbar strong { display: block; color: var(--el-text-color-primary); font-size: 16px; }
.step-heading span, .output-toolbar span { display: block; margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; }
.business-type-grid { display: grid; gap: 12px; margin-top: 16px; grid-template-columns: repeat(3, minmax(180px, 1fr)); }
.object-step-panel { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--el-border-color-lighter); }
.scenario-form { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--el-border-color-lighter); }
.scenario-form :deep(.el-form) { display: grid; gap: 12px; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr); }
.scenario-form :deep(.el-form-item) { margin-bottom: 0; }
.step-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.output-step { display: flex; flex-direction: column; gap: 12px; }
.output-toolbar { padding: 14px 16px; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); }
.print-workbench { display: grid; min-height: 620px; overflow: hidden; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); }
.print-setup-panel { display: flex; min-width: 0; flex-direction: column; gap: 14px; overflow: auto; padding: 16px; border-right: 1px solid var(--el-border-color-light); background: var(--el-bg-color); color: var(--el-text-color-primary); }
.print-setup-panel .panel-section { padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-blank); color: var(--el-text-color-primary); }
.print-setup-panel :deep(.el-form-item__label) { color: var(--el-text-color-secondary); }
.print-setup-panel :deep(.el-input__wrapper),
.print-setup-panel :deep(.el-select__wrapper) { background-color: var(--el-fill-color-blank); box-shadow: 0 0 0 1px var(--el-border-color) inset; }
.print-setup-panel :deep(.el-input__inner),
.print-setup-panel :deep(.el-select__placeholder),
.print-setup-panel :deep(.el-select__selected-item) { color: var(--el-text-color-primary); }
.print-actions { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
.print-actions :deep(.el-button) { margin-left: 0; }
.print-actions :deep(.el-button:nth-child(3)) { grid-column: 1 / -1; }
.print-preview-panel { display: flex; min-width: 0; flex-direction: column; gap: 12px; padding: 16px; background: var(--el-bg-color); }
.print-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.print-preview-header strong { display: block; color: var(--el-text-color-primary); font-size: 16px; }
.print-preview-header span { display: block; margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; }
.label-preview-layout { display: grid; min-height: 520px; gap: 14px; grid-template-columns: 190px minmax(0, 1fr); }
.label-thumbnail-list { display: flex; min-height: 0; flex-direction: column; gap: 8px; overflow: auto; padding-right: 4px; }
.label-thumbnail { display: grid; width: 100%; grid-template-columns: 26px minmax(0, 1fr); gap: 2px 8px; padding: 8px; border: 1px solid var(--el-border-color-light); border-radius: 6px; background: var(--el-fill-color-blank); color: var(--el-text-color-primary); cursor: pointer; text-align: left; }
.label-thumbnail.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.label-thumbnail span { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 999px; background: var(--el-fill-color-light); color: var(--el-text-color-secondary); font-size: 12px; grid-row: 1 / span 2; }
.label-thumbnail.active span { background: var(--el-color-primary); color: var(--el-color-white); }
.label-thumbnail strong, .label-thumbnail small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label-thumbnail strong { color: var(--el-text-color-primary); font-size: 13px; }
.label-thumbnail small { color: var(--el-text-color-secondary); font-size: 12px; }
.label-detail-view { display: flex; min-width: 0; flex-direction: column; gap: 12px; overflow: hidden; padding: 14px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-lighter); }
.label-detail-toolbar { display: flex; align-items: center; justify-content: center; gap: 10px; }
.label-detail-toolbar span { min-width: 54px; color: var(--el-text-color-secondary); text-align: center; }
.rendered-label-shell { display: flex; min-height: 0; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 12px; overflow: auto; padding: 16px; }
.rendered-label { position: relative; flex: 0 0 auto; padding: 10px; border: 1px solid #222; border-radius: 2px; background: #fff; color: #111; box-shadow: var(--el-box-shadow); }
.rendered-label-table { position: absolute; display: grid; overflow: hidden; border: 1px solid #111; background: #fff; }
.rendered-label-cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; align-items: center; border-right: 1px solid #111; border-bottom: 1px solid #111; background: #fff; color: #111; line-height: 1.2; }
.rendered-label-cell span { min-width: 0; }
.rendered-label-cell.cell-qr { align-items: center; justify-content: center; padding: 4px; }
.rendered-label-cell img { display: block; width: min(100%, 120px); max-width: 100%; max-height: 100%; object-fit: contain; }
.rendered-label-cell.overflow-ellipsis span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rendered-label-cell.overflow-wrap span { white-space: normal; word-break: break-all; }
.rendered-label-cell.overflow-multiline-ellipsis span { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: var(--cell-line-clamp, 2); }
.label-detail-meta { display: flex; width: min(100%, 520px); justify-content: space-between; gap: 12px; color: var(--el-text-color-secondary); font-size: 12px; }
.label-detail-meta strong, .label-detail-meta span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label-detail-meta strong { color: var(--el-text-color-primary); }
.preview-dialog-visual { display: flex; max-height: 62vh; align-items: center; justify-content: center; overflow: auto; padding: 18px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-lighter); }
.designer-shell { display: grid; min-height: 640px; overflow: hidden; grid-template-columns: minmax(560px, 1fr) minmax(280px, 320px); }
.left-panel, .right-panel { overflow: auto; padding: 16px; background: var(--el-fill-color-extra-light); }
.left-panel { border-right: 1px solid var(--el-border-color-light); }
.right-panel { min-width: 0; overflow-x: hidden; padding: 10px 12px; border-left: 1px solid var(--el-border-color-light); background: var(--el-bg-color); color: var(--el-text-color-primary); }
.designer-side-tabs :deep(.el-tabs__header) { margin-bottom: 8px; }
.designer-side-tabs :deep(.el-tabs__nav-wrap::after) { background-color: var(--el-border-color-light); }
.designer-side-tabs :deep(.el-tabs__item) { height: 30px; padding: 0 8px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 30px; }
.designer-side-tabs :deep(.el-tabs__item.is-active) { color: var(--el-color-primary); }
.designer-side-tabs :deep(.el-tabs__content) { overflow: visible; }
.side-form :deep(.el-form-item) { margin-bottom: 10px; }
.side-form :deep(.el-form-item__label) { margin-bottom: 3px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.side-form :deep(.el-input),
.side-form :deep(.el-select),
.side-form :deep(.el-segmented) { width: 100%; }
.side-form :deep(.el-input__wrapper) { background-color: var(--el-fill-color-blank); box-shadow: 0 0 0 1px var(--el-border-color) inset; }
.side-form :deep(.el-input__inner) { color: var(--el-text-color-primary); }
.side-form :deep(.el-input.is-disabled .el-input__wrapper) { background-color: var(--el-fill-color-light); box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset; }
.side-form :deep(.el-input.is-disabled .el-input__inner) { color: var(--el-text-color-secondary); -webkit-text-fill-color: var(--el-text-color-secondary); }
.side-form :deep(.el-segmented) { --el-segmented-bg-color: var(--el-fill-color-light); --el-segmented-item-selected-bg-color: var(--el-bg-color); --el-segmented-item-selected-color: var(--el-color-primary); }
.canvas-panel { display: flex; min-width: 0; flex-direction: column; gap: 14px; padding: 16px; }
.panel-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 0; }
.section-title { color: var(--el-text-color-primary); font-size: 14px; font-weight: 700; }
.type-option, .object-option, .variable-chip { width: 100%; padding: 10px 12px; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); color: var(--el-text-color-primary); cursor: pointer; text-align: left; }
.type-option.active, .object-option.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.type-option strong, .object-option strong { display: block; }
.type-option span, .object-option span, .variable-chip small { display: block; margin-top: 4px; overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.selected-object-card { padding: 12px; border: 1px solid var(--el-color-primary-light-6); border-radius: 8px; background: var(--el-color-primary-light-9); color: var(--el-text-color-primary); }
.selected-object-card.empty { border-color: var(--el-border-color-light); background: var(--el-bg-color); }
.print-setup-panel .selected-object-card { border-color: var(--el-border-color-light); background: var(--el-fill-color-blank); color: var(--el-text-color-primary); }
.print-setup-panel .selected-object-card:not(.empty) { border-color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color)); }
.print-setup-panel .selected-object-card.empty { background: var(--el-fill-color-blank); }
.selected-object-card strong, .selected-object-card span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selected-object-card span { margin-top: 5px; color: var(--el-text-color-secondary); font-size: 12px; }
.paper-config { display: grid; align-items: stretch; gap: 12px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-blank); grid-template-columns: minmax(116px, 0.55fr) minmax(180px, 0.75fr) minmax(320px, 1.4fr); }
.paper-preview { display: flex; min-height: 74px; flex-direction: column; justify-content: center; padding: 10px 12px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-bg-color); }
.paper-preview strong { color: var(--el-text-color-primary); font-size: 20px; }
.paper-preview span { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.paper-preset-select { display: flex; min-height: 74px; flex-direction: column; justify-content: center; gap: 6px; }
.paper-preset-select > span { color: var(--el-text-color-secondary); font-size: 12px; }
.paper-option { display: flex; min-width: 0; flex-direction: column; gap: 2px; line-height: 1.2; }
.paper-option strong, .paper-option span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.paper-option span { color: var(--el-text-color-secondary); font-size: 12px; }
.paper-form { display: grid; gap: 8px 10px; grid-template-columns: repeat(4, minmax(72px, 1fr)); }
.paper-form :deep(.el-form-item) { margin-bottom: 0; }
.paper-form :deep(.el-form-item__label) { line-height: 18px; }
.canvas-wrap { flex: 1; overflow: auto; padding: 24px; border: 1px dashed var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-lighter); }
.label-canvas { position: relative; min-width: 240px; min-height: 160px; margin: 0 auto; border: 1px solid var(--el-border-color-darker); border-radius: 4px; background-color: var(--el-bg-color); background-image: linear-gradient(var(--el-border-color-lighter) 1px, transparent 1px), linear-gradient(90deg, var(--el-border-color-lighter) 1px, transparent 1px); background-size: 20px 20px; box-shadow: var(--el-box-shadow-light); }
.table-label-canvas { display: block; background-image: none; }
.label-table { position: absolute; display: grid; border: 1px solid var(--el-color-primary); background: var(--el-bg-color); box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 24%, transparent); }
.label-cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; align-items: center; border: 0; border-right: 1px solid var(--el-border-color); border-bottom: 1px solid var(--el-border-color); background: var(--el-bg-color); color: var(--el-text-color-primary); cursor: pointer; line-height: 1.2; }
.label-cell.active { outline: 2px solid var(--el-color-primary); outline-offset: -2px; background: var(--el-color-primary-light-9); }
.label-cell.overflow-ellipsis span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.label-cell.overflow-wrap span { white-space: normal; word-break: break-all; }
.label-cell.overflow-multiline-ellipsis span { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: var(--cell-line-clamp, 2); }
.canvas-ruler { position: absolute; right: 6px; bottom: 4px; color: var(--el-text-color-secondary); font-size: 11px; pointer-events: none; }
.canvas-element { position: absolute; display: flex; overflow: hidden; align-items: center; justify-content: center; padding: 2px; border: 1px solid var(--el-color-primary-light-5); border-radius: 4px; background: var(--el-fill-color-blank); color: var(--el-text-color-primary); cursor: move; touch-action: none; user-select: none; }
.canvas-element.active { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-8); }
.canvas-element:active { opacity: 0.86; }
.fake-qr { display: grid; width: 100%; height: 100%; place-items: center; border: 2px solid var(--el-text-color-primary); color: var(--el-text-color-primary); font-weight: 700; }
.track-handle { position: absolute; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: transparent; cursor: col-resize; }
.track-handle span { position: absolute; inset: auto auto auto auto; overflow: hidden; width: 1px; height: 1px; clip-path: inset(50%); white-space: nowrap; }
.track-handle-col { top: 0; bottom: 0; width: 14px; margin-left: -7px; }
.track-handle-col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; transform: translateX(-50%); background: color-mix(in srgb, var(--el-color-primary) 70%, var(--el-bg-color)); opacity: 0.9; }
.track-handle-col:hover::before,
.track-handle-col:active::before { width: 3px; background: var(--el-color-primary); }
.track-handle-edge::before { background: var(--el-color-primary); opacity: 1; }
.track-handle-edge.track-handle-col::before { width: 3px; }
.track-handle-row { left: 0; right: 0; height: 14px; margin-top: -7px; cursor: row-resize; }
.track-handle-row::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; transform: translateY(-50%); background: color-mix(in srgb, var(--el-color-primary) 70%, var(--el-bg-color)); opacity: 0.9; }
.track-handle-row:hover::before,
.track-handle-row:active::before { height: 3px; background: var(--el-color-primary); }
.track-handle-edge.track-handle-row::before { height: 3px; }
.variable-group { display: flex; flex-direction: column; gap: 6px; }
.variable-group > span { color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.variable-chip { min-height: 42px; padding: 7px 9px; border-radius: 6px; font-size: 13px; line-height: 17px; }
.variable-chip small { margin-top: 2px; font-size: 11px; line-height: 15px; }
.xy-grid, .element-actions, .job-form { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.element-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.element-actions :deep(.el-button) { white-space: nowrap; }
.table-frame-grid, .table-size-grid { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.table-frame-grid :deep(.el-form-item) { margin-bottom: 0; }
.table-size-grid :deep(.el-form-item:nth-child(3)) { grid-column: 1 / -1; }
.table-size-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.table-size-list > span { color: var(--el-text-color-secondary); font-size: 12px; }
.template-actions { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.template-actions :deep(.el-button) { margin-left: 0; }
.preview-dialog-summary { justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.preview-dialog-summary strong, .preview-dialog-summary span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-dialog-body { max-height: 52vh; margin: 0; overflow: auto; padding: 12px; border-radius: 6px; background: var(--el-fill-color-lighter); color: var(--el-text-color-primary); font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
.object-dialog-search { margin-bottom: 10px; }
.object-dialog-filters { display: grid; gap: 10px; margin-bottom: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.object-variable-preview { display: block; overflow: hidden; color: var(--el-text-color-secondary); text-overflow: ellipsis; white-space: nowrap; }
.primary-cell { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.primary-cell span, .copy-cell span { overflow: hidden; color: var(--el-text-color-secondary); text-overflow: ellipsis; white-space: nowrap; }
.copy-cell { min-width: 0; gap: 6px; }
.table-actions { display: inline-flex; flex-wrap: nowrap; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; }
.table-actions :deep(.el-button) { flex: 0 0 auto; margin-left: 0; }
.status-tags { display: inline-flex; flex-wrap: nowrap; align-items: center; gap: 6px; white-space: nowrap; }
.status-tags :deep(.el-tag) { flex: 0 0 auto; }
.tag-gap { margin-left: 6px; }
.job-form { margin-bottom: 12px; grid-template-columns: minmax(220px, 1fr) 120px 140px minmax(200px, 1fr); }
@media (max-width: 1280px) { .designer-shell { grid-template-columns: 1fr; } .right-panel { border-top: 1px solid var(--el-border-color-light); border-left: 0; grid-column: 1 / -1; } .paper-config { grid-template-columns: 1fr; } }
@media (max-width: 1100px) { .print-workbench, .label-preview-layout { grid-template-columns: 1fr; } .print-setup-panel { border-right: 0; border-bottom: 1px solid var(--el-border-color-light); } .label-thumbnail-list { max-height: 168px; } }
@media (max-width: 900px) { .page-header, .canvas-toolbar, .preview-dialog-summary, .step-heading, .object-step-panel, .output-toolbar, .overview-actions, .print-preview-header { align-items: stretch; flex-direction: column; } .designer-shell, .paper-form, .job-form, .object-dialog-filters, .business-type-grid { grid-template-columns: 1fr; } .left-panel { border-right: 0; border-bottom: 1px solid var(--el-border-color-light); } }
</style>
