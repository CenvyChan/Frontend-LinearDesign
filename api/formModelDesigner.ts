import type { FormSchemaResponse } from '#/api/form-model';

import { requestClient } from '#/api/request';

export interface DraftFormSummary {
  formKey: string;
  formName: string;
  status: string;
  draftRevision: number;
  ownerAcctCode: string;
}

export interface DraftCreateRequest {
  formKey: string;
  formName: string;
  ownerAcctCode: string;
  remark?: string;
}

/**
 * 一张明细表的提交形态。
 *
 * `clientKey` 是前端的临时标识，字段用 `detailClientKey` 指向它 —— 新建的明细表
 * 还没有数据库 id。**没有 `physicalTable`**：那是全局唯一列，由服务端从
 * formKey + detailKey 算出。
 */
export interface DraftDetailTableRequest {
  clientKey: string;
  detailKey: string;
  detailName: string;
  sort?: number;
  minRows?: number;
  maxRows?: number;
}

export interface DraftSaveRequest {
  expectedDraftRevision: number;
  formName: string;
  remark?: string;
  fields: Array<Record<string, unknown>>;
  /**
   * 明细表定义，与字段在同一次请求里提交。
   *
   * 不做成独立端点：明细表的 id 是明细字段的必要前置，两者必须同一事务、
   * 过同一道乐观版本闸门，否则会产生「明细表已建但字段还没绑」的中间态。
   */
  detailTables?: DraftDetailTableRequest[];
}

export interface CopyFormRequest {
  formKey: string;
  formName: string;
  ownerAcctCode: string;
}

export interface OwnerAcctOption {
  acctCode: string;
  isDefault: boolean;
}

export interface ReferenceSourceOption {
  key: string;
  displayName: string;
}

export type GrantType = 'CREATE' | 'VIEW';
export type PrincipalType = 'ROLE' | 'USER';

/** 授权作用于整张表单（所有菜单入口）时的 viewId 哨兵值 */
export const ALL_VIEWS = 0;

export interface FormGrantItem {
  /** 作用的菜单入口 id；0 = 整张表单的所有入口 */
  viewId: number;
  grantType: GrantType;
  principalType: PrincipalType;
  principalId: number;
  grantedBy: null | number;
  grantedAt: null | number;
}

export interface GrantMutation {
  /** 作用的菜单入口 id；省略或 0 = 整张表单的所有入口 */
  viewId?: number;
  grantType: GrantType;
  principalType: PrincipalType;
  principalId: number;
}

/** 一条预置过滤条件。运算符由后端白名单校验，值一律参数化 */
export interface ListViewCondition {
  fieldKey: string;
  operator: string;
  value?: null | string;
}

/** 一项汇总配置 */
export interface ListViewSummary {
  function: string;
  fieldKey?: null | string;
  label: string;
}

/** 一个列表视图 = 一个菜单入口 + 一组预置条件 + 一组汇总 */
export interface ListViewItem {
  id: number;
  /** 稳定标识，创建后不可改：预置条件按它查库 */
  viewKey: string;
  /** 菜单标题 */
  viewName: string;
  /** 挂载的父菜单节点 name，null = 顶级 */
  parentMenuName?: null | string;
  icon?: null | string;
  sort: number;
  /** 自定义菜单地址，null = 用默认的 /form-model/{formKey}/{viewKey} */
  routePath?: null | string;
  /** 实际生效的地址，由后端算出（可能来自 routePath，也可能是默认拼接） */
  effectivePath: string;
  /**
   * 只读入口：不显示操作列、无任何写权限。
   *
   * 与访问授权是**交集**关系（可写 = 授权允许 CREATE 且本入口非只读），
   * 所以勾上它只能收回能力、不可能提权。真正的拒绝在后端写端点上，
   * 前端隐藏按钮只是让人点不到。
   */
  readOnly: boolean;
  conditions: ListViewCondition[];
  summaries: ListViewSummary[];
  /**
   * 列表列与顺序。
   *
   * **null = 未配置**（运行时退回字段级 showInList，过渡期兼容）；
   * **空数组 = 明确不显示任何数据列**。两者不可混为一谈。
   */
  columns: ListViewColumn[] | null;
}

