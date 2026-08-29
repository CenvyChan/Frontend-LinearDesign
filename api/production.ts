import { request } from '@/utils/request'
import { requestClient } from '#/api/request'

// 生产工单查询参数
export interface ProductionOrderQueryParams {
  erpAcctCode?: string
  prdOrgId?: string
  erpOrgNumber?: string  // 组织编码（用于规格型号查询）
  workshopNumbers?: string[]
  moBillType?: string
  status?: string
  materialModel?: string  // 规格型号（模糊查询）
  conveyDateBegin?: string
  conveyDateEnd?: string
  planStartDateBegin?: string
  planStartDateEnd?: string
  planFinishDateBegin?: string
  planFinishDateEnd?: string
  conveyDateInvolve?: boolean
  planStartDateInvolve?: boolean
  planFinishDateInvolve?: boolean
  isSuspend?: string
  pageIndex?: number
  pageSize?: number
}

// 生产工单信息
export interface ProductionOrderItem {
  workshopId: string
  moBillTypeId: string
  moBillNo: string
  moEntrySeq: number
  materialId: string
  materialName: string
  materialModel: string
  productTypeName: string
  prdUnitId: string
  conveyDate: string
  startDate: string
  finishDate: string
  planQty: number
  reportQty: number
  finishQty: number
  stockInQuaQty: number
  pickedQty: number
  statusName: string
  closeTypeName: string
}

// 生产用料清单查询参数
export interface MaterialListQueryParams {
  moBillNo: string
  moEntrySeq: number
  prdOrgId?: string
}

// 生产用料清单项
export interface MaterialListItem {
  moBillNo: string
  moEntrySeq: number
  moEntryId?: number
  moEntryMirror?: number
  pbomBillNo: string
  pbomEntryId?: number
  documentStatus?: string
  documentStatusText?: string
  productMaterialCode: string
  productMaterialName: string
  productMaterialSpecification: string
  prdOrgNumber?: string
  baseUnitNumber?: string
  unitNumber?: string
  materialCode: string
  materialName: string
  materialSpecification: string
  defaultStockName?: string
  defaultStockNumber?: string
  numerator?: number
  denominator?: number
  stdQty?: number
  stdUnitQty?: number
  mustQty?: number
  consumVolatility?: number
  selectedPickedQty?: number
  goodReturnQty?: number
  incDefectReturnQty?: number
  returnQty?: number
  pickedQty?: number
  noPickedQty?: number
  rePickedQty?: number
  actualPickQty?: number
  wipQty?: number
}

export type MaterialUsageItem = MaterialListItem & {
  specification?: string
  stdBomQty?: number
  stdReqQty?: number
}

export interface PickTaskItem {
  id: number
  erpFormId?: 'PRD_PickMtrl'
  sourceType?: 'PICK'
  orderId?: number
  orderNo: string
  moEntrySeq: number
  moEntryId?: number
  pbomBillNo?: string
  pbomEntryId: number
  materialCode: string
  materialName?: string
  materialSpecification?: string
  defaultStockNumber?: string
  defaultStockName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  requestQty?: number
  reservedQty?: number
  preparedQty?: number
  issuedQty?: number
  mustQty?: number
  erpPickedQty?: number
  availableApplyQty?: number
  priorityLevel?: number
  taskStatus: 'APPLIED' | 'PREPARING' | 'PREPARED' | 'ISSUING' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'CLOSED' | 'FAILED'
  applyUserName?: string
  prepareUserName?: string
  erpBillId?: number
  erpBillNo?: string
  erpBillStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'UNKNOWN'
  erpDocumentStatus?: string
  rollbackStatus?: 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED'
  allocations?: PickTaskAllocationItem[]
  closeReason?: string
  failReason?: string
  createTime?: number
}

export interface PickTaskAllocationItem {
  stockNumber?: string
  stockName?: string
  stockLoc?: string
  stockStatusNumber?: string
  stockStatusName?: string
  lotNo?: string
  produceDate?: string
  expiryDate?: string
  keeperNumber?: string
  keeperName?: string
  qty?: number
}

