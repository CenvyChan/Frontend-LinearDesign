<script lang="ts" setup>
import { onMounted, ref, reactive, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { getRoleList, createRole, updateRole, deleteRole, getPermissionTree, getRolePermissions, updateRolePermissions, type RoleItem, type QueryParams, type PermissionNode } from '#/api/role';
import type { ElTree } from 'element-plus';
import { useAuthStore } from '#/store/auth';

defineOptions({ name: 'SystemRole' });

const loading = ref(false);
const tableData = ref<RoleItem[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const formRef = ref<FormInstance>();
const isEdit = ref(false);
const currentId = ref<number | null>(null);

// 搜索表单
const searchForm = reactive({
  roleKey: '',
  roleName: '',
  status: undefined as number | undefined,
});

// 表单数据
const formData = reactive({
  role_key: '',
  role_name: '',
  remark: '',
});

const rules: FormRules = {
  role_key: [{ required: true, message: '请输入角色标识', trigger: 'blur' }],
  role_name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
};

// 权限弹窗相关
const permDialogVisible = ref(false);
const permLoading = ref(false);
const permTreeRef = ref<InstanceType<typeof ElTree>>();
const permTreeData = shallowRef<PermissionNode[]>([]);
const permCheckedKeys = ref<number[]>([]);
const expandedKeys = ref<number[]>([]);
const currentRoleName = ref('');
const pendingRoleId = ref<number | null>(null);

// 格式化时间
const formatTime = (time: number | string | null): string => {
  if (!time) return '-';
  const str = time.toString();
  if (str.length === 14) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)} ${str.slice(8, 10)}:${str.slice(10, 12)}:${str.slice(12, 14)}`;
  }
  return String(time);
};

// 获取角色列表
const fetchData = async () => {
  loading.value = true;
  try {
    const params: QueryParams = {
      roleKey: searchForm.roleKey || undefined,
      roleName: searchForm.roleName || undefined,
      status: searchForm.status,
    };
    const res: any = await getRoleList(params);
    if (res.success) {
      tableData.value = res.data || [];
    } else {
      ElMessage.error(res.message || '获取角色列表失败');
    }
  } catch {
    ElMessage.error('获取角色列表失败');
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  fetchData();
};

// 重置搜索
const handleReset = () => {
  searchForm.roleKey = '';
  searchForm.roleName = '';
  searchForm.status = undefined;
  fetchData();
};

// 打开弹窗
const openDialog = (row?: RoleItem) => {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    dialogTitle.value = '编辑角色';
    Object.assign(formData, {
      role_key: row.role_key,
      role_name: row.role_name,
      remark: row.remark || '',
    });
  } else {
    isEdit.value = false;
    currentId.value = null;
    dialogTitle.value = '新建角色';
    formData.role_key = '';
    formData.role_name = '';
    formData.remark = '';
  }
  dialogVisible.value = true;
};

// 保存
const handleSave = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      // 兼容后端字段格式
      const submitData: any = {
        roleKey: formData.role_key,
        roleName: formData.role_name,
        remark: formData.remark,
      };
      if (isEdit.value && currentId.value) {
        await updateRole(currentId.value, submitData);
        ElMessage.success('更新成功');
      } else {
        await createRole(submitData);
        ElMessage.success('创建成功');
      }
      dialogVisible.value = false;
      await fetchData();
    } catch (error: any) {
      ElMessage.error(error?.message || '操作失败');
    }
  });
};

// 删除
const handleDelete = async (id: number, roleName: string) => {
  try {
    await ElMessageBox.confirm(`确定删除角色「${roleName}」？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await deleteRole(id);
    ElMessage.success('删除成功');
    await fetchData();
  } catch {
    // 用户取消
  }
};

