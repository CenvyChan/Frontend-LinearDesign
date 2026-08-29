import { requestClient } from '#/api/request';

export type WmsReconcileStatus =
  | 'ERP_ONLY'
  | 'MATCHED'
  | 'QTY_DIFF'
  | 'RECENT_MOVEMENT_RISK'
  | 'UNALLOCATED_ONLY'
  | 'WMS_ONLY';

export interface WmsReconcileQuery {
  erpAcctCode?: string;
  erpOrgId?: string;
  erpOrgNumber?: string;
  forceRefreshErp?: boolean;
  keeperNumber?: string;
  lotNo?: string;
  materialCode?: string;
  materialNumber?: string;
  ownerNumber?: string;
  showAll?: boolean;
  stockNumber?: string;
  stockStatusNumber?: string;
}

export interface WmsReconcileLine {
  diffQty?: number;
  erpOrgName?: string;
  erpOrgNumber?: string;
  erpQty?: number;
  id: number;
  keeperName?: string;
  keeperNumber?: string;
  locationCount?: number;
  lotNo?: string;
  mainLocationCode?: string;
  mainLocationName?: string;
  materialCode?: string;
  materialName?: string;
  materialSpecification?: string;
  ownerName?: string;
  ownerNumber?: string;
  recentBusinessSource?: string;
  recentTransactionTime?: number;
  reconcileStatus: WmsReconcileStatus;
  runId?: number;
  stockName?: string;
  stockNumber?: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  suggestion?: string;
  unitName?: string;
  wmsAllocatedQty?: number;
  wmsLockedQty?: number;
  wmsQty?: number;
  wmsUnallocatedQty?: number;
}

export interface WmsReconcileRun {
  diffLines?: number;
  erpOnlyLines?: number;
  finishedTime?: number;
  forceRefreshErp?: boolean;
  id: number;
  lines: WmsReconcileLine[];
  matchedLines?: number;
  message?: string;
  recentMovementRiskLines?: number;
  runStatus?: string;
  startedTime?: number;
  totalLines?: number;
  unallocatedOnlyLines?: number;
  wmsOnlyLines?: number;
}

export interface WmsInventoryBalance {
  barcode?: string;
  containerCode?: string;
  expiryDate?: string;
  id?: number;
  lastTransactionTime?: number;
  locationCode?: string;
  locationName?: string;
  lockedQty?: number;
  lotNo?: string;
  materialCode?: string;
  materialName?: string;
  materialSpecification?: string;
  qty?: number;
  stockName?: string;
  stockNumber?: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  unitName?: string;
}

export interface WmsInventoryTransaction {
  businessBillId?: number;
  businessBillNo?: string;
  businessSource?: string;
  fromLocationCode?: string;
  fromLocationName?: string;
  id?: number;
  materialCode?: string;
  materialName?: string;
  occurredTime?: number;
  qty?: number;
  remark?: string;
  toLocationCode?: string;
  toLocationName?: string;
  transactionType?: string;
}

export interface WmsReconcileTrace {
  erpRows: Record<string, any>[];
  line: WmsReconcileLine;
  relatedTasks: Record<string, any>[];
  transactions: WmsInventoryTransaction[];
  wmsBalances: WmsInventoryBalance[];
}

export interface WmsLocation {
  defaultUnallocated?: boolean;
  erpOrgName?: string;
  erpOrgNumber: string;
  id?: number;
  locationCode: string;
  locationName?: string;
  locationType?: string;
  remark?: string;
  stockName?: string;
  stockNumber: string;
}

export interface WmsInventoryMovePayload {
  barcode?: string;
  businessBillId?: number;
  businessBillNo?: string;
  businessSource?: string;
  containerCode?: string;
  erpOrgName?: string;
  erpOrgNumber: string;
  fromLocationCode: string;
  fromLocationName?: string;
  keeperName?: string;
  keeperNumber?: string;
  lotNo?: string;
  materialCode: string;
  materialName?: string;
  materialSpecification?: string;
  ownerName?: string;
  ownerNumber?: string;
  qty: number;
  remark?: string;
  stockName?: string;
  stockNumber: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  toLocationCode: string;
  toLocationName?: string;
  unitName?: string;
}

