export type BarcodeBusinessType = 'MATERIAL' | 'PROD_ORDER' | 'WMS_LOCATION';

export type BarcodeElementKind = 'qr' | 'text';

export type BarcodePaperOrientation = 'landscape' | 'portrait';

export type BarcodeTableCellAlign = 'center' | 'left' | 'right';

export type BarcodeTableCellOverflow = 'ellipsis' | 'multiline-ellipsis' | 'wrap';

export type BarcodeTableCellType = 'empty' | 'qr' | 'staticText' | 'textBox' | 'variableText';

export interface BarcodeBusinessTypeOption {
  description: string;
  label: string;
  scenarioCode: string;
  value: BarcodeBusinessType;
}

export interface BarcodeVariable {
  key: string;
  label: string;
  source: 'business' | 'system';
  value: string;
}

export interface BarcodeBusinessObject {
  key: string;
  raw?: Record<string, any>;
  subtitle?: string;
  title: string;
  variables: Record<string, any>;
}

export interface BarcodePaper {
  height: number;
  margin: number;
  orientation: BarcodePaperOrientation;
  unit: 'mm';
  width: number;
}

export interface BarcodePaperPreset {
  description: string;
  height: number;
  label: string;
  margin: number;
  orientation: BarcodePaperOrientation;
  width: number;
}

export interface BarcodeDesignerElement {
  binding: string;
  fontSize: number;
  h: number;
  id: string;
  kind: BarcodeElementKind;
  label: string;
  value?: string;
  w: number;
  x: number;
  y: number;
}

export interface BarcodeDesignerState {
  cells: BarcodeTableCell[];
  elements: BarcodeDesignerElement[];
  paper: BarcodePaper;
  table: BarcodeTableLayout;
}

export interface BarcodeDesignerLayout {
  elements: BarcodeDesignerElement[];
  paper: BarcodePaper;
  version: 2;
}

export interface BarcodeTableLayout {
  border: boolean;
  cols: number;
  columnWidths: number[];
  height?: number;
  rowHeights: number[];
  rows: number;
  width?: number;
  x?: number;
  y?: number;
}

export interface BarcodeTableCell {
  align: BarcodeTableCellAlign;
  binding?: string;
  col: number;
  colSpan: number;
  fontSize: number;
  id: string;
  overflow: BarcodeTableCellOverflow;
  padding: number;
  qrSize?: number;
  row: number;
  rowSpan: number;
  text?: string;
  type: BarcodeTableCellType;
  verticalAlign: 'bottom' | 'middle' | 'top';
}

export interface BarcodeTableDesignerLayout {
  cells: BarcodeTableCell[];
  elements?: BarcodeDesignerElement[];
  paper: BarcodePaper;
  table: BarcodeTableLayout;
  version: 3;
}

export interface BarcodeRenderedLabel {
  businessKey: string;
  cells: BarcodeRenderedLabelCell[];
  objectTitle: string;
  paper: BarcodePaper;
  table: BarcodeTableLayout;
}

export interface BarcodeRenderedLabelCell extends BarcodeTableCell {
  displayValue: string;
  lineClamp?: number;
  qrSide?: number;
}

export const MIN_TABLE_TRACK_MM = 4;

export const BARCODE_BUSINESS_TYPES: BarcodeBusinessTypeOption[] = [
  {
    description: '从物料编码、名称、规格型号生成物料识别标签',
    label: '物料标签',
    scenarioCode: 'MATERIAL_LABEL',
    value: 'MATERIAL',
  },
  {
    description: '从 WMS 库位生成库位标识与上架/拣货扫码标签',
    label: '库位标签',
    scenarioCode: 'LOCATION_LABEL',
    value: 'WMS_LOCATION',
  },
  {
    description: '从生产工单生成现场流转、报工与追溯标签',
    label: '生产工单标签',
    scenarioCode: 'PROD_ORDER_LABEL',
    value: 'PROD_ORDER',
  },
];

