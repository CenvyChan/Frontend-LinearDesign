<script setup lang="ts">
import type { FormFieldSchema } from '#/api/form-model';
import type {
  ListViewCondition,
  ListViewItem,
  MenuNodeOption,
} from '#/api/formModelDesigner';

import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  createFormListViewApi,
  deleteFormListViewApi,
  getFormListViewsApi,
  getFormMenuNodesApi,
  updateFormListViewApi,
} from '#/api/formModelDesigner';

defineOptions({ name: 'FormModelViewPanel' });

const props = defineProps<{
  /** 草稿里的字段，用于渲染预置条件的字段下拉 */
  fields: FormFieldSchema[];
  formKey: string;
}>();

/** 运算符白名单，必须与后端 `FormListViewService.ALLOWED_OPERATORS` 一致 */
const OPERATORS = [
  { label: '等于', value: 'EQ' },
  { label: '不等于', value: 'NE' },
  { label: '包含', value: 'LIKE' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GE' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LE' },
  { label: '为空', value: 'IS_NULL' },
  { label: '不为空', value: 'IS_NOT_NULL' },
] as const;

/** 这两个运算符不需要值，后端也不会读 value */
const VALUELESS_OPERATORS = new Set(['IS_NOT_NULL', 'IS_NULL']);

const loading = ref(false);
const saving = ref(false);
const views = ref<ListViewItem[]>([]);
const menuNodes = ref<MenuNodeOption[]>([]);
const dialogVisible = ref(false);
/** null 表示新建；否则是正在编辑的视图 id */
const editingId = ref<null | number>(null);

const model = reactive<{
  columnKeys: string[];
  conditions: ListViewCondition[];
  icon: string;
  parentMenuName: string;
  readOnly: boolean;
  routePath: string;
  sort: number;
  viewKey: string;
  viewName: string;
}>({
  viewKey: '',
  viewName: '',
  parentMenuName: '',
  icon: '',
  sort: 0,
  routePath: '',
  readOnly: false,
  // 列顺序就是这个数组的顺序 —— 用户拖动/勾选的次序即最终列序，
  // 不再让用户单独填一个排序号（那要求他心算全局顺序）
  columnKeys: [],
  conditions: [],
});

const isEditing = computed(() => editingId.value !== null);

/**
 * 只有主表且启用的字段能做预置条件，与后端的可查询字段口径一致。
 *
 * 明细字段必须排除：预置条件与列都作用在主表的那条 SQL 上，明细字段不在该表里，
 * 选中只会得到一个永远匹配不到的条件。此前注释这么写但代码没做这层过滤。
 */
const conditionFields = computed(() =>
  props.fields.filter(
    (field) =>
      (field.fieldStatus === undefined ||
        field.fieldStatus === null ||
        field.fieldStatus.toUpperCase() === 'ACTIVE') &&
      (field.detailTableId ?? 0) === 0,
  ),
);

/**
 * 可作为列表列的字段：启用且可见。
 *
 * 与运行时 `resolveListColumns` 的 `isSelectable` 同口径 —— 两处不一致会让用户
 * 勾上一个永远不显示的列，而界面不会给任何反馈。
 */
const listableFields = computed(() =>
  conditionFields.value.filter((field) => field.isVisible !== false),
);

const menuNodeTitle = computed(() => {
  const titles = new Map(menuNodes.value.map((node) => [node.name, node.title]));
  return (name?: null | string) => (name ? (titles.get(name) ?? name) : '顶级菜单');
});

/**
 * 预览「实际生效的地址」。
 *
 * 与后端 `FormViewRouting.effectivePath` 同口径，但这里只用于**填写时的即时预览** ——
 * 保存后列表显示的是后端算出的 `effectivePath`，不用前端这份。
 */
const pathPreview = computed(() => {
  const custom = model.routePath.trim().replace(/\/+$/, '');
  if (custom) return custom;
  return `/form-model/${props.formKey}/${model.viewKey || '{视图标识}'}`;
});

async function load() {
  loading.value = true;
  try {
    views.value = await getFormListViewsApi(props.formKey);
  } catch (error: any) {
    ElMessage.error(error?.message || '加载列表视图失败');
  } finally {
    loading.value = false;
  }
}

