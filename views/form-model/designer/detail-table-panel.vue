<script setup lang="ts">
import type { FormDetailTableSchema } from '#/api/form-model';

import { computed, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { DEFAULT_MAX_DETAIL_ROWS, maxRowsOf } from '#/api/form-model';

/**
 * 一张明细表在设计器里的形态。
 *
 * `uid` 是仅存在于前端的稳定标识，与字段面板同款模式：`detailKey` 在这个面板里
 * 可编辑，改一个字符就会让「当前选中」失效；`detailTableId` 对新建的表是 0，
 * 也不能当身份用。字段通过 `detailClientKey === uid` 声明归属，
 * 后端落库后再换成真实 id。
 */
export type DesignerDetailTable = FormDetailTableSchema & { uid: string };

const props = defineProps<{
  tables: DesignerDetailTable[];
}>();

/**
 * <b>三个 tab 里唯一需要 emits 的一个。</b>
 *
 * `ViewPanel` 与 `GrantPanel` 都自己发请求、自己保存，因为它们的数据独立于草稿：
 * 视图不碰 `draft_revision`，授权也不碰 `mes_form_field`。明细表恰好相反 ——
 * <b>明细表的 id 是明细字段的必要前置</b>，两者必须在同一个 `saveDraft` 事务里、
 * 过同一道乐观版本闸门。若做成独立端点，会产生「明细表已建但字段还没绑」的中间态，
 * 且 revision 冲突时无法整体回退。所以状态交回父组件，由父组件的 `save()` 一并提交。
 */
const emit = defineEmits<{
  'update:tables': [DesignerDetailTable[]];
}>();

const selectedUid = ref('');

const selected = computed(() =>
  props.tables.find((table) => table.uid === selectedUid.value),
);

/** 已发布的明细表不能删、不能改 key —— 物理表已经存在且带着数据。 */
function isPublished(table: DesignerDetailTable): boolean {
  return table.isPublished === true;
}

function addTable() {
  const next: DesignerDetailTable = {
    uid: `d${Date.now().toString(36)}${props.tables.length}`,
    detailTableId: 0,
    detailKey: `lines_${props.tables.length + 1}`,
    detailName: `明细表 ${props.tables.length + 1}`,
    sort: props.tables.length + 1,
    minRows: 0,
    // 新建时的保守默认，**不是**后端上限：后端 CapabilityGate.MAX_DETAIL_ROWS 是 1000，
    // 见下方 el-input-number 的 :max。明细行与主记录同事务写入，行数决定这个事务持锁多久，
    // 所以默认给一个远低于上限的值，需要更多行时由设计者显式调高。
    maxRows: 100,
    isPublished: false,
  };
  emit('update:tables', [...props.tables, next]);
  selectedUid.value = next.uid;
}

function removeTable(table: DesignerDetailTable) {
  if (isPublished(table)) {
    ElMessage.error(
      `明细表「${table.detailName}」已发布，不能删除：它的物理表和数据会变成孤儿`,
    );
    return;
  }
  const rest = props.tables.filter((item) => item.uid !== table.uid);
  emit('update:tables', rest);
  if (selectedUid.value === table.uid) selectedUid.value = rest[0]?.uid ?? '';
}
</script>

<template>
  <div class="detail-workbench">
    <section class="table-panel">
      <div class="panel-header">
        <strong>明细表</strong>
        <el-button size="small" @click="addTable">新增明细表</el-button>
      </div>
      <el-alert
        v-if="tables.length === 0"
        type="info"
        :closable="false"
        show-icon
        title="没有明细表"
        description="明细表用于「一条主记录下的多行数据」，例如订单的行项目。新增后在「字段设计」里把字段归属到它。"
      />
      <el-table
        v-else
        :data="tables"
        row-key="uid"
        highlight-current-row
        @current-change="
          (row: DesignerDetailTable | undefined) => {
            if (row) selectedUid = row.uid;
          }
        "
      >
        <el-table-column prop="detailKey" label="Key" min-width="130" />
        <el-table-column prop="detailName" label="名称" min-width="130" />
        <el-table-column label="行数" width="100">
          <template #default="{ row }">
            {{ row.minRows ?? 0 }} ~ {{ maxRowsOf(row) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              :disabled="isPublished(row)"
              @click.stop="removeTable(row)"
            >
              删
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="property-panel">
      <div class="panel-header"><strong>明细表属性</strong></div>
      <el-empty v-if="!selected" description="请选择左侧的明细表" />
      <el-form v-else label-width="110px">
        <el-form-item label="Key">
          <el-input
            v-model="selected.detailKey"
            :disabled="isPublished(selected)"
            placeholder="小写字母开头，可含数字下划线"
          />
          <div class="hint">
            <template v-if="isPublished(selected)">
              已发布，不能改：Key 决定物理表名，改名会让旧表连数据一起变成孤儿。
            </template>
            <template v-else>
              物理表名由服务端算出：<code>mes_fm_&lt;表单&gt;_d_{{
                selected.detailKey || '…'
              }}</code>
            </template>
          </div>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="selected.detailName" />
        </el-form-item>
        <el-form-item label="最少行数">
          <el-input-number
            v-model="selected.minRows"
            :min="0"
            :max="DEFAULT_MAX_DETAIL_ROWS"
          />
          <div class="hint">大于 0 即「必须至少填这么多行」。</div>
        </el-form-item>
        <el-form-item label="最多行数">
          <el-input-number
            v-model="selected.maxRows"
            :min="1"
            :max="DEFAULT_MAX_DETAIL_ROWS"
          />
          <div class="hint">
            上限 {{ DEFAULT_MAX_DETAIL_ROWS }} 行，与后端一致：明细行与主记录同事务写入，
            行数决定该事务持锁多久。留空即按上限处理。
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="selected.sort" :min="0" />
        </el-form-item>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.detail-workbench {
  display: grid;
  grid-template-columns: minmax(420px, 1.3fr) minmax(320px, 0.7fr);
  gap: 16px;
  align-items: start;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.hint code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 3px;
}
</style>
