import { requestClient } from '#/api/request';

/**
 * 表单建模运行时 API。
 *
 * 全部使用 `responseReturn: 'body'`：拦截器对任何 HTTP 2xx 都原样返回 body，
 * 不会因 `success: false` 而 reject，因此每个函数都必须显式检查 `success`。
 */

/**
 * 把数组参数序列化成**重复的同名键**（`search=a&search=b`）。
 *
 * 必须显式指定：axios 默认输出 `search[]=a&search[]=b`，而 Spring 的
 * `@RequestParam List<String> search` 按键名精确匹配，`search[]` 绑不上 ——
 * 结果是请求成功、搜索条件却被静默丢弃，返回未过滤的数据。
 *
 * 客户端构造时支持 `paramsSerializer: 'repeat'` 这种字符串简写，但那只在构造阶段
 * 翻译一次；逐请求传字符串会被原样交给 axios 而失效，所以这里必须给函数。
 */
export function repeatArrayParams(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

/** 运行时字段定义（快照中的 ACTIVE 字段） */
export interface FormFieldSchema {
  fieldId: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldStatus?: string;
  /**
   * 所属明细表 id，`0`（或缺省）= 主表字段。
   *
   * 后端快照一直冻结着这个值（`FormSchema.FieldSchema.detailTableId`），前端此前没有
   * 声明。主表单与列表列必须按它过滤：明细字段的语义是「一条主记录下的多行」，
   * 混进单值的主表单会让用户填一个存不进去的输入框。
   */
  detailTableId?: number;
  physicalType?: string;
  defaultValue?: string;
  maxLength?: number;
  decimalScale?: number;
  optionSourceType?: string;
  optionConfig?: Record<string, unknown>;
  isRequired?: boolean;
  isVisible?: boolean;
  showInList?: boolean;
  listSort?: number;
  /** 聚合搜索：参与列表上方那个关键字框的多字段 OR 模糊匹配 */
  isQueryCondition?: boolean;
  /** 单字段搜索：该字段在列表上方有自己独立的搜索输入框 */
  isSingleSearch?: boolean;
  /** 单字段搜索使用的运算符，为空时由后端按字段类型推断 */
  queryOperator?: string;
  sort?: number;
}

/** 明细表定义（对应后端 FormSchema.DetailTableSchema） */
export interface FormDetailTableSchema {
  detailTableId: number;
  detailKey: string;
  detailName: string;
  physicalTable?: string;
  sort?: number;
  minRows?: number;
  maxRows?: number;
  /**
   * 已发布（物理表已存在）→ 不能删除或改 key。
   *
   * 由后端给，判据与它真正会拒绝保存的那条规则同源。前端不要按
   * `detailTableId > 0` 自行推断 —— 那只说明「已落库」，草稿阶段保存过的也有 id。
   */
  isPublished?: boolean;
}

/**
 * 行数上限的常量与纯函数移到 `form-model-detail-limits.ts`，此处重新导出以保持
 * `#/api/form-model` 这个入口不变（设计器两处 `.vue` 仍从这里取）。
 *
 * 搬走的原因是本文件顶层 `import { requestClient }` 会拉进 axios 与 preferences，
 * 使被测模块在 vitest 的 node 环境里 import 期即崩。需要在单测里取这两个符号的
 * 模块，应直接从 `#/api/form-model-detail-limits` 导入，绕开这条运行时链。
 */
export {
  DEFAULT_MAX_DETAIL_ROWS,
  maxRowsOf,
} from './form-model-detail-limits';

/** 表单运行时 schema（对应后端 FormSchema） */
export interface FormSchemaResponse {
  formId: number;
  formKey: string;
  formName: string;
  remark?: string;
  physicalTable?: string;
  schemaVersion: number;
  fields: FormFieldSchema[];
  /**
   * 明细表定义。字段通过 `detailTableId` 归属到这里的某一项。
   *
   * 后端 `SnapshotService` 与 `DraftPreviewSchemaService` 从 Phase 1 起就返回它，
   * 前端此前没有声明，所以设计器读不到、运行时也渲染不出明细区。
   */
  detailTables?: FormDetailTableSchema[];
}

export interface ReferenceOption {
  /** Business code, shown alongside the name. Absent for sources without one. */
  code?: null | string;
  /** Extra detail distinguishing same-named candidates (物料规格型号). */
  description?: null | string;
  id: string;
  label: string;
}

export interface FormDataListResponse {
  canCreate: boolean;
  items: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
  /**
   * 本菜单入口配置的列与顺序。
   *
   * **null = 未配置**（退回字段级 showInList，过渡期兼容）；
   * **空数组 = 明确不显示任何数据列**。所以取值要用 `?? null` 而非 `|| null`。
   */
  columns: null | { fieldKey: string; sort?: null | number }[];
}

/**
 * 列表查询参数。
 *
 * **视图预置条件不在此列**：它由服务端按 viewKey 从视图定义取出，客户端无法覆盖。
 * `search` 是允许的例外：它只能引用标记了 isSingleSearch 的字段，且与预置条件
 * AND 相连，因此只能收窄结果集。
 */
export interface FormDataListQuery {
  keyword?: string;
  page?: number;
  pageSize?: number;
  /** 单字段搜索，每项形如 `fieldKey:运算符:值`；运算符可留空交给后端推断 */
  search?: string[];
  viewKey?: string;
}

/** 一项汇总结果。value 可能为 null（无匹配行时 SUM/AVG 返回 null）。 */
export interface FormSummaryItem {
  label: string;
  function: string;
  fieldKey?: null | string;
  value?: null | number | string;
}

/** 拉取指定表单的活动 schema */
export async function getFormSchemaApi(
  formKey: string,
): Promise<FormSchemaResponse> {
  const res = await requestClient.get<{
    success: boolean;
    data: FormSchemaResponse;
    message?: string;
  }>(`/form-model/schema/${formKey}`, { responseReturn: 'body' });

  if (!res?.success) {
    throw new Error(res?.message || '加载表单结构失败');
  }
  return res.data;
}

/** 拉取主表数据列表 */
export async function getFormListApi(
  formKey: string,
  query: FormDataListQuery = {},
): Promise<FormDataListResponse> {
  const params: Record<string, number | string | string[]> = {
    page: query.page ?? 0,
    pageSize: query.pageSize ?? 50,
  };
  // 空串不发：后端把空 viewKey 当"无视图"，但发一个空参数只会让日志更难读
  if (query.viewKey) params.viewKey = query.viewKey;
  if (query.keyword?.trim()) params.keyword = query.keyword.trim();
  // 数组序列化成重复的 search=... 参数，与后端 @RequestParam List<String> 对应
  if (query.search?.length) params.search = query.search;

  const res = await requestClient.get<{
    canCreate?: boolean;
    success: boolean;
    columns?: null | { fieldKey: string; sort?: null | number }[];
    data: Record<string, unknown>[];
    message?: string;
    page?: number;
    pageSize?: number;
    total?: number;
  }>(`/form-data/${formKey}`, {
    params,
    paramsSerializer: repeatArrayParams,
    responseReturn: 'body',
  });

  if (!res?.success) {
    throw new Error(res?.message || '加载表单数据失败');
  }
  return {
    canCreate: res.canCreate === true,
    items: Array.isArray(res.data) ? res.data : [],
    page: res.page ?? 0,
    pageSize: res.pageSize ?? 50,
    total: res.total ?? 0,
    // 只有真正是数组才当成"已配置"。null/缺失都是未配置 —— 折成空数组会被
    // 解读成「明确零列」，让所有旧入口的列凭空消失。
    columns: Array.isArray(res.columns) ? res.columns : null,
  };
}

/**
 * 列表上方的汇总信息。
 *
 * 汇总项与过滤条件都取自视图定义，只有 keyword 来自请求 —— 这样汇总与列表用的是
 * 同一份 WHERE，"搜索后的汇总"自动一致。
 */
export async function getFormSummaryApi(
  formKey: string,
  query: { keyword?: string; search?: string[]; viewKey?: string } = {},
): Promise<FormSummaryItem[]> {
  const params: Record<string, string | string[]> = {};
  if (query.viewKey) params.viewKey = query.viewKey;
  if (query.keyword?.trim()) params.keyword = query.keyword.trim();
  // 与列表同条件，否则"搜索后的汇总"会和表格不一致
  if (query.search?.length) params.search = query.search;

  const res = await requestClient.get<{
    success: boolean;
    data: FormSummaryItem[];
    message?: string;
  }>(`/form-data/${formKey}/summary`, {
    params,
    paramsSerializer: repeatArrayParams,
    responseReturn: 'body',
  });

  if (!res?.success) {
    throw new Error(res?.message || '加载汇总失败');
  }
  return Array.isArray(res.data) ? res.data : [];
}

/** 表单数据 Excel 相关的端点前缀（上传类操作用；下载请走下面三个函数） */
export function formDataExcelPaths(formKey: string) {
  const base = `/form-data/${formKey}`;
  return {
    export: `${base}/export`,
    template: `${base}/import/template`,
    preview: `${base}/import/preview`,
    confirm: `${base}/import/confirm`,
    failures: (batchId: string) => `${base}/import/failures/${batchId}`,
  };
}

/**
 * 三个下载端点一律走 requestClient 取 blob，**不能用 `window.open` 拼 URL**。
 *
 * 浏览器导航是一个全新的请求上下文，拿不到 axios 拦截器注入的四个头：
 * `Authorization`、`X-Tenant-Id`、`X-Erp-Acct-Code`、`X-Org-Id`。
 * 缺第一个 `FormAccessGuard` 直接判 401（且这两个端点返回**空包体**，
 * 浏览器既不下载也不报错，表现为"新标签页一闪而过"）；
 * 缺后两个即便通过认证也会落到错误的租户/账套。
 */
export function exportFormDataApi(formKey: string) {
  return requestClient.get<Blob>(formDataExcelPaths(formKey).export, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function downloadFormTemplateApi(formKey: string, viewKey?: string) {
  return requestClient.get<Blob>(formDataExcelPaths(formKey).template, {
    params: viewKey ? { viewKey } : undefined,
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export function downloadFormFailuresApi(formKey: string, batchId: string) {
  return requestClient.get<Blob>(formDataExcelPaths(formKey).failures(batchId), {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function getReferenceOptionsApi(
  formKey: string,
  sourceKey: string,
  keyword = '',
): Promise<ReferenceOption[]> {
  const res = await requestClient.get<{
    success: boolean;
    data: ReferenceOption[];
    message?: string;
  }>(`/form-model/reference-sources/${formKey}/${sourceKey}/options`, {
    params: { keyword },
    responseReturn: 'body',
  });
  if (!res?.success) throw new Error(res?.message || '加载引用选项失败');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getDictionaryOptionsApi(
  formKey: string,
  type: string,
): Promise<ReferenceOption[]> {
  const res = await requestClient.get<{
    success: boolean;
    data: ReferenceOption[];
    message?: string;
  }>(`/form-model/reference-sources/${formKey}/dictionaries/${type}/options`, {
    responseReturn: 'body',
  });
  if (!res?.success) throw new Error(res?.message || '加载字典选项失败');
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * 写操作一律带上 `viewKey`。
 *
 * 后端按入口判断是否只读，缺 viewKey 时它退化成「这张表单的所有入口是否都只读」——
 * 那是刻意的 fail-closed 兜底，不是给前端偷懒用的。不传会让「只读入口」在
 * 存在其他可写入口时形同虚设。
 */
export async function createFormDataApi(
  formKey: string,
  data: Record<string, unknown>,
  details?: Record<string, Array<Record<string, unknown>>>,
  viewKey?: string,
): Promise<number> {
  const res = await requestClient.post<{
    success: boolean;
    data: { id: number };
    message?: string;
  }>(
    `/form-data/${formKey}`,
    // data 与 details 分成两个键：data 的键就是业务字段名，而表单完全可以有一个
    // 字段叫 details，混在一起会让那个字段永远存不进去。
    { data, details },
    {
      params: viewKey ? { viewKey } : undefined,
      responseReturn: 'body',
    },
  );

  if (!res?.success) {
    throw new Error(res?.message || '新增失败');
  }
  return res.data.id;
}

/**
 * 复制一行为新行。
 *
 * 只发 id，不回传行内容：复制的语义是「和那一行一样」，让客户端回传内容
 * 等于开一条能绕过写入校验的旁路。后端读回原行、重新解析引用标签后按新行写入，
 * 所以引用值失效时**会失败**，这是想要的方向。
 */
export async function copyFormDataApi(
  formKey: string,
  id: number,
  viewKey?: string,
): Promise<number> {
  const res = await requestClient.post<{
    success: boolean;
    data: { id: number };
    message?: string;
  }>(`/form-data/${formKey}/${id}/copy`, null, {
    params: viewKey ? { viewKey } : undefined,
    responseReturn: 'body',
  });

  if (!res?.success) {
    throw new Error(res?.message || '复制失败');
  }
  return res.data.id;
}

/** 软删除一条主表记录 */
export async function deleteFormDataApi(
  formKey: string,
  id: number,
  viewKey?: string,
): Promise<void> {
  const res = await requestClient.delete<{
    success: boolean;
    message?: string;
  }>(`/form-data/${formKey}/${id}`, {
    params: viewKey ? { viewKey } : undefined,
    responseReturn: 'body',
  });

  if (!res?.success) {
    throw new Error(res?.message || '删除失败');
  }
}