async function loadMenuNodes() {
  try {
    menuNodes.value = await getFormMenuNodesApi();
  } catch {
    // 父节点是可选配置，取不到时留空数组：用户仍能建顶级视图
    menuNodes.value = [];
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(model, {
    viewKey: '',
    viewName: '',
    parentMenuName: '',
    icon: '',
    sort: views.value.length,
    routePath: '',
    readOnly: false,
    // 新建入口默认全选可显示字段：绝大多数入口想看到全部列，
    // 空着会让用户建完入口发现列表只有操作列
    columnKeys: listableFields.value.map((field) => field.fieldKey),
    conditions: [],
  });
  dialogVisible.value = true;
}

function openEdit(view: ListViewItem) {
  editingId.value = view.id;
  Object.assign(model, {
    viewKey: view.viewKey,
    viewName: view.viewName,
    parentMenuName: view.parentMenuName ?? '',
    icon: view.icon ?? '',
    sort: view.sort ?? 0,
    routePath: view.routePath ?? '',
    readOnly: view.readOnly === true,
    // null（未配置）时退回「字段级 showInList 为真的字段」，与运行时同口径 ——
    // 这样打开弹窗看到的勾选状态就是列表当前实际显示的列，而不是一片空白
    columnKeys: view.columns
      ? view.columns.map((column) => column.fieldKey)
      : listableFields.value
          .filter((field) => field.showInList !== false)
          .map((field) => field.fieldKey),
    // 深拷贝：直接引用会让「取消」后表格里的条件也跟着被改掉
    conditions: view.conditions.map((condition) => ({ ...condition })),
  });
  dialogVisible.value = true;
}

function addCondition() {
  model.conditions.push({ fieldKey: '', operator: 'EQ', value: '' });
}

function removeCondition(index: number) {
  model.conditions.splice(index, 1);
}

async function submit() {
  if (!model.viewKey.trim() || !model.viewName.trim()) {
    ElMessage.warning('视图标识与菜单名称都必须填写');
    return;
  }
  const incomplete = model.conditions.some(
    (condition) =>
      !condition.fieldKey ||
      (!VALUELESS_OPERATORS.has(condition.operator) && !condition.value),
  );
  if (incomplete) {
    ElMessage.warning('预置条件的字段与值必须填写完整');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      viewKey: model.viewKey.trim(),
      viewName: model.viewName.trim(),
      // 空串转 null：后端把空父节点当"顶级"，但发空串会多一次无意义的规范化
      parentMenuName: model.parentMenuName || null,
      icon: model.icon.trim() || null,
      sort: model.sort,
      routePath: model.routePath.trim() || null,
      readOnly: model.readOnly,
      // 数组顺序即列序。**始终发数组（哪怕为空）**：省略或发 null 会被后端
      // 解读成「未配置」而退回字段级，用户就永远配不出一个纯操作列的入口。
      columns: model.columnKeys.map((fieldKey, index) => ({
        fieldKey,
        sort: index + 1,
      })),
      // 无值运算符不带 value，避免后端把空串当成"等于空字符串"
      conditions: model.conditions.map((condition) =>
        VALUELESS_OPERATORS.has(condition.operator)
          ? { fieldKey: condition.fieldKey, operator: condition.operator }
          : condition,
      ),
    };
    await (isEditing.value
      ? updateFormListViewApi(props.formKey, editingId.value!, payload)
      : createFormListViewApi(props.formKey, payload));
    ElMessage.success(isEditing.value ? '视图已保存' : '视图已创建');
    dialogVisible.value = false;
    await load();
  } catch (error: any) {
    // 保留弹窗：地址冲突、标识非法都需要用户在原输入上修正
    ElMessage.error(error?.message || '保存视图失败');
  } finally {
    saving.value = false;
  }
}