// 打开权限弹窗
const openPermDialog = async (row: RoleItem) => {
  currentRoleName.value = row.role_name;
  pendingRoleId.value = row.id;
  permLoading.value = true;
  permTreeData.value = [];
  permCheckedKeys.value = [];

  try {
    // 并行加载权限树和角色已有权限
    const [treeRes, permRes] = await Promise.all([
      getPermissionTree(),
      getRolePermissions(row.id),
    ]);

    // 设置权限树数据
    if (treeRes.success && treeRes.data) {
      permTreeData.value = treeRes.data;
      console.log('[Role] 权限树数据:', treeRes.data);
    } else {
      permTreeData.value = [];
      console.warn('[Role] 权限树返回为空');
    }

    // 回显全部已授权节点，**不再按叶子过滤**。
    // 过滤掉父节点会让 `system:user` 这类"既是菜单权限又是子权限父节点"的项
    // 显示为未勾选，用户看到的是一个与库里不一致的状态，
    // 随后一次保存就把它真的删掉了（saveRolePermissions 是 DELETE 全部再插回勾选的）。
    if (permRes.success && permRes.data && permRes.data.length > 0) {
      const knownIds = new Set(collectAllNodeIds(permTreeData.value));
      // 仍要与树取交集：树只含 status=1 的权限，勾一个树上没有的 id 会被 el-tree 忽略，
      // 但保留在 permCheckedKeys 里会让保存时误以为它还在。
      permCheckedKeys.value = permRes.data.filter((id) => knownIds.has(id));
    } else {
      permCheckedKeys.value = [];
    }

    // 计算展开的节点（用于默认展开）
    const allNodeIds = collectAllNodeIds(permTreeData.value);
    expandedKeys.value = allNodeIds;
  } catch (error) {
    console.error('[Role] 获取角色权限失败:', error);
    permTreeData.value = [];
    permCheckedKeys.value = [];
  } finally {
    permLoading.value = false;
  }
  
  // 打开弹窗，el-tree 的 v-if 会等待 DOM 更新后再渲染
  permDialogVisible.value = true;
};

// 弹窗打开后的回调 - 确保 el-tree 完全渲染后再设置勾选状态
const onPermDialogOpened = () => {
  if (permTreeRef.value && permCheckedKeys.value.length > 0) {
    permTreeRef.value.setCheckedKeys(permCheckedKeys.value, false);
    console.log('[Role] 弹窗打开后手动设置勾选状态');
  }
};

