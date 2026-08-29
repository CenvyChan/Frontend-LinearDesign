<script lang="ts" setup>
import ErpChainWorkbench from './erp-chain-workbench.vue';

/**
 * 销售发货。实现全在 {@link ErpChainWorkbench}，差异在 `erp-chain-preset.ts`。
 *
 * <h2>2026-08-27 改为复用通用页时去掉的「新建发货」</h2>
 *
 * 原先这里有个手工造单入口，调 `syncWmsErpDocument` 写死 `SAL_DELIVERYNOTICE`。
 * 该能力在「库存管理 → ERP单据中心」已有（同一个端点，且能选单据类型），
 * 保留两份意味着同一功能两处维护。手工造一张 ERP 里不存在的通知单还会让后续下推、
 * 回写全部失败，所以它本就更适合放在"单据中心"这种明确的运维入口，
 * 而不是日常作业页。
 *
 * ⚠️ 组件名必须与路由名 `SalesDelivery` 一致：KeepAlive 的 include 用**路由名**填充
 * （`tabbar.ts`），而 Vue 的 KeepAlive 匹配**组件名**，不一致会让 keepAlive:true 静默失效。
 */
defineOptions({ name: 'SalesDelivery' });
</script>

<template>
  <ErpChainWorkbench chain="SALES_DELIVERY" />
</template>
