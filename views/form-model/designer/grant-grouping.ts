/**
 * 授权作用于整张表单（所有菜单入口）时的 viewId 哨兵值。
 *
 * 与 `#/api/formModelDesigner` 的同名常量必须一致，但这里刻意重新声明而不是 import ——
 * 那个模块会连带引入 element-plus 的样式，使本模块无法在纯 Node 环境下做单元测试。
 * 值由下方 spec 与后端 `FormGrant.ALL_VIEWS` 三方对齐。
 */
export const ALL_VIEWS = 0;

type GrantType = 'CREATE' | 'VIEW';
type PrincipalType = 'ROLE' | 'USER';

/** 后端返回的一条授权行（本模块只依赖它的这几个字段） */
export interface FormGrantItem {
  viewId: number;
  grantType: GrantType;
  principalType: PrincipalType;
  principalId: number;
  grantedAt: null | number;
}

/** 表格里的一行：一个「授权对象 × 菜单入口」组合的最终能力 */
export interface GrantRow {
  /** 0 = 整张表单的所有入口 */
  viewId: number;
  principalType: PrincipalType;
  principalId: number;
  /** 该组合是否持有 CREATE（CREATE 蕴含 VIEW，所以没有"仅 CREATE"这种状态） */
  canCreate: boolean;
  grantedAt: null | number;
}

/**
 * 把后端的授权行按「授权对象 × 菜单入口」分组。
 *
 * <p>后端一个组合最多两行（VIEW + CREATE），平铺展示会让「这个角色到底能干什么」
 * 需要用户自己在两行之间拼，分组后一行读完。
 *
 * <p><b>分组键必须含 viewId。</b>授权带上入口维度后，同一个角色在
 * 「全部入口只读」与「录入入口可新增」是两条独立的授权；只按 principal 分组
 * 会把它们塌成一行，于是界面显示的是两者的**并集**，用户无法看出
 * 也无法分别撤销 —— 而撤销的粒度错了会静默放宽权限。
 */
export function groupGrants(grants: FormGrantItem[]): GrantRow[] {
  const groups = new Map<string, GrantRow>();
  for (const grant of grants) {
    const viewId = grant.viewId ?? ALL_VIEWS;
    const key = `${viewId}:${grant.principalType}:${grant.principalId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.canCreate ||= grant.grantType === 'CREATE';
      existing.grantedAt =
        Math.max(existing.grantedAt ?? 0, grant.grantedAt ?? 0) || null;
    } else {
      groups.set(key, {
        viewId,
        principalType: grant.principalType,
        principalId: grant.principalId,
        canCreate: grant.grantType === 'CREATE',
        grantedAt: grant.grantedAt,
      });
    }
  }
  // 表单级（0）排在最前：它是作用范围最广的一条，先读它才能理解后面的入口级授权
  return [...groups.values()].sort(
    (a, b) =>
      a.viewId - b.viewId ||
      a.principalType.localeCompare(b.principalType) ||
      a.principalId - b.principalId,
  );
}