async function remove(view: ListViewItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除视图「${view.viewName}」？对应的菜单入口会消失，表单数据不受影响。`,
      '删除确认',
    );
  } catch {
    return;
  }
  try {
    await deleteFormListViewApi(props.formKey, view.id);
    ElMessage.success('已删除');
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '删除视图失败');
  }
}

onMounted(() => {
  load();
  loadMenuNodes();
});
</script>

<template>
  <div class="view-panel">
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <strong>列表视图</strong>
        <el-tooltip
          content="菜单入口由列表视图决定。发布本身不直接产出菜单，可为表单创建多个视图（如查询A、查询B），各自配置菜单名称、分组与过滤条件。"
          effect="dark"
          placement="top"
        >
          <span class="help-badge" tabindex="0">
            <el-icon><QuestionFilled /></el-icon>
            <span>Help</span>
          </span>
        </el-tooltip>
      </div>
      <el-button type="primary" @click="openCreate">新增视图</el-button>
    </div>

    <el-table v-loading="loading" :data="views" border>
      <el-table-column label="菜单名称" min-width="150">
        <template #default="{ row }">{{ row.viewName }}</template>
      </el-table-column>
      <el-table-column label="所属菜单" width="130">
        <template #default="{ row }">{{ menuNodeTitle(row.parentMenuName) }}</template>
      </el-table-column>
      <el-table-column label="菜单地址" min-width="220">
        <template #default="{ row }">
          <code class="path">{{ row.effectivePath }}</code>
          <el-tag v-if="!row.routePath" size="small" type="info">默认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="视图标识" width="120">
        <template #default="{ row }"><code>{{ row.viewKey }}</code></template>
      </el-table-column>
      <el-table-column label="显示列" width="110">
        <template #default="{ row }">
          <span v-if="row.columns === null" class="muted">按字段设置</span>
          <span v-else-if="row.columns.length === 0" class="muted">仅操作列</span>
          <span v-else>{{ row.columns.length }} 列</span>
        </template>
      </el-table-column>
      <el-table-column label="预置条件" width="100">
        <template #default="{ row }">{{ row.conditions.length }} 条</template>
      </el-table-column>
      <el-table-column label="权限" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.readOnly" size="small" type="warning">只读</el-tag>
          <el-tag v-else size="small" type="success">可操作</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="70" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <div class="actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <span>还没有任何视图。表单即使已发布，也要至少建一个视图才会出现在菜单里。</span>
      </template>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑列表视图' : '新增列表视图'"
      width="720px"
    >
      <el-form label-position="top">
        <div class="grid">
          <el-form-item label="菜单名称">
            <el-input v-model="model.viewName" placeholder="例如：物料查询" />
          </el-form-item>
          <el-form-item label="视图标识">
            <el-input
              v-model="model.viewKey"
              :disabled="isEditing"
              placeholder="例如：query_a"
            />
            <p class="hint">
              小写字母开头，仅含小写字母/数字/下划线。创建后不可修改：预置条件按它查库。
            </p>
          </el-form-item>
        </div>

        <div class="grid">
          <el-form-item label="所属菜单分组">
            <el-select v-model="model.parentMenuName" clearable style="width: 100%" placeholder="顶级菜单">
              <el-option
                v-for="node in menuNodes"
                :key="node.name"
                :label="node.title"
                :value="node.name"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="model.sort" :min="0" controls-position="right" />
          </el-form-item>
        </div>

        <el-form-item label="自定义菜单地址（可留空）">
          <el-input v-model="model.routePath" placeholder="/info/material-query" />
          <p class="hint">
            小写字母、数字、连字符，最多 4 层，例如 <code>/info/material-query</code>。
            不能以内置模块前缀开头（/system、/production、/form-model 等），也不能与其他视图重复。
            留空则使用默认地址。
          </p>
          <p class="preview">实际地址：<code>{{ pathPreview }}</code></p>
        </el-form-item>

        <el-form-item label="图标（可留空）">
          <el-input v-model="model.icon" placeholder="lucide:file-text" />
        </el-form-item>

        <el-form-item label="列表显示的列">
          <el-select
            v-model="model.columnKeys"
            multiple
            filterable
            style="width: 100%"
            placeholder="不选则该入口只有操作列"
          >
            <el-option
              v-for="field in listableFields"
              :key="field.fieldKey"
              :label="`${field.fieldLabel}（${field.fieldKey}）`"
              :value="field.fieldKey"
            />
          </el-select>
          <p class="hint">
            <strong>选择的顺序就是列的顺序。</strong>想调整列序就先移除再按目标顺序重新选。
            一个都不选表示该入口只显示操作列。<br />
            列显示是<strong>入口级</strong>配置：同一张表单的「查询入口」与「录入入口」
            可以显示不同的列。
          </p>
        </el-form-item>

        <el-form-item label="操作权限">
          <el-checkbox v-model="model.readOnly">
            用户只读（不显示操作列，禁止新增／复制／删除／导入）
          </el-checkbox>
          <p class="hint">
            不勾选即代表可以进行操作（仍需在「访问授权」里持有「可新增」权限）。
            这是<strong>入口级</strong>设置：同一张表单可以建两个入口，一个只读用于查询、
            一个可操作用于录入。<br />
            与访问授权是<strong>交集</strong>关系 ——
            勾上只会收回能力，不会给任何人授权。
          </p>
        </el-form-item>

        <el-form-item label="预置过滤条件">
          <el-table :data="model.conditions" size="small">
            <el-table-column label="字段" min-width="150">
              <template #default="{ row }">
                <el-select v-model="row.fieldKey" filterable style="width: 100%">
                  <el-option
                    v-for="field in conditionFields"
                    :key="field.fieldKey"
                    :label="`${field.fieldLabel}（${field.fieldKey}）`"
                    :value="field.fieldKey"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="运算符" width="130">
              <template #default="{ row }">
                <el-select v-model="row.operator" style="width: 100%">
                  <el-option
                    v-for="operator in OPERATORS"
                    :key="operator.value"
                    :label="operator.label"
                    :value="operator.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="值" min-width="140">
              <template #default="{ row }">
                <el-input
                  v-if="!VALUELESS_OPERATORS.has(row.operator)"
                  v-model="row.value"
                />
                <span v-else class="hint">无需填值</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="65">
              <template #default="{ $index }">
                <el-button link type="danger" @click="removeCondition($index)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" class="add-condition" @click="addCondition">
            新增条件
          </el-button>
          <p class="hint">
            条件只在服务端生效，客户端无法绕过 —— 这是「查询A 只看待处理」能成为一种限定的前提。
          </p>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.view-panel { display: flex; flex-direction: column; gap: 16px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.actions { display: inline-flex; gap: 8px; white-space: nowrap; }
.path { margin-right: 8px; }
code { padding: 1px 5px; font-size: 12px; background: var(--el-fill-color-light); border-radius: 3px; }
.hint { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); }
.muted { color: var(--el-text-color-secondary); }
.preview { margin: 6px 0 0; font-size: 12px; color: var(--el-color-primary); }
.add-condition { margin-top: 8px; }
.help-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; font-size: 11px; font-weight: 600; color: var(--el-color-primary); background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-7); border-radius: 4px; cursor: help; }
.help-badge:hover { background: var(--el-color-primary-light-8); }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
