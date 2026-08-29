<script lang="ts" setup>
import type { ErpOperatorMappingItem } from '#/api/erpOperatorMapping';
import type { ErpOrganization } from '#/api/erpData';
import type { MesResponsibility, MesUserResponsibility } from '#/api/mesResponsibility';
import type { UserItem } from '#/api/user';
import type {
  MesResponsibilityTreeAssignment,
  MesResponsibilityTreeNode,
  MesScopeType,
} from '../mes-responsibility-tree-model';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getErpAccounts,
  getOrganizations,
  getWarehousesByOrgId,
  getWorkshopsByOrgNumber,
} from '#/api/erpData';
import { saveMesUserResponsibilities } from '#/api/mesResponsibility';

import { MES_SCOPE_TYPE_OPTIONS } from '../erp-operator-mapping-v2-model';
import {
  buildResponsibilityScopePreview,
  buildScopeCandidateOptions,
  dedupeErpOrganizations,
  extractScopeCandidateItems,
  normalizeErpOrganizations,
  resolveErpOrgId,
} from '../mes-responsibility-workbench-model';
import {
  buildMesResponsibilityTree,
  collectCheckedAssignments,
  scopeNodeKey,
  scopeTypeLabel,
} from '../mes-responsibility-tree-model';

const props = defineProps<{
  assignments: MesUserResponsibility[];
  erpBindings: ErpOperatorMappingItem[];
  responsibilities: MesResponsibility[];
  users: UserItem[];
}>();

const emit = defineEmits<{
  maintainErpBinding: [payload: { node: MesResponsibilityTreeNode; userId: number }];
  saved: [];
}>();

const accounts = ref<string[]>([]);
const organizations = ref<ErpOrganization[]>([]);
const contextLoading = ref(false);
const saving = ref(false);
const selectedUserId = ref<number | undefined>();
const userKeyword = ref('');
const checkedKeys = ref<string[]>([]);
const baselineKeys = ref<string[]>([]);
const draftAssignments = ref<MesResponsibilityTreeAssignment[]>([]);
const activeNode = ref<MesResponsibilityTreeNode | undefined>();
const treeRef = ref<{ setCheckedKeys: (keys: string[]) => void }>();
const showUnassigned = ref(false);

const scopeDialogVisible = ref(false);
const scopeDialogStep = ref(1);
const scopeCandidates = ref<{ label: string; value: string }[]>([]);
const scopeCandidatesLoading = ref(false);
const scopeDraft = reactive({
  erpAcctCode: '',
  erpOrgId: '',
  responsibilityCodes: [] as string[],
  scopeKeys: [] as string[],
  scopeType: 'WAREHOUSE' as MesScopeType,
});

const enabledResponsibilities = computed(() =>
  props.responsibilities.filter((item) => item.status === 1),
);

const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase();
  if (!keyword) return props.users;
  return props.users.filter((user) =>
    [user.username, user.real_name, user.nickname]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
});

const enabledScopeCountByUser = computed(() => {
  const counts = new Map<number, number>();
  for (const assignment of props.assignments) {
    if (assignment.status !== 1) continue;
    counts.set(assignment.userId, (counts.get(assignment.userId) ?? 0) + 1);
  }
  return counts;
});

const userAssignments = computed<MesResponsibilityTreeAssignment[]>(() => {
  if (!selectedUserId.value) return [];
  return props.assignments
    .filter((item) => item.userId === selectedUserId.value)
    .map((item) => ({
      erpAcctCode: item.erpAcctCode,
      erpOrgId: resolveErpOrgId(organizations.value, item.erpOrgId, item.erpAcctCode),
      id: item.id,
      responsibilityCode: item.responsibilityCode,
      scopeKey: item.scopeKey ?? '',
      scopeType: item.scopeType,
      status: item.status,
    }));
});

const tree = computed(() =>
  buildMesResponsibilityTree({
    accounts: accounts.value,
    assignments: [...userAssignments.value, ...draftAssignments.value],
    erpBindings: props.erpBindings
      .filter((item) => item.userId === selectedUserId.value)
      .map((item) => ({
        erpAcctCode: item.erpAcctCode,
        erpOperatorName: item.erpOperatorName,
        erpOperatorNumber: item.erpOperatorNumber,
        erpOrgId: item.erpOrgId,
        responsibilityCode: item.responsibilityCode || item.mappingRole,
      })),
    organizations: organizations.value,
    responsibilities: enabledResponsibilities.value,
    includeUnassigned: showUnassigned.value,
  }),
);