export interface PickTaskMaterialSummaryItem {
  materialCode: string
  materialName?: string
  materialSpecification?: string
  defaultStockNumber?: string
  defaultStockName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  erpFormId?: 'PRD_PickMtrl'
  sourceType?: 'PICK'
  totalReservedQty?: number
  taskCount?: number
  highestPriority?: number
  earliestApplyTime?: number
  tasks: PickTaskItem[]
}

export interface ReturnTaskItem {
  id: number
  erpFormId?: 'PRD_FeedMtrl'
  sourceType?: 'FEED'
  orderId?: number
  orderNo: string
  moEntrySeq: number
  moEntryId?: number
  pbomBillNo?: string
  pbomEntryId: number
  materialCode: string
  materialName?: string
  materialSpecification?: string
  requestQty?: number
  maxReturnQty?: number
  wipQty?: number
  pickedQty?: number
  actualPickQty?: number
  warehouseNumber?: string
  warehouseName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  returnReasonNumber?: string
  returnReasonText?: string
  taskStatus: 'APPLIED' | 'PREVIEWED' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'INSPECTING' | 'INSPECTED' | 'CLOSED' | 'FAILED'
  erpBillStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'UNKNOWN'
  erpDocumentStatus?: string
  erpBillId?: number
  erpBillNo?: string
  inspectionStatus?: 'NONE' | 'PENDING_INSPECTION' | 'INSPECT_PASS_RETURN_TO_STOCK' | 'INSPECT_FAIL_TO_SCRAP' | 'INSPECT_FAIL_TO_VENDOR'
  inspectionRemark?: string
  inspectionSourceCategory?: string
  inspectorName?: string
  sourceQrToken?: string
  returnQrToken?: string
  returnQrStatus?: string
  targetWarehouseNumber?: string
  targetWarehouseName?: string
  scrapTarget?: string
  vendorTarget?: string
  applyUserName?: string
  failReason?: string
  createTime?: number
}

export interface ReturnTaskMaterialSummaryItem {
  materialCode: string
  materialName?: string
  materialSpecification?: string
  warehouseNumber?: string
  warehouseName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  totalRequestQty?: number
  taskCount?: number
  earliestApplyTime?: number
  tasks: ReturnTaskItem[]
}

export interface MaterialEntryLockItem {
  orderNo: string
  moEntrySeq: number
  pbomEntryId: number
  operationType?: 'PICK' | 'RETURN' | 'FEED' | 'PREPARE' | 'ISSUE'
  locked: boolean
  lockToken?: string
  ownerUserId?: number
  ownerUserName?: string
  lockedAt?: number
  expiresAt?: number
}

export interface FeedTaskItem {
  id: number
  erpFormId?: 'PRD_FeedMtrl'
  sourceType?: 'FEED'
  orderId?: number
  orderNo: string
  moEntrySeq: number
  moEntryId?: number
  pbomBillNo?: string
  pbomEntryId: number
  materialCode: string
  materialName?: string
  materialSpecification?: string
  defaultStockNumber?: string
  defaultStockName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  productMaterialCode?: string
  productMaterialName?: string
  requestQty?: number
  preparedQty?: number
  issuedQty?: number
  mustQty?: number
  pickedQty?: number
  reasonNumber?: string
  reasonText?: string
  priorityLevel?: number
  taskStatus: 'APPLIED' | 'PREPARING' | 'PREPARED' | 'PREVIEWED' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'CLOSED' | 'FAILED'
  applyUserName?: string
  prepareUserName?: string
  erpBillId?: number
  erpBillNo?: string
  erpBillStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'TERMINATED' | 'UNKNOWN'
  erpDocumentStatus?: string
  rollbackStatus?: 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED'
  allocations?: PickTaskAllocationItem[]
  closeReason?: string
  failReason?: string
  createTime?: number
}

export interface FeedTaskMaterialSummaryItem {
  materialCode: string
  materialName?: string
  materialSpecification?: string
  defaultStockNumber?: string
  defaultStockName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  erpFormId?: 'PRD_FeedMtrl'
  sourceType?: 'FEED'
  totalRequestQty?: number
  taskCount?: number
  highestPriority?: number
  earliestApplyTime?: number
  tasks: FeedTaskItem[]
}

