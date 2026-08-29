<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

import { DEFAULT_HOME_FULL_PATH } from '#/shared/home';

defineOptions({ name: 'Fallback403Demo' });

// 同 not-found.vue：默认的 '/' 依赖 redirect 链，显式给出最终地址更稳
</script>

<template>
  <Fallback :home-path="DEFAULT_HOME_FULL_PATH" status="403" />
</template>
