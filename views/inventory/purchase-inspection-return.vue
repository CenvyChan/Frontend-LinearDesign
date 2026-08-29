<script lang="ts" setup>
import ErpChainWorkbench from './erp-chain-workbench.vue';

/**
 * 检验退料。来料检验判退的物料退回供应商，实现全在 {@link ErpChainWorkbench}。
 *
 * 与「库存退料」的区别：这里的货**从未实际入库**（判退发生在收料检验环节），
 * 所以不需要批次与库位；库存退料的货已入库，需要完整库存维度。
 * 两者的 ERP 目标单都是 `PUR_MRB`，靠 `businessChainType` 区分。
 *
 * ⚠️ 组件名必须与路由名 `PurchaseInspectionReturn` 一致：KeepAlive 的 include 用**路由名**
 * 填充（`tabbar.ts`），而 Vue 的 KeepAlive 匹配**组件名**，不一致会让 keepAlive:true 静默失效。
 */
defineOptions({ name: 'PurchaseInspectionReturn' });
</script>

<template>
  <ErpChainWorkbench chain="PURCHASE_INSPECTION_RETURN" />
</template>