export const BARCODE_SYSTEM_VARIABLES: BarcodeVariable[] = [
  { key: 'rawValue', label: '二维码内容', source: 'system', value: 'MESQR:v2:A:MATERIAL:M-001:PREVIEW' },
  { key: 'erpAcctCode', label: 'ERP账套', source: 'system', value: 'A' },
  { key: 'businessType', label: '业务类型', source: 'system', value: 'MATERIAL' },
  { key: 'businessKey', label: '业务对象编码', source: 'system', value: 'M-001' },
  { key: 'token', label: '条码令牌', source: 'system', value: 'PREVIEW' },
  { key: 'printTime', label: '打印时间', source: 'system', value: '2026-07-02 09:00' },
  { key: 'printBy', label: '打印人', source: 'system', value: '当前用户' },
];

export const PAPER_PRESETS: BarcodePaperPreset[] = [
  { description: '常见物料与工单小标签', height: 40, label: '60 x 40', margin: 2, orientation: 'landscape', width: 60 },
  { description: '窄版库位/料架标签', height: 30, label: '50 x 30', margin: 2, orientation: 'landscape', width: 50 },
  { description: '大物料铭牌标签', height: 50, label: '80 x 50', margin: 3, orientation: 'landscape', width: 80 },
  { description: '竖向设备/容器标签', height: 60, label: '40 x 60', margin: 2, orientation: 'portrait', width: 40 },
];

const VARIABLE_LABELS: Record<BarcodeBusinessType, Array<[string, string]>> = {
  MATERIAL: [
    ['materialCode', '物料编码'],
    ['materialName', '物料名称'],
    ['materialSpec', '规格型号'],
  ],
  PROD_ORDER: [
    ['orderNo', '工单号'],
    ['productCode', '产品编码'],
    ['productName', '产品名称'],
    ['planQty', '计划数量'],
    ['statusName', '工单状态'],
  ],
  WMS_LOCATION: [
    ['locationCode', '库位编码'],
    ['locationName', '库位名称'],
    ['stockNumber', '仓库编码'],
    ['stockName', '仓库名称'],
  ],
};

export function resolveBusinessTypeLabel(value?: string) {
  const raw = (value || '').trim();
  const normalized = raw.toUpperCase();
  if (normalized === 'LOCATION') return '库位标签';
  if (normalized === 'QR') return '物料标签';
  return BARCODE_BUSINESS_TYPES.find((item) => item.value === normalized)?.label || raw;
}

export function normalizeBusinessType(value?: string): BarcodeBusinessType {
  const normalized = (value || 'MATERIAL').trim().toUpperCase();
  if (normalized === 'LOCATION') return 'WMS_LOCATION';
  if (normalized === 'QR') return 'MATERIAL';
  if (normalized === 'PROD_ORDER' || normalized === 'WMS_LOCATION' || normalized === 'MATERIAL') {
    return normalized;
  }
  return 'MATERIAL';
}

export function scenarioForBusinessType(value?: string) {
  const businessType = normalizeBusinessType(value);
  return BARCODE_BUSINESS_TYPES.find((item) => item.value === businessType)?.scenarioCode || 'DEFAULT';
}

export function createDefaultDesignerState(): BarcodeDesignerState {
  return {
    cells: [
      createDefaultTableCell('cell-0-0', 0, 0, { text: '物料编码', type: 'staticText' }),
      createDefaultTableCell('cell-0-1', 0, 1, { binding: 'materialCode', type: 'variableText' }),
      createDefaultTableCell('cell-1-0', 1, 0, { text: '二维码', type: 'staticText' }),
      createDefaultTableCell('cell-1-1', 1, 1, { binding: 'rawValue', qrSize: 18, type: 'qr' }),
    ],
    elements: [],
    paper: {
      height: 40,
      margin: 2,
      orientation: 'landscape',
      unit: 'mm',
      width: 60,
    },
    table: {
      border: true,
      cols: 2,
      columnWidths: [20, 36],
      height: 36,
      rowHeights: [10, 26],
      rows: 2,
      width: 56,
      x: 2,
      y: 2,
    },
  };
}

export function applyPaperPreset(paper: BarcodePaper, preset: BarcodePaperPreset) {
  paper.height = preset.height;
  paper.margin = preset.margin;
  paper.orientation = preset.orientation;
  paper.unit = 'mm';
  paper.width = preset.width;
}

