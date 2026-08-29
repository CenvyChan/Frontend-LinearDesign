import { describe, expect, it } from 'vitest';

import {
  BARCODE_BUSINESS_TYPES,
  BARCODE_SYSTEM_VARIABLES,
  applyPaperPreset,
  buildBatchPrintJobPayloads,
  buildDesignerLayout,
  buildObjectVariableCatalog,
  calculateQrSideMm,
  calculateTableCellBoxMm,
  calculateTableCellLineClamp,
  createDefaultTableCell,
  clampDesignerElementPosition,
  createDefaultDesignerState,
  createElementFromVariable,
  createScenarioCode,
  PAPER_PRESETS,
  normalizeDesignerLayout,
  normalizeTableTrackSizes,
  renderLabelPreview,
  resizeAdjacentTableTrack,
  resolveBusinessTypeLabel,
  toTemplatePayloadJson,
} from './barcode-design-print-model';

describe('barcode design print model', () => {
  it('exposes Chinese business type labels and default paper settings', () => {
    expect(BARCODE_BUSINESS_TYPES.map((item) => [item.value, item.label])).toEqual([
      ['MATERIAL', '物料标签'],
      ['WMS_LOCATION', '库位标签'],
      ['PROD_ORDER', '生产工单标签'],
    ]);
    expect(resolveBusinessTypeLabel('prod_order')).toBe('生产工单标签');
    expect(resolveBusinessTypeLabel('UNKNOWN')).toBe('UNKNOWN');

    expect(createDefaultDesignerState()).toMatchObject({
      paper: {
        height: 40,
        margin: 2,
        orientation: 'landscape',
        unit: 'mm',
        width: 60,
      },
    });
  });

  it('builds variable catalogs from selected business objects', () => {
    const variables = buildObjectVariableCatalog('MATERIAL', {
      key: 'M-001',
      title: 'M-001 / 主轴',
      variables: {
        materialCode: 'M-001',
        materialName: '主轴',
        materialSpec: 'A30',
      },
    });

    expect(variables.map((item) => [item.key, item.label, item.value])).toEqual([
      ['materialCode', '物料编码', 'M-001'],
      ['materialName', '物料名称', '主轴'],
      ['materialSpec', '规格型号', 'A30'],
    ]);
    expect(BARCODE_SYSTEM_VARIABLES.map((item) => item.key)).toContain('printTime');
  });

  it('creates canvas elements and serializes template layout json', () => {
    const state = createDefaultDesignerState();
    state.elements = [
      createElementFromVariable('qr', { key: 'rawValue', label: '二维码内容', value: 'MESQR:v2:A:MATERIAL:M-001:T' }, 4, 5),
      createElementFromVariable('text', { key: 'materialCode', label: '物料编码', value: 'M-001' }, 26, 7),
    ];

    const layout = buildDesignerLayout(state);

    expect(layout.paper).toMatchObject({ height: 40, width: 60 });
    expect(layout.elements).toHaveLength(2);
    expect(layout.elements[0]).toMatchObject({
      binding: 'rawValue',
      kind: 'qr',
      x: 4,
      y: 5,
    });

    const { layoutJson, paramSchemaJson } = toTemplatePayloadJson(state);
    expect(JSON.parse(layoutJson)).toMatchObject({
      version: 3,
      paper: { height: 40, width: 60 },
    });
    expect(JSON.parse(paramSchemaJson).required).toEqual(['materialCode', 'rawValue']);
  });

  it('creates table based label layouts with fixed text, variables, and qr cells', () => {
    const state = createDefaultDesignerState();
    state.table.rows = 2;
    state.table.cols = 3;
    state.table.columnWidths = [18, 24, 18];
    state.table.rowHeights = [10, 24];
    state.cells = [
      createDefaultTableCell('cell-0-0', 0, 0, { text: '物料编码', type: 'staticText' }),
      createDefaultTableCell('cell-0-1', 0, 1, { binding: 'materialCode', overflow: 'ellipsis', type: 'variableText' }),
      createDefaultTableCell('cell-0-2', 0, 2, { binding: 'rawValue', qrSize: 18, type: 'qr' }),
    ];

    const { layoutJson, paramSchemaJson } = toTemplatePayloadJson(state);
    const layout = JSON.parse(layoutJson);

    expect(layout.version).toBe(3);
    expect(layout.table).toMatchObject({ cols: 3, rows: 2 });
    expect(layout.cells.map((cell: any) => [cell.type, cell.text, cell.binding])).toEqual([
      ['staticText', '物料编码', undefined],
      ['variableText', undefined, 'materialCode'],
      ['qr', undefined, 'rawValue'],
    ]);
    expect(JSON.parse(paramSchemaJson).required).toEqual(['materialCode', 'rawValue']);
  });

  it('normalizes custom scenario names into stable scenario codes', () => {
    expect(createScenarioCode('material', '采购标签')).toBe('MATERIAL_CUSTOM_59428114');
    expect(createScenarioCode('material', '  Purchase Label  ')).toBe('MATERIAL_PURCHASE_LABEL');
  });

  it('builds one print job payload per selected business object', () => {
    const payloads = buildBatchPrintJobPayloads({
      businessObjects: [
        { key: 'M-001', title: 'M-001 / A', variables: {} },
        { key: 'M-002', title: 'M-002 / B', variables: {} },
      ],
      businessType: 'MATERIAL',
      copies: 2,
      erpAcctCode: 'FNS',
      maxReprintCount: 3,
      scenarioCode: 'MATERIAL_PURCHASE_LABEL',
      scenarioName: '采购标签',
      templateId: 10,
      tenantId: 1,
    });

    expect(payloads).toEqual([
      expect.objectContaining({
        businessKey: 'M-001',
        businessType: 'MATERIAL',
        copies: 2,
        scenarioCode: 'MATERIAL_PURCHASE_LABEL',
        scenarioName: '采购标签',
        templateId: 10,
      }),
      expect.objectContaining({
        businessKey: 'M-002',
        idempotencyKey: expect.stringContaining('barcode-MATERIAL-MATERIAL_PURCHASE_LABEL-M-002-'),
      }),
    ]);
  });

  it('renders label preview cells with real business object values', () => {
    const state = createDefaultDesignerState();
    const preview = renderLabelPreview(state, {
      key: 'M-002',
      title: 'M-002 / 外壳',
      variables: {
        materialCode: 'M-002',
        materialName: '外壳',
        materialSpec: 'A1',
      },
    }, {
      businessType: 'MATERIAL',
      erpAcctCode: 'FNS',
      token: 'T001',
    });

    expect(preview.paper).toMatchObject({ height: 40, width: 60 });
    expect(preview.cells.map((cell) => [cell.type, cell.displayValue])).toEqual([
      ['staticText', '物料编码'],
      ['variableText', 'M-002'],
      ['staticText', '二维码'],
      ['qr', 'MESQR:v2:FNS:MATERIAL:M-002:T001'],
    ]);
  });

  it('calculates multiline ellipsis rows from cell height and font size', () => {
    const state = createDefaultDesignerState();
    state.paper.height = 40;
    state.table.rows = 2;
    state.table.rowHeights = [10, 30];
    const tallCell = createDefaultTableCell('cell-tall', 1, 0, {
      fontSize: 3,
      overflow: 'multiline-ellipsis',
      padding: 1,
      rowSpan: 1,
    });
    const shortCell = createDefaultTableCell('cell-short', 0, 0, {
      fontSize: 8,
      overflow: 'multiline-ellipsis',
      padding: 3,
      rowSpan: 1,
    });

    expect(calculateTableCellLineClamp(tallCell, state, 5)).toBeGreaterThan(2);
    expect(calculateTableCellLineClamp(shortCell, state, 5)).toBe(1);
  });

  it('uses millimeter table tracks and resizes adjacent tracks without changing total size', () => {
    const state = createDefaultDesignerState();
    const normalized = normalizeTableTrackSizes({
      border: true,
      cols: 2,
      columnWidths: [1, 1],
      rowHeights: [1, 3],
      rows: 2,
    }, state.paper);

    expect(normalized.columnWidths).toEqual([29, 29]);
    expect(normalized.rowHeights).toEqual([9.5, 28.5]);

    expect(resizeAdjacentTableTrack([28, 28], 0, 6)).toEqual([34, 22]);
    expect(resizeAdjacentTableTrack([28, 28], 0, 99)).toEqual([52, 4]);
    expect(resizeAdjacentTableTrack([9, 27], 0, -20)).toEqual([4, 32]);
  });

  it('defines the table frame with bottom-left coordinates and explicit size', () => {
    const state = createDefaultDesignerState();
    state.paper.width = 80;
    state.paper.height = 60;
    state.table.x = 5;
    state.table.y = 5;
    state.table.width = 55;
    state.table.height = 45;
    state.table.columnWidths = [20, 20];
    state.table.rowHeights = [10, 10];

    const normalized = normalizeTableTrackSizes(state.table, state.paper);
    expect(normalized.x).toBe(5);
    expect(normalized.y).toBe(5);
    expect(normalized.width).toBe(55);
    expect(normalized.height).toBe(45);
    expect(normalized.columnWidths.reduce((sum, item) => sum + item, 0)).toBe(55);
    expect(normalized.rowHeights.reduce((sum, item) => sum + item, 0)).toBe(45);
  });

  it('restores saved table frame coordinates and size from template json', () => {
    const state = createDefaultDesignerState();
    state.paper.width = 80;
    state.paper.height = 60;
    state.table.x = 5;
    state.table.y = 6;
    state.table.width = 55;
    state.table.height = 45;
    state.table.columnWidths = [22, 33];
    state.table.rowHeights = [15, 30];

    const payload = toTemplatePayloadJson(state);
    const restored = normalizeDesignerLayout(payload.layoutJson);

    expect(restored.table.x).toBe(5);
    expect(restored.table.y).toBe(6);
    expect(restored.table.width).toBe(55);
    expect(restored.table.height).toBe(45);
    expect(restored.table.columnWidths.reduce((sum, item) => sum + item, 0)).toBe(55);
    expect(restored.table.rowHeights.reduce((sum, item) => sum + item, 0)).toBe(45);
  });

  it('sizes QR codes by the available cell short side and optional qrSize cap', () => {
    const state = createDefaultDesignerState();
    state.table.columnWidths = [18, 32];
    state.table.rowHeights = [10, 22];
    state.table.width = 50;
    state.table.height = 32;
    const cell = createDefaultTableCell('qr', 1, 1, {
      padding: 1,
      qrSize: undefined,
      type: 'qr',
    });

    expect(calculateTableCellBoxMm(cell, state)).toMatchObject({ contentHeight: 20, contentWidth: 30 });
    expect(calculateQrSideMm(cell, state)).toBe(20);
    expect(calculateQrSideMm({ ...cell, qrSize: 9.5 }, state)).toBe(9.5);
    expect(calculateQrSideMm({ ...cell, qrSize: 99 }, state)).toBe(20);

    const label = renderLabelPreview(toTemplatePayloadJson({
      ...state,
      cells: [cell],
    }).layoutJson, {
      key: 'M-001',
      title: 'M-001',
      variables: {},
    });
    expect(label.cells[0]?.qrSide).toBe(20);
  });

  it('normalizes legacy and empty layouts into editable designer state', () => {
    const empty = normalizeDesignerLayout('');
    expect(empty.paper).toMatchObject({ height: 40, width: 60 });
    expect(empty.elements).toEqual([]);

    const legacy = normalizeDesignerLayout('{"elements":[{"type":"qr","field":"rawValue"},{"type":"text","field":"business_key"}]}');
    expect(legacy.elements.map((item) => [item.kind, item.binding])).toEqual([
      ['qr', 'rawValue'],
      ['text', 'business_key'],
    ]);
  });

  it('applies paper presets and clamps dragged elements inside the paper', () => {
    const state = createDefaultDesignerState();
    applyPaperPreset(state.paper, PAPER_PRESETS[1]!);
    expect(state.paper).toMatchObject({
      height: 30,
      margin: 2,
      orientation: 'landscape',
      width: 50,
    });

    const element = createElementFromVariable('qr', { key: 'rawValue', label: '二维码内容', value: 'RAW' }, 48, -3);
    clampDesignerElementPosition(element, state.paper);
    expect(element.x).toBe(32);
    expect(element.y).toBe(0);
  });
});
