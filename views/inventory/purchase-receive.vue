<script lang="ts" setup>
import ErpChainWorkbench from './erp-chain-workbench.vue';

/**
 * 采购收料。实现全在 {@link ErpChainWorkbench}，差异在 `erp-chain-preset.ts`。
 *
 * ⚠️ 组件名必须与路由名 `PurchaseReceive` 一致：KeepAlive 的 include 用**路由名**填充
 * （`tabbar.ts`），而 Vue 的 KeepAlive 匹配**组件名**，不一致会让 keepAlive:true 静默失效。
 */
defineOptions({ name: 'PurchaseReceive' });
</script>

<template>
  <ErpChainWorkbench chain="PURCHASE_RECEIVE" />
</template>