const defaultExpandedKeys = computed(() => tree.value.nodes.map((node) => node.key));

const dirty = computed(() => {
  const current = [...checkedKeys.value].sort();
  const baseline = [...baselineKeys.value].sort();
  return current.length !== baseline.length || current.some((key, index) => key !== baseline[index]);
});

const selectedUser = computed(() => props.users.find((user) => user.id === selectedUserId.value));

const existingScopeKeys = computed(() => new Set(
  [...userAssignments.value, ...draftAssignments.value].map((item) => scopeNodeKey(
    item.erpAcctCode,
    item.erpOrgId,
    item.responsibilityCode,
    item.scopeType,
    item.scopeType === 'ORGANIZATION' ? '' : item.scopeKey || '',
  )),
));

const scopePreview = computed(() => {
  if (!scopeDraft.erpAcctCode || !scopeDraft.erpOrgId) return [];
  return buildResponsibilityScopePreview(scopeDraft, existingScopeKeys.value);
});

const newScopePreview = computed(() => scopePreview.value.filter((item) => !item.exists));

async function loadErpContext() {
  contextLoading.value = true;
  try {
    const accountResponse = await getErpAccounts();
    if (!accountResponse.success) throw new Error(accountResponse.message || '获取 ERP 账套失败');
    accounts.value = [...new Set(
      (accountResponse.data || [])
        .map((item) => String(item.acctCode ?? '').trim())
        .filter(Boolean),
    )];
    const perAccount = await Promise.all(
      accounts.value.map(async (acctCode) => {
        const response: any = await getOrganizations(acctCode);
        if (!response.success) throw new Error(response.message || `鑾峰彇 ${acctCode} ERP 缁勭粐澶辫触`);
        return {
          acctCode,
          organizations: Array.isArray(response.data) ? response.data : [],
          responseAcctCode: response.acctCode,
        };
      }),
    );
    organizations.value = normalizeErpOrganizations(perAccount);
  } catch (error: any) {
    ElMessage.error(error?.message || '获取 ERP 账套与组织失败');
  } finally {
    contextLoading.value = false;
  }
}

function resetCheckedFromTree() {
  baselineKeys.value = [...tree.value.checkedKeys];
  checkedKeys.value = [...tree.value.checkedKeys];
  syncCheckedTree();
}

function syncCheckedTree() {
  void nextTick(() => treeRef.value?.setCheckedKeys(checkedKeys.value));
}

async function selectUser(userId: number) {
  if (userId === selectedUserId.value) return;
  if (dirty.value) {
    try {
      await ElMessageBox.confirm('当前用户的职责范围尚未保存，切换后改动将丢失。', '放弃未保存改动？', {
        confirmButtonText: '放弃改动',
        cancelButtonText: '继续编辑',
        type: 'warning',
      });
    } catch {
      return;
    }
  }
  selectedUserId.value = userId;
  draftAssignments.value = [];
  activeNode.value = undefined;
  resetCheckedFromTree();
}

function handleCheck(_node: MesResponsibilityTreeNode, state: { checkedKeys: (number | string)[] }) {
  checkedKeys.value = state.checkedKeys.map(String).filter((key) => key.startsWith('SCOPE::'));
  syncCheckedTree();
}

function handleNodeClick(node: MesResponsibilityTreeNode) {
  activeNode.value = node.type === 'RESPONSIBILITY' ? node : undefined;
}

async function handleSave() {
  if (!selectedUserId.value) return;
  saving.value = true;
  try {
    const requestedAssignments = collectCheckedAssignments(tree.value.nodes, checkedKeys.value);
    const response: any = await saveMesUserResponsibilities({
      assignments: requestedAssignments,
      userId: selectedUserId.value,
    });
    if (!response?.success) throw new Error(response?.message || '保存职责范围失败');
    const persistedAssignments: MesResponsibilityTreeAssignment[] = Array.isArray(response.data)
      ? response.data.map((item: any) => ({
        erpAcctCode: item.erpAcctCode,
        erpOrgId: item.erpOrgId,
        id: item.id,
        responsibilityCode: item.responsibilityCode,
        scopeKey: item.scopeKey || '',
        scopeType: item.scopeType as MesScopeType,
        status: item.status,
      }))
      : requestedAssignments;
    draftAssignments.value = persistedAssignments;
    checkedKeys.value = persistedAssignments
      .filter((item) => item.status === 1)
      .map((item) => scopeNodeKey(
        item.erpAcctCode,
        item.erpOrgId,
        item.responsibilityCode,
        item.scopeType,
        item.scopeType === 'ORGANIZATION' ? '' : item.scopeKey || '',
      ));
    baselineKeys.value = [...checkedKeys.value];
    syncCheckedTree();
    ElMessage.success('保存成功');
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error?.message || '保存职责范围失败');
  } finally {
    saving.value = false;
  }
}

