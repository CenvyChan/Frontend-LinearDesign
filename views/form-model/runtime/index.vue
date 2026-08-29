<script setup lang="ts">
import type {
  FormFieldSchema,
  FormSchemaResponse,
  FormSummaryItem,
  ReferenceOption,
} from '#/api/form-model';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  copyFormDataApi,
  createFormDataApi,
  deleteFormDataApi,
  downloadFormFailuresApi,
  downloadFormTemplateApi,
  exportFormDataApi,
  getDictionaryOptionsApi,
  getFormListApi,
  getFormSchemaApi,
  formDataExcelPaths,
  getFormSummaryApi,
  getReferenceOptionsApi,
  maxRowsOf,
} from '#/api/form-model';
import { requestClient } from '#/api/request';
import ExcelImportDialog from '#/components/excel/ExcelImportDialog.vue';
import { downloadBlob } from '#/utils/download';

import type { ApiResult, ImportPreviewResult } from '#/api/excel';

import type { ViewColumn } from './list-columns';

import type { DetailRows } from './detail-rows';

import {
  blankRow,
  emptyDetailRows,
  fieldsOfTable,
  toDetailPayload,
  validateDetailRows,
} from './detail-rows';
import { resolveListColumns } from './list-columns';
import { referenceOptionLabel } from './option-label';

defineOptions({ name: 'FormModelRuntime' });

const route = useRoute();

/** 当前表单 key 来自后端菜单下发的 meta.formKey */
const formKey = computed(() => (route.meta?.formKey as string) ?? '');

/**
 * 当前列表视图 key，同样来自菜单 meta。
 *
 * 同一张表单可以有多个视图，各带不同的预置过滤条件；后端按 formKey + viewKey
 * 决定返回哪一批数据。预置条件的实际下推尚未实现（需要动态 WHERE），
 * 因此这里先把 viewKey 传下去，服务端当前忽略它并返回全量。
 */
const viewKey = computed(() => (route.meta?.viewKey as string) ?? '');

const schema = ref<FormSchemaResponse | null>(null);
const dataList = ref<Record<string, unknown>[]>([]);
const keyword = ref('');
const page = ref(0);
const pageSize = ref(50);
const total = ref(0);
const summaries = ref<FormSummaryItem[]>([]);
const importVisible = ref(false);

/**
 * 后端 importConfirm 的 data。
 *
 * `count` 与 `failedCount` 必须与 `FormDataController.importConfirm` 一致：
 * 对话框读 `res.data.count` 渲染成功提示，键名不匹配只会让提示恒显示 0 条。
 */
interface ImportConfirmData {
  count: number;
  failedCount: number;
  failureBatchId?: string;
}
const loading = ref(false);
const schemaLoading = ref(false);
const schemaError = ref('');
const createVisible = ref(false);
const canCreate = ref(false);
const submitting = ref(false);
const createModel = reactive<Record<string, unknown>>({});
/**
 * 新增对话框里各明细表的行数据，键是 `detailKey`。
 *
 * 与 `createModel` 分开：明细是「多行」，扁平进 createModel 会与业务字段名撞车
 * （表单完全可以有个字段叫 `lines`）。提交时也是分成 data / details 两个键。
 */
const createDetails = ref<DetailRows>({});
const optionMap = ref<Record<string, ReferenceOption[]>>({});
const optionLoading = ref<Record<string, boolean>>({});
/** 与后端 MaterialReferenceSource.MAX_OPTIONS 保持一致，仅用于提示文案 */
const REFERENCE_PAGE_SIZE = 100;

function staticOptions(field: FormFieldSchema): ReferenceOption[] {
  const options = field.optionConfig?.options;
  if (!Array.isArray(options)) return [];
  return options.filter(
    (item): item is { code: string; label: string } =>
      typeof item?.code === 'string' && typeof item?.label === 'string',
  ).map((item) => ({ id: item.code, label: item.label }));
}

function fieldOptions(field: FormFieldSchema): ReferenceOption[] {
  return optionMap.value[field.fieldKey] ?? staticOptions(field);
}

function fieldType(field: FormFieldSchema): string {
  return (field.fieldType ?? '').toUpperCase();
}

/**
 * 引用类字段在写入时由后端解析出 `<fieldKey>_label` 快照列，
 * 列表应展示该名称快照而不是原始编码。
 */
function listProp(field: FormFieldSchema): string {
  return ['DEPT', 'REFERENCE', 'USER'].includes(fieldType(field))
    ? `${field.fieldKey}_label`
    : field.fieldKey;
}

