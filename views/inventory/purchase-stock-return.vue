<script lang="ts" setup>
import ErpChainWorkbench from './erp-chain-workbench.vue';

/**
 * 库存退料。已入库物料退回供应商，实现全在 {@link ErpChainWorkbench}。
 *
 * 与「检验退料」的区别：货**已实际入库**（源单是采购入库单 `STK_InStock`），
 * 所以下推时需要完整库存维度（仓库/库位/批次/货主/保管者）；
 * 检验退料的货从未入库，不要求批次与库位。两者的 ERP 目标单都是 `PUR_MRB`。
 *
 * ⚠️ 组件名必须与路由名 `PurchaseStockReturn` 一致（KeepAlive 按路由名 include、按组件名匹配）。
 */
defineOptions({ name: 'PurchaseStockReturn' });
</script>

<template>
  <ErpChainWorkbench chain="PURCHASE_STOCK_RETURN" />
</template>
