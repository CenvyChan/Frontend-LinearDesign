<script setup lang="ts">
import type {
  FormGrantItem,
  GrantType,
  ListViewItem,
  PrincipalType,
} from '#/api/formModelDesigner';
import type { RoleItem } from '#/api/role';
import type { UserItem } from '#/api/user';

import { computed, onMounted, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  ALL_VIEWS,
  getFormGrantsApi,
  getFormListViewsApi,
  grantFormAccessApi,
  revokeFormAccessApi,
} from '#/api/formModelDesigner';
import { getRoleList } from '#/api/role';
import { getUserList } from '#/api/user';

import { groupGrants } from './grant-grouping';

defineOptions({ name: 'FormModelGrantPanel' });

/**
 * formKey 用于拉取菜单入口列表 —— 授权要以已有的菜单入口为源头，
 * 所以这个面板必须知道这张表单有哪些入口。
 */
const props = defineProps<{ formId: number; formKey: string }>();

const loading = ref(false);
const saving = ref(false);
const grants = ref<FormGrantItem[]>([]);
const roles = ref<RoleItem[]>([]);
const users = ref<UserItem[]>([]);
/**
 * 无 `form-model:grant` 权限时后端返回 403。
 *
 * 这种情况要静态提示而不是弹错误 toast：设计者可能只有 design 权限，
 * 打开 tab 就报错会让人以为功能坏了。
 */
const forbidden = ref(false);

/** 这张表单的菜单入口，授权的作用范围从这里选 */
const views = ref<ListViewItem[]>([]);

const model = ref<{
  grantType: GrantType;
  principalIds: number[];
  principalType: PrincipalType;
  viewId: number;
}>({
  grantType: 'VIEW',
  principalIds: [],
  principalType: 'ROLE',
  // 默认「全部入口」：这是迁移前唯一存在的形态，也是最不容易让人意外的默认值
  viewId: ALL_VIEWS,
});

/** 入口名（含「全部入口」哨兵）。入口被删掉后旧授权仍会显示其 id。 */
const viewLabel = computed(() => {
  const names = new Map(views.value.map((view) => [view.id, view.viewName]));
  return (viewId: number) =>
    viewId === ALL_VIEWS ? '全部入口' : (names.get(viewId) ?? `入口 #${viewId}`);
});

const principalOptions = computed(() =>
  model.value.principalType === 'ROLE'
    ? roles.value.map((role) => ({
        id: role.id,
        label: `${role.role_name}（${role.role_key}）`,
      }))
    : users.value.map((user) => ({
        id: user.id,
        label: user.real_name
          ? `${user.real_name}（${user.username}）`
          : user.username,
      })),
);

/** principalId → 显示名。授权列表只有 ID，显示名要在前端拼 */
const principalLabel = computed(() => {
  const roleNames = new Map(roles.value.map((r) => [r.id, `${r.role_name}（${r.role_key}）`]));
  const userNames = new Map(
    users.value.map((u) => [u.id, u.real_name ? `${u.real_name}（${u.username}）` : u.username]),
  );
  return (type: PrincipalType, id: number) =>
    (type === 'ROLE' ? roleNames.get(id) : userNames.get(id)) ?? `ID ${id}`;
});

/**
 * 按「授权对象 × 菜单入口」分组，把 VIEW/CREATE 合并成一行。
 * 分组逻辑抽到 `grant-grouping.ts` 以便被 spec 直接钉住（分组键含 viewId 是易错点）。
 */
const groupedGrants = computed(() => groupGrants(grants.value));

function formatTime(value: null | number): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

async function loadGrants() {
  loading.value = true;
  try {
    grants.value = await getFormGrantsApi(props.formId);
    forbidden.value = false;
  } catch (error: any) {
    const message = error?.message || '';
    // 403 只标记状态，不弹 toast
    if (message.includes('No permission') || message.includes('FORBIDDEN')) {
      forbidden.value = true;
      grants.value = [];
    } else {
      ElMessage.error(message || '加载授权列表失败');
    }
  } finally {
    loading.value = false;
  }
}