export type WmsErpDocumentCapability =
  | 'ADJUSTMENT_SUGGESTION'
  | 'DEFERRED'
  | 'ERP_PUSH'
  | 'MANUAL_CONFIRMATION'
  | 'MES_CREATE'
  | 'READ_ONLY'
  | 'WMS_TASK';

export type WmsOperationTaskType =
  | 'ADJUSTMENT'
  | 'INSTOCK'
  | 'ISSUE'
  | 'MOVE'
  | 'PICKING'
  | 'PUTAWAY'
  | 'RECEIVING'
  | 'RETURN'
  | 'STOCKTAKE';

export type WmsOperationTaskStatus =
  | 'BLOCKED'
  | 'CANCELLED'
  | 'CLAIMED'
  | 'ERP_AUDITED'
  | 'ERP_DRAFT'
  | 'ERP_FAILED'
  | 'ERP_SUBMITTED'
  | 'ERP_SYNCED'
  | 'EXECUTING'
  | 'OPERATING'
  | 'READY'
  | 'REVERSED'
  | 'RESERVED'
  | 'TASK_CREATED'
  | 'TRANSFER_PENDING'
  | 'WAIT_QC'
  | 'WAIT_ROUTE'
  | 'WMS_POSTED';

export interface WmsErpDocumentRegistration {
  capabilities: WmsErpDocumentCapability[];
  businessChainType?: string;
  defaultTaskType: WmsOperationTaskType;
  documentRole?: string;
  erpPushAllowed?: boolean;
  formId: string;
  formName: string;
  integrationMode?: string;
  manualConfirmationRequired?: boolean;
  mobileOperationSupported?: boolean;
  mobileNextAction?: string;
  nextAction?: string;
  operationMode?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
}

export interface WmsErpDocumentLine {
  acceptedQty?: number;
  availableQty?: number;
  blockedQty?: number;
  id: number;
  lineSeq?: number;
  lotNo?: string;
  materialCode?: string;
  materialName?: string;
  noticeQty?: number;
  pendingDecisionQty?: number;
  qty?: number;
  rejectedQty?: number;
  reportedQty?: number;
  inspectedQty?: number;
  returnedQty?: number;
  sourceEntryId?: number;
  sourceFid?: number;
  stockName?: string;
  stockNumber?: string;
  stockStatusNumber?: string;
  unitName?: string;
}

export interface WmsErpDocument {
  acceptedQty?: number;
  availableQty?: number;
  blockedQty?: number;
  businessChainType?: string;
  businessStage?: string;
  /**
   * ERP 侧业务类型原值。取值域按 formId 分派：
   * `SAL_DELIVERYNOTICE` 是 `NORMAL`/`CONSIGNMENT`，`PUR_ReceiveBill` 是 `CG`/`WW`。
   * 展示请用 `views/inventory/erp-business-type.ts` 的 `businessTypeLabel`，不要自己写 map。
   */
  businessType?: string;
  billNo?: string;
  capabilities?: WmsErpDocumentCapability[];
  documentStatus?: string;
  documentRole?: string;
  downstreamCreated?: boolean;
  erpAcctCode?: string;
  erpPushAllowed?: boolean;
  erpError?: string;
  erpOrgNumber?: string;
  fid?: number;
  formId?: string;
  formName?: string;
  id: number;
  integrationMode?: string;
  lastSyncTime?: number;
  lineCount?: number;
  lines?: WmsErpDocumentLine[];
  manualConfirmationRequired?: boolean;
  mobileOperationSupported?: boolean;
  mobileNextAction?: string;
  nextAction?: string;
  operationMode?: string;
  priority?: string;
  rejectedQty?: number;
  inspectionStatus?: string;
  sourceBillNo?: string;
  sourceFormId?: string;
  stockName?: string;
  stockNumber?: string;
  upstreamReady?: boolean;
  wmsStatus?: WmsOperationTaskStatus;
  lastError?: string;
}

export interface WmsErpDocumentSyncLinePayload {
  lineSeq?: number;
  lotNo?: string;
  materialCode: string;
  materialName?: string;
  materialSpecification?: string;
  ownerNumber?: string;
  qty?: number;
  sourceBillNo?: string;
  sourceEntryId?: number;
  sourceFid?: number;
  stockName?: string;
  stockNumber?: string;
  stockStatusName?: string;
  stockStatusNumber?: string;
  unitName?: string;
}