/** 一列列表列 */
export interface ListViewColumn {
  fieldKey: string;
  sort?: number;
}

/** 新建/更新视图的入参。viewKey 在更新时会被后端忽略 */
export interface ListViewMutation {
  viewKey: string;
  viewName: string;
  parentMenuName?: null | string;
  icon?: null | string;
  sort?: number;
  routePath?: null | string;
  readOnly?: boolean;
  conditions?: ListViewCondition[];
  summaries?: ListViewSummary[];
  /** null/省略 = 未配置；空数组 = 明确零列 */
  columns?: ListViewColumn[] | null;
}

/** 可作为挂载点的静态菜单节点 */
export interface MenuNodeOption {
  name: string;
  title: string;
}


interface BodyResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function unwrap<T>(promise: Promise<BodyResponse<T>>, fallback: string): Promise<T> {
  const response = await promise;
  if (!response?.success || response.data === undefined) {
    throw new Error(response?.message || fallback);
  }
  return response.data;
}

export function getOwnerAcctOptionsApi(): Promise<OwnerAcctOption[]> {
  return unwrap(
    requestClient.get<BodyResponse<OwnerAcctOption[]>>('/form-model/designer/owner-accounts', {
      responseReturn: 'body',
    }),
    '加载归属账套失败',
  );
}

/**
 * 系统已注册的引用源目录（设计期）。
 *
 * 与运行时的 `getReferenceOptionsApi` 不同：那个按 formKey 取「该表单已配置过的源」，
 * 首次给字段选源时必然为空。本接口只需 design 权限，不绑定任何表单。
 */
export function getReferenceSourceCatalogApi(): Promise<ReferenceSourceOption[]> {
  return unwrap(
    requestClient.get<BodyResponse<ReferenceSourceOption[]>>('/form-model/designer/reference-sources', {
      responseReturn: 'body',
    }),
    '加载引用源目录失败',
  );
}

export function getDesignerListApi(): Promise<DraftFormSummary[]> {
  return unwrap(
    requestClient.get<BodyResponse<DraftFormSummary[]>>('/form-model/designer/list', {
      responseReturn: 'body',
    }),
    '加载设计器列表失败',
  );
}

export function createDesignerFormApi(payload: DraftCreateRequest): Promise<DraftFormSummary> {
  return unwrap(
    requestClient.post<BodyResponse<DraftFormSummary>>('/form-model/designer', payload, {
      responseReturn: 'body',
    }),
    '新建表单失败',
  );
}

export function getDesignerDraftApi(formKey: string): Promise<FormSchemaResponse> {
  return unwrap(
    requestClient.get<BodyResponse<FormSchemaResponse>>(`/form-model/designer/${formKey}`, {
      responseReturn: 'body',
    }),
    '加载草稿失败',
  );
}

export function getDesignerPreviewSchemaApi(formKey: string): Promise<FormSchemaResponse> {
  return unwrap(
    requestClient.get<BodyResponse<FormSchemaResponse>>(
      `/form-model/designer/${formKey}/preview-schema`,
      { responseReturn: 'body' },
    ),
    '加载草稿预览失败',
  );
}

export function saveDesignerDraftApi(
  formKey: string,
  payload: DraftSaveRequest,
): Promise<DraftFormSummary> {
  return unwrap(
    requestClient.put<BodyResponse<DraftFormSummary>>(`/form-model/designer/${formKey}`, payload, {
      responseReturn: 'body',
    }),
    '保存草稿失败',
  );
}

export function copyDesignerFormApi(
  formKey: string,
  payload: CopyFormRequest,
): Promise<DraftFormSummary> {
  return unwrap(
    requestClient.post<BodyResponse<DraftFormSummary>>(`/form-model/designer/${formKey}/copy`, payload, {
      responseReturn: 'body',
    }),
    '复制表单失败',
  );
}

export function publishDesignerFormApi(formId: number, expectedDraftRevision: number): Promise<string> {
  return unwrap(
    requestClient.post<BodyResponse<string>>(`/form-model/publish/${formId}`, { expectedDraftRevision }, {
      responseReturn: 'body',
    }),
    '发布表单失败',
  );
}