async function loadViews() {
  // 入口列表取不到时退化为只能授「全部入口」：那仍是可用的（且是旧行为），
  // 比整个面板报错更好。
  try {
    views.value = await getFormListViewsApi(props.formKey);
  } catch {
    views.value = [];
  }
}

async function loadPrincipals() {
  // 角色与用户列表是渲染选择器和显示名的基础，两者独立失败互不影响
  try {
    const response = await getRoleList();
    roles.value = response?.data ?? [];
  } catch {
    roles.value = [];
  }
  try {
    const response = await getUserList({ pageNum: 1, pageSize: 500 });
    users.value = response?.data?.list ?? [];
  } catch {
    users.value = [];
  }
}

async function submitGrant() {
  if (model.value.principalIds.length === 0) {
    ElMessage.warning('请至少选择一个授权对象');
    return;
  }
  saving.value = true;
  try {
    // 后端幂等，重复授是空操作，所以整批直接发，不必先与现有授权比对。
    // 逐条统计失败原因：一条失败不该让用户以为整批都没生效。
    const results = await Promise.allSettled(
      model.value.principalIds.map((principalId) =>
        grantFormAccessApi(props.formId, {
          viewId: model.value.viewId,
          grantType: model.value.grantType,
          principalType: model.value.principalType,
          principalId,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      ElMessage.success(`已授权 ${results.length} 个对象`);
    } else {
      const reason =
        failed[0]?.status === 'rejected' ? failed[0].reason?.message : '';
      ElMessage.error(
        `${results.length - failed.length} 个成功，${failed.length} 个失败${reason ? `：${reason}` : ''}`,
      );
    }
    model.value.principalIds = [];
    await loadGrants();
  } finally {
    saving.value = false;
  }
}

async function revoke(
  viewId: number,
  principalType: PrincipalType,
  principalId: number,
  grantType: GrantType,
) {
  const name = principalLabel.value(principalType, principalId);
  const label = grantType === 'CREATE' ? '新增权限' : '全部权限';
  const scope = viewLabel.value(viewId);
  try {
    await ElMessageBox.confirm(
      `确认撤销「${name}」在「${scope}」上的${label}？`,
      '撤销确认',
    );
  } catch {
    return;
  }
  try {
    // 撤"全部"必须先 CREATE 再 VIEW：后端不变式禁止在 CREATE 存在时撤 VIEW。
    // 查找必须带上 viewId —— 按 principal 找会命中另一个入口的那一行，
    // 于是撤错入口的 CREATE 而真正要撤的那条仍被不变式挡住。
    if (grantType === 'VIEW') {
      const group = groupedGrants.value.find(
        (item) =>
          item.viewId === viewId &&
          item.principalType === principalType &&
          item.principalId === principalId,
      );
      if (group?.canCreate) {
        await revokeFormAccessApi(props.formId, {
          viewId,
          grantType: 'CREATE',
          principalType,
          principalId,
        });
      }
    }
    await revokeFormAccessApi(props.formId, {
      viewId,
      grantType,
      principalType,
      principalId,
    });
    ElMessage.success('已撤销');
    await loadGrants();
  } catch (error: any) {
    ElMessage.error(error?.message || '撤销授权失败');
  }
}

onMounted(() => {
  loadGrants();
  loadPrincipals();
  loadViews();
});
</script>

<template>
  <div class="grant-panel">
    <el-alert
      v-if="forbidden"
      type="warning"
      :closable="false"
      title="没有授权管理权限"
      description="需要 form-model:grant 权限才能查看和修改本表单的访问授权，请联系管理员。"
      show-icon
    />
    <template v-else>
      <div class="panel-header-with-help">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm">表单访问授权配置</span>
          <el-tooltip
            content="授权 = 菜单入口 + 授权对象 + 权限。菜单入口出现在对方菜单需同时满足：表单已发布、对方已绑定表单归属账套、且持有该入口只读权限。"
            effect="dark"
            placement="top"
          >
            <span class="help-badge" tabindex="0">
              <el-icon><QuestionFilled /></el-icon>
              <span>Help</span>
            </span>
          </el-tooltip>
        </div>
      </div>

      <section class="grant-form">
        <div class="row">
          <div class="field">
            <label>菜单入口</label>
            <el-select v-model="model.viewId" style="width: 100%">
              <el-option :value="ALL_VIEWS" label="全部入口（整张表单）" />
              <el-option
                v-for="view in views"
                :key="view.id"
                :label="view.viewName"
                :value="view.id"
              />
            </el-select>
          </div>
          <div class="field">
            <label>授权对象类型</label>
            <el-select
              v-model="model.principalType"
              style="width: 100%"
              @change="model.principalIds = []"
            >
              <el-option label="角色（批量推荐）" value="ROLE" />
              <el-option label="用户" value="USER" />
            </el-select>
          </div>
          <div class="field grow">
            <label>{{ model.principalType === 'ROLE' ? '角色' : '用户' }}（可多选）</label>
            <el-select
              v-model="model.principalIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              style="width: 100%"
              :placeholder="`选择要授权的${model.principalType === 'ROLE' ? '角色' : '用户'}`"
            >
              <el-option
                v-for="item in principalOptions"
                :key="item.id"
                :label="item.label"
                :value="item.id"
              />
            </el-select>
          </div>
          <div class="field">
            <label>权限</label>
            <el-select v-model="model.grantType" style="width: 100%">
              <el-option label="只读（VIEW）" value="VIEW" />
              <el-option label="可新增（CREATE，含只读）" value="CREATE" />
            </el-select>
          </div>
          <el-button type="primary" :loading="saving" @click="submitGrant">批量授权</el-button>
        </div>
        <p class="hint">
          授「可新增」会自动带上「只读」——菜单可见性只看只读权限。重复授权是空操作，可安全重复提交。
        </p>
        <p class="hint">
          <strong>授权按菜单入口生效。</strong>选某个入口时，对方只会看到那一个入口；
          选「全部入口」则该表单的所有入口都放出去。两者是<strong>并集</strong>关系，
          不会互相抵消。想让某个入口对所有人都只读，请到「菜单入口」tab 勾选该入口的
          「用户只读」——授权只管加法，减法交给那个勾选。
        </p>
      </section>

      <el-table v-loading="loading" :data="groupedGrants" border>
        <el-table-column label="菜单入口" min-width="140">
          <template #default="{ row }">
            <el-tag v-if="row.viewId === ALL_VIEWS" size="small" type="warning">
              全部入口
            </el-tag>
            <span v-else>{{ viewLabel(row.viewId) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.principalType === 'ROLE' ? 'primary' : 'success'">
              {{ row.principalType === 'ROLE' ? '角色' : '用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="授权对象" min-width="200">
          <template #default="{ row }">
            {{ principalLabel(row.principalType, row.principalId) }}
          </template>
        </el-table-column>
        <el-table-column label="权限" width="150">
          <template #default="{ row }">
            {{ row.canCreate ? '只读 + 可新增' : '只读' }}
          </template>
        </el-table-column>
        <el-table-column label="授权时间" width="180">
          <template #default="{ row }">{{ formatTime(row.grantedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button
                v-if="row.canCreate"
                link
                type="warning"
                @click="revoke(row.viewId, row.principalType, row.principalId, 'CREATE')"
              >
                收回新增
              </el-button>
              <el-button
                link
                type="danger"
                @click="revoke(row.viewId, row.principalType, row.principalId, 'VIEW')"
              >
                全部撤销
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <span>还没有任何授权。发布后表单只对已授权的用户/角色可见。</span>
        </template>
      </el-table>
    </template>
  </div>
</template>

<style scoped>
.grant-panel { display: flex; flex-direction: column; gap: 16px; }
.grant-form { padding: 16px; background: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); }
.row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
.field.grow { flex: 1; min-width: 260px; }
label { font-size: 13px; color: var(--el-text-color-regular); }
.hint { margin: 10px 0 0; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.actions { display: inline-flex; gap: 8px; white-space: nowrap; }
.panel-header-with-help { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
.help-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; font-size: 11px; font-weight: 600; color: var(--el-color-primary); background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-7); border-radius: 4px; cursor: help; }
.help-badge:hover { background: var(--el-color-primary-light-8); }
</style>