function openScopeDialog() {
  const firstAccount = accounts.value[0] || '';
  Object.assign(scopeDraft, {
    erpAcctCode: activeNode.value?.erpAcctCode || firstAccount,
    erpOrgId: activeNode.value?.erpOrgId || '',
    responsibilityCodes: activeNode.value?.responsibilityCode ? [activeNode.value.responsibilityCode] : [],
    scopeKeys: [],
    scopeType: 'WAREHOUSE' as MesScopeType,
  });
  scopeDialogStep.value = 1;
  scopeCandidates.value = [];
  scopeDialogVisible.value = true;
}

const scopeOrganizations = computed(() =>
  dedupeErpOrganizations(
    organizations.value.filter((org) => (org.erpAcctCode || '') === scopeDraft.erpAcctCode),
  ),
);

async function loadScopeCandidates() {
  scopeDraft.scopeKeys = [];
  scopeCandidates.value = [];
  if (!scopeDraft.erpOrgId || scopeDraft.scopeType === 'ORGANIZATION' || scopeDraft.scopeType === 'DEPARTMENT') {
    return;
  }
  const canonicalOrgId = resolveErpOrgId(
    organizations.value,
    scopeDraft.erpOrgId,
    scopeDraft.erpAcctCode,
  );
  if (canonicalOrgId) scopeDraft.erpOrgId = canonicalOrgId;
  const organization = organizations.value.find(
    (org) => org.erpAcctCode === scopeDraft.erpAcctCode && org.erpOrgId === scopeDraft.erpOrgId,
  );
  scopeCandidatesLoading.value = true;
  try {
    if (scopeDraft.scopeType === 'WAREHOUSE') {
      const response: any = await getWarehousesByOrgId(scopeDraft.erpOrgId, scopeDraft.erpAcctCode);
      scopeCandidates.value = buildScopeCandidateOptions(extractScopeCandidateItems(response));
      return;
    }
    if (!organization?.erpOrgNumber) {
      ElMessage.warning('该组织缺少 ERP 组织编码，无法加载车间候选');
      return;
    }
    const response: any = await getWorkshopsByOrgNumber(organization.erpOrgNumber, scopeDraft.erpAcctCode);
    scopeCandidates.value = buildScopeCandidateOptions(extractScopeCandidateItems(response));
  } catch (error: any) {
    ElMessage.error(error?.message || '加载责任范围候选失败');
  } finally {
    scopeCandidatesLoading.value = false;
  }
}

function handleScopeAccountChange() {
  scopeDraft.erpOrgId = '';
  scopeDraft.scopeKeys = [];
  scopeCandidates.value = [];
}

async function handleScopeOrganizationChange() {
  await loadScopeCandidates();
}

async function advanceScopeDialog() {
  if (scopeDialogStep.value === 1) {
    if (!scopeDraft.erpAcctCode || !scopeDraft.erpOrgId) {
      ElMessage.warning('请选择账套与组织');
      return;
    }
    scopeDialogStep.value = 2;
    return;
  }
  if (scopeDraft.responsibilityCodes.length === 0) {
    ElMessage.warning('请至少选择一个职责');
    return;
  }
  scopeDialogStep.value = 3;
  await loadScopeCandidates();
}

function confirmScopeDraft() {
  if (!scopeDraft.erpAcctCode || !scopeDraft.erpOrgId) {
    ElMessage.warning('请选择账套与组织');
    return;
  }
  if (scopeDraft.responsibilityCodes.length === 0) {
    ElMessage.warning('请至少选择一个职责');
    return;
  }
  const scopeKeys = scopeDraft.scopeType === 'ORGANIZATION' ? [''] : scopeDraft.scopeKeys;
  if (scopeKeys.length === 0) {
    ElMessage.warning('请至少选择一个范围编码');
    return;
  }
  const additions = newScopePreview.value;
  if (additions.length === 0) {
    ElMessage.warning('所选职责范围已存在，无需重复添加');
    return;
  }
  draftAssignments.value.push(...additions.map((item) => ({
    erpAcctCode: scopeDraft.erpAcctCode,
    erpOrgId: scopeDraft.erpOrgId,
    responsibilityCode: item.responsibilityCode,
    scopeKey: item.scopeKey,
    scopeType: item.scopeType,
    status: 1,
  })));
  const added = additions.map((item) => item.key);
  checkedKeys.value = [...new Set([...checkedKeys.value, ...added])];
  syncCheckedTree();
  scopeDialogVisible.value = false;
}