export type MaterialRequestTaskItem = FeedTaskItem | PickTaskItem

export interface MaterialRequestTaskMaterialSummaryItem {
  materialCode: string
  materialName?: string
  materialSpecification?: string
  defaultStockNumber?: string
  defaultStockName?: string
  applyType?: 'PHYSICAL' | 'WORKSHOP' | string
  warehouseType?: 'PHYSICAL' | 'WORKSHOP' | string
  erpFormIds?: string[]
  sourceTypes?: Array<'FEED' | 'PICK' | string>
  totalDemandQty?: number
  totalReservedQty?: number
  taskCount?: number
  highestPriority?: number
  earliestApplyTime?: number
  tasks: MaterialRequestTaskItem[]
}

export interface RouteOption {
  id: number
  routeCode: string
  routeName: string
  version: string
  status: string
  statusDesc: string
  stepCount: number
  isRecommended: boolean
  effectiveDate?: number
}

export interface FlowCardItem {
  id: number
  orderNo: string
  stepNo: number
  stepName: string
  processCode: string
  standardHours: number
  completeQuantity?: number
  timeUnit?: string
  standardDuration?: number
  setupTime?: number
  setupTimeUnit?: string
  setupDuration?: number
  flowStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  stepType?: 'PRODUCTION' | 'INSPECTION'
  parentFlowId?: number
  actualStartTime?: number
  actualEndTime?: number
  actualHours?: number
  actualWorkSeconds?: number
  actualQuantity?: number
  defectQuantity?: number
  goodQuantity?: number
  operatorId?: number
  operatorName?: string
  sopFilePath?: string
  remark?: string
  reportBillNo?: string
  batchCode?: string
  batchSeq?: number
  sourceFlowId?: number
  rootFlowId?: number
  flowCategory?: 'NORMAL' | 'REWORK' | string
  claimStatus?: 'WAITING' | 'CLAIMED' | 'RELEASED' | string
  claimLockToken?: string
  claimOwnerId?: number
  claimOwnerName?: string
  claimTime?: number
  claimExpiresAt?: number
  inputQuantity?: number
  transferQuantity?: number
  scrapQuantity?: number
  reworkQuantity?: number
  qualityDisposition?: 'PENDING' | 'PASS' | 'REWORK' | 'SCRAP' | string
  qualityDispositionLabel?: string
  workCenterId?: number
  workCenterName?: string
  lineCode?: string
  lineName?: string
  reworkReasonCode?: string
  reworkReasonText?: string
  inspectionTask?: {
    id: number
    taskStatus: string
    qualityDisposition?: 'PENDING' | 'PASS' | 'REWORK' | 'SCRAP' | string
    qualityDispositionLabel?: string
    inspectionFlowId?: number
    unqualifiedQuantity?: number
    scrapQuantity?: number
    erpPushStatus?: string
    erpReportBillNo?: string
    erpInspectionBillNo?: string
    lastError?: string
  }
}

export interface ExceptionItem {
  id: number
  orderNo: string
  stepNo?: number
  stepName?: string
  exceptionType: string
  exceptionTypeDesc?: string
  exceptionDesc: string
  handlerStatus: string
  handlerStatusDesc?: string
  handlerName?: string
  handlerId?: number
  isBlocking: boolean
  createTime?: number
  handleTime?: number
  handleRemark?: string
}

export interface ProcessStepDocumentItem {
  id: number
  docName?: string
  originalFilename: string
  filePath: string
  fileExt?: string
  fileSize?: number
  docType?: string
  createdByName?: string
  createTime?: number
}

// 生产工单查询响应
export interface ProductionOrderResponse {
  success: boolean
  message: string
  data: ProductionOrderItem[]
  total: number
}

// 生产用料清单查询响应
export interface MaterialListResponse {
  success: boolean
  message: string
  data: MaterialListItem[]
  total: number
}

export interface PickTaskResponse {
  success: boolean
  message?: string
  data: PickTaskItem[]
  total: number
}

export interface PickTaskMaterialSummaryResponse {
  success: boolean
  message?: string
  data: PickTaskMaterialSummaryItem[]
  total: number
}