// 收集所有节点ID（包括父节点）
const collectAllNodeIds = (nodes: PermissionNode[]): number[] => {
  const allIds: number[] = [];
  const traverse = (nodeList: PermissionNode[]) => {
    for (const node of nodeList) {
      allIds.push(node.id);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return allIds;
};

// 保存权限
const handleSavePerm = async () => {
  if (!pendingRoleId.value || !permTreeRef.value) return;

  // 勾选的**全部**节点，父节点也算。配合 check-strictly，勾了什么就是什么，
  // 不存在"半选"状态，所以无需也不能再按叶子过滤 ——
  // 那样会永久删掉 `system:user` 这类兼任父节点的菜单权限。
  const validPermissionIds = permTreeRef.value.getCheckedKeys(false) as number[];

  if (validPermissionIds.length === 0) {
    // 允许清空是危险的：saveRolePermissions 会 DELETE 全部再插回空集，
    // 等于一键收回该角色所有权限。要求显式确认。
    try {
      await ElMessageBox.confirm(
        '未勾选任何权限，保存将收回该角色的全部权限。确认继续？',
        '确认清空权限',
        { type: 'warning' },
      );
    } catch {
      return;
    }
  }

  try {
    const res = await updateRolePermissions(pendingRoleId.value, validPermissionIds);
    if (res.success) {
      ElMessage.success('权限保存成功');
      permDialogVisible.value = false;

      // 提示用户权限已更新，建议刷新页面
      ElMessageBox.confirm(
        '权限已更新，是否刷新页面以获取最新菜单和权限？',
        '权限已更新',
        {
          confirmButtonText: '刷新页面',
          cancelButtonText: '暂不刷新',
          type: 'info',
        },
      ).then(async () => {
        // 刷新用户信息和权限
        const authStore = useAuthStore();
        await authStore.fetchUserInfo();
        // 刷新页面
        window.location.reload();
      }).catch(() => {
        // 用户取消，权限将在下次刷新生效
      });
    } else {
      ElMessage.error(res.message || '权限保存失败');
    }
  } catch {
    ElMessage.error('权限保存失败');
  }
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="p-5">
    <!-- 标题栏 -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-lg font-semibold">角色管理</h1>
      <el-button type="primary" @click="openDialog()" :icon="'Plus'">新建角色</el-button>
    </div>

    <!-- 搜索栏 -->
    <el-card shadow="never" class="mb-4">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="角色标识">
          <el-input v-model="searchForm.roleKey" placeholder="请输入角色标识" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="角色名称">
          <el-input v-model="searchForm.roleName" placeholder="请输入角色名称" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :icon="'Search'">查询</el-button>
          <el-button @click="handleReset" :icon="'RefreshRight'">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never">
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%" row-key="id">
        <!-- 角色标识 -->
        <el-table-column prop="role_key" label="角色标识" min-width="140" show-overflow-tooltip />
        <!-- 角色名称 -->
        <el-table-column prop="role_name" label="角色名称" min-width="160" show-overflow-tooltip />
        <!-- 描述/备注 -->
        <el-table-column prop="remark" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <!-- 状态 -->
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <!-- 创建时间 -->
        <el-table-column prop="create_time" label="创建时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <!-- 操作 -->
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" type="primary" round @click="openDialog(row)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" type="warning" round @click="openPermDialog(row)" :icon="'Edit'">权限</el-button>
              <el-button size="small" type="danger" round @click="handleDelete(row.id, row.role_name)" :icon="'Delete'">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
        <el-form-item label="角色标识" prop="role_key">
          <el-input v-model="formData.role_key" :disabled="isEdit" placeholder="请输入角色标识" />
        </el-form-item>
        <el-form-item label="角色名称" prop="role_name">
          <el-input v-model="formData.role_name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="描述" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入角色描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round @click="handleSave" :loading="loading" :icon="'Check'">保存</el-button>
      </template>
    </el-dialog>

    <!-- 权限配置弹窗 -->
    <el-dialog v-model="permDialogVisible" :title="`权限配置 - ${currentRoleName}`" width="500px" @opened="onPermDialogOpened">
      <div v-loading="permLoading" class="perm-content">
        <!--
          check-strictly 是必需的，不是风格选择。
          树是后端按 perm_key 的 `:` 分段拼出来的，**每个节点都是 sys_permission 里
          一条真实且可授予的权限**（`system:user` 自己就是「用户管理」菜单的权限，
          它同时又是 `system:user:create/edit/delete` 的父节点）。
          默认的联动勾选会把父节点当成"仅用于分组的容器"，于是保存时被当作半选丢弃 ——
          这正是 admin 丢掉 `system:user`、用户管理菜单消失的原因。
        -->
        <el-tree
          ref="permTreeRef"
          v-if="permTreeData.length > 0"
          :data="permTreeData"
          show-checkbox
          check-strictly
          node-key="id"
          :props="{ children: 'children', label: 'perm_name' }"
          :default-checked-keys="permCheckedKeys"
          :default-expanded-keys="expandedKeys"
          default-expand-all
          highlight-current
          class="perm-tree"
        />
        <div v-else-if="!permLoading" class="empty-tip">
          暂无权限数据
        </div>
      </div>
      <template #footer>
        <el-button round @click="permDialogVisible = false">取消</el-button>
        <el-button type="primary" round @click="handleSavePerm" :icon="'Edit'">保存权限</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  border: 1px solid #e4e7ed;
}

:deep(.el-table) {
  // 操作按钮容器 - 横向排列
  .action-buttons {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
  }
}

:deep(.el-button.is-round) {
  border-radius: 20px;
}

.perm-tree {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 0;
}

.perm-content {
  min-height: 200px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
}

:deep(.el-tree) {
  background: transparent;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px 0;
}
</style>
