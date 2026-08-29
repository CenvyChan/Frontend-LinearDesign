<script setup lang="ts">
import type { DictionaryTypeSummary } from '#/api/dictionary';

import type { DictionaryEditorRow } from './dictionary-payload';

import { onMounted, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  deleteDictionaryApi,
  getDictionaryApi,
  getDictionaryTypesApi,
  saveDictionaryTypeApi,
  setDictionaryArchivedApi,
} from '#/api/dictionary';

import { toDictionaryTypePayload } from './dictionary-payload';

defineOptions({ name: 'SystemDictionary' });

type EditorRow = DictionaryEditorRow;

let uidSeq = 0;
function nextUid(): number {
  uidSeq += 1;
  return uidSeq;
}

const loading = ref(false);
const saving = ref(false);
const types = ref<DictionaryTypeSummary[]>([]);
const drawerVisible = ref(false);
const editingType = ref('');
/** 新建类型时类型名可改；编辑既有类型时锁定（改名等于换一个类型） */
const isNewType = ref(false);
const rows = ref<EditorRow[]>([]);

async function load() {
  loading.value = true;
  try {
    types.value = await getDictionaryTypesApi();
  } catch (error: any) {
    ElMessage.error(error?.message || '加载字典类型失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  isNewType.value = true;
  editingType.value = '';
  // 直接给一行空行：新建类型时最常见的动作就是立刻录第一个编码
  rows.value = [blankRow(1)];
  drawerVisible.value = true;
}

async function openEdit(summary: DictionaryTypeSummary) {
  isNewType.value = false;
  editingType.value = summary.type;
  drawerVisible.value = true;
  try {
    // 这里用 getDictionaryApi（含封存项）：管理员必须看到封存项才能取消封存
    const entries = await getDictionaryApi(summary.type);
    rows.value = entries.map((entry) => ({ ...entry, uid: nextUid() }));
  } catch (error: any) {
    ElMessage.error(error?.message || '加载字典失败');
    rows.value = [];
  }
}

function blankRow(sort: number): EditorRow {
  return {
    uid: nextUid(),
    type: editingType.value,
    code: '',
    label: '',
    sort,
    isDefault: false,
    isArchived: false,
    remark: '',
  };
}

function addRow() {
  rows.value.push(blankRow(rows.value.length + 1));
}

function removeRow(row: EditorRow) {
  // 已落库的行不能在这里丢掉：保存接口刻意不删除缺失编码，
  // 直接移除只会让它在界面上消失而库里仍在。要停用就用封存。
  if (row.id) {
    ElMessage.warning('已保存的编码请使用「封存」，不要直接移除');
    return;
  }
  rows.value = rows.value.filter((item) => item.uid !== row.uid);
}

async function toggleArchived(row: EditorRow) {
  if (!row.id) {
    row.isArchived = !row.isArchived;
    return;
  }
  try {
    const next = !row.isArchived;
    await setDictionaryArchivedApi(row.id, next);
    row.isArchived = next;
    ElMessage.success(next ? '已封存' : '已取消封存');
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  }
}

async function save() {
  const type = editingType.value.trim();
  if (!type) {
    ElMessage.error('字典类型不能为空');
    return;
  }
  const payload = toDictionaryTypePayload(rows.value, type);
  if (payload.length === 0) {
    ElMessage.error('至少需要一个编码');
    return;
  }
  const incomplete = payload.find((row) => !row.code || !row.label);
  if (incomplete) {
    ElMessage.error('编码与标签都不能为空');
    return;
  }

  saving.value = true;
  try {
    await saveDictionaryTypeApi(type, payload);
    ElMessage.success('已保存');
    drawerVisible.value = false;
    await load();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存字典类型失败');
  } finally {
    saving.value = false;
  }
}

async function removeType(summary: DictionaryTypeSummary) {
  if (summary.referencedByForms.length > 0) {
    ElMessage.warning(
      `「${summary.type}」正被以下表单引用，请改用封存：${summary.referencedByForms.join('、')}`,
    );
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认删除类型「${summary.type}」下的全部 ${summary.codeCount} 个编码？`,
      '删除确认',
    );
    const entries = await getDictionaryApi(summary.type);
    // 逐条删除：后端的删除保护是按条目做的，这里保持同一条路径
    for (const entry of entries) {
      if (entry.id) await deleteDictionaryApi(entry.id);
    }
    ElMessage.success('已删除');
    await load();
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '删除字典失败');
    }
  }
}

onMounted(load);
</script>

<template>
  <div class="dictionary-page">
    <div class="toolbar">
      <span class="toolbar__hint">
        按字典类型维护。封存的编码不会出现在新增下拉里，但历史数据仍能显示其名称。
      </span>
      <div class="actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建类型</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="types" border>
      <el-table-column prop="type" label="字典类型" min-width="180" />
      <el-table-column prop="codeCount" label="编码数" width="100" />
      <el-table-column label="封存" width="100">
        <template #default="{ row }">
          <span v-if="row.archivedCount > 0">{{ row.archivedCount }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="被引用的表单" min-width="260">
        <template #default="{ row }">
          <template v-if="row.referencedByForms.length > 0">
            <el-tag
              v-for="name in row.referencedByForms"
              :key="name"
              class="form-tag"
              size="small"
              type="info"
            >
              {{ name }}
            </el-tag>
          </template>
          <span v-else class="muted">未被引用</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <div class="actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeType(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <span class="muted">还没有任何字典类型</span>
      </template>
    </el-table>

    <el-drawer
      v-model="drawerVisible"
      :title="isNewType ? '新建字典类型' : `编辑字典类型：${editingType}`"
      size="720px"
    >
      <el-form label-position="top">
        <el-form-item label="字典类型" required>
          <el-input
            v-model="editingType"
            :disabled="!isNewType"
            placeholder="例如 priority"
          />
          <p v-if="!isNewType" class="muted">
            类型名不可修改：改名等于新建一个类型，已有数据不会随之迁移。
          </p>
        </el-form-item>
      </el-form>

      <div class="editor-toolbar">
        <span>共 {{ rows.length }} 个编码</span>
        <el-button size="small" @click="addRow">添加一行</el-button>
      </div>

      <el-table :data="rows" border size="small">
        <el-table-column label="编码" width="160">
          <template #default="{ row }">
            <el-input v-model="row.code" :disabled="!!row.id" placeholder="HIGH" />
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.label" placeholder="高" />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="110">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="0" controls-position="right" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.isArchived" size="small" type="warning">已封存</el-tag>
            <el-tag v-else size="small" type="success">启用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <div class="actions">
              <el-button link type="primary" @click="toggleArchived(row)">
                {{ row.isArchived ? '取消封存' : '封存' }}
              </el-button>
              <el-button v-if="!row.id" link type="danger" @click="removeRow(row)">
                移除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button :loading="saving" type="primary" @click="save">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.dictionary-page { padding: 24px; }
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.toolbar__hint { font-size: 13px; color: var(--el-text-color-secondary); }
.actions { display: inline-flex; gap: 8px; white-space: nowrap; align-items: center; }
.editor-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}
.form-tag { margin-right: 4px; }
.muted { font-size: 13px; color: var(--el-text-color-secondary); }
</style>
