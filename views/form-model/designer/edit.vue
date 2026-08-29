<script setup lang="ts">
import type { FormFieldSchema, FormSchemaResponse } from '#/api/form-model';
import type { ReferenceSourceOption } from '#/api/formModelDesigner';

import type { DesignerDetailTable } from './detail-table-panel.vue';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElMessage, ElMessageBox } from 'element-plus';

import { getDictionaryApi } from '#/api/dictionary';
import {
  getDesignerDraftApi,
  getReferenceSourceCatalogApi,
  publishDesignerFormApi,
  saveDesignerDraftApi,
} from '#/api/formModelDesigner';

import DetailTablePanel from './detail-table-panel.vue';
import {
  detailClientKeyOf,
  findOrphanFields,
  isFormPublished,
  ownerTableLabel,
} from './detail-table-owner';
import {
  FIELD_TYPES,
  fieldTypeLabel,
  NEW_FIELD_DEFAULTS,
  OPTION_FIELD_TYPES,
  optionSourceLabel,
  parseBulkOptions,
  pickDraftFieldPayload,
  validateFieldKeys,
} from './field-type-labels';
import GrantPanel from './grant-panel.vue';
import ViewPanel from './view-panel.vue';

defineOptions({ name: 'FormModelDesignerEdit' });

const route = useRoute();
const router = useRouter();
const formKey = String(route.params.formKey ?? '');
/**
 * 字段设计、明细表、菜单入口、访问授权四个 tab。
 *
 * 都挂在 tab 里而不是独立页面：四者的对象都是「这张表单」，
 * 共享同一个 formKey 上下文，切页会丢失未保存的草稿现场。
 */
const activeTab = ref('fields');
const loading = ref(false);
const saving = ref(false);
const publishing = ref(false);
const selectedUid = ref('');
const schema = ref<FormSchemaResponse>();
const model = reactive({ formName: '', remark: '' });
const fields = ref<DesignerField[]>([]);
const detailTables = ref<DesignerDetailTable[]>([]);

type StaticOption = { code: string; label: string; sort: number };
/**
 * `uid` 是仅存在于前端的稳定标识。
 *
 * 不能用 `fieldKey` 选中字段：它在属性面板里可编辑，改一个字符就会让
 * 「当前选中」失效，面板瞬间退回「请选择字段」。`fieldId` 对新增字段是 0，
 * 同样不能当身份用。
 */
type DesignerField = FormFieldSchema & {
  /**
   * 归属明细表的前端标识（明细表面板里那一行的 `uid`），空串/缺省 = 主表字段。
   *
   * 与后端的 `detailTableId` 是<b>两种表达</b>，需要双向翻译：加载时按 id 找到对应
   * 明细表的 uid，提交时后端再按 uid 换回真实 id。不能直接用 `detailTableId`，
   * 因为新建的明细表还没有 id。
   */
  detailClientKey?: string;
  optionConfigJson?: string;
  staticOptions?: StaticOption[];
  uid: string;
};

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `f${uidSeq}`;
}

const selectedField = computed(() =>
  fields.value.find((field) => field.uid === selectedUid.value),
);

/**
 * 字段是否已发布 —— 已发布的字段不能换归属表。
 *
 * `fieldId > 0` 单独不够用：草稿阶段保存过的字段也有 id。
 */
function isPublishedField(field: DesignerField): boolean {
  return isFormPublished(detailTables.value) && (field.fieldId ?? 0) > 0;
}

/** 字段列表里显示的归属表名。 */
function ownerLabel(field: DesignerField): string {
  return ownerTableLabel(field, detailTables.value);
}
const fieldTypes = FIELD_TYPES;
const optionFieldTypes: readonly string[] = OPTION_FIELD_TYPES;

/**
 * 单字段搜索可选的运算符，与后端 `FormSqlBuilder.OPERATOR_SQL` 白名单一致。
 *
 * 不含 IS_NULL / IS_NOT_NULL：那两个不需要用户输入值，作为"搜索框"没有意义。
 */
const SINGLE_SEARCH_OPERATORS = [
  { label: '包含（模糊匹配）', value: 'LIKE' },
  { label: '等于', value: 'EQ' },
  { label: '不等于', value: 'NE' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GE' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LE' },
] as const;

function staticOptions(field: FormFieldSchema): StaticOption[] {
  const configured = field.optionConfig?.options;
  if (!Array.isArray(configured)) return [];
  return configured.flatMap((option, index) =>
    typeof option?.code === 'string' && typeof option?.label === 'string'
      ? [{ code: option.code, label: option.label, sort: Number(option.sort ?? index + 1) }]
      : [],
  );
}