export interface WmsErpDocumentSyncPayload {
  billNo: string;
  documentStatus?: string;
  erpAcctCode?: string;
  erpOrgName?: string;
  erpOrgNumber?: string;
  fid?: number;
  formId: string;
  formName?: string;
  lines: WmsErpDocumentSyncLinePayload[];
  rawJson?: string;
  sourceBillNo?: string;
  sourceFid?: number;
  sourceFormId?: string;
  stockName?: string;
  stockNumber?: string;
}

export interface WmsOperationTask {
  deviceNo?: string;
  erpAcctCode?: string;
  erpDocumentStatus?: string;
  erpError?: string;
  erpOrgName?: string;
  erpOrgNumber?: string;
  finishedTime?: number;
  id: number;
  lastError?: string;
  operatorName?: string;
  remark?: string;
  sourceBillNo?: string;
  sourceDocumentId?: number;
  sourceFid?: number;
  sourceFormId?: string;
  startedTime?: number;
  stockName?: string;
  stockNumber?: string;
  taskNo?: string;
  taskStatus?: WmsOperationTaskStatus;
  taskType?: WmsOperationTaskType;
  updateTime?: number;
}

export interface WmsErpDocumentOrchestrationResult {
  billNo?: string;
  blockReasons?: string[];
  chainStatus?: string;
  documentId?: number;
  erpPushAllowed?: boolean;
  formId?: string;
  integrationMode?: string;
  manualConfirmationRequired?: boolean;
  message?: string;
  mobileNextAction?: string;
  mobileOperationSupported?: boolean;
  nextAction?: string;
  operationMode?: string;
  priority?: string;
  status?: string;
  taskId?: number;
  taskNo?: string;
  taskStatus?: WmsOperationTaskStatus;
  taskType?: WmsOperationTaskType;
}

export interface WmsBusinessChainRelation {
  acceptedQty?: number;
  availableQty?: number;
  blockedQty?: number;
  id: number;
  linkedQty?: number;
  rejectedQty?: number;
  relationType?: string;
  sourceAcctCode?: string;
  sourceBillNo?: string;
  sourceDocumentId?: number;
  targetAcctCode?: string;
  targetBillNo?: string;
  targetDocumentId?: number;
}

export interface WmsBusinessChainNode {
  acceptedQty?: number;
  availableQty?: number;
  billNo?: string;
  blockedQty?: number;
  businessChainType?: string;
  businessStage?: string;
  documentRole?: string;
  documentStatus?: string;
  downstreamCreated?: boolean;
  erpAcctCode?: string;
  id: number;
  inspectionStatus?: string;
  rejectedQty?: number;
  sourceBillNo?: string;
  upstreamReady?: boolean;
}

export interface WmsBusinessChainDetail {
  blockReasons?: string[];
  businessChainType?: string;
  chainHeader?: WmsBusinessChainNode;
  chainNodes?: WmsBusinessChainNode[];
  chainQuantities?: Record<string, number>;
  chainRelations?: WmsBusinessChainRelation[];
  chainStatus?: string;
  documentId?: number;
  rootBillNo?: string;
}

export interface WmsOperationTaskLine {
  barcode?: string;
  containerCode?: string;
  doneQty?: number;
  id: number;
  keeperNumber?: string;
  lineSeq?: number;
  lineStatus?: WmsOperationTaskStatus;
  locationCode?: string;
  lotNo?: string;
  materialCode?: string;
  materialName?: string;
  ownerNumber?: string;
  planQty?: number;
  reservedQty?: number;
  sourceEntryId?: number;
  stockName?: string;
  stockNumber?: string;
  stockStatusNumber?: string;
  taskId?: number;
  unitName?: string;
}

export interface WmsTaskDetail {
  lines: WmsOperationTaskLine[];
  task: WmsOperationTask;
}

export interface WmsTaskReservePayload {
  barcode?: string;
  clientRequestId?: string;
  containerCode?: string;
  deviceNo?: string;
  erpAcctCode?: string;
  locationCode: string;
  locationName?: string;
  qty: number;
  remark?: string;
  scanToken?: string;
  taskLineId: number;
}