export interface MaterialRequestTaskMaterialSummaryResponse {
  success: boolean
  message?: string
  data: MaterialRequestTaskMaterialSummaryItem[]
  total: number
}

export interface ReturnTaskResponse {
  success: boolean
  message?: string
  data: ReturnTaskItem[]
  total: number
}

export interface ReturnTaskMaterialSummaryResponse {
  success: boolean
  message?: string
  data: ReturnTaskMaterialSummaryItem[]
  total: number
}

export interface FeedTaskResponse {
  success: boolean
  message?: string
  data: FeedTaskItem[]
  total: number
}

export interface FeedTaskMaterialSummaryResponse {
  success: boolean
  message?: string
  data: FeedTaskMaterialSummaryItem[]
  total: number
}

export interface OrderLifecycleDiagnosticsResponse {
  success: boolean
  message?: string
  data?: Record<string, any>
}

// 查询生产工单
export function queryProductionOrder(params: ProductionOrderQueryParams): Promise<ProductionOrderResponse> {
  return request.post('/production-order/query', params)
}

export function exportProductionOrderExcel(params: ProductionOrderQueryParams) {
  return requestClient.post<Blob>('/production-order/export', params, {
    responseReturn: 'body',
    responseType: 'blob',
  })
}

export function getOrderLifecycleDiagnostics(orderNo: string): Promise<OrderLifecycleDiagnosticsResponse> {
  return request.get(`/production-order/lifecycle-diagnostics/${encodeURIComponent(orderNo)}`)
}

// 强制刷新生产工单（跳过缓存）
export function refreshProductionOrder(params: ProductionOrderQueryParams): Promise<ProductionOrderResponse> {
  return request.post('/production-order/refresh', params)
}

// 查询生产用料清单
export function queryMaterialList(params: MaterialListQueryParams): Promise<MaterialListResponse> {
  return request.post('/production-order/material-list/query', params)
}

export function applyPickRequest(orderId: number, data: {
  moBillNo: string
  moEntrySeq: number
  pbomEntryId: number
  requestQty: number
  priorityLevel?: number
  applyUserName?: string
  lotNo?: string
  stockLoc?: string
  stockName?: string
  stockNumber?: string
  stockStatusName?: string
  stockStatusNumber?: string
}) {
  return request.post(`/production-order/${orderId}/pick-request/apply`, data)
}

export function applyPickWithOverfeed(orderId: number, data: {
  applyUserName?: string
  autoCreateFeedForOverflow?: boolean
  lines: {
    /** 该行超出可申请量时的补料原因编码，非必填 */
    overflowReasonNumber?: string
    /** 该行超出可申请量时的补料原因，该行存在超出量时必填 */
    overflowReasonText?: string
    pbomEntryId: number
    requestQty: number
    stockName?: string
    stockNumber?: string
  }[]
  moBillNo: string
  moEntrySeq: number
  /** 整单兜底补料原因编码，行级未填时回退到此 */
  overflowReasonNumber?: string
  /** 整单兜底补料原因，行级未填时回退到此 */
  overflowReasonText?: string
  priorityLevel?: number
  priorityType?: 'NORMAL' | 'URGENT'
}) {
  return request.post(`/production-order/${orderId}/material-request/apply-pick-with-overfeed`, data)
}

export function getPickRequests(orderId: number): Promise<PickTaskResponse> {
  return request.get(`/production-order/${orderId}/pick-requests`)
}

export function getPickTaskPool(): Promise<PickTaskResponse> {
  return request.get('/production-order/pick-tasks/pool')
}

export function getPickTaskMaterialSummary(): Promise<PickTaskMaterialSummaryResponse> {
  return request.get('/production-order/pick-tasks/pool/material-summary')
}

export function getMaterialRequestTaskMaterialSummary(): Promise<MaterialRequestTaskMaterialSummaryResponse> {
  return request.get('/production-order/material-requests/pool/material-summary')
}

export function autoAllocateMaterialRequests(data: {
  tasks: {
    sourceType: 'FEED' | 'PICK' | string
    taskId: number
  }[]
}) {
  return request.post('/production-order/material-requests/pool/auto-allocate', data)
}

export function closePickTask(taskId: number, reason?: string) {
  return request.post(`/production-order/pick-request/${taskId}/close`, { reason })
}