function allowedOptionSourceTypes(fieldType: string): string[] {
  switch (fieldType) {
    case 'REFERENCE': {
      return ['REFERENCE'];
    }
    case 'MULTI_SELECT':
    case 'CHECKBOX': {
      return ['STATIC'];
    }
    case 'SELECT':
    case 'RADIO': {
      return ['STATIC', 'DICTIONARY'];
    }
    default: {
      return [];
    }
  }
}

function normalizeOptionSource(field: DesignerField) {
  const allowedSources = allowedOptionSourceTypes(field.fieldType);
  if (allowedSources.length === 0) {
    field.optionSourceType = undefined;
    field.optionConfigJson = '';
    return;
  }
  if (!field.optionSourceType || !allowedSources.includes(field.optionSourceType)) {
    field.optionSourceType = allowedSources[0];
    field.optionConfigJson = '';
  }
  if (field.optionSourceType === 'STATIC') field.staticOptions ??= [];
}

function addStaticOption(field: DesignerField) {
  field.staticOptions ??= [];
  field.staticOptions.push({ code: '', label: '', sort: field.staticOptions.length + 1 });
}

/**
 * 已存在的字典类型及其选项数量。
 *
 * `sys_dictionary` 是扁平表，一行就是一个选项，`type` 只是分组列。
 * 后端保存/发布时不校验类型是否真的有行，选了空类型只会在运行时渲染出空下拉，
 * 所以这里必须把「有几个选项」直接摆在选择处。
 */
const dictTypes = ref<Array<{ count: number; type: string }>>([]);

async function loadDictTypes() {
  try {
    const items = await getDictionaryApi();
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    }
    dictTypes.value = [...counts.entries()]
      .map(([type, count]) => ({ count, type }))
      .sort((a, b) => a.type.localeCompare(b.type));
  } catch {
    // 字典是辅助信息，加载失败不应阻断设计器；用户仍可手工填 JSON
    dictTypes.value = [];
  }
}

/** 当前字段选中的字典类型，读写都落到 optionConfigJson 上 */
const dictType = computed({
  get(): string {
    const field = selectedField.value;
    if (!field?.optionConfigJson) return '';
    try {
      return String(JSON.parse(field.optionConfigJson)?.type ?? '');
    } catch {
      return '';
    }
  },
  set(type: string) {
    const field = selectedField.value;
    if (field) field.optionConfigJson = JSON.stringify({ type });
  },
});

/**
 * 系统已注册的引用源。
 *
 * 引用源是**代码注册白名单**，不能自定义 —— 手填一个不存在的 source 要等到发布或
 * 运行时才报 `REFERENCE_SOURCE_UNKNOWN`。所以这里与字典下拉不同：**不开
 * `allow-create`**，只能从目录里选。
 */
const referenceSources = ref<ReferenceSourceOption[]>([]);

async function loadReferenceSources() {
  try {
    referenceSources.value = await getReferenceSourceCatalogApi();
  } catch {
    // 目录加载失败时保持空数组，UI 会提示并保留手工填 JSON 的退路
    referenceSources.value = [];
  }
}

/** 当前字段选中的引用源，读写都落到 optionConfigJson 上 */
const referenceSource = computed({
  get(): string {
    const field = selectedField.value;
    if (!field?.optionConfigJson) return '';
    try {
      return String(JSON.parse(field.optionConfigJson)?.source ?? '');
    } catch {
      return '';
    }
  },
  set(source: string) {
    const field = selectedField.value;
    if (field) field.optionConfigJson = JSON.stringify({ source });
  },
});

/**
 * 是否为草稿版本冲突。
 *
 * 后端 `FormDesignerService` 抛 `Stale draft revision: expected N but found M`，
 * 此时本地 schemaVersion 已过期，只能重载；其他错误必须保留用户现场。
 */
function isRevisionConflict(message: string): boolean {
  return message.includes('Stale draft revision');
}

const bulkVisible = ref(false);
const bulkText = ref('');

function openBulkOptions() {
  bulkText.value = '';
  bulkVisible.value = true;
}