function isChoiceField(field: FormFieldSchema): boolean {
  return ['SELECT', 'RADIO', 'MULTI_SELECT', 'CHECKBOX', 'REFERENCE'].includes(fieldType(field));
}

/**
 * 引用源检索由后端在整个账套范围内执行（keyword 直接进 SQL like），
 * 每次只回传前 REFERENCE_PAGE_SIZE 条。因此下拉必须走 remote，
 * 否则用户只能在"首屏 100 条"里做本地过滤，检索不到其余候选。
 *
 * REFERENCE_PAGE_SIZE 只用于提示文案，且**不是所有源都封顶**：
 * material / employee / operator / business-partner 走 SQL 分页确实截断 100 条，
 * 而 warehouse / supplier / customer 从账套缓存内存过滤、不截断。
 * 所以提示按"实际回传条数是否达到上限"判断，不硬编码某个源的名字 ——
 * 在前端复制一份"哪些源会截断"的清单，必然与后端漂移（同 B2 的两张白名单）。
 * 根治要后端回传 truncated 标记。
 */
async function remoteSearch(field: FormFieldSchema, keyword: string) {
  if (fieldType(field) !== 'REFERENCE') return;
  const source = field.optionConfig?.source;
  if (typeof source !== 'string' || !formKey.value) return;
  optionLoading.value = { ...optionLoading.value, [field.fieldKey]: true };
  try {
    const options = await getReferenceOptionsApi(formKey.value, source, keyword.trim());
    optionMap.value = { ...optionMap.value, [field.fieldKey]: options };
  } catch (error: any) {
    ElMessage.error(error?.message || '检索引用数据失败');
  } finally {
    optionLoading.value = { ...optionLoading.value, [field.fieldKey]: false };
  }
}

/**
 * 预载选项。**单个选项源失败不允许拖垮整张表单。**
 *
 * 必须用 allSettled 并各自兜错：裸 Promise.all 下任何一个引用源报错
 * （最常见是表单 ownerAcctCode 缺失导致的 400）都会 reject 到 loadSchema 的 catch，
 * 那里把 schema 置为 null —— 于是「一个下拉取不到数据」表现成「整页打不开」。
 * 现在失败字段留空下拉、其余字段照常可用，并汇总提示是哪几个字段出了问题。
 *
 * <p>取的是**全部可见字段**，不是 `editableFields`。后者刻意排除了明细字段
 * （它们不进主表单），而这里回答的是另一个问题：「哪些字段需要下拉数据」——
 * 明细行里的引用字段同样要。复用 editableFields 会让明细表的下拉永远是空的。
 */
async function loadFieldOptions() {
  if (!schema.value || !formKey.value) return;
  const loaded: Record<string, ReferenceOption[]> = {};
  const failures: string[] = [];
  const optionFields = (schema.value.fields ?? []).filter(
    (field) => isActiveField(field) && isChoiceField(field),
  );
  await Promise.allSettled(optionFields.map(async (field) => {
    const sourceType = field.optionSourceType?.toUpperCase();
    try {
      if (sourceType === 'DICTIONARY') {
        const type = field.optionConfig?.type;
        if (typeof type === 'string') loaded[field.fieldKey] = await getDictionaryOptionsApi(formKey.value, type);
      } else if (sourceType === 'REFERENCE') {
        const source = field.optionConfig?.source;
        if (typeof source === 'string') loaded[field.fieldKey] = await getReferenceOptionsApi(formKey.value, source);
      }
    } catch (error: any) {
      failures.push(`${field.fieldLabel || field.fieldKey}：${error?.message || '取值失败'}`);
    }
  }));
  optionMap.value = loaded;
  if (failures.length > 0) {
    ElMessage.warning(`部分选项数据加载失败，相关下拉为空。${failures.join('；')}`);
  }
}

/** 仅 ACTIVE 且可见字段参与渲染，DEPRECATED 字段不出现在运行时 */
/**
 * 主表的可用字段：启用、可见、且不属于明细表。
 *
 * 三个消费方共用这个判据 —— 聚合搜索、单字段搜索、新增表单。三者都必须排除明细
 * 字段：明细是「一条主记录下的多行」，拿它当主表搜索条件或塞进单值表单都无意义。
 * 与 `list-columns.ts` 的 `isSelectable` 同口径，两处不一致会让同一个字段在列表里
 * 消失却仍出现在表单里。
 */