export function preparePickTask(taskId: number, data?: string | {
  allocations?: PickTaskAllocationItem[]
  prepareUserName?: string
}) {
  const body = typeof data === 'string' ? { prepareUserName: data } : data || {}
  return request.post(`/production-order/pick-request/${taskId}/prepare`, body)
}

export function previewIssueBill(taskId: number) {
  return request.post(`/production-order/pick-request/${taskId}/issue-preview`)
}

export function previewIssueBillsBatch(taskIds: number[]) {
  return request.post('/production-order/pick-request/issue-preview-batch', { taskIds })
}

export function submitIssueBill(taskId: number, data?: Record<string, any>) {
  return request.post(`/production-order/pick-request/${taskId}/issue-submit`, data || {})
}

export function submitIssueBillsBatch(taskIds: number[]) {
  return request.post('/production-order/pick-request/issue-submit-batch', { taskIds })
}

export function rollbackIssueBill(taskId: number) {
  return request.post(`/production-order/pick-request/${taskId}/rollback`)
}

export function rollbackIssueBillsBatch(taskIds: number[]) {
  return request.post('/production-order/pick-request/rollback-batch', { taskIds })
}

export function getPickErpStatus(taskId: number) {
  return request.get(`/production-order/pick-request/${taskId}/erp-status`)
}

export function applyReturnRequest(orderId: number, data: {
  moBillNo: string
  moEntrySeq: number
  pbomEntryId: number
  requestQty: number
  warehouseNumber: string
  warehouseName?: string
  lotNo?: string
  stockLoc?: string
  stockStatusName?: string
  stockStatusNumber?: string
  returnReasonNumber?: string
  returnReasonText?: string
  sourceQrToken?: string
  applyUserName?: string
}) {
  return request.post(`/production-order/${orderId}/return-request/apply`, data)
}

export function getReturnRequests(orderId: number): Promise<ReturnTaskResponse> {
  return request.get(`/production-order/${orderId}/return-requests`)
}

export function getReturnTaskPool(): Promise<ReturnTaskResponse> {
  return request.get('/production-order/return-tasks/pool')
}

export function getReturnTaskMaterialSummary(): Promise<ReturnTaskMaterialSummaryResponse> {
  return request.get('/production-order/return-tasks/pool/material-summary')
}

export function previewReturnBill(taskId: number) {
  return request.post(`/production-order/return-request/${taskId}/preview`)
}

export function submitReturnBill(taskId: number, data?: Record<string, any>) {
  return request.post(`/production-order/return-request/${taskId}/submit`, data || {})
}

export function getReturnErpStatus(taskId: number) {
  return request.get(`/production-order/return-request/${taskId}/erp-status`)
}

export function getMaterialEntryLocks(params: {
  orderNo: string
  moEntrySeq: number
  pbomEntryIds: number[]
}): Promise<{ success: boolean; message?: string; data: MaterialEntryLockItem[]; total: number }> {
  return request.get('/production-order/material-entry-locks', {
    params: {
      orderNo: params.orderNo,
      moEntrySeq: params.moEntrySeq,
      pbomEntryIds: params.pbomEntryIds.join(','),
    },
  })
}

export function acquireMaterialEntryLock(data: {
  orderNo: string
  moEntrySeq: number
  pbomEntryId: number
  operationType: MaterialEntryLockItem['operationType']
}) {
  return request.post('/production-order/material-entry-locks/acquire', data)
}

export function heartbeatMaterialEntryLock(lockToken: string) {
  return request.post('/production-order/material-entry-locks/heartbeat', { lockToken })
}

export function releaseMaterialEntryLock(lockToken: string) {
  return request.post('/production-order/material-entry-locks/release', { lockToken })
}

export function applyFeedRequest(orderId: number, data: {
  moBillNo: string
  moEntrySeq: number
  pbomEntryId: number
  requestQty: number
  reasonNumber?: string
  reasonText: string
  priorityLevel?: number
  applyUserName?: string
  lotNo?: string
  stockLoc?: string
  stockName?: string
  stockNumber?: string
  stockStatusName?: string
  stockStatusNumber?: string
  lockToken?: string
}) {
  return request.post(`/production-order/${orderId}/feed-request/apply`, data)
}