watch(userAssignments, () => {
  if (draftAssignments.value.length === 0) resetCheckedFromTree();
});

watch(tree, () => {
  syncCheckedTree();
});

watch(checkedKeys, () => {
  syncCheckedTree();
});

watch(() => props.users, (users) => {
  if (!selectedUserId.value && users[0]?.id != null) {
    void selectUser(users[0].id);
  }
}, { immediate: true });

onMounted(async () => {
  await loadErpContext();
  if (props.users[0]?.id != null) {
    if (selectedUserId.value !== props.users[0].id) {
      await selectUser(props.users[0].id);
    } else {
      resetCheckedFromTree();
    }
  } else {
    resetCheckedFromTree();
  }
});
</script>

<template>
  <section class="responsibility-workbench">
    <aside class="user-pane">
      <el-input v-model="userKeyword" clearable placeholder="搜索用户名 / 姓名" size="small" />
      <ul class="user-list">
        <li
          v-for="user in filteredUsers"
          :key="user.id"
          :class="{ active: user.id === selectedUserId }"
          class="user-item"
          @click="selectUser(user.id!)"
        >
          <span class="user-name">{{ user.username }}</span>
          <span class="user-alias">{{ user.real_name || user.nickname || '-' }}</span>
          <span class="user-status">
            <el-tag
              v-if="enabledScopeCountByUser.get(user.id!)"
              disable-transitions
              size="small"
              type="success"
            >
              {{ enabledScopeCountByUser.get(user.id!) }} 条
            </el-tag>
            <el-tag
              v-if="user.id === selectedUserId && dirty"
              disable-transitions
              size="small"
              type="warning"
            >
              未保存
            </el-tag>
          </span>
        </li>
      </ul>
      <p v-if="filteredUsers.length === 0" class="empty-hint">没有匹配的用户</p>
    </aside>

    <div class="tree-pane">
      <header class="tree-header">
        <div class="tree-title">
          <strong>{{ selectedUser ? `${selectedUser.username} / ${selectedUser.real_name || selectedUser.nickname || '-'}` : '请选择左侧用户' }}</strong>
          <el-tag v-if="dirty" disable-transitions size="small" type="warning">未保存</el-tag>
        </div>
        <div class="tree-actions">
          <div class="tree-filter">
            <span>显示未配置项</span>
            <el-switch v-model="showUnassigned" size="small" />
          </div>
          <el-button
            :disabled="!selectedUserId"
            size="small"
            @click="openScopeDialog"
          >添加责任范围</el-button>
          <el-button
            :disabled="!selectedUserId || !dirty"
            :loading="saving"
            size="small"
            type="primary"
            @click="handleSave"
          >保存</el-button>
        </div>
      </header>

      <el-alert
        v-if="activeNode"
        :closable="false"
        class="binding-hint"
        type="info"
      >
        <template #title>
          {{ activeNode.label }} —
          {{ activeNode.erpOperatorNumber ? `已绑定 ERP 人员 ${activeNode.erpOperatorNumber}` : '尚未绑定 ERP 人员' }}
          <el-button link size="small" type="primary" @click="emit('maintainErpBinding', { node: activeNode, userId: selectedUserId! })">维护 ERP 人员</el-button>
        </template>
      </el-alert>

      <el-tree
        v-if="selectedUserId"
        ref="treeRef"
        v-loading="contextLoading"
        :check-strictly="true"
        :data="tree.nodes"
        :default-checked-keys="checkedKeys"
        :default-expanded-keys="defaultExpandedKeys"
        :expand-on-click-node="false"
        :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
        :render-after-expand="true"
        class="scope-tree"
        node-key="key"
        show-checkbox
        @check="handleCheck"
        @node-click="handleNodeClick"
      >
        <template #default="{ data }">
          <span class="tree-node" :class="`is-${data.type.toLowerCase()}`">
            <span class="tree-node-label">{{ data.label }}</span>
            <el-tag
              v-if="data.type === 'SCOPE' && data.scopeType === 'ORGANIZATION'"
              disable-transitions
              size="small"
              type="warning"
            >整组织生效</el-tag>
            <el-tag
              v-else-if="data.type === 'SCOPE' && data.assignmentId && data.status === 0"
              disable-transitions
              size="small"
            >历史停用</el-tag>
            <el-tag
              v-else-if="data.type === 'RESPONSIBILITY'"
              disable-transitions
              size="small"
              type="info"
            >{{ data.scopeCount || 0 }} 范围</el-tag>
            <el-tag
              v-if="data.type === 'RESPONSIBILITY' && data.erpOperatorCount"
              disable-transitions
              size="small"
              type="success"
            >{{ data.erpOperatorCount }} ERP 人员</el-tag>
          </span>
        </template>
      </el-tree>
      <el-empty v-else description="选择左侧用户后，右侧按账套 / 组织 / 职责 / 责任范围维护" />
    </div>

    <el-dialog
      v-model="scopeDialogVisible"
      :close-on-click-modal="false"
      class="scope-dialog"
      title="添加责任范围"
      width="680px"
    >
      <el-steps :active="scopeDialogStep - 1" class="scope-dialog-steps" simple>
        <el-step title="账套与组织" />
        <el-step title="职责" />
        <el-step title="范围与确认" />
      </el-steps>

      <el-form label-width="96px">
        <template v-if="scopeDialogStep === 1">
          <el-form-item label="ERP 账套" required>
            <el-select v-model="scopeDraft.erpAcctCode" filterable style="width: 100%" @change="handleScopeAccountChange">
              <el-option v-for="code in accounts" :key="code" :label="code" :value="code" />
            </el-select>
          </el-form-item>
          <el-form-item label="ERP 组织" required>
            <el-select v-model="scopeDraft.erpOrgId" filterable style="width: 100%" @change="handleScopeOrganizationChange">
              <el-option
                v-for="org in scopeOrganizations"
                :key="org.erpOrgId"
                :label="[org.erpOrgNumber, org.erpOrgName].filter(Boolean).join(' / ') || org.erpOrgId"
                :value="org.erpOrgId"
              />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="scopeDialogStep === 2">
          <el-form-item label="职责" required>
            <el-select v-model="scopeDraft.responsibilityCodes" filterable multiple style="width: 100%">
              <el-option
                v-for="item in enabledResponsibilities"
                :key="item.responsibilityCode"
                :label="`${item.responsibilityCode} / ${item.responsibilityName}`"
                :value="item.responsibilityCode"
              />
            </el-select>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="范围类型">
            <el-select v-model="scopeDraft.scopeType" style="width: 100%" @change="loadScopeCandidates">
              <el-option v-for="item in MES_SCOPE_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="scopeDraft.scopeType === 'DEPARTMENT'" label="部门编码" required>
            <el-select v-model="scopeDraft.scopeKeys" allow-create filterable multiple style="width: 100%" />
          </el-form-item>
          <el-form-item v-else-if="scopeDraft.scopeType !== 'ORGANIZATION'" label="范围编码" required>
            <el-select
              v-model="scopeDraft.scopeKeys"
              :loading="scopeCandidatesLoading"
              filterable
              multiple
              style="width: 100%"
            >
              <el-option v-for="item in scopeCandidates" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <section class="scope-preview" aria-live="polite">
            <header>
              <strong>即将新增 {{ newScopePreview.length }} 条配置</strong>
              <span v-if="scopePreview.length - newScopePreview.length > 0">
                {{ scopePreview.length - newScopePreview.length }} 条已存在
              </span>
            </header>
            <ul v-if="scopePreview.length" class="scope-preview-list">
              <li v-for="item in scopePreview" :key="item.key">
                <span>{{ item.responsibilityCode }} / {{ scopeTypeLabel(item.scopeType) }} / {{ item.scopeKey || '整组织' }}</span>
                <el-tag :type="item.exists ? 'info' : 'success'" disable-transitions size="small">
                  {{ item.exists ? '已存在' : '新增' }}
                </el-tag>
              </li>
            </ul>
          </section>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="scopeDialogVisible = false">取消</el-button>
        <el-button v-if="scopeDialogStep > 1" @click="scopeDialogStep -= 1">上一步</el-button>
        <el-button v-if="scopeDialogStep < 3" type="primary" @click="advanceScopeDialog">下一步</el-button>
        <el-button v-else type="primary" @click="confirmScopeDraft">添加 {{ newScopePreview.length }} 条</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.responsibility-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.user-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 520px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.user-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.user-item:hover {
  background: var(--el-fill-color-light);
}