function isActiveField(field: FormFieldSchema): boolean {
  const status = field.fieldStatus ?? 'ACTIVE';
  return (
    status === 'ACTIVE' &&
    field.isVisible !== false &&
    (field.detailTableId ?? 0) === 0
  );
}

function sortValue(field: FormFieldSchema): number {
  return field.listSort ?? field.sort ?? 0;
}

/**
 * 聚合搜索字段：勾了「聚合搜索」的字段，共用列表上方那一个关键字框。
 *
 * 一个都没有时不渲染关键字框——渲染一个搜不到任何东西的输入框比没有更糟
 * （后端此时返回空结果，用户会以为数据丢了）。
 */
const searchableFields = computed(() =>
  (schema.value?.fields ?? []).filter(
    (field) => isActiveField(field) && field.isQueryCondition === true,
  ),
);

/** 单字段搜索字段：每个都有自己的输入框，独立过滤 */
const singleSearchFields = computed(() =>
  (schema.value?.fields ?? [])
    .filter((field) => isActiveField(field) && field.isSingleSearch === true)
    .sort((a, b) => sortValue(a) - sortValue(b)),
);

/**
 * 单字段搜索的当前输入，key 是 fieldKey。
 *
 * 与 keyword 分开而不是合成一个对象：keyword 只有一个值且语义不同（跨字段 OR），
 * 混在一起会让"清空搜索"这类操作难以只作用于其中一种。
 */
const singleSearchValues = ref<Record<string, string>>({});

/**
 * 提交给后端的单字段搜索参数，格式 `fieldKey:运算符:值`。
 *
 * 空值直接跳过 —— 发一个空条件会让后端按「等于空字符串」过滤，结果恒为空。
 * 运算符留给后端推断（不在这里拼），设计器配的 queryOperator 才是唯一来源。
 */
const activeSearchParams = computed(() =>
  singleSearchFields.value.flatMap((field) => {
    const value = singleSearchValues.value[field.fieldKey]?.trim();
    if (!value) return [];
    return [`${field.fieldKey}:${field.queryOperator ?? ''}:${value}`];
  }),
);

/** 选择类字段用下拉搜索，避免让用户手打选项编码 */
/**
 * 单字段搜索该渲染成下拉的字段。
 *
 * 刻意比 `isChoiceField` 窄：那个是"需要预载选项"的集合（含 MULTI_SELECT /
 * CHECKBOX / REFERENCE），但多选与引用在**搜索框**里语义不清 ——
 * 单字段搜索一次只发一个值，多选搜索需要 IN 而不是 EQ，引用则要远程检索。
 * 这两类先退回文本输入（按编码匹配），比给一个行为不符预期的下拉更好。
 */
function isOptionField(field: FormFieldSchema): boolean {
  return ['RADIO', 'SELECT'].includes(fieldType(field));
}

function resetSearch() {
  keyword.value = '';
  singleSearchValues.value = {};
  applySearch();
}

/** 是否有任何搜索条件生效，决定是否显示「重置」 */
const hasActiveSearch = computed(
  () => keyword.value.trim().length > 0 || activeSearchParams.value.length > 0,
);

/**
 * 列表列由**菜单入口**决定，而不是字段设计。
 *
 * `viewColumns` 为 null 时退回字段级 `showInList`（过渡期兼容，见 V4.16）。
 * 判据抽到 `list-columns.ts` 以便 spec 钉住「null=未配置 / 空数组=零列」这个区分。
 */
const listFields = computed(() =>
  resolveListColumns(
    schema.value?.fields ?? [],
    viewColumns.value,
  ) as FormFieldSchema[],
);

/** 新增表单字段：全部 ACTIVE 可见字段 */
const editableFields = computed(() =>
  (schema.value?.fields ?? [])
    .filter((field) => isActiveField(field))
    .sort((a, b) => sortValue(a) - sortValue(b)),
);

function isNumericField(field: FormFieldSchema): boolean {
  const type = (field.fieldType ?? '').toUpperCase();
  return type === 'NUMBER' || type === 'INTEGER' || type === 'DECIMAL';
}

async function loadSchema() {
  if (!formKey.value) {
    schemaError.value = '缺少 formKey，无法加载表单';
    return;
  }
  schemaLoading.value = true;
  schemaError.value = '';
  try {
    schema.value = await getFormSchemaApi(formKey.value);
    await loadFieldOptions();
  } catch (error: any) {
    schema.value = null;
    schemaError.value = error?.message || '加载表单结构失败';
    ElMessage.error(schemaError.value);
  } finally {
    schemaLoading.value = false;
  }
}