export function getFeedRequests(orderId: number): Promise<FeedTaskResponse> {
  return request.get(`/production-order/${orderId}/feed-requests`)
}

export function getFeedTaskPool(): Promise<FeedTaskResponse> {
  return request.get('/production-order/feed-tasks/pool')
}

export function getFeedTaskMaterialSummary(): Promise<FeedTaskMaterialSummaryResponse> {
  return request.get('/production-order/feed-tasks/pool/material-summary')
}

export function closeFeedTask(taskId: number, reason?: string) {
  return request.post(`/production-order/feed-request/${taskId}/close`, { reason })
}

export function prepareFeedTask(taskId: number, data?: string | {
  allocations?: PickTaskAllocationItem[]
  prepareUserName?: string
}) {
  const body = typeof data === 'string' ? { prepareUserName: data } : data || {}
  return request.post(`/production-order/feed-request/${taskId}/prepare`, body)
}

export function previewFeedBill(taskId: number, mode?: 'PUSH' | 'SAVE') {
  return request.post(`/production-order/feed-request/${taskId}/preview`, { mode })
}

export function submitFeedBill(taskId: number, data?: Record<string, any>) {
  return request.post(`/production-order/feed-request/${taskId}/submit`, data || {})
}

export function rollbackFeedBill(taskId: number) {
  return request.post(`/production-order/feed-request/${taskId}/rollback`)
}

export function getFeedErpStatus(taskId: number) {
  return request.get(`/production-order/feed-request/${taskId}/erp-status`)
}

export function submitReturnInspectionResult(taskId: number, data: {
  inspectionStatus: 'PENDING_INSPECTION' | 'INSPECT_PASS_RETURN_TO_STOCK' | 'INSPECT_FAIL_TO_SCRAP' | 'INSPECT_FAIL_TO_VENDOR'
  inspectorName?: string
  sourceCategory?: string
  targetWarehouseNumber?: string
  targetWarehouseName?: string
  scrapTarget?: string
  vendorTarget?: string
  remark?: string
}) {
  return request.post(`/production-order/return-request/${taskId}/inspection-result`, data)
}

export function checkRouteAvailability(orderId: number) {
  return request.get(`/production-order/${orderId}/route-check`)
}

export function dispatchOrder(orderId: number) {
  return request.post(`/production-order/${orderId}/dispatch`)
}

export function bindRoute(orderId: number, routeId: number) {
  return request.put(`/production-order/${orderId}/bind-route`, { routeId })
}

export function getFlowCards(orderId: number) {
  return request.get(`/production-order/${orderId}/flow-card`)
}

export function startStep(orderId: number, stepNo: number, operator?: { operatorId?: number; operatorName?: string }) {
  return request.post(`/production-order/${orderId}/flow-card/${stepNo}/start`, operator || {})
}

export function startStepByFlowId(flowId: number, operator?: { operatorId?: number; operatorName?: string }) {
  return request.post(`/production-order/flow-card/${flowId}/start`, operator || {})
}

export function claimFlowCard(flowId: number, data?: { operatorId?: number; operatorName?: string; claimQuantity?: number }) {
  return request.post(`/production-order/flow-card/${flowId}/claim`, data || {})
}

export function claimAndStartFlowCard(flowId: number, data?: { operatorId?: number; operatorName?: string; claimQuantity?: number }) {
  return request.post(`/production-order/flow-card/${flowId}/claim-and-start`, data || {})
}

export function reconcileMissingInspectionFlow(flowId: number) {
  return request.post(`/production-order/flow-card/${flowId}/reconcile-inspection`)
}

export function heartbeatFlowCard(flowId: number, data?: { claimLockToken?: string; operatorId?: number; operatorName?: string }) {
  return request.post(`/production-order/flow-card/${flowId}/heartbeat`, data || {})
}

export function releaseFlowCard(flowId: number, data?: { claimLockToken?: string; operatorId?: number; operatorName?: string }) {
  return request.post(`/production-order/flow-card/${flowId}/release`, data || {})
}

