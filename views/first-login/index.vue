<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { requestClient } from '#/api/request';
import { useAuthStore } from '#/store';

import {
  changeFirstLoginPasswordAndRequireLogin,
  toFirstLoginPasswordChangeErrorMessage,
} from './first-login-model';

defineOptions({ name: 'FirstLogin' });

const authStore = useAuthStore();
const loading = ref(false);
const formRef = ref<FormInstance>();

const formData = reactive({
  newPassword: '',
  confirmPassword: '',
});

const rules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度6-32位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== formData.newPassword) {
          callback(new Error('两次输入的密码不一致'));
        } else { callback(); }
      },
      trigger: 'blur',
    },
  ],
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await changeFirstLoginPasswordAndRequireLogin(formData.newPassword, {
        logout: (redirect) => authStore.logout(redirect),
        put: (url, data) => requestClient.put(url, data),
        success: (message) => ElMessage.success(message),
      });
    } catch (error) {
      ElMessage.error(toFirstLoginPasswordChangeErrorMessage(error));
    } finally {
      loading.value = false;
    }
  });
};
</script>

<template>
  <div class="p-5 max-w-md mx-auto mt-12">
    <el-card shadow="never">
      <template #header>
        <h1 class="text-lg font-semibold text-center">首次登录 - 修改密码</h1>
      </template>
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="formData.newPassword" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="formData.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading" class="w-full">确认修改</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.max-w-md { max-width: 480px; }
:deep(.el-card) { border: 1px solid #e4e7ed; }
</style>
