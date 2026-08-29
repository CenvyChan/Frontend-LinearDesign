import { requestClient } from '#/api/request';

export interface DictionaryItem {
  id?: number;
  type: string;
  code: string;
  label: string;
  sort?: number;
  isDefault?: boolean;
  /** 封存：不可再被新记录选中，历史值仍能解析出名称 */
  isArchived?: boolean;
  remark?: string;
}

/** 按类型聚合的一行概览 */
export interface DictionaryTypeSummary {
  type: string;
  codeCount: number;
  archivedCount: number;
  referencedByForms: string[];
}

interface BodyResponse<T> { success: boolean; data?: T; message?: string }

async function unwrap<T>(promise: Promise<BodyResponse<T>>, fallback: string): Promise<T> {
  const response = await promise;
  if (!response?.success || response.data === undefined) throw new Error(response?.message || fallback);
  return response.data;
}

export function getDictionaryApi(type?: string): Promise<DictionaryItem[]> {
  return unwrap(requestClient.get<BodyResponse<DictionaryItem[]>>('/dictionary', {
    params: type ? { type } : undefined,
    responseReturn: 'body',
  }), '加载字典失败');
}

export function createDictionaryApi(item: DictionaryItem): Promise<DictionaryItem> {
  return unwrap(requestClient.post<BodyResponse<DictionaryItem>>('/dictionary', item, {
    responseReturn: 'body',
  }), '新增字典失败');
}

export function updateDictionaryApi(id: number, item: DictionaryItem): Promise<DictionaryItem> {
  return unwrap(requestClient.put<BodyResponse<DictionaryItem>>(`/dictionary/${id}`, item, {
    responseReturn: 'body',
  }), '更新字典失败');
}

export function deleteDictionaryApi(id: number): Promise<null> {
  return unwrap(requestClient.delete<BodyResponse<null>>(`/dictionary/${id}`, {
    responseReturn: 'body',
  }), '删除字典失败');
}

/** 按类型聚合的概览，含引用它的表单名 */
export function getDictionaryTypesApi(): Promise<DictionaryTypeSummary[]> {
  return unwrap(requestClient.get<BodyResponse<DictionaryTypeSummary[]>>('/dictionary/types', {
    responseReturn: 'body',
  }), '加载字典类型失败');
}

/** 一次提交整个类型下的全部编码 */
export function saveDictionaryTypeApi(
  type: string,
  entries: DictionaryItem[],
): Promise<DictionaryItem[]> {
  return unwrap(requestClient.put<BodyResponse<DictionaryItem[]>>(
    `/dictionary/types/${encodeURIComponent(type)}`, entries,
    { responseReturn: 'body' },
  ), '保存字典类型失败');
}

/**
 * 封存 / 取消封存一个编码。
 *
 * 与删除不同，封存不会因被表单引用而被拒绝 —— 被引用的编码正是最需要封存的那些。
 */
export function setDictionaryArchivedApi(
  id: number,
  archived: boolean,
): Promise<DictionaryItem> {
  return unwrap(requestClient.put<BodyResponse<DictionaryItem>>(
    `/dictionary/${id}/archived`, null,
    { params: { archived }, responseReturn: 'body' },
  ), '封存字典项失败');
}