function applyBulkOptions() {
  const field = selectedField.value;
  if (!field) return;

  const parsed = parseBulkOptions(bulkText.value);
  if (parsed.length === 0) {
    ElMessage.warning('请输入至少一个选项');
    return;
  }

  field.staticOptions ??= [];
  const existing = new Set(field.staticOptions.map((option) => option.code));
  const added = parsed.filter((option) => !existing.has(option.code));
  const skipped = parsed.length - added.length;

  for (const option of added) {
    field.staticOptions.push({
      ...option,
      sort: field.staticOptions.length + 1,
    });
  }

  bulkVisible.value = false;
  ElMessage.success(
    skipped > 0 ? `已新增 ${added.length} 个选项，跳过 ${skipped} 个重复编码` : `已新增 ${added.length} 个选项`,
  );
}

function removeStaticOption(field: DesignerField, index: number) {
  field.staticOptions?.splice(index, 1);
}

async function load() {
  loading.value = true;
  try {
    schema.value = await getDesignerDraftApi(formKey);
    model.formName = schema.value.formName;
    model.remark = schema.value.remark ?? '';
    // 明细表必须先建好，字段才能把 detailTableId 翻译成 uid。
    detailTables.value = (schema.value.detailTables ?? []).map((table) => ({
      ...table,
      uid: `d${table.detailTableId}`,
    }));
    fields.value = (schema.value.fields ?? []).map((field) => {
      const designerField: DesignerField = {
        ...field,
        uid: nextUid(),
        detailClientKey: detailClientKeyOf(field, detailTables.value),
        optionConfigJson: field.optionConfig ? JSON.stringify(field.optionConfig, null, 2) : '',
        staticOptions: staticOptions(field),
      };
      normalizeOptionSource(designerField);
      return designerField;
    });
    selectedUid.value = fields.value[0]?.uid ?? '';
  } catch (error: any) {
    ElMessage.error(error?.message || '加载草稿失败');
  } finally {
    loading.value = false;
  }
}

function addField() {
  const field: DesignerField = {
    fieldId: 0,
    uid: nextUid(),
    fieldKey: `field_${fields.value.length + 1}`,
    fieldLabel: '新字段',
    ...NEW_FIELD_DEFAULTS,
    sort: fields.value.length + 1,
  };
  fields.value.push(field);
  selectedUid.value = field.uid;
}

async function removeField(field: DesignerField) {
  try {
    await ElMessageBox.confirm(`确认删除字段“${field.fieldLabel}”？`, '删除确认');
  } catch {
    return;
  }
  fields.value = fields.value.filter((item) => item.uid !== field.uid);
  if (selectedUid.value === field.uid) selectedUid.value = fields.value[0]?.uid ?? '';
}

async function save() {
  if (!schema.value) return;

  const keyError = validateFieldKeys(fields.value);
  if (keyError) {
    // 选中出错的字段，用户能直接看到并就地修正
    const broken = fields.value.find((field) => !field.fieldKey || keyError.includes(`「${field.fieldKey}」`));
    if (broken) selectedUid.value = broken.uid;
    ElMessage.error(keyError);
    return;
  }

  // 明细表被删掉后，指向它的字段会悬空。后端会拒绝整次保存（不降级成主表字段），
  // 所以这里先给出能行动的提示：说出是哪些字段，并选中第一个。
  const orphans = findOrphanFields(fields.value, detailTables.value);
  if (orphans.length > 0) {
    selectedUid.value = orphans[0]!.uid;
    activeTab.value = 'fields';
    ElMessage.error(
      `字段「${orphans.map((field) => field.fieldLabel || field.fieldKey).join('、')}」` +
        `所属的明细表已删除，请改为主表或其它明细表`,
    );
    return;
  }

  saving.value = true;
  try {
    const payloadFields = fields.value.map((field) => {
      const payload = pickDraftFieldPayload(field as unknown as Record<string, unknown>);
      if (field.optionSourceType === 'STATIC') {
        const options = field.staticOptions ?? [];
        const codes = options.map((option) => option.code.trim()).filter(Boolean);
        if (codes.length !== options.length || new Set(codes).size !== codes.length
          || options.some((option) => !option.label.trim())) {
          throw new Error(`字段「${field.fieldLabel || field.fieldKey}」的静态选项编码和名称必须填写，且编码不可重复`);
        }
        payload.optionConfig = JSON.stringify({
          options: options.map((option) => ({ code: option.code.trim(), label: option.label.trim(), sort: option.sort })),
        });
      } else if (field.optionConfigJson?.trim()) {
        JSON.parse(field.optionConfigJson);
        payload.optionConfig = field.optionConfigJson;
      } else {
        delete payload.optionConfig;
      }
      return payload;
    });
    const result = await saveDesignerDraftApi(formKey, {
      expectedDraftRevision: schema.value.schemaVersion,
      formName: model.formName,
      remark: model.remark,
      fields: payloadFields,
      // clientKey 用面板里那一行的 uid：新建的明细表还没有 id，字段靠这个指向它。
      detailTables: detailTables.value.map((table) => ({
        clientKey: table.uid,
        detailKey: table.detailKey,
        detailName: table.detailName,
        sort: table.sort,
        minRows: table.minRows,
        maxRows: table.maxRows,
      })),
    });
    schema.value.schemaVersion = result.draftRevision;
    ElMessage.success('草稿已保存');
  } catch (error: any) {
    const message = error?.message || '保存草稿失败';
    ElMessage.error(message);
    // 只有版本冲突才必须重载：本地 schemaVersion 已过期，继续保存只会反复失败。
    // 其余错误（Key 不合法、选项没填全）都要保留用户现场，否则一次报错就把
    // 刚填的内容全部清空，用户没法在原记录上修正。
    if (isRevisionConflict(message)) await load();
  } finally {
    saving.value = false;
  }
}

