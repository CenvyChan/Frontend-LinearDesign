<script lang="ts" setup>
import ErpChainWorkbench from './erp-chain-workbench.vue';

/**
 * 销售退货。客户退货入库，实现全在 {@link ErpChainWorkbench}。
 *
 * 链路是 `SAL_RETURNNOTICE` →（可选检验 `QM_InspectBill`）→ `SAL_RETURNSTOCK`。
 * 检验单与采购收料**共用同一个 formId**（K3Cloud 只有一张检验单），靠
 * `businessChainType` 区分两条链路。
 *
 * 退货是**收货方向**（INSTOCK），与销售发货相反 —— 沿用发货的 OUTSTOCK 会让方向
 * 与后续转换规则全错。
 *
 * ⚠️ 组件名必须与路由名 `SalesReturn` 一致（KeepAlive 按路由名 include、按组件名匹配）。
 */
defineOptions({ name: 'SalesReturn' });
</script>

<template>
  <ErpChainWorkbench chain="SALES_RETURN" />
</template>
