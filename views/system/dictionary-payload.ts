import type { DictionaryItem } from '#/api/dictionary';

/** 编辑器里的一行：`uid` 让未落库的新行也能有稳定的 key，是纯前端字段。 */
export interface DictionaryEditorRow extends DictionaryItem {
  uid: number;
}

/**
 * 把编辑器行转成后端接受的请求体。
 *
 * <p>必须逐字段显式挑选，**不能用 `{ ...row }`**：后端
 * `PUT /api/dictionary/types/{type}` 的入参是 `List<Dictionary>` 实体，
 * 走默认 Jackson 配置（`FAIL_ON_UNKNOWN_PROPERTIES` 未关），多带一个 `uid`
 * 就会抛 `UnrecognizedPropertyException` → 400，整批保存失败。
 *
 * <p>TypeScript 抓不到这个错误：`EditorRow extends DictionaryItem`，展开后仍然
 * 满足 `DictionaryItem`（对象字面量的多余属性检查对展开不生效），所以类型层
 * 完全静默。这个函数存在的意义就是把「前端行」与「线上契约」显式隔开。
 */
export function toDictionaryTypePayload(
  rows: DictionaryEditorRow[],
  type: string,
): DictionaryItem[] {
  return rows
    .filter((row) => row.code.trim() || row.label.trim())
    .map((row) => ({
      id: row.id,
      type,
      code: row.code.trim(),
      label: row.label.trim(),
      sort: row.sort,
      isDefault: row.isDefault,
      isArchived: row.isArchived,
      remark: row.remark,
    }));
}
