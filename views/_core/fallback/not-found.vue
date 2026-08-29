<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

import { DEFAULT_HOME_FULL_PATH } from '#/shared/home';

defineOptions({ name: 'Fallback404Demo' });

/**
 * 必须显式传 home-path。
 *
 * `Fallback` 的默认值是 `'/'`，而 `/` 只是一条 redirect —— 一旦首屏地址配错，
 * 「返回首页」就会被重定向回那个错地址，再次落到 404，形成用户看到的死循环。
 * 直接给出最终地址，让这个按钮不依赖 redirect 链是否正确。
 */
</script>

<template>
  <Fallback :home-path="DEFAULT_HOME_FULL_PATH" status="404" />
</template>