async function loadData() {
  if (!formKey.value || !schema.value) {
    return;
  }
  loading.value = true;
  try {
    const response = await getFormListApi(formKey.value, {
      keyword: keyword.value,
      page: page.value,
      pageSize: pageSize.value,
      search: activeSearchParams.value,
      viewKey: viewKey.value,
    });
    dataList.value = response.items;
    canCreate.value = response.canCreate;
    total.value = response.total;
    // ?? null 而不是 || null：空数组是「明确零列」，必须原样保留
    viewColumns.value = response.columns ?? null;
    // 选中行指向的是上一批数据。翻页或搜索后不清空，复制的会是已不在视野里的行。
    selectedRows.value = [];
  } catch (error: any) {
    dataList.value = [];
    canCreate.value = false;
    total.value = 0;
    selectedRows.value = [];
    ElMessage.error(error?.message || '加载表单数据失败');
  } finally {
    loading.value = false;
  }
  await loadSummary();
}

/**
 * 汇总与列表分开请求：汇总失败不该让表格也空掉。
 *
 * 未配置汇总的视图返回空数组，此时不渲染汇总条。
 */
async function loadSummary() {
  if (!formKey.value || !viewKey.value) {
    summaries.value = [];
    return;
  }
  try {
    summaries.value = await getFormSummaryApi(formKey.value, {
      keyword: keyword.value,
      // 单字段搜索也要带上，否则表格显示 3 行、合计却按全量算
      search: activeSearchParams.value,
      viewKey: viewKey.value,
    });
  } catch {
    // 汇总是辅助信息，静默降级为不显示，不打扰用户
    summaries.value = [];
  }
}

const downloading = ref(false);
const copying = ref(false);
/**
 * 本菜单入口配置的列；null = 未配置（退回字段级 showInList）。
 *
 * 与列表数据同一个响应返回，保证列配置与数据来自同一次 viewKey 解析 ——
 * 分两个请求会在切换视图时出现「用 A 的列渲染 B 的数据」的一帧错配。
 */
const viewColumns = ref<null | ViewColumn[]>(null);
/** 多选复制的选中行；换页/搜索/重载后清空，避免复制到已不在视野里的行 */
const selectedRows = ref<Record<string, unknown>[]>([]);

/**
 * 下载必须走 requestClient 取 blob，再由 `downloadBlob` 触发保存。
 *
 * 此前用的是 `window.open('/api' + path)`：浏览器导航是全新的请求上下文，
 * 带不上 axios 拦截器注入的 `Authorization` / `X-Tenant-Id` / `X-Erp-Acct-Code`，
 * 于是 `FormAccessGuard` 判 401。而这两个端点在被拒时返回的是**空包体**
 * （`ResponseEntity.status(...).build()`），所以浏览器既不下载也不提示，
 * 用户看到的就是"新标签页打开后什么都没发生"。
 */
async function download(fetch: () => Promise<Blob>, filename: string) {
  downloading.value = true;
  try {
    downloadBlob(await fetch(), filename);
  } catch (error: any) {
    ElMessage.error(error?.message || '下载失败');
  } finally {
    downloading.value = false;
  }
}

/** 文件名在客户端拼：后端只发 `filename*=UTF-8''`，没有 ASCII 回退可解析。 */
function fileLabel(suffix: string): string {
  return `${schema.value?.formName || formKey.value}${suffix}.xlsx`;
}

function exportData() {
  return download(() => exportFormDataApi(formKey.value), fileLabel('数据'));
}

function downloadTemplate() {
  return download(
    () => downloadFormTemplateApi(formKey.value, viewKey.value),
    fileLabel('导入模板'),
  );
}

/**
 * 这两个函数交给 ExcelImportDialog 调用，因此必须返回**原始封套**
 * （`{success, data, message}`）而不是解包后的 data —— 对话框自己检查 success
 * 并显示 message，提前解包会让业务错误静默消失。
 */
async function previewImport(file: File): Promise<ApiResult<ImportPreviewResult>> {
  const form = new FormData();
  form.append('file', file);
  return await requestClient.post<ApiResult<ImportPreviewResult>>(
    formDataExcelPaths(formKey.value).preview, form,
    { params: { viewKey: viewKey.value }, responseReturn: 'body' },
  );
}