export interface WmsAcctQuery {
  erpAcctCode?: string;
}

export interface WmsIncomingInspectionPayload {
  qualifiedQty: number;
  rejectedQty: number;
}

/** Every field is optional: omit all of them to reuse the dimensions stored on the task line. */
export interface WmsTaskErpConversionPayload {
  destinationErpOrgNumber?: string;
  destinationStockNumber?: string;
  keeperNumber?: string;
  locationCode?: string;
  lotNo?: string;
  ownerNumber?: string;
  stockNumber?: string;
}

export interface WmsTaskClaimPayload {
  clientRequestId?: string;
  erpAcctCode?: string;
}

export interface WmsTaskRoutePayload {
  clientRequestId?: string;
  erpAcctCode?: string;
  stockNumber: string;
}

export interface WmsTaskTransferPayload {
  clientRequestId?: string;
  erpAcctCode?: string;
  reason?: string;
  targetStockNumber: string;
  targetUserId?: number;
  taskLineId: number;
}

export interface WmsInventoryInitializationWarehouse {
  erpLockedQty: number; lineCount: number; lockDiff?: number; lockDiffReason?: string;
  message?: string; status: string; stockName?: string; stockNumber: string; totalQty: number;
  wmsQty?: number; wmsReservedQty?: number;
}
export interface WmsInventoryInitializationBatch {
  batchId: number; erpAcctCode: string; erpOrgNumber: string; expiresTime: number;
  snapshotTime: number; status: string; warehouses: WmsInventoryInitializationWarehouse[];
}
export interface WmsLocationInventoryQuery extends WmsAcctQuery {
  barcode?: string; containerCode?: string; diffOnly?: boolean; erpOrgNumber: string;
  keeperNumber?: string; locationCode?: string; lotNo?: string; materialCode?: string;
  ownerNumber?: string; stockNumber: string; stockStatusNumber?: string; unallocatedOnly?: boolean;
}
export interface WmsLocationInventoryGroup {
  dimension: Record<string, string>; erpLockedQty: number; erpQty: number; lockDiff: number;
  lockDiffReason?: string; locations: Array<{ availableQty: number; barcode?: string; containerCode?: string; locationCode: string; locationName?: string; operationStatus: string; qty: number; reservedQty: number; }>;
  qtyDiff: number; status: 'LOCK_DIFF' | 'MATCHED' | 'QTY_DIFF'; wmsQty: number; wmsReservedQty: number;
}

// 初始库存同步为批量操作：ERP 分页拉取（org 001 实测 46623 行 / 10 页 ≈ 23s）
// 叠加 snapshot 落库，总耗时远超 RequestClient 默认 10s 超时，故单独放宽到 180s。
const INVENTORY_INITIALIZATION_TIMEOUT = 180_000;

export function previewWmsInventoryInitialization(data: { erpAcctCode: string; erpOrgNumber: string }) {
  return requestClient.post<{ data: WmsInventoryInitializationBatch; message?: string; success: boolean }>('/wms/inventory/initialization/preview', data, { responseReturn: 'body', timeout: INVENTORY_INITIALIZATION_TIMEOUT });
}
export function confirmWmsInventoryInitialization(data: { batchId: number; stockNumbers: string[]; reinitialize?: boolean }) {
  return requestClient.post<{ data: WmsInventoryInitializationBatch; message?: string; success: boolean }>('/wms/inventory/initialization/confirm', data, { responseReturn: 'body', timeout: INVENTORY_INITIALIZATION_TIMEOUT });
}
export function getWmsInventoryInitializationBatch(batchId: number) {
  return requestClient.get<{ data: WmsInventoryInitializationBatch; message?: string; success: boolean }>(`/wms/inventory/initialization/batches/${batchId}`, { responseReturn: 'body' });
}
export function getWmsLocationInventory(params: WmsLocationInventoryQuery) {
  return requestClient.get<{ data: { groups: WmsLocationInventoryGroup[]; total: number }; message?: string; success: boolean }>('/wms/inventory/location-balances', { params, responseReturn: 'body' });
}

