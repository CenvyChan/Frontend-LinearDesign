import type { FormDetailTableSchema, FormFieldSchema } from '#/api/form-model';

/** 明细表在设计器里的形态：加一个仅前端的稳定标识。 */
export interface DetailTableRow extends FormDetailTableSchema {
  uid: string;
}

/** 字段在设计器里的归属表达：指向某张明细表的 uid，空 = 主表。 */
export interface FieldOwner {
  fieldKey: string;
  fieldLabel?: string;
  detailClientKey?: string;
}

/**
 * 把后端的 `detailTableId` 翻译成前端的 `uid`。
 *
 * 两者是同一归属关系的两种表达，必须双向翻译：加载时按 id 找 uid，提交时后端按 uid
 * 换回真实 id。不能直接用 `detailTableId`，因为新建的明细表还没有 id。
 *
 * `0` 与缺省都表示主表 —— 老快照可能不带这个键。
 */
export function detailClientKeyOf(
  field: Pick<FormFieldSchema, 'detailTableId'>,
  tables: DetailTableRow[],
): string | undefined {
  if (!field.detailTableId) return undefined;
  return tables.find((table) => table.detailTableId === field.detailTableId)?.uid;
}

/**
 * 归属的明细表已经不在了的字段。
 *
 * 删掉一张明细表不会自动处理指向它的字段，而后端会因此<b>拒绝整次保存</b>
 * （刻意不降级成主表字段：那会让配置错误变成字段悄悄跑到主表上，而字段一旦发布
 * 就再也移不动）。所以保存前要先找出它们，并说出是哪几个。
 */
export function findOrphanFields<T extends FieldOwner>(
  fields: T[],
  tables: DetailTableRow[],
): T[] {
  const known = new Set(tables.map((table) => table.uid));
  return fields.filter(
    (field) => !!field.detailClientKey && !known.has(field.detailClientKey),
  );
}

/** 字段列表里显示的归属表名。 */
export function ownerTableLabel(
  field: FieldOwner,
  tables: DetailTableRow[],
): string {
  if (!field.detailClientKey) return '主表';
  const table = tables.find((item) => item.uid === field.detailClientKey);
  return table ? table.detailName || table.detailKey : '（已删除）';
}

/**
 * 该表单是否已发布。
 *
 * 借用明细表的 `isPublished` —— 那个标记由后端给出，判据就是「表单是否离开 DRAFT」，
 * 所以任意一张为真即整张表单已发布。前端不要按 `detailTableId > 0` 推断：
 * 草稿阶段保存过的明细表同样有 id。
 */
export function isFormPublished(tables: DetailTableRow[]): boolean {
  return tables.some((table) => table.isPublished === true);
}