export function disableDesignerFormApi(formKey: string): Promise<null> {
  return unwrap(
    requestClient.delete<BodyResponse<null>>(`/form-model/designer/${formKey}`, {
      responseReturn: 'body',
    }),
    '作废表单失败',
  );
}

/**
 * 某张表单当前生效的授权。
 *
 * 只返回 principalId，不含显示名 —— 调用方为渲染选择器本来就要加载用户/角色列表，
 * 由后端再解析一次等于多一轮 N+1 查询。
 *
 * 需要 `form-model:grant` 权限（与写授权同权），无权限时后端返回 403。
 */
export function getFormGrantsApi(formId: number): Promise<FormGrantItem[]> {
  return unwrap(
    requestClient.get<BodyResponse<FormGrantItem[]>>(`/form-model/grants/${formId}`, {
      responseReturn: 'body',
    }),
    '加载授权列表失败',
  );
}

/** 授予访问权限。后端幂等：重复授同一条是空操作，批量时无需先去重 */
export function grantFormAccessApi(formId: number, payload: GrantMutation): Promise<null> {
  return unwrap(
    requestClient.post<BodyResponse<null>>(`/form-model/grant/${formId}`, payload, {
      responseReturn: 'body',
    }),
    '授权失败',
  );
}

/**
 * 撤销访问权限。
 *
 * 后端有不变式：CREATE 存在时不允许撤 VIEW（会返回 GRANT_INVARIANT_VIOLATION），
 * 必须先撤 CREATE。
 */
export function revokeFormAccessApi(formId: number, payload: GrantMutation): Promise<null> {
  return unwrap(
    requestClient.post<BodyResponse<null>>(`/form-model/revoke/${formId}`, payload, {
      responseReturn: 'body',
    }),
    '撤销授权失败',
  );
}

// ---------- 列表视图（菜单入口） ----------

/**
 * 某张表单的全部列表视图。
 *
 * 视图决定菜单：**没有视图的表单不产生任何入口**，发布本身不再上线。
 */
export function getFormListViewsApi(formKey: string): Promise<ListViewItem[]> {
  return unwrap(
    requestClient.get<BodyResponse<ListViewItem[]>>(
      `/form-model/designer/${formKey}/views`,
      { responseReturn: 'body' },
    ),
    '加载列表视图失败',
  );
}

/**
 * 可作为挂载点的静态菜单节点。
 *
 * 是后端硬编码的白名单，不能自定义 —— 节点名对不上时菜单会退回顶级，
 * 所以父节点必须从这个列表里选，不能手填。
 */
export function getFormMenuNodesApi(): Promise<MenuNodeOption[]> {
  return unwrap(
    requestClient.get<BodyResponse<MenuNodeOption[]>>(
      '/form-model/designer/menu-nodes',
      { responseReturn: 'body' },
    ),
    '加载菜单节点失败',
  );
}

export function createFormListViewApi(
  formKey: string,
  payload: ListViewMutation,
): Promise<ListViewItem> {
  return unwrap(
    requestClient.post<BodyResponse<ListViewItem>>(
      `/form-model/designer/${formKey}/views`,
      payload,
      { responseReturn: 'body' },
    ),
    '新建列表视图失败',
  );
}

/** viewKey 不可改：后端会忽略入参里的 viewKey，只更新其余字段 */
export function updateFormListViewApi(
  formKey: string,
  viewId: number,
  payload: ListViewMutation,
): Promise<ListViewItem> {
  return unwrap(
    requestClient.put<BodyResponse<ListViewItem>>(
      `/form-model/designer/${formKey}/views/${viewId}`,
      payload,
      { responseReturn: 'body' },
    ),
    '保存列表视图失败',
  );
}

export function deleteFormListViewApi(
  formKey: string,
  viewId: number,
): Promise<null> {
  return unwrap(
    requestClient.delete<BodyResponse<null>>(
      `/form-model/designer/${formKey}/views/${viewId}`,
      { responseReturn: 'body' },
    ),
    '删除列表视图失败',
  );
}