.user-item.active {
  background: var(--el-color-primary-light-9);
}

.user-name,
.user-alias {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-alias {
  color: var(--el-text-color-secondary);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.tree-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.tree-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.tree-title,
.tree-actions,
.tree-node {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.tree-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node.is-account .tree-node-label {
  font-weight: 600;
}

.tree-node.is-responsibility .tree-node-label {
  color: var(--el-color-primary);
}

.scope-tree {
  max-height: 520px;
  overflow: auto;
}

/* 账套 / 组织 / 职责节点不参与勾选，隐藏其禁用复选框 */
.scope-tree :deep(.el-checkbox.is-disabled) {
  display: none;
}

.binding-hint :deep(.el-alert__title) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.responsibility-workbench {
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 560px;
  gap: 0;
  background: var(--el-bg-color);
}

.user-pane {
  gap: 10px;
  padding: 12px;
  border: 0;
  border-right: 1px solid var(--el-border-color-lighter);
  border-radius: 0;
  background: var(--el-fill-color-extra-light);
}

.user-list {
  gap: 3px;
  max-height: 548px;
}

.user-item {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  min-height: 44px;
  padding: 7px 8px;
  border-left: 2px solid transparent;
}

.user-item.active {
  border-left-color: var(--el-color-primary);
}

.user-name {
  font-weight: 600;
}

.user-status {
  display: inline-flex;
  grid-row: span 2;
  grid-column: 2;
  gap: 4px;
  align-items: center;
}

.tree-pane {
  gap: 12px;
  padding: 14px 16px;
  border: 0;
  border-radius: 0;
}

.tree-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tree-filter {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tree-node.is-responsibility .tree-node-label {
  font-weight: 600;
}

.scope-tree {
  flex: 1 1 auto;
  min-height: 420px;
  max-height: 560px;
  padding: 4px 0;
}

.scope-dialog-steps {
  margin: 0 0 20px;
}

.scope-preview {
  margin: 4px 0 0 96px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.scope-preview header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.scope-preview header strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.scope-preview-list {
  display: grid;
  gap: 4px;
  max-height: 164px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.scope-preview-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.scope-preview-list li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.responsibility-workbench {
  --workbench-bg: hsl(var(--background, 0 0% 100%));
  --workbench-surface: hsl(var(--card, 0 0% 100%));
  --workbench-muted: hsl(var(--accent, 240 5% 96%));
  --workbench-muted-hover: hsl(var(--accent-hover, 200deg 10% 90%));
  --workbench-border: hsl(var(--border, 240 5.9% 90%));
  --workbench-text: hsl(var(--foreground, 210 6% 21%));
  background: var(--workbench-surface);
  color: var(--workbench-text);
}

.user-pane {
  background: var(--workbench-bg);
  border-right-color: var(--workbench-border);
}

.user-item:hover {
  background: var(--workbench-muted-hover);
}

.user-item.active {
  background: var(--workbench-muted);
  color: var(--workbench-text);
}

.user-pane :deep(.el-input__wrapper) {
  background: var(--workbench-surface);
  box-shadow: 0 0 0 1px var(--workbench-border) inset;
}

.tree-pane {
  background: var(--workbench-surface);
  color: var(--workbench-text);
}

.scope-tree :deep(.el-tree-node__content) {
  color: var(--workbench-text);
}

.scope-tree :deep(.el-tree-node__content:hover),
.scope-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--workbench-muted-hover);
}

.scope-preview-list li {
  background: var(--workbench-muted);
  color: var(--workbench-text);
}

:global(.dark) .scope-dialog {
  --el-dialog-bg-color: hsl(var(--card));
  --el-bg-color: hsl(var(--card));
  --el-fill-color-light: hsl(var(--accent));
  --el-fill-color-lighter: hsl(var(--accent-lighter));
  --el-text-color-primary: hsl(var(--foreground));
  --el-text-color-regular: hsl(var(--foreground));
  --el-border-color-light: hsl(var(--border));
}

@media (max-width: 1024px) {
  .responsibility-workbench {
    grid-template-columns: minmax(0, 1fr);
  }

  .user-list {
    max-height: 220px;
  }

  .user-pane {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .scope-preview {
    margin-left: 0;
  }
}
</style>
