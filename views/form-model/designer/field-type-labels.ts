/**
 * 字段类型与选项来源的中文显示名。
 *
 * 仅用于显示：后端 `FieldTypeResolver.resolvePhysicalType` 用大写标识决定物理列类型，
 * switch 的 `default` 分支会直接抛异常，因此提交给后端的值必须保持原始标识，
 * 不能把中文写回 `fieldType` / `optionSourceType`。
 */

/** 设计器可选的字段类型，顺序即下拉展示顺序 */
export const FIELD_TYPES = [
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
] as const;

/** 需要配置选项来源的字段类型 */
export const OPTION_FIELD_TYPES = [
  'SELECT',
  'RADIO',
  'MULTI_SELECT',
  'CHECKBOX',
  'REFERENCE',
] as const;

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: '单行文本',
  TEXTAREA: '多行文本',
  INTEGER: '整数',
  NUMBER: '数值',
  MONEY: '金额',
  DATE: '日期',
  DATETIME: '日期时间',
  BOOLEAN: '是/否',
  SELECT: '下拉单选',
  RADIO: '单选按钮',
  MULTI_SELECT: '下拉多选',
  CHECKBOX: '复选框',
  REFERENCE: '引用选择',
};

const OPTION_SOURCE_LABELS: Record<string, string> = {
  STATIC: '静态选项',
  DICTIONARY: '数据字典',
  REFERENCE: '引用数据源',
};

/**
 * 字段类型中文名。未收录的类型原样返回，避免历史草稿里的类型显示为空。
 */
export function fieldTypeLabel(fieldType: string): string {
  return FIELD_TYPE_LABELS[fieldType] ?? fieldType;
}

/** 选项来源中文名。未收录的来源原样返回。 */
export function optionSourceLabel(optionSourceType: string): string {
  return OPTION_SOURCE_LABELS[optionSourceType] ?? optionSourceType;
}

/**
 * `DraftFieldRequest` 接受的全部属性，顺序与后端 record 声明一致。
 *
 * 后端用的是 record 而非实体，Jackson 未开启 `FAIL_ON_UNKNOWN_PROPERTIES=false`，
 * 多传一个属性就整个请求 400。因此提交前必须按白名单挑字段：草稿接口返回的
 * `fieldId` / `fieldStatus` 都是只读属性，一并回传会被拒绝。
 *
 * 刻意不含 `optionConfig`：草稿接口把它解析成对象返回，而 DTO 声明为 String，
 * 必须由调用方按选项来源序列化后再写入，不能从加载态原样透传。
 */
export const DRAFT_FIELD_KEYS = [
  'fieldKey',
  'fieldLabel',
  'fieldType',
  'isRequired',
  'isReadonly',
  'isVisible',
  'maxLength',
  'decimalScale',
  'defaultValue',
  'validateRule',
  'optionSourceType',
  'showInList',
  'listSort',
  'isQueryCondition',
  'isSingleSearch',
  'queryOperator',
  'groupKey',
  'colSpan',
  'sort',
  // 明细表归属：前端的临时 key（明细表面板里那一行的 uid），不是数据库 id。
  // 新建的明细表还没有 id，而它的字段必须能指向它；后端在明细表落库后换成真实 id。
  'detailClientKey',
] as const;

/**
 * 按白名单挑出可提交的字段属性，`undefined` 的键直接省略。
 *
 * 省略而非传 null：后端 record 的包装类型允许缺省，传 null 会覆盖掉
 * 实体上的默认值（例如 `isVisible`）。
 */
export function pickDraftFieldPayload(
  field: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of DRAFT_FIELD_KEYS) {
    if (field[key] !== undefined) payload[key] = field[key];
  }
  return payload;
}

/**
 * 新建字段的默认属性。
 *
 * `showInList: true` 必须显式给出：实体侧 `FormField.showInList` 默认 `false`。
 *
 * ⚠️ 列显示已迁到「菜单入口」（`mes_form_list_view.columns_json`，V4.16），
 * 该字段现在**只是未配置列的入口的退化兜底** —— 但兜底仍然必须正确：
 * 省略它会让「未配置列的入口」一列都不显示，看起来像数据没存进去。
 * 等所有入口都配过列、快照里不再有该键，才能连同 Java 侧字段一起删除。
 */
export const NEW_FIELD_DEFAULTS = {
  fieldStatus: 'ACTIVE',
  fieldType: 'TEXT',
  isVisible: true,
  showInList: true,
} as const;

/** 后端 `PhysicalNamer.FIELD_KEY_PATTERN` 的同一规则 */
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

/**
 * 提交前校验字段 Key，返回第一条错误；全部合法时返回 null。
 *
 * 只覆盖格式、重名、`_label` 后缀这三条稳定规则。保留字与 MySQL 关键字
 * 仍由后端 `PhysicalNamer.validateFieldKey` 权威判定 —— 在前端复制那份清单
 * 只会与后端漂移，而漂移的方向是"前端放过、后端拒绝"，等于没校验。
 *
 * 目的是让常见错误在提交前就指名道姓，而不是提交后从一条通用报错里猜。
 */
export function validateFieldKeys(
  fields: Array<{ fieldKey: string; fieldLabel?: string }>,
): null | string {
  const seen = new Set<string>();

  for (const field of fields) {
    const key = field.fieldKey ?? '';
    const name = field.fieldLabel || key || '(未命名字段)';

    if (!key) {
      return `字段「${name}」的 Key 不能为空`;
    }
    if (!FIELD_KEY_PATTERN.test(key)) {
      return `字段「${name}」的 Key「${key}」不合法：需小写字母开头，仅含小写字母/数字/下划线，长度 2-50`;
    }
    if (key.endsWith('_label')) {
      return `字段「${name}」的 Key 不能以 _label 结尾，该后缀被引用字段占用`;
    }
    if (seen.has(key)) {
      return `字段 Key「${key}」重复，同一表单内必须唯一`;
    }
    seen.add(key);
  }

  return null;
}

/** 批量文本解析出的静态选项，`sort` 由调用方按现有行数续排 */
export interface ParsedStaticOption {
  code: string;
  label: string;
}

/**
 * 解析批量录入的静态选项文本，一行一个选项。
 *
 * 支持两种写法：
 * - `A` —— 编码与标签相同
 * - `A=甲类` 或 `A,甲类` —— 前者为编码，后者为标签
 *
 * 空行与首尾空格忽略；同一批次内编码重复只保留第一次出现，
 * 因为静态选项的编码是落库值，重复会让保存校验直接失败。
 */
export function parseBulkOptions(text: string): ParsedStaticOption[] {
  const seen = new Set<string>();
  const parsed: ParsedStaticOption[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const separator = /[,=，]/.exec(line);
    const code = (separator ? line.slice(0, separator.index) : line).trim();
    const label = separator ? line.slice(separator.index + 1).trim() : code;

    if (!code || !label || seen.has(code)) continue;
    seen.add(code);
    parsed.push({ code, label });
  }

  return parsed;
}