export function buildObjectVariableCatalog(
  businessType: BarcodeBusinessType | string,
  object?: BarcodeBusinessObject | null,
): BarcodeVariable[] {
  const normalized = normalizeBusinessType(businessType);
  const variables = object?.variables || {};
  return VARIABLE_LABELS[normalized].map(([key, label]) => ({
    key,
    label,
    source: 'business',
    value: stringifyValue(variables[key]),
  }));
}

export function buildSystemVariables(input: {
  businessKey?: string;
  businessType?: string;
  erpAcctCode?: string;
  rawValue?: string;
  token?: string;
}): BarcodeVariable[] {
  const businessType = normalizeBusinessType(input.businessType);
  const businessKey = input.businessKey || sampleKeyForBusinessType(businessType);
  const erpAcctCode = input.erpAcctCode || 'A';
  const token = input.token || 'PREVIEW';
  const rawValue = input.rawValue || `MESQR:v2:${erpAcctCode}:${businessType}:${businessKey}:${token}`;
  const values: Record<string, string> = {
    businessKey,
    businessType,
    erpAcctCode,
    printBy: '当前用户',
    printTime: new Date().toLocaleString(),
    rawValue,
    token,
  };
  return BARCODE_SYSTEM_VARIABLES.map((item) => ({ ...item, value: values[item.key] || item.value }));
}