async function confirmImport(
  batchId: string,
): Promise<ApiResult<{ count: number }>> {
  const res = await requestClient.post<ApiResult<ImportConfirmData>>(
    formDataExcelPaths(formKey.value).confirm, null,
    { params: { batchId, viewKey: viewKey.value }, responseReturn: 'body' },
  );
  // 有失败行时把下载入口给出来 —— 预览拦不住唯一键冲突等写入期错误，
  // 没有这个入口用户只知道"有几行失败"却不知道是哪几行。
  const failed = res?.data;
  const failureBatchId = failed?.failureBatchId;
  if (failed && failureBatchId) {
    ElMessageBox.confirm(
      `有 ${failed.failedCount} 行导入失败，是否下载失败行以便修正后重传？`,
      '部分导入失败',
      { confirmButtonText: '下载失败行', cancelButtonText: '暂不下载' },
    )
      .then(() =>
        download(
          () => downloadFormFailuresApi(formKey.value, failureBatchId),
          fileLabel('导入失败行'),
        ),
      )
      .catch(() => {});
  }
  return res;
}

/** 搜索与翻页都回到第一页之外的行为不同：翻页保留关键字，搜索重置页码。 */
async function applySearch() {
  page.value = 0;
  await loadData();
}

async function changePage(next: number) {
  // el-pagination 的 current-page 从 1 开始，后端从 0 开始
  page.value = Math.max(next - 1, 0);
  await loadData();
}

/** 快照声明的明细表，没有则为空数组。 */
const detailTables = computed(() => schema.value?.detailTables ?? []);

/** 某张明细表的可编辑字段。 */
function detailFields(detailTableId: number): FormFieldSchema[] {
  return fieldsOfTable(schema.value?.fields ?? [], detailTableId);
}

function addDetailRow(detailKey: string, detailTableId: number) {
  const rows = createDetails.value[detailKey];
  if (!rows) return;
  rows.push(blankRow(schema.value?.fields ?? [], detailTableId));
}

function removeDetailRow(detailKey: string, index: number) {
  createDetails.value[detailKey]?.splice(index, 1);
}

function openCreate() {
  for (const key of Object.keys(createModel)) {
    delete createModel[key];
  }
  for (const field of editableFields.value) {
    const type = fieldType(field);
    createModel[field.fieldKey] = ['MULTI_SELECT', 'CHECKBOX'].includes(type)
      ? []
      : type === 'BOOLEAN'
        ? false
        : field.defaultValue ?? '';
  }
  // 每张明细表起始为空数组，再按 minRows 预填到最少行数 —— 否则用户一打开就
  // 面对一个「至少 2 行」的报错，却看不到任何可填的行。
  createDetails.value = emptyDetailRows(detailTables.value);
  for (const table of detailTables.value) {
    const min = table.minRows ?? 0;
    for (let i = 0; i < min; i += 1) {
      createDetails.value[table.detailKey]!.push(
        blankRow(schema.value?.fields ?? [], table.detailTableId),
      );
    }
  }
  createVisible.value = true;
}

function missingRequiredField(): string {
  for (const field of editableFields.value) {
    if (!field.isRequired) continue;
    const value = createModel[field.fieldKey];
    if (value === '' || value === null || value === undefined) {
      return field.fieldLabel;
    }
  }
  return '';
}

async function submitCreate() {
  const missing = missingRequiredField();
  if (missing) {
    ElMessage.warning(`请填写必填项：${missing}`);
    return;
  }
  // 明细行也在本地查一遍。后端同样会查，但它只能说「至少 2 行」；
  // 这里能说出是第几行的哪个字段，用户才知道去改哪里。
  const detailError = validateDetailRows(
    detailTables.value,
    schema.value?.fields ?? [],
    createDetails.value,
  );
  if (detailError) {
    ElMessage.warning(detailError);
    return;
  }

  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {};
    for (const field of editableFields.value) {
      const value = createModel[field.fieldKey];
      if (value === '' || value === null || value === undefined) continue;
      payload[field.fieldKey] = isNumericField(field) ? Number(value) : value;
    }
    await createFormDataApi(
      formKey.value,
      payload,
      toDetailPayload(detailTables.value, schema.value?.fields ?? [], createDetails.value),
      viewKey.value,
    );
    ElMessage.success('新增成功');
    createVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '新增失败');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm('确认删除该记录？', '提示', { type: 'warning' });
  } catch {
    // 用户取消，不做任何处理
    return;
  }

  try {
    await deleteFormDataApi(formKey.value, Number(row.id), viewKey.value);
    ElMessage.success('已删除');
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败');
  }
}

