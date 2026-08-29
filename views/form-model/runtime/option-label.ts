import type { ReferenceOption } from '#/api/form-model';

/**
 * 候选项的展示文本：`编码｜名称`，有规格型号时再追加。
 *
 * 为什么不只显示名称：物料/仓库/供应商/客户等基础资料的名称经常重名或高度相似，
 * 且同一编码会因 ERP 的 `FUseOrgId` 在不同组织各出现一行。只给名称时用户无法决策。
 *
 * 编码缺失（字典等本来就没有独立编码的来源）时退回只显示名称，
 * 不产生 `｜名称` 这种前导分隔符。
 */
export function referenceOptionLabel(option: ReferenceOption): string {
  const code = option.code?.trim();
  const label = option.label?.trim() ?? '';
  const description = option.description?.trim();

  // 编码与名称相同时不重复展示（例如编码即名称的来源）
  const head = code && code !== label ? `${code}｜${label}` : label;
  return description ? `${head}（${description}）` : head;
}