export function createElementFromVariable(
  kind: BarcodeElementKind,
  variable: Pick<BarcodeVariable, 'key' | 'label' | 'value'>,
  x = 4,
  y = 4,
): BarcodeDesignerElement {
  const qr = kind === 'qr';
  return {
    binding: variable.key,
    fontSize: qr ? 0 : 3.2,
    h: qr ? 18 : 6,
    id: `${kind}-${variable.key}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    kind,
    label: variable.label,
    value: variable.value,
    w: qr ? 18 : 28,
    x,
    y,
  };
}

export function clampDesignerElementPosition(element: BarcodeDesignerElement, paper: BarcodePaper) {
  element.w = clamp(element.w, 4, paper.width);
  element.h = clamp(element.h, 4, paper.height);
  element.x = clamp(element.x, 0, Math.max(0, paper.width - element.w));
  element.y = clamp(element.y, 0, Math.max(0, paper.height - element.h));
}

export function buildDesignerLayout(state: BarcodeDesignerState): BarcodeDesignerLayout {
  return {
    elements: state.elements.map((element) => ({ ...element })),
    paper: { ...state.paper },
    version: 2,
  };
}

export function toTemplatePayloadJson(state: BarcodeDesignerState) {
  const layout = buildTableDesignerLayout(state);
  return {
    layoutJson: JSON.stringify(layout),
    paramSchemaJson: JSON.stringify({
      required: Array.from(new Set(layout.cells.map((item) => item.binding).filter(Boolean))),
    }),
  };
}

export function buildTableDesignerLayout(state: BarcodeDesignerState): BarcodeTableDesignerLayout {
  const table = normalizeTableTrackSizes(state.table, state.paper);
  return {
    cells: state.cells.map((cell) => ({ ...cell })),
    elements: state.elements.map((element) => ({ ...element })),
    paper: { ...state.paper },
    table: {
      ...table,
      columnWidths: [...table.columnWidths],
      rowHeights: [...table.rowHeights],
    },
    version: 3,
  };
}

export function normalizeDesignerLayout(layoutJson?: string | null): BarcodeDesignerState {
  const fallback = createDefaultDesignerState();
  if (!layoutJson || !layoutJson.trim()) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(layoutJson);
    if ((parsed.version === 3 || parsed.version == null) && parsed.paper && parsed.table && Array.isArray(parsed.cells)) {
      const paper = normalizePaper(parsed.paper, fallback.paper);
      return {
        cells: parsed.cells.map((item: any, index: number) => normalizeTableCell(item, index)),
        elements: Array.isArray(parsed.elements)
          ? parsed.elements.map((item: any, index: number) => normalizeElement(item, index))
          : [],
        paper,
        table: normalizeTable(parsed.table, fallback.table, paper),
      };
    }
    if (parsed.version === 2 && parsed.paper && Array.isArray(parsed.elements)) {
      return {
        cells: legacyElementsToCells(parsed.elements),
        elements: parsed.elements.map((item: any, index: number) => normalizeElement(item, index)),
        paper: normalizePaper(parsed.paper, fallback.paper),
        table: fallback.table,
      };
    }
    if (Array.isArray(parsed.elements)) {
      return {
        ...fallback,
        cells: legacyElementsToCells(parsed.elements),
        elements: parsed.elements.map((item: any, index: number) => legacyElementToDesigner(item, index)),
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function createDefaultTableCell(
  id: string,
  row: number,
  col: number,
  overrides: Partial<BarcodeTableCell> = {},
): BarcodeTableCell {
  return {
    align: 'left',
    col,
    colSpan: 1,
    fontSize: 3.2,
    id,
    overflow: 'wrap',
    padding: 1,
    row,
    rowSpan: 1,
    type: 'empty',
    verticalAlign: 'middle',
    ...overrides,
  };
}

export function createScenarioCode(businessType: string, scenarioName: string) {
  const prefix = normalizeBusinessType(businessType);
  const raw = (scenarioName || '').trim();
  const ascii = raw
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  if (ascii) return `${prefix}_${ascii}`;
  return `${prefix}_CUSTOM_${hashText(raw || 'DEFAULT')}`;
}

export function buildBatchPrintJobPayloads(input: {
  businessObjects: BarcodeBusinessObject[];
  businessType: BarcodeBusinessType | string;
  copies?: number;
  erpAcctCode?: string;
  maxReprintCount?: number;
  scenarioCode: string;
  scenarioName?: string;
  templateId?: number;
  tenantId?: number;
}) {
  const businessType = normalizeBusinessType(input.businessType);
  return input.businessObjects.map((object) => ({
    businessKey: object.key,
    businessType,
    copies: input.copies || 1,
    erpAcctCode: input.erpAcctCode || '',
    idempotencyKey: `barcode-${businessType}-${input.scenarioCode}-${object.key}-${Date.now()}`,
    maxReprintCount: input.maxReprintCount ?? 3,
    scenarioCode: input.scenarioCode,
    scenarioName: input.scenarioName,
    templateId: input.templateId,
    tenantId: input.tenantId,
  }));
}

export function renderLabelPreview(
  layout: BarcodeDesignerState | BarcodeTableDesignerLayout | string,
  businessObject: BarcodeBusinessObject,
  context: {
    businessType?: string;
    erpAcctCode?: string;
    printBy?: string;
    rawValue?: string;
    token?: string;
  } = {},
): BarcodeRenderedLabel {
  const state = typeof layout === 'string' ? normalizeDesignerLayout(layout) : normalizeDesignerLayout(JSON.stringify(layout));
  const businessType = normalizeBusinessType(context.businessType);
  const token = context.token || 'PREVIEW';
  const rawValue = context.rawValue || `MESQR:v2:${context.erpAcctCode || 'A'}:${businessType}:${businessObject.key}:${token}`;
  const variables: Record<string, string> = {
    ...Object.fromEntries(Object.entries(businessObject.variables || {}).map(([key, value]) => [key, stringifyValue(value)])),
    businessKey: businessObject.key,
    businessType,
    erpAcctCode: context.erpAcctCode || 'A',
    printBy: context.printBy || '当前用户',
    printTime: new Date().toLocaleString(),
    rawValue,
    token,
  };
  return {
    businessKey: businessObject.key,
    cells: state.cells.map((cell) => ({
      ...cell,
      displayValue: resolveCellDisplayValue(cell, variables),
      lineClamp: calculateTableCellLineClamp(cell, state, 7),
      qrSide: cell.type === 'qr' ? calculateQrSideMm(cell, state) : undefined,
    })),
    objectTitle: businessObject.title,
    paper: state.paper,
    table: state.table,
  };
}

export function calculateTableCellLineClamp(
  cell: Pick<BarcodeTableCell, 'fontSize' | 'padding' | 'row' | 'rowSpan'>,
  layout: { paper: Pick<BarcodePaper, 'height'>; table: Pick<BarcodeTableLayout, 'rowHeights' | 'rows'> },
  scale = 5,
) {
  const rowHeights = layout.table.rowHeights.length > 0
    ? layout.table.rowHeights
    : Array.from({ length: Math.max(1, Math.floor(numeric(layout.table.rows, 1))) }, () => 1);
  const tracks = rowHeights.map((value) => Math.max(MIN_TABLE_TRACK_MM, numeric(value, MIN_TABLE_TRACK_MM)));
  const startRow = clamp(Math.floor(numeric(cell.row, 0)), 0, Math.max(tracks.length - 1, 0));
  const rowSpan = Math.max(1, Math.floor(numeric(cell.rowSpan, 1)));
  const cellHeightMm = tracks.slice(startRow, startRow + rowSpan).reduce((sum, value) => sum + value, 0) || tracks[startRow] || MIN_TABLE_TRACK_MM;
  const cellHeightPx = Math.max(1, cellHeightMm * scale);
  const fontPx = Math.max(2.4, numeric(cell.fontSize, 3.2)) * 4;
  const paddingPx = Math.max(0, numeric(cell.padding, 0)) * 4;
  const lineHeightPx = fontPx * 1.2;
  const contentHeightPx = Math.max(lineHeightPx, cellHeightPx - paddingPx * 2);
  return Math.max(1, Math.floor(contentHeightPx / lineHeightPx));
}

export function calculateTableCellBoxMm(
  cell: Pick<BarcodeTableCell, 'col' | 'colSpan' | 'padding' | 'row' | 'rowSpan'>,
  layout: { table: Pick<BarcodeTableLayout, 'columnWidths' | 'cols' | 'rowHeights' | 'rows'> },
) {
  const columnWidths = layout.table.columnWidths.length > 0
    ? layout.table.columnWidths
    : Array.from({ length: Math.max(1, Math.floor(numeric(layout.table.cols, 1))) }, () => MIN_TABLE_TRACK_MM);
  const rowHeights = layout.table.rowHeights.length > 0
    ? layout.table.rowHeights
    : Array.from({ length: Math.max(1, Math.floor(numeric(layout.table.rows, 1))) }, () => MIN_TABLE_TRACK_MM);
  const safeColumns = columnWidths.map((value) => Math.max(MIN_TABLE_TRACK_MM, numeric(value, MIN_TABLE_TRACK_MM)));
  const safeRows = rowHeights.map((value) => Math.max(MIN_TABLE_TRACK_MM, numeric(value, MIN_TABLE_TRACK_MM)));
  const startCol = clamp(Math.floor(numeric(cell.col, 0)), 0, Math.max(safeColumns.length - 1, 0));
  const startRow = clamp(Math.floor(numeric(cell.row, 0)), 0, Math.max(safeRows.length - 1, 0));
  const colSpan = Math.max(1, Math.floor(numeric(cell.colSpan, 1)));
  const rowSpan = Math.max(1, Math.floor(numeric(cell.rowSpan, 1)));
  const width = safeColumns.slice(startCol, startCol + colSpan).reduce((sum, value) => sum + value, 0) || safeColumns[startCol] || MIN_TABLE_TRACK_MM;
  const height = safeRows.slice(startRow, startRow + rowSpan).reduce((sum, value) => sum + value, 0) || safeRows[startRow] || MIN_TABLE_TRACK_MM;
  const padding = Math.max(0, numeric(cell.padding, 0));
  return {
    contentHeight: roundMm(Math.max(1, height - padding * 2)),
    contentWidth: roundMm(Math.max(1, width - padding * 2)),
    height: roundMm(height),
    width: roundMm(width),
  };
}

export function calculateQrSideMm(
  cell: Pick<BarcodeTableCell, 'col' | 'colSpan' | 'padding' | 'qrSize' | 'row' | 'rowSpan'>,
  layout: { table: Pick<BarcodeTableLayout, 'columnWidths' | 'cols' | 'rowHeights' | 'rows'> },
) {
  const box = calculateTableCellBoxMm(cell, layout);
  const maxSide = Math.max(1, Math.min(box.contentWidth, box.contentHeight));
  const requestedSide = cell.qrSize == null || Number(cell.qrSize) <= 0
    ? maxSide
    : Math.min(numeric(cell.qrSize, maxSide), maxSide);
  return roundMm(Math.max(1, requestedSide));
}

export function normalizeTableTrackSizes(
  table: BarcodeTableLayout,
  paper: Pick<BarcodePaper, 'height' | 'margin' | 'width'>,
): BarcodeTableLayout {
  const rows = Math.max(1, Math.floor(numeric(table.rows, 1)));
  const cols = Math.max(1, Math.floor(numeric(table.cols, 1)));
  const paperWidth = numeric(paper.width, 60);
  const paperHeight = numeric(paper.height, 40);
  const x = clamp(numeric(table.x, numeric(paper.margin, 0)), 0, Math.max(0, paperWidth - cols * MIN_TABLE_TRACK_MM));
  const y = clamp(numeric(table.y, numeric(paper.margin, 0)), 0, Math.max(0, paperHeight - rows * MIN_TABLE_TRACK_MM));
  const maxWidth = Math.max(cols * MIN_TABLE_TRACK_MM, paperWidth - x);
  const maxHeight = Math.max(rows * MIN_TABLE_TRACK_MM, paperHeight - y);
  const widthInput = normalizeNumberArray(table.columnWidths, cols, maxWidth / Math.max(1, cols));
  const heightInput = normalizeNumberArray(table.rowHeights, rows, maxHeight / Math.max(1, rows));
  const requestedWidth = widthInput.every((item) => item < MIN_TABLE_TRACK_MM)
    ? maxWidth
    : numeric(table.width, widthInput.reduce((sum, item) => sum + item, 0));
  const requestedHeight = heightInput.every((item) => item < MIN_TABLE_TRACK_MM)
    ? maxHeight
    : numeric(table.height, heightInput.reduce((sum, item) => sum + item, 0));
  const contentWidth = clamp(requestedWidth, cols * MIN_TABLE_TRACK_MM, maxWidth);
  const contentHeight = clamp(requestedHeight, rows * MIN_TABLE_TRACK_MM, maxHeight);
  return {
    border: table.border !== false,
    cols,
    height: roundMm(contentHeight),
    columnWidths: normalizeTrackArray(table.columnWidths, cols, contentWidth),
    rowHeights: normalizeTrackArray(table.rowHeights, rows, contentHeight),
    rows,
    width: roundMm(contentWidth),
    x,
    y,
  };
}

export function resizeAdjacentTableTrack(
  tracks: number[],
  beforeIndex: number,
  deltaMm: number,
  minTrack = MIN_TABLE_TRACK_MM,
) {
  const index = Math.floor(numeric(beforeIndex, 0));
  if (index < 0 || index >= tracks.length - 1) return [...tracks];
  const next = tracks.map((value) => Math.max(minTrack, roundMm(numeric(value, minTrack))));
  const pairTotal = next[index]! + next[index + 1]!;
  const resizedBefore = clamp(next[index]! + numeric(deltaMm, 0), minTrack, pairTotal - minTrack);
  next[index] = roundMm(resizedBefore);
  next[index + 1] = roundMm(pairTotal - next[index]!);
  return next;
}

export function resizeTableBoundary(
  table: BarcodeTableLayout,
  paper: Pick<BarcodePaper, 'height' | 'margin' | 'width'>,
  axis: 'col' | 'row',
  edge: 'end' | 'start',
  deltaMm: number,
): BarcodeTableLayout {
  const normalized = normalizeTableTrackSizes(table, paper);
  if (axis === 'col') {
    const minWidth = normalized.cols * MIN_TABLE_TRACK_MM;
    const currentX = numeric(normalized.x, 0);
    const currentWidth = normalized.columnWidths.reduce((sum, item) => sum + item, 0);
    let nextX = currentX;
    let nextWidth = currentWidth;
    if (edge === 'start') {
      nextX = clamp(currentX + numeric(deltaMm, 0), 0, currentX + currentWidth - minWidth);
      nextWidth = currentWidth + currentX - nextX;
    } else {
      nextWidth = clamp(currentWidth + numeric(deltaMm, 0), minWidth, numeric(paper.width, 60) - currentX);
    }
    return { ...normalized, columnWidths: scaleTracks(normalized.columnWidths, nextWidth), x: roundMm(nextX) };
  }

  const minHeight = normalized.rows * MIN_TABLE_TRACK_MM;
  const currentY = numeric(normalized.y, 0);
  const currentHeight = normalized.rowHeights.reduce((sum, item) => sum + item, 0);
  let nextY = currentY;
  let nextHeight = currentHeight;
  if (edge === 'start') {
    nextY = clamp(currentY + numeric(deltaMm, 0), 0, currentY + currentHeight - minHeight);
    nextHeight = currentHeight + currentY - nextY;
  } else {
    nextHeight = clamp(currentHeight + numeric(deltaMm, 0), minHeight, numeric(paper.height, 40) - currentY);
  }
  return { ...normalized, rowHeights: scaleTracks(normalized.rowHeights, nextHeight), y: roundMm(nextY) };
}

export function resolveVariableValue(element: BarcodeDesignerElement, variables: BarcodeVariable[]) {
  return variables.find((item) => item.key === element.binding)?.value || element.value || `{${element.binding}}`;
}

export function sampleKeyForBusinessType(businessType: BarcodeBusinessType) {
  if (businessType === 'WMS_LOCATION') return 'LOC-A01';
  if (businessType === 'PROD_ORDER') return 'MO202607020001';
  return 'M-001';
}

function legacyElementToDesigner(item: any, index: number): BarcodeDesignerElement {
  const kind: BarcodeElementKind = item.type === 'qr' ? 'qr' : 'text';
  const binding = item.field || item.binding || 'businessKey';
  return {
    binding,
    fontSize: kind === 'qr' ? 0 : 3.2,
    h: kind === 'qr' ? 18 : 6,
    id: `legacy-${index}`,
    kind,
    label: binding,
    value: item.value,
    w: kind === 'qr' ? 18 : 28,
    x: numeric(item.x, kind === 'qr' ? 4 : 26),
    y: numeric(item.y, 4 + index * 7),
  };
}

function normalizeElement(item: any, index: number): BarcodeDesignerElement {
  const kind: BarcodeElementKind = item.kind === 'qr' ? 'qr' : 'text';
  return {
    binding: String(item.binding || item.field || 'businessKey'),
    fontSize: numeric(item.fontSize, kind === 'qr' ? 0 : 3.2),
    h: numeric(item.h, kind === 'qr' ? 18 : 6),
    id: String(item.id || `element-${index}`),
    kind,
    label: String(item.label || item.binding || '变量'),
    value: item.value == null ? undefined : String(item.value),
    w: numeric(item.w, kind === 'qr' ? 18 : 28),
    x: numeric(item.x, 4),
    y: numeric(item.y, 4 + index * 7),
  };
}

function normalizePaper(item: any, fallback: BarcodePaper): BarcodePaper {
  return {
    height: numeric(item.height, fallback.height),
    margin: numeric(item.margin, fallback.margin),
    orientation: item.orientation === 'portrait' ? 'portrait' : 'landscape',
    unit: 'mm',
    width: numeric(item.width, fallback.width),
  };
}

function normalizeTable(item: any, fallback: BarcodeTableLayout, paper: BarcodePaper): BarcodeTableLayout {
  const rows = Math.max(1, Math.floor(numeric(item.rows, fallback.rows)));
  const cols = Math.max(1, Math.floor(numeric(item.cols, fallback.cols)));
  const fallbackHeight = fallback.height || fallback.rowHeights.reduce((sum, value) => sum + value, 0);
  const fallbackWidth = fallback.width || fallback.columnWidths.reduce((sum, value) => sum + value, 0);
  return normalizeTableTrackSizes({
    border: item.border !== false,
    cols,
    columnWidths: normalizeNumberArray(item.columnWidths, cols, fallback.columnWidths[0] || 20),
    height: numeric(item.height, fallbackHeight),
    rowHeights: normalizeNumberArray(item.rowHeights, rows, fallback.rowHeights[0] || 10),
    rows,
    width: numeric(item.width, fallbackWidth),
    x: numeric(item.x, fallback.x || 0),
    y: numeric(item.y, fallback.y || 0),
  }, paper);
}

function normalizeTableCell(item: any, index: number): BarcodeTableCell {
  const type: BarcodeTableCellType = ['empty', 'qr', 'staticText', 'textBox', 'variableText'].includes(item.type)
    ? item.type
    : 'empty';
  const overflow: BarcodeTableCellOverflow = ['ellipsis', 'multiline-ellipsis', 'wrap'].includes(item.overflow)
    ? item.overflow
    : 'wrap';
  const align: BarcodeTableCellAlign = ['center', 'left', 'right'].includes(item.align) ? item.align : 'left';
  return createDefaultTableCell(String(item.id || `cell-${index}`), numeric(item.row, 0), numeric(item.col, 0), {
    align,
    binding: item.binding == null ? undefined : String(item.binding),
    colSpan: Math.max(1, Math.floor(numeric(item.colSpan, 1))),
    fontSize: numeric(item.fontSize, 3.2),
    overflow,
    padding: numeric(item.padding, 1),
    qrSize: item.qrSize == null ? undefined : numeric(item.qrSize, 18),
    rowSpan: Math.max(1, Math.floor(numeric(item.rowSpan, 1))),
    text: item.text == null ? undefined : String(item.text),
    type,
    verticalAlign: ['bottom', 'middle', 'top'].includes(item.verticalAlign) ? item.verticalAlign : 'middle',
  });
}

function legacyElementsToCells(elements: any[]): BarcodeTableCell[] {
  return elements.map((item, index) => {
    const normalized = legacyElementToDesigner(item, index);
    return createDefaultTableCell(`legacy-cell-${index}`, index, 0, {
      binding: normalized.binding,
      qrSize: normalized.kind === 'qr' ? normalized.w : undefined,
      text: normalized.kind === 'text' ? normalized.value : undefined,
      type: normalized.kind === 'qr' ? 'qr' : 'variableText',
    });
  });
}

function normalizeNumberArray(value: any, length: number, fallbackValue: number) {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => numeric(list[index], fallbackValue));
}

function normalizeTrackArray(value: any, length: number, targetTotal: number) {
  const list = normalizeNumberArray(value, length, targetTotal / Math.max(1, length))
    .map((item) => Math.max(0.1, numeric(item, 1)));
  const total = list.reduce((sum, item) => sum + item, 0) || 1;
  const minTotal = MIN_TABLE_TRACK_MM * length;
  const usableTotal = Math.max(minTotal, targetTotal);
  const scaled = list.map((item) => Math.max(MIN_TABLE_TRACK_MM, item * usableTotal / total));
  const scaledTotal = scaled.reduce((sum, item) => sum + item, 0) || 1;
  const normalized = scaled.map((item) => roundMm(item * usableTotal / scaledTotal));
  const diff = roundMm(usableTotal - normalized.reduce((sum, item) => sum + item, 0));
  normalized[normalized.length - 1] = roundMm((normalized[normalized.length - 1] || MIN_TABLE_TRACK_MM) + diff);
  return normalized;
}

function scaleTracks(tracks: number[], targetTotal: number) {
  return normalizeTrackArray(tracks, tracks.length, targetTotal);
}

function roundMm(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveCellDisplayValue(cell: BarcodeTableCell, variables: Record<string, string>) {
  if (cell.type === 'empty') return '';
  if (cell.type === 'staticText' || cell.type === 'textBox') return cell.text || '';
  if (cell.type === 'qr') return variables[cell.binding || 'rawValue'] || variables.rawValue || '';
  return variables[cell.binding || ''] || `{${cell.binding || ''}}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function numeric(value: any, defaultValue: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stringifyValue(value: any) {
  if (value == null) return '';
  return String(value);
}