async function publish() {
  if (!schema.value) return;
  publishing.value = true;
  try {
    await publishDesignerFormApi(schema.value.formId, schema.value.schemaVersion);
    ElMessage.success('表单已发布');
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '发布表单失败');
  } finally {
    publishing.value = false;
  }
}

function preview() {
  const href = router.resolve({
    name: 'FormModelDesignerPreview',
    params: { formKey },
  }).href;
  window.open(href, '_blank', 'noopener');
}

onMounted(() => {
  load();
  loadDictTypes();
  loadReferenceSources();
});
</script>

<template>
  <div v-loading="loading" class="designer-edit">
    <div class="toolbar">
      <div><h1>{{ model.formName || formKey }}</h1><span>草稿版本 {{ schema?.schemaVersion ?? '-' }}</span></div>
      <div class="actions"><el-button @click="router.back()">返回</el-button><el-button @click="preview">预览</el-button><el-button type="success" :loading="publishing" @click="publish">发布</el-button><el-button type="primary" :loading="saving" @click="save">保存草稿</el-button></div>
    </div>

    <el-form label-position="top" class="metadata">
      <el-form-item label="表单名称"><el-input v-model="model.formName" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="model.remark" /></el-form-item>
    </el-form>

    <el-tabs v-model="activeTab" class="designer-tabs">
      <el-tab-pane label="字段设计" name="fields">
    <div class="workbench">
      <section class="field-panel">
        <div class="panel-header"><strong>字段列表</strong><el-button size="small" @click="addField">新增字段</el-button></div>
        <el-table :data="fields" row-key="uid" highlight-current-row @current-change="(row: DesignerField | undefined) => { if (row) selectedUid = row.uid; }">
          <el-table-column prop="fieldKey" label="Key" min-width="130" />
          <el-table-column prop="fieldLabel" label="名称" min-width="120" />
          <el-table-column label="类型" width="110"><template #default="{ row }">{{ fieldTypeLabel(row.fieldType) }}</template></el-table-column>
          <el-table-column v-if="detailTables.length > 0" label="所属表" min-width="110">
            <template #default="{ row }">{{ ownerLabel(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="70"><template #default="{ row }"><el-button link type="danger" @click.stop="removeField(row)">删</el-button></template></el-table-column>
        </el-table>
      </section>

      <section class="property-panel">
        <el-empty v-if="!selectedField" description="请选择字段" />
        <el-form v-else label-position="top">
          <el-form-item label="字段 Key">
            <el-input v-model="selectedField.fieldKey" />
            <p class="key-hint">小写字母开头，仅含小写字母/数字/下划线，长度 2-50；不能以 _label 结尾，也不能用 id、create_time 等系统列名。</p>
          </el-form-item>
          <el-form-item label="字段名称"><el-input v-model="selectedField.fieldLabel" /></el-form-item>
          <el-form-item v-if="detailTables.length > 0" label="所属表">
            <el-select
              v-model="selectedField.detailClientKey"
              style="width: 100%"
              clearable
              placeholder="主表"
              :disabled="isPublishedField(selectedField as DesignerField)"
            >
              <el-option label="主表" :value="undefined" />
              <el-option
                v-for="table in detailTables"
                :key="table.uid"
                :label="table.detailName || table.detailKey"
                :value="table.uid"
              />
            </el-select>
            <p class="key-hint">
              <template v-if="isPublishedField(selectedField as DesignerField)">
                字段已发布，不能换表：列已经建在原来那张物理表上了。
              </template>
              <template v-else>
                明细表字段表示「一条主记录下的多行」，不会出现在主表单和列表列里。
              </template>
            </p>
          </el-form-item>
          <el-form-item label="字段类型"><el-select v-model="selectedField.fieldType" style="width: 100%" @change="normalizeOptionSource(selectedField as DesignerField)"><el-option v-for="type in fieldTypes" :key="type" :label="fieldTypeLabel(type)" :value="type" /></el-select></el-form-item>
          <el-form-item v-if="['TEXT', 'TEXTAREA'].includes(selectedField.fieldType)" label="最大长度"><el-input-number v-model="selectedField.maxLength" :min="1" /></el-form-item>
          <el-form-item v-if="['NUMBER', 'MONEY'].includes(selectedField.fieldType)" label="小数位"><el-input-number v-model="selectedField.decimalScale" :min="0" :max="6" /></el-form-item>
          <el-form-item label="默认值"><el-input v-model="selectedField.defaultValue" /></el-form-item>
          <template v-if="optionFieldTypes.includes(selectedField.fieldType)">
            <el-form-item label="选项来源类型">
              <el-select v-model="selectedField.optionSourceType" style="width: 100%" @change="normalizeOptionSource(selectedField as DesignerField)">
                <el-option v-for="type in allowedOptionSourceTypes(selectedField.fieldType)" :key="type" :label="optionSourceLabel(type)" :value="type" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="selectedField.optionSourceType === 'STATIC'" label="静态选项">
              <el-table :data="selectedField.staticOptions ?? []" size="small">
                <el-table-column label="编码" min-width="110"><template #default="{ row }"><el-input v-model="row.code" /></template></el-table-column>
                <el-table-column label="名称" min-width="130"><template #default="{ row }"><el-input v-model="row.label" /></template></el-table-column>
                <el-table-column label="排序" width="90"><template #default="{ row }"><el-input-number v-model="row.sort" :min="1" /></template></el-table-column>
                <el-table-column label="操作" width="65"><template #default="{ $index }"><el-button link type="danger" @click="removeStaticOption(selectedField as DesignerField, $index)">删</el-button></template></el-table-column>
              </el-table>
              <div class="option-actions">
                <el-button size="small" @click="addStaticOption(selectedField as DesignerField)">新增选项</el-button>
                <el-button size="small" type="primary" plain @click="openBulkOptions">批量新增</el-button>
              </div>
            </el-form-item>
            <el-form-item v-else-if="selectedField.optionSourceType === 'DICTIONARY'" label="字典类型">
              <el-select v-model="dictType" filterable allow-create default-first-option style="width: 100%" placeholder="选择公共字典中已维护的类型">
                <el-option v-for="item in dictTypes" :key="item.type" :label="`${item.type}（${item.count} 个选项）`" :value="item.type" />
              </el-select>
              <p v-if="dictTypes.length === 0" class="dict-hint">
                公共字典还没有任何数据。请先到「系统管理 → 公共字典管理」按同一类型逐行新增选项。
              </p>
              <p v-else-if="dictType && !dictTypes.some((item) => item.type === dictType)" class="dict-hint">
                类型「{{ dictType }}」在公共字典中没有任何选项，运行时会渲染成空下拉。
              </p>
            </el-form-item>
            <el-form-item v-else-if="selectedField.optionSourceType === 'REFERENCE'" label="引用数据源">
              <el-select v-model="referenceSource" filterable style="width: 100%" placeholder="选择系统已注册的引用源">
                <el-option v-for="item in referenceSources" :key="item.key" :label="`${item.displayName}（${item.key}）`" :value="item.key" />
              </el-select>
              <p v-if="referenceSources.length === 0" class="dict-hint">
                引用源目录加载失败或为空。引用源由后端代码注册，无法在界面新增。
              </p>
              <p v-else class="key-hint">
                引用源是代码注册白名单，只能选择列表中的值；候选数据按当前租户与表单归属账套过滤。
              </p>
            </el-form-item>
            <el-form-item v-else label="选项来源配置 JSON"><el-input v-model="(selectedField as DesignerField).optionConfigJson" type="textarea" :rows="4" placeholder='REFERENCE：{"source":"material"}' /></el-form-item>
          </template>
          <el-checkbox v-model="selectedField.isRequired">必填</el-checkbox>
          <el-checkbox v-model="selectedField.isVisible">可见</el-checkbox>
          <!-- 「在列表显示」与「列表列顺序」已迁到「菜单入口」tab：
               列显示跟着实际菜单走，同一张表单的两个入口应能显示不同的列。 -->
          <el-form-item label="列表显示">
            <p class="key-hint">
              列表显示哪些列、按什么顺序，现在到<strong>「菜单入口」</strong>tab
              为每个入口单独配置 —— 同一张表单的「查询入口」与「录入入口」可以显示不同的列。
            </p>
          </el-form-item>

          <el-form-item label="搜索方式">
            <div class="search-options">
              <el-checkbox v-model="selectedField.isQueryCondition">
                聚合搜索
              </el-checkbox>
              <p class="key-hint">
                列表上方只有一个关键字框，会对所有勾选「聚合搜索」的字段做 OR 模糊匹配。
                适合"输入一个词，在编码、名称、备注里一起找"。
              </p>
              <el-checkbox v-model="selectedField.isSingleSearch">
                单字段搜索
              </el-checkbox>
              <p class="key-hint">
                该字段获得一个属于自己的搜索框，独立过滤。适合"状态"「日期」这类要精确指定的条件。
                两者可以同时勾选，互不影响。
              </p>
            </div>
          </el-form-item>

          <el-form-item v-if="selectedField.isSingleSearch" label="单字段搜索运算符">
            <el-select v-model="selectedField.queryOperator" clearable style="width: 100%" placeholder="按字段类型自动推断">
              <el-option
                v-for="operator in SINGLE_SEARCH_OPERATORS"
                :key="operator.value"
                :label="operator.label"
                :value="operator.value"
              />
            </el-select>
            <p class="key-hint">
              留空时：文本类字段用「包含」，其余用「等于」。数值与日期不要用「包含」——
              那会让 10 匹配到 100，也用不上索引。
            </p>
          </el-form-item>
        </el-form>
      </section>
    </div>
      </el-tab-pane>

      <el-tab-pane label="明细表" name="details">
        <!--
          唯一用 v-model 的 tab：明细表必须与主表字段同一次 saveDraft 提交
          （明细表 id 是明细字段的前置），所以状态归父组件持有，由 save() 一并提交。
          ViewPanel / GrantPanel 的数据独立于草稿，才能各自请求各自保存。
        -->
        <DetailTablePanel v-model:tables="detailTables" />
      </el-tab-pane>

      <el-tab-pane label="菜单入口" name="views">
        <!-- 传当前草稿里的字段而不是已发布快照：预置条件要能引用刚加的字段 -->
        <ViewPanel :fields="fields" :form-key="formKey" />
      </el-tab-pane>

      <el-tab-pane label="访问授权" name="grants">
        <!-- formId 来自已加载的 schema：没加载完就没法调授权接口 -->
        <GrantPanel
          v-if="schema?.formId"
          :form-id="schema.formId"
          :form-key="formKey"
        />
        <el-empty v-else description="表单信息加载中" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="bulkVisible" title="批量新增选项" width="480px">
      <el-input
        v-model="bulkText"
        type="textarea"
        :rows="10"
        placeholder="每行一个选项，例如：&#10;A&#10;B&#10;C&#10;&#10;需要区分编码与名称时用等号：&#10;HIGH=高&#10;LOW=低"
      />
      <p class="bulk-hint">编码是落库值，重复编码会被自动跳过。</p>
      <template #footer>
        <el-button @click="bulkVisible = false">取消</el-button>
        <el-button type="primary" @click="applyBulkOptions">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.designer-edit { padding: 20px; }
.toolbar, .panel-header, .actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h1 { margin: 0; font-size: 20px; }
.toolbar span { color: var(--el-text-color-secondary); font-size: 13px; }
.metadata { display: grid; grid-template-columns: 280px minmax(280px, 1fr); gap: 16px; margin: 16px 0; }
.designer-tabs { margin-top: 4px; }
.workbench { display: grid; grid-template-columns: minmax(480px, 1.3fr) minmax(320px, 0.7fr); gap: 16px; }
.field-panel, .property-panel { padding: 16px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); }
.property-panel { min-height: 480px; }
.option-actions { display: flex; gap: 8px; margin-top: 8px; }
.dict-hint, .bulk-hint { margin: 6px 0 0; font-size: 12px; color: var(--el-color-warning); line-height: 1.5; }
.search-options { display: flex; flex-direction: column; width: 100%; }
.search-options .key-hint { margin: 2px 0 10px; }
.key-hint { margin: 6px 0 0; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }
@media (max-width: 900px) { .workbench, .metadata { grid-template-columns: 1fr; } }
</style>