export async function queryWmsWarehouseReconcile(params: WmsReconcileQuery) {
  return requestClient.post<{ data: WmsReconcileRun; message?: string; success: boolean }>(
    '/wms/reconcile/warehouse-query',
    params,
    { responseReturn: 'body' },
  );
}

export async function getWmsReconcileTrace(id: number) {
  return requestClient.get<{ data: WmsReconcileTrace; message?: string; success: boolean }>(
    `/wms/reconcile/lines/${id}/trace`,
    { responseReturn: 'body' },
  );
}

export async function exportWmsReconcileExcel(params: WmsReconcileQuery) {
  return requestClient.post<Blob>('/wms/reconcile/export', params, {
    responseReturn: 'body',
    responseType: 'blob',
  });
}

export async function getWmsInventoryBalances(params: WmsReconcileQuery) {
  return requestClient.get<{ data: WmsInventoryBalance[]; message?: string; success: boolean; total?: number }>(
    '/wms/inventory/balances',
    { params, responseReturn: 'body' },
  );
}

export async function getWmsLocations(params: Pick<WmsReconcileQuery, 'erpOrgNumber' | 'stockNumber'>) {
  return requestClient.get<{ data: WmsLocation[]; message?: string; success: boolean; total?: number }>(
    '/wms/locations',
    { params, responseReturn: 'body' },
  );
}

export async function saveWmsLocation(data: WmsLocation) {
  return requestClient.post<{ data: WmsLocation; message?: string; success: boolean }>(
    '/wms/locations',
    data,
    { responseReturn: 'body' },
  );
}

export async function syncWmsInventoryFromErp(params: WmsReconcileQuery) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    '/wms/inventory/sync-from-erp',
    params,
    { responseReturn: 'body' },
  );
}

export interface WmsReconcileAdjustPayload extends WmsReconcileQuery {
  reason: string;
  runId?: number;
}

export interface WmsReconcileAdjustResult {
  adjusted: boolean;
  diffQty?: number;
  erpQty?: number;
  locationCode?: string;
  message?: string;
  newWmsQty?: number;
  previousWmsQty?: number;
}

// 覆盖同步：针对单一维度直接把 WMS 数量改成 ERP 当前值，专补 QTY_DIFF/WMS_ONLY 场景。
// 后端强制要求 reason 非空且会拒绝多库位/锁定量场景，前端仍需在提交前做同样校验以减少无效请求。
export async function adjustWmsInventoryFromErp(params: WmsReconcileAdjustPayload) {
  return requestClient.post<{ data: WmsReconcileAdjustResult; message?: string; success: boolean }>(
    '/wms/inventory/adjust-from-erp',
    params,
    { responseReturn: 'body' },
  );
}

export async function moveWmsInventory(data: WmsInventoryMovePayload) {
  return requestClient.post<{ data: WmsInventoryBalance; message?: string; success: boolean }>(
    '/wms/inventory/move',
    data,
    { responseReturn: 'body' },
  );
}

export async function getWmsErpDocumentRegistrations() {
  return requestClient.get<{
    data: Record<string, WmsErpDocumentRegistration>;
    message?: string;
    success: boolean;
  }>('/wms/erp-document-registrations', { responseReturn: 'body' });
}

export async function getWmsErpDocuments(params: WmsAcctQuery = {}) {
  return requestClient.get<{ data: WmsErpDocument[]; message?: string; success: boolean; total?: number }>(
    '/wms/erp-documents',
    { params, responseReturn: 'body' },
  );
}

/**
 * 分页 + 服务端过滤查询 ERP 单据。
 *
 * 与上面的 {@link getWmsErpDocuments} 是**同一个端点**：后端按「是否传 page」分派，
 * 不传仍返回全量，所以那三个依赖全量的页面（wms-erp-documents、wms-task-pool、
 * sales-delivery）不受影响。单据量大的列表页应改用本函数 ——
 * 实测全量是 1.41 MB / 1332 行，服务端只花 0.089s，瓶颈全在浏览器渲染。
 *
 * `formId` 用逗号分隔传多值，承担链路过滤（采购收料链路是三段单据）。
 *
 * ⚠️ **用了服务端过滤就不要再做客户端过滤**：两处判据漂移会表现为
 * "第 1 页搜得到、翻页后消失"，比只在一侧过滤更难查。
 */
