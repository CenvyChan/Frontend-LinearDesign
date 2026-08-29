/** 一列列表列配置（来自菜单入口） */
export interface ViewColumn {
  fieldKey: string;
  sort?: null | number;
}

/** 解析列所需的字段信息（`FormFieldSchema` 的子集，便于在纯 Node 环境测试） */
export interface ColumnField {
  fieldKey: string;
  fieldStatus?: null | string;
  detailTableId?: null | number;
  isVisible?: boolean;
  showInList?: boolean;
  listSort?: null | number;
  sort?: null | number;
}

/**
 * 字段必须是启用、可见、且属于主表的，才有资格成为列。
 *
 * **明细表字段必须排除。** 一条主记录下有多行明细，平铺进主表列表只能显示第一行
 * 或空值，两者都是错的 —— 明细数据的正确呈现方式是展开行或子表格。
 * 后端快照从 Phase 1 起就冻结了 `detailTableId`（`0` = 主表），但前端一直没读它，
 * 所以明细字段一旦进入快照就会混进列表列和新增表单。
 * 缺省按主表处理：老快照可能没有该键，而 Phase 1/2 的字段全部是主表字段。
 */
function isSelectable(field: ColumnField): boolean {
  const status = field.fieldStatus ?? 'ACTIVE';
  return (
    status === 'ACTIVE' &&
    field.isVisible !== false &&
    (field.detailTableId ?? 0) === 0
  );
}

function fieldOrder(field: ColumnField): number {
  return field.listSort ?? field.sort ?? 0;
}

/**
 * 决定列表显示哪些列、按什么顺序。
 *
 * <p><b>列显示跟着菜单入口走。</b>同一张表单的两个入口本来就该显示不同的列，
 * 而字段级的 `showInList` 对所有入口一视同仁，结构上表达不了。
 *
 * <p>三种输入状态，必须分清：
 * - `viewColumns === null/undefined` → **未配置**，退回字段级 `showInList`。
 *   这是过渡期兼容：后端 `FieldSchema.showInList` 暂时删不掉（现存快照全部含该键，
 *   而 ObjectMapper 未关 `FAIL_ON_UNKNOWN_PROPERTIES`），所以「未配置」必须可表达。
 * - `viewColumns === []` → **明确零列**，只显示操作列。不能当成"未配置"，
 *   否则用户永远配不出一个纯操作列的入口。
 * - 非空数组 → 按它给的顺序显示，`sort` 缺失时保持数组顺序。
 *
 * <p>配置里引用了**已不存在或已停用**的字段时**跳过该列**而不是报错：
 * 视图可能先于字段建立，字段也可能后来被停用。这与预置过滤条件的 fail-closed
 * 刻意相反 —— 少显示一列是显示问题，而少一个过滤条件是安全问题
 * （「按 A=1 过滤」的菜单悄悄显示全部数据远比少一列危险）。
 */
export function resolveListColumns(
  fields: ColumnField[],
  viewColumns: undefined | null | ViewColumn[],
): ColumnField[] {
  const selectable = fields.filter(isSelectable);

  if (viewColumns === null || viewColumns === undefined) {
    return selectable
      .filter((field) => field.showInList !== false)
      .sort((a, b) => fieldOrder(a) - fieldOrder(b));
  }

  const byKey = new Map(selectable.map((field) => [field.fieldKey, field]));
  return viewColumns
    // 保留原始下标：sort 缺失或重复时用它做稳定兜底，避免 sort 相同的列每次渲染换位
    .map((column, index) => ({ column, index }))
    .sort((a, b) => (a.column.sort ?? a.index) - (b.column.sort ?? b.index))
    .map((entry) => byKey.get(entry.column.fieldKey))
    .filter((field): field is ColumnField => field !== undefined);
}
