<script lang="ts" setup>
import { onMounted, ref } from 'vue';

console.log('[TEST TABLE] 组件加载');

const data = ref([
  { id: 1, name: 'Test 1', value: 100 },
  { id: 2, name: 'Test 2', value: 200 },
]);

onMounted(() => {
  console.log('[TEST TABLE] onMounted 触发');
});
</script>

<template>
  <div style="padding: 20px;">
    <h1>测试表格</h1>
    <el-table :data="data" border>
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="value" label="数值" />
    </el-table>
  </div>
</template>