/**
 * 复制选中行。
 *
 * 逐行独立请求并用 `allSettled` 汇总，而不是一次批量接口：复制会重跑写入校验，
 * 一行失败（引用值已封存、唯一键冲突）不该让其余行也回滚 ——
 * 同 Excel 导入「一行失败不回滚已成功的行」的取舍。
 */
async function copyRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确认复制选中的 ${rows.length} 条记录？复制出的记录内容相同、编号为新。`,
      '复制确认',
    );
  } catch {
    return;
  }

  copying.value = true;
  try {
    const results = await Promise.allSettled(
      rows.map((row) =>
        copyFormDataApi(formKey.value, Number(row.id), viewKey.value),
      ),
    );
    const failed = results.filter((item) => item.status === 'rejected');
    if (failed.length === 0) {
      ElMessage.success(`已复制 ${results.length} 条`);
    } else {
      // 点名第一条失败原因：逐条列出会在多选时刷屏，而失败原因通常同因同源
      const reason =
        (failed[0] as PromiseRejectedResult).reason?.message ?? '未知原因';
      ElMessage.warning(
        `${results.length - failed.length} 条复制成功，${failed.length} 条失败：${reason}`,
      );
    }
    selectedRows.value = [];
    await loadData();
  } finally {
    copying.value = false;
  }
}

async function reload() {
  await loadSchema();
  await loadData();
}

onMounted(reload);

// 同一运行时组件被多个表单/视图路由复用。必须同时监听 viewKey：
// 在同一张表单的两个视图之间切换时 formKey 不变，只看 formKey 不会触发重载，
// 页面会继续显示上一个视图的数据。
watch([formKey, viewKey], async ([nextForm, nextView], [prevForm, prevView]) => {
  if (nextForm && (nextForm !== prevForm || nextView !== prevView)) {
    await reload();
  }
});
</script>

<template>
  <div class="form-runtime-page">
    <div v-if="schemaLoading" class="page-state">正在加载表单...</div>

    <div v-else-if="schemaError" class="page-state page-state--error">
      <p>{{ schemaError }}</p>
      <el-button size="small" @click="reload">重试</el-button>
    </div>

    <template v-else-if="schema">
      <div class="page-header">
        <div class="page-header__title">
          <h2>{{ schema.formName }}</h2>
          <span class="page-header__meta">
            {{ schema.formKey }} · 版本 v{{ schema.schemaVersion }}
          </span>
        </div>
        <div class="page-header__actions">
          <el-button :loading="loading" @click="loadData">刷新</el-button>
          <el-button :loading="downloading" @click="exportData">导出</el-button>
          <el-button v-if="canCreate" :loading="downloading" @click="downloadTemplate">
            导入模板
          </el-button>
          <el-button v-if="canCreate" @click="importVisible = true">导入</el-button>
          <el-button v-if="canCreate" type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>

      <div v-if="summaries.length > 0" class="list-summary">
        <div v-for="item in summaries" :key="item.label" class="list-summary__item">
          <span class="list-summary__label">{{ item.label }}</span>
          <span class="list-summary__value">{{ item.value ?? '—' }}</span>
        </div>
      </div>

      <div
        v-if="searchableFields.length > 0 || singleSearchFields.length > 0"
        class="list-search"
      >
        <!-- 聚合搜索：一个框，对所有勾选的字段做 OR 模糊匹配 -->
        <el-input
          v-if="searchableFields.length > 0"
          v-model="keyword"
          clearable
          :placeholder="`搜索${searchableFields.map((field) => field.fieldLabel).join(' / ')}`"
          style="max-width: 320px"
          @clear="applySearch"
          @keyup.enter="applySearch"
        />

        <!-- 单字段搜索：每个字段一个独立输入框 -->
        <div
          v-for="field in singleSearchFields"
          :key="field.fieldKey"
          class="list-search__field"
        >
          <span class="list-search__label">{{ field.fieldLabel }}</span>
          <el-select
            v-if="isOptionField(field)"
            v-model="singleSearchValues[field.fieldKey]"
            clearable
            filterable
            style="width: 160px"
            :placeholder="`选择${field.fieldLabel}`"
            @change="applySearch"
          >
            <el-option
              v-for="option in fieldOptions(field)"
              :key="option.id"
              :label="option.label"
              :value="option.id"
            />
          </el-select>
          <el-input
            v-else
            v-model="singleSearchValues[field.fieldKey]"
            clearable
            style="width: 160px"
            :placeholder="field.fieldLabel"
            @clear="applySearch"
            @keyup.enter="applySearch"
          />
        </div>

        <el-button :loading="loading" type="primary" @click="applySearch">
          搜索
        </el-button>
        <el-button v-if="hasActiveSearch" @click="resetSearch">重置</el-button>
      </div>

      <!-- 多选复制的工具条：只在真的选中了行时出现，避免常驻一条空提示 -->
      <div v-if="canCreate && selectedRows.length > 0" class="list-batch">
        <span>已选 {{ selectedRows.length }} 条</span>
        <el-button
          :loading="copying"
          size="small"
          type="primary"
          @click="copyRows(selectedRows)"
        >
          批量复制
        </el-button>
        <el-button size="small" @click="selectedRows = []">取消选择</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="dataList"
        border
        stripe
        @selection-change="selectedRows = $event"
      >
        <el-table-column v-if="canCreate" type="selection" width="46" />
        <el-table-column
          v-for="field in listFields"
          :key="field.fieldKey"
          :label="field.fieldLabel"
          :prop="listProp(field)"
          min-width="140"
          show-overflow-tooltip
        />
        <!-- canCreate 已经是「授权允许 CREATE 且本入口非只读」的交集（后端算），
             所以只读入口整列不渲染，不需要在前端再判一次视图标记 -->
        <el-table-column v-if="canCreate" fixed="right" label="操作" width="150">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button
                :loading="copying"
                size="small"
                @click="copyRows([row])"
              >
                复制
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <span class="table-empty">暂无数据</span>
        </template>
      </el-table>

      <ExcelImportDialog
        v-model="importVisible"
        :confirm-import="confirmImport"
        :preview-import="previewImport"
        :title="`导入${schema?.formName ?? ''}数据`"
        @success="loadData"
      />

      <el-pagination
        v-if="total > pageSize"
        class="list-pagination"
        :current-page="page + 1"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="changePage"
      />

      <el-dialog
        v-model="createVisible"
        :title="`新增 - ${schema.formName}`"
        width="520px"
      >
        <el-form label-position="top">
      <el-form-item
            v-for="field in editableFields"
            :key="field.fieldKey"
            :label="field.fieldLabel"
            :required="field.isRequired"
          >
            <el-select
              v-if="['SELECT', 'MULTI_SELECT', 'REFERENCE'].includes(fieldType(field))"
              v-model="createModel[field.fieldKey]"
              :multiple="fieldType(field) === 'MULTI_SELECT'"
              :remote="fieldType(field) === 'REFERENCE'"
              :remote-method="(keyword: string) => remoteSearch(field, keyword)"
              :loading="optionLoading[field.fieldKey]"
              :reserve-keyword="fieldType(field) === 'REFERENCE'"
              filterable
              clearable
              style="width: 100%"
            >
              <el-option v-for="option in fieldOptions(field)" :key="option.id" :label="referenceOptionLabel(option)" :value="option.id" />
              <template v-if="fieldType(field) === 'REFERENCE'" #footer>
                <span class="option-hint">
                  {{
                    fieldOptions(field).length >= REFERENCE_PAGE_SIZE
                      ? `仅显示前 ${REFERENCE_PAGE_SIZE} 条，请输入关键字继续检索`
                      : '输入关键字可按名称或编码检索'
                  }}
                </span>
              </template>
            </el-select>
            <el-checkbox-group v-else-if="fieldType(field) === 'CHECKBOX'" v-model="createModel[field.fieldKey]">
              <el-checkbox v-for="option in fieldOptions(field)" :key="option.id" :value="option.id">{{ referenceOptionLabel(option) }}</el-checkbox>
            </el-checkbox-group>
            <el-radio-group v-else-if="fieldType(field) === 'RADIO'" v-model="createModel[field.fieldKey]">
              <el-radio v-for="option in fieldOptions(field)" :key="option.id" :value="option.id">{{ referenceOptionLabel(option) }}</el-radio>
            </el-radio-group>
            <el-input-number
              v-else-if="isNumericField(field)"
              v-model="createModel[field.fieldKey]"
              style="width: 100%"
            />
            <el-switch v-else-if="fieldType(field) === 'BOOLEAN'" v-model="createModel[field.fieldKey]" />
            <el-input
              v-else
              v-model="createModel[field.fieldKey]"
              :type="['TEXTAREA', 'RICH_TEXT'].includes(fieldType(field)) ? 'textarea' : 'text'"
              :placeholder="`请输入${field.fieldLabel}`"
              clearable
            />
          </el-form-item>
        </el-form>

        <!--
          明细区：每张明细表一个始终可编辑的 el-table。
          用原生 el-table 而不是引入 vxe-table —— 行内编辑本质就是在 #default 插槽里
          放一个绑到 row[fieldKey] 的控件，el-table 的 row 是可写引用，v-model 直接生效。
          没有「点击进入编辑」的状态机，对录入场景反而更顺：不用先点一下才能输入。
        -->
        <section
          v-for="table in detailTables"
          :key="table.detailKey"
          class="detail-section"
        >
          <div class="detail-header">
            <strong>{{ table.detailName || table.detailKey }}</strong>
            <span class="detail-hint">
              {{ (createDetails[table.detailKey] ?? []).length }} 行
              <template v-if="(table.minRows ?? 0) > 0">
                ／至少 {{ table.minRows }} 行
              </template>
              ／最多 {{ maxRowsOf(table) }} 行
            </span>
            <el-button
              size="small"
              :disabled="(createDetails[table.detailKey] ?? []).length >= maxRowsOf(table)"
              @click="addDetailRow(table.detailKey, table.detailTableId)"
            >
              添加行
            </el-button>
          </div>
          <el-alert
            v-if="detailFields(table.detailTableId).length === 0"
            type="warning"
            :closable="false"
            show-icon
            title="这张明细表还没有字段"
            description="请在设计器的「字段设计」里把字段的「所属表」设为该明细表。"
          />
          <el-table
            v-else
            :data="createDetails[table.detailKey] ?? []"
            size="small"
            border
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column
              v-for="field in detailFields(table.detailTableId)"
              :key="field.fieldKey"
              :label="field.fieldLabel"
              min-width="150"
            >
              <template #default="{ row }">
                <el-select
                  v-if="isChoiceField(field)"
                  v-model="row[field.fieldKey]"
                  :loading="optionLoading[field.fieldKey]"
                  :multiple="['CHECKBOX', 'MULTI_SELECT'].includes(fieldType(field))"
                  filterable
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="option in optionMap[field.fieldKey] ?? []"
                    :key="option.id"
                    :label="referenceOptionLabel(option)"
                    :value="option.id"
                  />
                </el-select>
                <el-switch
                  v-else-if="fieldType(field) === 'BOOLEAN'"
                  v-model="row[field.fieldKey]"
                />
                <el-input-number
                  v-else-if="isNumericField(field)"
                  v-model="row[field.fieldKey]"
                  :controls="false"
                  style="width: 100%"
                />
                <el-date-picker
                  v-else-if="['DATE', 'DATETIME'].includes(fieldType(field))"
                  v-model="row[field.fieldKey]"
                  :type="fieldType(field) === 'DATETIME' ? 'datetime' : 'date'"
                  :value-format="fieldType(field) === 'DATETIME' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
                  style="width: 100%"
                />
                <el-input v-else v-model="row[field.fieldKey]" clearable />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" fixed="right">
              <template #default="{ $index }">
                <el-button
                  link
                  type="danger"
                  @click="removeDetailRow(table.detailKey, $index)"
                >
                  删
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
        <template #footer>
          <el-button @click="createVisible = false">取消</el-button>
          <el-button
            :loading="submitting"
            type="primary"
            @click="submitCreate"
          >
            保存
          </el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.detail-section {
  margin-top: 16px;
}

.detail-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.detail-hint {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.option-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-runtime-page {
  padding: 16px;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header__title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.page-header__meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.page-header__actions {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  white-space: nowrap;
}

.page-state {
  padding: 48px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.page-state--error {
  color: var(--el-color-danger);
}

.list-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.list-summary__item { display: flex; gap: 8px; align-items: baseline; }

.list-summary__label { font-size: 13px; color: var(--el-text-color-secondary); }

.list-summary__value { font-size: 18px; font-weight: 600; }

.list-search {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.list-batch {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

/* 操作列按钮不换行：默认 flex 换行会让第二个按钮掉到下一行、把行高撑高一倍。
   与全仓其它 43 处操作列同一套写法（inline-flex + nowrap）。 */
.row-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
}

/* 单字段搜索项：字段名与输入框成对，换行时整对一起换 */
.list-search__field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}

.list-search__label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.list-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.table-empty {
  color: var(--el-text-color-secondary);
}
</style>