export interface WmsErpDocumentPageQuery {
  /**
   * 只返回 `available_qty > 0` 的单据（作业池准入过滤）。
   *
   * 实测 1332 张里只有 30 张（2.3%）—— 其余是 ERP 侧已闭环的历史单据，补录只为追溯。
   * **端点默认 false**，UI 默认值由 `erp-chain-preset.ts` 的 `defaultActionableOnly` 按链路给。
   */
  actionableOnly?: boolean;
  /**
   * 逗号分隔的多个 `businessChainType`，与 `formId` 并存（语义 AND）。
   *
   * 这是四条业务链路的**真正区分键** —— `QM_InspectBill` 被采购检验与销售退货检验共用，
   * `PUR_MRB` 被检验退料与库存退料共用，光靠 formId 会让同一张单据进两个菜单。
   * 无法识别的枚举值服务端会**拒绝**而非忽略（fail closed）。
   */
  businessChainType?: string;
  businessStage?: string;
  /** 业务类型：采购 CG/WW，销售 NORMAL/CONSIGNMENT。服务端会归一为大写 */
  businessType?: string;
  erpAcctCode?: string;
  /**
   * 逗号分隔的多个 formId。
   *
   * 它的作用是**兜住老单据** —— `business_chain_type` 列比链路概念晚引入，
   * 存量单据该列为 null，只按 `businessChainType` 过滤会让它们整批消失。
   */
  formId?: string;
  /**
   * 逗号分隔的单据内码，用于「已知一批 id，只要这几张」。
   *
   * 任务池页用它按任务的 sourceDocumentId 定向取单据 —— 在此之前那页拉的是
   * 全量 1332 张只为建一个 id→document 的 map，而它手上的任务只有 47 条。
   */
  ids?: string;
  keyword?: string;
  page: number;
  size: number;
  wmsStatus?: string;
}

export async function getWmsErpDocumentPage(params: WmsErpDocumentPageQuery) {
  return requestClient.get<{
    data: WmsErpDocument[];
    message?: string;
    page?: number;
    size?: number;
    success: boolean;
    total?: number;
  }>('/wms/erp-documents', { params, responseReturn: 'body' });
}

/** 服务端分组计数的一行。 */
export interface WmsErpDocumentSummaryRow {
  /** 该分组里 available_qty > 0 的行数，让指标卡一次请求拿到「可作业 / 累计」两个基准 */
  actionableCount?: number;
  businessType?: string;
  count: number;
  formId?: string;
  wmsStatus?: string;
}

/**
 * 列表页指标卡的分组计数。
 *
 * 列表分页后客户端只有当前页，本地遍历算出的是"本页统计"——
 * 用户会看到「收料单据 50」而实际 1332 条。所以聚合必须在服务端。
 * 返回原始分组，由前端按展示语义折成四张卡（见 erp-chain-preset.ts 的
 * summariseChainMetrics），避免"什么算待处理"这套判据两地维护。
 */
export async function getWmsErpDocumentSummary(params: {
  /** 与列表用同一套链路过滤维度，否则指标卡的基准和列表对不上 */
  businessChainType?: string;
  erpAcctCode?: string;
  formId?: string;
}) {
  return requestClient.get<{
    data: WmsErpDocumentSummaryRow[];
    message?: string;
    success: boolean;
  }>('/wms/erp-documents/summary', { params, responseReturn: 'body' });
}

export async function getWmsErpDocument(id: number) {
  return requestClient.get<{ data: WmsErpDocument; message?: string; success: boolean }>(
    `/wms/erp-documents/${id}`,
    { responseReturn: 'body' },
  );
}

export async function getWmsErpDocumentChain(id: number) {
  return requestClient.get<{ data: WmsBusinessChainDetail; message?: string; success: boolean }>(
    `/wms/erp-documents/${id}/chain`,
    { responseReturn: 'body' },
  );
}

export async function syncWmsErpDocument(data: WmsErpDocumentSyncPayload) {
  return requestClient.post<{ data: WmsErpDocument; message?: string; success: boolean }>(
    '/wms/erp-documents/sync',
    data,
    { responseReturn: 'body' },
  );
}

