import { describe, expect, it } from 'vitest';

import {
  DRAFT_FIELD_KEYS,
  FIELD_TYPES,
  fieldTypeLabel,
  NEW_FIELD_DEFAULTS,
  OPTION_FIELD_TYPES,
  optionSourceLabel,
  parseBulkOptions,
  pickDraftFieldPayload,
  validateFieldKeys,
} from './field-type-labels';

/**
 * 后端 FieldTypeResolver 用大写标识决定物理列类型，未知值直接抛异常。
 * 中文只能停留在显示层，一旦被写回 fieldType，发布就会失败。
 */
describe('field type labels', () => {
  it('gives every selectable field type a Chinese label', () => {
    for (const type of FIELD_TYPES) {
      const label = fieldTypeLabel(type);
      expect(label, `${type} 缺少中文名`).not.toBe(type);
      expect(label).toMatch(/[\u4E00-\u9FA5]/);
    }
  });

  it('keeps the raw identifier as the submitted value', () => {
    // 标识集合必须与后端 FieldTypeResolver 的 switch 分支保持一致
    expect([...FIELD_TYPES]).toEqual([
      'TEXT',
      'TEXTAREA',
      'INTEGER',
      'NUMBER',
      'MONEY',
      'DATE',
      'DATETIME',
      'BOOLEAN',
      'SELECT',
      'RADIO',
      'MULTI_SELECT',
      'CHECKBOX',
      'REFERENCE',
    ]);
  });

  it('labels every option source the designer can offer', () => {
    for (const source of ['STATIC', 'DICTIONARY', 'REFERENCE']) {
      expect(optionSourceLabel(source)).toMatch(/[\u4E00-\u9FA5]/);
    }
  });

  it('falls back to the raw value for an unknown type', () => {
    expect(fieldTypeLabel('RICH_TEXT')).toBe('RICH_TEXT');
    expect(optionSourceLabel('USER')).toBe('USER');
  });

  it('keeps option field types inside the field type list', () => {
    for (const type of OPTION_FIELD_TYPES) {
      expect(FIELD_TYPES).toContain(type);
    }
  });
});

/**
 * 静态选项的 code 是落库值，保存校验要求非空且不重复，
 * 所以解析阶段就必须把空行和重复编码挡掉。
 */
describe('parseBulkOptions', () => {
  it('turns one line into one option', () => {
    expect(parseBulkOptions('A\nB\nC')).toEqual([
      { code: 'A', label: 'A' },
      { code: 'B', label: 'B' },
      { code: 'C', label: 'C' },
    ]);
  });

  it('splits code and label on = or comma', () => {
    expect(parseBulkOptions('HIGH=高\nLOW,低\nMID，中')).toEqual([
      { code: 'HIGH', label: '高' },
      { code: 'LOW', label: '低' },
      { code: 'MID', label: '中' },
    ]);
  });

  it('ignores blank lines and surrounding spaces', () => {
    expect(parseBulkOptions('  A  \n\n\n  B\n   \n')).toEqual([
      { code: 'A', label: 'A' },
      { code: 'B', label: 'B' },
    ]);
  });

  it('keeps only the first occurrence of a duplicated code', () => {
    expect(parseBulkOptions('A=甲\nA=乙\nB')).toEqual([
      { code: 'A', label: '甲' },
      { code: 'B', label: 'B' },
    ]);
  });

  it('drops lines with an empty code or label', () => {
    expect(parseBulkOptions('=甲\nB=\n\nC=丙')).toEqual([
      { code: 'C', label: '丙' },
    ]);
  });

  it('returns nothing for text with no usable line', () => {
    expect(parseBulkOptions('\n  \n')).toEqual([]);
  });
});

/**
 * 后端 DraftFieldRequest 是 record，Jackson 对未知属性直接 400。
 * 草稿接口返回的只读属性（fieldId/fieldStatus）必须在提交前剔除。
 */