export function completeStep(orderId: number, stepNo: number, data: {
  actualQuantity?: number
  defectQuantity?: number
  actualHours?: number
  actualWorkSeconds?: number
  operatorId?: number
  operatorName?: string
  remark?: string
  reworkRequired?: boolean
}) {
  return request.post(`/production-order/${orderId}/flow-card/${stepNo}/complete`, data)
}

export function completeStepByFlowId(flowId: number, data: {
  actualQuantity?: number
  defectQuantity?: number
  actualHours?: number
  actualWorkSeconds?: number
  operatorId?: number
  operatorName?: string
  remark?: string
  reworkRequired?: boolean
}) {
  return request.post(`/production-order/flow-card/${flowId}/complete`, data)
}

export function skipStep(orderId: number, stepNo: number, reason?: string) {
  return request.post(`/production-order/${orderId}/flow-card/${stepNo}/skip`, { reason })
}

export function regenerateFlowCards(orderId: number) {
  return request.post(`/production-order/${orderId}/flow-card/regenerate`)
}

export function forceRegenerateFlowCards(
  orderId: number,
  data?: { confirmed?: boolean; operatorId?: number; operatorName?: string },
) {
  return request.post(`/production-order/${orderId}/flow-card/force-regenerate`, data || { confirmed: true })
}

export function getOrderSteps(orderId: number) {
  return request.get(`/production-order/${orderId}/steps`)
}

export function ensureLocalOrder(data: {
  orderNo: string
  productCode?: string
  productName?: string
  planQty?: number
  erpAcctCode?: string
  prdOrgNumber: string
  workshopNumber: string
}) {
  return request.post('/production-order/ensure-local', data)
}

export function getOrderExceptions(orderId: number) {
  return request.get(`/production-order/${orderId}/exceptions`)
}

export function reportException(orderId: number, stepNo: number, data: {
  exceptionType: string
  description: string
  isBlocking?: boolean
}) {
  return request.post(`/production-order/${orderId}/flow-card/${stepNo}/report-exception`, data)
}

export function handleException(exceptionId: number, data: { handlerId?: number; handlerName?: string }) {
  return request.post(`/production-order/exceptions/${exceptionId}/handle`, data)
}

export function resolveException(exceptionId: number, handleRemark?: string) {
  return request.post(`/production-order/exceptions/${exceptionId}/resolve`, { handleRemark })
}

export function escalateException(exceptionId: number, data: { handlerId?: number; handlerName?: string; remark?: string }) {
  return request.post(`/production-order/exceptions/${exceptionId}/escalate`, data)
}

export function getStepDocuments(orderId: number, stepNo: number) {
  return request.get(`/production-order/${orderId}/flow-card/${stepNo}/documents`)
}

export function getOnlyOfficeConfig() {
  return request.get('/process-route/document/onlyoffice/config')
}

export function generateOnlyOfficeToken(payload: any) {
  return request.post('/process-route/document/onlyoffice/token', payload)
}

export function getDocumentFileDownloadUrl(filePath: string): string {
  return `/api/uploads/${filePath}`
}

export function getOrderQrCodeUrl(orderId: number): string {
  return `/api/production-order/${orderId}/qrcode`
}

//
export function getMaterialList(params: MaterialListQueryParams) {
 return queryMaterialList(params)
}

export function getAllExceptions(params?: any) {
 return request.get('/production-order/exceptions', { params })
}

// ─── 仓库转仓 ───────────────────────────────────────────────────────────────

export interface MaterialTaskTransferPayload {
  targetStockNumber: string
  targetStockName?: string
  reason?: string
  clientRequestId: string
}

/** 领料任务转仓 */
export function transferPickTask(taskId: number, data: MaterialTaskTransferPayload) {
  return request.post(`/production-order/pick-tasks/${taskId}/transfer`, data)
}

/** 补料任务转仓 */
export function transferFeedTask(taskId: number, data: MaterialTaskTransferPayload) {
  return request.post(`/production-order/feed-tasks/${taskId}/transfer`, data)
}

/** 退料任务转仓 */
export function transferReturnTask(taskId: number, data: MaterialTaskTransferPayload) {
  return request.post(`/production-order/return-tasks/${taskId}/transfer`, data)
}