export async function createWmsTaskFromDocument(documentId: number) {
  return requestClient.post<{ data: WmsOperationTask; message?: string; success: boolean }>(
    `/wms/tasks/from-document/${documentId}`,
    {},
    { responseReturn: 'body' },
  );
}

export async function orchestrateWmsErpDocument(documentId: number) {
  return requestClient.post<{
    data: WmsErpDocumentOrchestrationResult;
    message?: string;
    success: boolean;
  }>(`/wms/erp-documents/${documentId}/orchestrate`, {}, { responseReturn: 'body' });
}

export async function getWmsTasks(params: WmsAcctQuery = {}) {
  return requestClient.get<{ data: WmsOperationTask[]; message?: string; success: boolean; total?: number }>(
    '/wms/tasks',
    { params, responseReturn: 'body' },
  );
}

export async function getWmsTask(taskId: number, params: WmsAcctQuery = {}) {
  return requestClient.get<{ data: WmsTaskDetail; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}`,
    { params, responseReturn: 'body' },
  );
}

export async function reserveWmsTask(taskId: number, data: WmsTaskReservePayload) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/reserve`,
    data,
    { responseReturn: 'body' },
  );
}

export async function submitWmsTask(taskId: number, data: WmsAcctQuery = {}) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/submit`,
    data,
    { responseReturn: 'body' },
  );
}

export async function releaseWmsTask(taskId: number, data: WmsAcctQuery = {}) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/release`,
    data,
    { responseReturn: 'body' },
  );
}

/**
 * Record the incoming-inspection verdict of one task line.
 *
 * `taskLineId` is a query parameter, not part of the body -- see
 * WmsOperationController.completeIncomingInspection.
 */
export async function completeIncomingInspection(
  taskId: number,
  taskLineId: number,
  data: WmsIncomingInspectionPayload,
) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/incoming-inspection`,
    data,
    { params: { taskLineId }, responseReturn: 'body' },
  );
}

/**
 * Push a task line to ERP. Omit `data` to reuse the dimensions already stored on the line;
 * pass them explicitly when retrying after a dimension gap.
 */
export async function convertWmsTaskToErp(
  taskId: number,
  taskLineId: number,
  data: WmsTaskErpConversionPayload = {},
) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/erp-convert`,
    data,
    { params: { taskLineId }, responseReturn: 'body' },
  );
}

/**
 * 一步完成：下推 ERP，成功后记本地库存。
 *
 * **取代并列的 `convertWmsTaskToErp` + `submitWmsTask`。** 那两个动作语义正交但有隐含顺序 ——
 * 先 submit 会把任务打到 `WMS_POSTED`，前端随即禁用下推，结果 ERP 一张单都没生成却显示
 * "已过账"（2026-08-29 实测踩到）。
 *
 * 语义是 **ERP 为准**：ERP 失败则本地库存一律不动，失败原因写在任务的 `lastError` 上可直接重试。
 *
 * `convertWmsTaskToErp` 与 `submitWmsTask` 保留 —— 移动端仍在用，分步重试在排障时有价值。
 */
export async function completeWmsTaskLine(
  taskId: number,
  taskLineId: number,
  erpAcctCode?: string,
  data: WmsTaskErpConversionPayload = {},
) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/complete`,
    data,
    { params: { erpAcctCode, taskLineId }, responseReturn: 'body' },
  );
}

export async function claimWmsTask(taskId: number, data: WmsTaskClaimPayload = {}) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/claim`,
    data,
    { responseReturn: 'body' },
  );
}

export async function releaseWmsTaskClaim(taskId: number, data: WmsTaskClaimPayload = {}) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/release-claim`,
    data,
    { responseReturn: 'body' },
  );
}

export async function routeWmsTask(taskId: number, data: WmsTaskRoutePayload) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/route`,
    data,
    { responseReturn: 'body' },
  );
}

/**
 * Hand a whole task line over to another warehouse. Requires the caller to hold the claim
 * (WmsTaskRoutingService rejects transfers issued by anyone but the current claimer).
 */
export async function transferWmsTask(taskId: number, data: WmsTaskTransferPayload) {
  return requestClient.post<{ data: Record<string, any>; message?: string; success: boolean }>(
    `/wms/tasks/${taskId}/transfer`,
    data,
    { responseReturn: 'body' },
  );
}