describe('pickDraftFieldPayload', () => {
  it('drops read-only and frontend-only properties', () => {
    const payload = pickDraftFieldPayload({
      fieldId: 12,
      fieldStatus: 'ACTIVE',
      uid: 'f3',
      optionConfigJson: '{"type":"priority"}',
      staticOptions: [{ code: 'A', label: 'A', sort: 1 }],
      fieldKey: 'amount',
      fieldLabel: '金额',
      fieldType: 'MONEY',
    });

    expect(payload).toEqual({
      fieldKey: 'amount',
      fieldLabel: '金额',
      fieldType: 'MONEY',
    });
  });

  it('omits undefined keys instead of sending null', () => {
    const payload = pickDraftFieldPayload({
      fieldKey: 'note',
      fieldLabel: '备注',
      fieldType: 'TEXT',
      maxLength: undefined,
      isVisible: undefined,
    });

    expect(Object.keys(payload)).toEqual(['fieldKey', 'fieldLabel', 'fieldType']);
  });

  it('keeps falsy values that carry meaning', () => {
    const payload = pickDraftFieldPayload({
      fieldKey: 'flag',
      fieldType: 'BOOLEAN',
      isVisible: false,
      sort: 0,
      decimalScale: 0,
    });

    expect(payload).toMatchObject({ isVisible: false, sort: 0, decimalScale: 0 });
  });

  it('covers DraftFieldRequest except optionConfig', () => {
    // 与 FormDesignerController.DraftFieldRequest 的 record 组件保持一致
    expect([...DRAFT_FIELD_KEYS].sort()).toEqual(
      [
        'colSpan',
        'decimalScale',
        'defaultValue',
        'detailClientKey',
        'fieldKey',
        'fieldLabel',
        'fieldType',
        'groupKey',
        'isQueryCondition',
        'isReadonly',
        'isRequired',
        'isSingleSearch',
        'isVisible',
        'listSort',
        'maxLength',
        'optionSourceType',
        'queryOperator',
        'showInList',
        'sort',
        'validateRule',
      ].sort(),
    );
  });

  it('marks new fields as list columns', () => {
    // 实体默认 showInList=false，运行时按 `showInList !== false` 过滤列。
    // 新建字段若不显式置 true，发布后列表页一列都不显示（只剩操作列）。
    expect(NEW_FIELD_DEFAULTS.showInList).toBe(true);
  });

  it('submits showInList so the default is not silently dropped', () => {
    // 光有默认值不够：还得真的进提交体。白名单少一项就等于默认值没生效。
    const payload = pickDraftFieldPayload({
      fieldKey: 'code',
      ...NEW_FIELD_DEFAULTS,
    });

    expect(payload.showInList).toBe(true);
  });

  it('never passes optionConfig straight through', () => {
    // 加载态是对象，DTO 要 String —— 必须由调用方序列化后写入
    const payload = pickDraftFieldPayload({
      fieldKey: 'level',
      optionConfig: { options: [{ code: 'A', label: 'A' }] },
    });

    expect(payload).not.toHaveProperty('optionConfig');
  });
});

/**
 * 后端 PhysicalNamer.validateFieldKey 才是权威判定，这里只提前拦住常见错误
 * 并指名道姓 —— 保留字清单刻意不复制到前端，避免与后端漂移。
 */
describe('validateFieldKeys', () => {
  const ok = (fieldKey: string) => ({ fieldKey, fieldLabel: '某字段' });

  it('accepts a well-formed key', () => {
    expect(validateFieldKeys([ok('amount'), ok('unit_price2')])).toBeNull();
  });

  it('rejects an empty key and names the field', () => {
    expect(validateFieldKeys([{ fieldKey: '', fieldLabel: '金额' }]))
      .toBe('字段「金额」的 Key 不能为空');
  });

  it('rejects uppercase, leading digits and too-short keys', () => {
    for (const bad of ['Amount', '1amount', 'a', 'a-b', 'a b']) {
      expect(validateFieldKeys([ok(bad)]), bad).toContain('不合法');
    }
  });

  it('rejects a key longer than 50 characters', () => {
    expect(validateFieldKeys([ok(`a${'b'.repeat(50)}`)])).toContain('不合法');
  });

  it('rejects the _label suffix reserved for reference fields', () => {
    expect(validateFieldKeys([ok('material_label')])).toContain('_label');
  });

  it('rejects duplicate keys within one form', () => {
    expect(validateFieldKeys([ok('amount'), ok('amount')]))
      .toBe('字段 Key「amount」重复，同一表单内必须唯一');
  });

  it('leaves reserved words to the backend', () => {
    // id/select 是后端保留字，前端刻意放过，由 PhysicalNamer 判定
    expect(validateFieldKeys([ok('id')])).toBeNull();
    expect(validateFieldKeys([ok('select')])).toBeNull();
  });
});
