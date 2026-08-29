import type { FormDetailTableSchema, FormFieldSchema } from '#/api/form-model';

// 从纯常量模块取，而不是 `#/api/form-model`：后者顶层引入 requestClient，会把
// axios/preferences 拉进依赖链，使本模块的单测在 node 环境下 import 期即崩。
import { maxRowsOf } from '#/api/form-model-detail-limits';

/** 一行明细数据，键是字段 key。 */
export type DetailRow = Record<string, unknown>;

/** 各明细表的行数组，键是 `detailKey`。 */
export type DetailRows = Record<string, DetailRow[]>;

/**
 * 某张表的可编辑字段：`0`/缺省 = 主表。
 *
 * 明细字段与主表字段同处一个扁平数组，靠 `detailTableId` 区分 —— 快照没有把字段
 * 嵌在明细表里，所以每个消费方都要自己分组一次。
 */
export function fieldsOfTable(
  fields: FormFieldSchema[],
  detailTableId: number,
): FormFieldSchema[] {
  return fields.filter(
    (field) => (field.detailTableId ?? 0) === detailTableId && field.isVisible !== false,
  );
}

/**
 * 字段的初始值。
 *
 * 与主表新增用同一套判据：多选给空数组、布尔给 false、其余给默认值或空串。
 * 类型不对会让 el-checkbox-group 之类的控件在首次渲染就报错。
 */
export function initialValue(field: FormFieldSchema): unknown {
  const type = (field.fieldType ?? '').toUpperCase();
  if (type === 'MULTI_SELECT' || type === 'CHECKBOX') return [];
  if (type === 'BOOLEAN') return false;
  return field.defaultValue ?? '';
}

/** 一张明细表的空白新行。 */
export function blankRow(fields: FormFieldSchema[], detailTableId: number): DetailRow {
  const row: DetailRow = {};
  for (const field of fieldsOfTable(fields, detailTableId)) {
    row[field.fieldKey] = initialValue(field);
  }
  return row;
}

/** 按快照声明初始化全部明细表的行容器，每张表起始为空。 */
export function emptyDetailRows(tables: FormDetailTableSchema[]): DetailRows {
  const rows: DetailRows = {};
  for (const table of tables) {
    rows[table.detailKey] = [];
  }
  return rows;
}

function isBlank(value: unknown): boolean {
  return value === '' || value === null || value === undefined;
}

/**
 * 明细行的校验，返回第一条错误的中文描述，全部通过时返回空串。
 *
 * <p>行数上下限与必填都在这里查一遍，尽管后端也会查 —— 目的不是替代后端，
 * 而是<b>让错误指得出位置</b>：后端只能说「至少 2 行」，前端能说「第 3 行的数量必填」。
 *
 * <p>行号从 1 开始，与服务端写入的 `row_no` 一致，这样用户看到的编号和数据库里的一样。
 */
export function validateDetailRows(
  tables: FormDetailTableSchema[],
  fields: FormFieldSchema[],
  rows: DetailRows,
): string {
  for (const table of tables) {
    const tableRows = rows[table.detailKey] ?? [];
    const name = table.detailName || table.detailKey;
    const min = table.minRows ?? 0;
    const max = maxRowsOf(table);
    if (tableRows.length < min) {
      return `明细表「${name}」至少需要 ${min} 行，当前 ${tableRows.length} 行`;
    }
    if (tableRows.length > max) {
      return `明细表「${name}」最多 ${max} 行，当前 ${tableRows.length} 行`;
    }
    const tableFields = fieldsOfTable(fields, table.detailTableId);
    for (const [index, row] of tableRows.entries()) {
      for (const field of tableFields) {
        if (field.isRequired && isBlank(row[field.fieldKey])) {
          return `明细表「${name}」第 ${index + 1} 行的「${field.fieldLabel}」必填`;
        }
      }
    }
  }
  return '';
}

function isNumeric(field: FormFieldSchema): boolean {
  const type = (field.fieldType ?? '').toUpperCase();
  return type === 'NUMBER' || type === 'INTEGER' || type === 'DECIMAL';
}

/**
 * 提交用的明细行：空值剔除、数值转成 number。
 *
 * <p>剔除空值而不是送 null：后端按「键存在」决定要写哪些列，送 null 会把一个
 * 用户没填的列显式写成 NULL，与「保持列默认值」是两件事。
 *
 * <p><b>只取该表声明的字段。</b>行对象里可能残留切换归属前的键，
 * 原样送出会让后端的白名单校验拒掉整次写入。
 */
export function toDetailPayload(
  tables: FormDetailTableSchema[],
  fields: FormFieldSchema[],
  rows: DetailRows,
): DetailRows {
  const payload: DetailRows = {};
  for (const table of tables) {
    const tableFields = fieldsOfTable(fields, table.detailTableId);
    payload[table.detailKey] = (rows[table.detailKey] ?? []).map((row) => {
      const clean: DetailRow = {};
      for (const field of tableFields) {
        const value = row[field.fieldKey];
        if (isBlank(value)) continue;
        clean[field.fieldKey] = isNumeric(field) ? Number(value) : value;
      }
      return clean;
    });
  }
  return payload;
}
