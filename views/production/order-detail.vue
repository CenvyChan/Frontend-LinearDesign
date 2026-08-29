<template>
  <div class="order-detail-container">
    <!-- 顶部导航 -->
    <div class="detail-header">
      <el-button @click="goBack" :icon="'ArrowLeft'">返回列表</el-button>
      <span class="header-title">工单详情 - {{ orderInfo?.orderNo || '加载中...' }}</span>
      <el-tag v-if="orderInfo" :type="getBizStatusType(orderInfo.businessStatus)" style="margin-left:12px">
        {{ getBizStatusText(orderInfo.businessStatus) }}
      </el-tag>
    </div>

    <div v-loading="loading" class="detail-body">
      <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
        <!-- ==================== TAB1: 基础信息 ==================== -->
        <el-tab-pane label="基础信息" name="basic">
          <el-descriptions :column="4" border size="small">
            <el-descriptions-item label="工单号">{{ orderInfo?.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="物料编码">{{ orderInfo?.productCode }}</el-descriptions-item>
            <el-descriptions-item label="物料名称">{{ orderInfo?.productName }}</el-descriptions-item>
            <el-descriptions-item label="计划数量">{{ orderInfo?.planQty }}</el-descriptions-item>
            <el-descriptions-item label="完成数量">{{ orderInfo?.completedQty || 0 }}</el-descriptions-item>
            <el-descriptions-item label="计划开始">{{ formatTime(orderInfo?.planStartTime) }}</el-descriptions-item>
            <el-descriptions-item label="计划结束">{{ formatTime(orderInfo?.planEndTime) }}</el-descriptions-item>
            <el-descriptions-item label="ERP单号">{{ orderInfo?.erpOrderNo || '-' }}</el-descriptions-item>
          </el-descriptions>

          <!-- 工艺路线绑定区域 -->
          <el-card class="section-card" style="margin-top:16px">
            <template #header>
              <span>工艺路线绑定</span>
              <div style="float:right">
                <el-button size="small" @click="handleRouteCheck" :loading="routeCheckLoading" :icon="'Refresh'">检查路线</el-button>
                <el-button size="small" type="success" @click="handleDispatch" :loading="dispatchLoading" :disabled="!canDispatch" :icon="'Check'">下达工单</el-button>
              </div>
            </template>

            <div v-if="routeInfo" class="route-bound-info">
              <el-tag type="success" style="margin-bottom:8px">已绑定工艺路线</el-tag>
              <el-descriptions :column="4" border size="small">
                <el-descriptions-item label="路线名称">{{ routeInfo.routeName }}</el-descriptions-item>
                <el-descriptions-item label="版本">{{ routeInfo.version }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ routeInfo.statusDesc }}</el-descriptions-item>
                <el-descriptions-item label="步骤数">{{ routeInfo.stepCount }}道</el-descriptions-item>
              </el-descriptions>
            </div>
            <div v-else class="route-empty">
              <el-empty description="尚未绑定工艺路线" :image-size="80">
                <el-button type="primary" size="small" @click="handleRouteCheck" :icon="'Refresh'">检查路线可用性</el-button>
              </el-empty>
            </div>

            <!-- 检查结果展示 -->
            <div v-if="routeCheckResult" style="margin-top:12px">
              <el-alert
                :title="routeCheckResult.message"
                :type="routeCheckResult.pass ? 'success' : 'warning'"
                :closable="true"
                @close="routeCheckResult=null"
                show-icon
              />
              <div v-if="routeCheckResult.multiVersion && routeOptions.length>0" style="margin-top:12px">
                <span style="font-weight:bold;margin-bottom:8px;display:block">请选择工艺路线版本:</span>
                <el-radio-group v-model="selectedRouteId" style="display:flex;flex-direction:column;gap:8px">
                  <el-radio v-for="opt in routeOptions" :key="opt.id" :value="opt.id" style="margin-bottom:4px">
                    {{ opt.routeName }} ({{ opt.version }}) - {{ opt.statusDesc }}
                    <el-tag v-if="opt.isRecommended" type="success" size="small" style="margin-left:8px">推荐</el-tag>
                    <span style="margin-left:12px;color:#909399">{{ opt.stepCount }}道工序</span>
                  </el-radio>
                </el-radio-group>
                <el-button type="primary" size="small" style="margin-top:12px" @click="handleBindRoute" :disabled="!selectedRouteId" :icon="'Edit'">绑定此版本</el-button>
              </div>
            </div>
          </el-card>
        </el-tab-pane>

        <!-- ==================== TAB2: 工序流转卡 ==================== -->
        <el-tab-pane label="工序流转卡" name="flowCard">
          <div class="tab-toolbar">
            <el-button size="small" @click="loadFlowCards" :loading="flowCardLoading" :icon="'Refresh'">刷新</el-button>
            <el-button
              size="small"
              type="warning"
              @click="handleRegenerate"
              :disabled="hasFlowCards"
              :loading="regenerateLoading"
              :title="hasFlowCards ? '已有流转卡，无需重复初始化；如需按最新 ERP 剩余可汇报量重建，请使用强制重置并重建' : '仅在没有流转卡时使用，按 ERP 当前剩余可汇报量首次生成'"
            >
              首次初始化流转卡
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="handleForceRegenerate"
              :disabled="!hasFlowCards"
              :loading="regenerateLoading"
              title="删除可安全删除的本地流转卡，并按 ERP 当前剩余可汇报量立即重建；如存在 ERP 单据，后端会拒绝" :icon="'Delete'">
              强制重置并重建
            </el-button>
            <el-button size="small" type="primary" @click="handlePrintFlowCard" :disabled="flowCards.length===0" :icon="'Printer'">打印流转卡</el-button>
          </div>

          <el-table :data="sortedFlowCards" v-loading="flowCardLoading" border size="small" max-height="500">
            <el-table-column prop="stepNo" label="序号" width="60" resizable />
            <el-table-column label="工序名称" width="180" resizable>
              <template #default="{row}">
                <div class="flow-step-cell">
                  <el-popover
                    placement="right"
                    trigger="hover"
                    :width="220"
                    popper-class="flow-step-qrcode-popover"
                    @show="handleStepQrShow(row)"
                    @hide="handleStepQrHide(row)"
                  >
                    <template #reference>
                      <span class="flow-step-name">{{ row.stepName }}</span>
                    </template>
                    <div class="flow-step-qrcode">
                      <div class="flow-step-qrcode-title">工序二维码</div>
                      <img
                        v-if="isStepQrVisible(row)"
                        class="flow-step-qrcode-image"
                        :src="getFlowStepQrCodeUrl(row)"
                        :alt="`${row.stepName || '工序'}二维码`"
                      />
                      <div v-else class="flow-step-qrcode-empty">二维码待加载</div>
                      <div class="flow-step-qrcode-meta">
                        <span>{{ row.stepNo }}. {{ row.stepName || '-' }}</span>
                        <span>{{ row.processCode || row.orderNo || '-' }}</span>
                      </div>
                    </div>
                  </el-popover>
                  <el-tag v-if="row.stepType === 'INSPECTION'" type="warning" size="small">检验</el-tag>
                  <el-tag v-if="row.stepType === 'PRODUCTION'" type="primary" size="small">生产</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="processCode" label="工序代码" width="100" resizable />
            <el-table-column prop="inputQuantity" label="本批投入量" width="110" resizable>
              <template #default="{row}">
                {{ row.inputQuantity ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column label="工时" width="120" resizable>
              <template #default="{row}">
                {{ formatStandardHours(row) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110" resizable>
              <template #default="{row}">
                <el-tag :type="flowStatusType(row.flowStatus)" size="small">{{ flowStatusText(row.flowStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="批次" width="150" show-overflow-tooltip resizable>
              <template #default="{row}">
                <div class="flow-batch-cell">
                  <span>{{ row.batchCode || '-' }}</span>
                  <el-tag v-if="row.batchSeq" type="info" size="small">#{{ row.batchSeq }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="认领" width="190" show-overflow-tooltip resizable>
              <template #default="{row}">
                <div class="flow-claim-cell">
                  <el-tag :type="claimStatusType(row)" size="small">{{ claimStatusText(row) }}</el-tag>
                  <span v-if="row.claimOwnerName" class="claim-owner">{{ row.claimOwnerName }}</span>
                  <el-button
                    v-if="canReleaseClaim(row)"
                    size="small"
                    type="danger"
                    link
                    @click="handleReleaseClaim(row)"
                  >
                    释放
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="检验任务" width="180" resizable>
              <template #default="{row}">
                <div class="inspection-task-cell">
                  <el-tag v-if="row.inspectionTask" :type="inspectionTaskStatusType(row.inspectionTask.taskStatus)" size="small">
                    {{ inspectionTaskStatusText(row.inspectionTask.taskStatus) }}
                  </el-tag>
                  <span v-else>-</span>
                  <el-tag v-if="row.inspectionTask?.erpPushStatus" type="info" size="small">
                    {{ inspectionErpStatusText(row.inspectionTask.erpPushStatus) }}
                  </el-tag>
                  <el-tag
                    v-if="row.inspectionTask?.qualityDisposition"
                    :type="qualityDispositionType(row.inspectionTask.qualityDisposition)"
                    size="small"
                  >
                    {{ row.inspectionTask.qualityDispositionLabel || qualityDispositionText(row.inspectionTask.qualityDisposition) }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="actualQuantity" label="完成数" width="80" resizable />
            <el-table-column prop="defectQuantity" label="不良数" width="80" resizable />
            <el-table-column prop="operatorName" label="操作员" width="100" resizable />
            <el-table-column label="文档" width="70" fixed="right" resizable>
              <template #default="{row}">
                <el-button size="small" @click="showDocumentDrawer(row)" :icon="'View'">文档</el-button>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="380" fixed="right" resizable>
              <template #default="{row}">
                <div class="flow-action-cell">
                  <el-button size="small" type="primary" @click="handleStartStep(row)"
                    :disabled="!canStartFlow(row)" :icon="'Check'">开始</el-button>
                  <el-button size="small" type="success" @click="showCompleteDialog(row)"
                    :disabled="!canCompleteFlow(row)" :icon="'Check'">完成</el-button>
                  <el-button
                    v-if="canReconcileInspection(row)"
                    size="small"
                    type="warning"
                    link
                    @click="handleReconcileInspection(row)"
                  >
                    补建检验卡
                  </el-button>
                  <el-button size="small" v-role="['stepskiper', 'admin']" @click="handleSkipStep(row)"
                    :disabled="row.flowStatus!=='PENDING' || row.stepType==='INSPECTION'">跳过</el-button>
                  <el-button size="small" type="danger" @click="showExceptionDialog(row)" :icon="'Delete'">异常</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ==================== TAB3: 异常记录 ==================== -->
        <el-tab-pane label="异常记录" name="exception">
          <div class="tab-toolbar">
            <el-button size="small" @click="loadExceptions" :icon="'Refresh'">刷新</el-button>
          </div>
          <el-table :data="exceptions" v-loading="exceptionLoading" border size="small" max-height="500">
            <el-table-column prop="exceptionType" label="异常类型" width="100" resizable>
              <template #default="{row}">{{ getExceptionTypeDesc(row.exceptionType) }}</template>
            </el-table-column>
            <el-table-column prop="exceptionDesc" label="异常描述" min-width="200" show-overflow-tooltip resizable />
            <el-table-column prop="stepNo" label="工序" width="60" resizable />
            <el-table-column label="处理状态" width="110" resizable>
              <template #default="{row}">
                <el-tag :type="handlerStatusType(row.handlerStatus)" size="small">{{ getHandlerStatusDesc(row.handlerStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="handlerName" label="处理人" width="100" resizable />
            <el-table-column label="阻断" width="60" resizable>
              <template #default="{row}">
                <el-tag :type="row.isBlocking?'danger':'info'" size="small">{{ row.isBlocking?'是':'否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right" resizable>
              <template #default="{row}">
                <el-button size="small" @click="handleExceptionAction(row,'handle')" :disabled="row.handlerStatus!=='REPORTED'" :icon="'Check'">处理</el-button>
                <el-button size="small" type="success" @click="handleExceptionAction(row,'resolve')" :disabled="row.handlerStatus==='RESOLVED'||row.handlerStatus==='ESCALATED'" :icon="'Check'">解决</el-button>
                <el-button size="small" type="warning" @click="handleExceptionAction(row,'escalate')" :disabled="row.handlerStatus==='RESOLVED'||row.handlerStatus==='ESCALATED'">升级</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- ==================== TAB4: 生产用料清单 ==================== -->
        <el-tab-pane label="生产用料清单" name="material">
          <div class="tab-toolbar" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <el-button size="small" @click="loadMaterialList" :loading="materialLoading" :icon="'Refresh'">刷新用料清单</el-button>
              <el-button size="small" @click="refreshMaterialRequests" :loading="pickTaskLoading || returnTaskLoading || feedTaskLoading" :icon="'Refresh'">刷新申请状态</el-button>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <el-button size="small" type="primary" @click="openMaterialApplyDrawer('PICK')" :icon="'Check'">申请领料</el-button>
              <el-button size="small" type="warning" @click="openMaterialApplyDrawer('RETURN')">申请退料</el-button>
              <el-button size="small" type="success" @click="openMaterialApplyDrawer('FEED')">申请补料</el-button>
              <el-button size="small" @click="openMaterialRecords" :icon="'View'">申请记录</el-button>
            </div>
          </div>

          <el-table :data="materialList" v-loading="materialLoading" border size="small" max-height="560" empty-text="暂无生产用料清单数据">
            <el-table-column prop="materialCode" label="物料编码" width="140" resizable />
            <el-table-column prop="materialName" label="物料名称" min-width="170" show-overflow-tooltip resizable />
            <el-table-column prop="materialSpecification" label="规格型号" width="160" show-overflow-tooltip resizable />
            <el-table-column label="单位" width="60" align="center" resizable>
              <template #default="{row}">{{ getMaterialUnit(row) }}</template>
            </el-table-column>
            <el-table-column label="清单状态" width="100" align="center" resizable>
              <template #default="{row}">
                <el-tag :type="materialDocumentStatusType(row.documentStatus)" size="small">
                  {{ row.documentStatusText || row.documentStatus || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="办理锁" width="90" show-overflow-tooltip>
              <template #default="{row}">
                <el-tag v-if="isEntryLocked(row)" type="warning" size="small">{{ getEntryLockText(row) }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="应发数量" width="80" align="right" resizable>
              <template #default="{row}">{{ formatMaterialQty(row, row.mustQty) }}</template>
            </el-table-column>
            <el-table-column label="已领数量" width="80" align="right" prop="pickedQty" resizable />
            <el-table-column label="实领数量" width="100" align="right" prop="actualPickQty" resizable />
            <el-table-column label="在制数量" width="100" align="right" prop="wipQty" resizable />
            <el-table-column label="MES占用量" width="80" align="right">
              <template #default="{row}">{{ getPreparingQty(row) }}</template>
            </el-table-column>
            <el-table-column label="MES待退量" width="110" align="right">
              <template #default="{row}">{{ getReturningQty(row) }}</template>
            </el-table-column>
            <el-table-column label="MES待补量" width="110" align="right">
              <template #default="{row}">{{ getFeedingQty(row) }}</template>
            </el-table-column>
          </el-table>

          <el-drawer v-model="materialApplyDrawerVisible" :title="materialApplyDrawerTitle" size="82%" append-to-body @close="closeMaterialApplyDrawer">
            <div class="material-drawer-toolbar">
              <el-segmented v-model="materialApplyType" :options="materialApplyTypeOptions" size="small" />
              <el-button size="small" @click="loadMaterialList" :loading="materialLoading" :icon="'Refresh'">刷新用料清单</el-button>
              <el-tag
                v-if="materialApplyLockTokens.length > 0"
                type="warning"
                size="small"
                style="cursor:pointer"
                @click="closeMaterialApplyDrawer"
              >
                办理中 · 点击释放锁
              </el-tag>
            </div>

            <div v-if="materialApplyType === 'PICK'">
              <el-alert
                title="可申请量仅作参考，本次申领数量不在前端限制；应发数量可能为小数，实际发料可按仓库整数发料规则处理。"
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom:12px"
              />
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
                <el-input v-model="applyUserName" size="small" style="width:140px" placeholder="申请人" disabled />
                <el-segmented
                  v-model="pickPriorityType"
                  :options="[{ label: '普通', value: 'NORMAL' }, { label: '紧急', value: 'URGENT' }]"
                  size="small"
                />
              </div>
              <el-table :data="materialList" v-loading="materialLoading" border size="small" max-height="420" empty-text="暂无生产用料清单数据" @selection-change="handleMaterialSelectionChange">
                <el-table-column type="selection" width="48" />
                <el-table-column prop="materialCode" label="物料编码" width="140" resizable />
                <el-table-column prop="materialName" label="物料名称" min-width="150" show-overflow-tooltip resizable />
                <el-table-column prop="materialSpecification" label="规格型号" width="160" show-overflow-tooltip resizable />
                <el-table-column label="单位" width="60" align="center" resizable>
                  <template #default="{row}">{{ getMaterialUnit(row) }}</template>
                </el-table-column>
                <el-table-column label="应发数量" width="80" align="right" resizable>
                  <template #default="{row}">{{ formatMaterialQty(row, row.mustQty) }}</template>
                </el-table-column>
                <el-table-column label="已领数量" width="80" align="right" prop="pickedQty" resizable />
                <el-table-column label="MES占用量" width="80" align="right">
                  <template #default="{row}">{{ getPreparingQty(row) }}</template>
                </el-table-column>
                <el-table-column label="可申请量" width="80" align="right">
                  <template #default="{row}">{{ getAvailableApplyQty(row) }}</template>
                </el-table-column>
                <el-table-column label="本次申领数量" width="150">
                  <template #default="{row}">
                    <el-input-number
                      v-model="applyQtyMap[String(row.pbomEntryId)]"
                      :min="0"
                      size="small"
                      style="width:130px"
                      @blur="normalizeApplyQtyInput(row)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="现有库存候选" min-width="360">
                  <template #default="{row}">
                    <div class="inventory-candidate-cell">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap">
                        <el-button size="small" :loading="isInventoryCandidateLoading(row)" @click="loadInventoryCandidates(row, 'PICK')">查库存</el-button>
                        <span class="inventory-candidate-summary">{{ getSelectedInventoryCandidateSummary(row) }}</span>
                      </div>
                      <el-select
                        v-model="selectedInventoryCandidateKeyMap[materialEntryKey(row)]"
                        multiple
                        collapse-tags
                        collapse-tags-tooltip
                        clearable
                        filterable
                        size="small"
                        style="width:100%;margin-top:4px"
                        placeholder="选择仓库/批次/库位（可多选）"
                      >
                        <el-option
                          v-for="candidate in getInventoryCandidates(row)"
                          :key="inventoryCandidateKey(candidate)"
                          :label="formatInventoryCandidateLabel(candidate)"
                          :value="inventoryCandidateKey(candidate)"
                        />
                      </el-select>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div class="material-drawer-footer">
                <el-alert title="仓库备料与发料请在独立的备料任务池页面处理" type="warning" :closable="false" style="flex:1;margin-right:12px" />
                <el-button type="primary" size="small" :disabled="false" :loading="applyingPickRequest" @click="submitPickRequests" :icon="'Check'">提交领料申请</el-button>
              </div>
            </div>

            <div v-else-if="materialApplyType === 'RETURN'">
              <el-alert
                title="本次退料数量不得大于 在制材料数量 - MES待退数量，退料申请时仓库必填"
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom:12px"
              />
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
                <el-input v-model="returnApplyUserName" size="small" style="width:140px" placeholder="申请人" />
                <el-input v-model="returnWarehouseNumber" size="small" style="width:160px" placeholder="退料仓库编码" />
                <el-input v-model="returnWarehouseName" size="small" style="width:180px" placeholder="退料仓库名称" />
                <el-input v-model="returnBatchReasonNumber" size="small" style="width:140px" placeholder="批量退料原因编码" />
                <el-input v-model="returnBatchReasonText" size="small" style="width:180px" placeholder="批量退料原因" />
                <el-button
                  size="small"
                  :disabled="!returnBatchReasonText.trim() && !returnBatchReasonNumber.trim()"
                  @click="applyReturnReasonToAllRows"
                >
                  填充到所有行
                </el-button>
                <span style="color:var(--el-text-color-secondary);font-size:12px">
                  退料原因按行独立记录，不同物料退料原因通常不同
                </span>
              </div>
              <el-table :data="materialList" v-loading="materialLoading" border size="small" max-height="420" empty-text="暂无生产用料清单数据" @selection-change="handleReturnMaterialSelectionChange">
                <el-table-column type="selection" width="48" />
                <el-table-column prop="materialCode" label="物料编码" width="140" />
                <el-table-column prop="materialName" label="物料名称" min-width="150" show-overflow-tooltip />
                <el-table-column prop="materialSpecification" label="规格型号" width="160" show-overflow-tooltip />
                <el-table-column label="已领数量" width="100" align="right" prop="pickedQty" />
                <el-table-column label="实领数量" width="100" align="right" prop="actualPickQty" />
                <el-table-column label="在制数量" width="100" align="right" prop="wipQty" />
                <el-table-column label="MES待退量" width="100" align="right">
                  <template #default="{row}">{{ getReturningQty(row) }}</template>
                </el-table-column>
                <el-table-column label="最大可退量" width="110" align="right">
                  <template #default="{row}">{{ getAvailableReturnQty(row) }}</template>
                </el-table-column>
                <el-table-column label="退料原因编码" width="130">
                  <template #default="{row}">
                    <el-input
                      v-model="returnReasonNumberMap[String(row.pbomEntryId)]"
                      size="small"
                      placeholder="选填"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="退料原因" min-width="200">
                  <template #default="{row}">
                    <el-input
                      v-model="returnReasonTextMap[String(row.pbomEntryId)]"
                      size="small"
                      maxlength="500"
                      placeholder="必填"
                    />
                    <div
                      v-if="returnRowReasonMissing(row)"
                      style="color:var(--el-color-danger);font-size:12px;line-height:18px;margin-top:2px"
                    >
                      该行退料原因不能为空
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="来源条码A" width="160">
                  <template #default="{row}">
                    <el-input v-model="returnSourceQrMap[String(row.pbomEntryId)]" size="small" placeholder="来源条码A" />
                  </template>
                </el-table-column>
                <el-table-column label="本次退料量" width="150">
                  <template #default="{row}">
                    <el-input-number v-model="returnQtyMap[String(row.pbomEntryId)]" :min="0" :max="Number(getAvailableReturnQty(row) || 0)" size="small" style="width:130px" />
                  </template>
                </el-table-column>
                <el-table-column label="现有库存候选" min-width="360">
                  <template #default="{row}">
                    <div class="inventory-candidate-cell">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap">
                        <el-button size="small" :loading="isInventoryCandidateLoading(row)" @click="loadInventoryCandidates(row, 'RETURN')">查库存</el-button>
                        <span class="inventory-candidate-summary">{{ getSelectedInventoryCandidateSummary(row) }}</span>
                      </div>
                      <el-select
                        v-model="selectedInventoryCandidateKeyMap[materialEntryKey(row)]"
                        multiple
                        collapse-tags
                        collapse-tags-tooltip
                        clearable
                        filterable
                        size="small"
                        style="width:100%;margin-top:4px"
                        placeholder="选择仓库/批次/库位（可多选）"
                        @change="handleInventoryCandidateSelected(row)"
                      >
                        <el-option
                          v-for="candidate in getInventoryCandidates(row)"
                          :key="inventoryCandidateKey(candidate)"
                          :label="formatInventoryCandidateLabel(candidate)"
                          :value="inventoryCandidateKey(candidate)"
                        />
                      </el-select>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div class="material-drawer-footer">
                <el-alert title="仓库只处理退料处理池，MES 此处只发起申请与查看审批/检验状态" type="warning" :closable="false" style="flex:1;margin-right:12px" />
                <el-button type="primary" size="small" :disabled="selectedReturnRows.length===0" :loading="applyingReturnRequest" @click="submitReturnRequests" :icon="'Check'">提交退料申请</el-button>
              </div>
            </div>

            <div v-else>
              <el-alert
                title="生产补料允许超过应发剩余数量，但必须填写补料原因；同一用料分录会按办理锁串行处理。"
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom:12px"
              />
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
                <el-input v-model="feedApplyUserName" size="small" style="width:140px" placeholder="申请人" />
                <el-input
                  v-model="feedBatchReasonText"
                  size="small"
                  maxlength="500"
                  style="width:260px"
                  placeholder="批量填充补料原因（可选）"
                />
                <el-button size="small" :disabled="!feedBatchReasonText.trim()" @click="applyFeedReasonToAllRows">
                  填充到所有行
                </el-button>
                <span style="color:var(--el-text-color-secondary);font-size:12px">
                  补料原因按行独立填写，不同物料补料原因通常不同
                </span>
              </div>
              <el-table :data="materialList" v-loading="materialLoading" border size="small" max-height="420" empty-text="暂无生产用料清单数据" @selection-change="handleFeedMaterialSelectionChange">
                <el-table-column type="selection" width="48" />
                <el-table-column prop="materialCode" label="物料编码" width="140" />
                <el-table-column prop="materialName" label="物料名称" min-width="150" show-overflow-tooltip />
                <el-table-column prop="materialSpecification" label="规格型号" width="160" show-overflow-tooltip />
                <el-table-column label="办理锁" width="150" show-overflow-tooltip>
                  <template #default="{row}">
                    <el-tag v-if="isEntryLocked(row)" type="warning" size="small">{{ getEntryLockText(row) }}</el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column label="应发数量" width="100" align="right" prop="mustQty" />
                <el-table-column label="已领数量" width="100" align="right" prop="pickedQty" />
                <el-table-column label="MES待补量" width="100" align="right">
                  <template #default="{row}">{{ getFeedingQty(row) }}</template>
                </el-table-column>
                <el-table-column label="本次补料量" width="150">
                  <template #default="{row}">
                    <el-input-number v-model="feedQtyMap[String(row.pbomEntryId)]" :min="0" size="small" style="width:130px" />
                  </template>
                </el-table-column>
                <el-table-column label="补料原因编码" width="130">
                  <template #default="{row}">
                    <el-input
                      v-model="feedReasonNumberMap[String(row.pbomEntryId)]"
                      size="small"
                      placeholder="选填"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="补料原因" min-width="200">
                  <template #default="{row}">
                    <el-input
                      v-model="feedReasonTextMap[String(row.pbomEntryId)]"
                      size="small"
                      maxlength="500"
                      :placeholder="Number(feedQtyMap[String(row.pbomEntryId)] || 0) > 0 ? '必填' : '填数量后必填'"
                    />
                    <div
                      v-if="feedRowReasonMissing(row)"
                      style="color:var(--el-color-danger);font-size:12px;line-height:18px;margin-top:2px"
                    >
                      该行补料原因不能为空
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="现有库存候选" min-width="360">
                  <template #default="{row}">
                    <div class="inventory-candidate-cell">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap">
                        <el-button size="small" :loading="isInventoryCandidateLoading(row)" @click="loadInventoryCandidates(row, 'FEED')">查库存</el-button>
                        <span class="inventory-candidate-summary">{{ getSelectedInventoryCandidateSummary(row) }}</span>
                      </div>
                      <el-select
                        v-model="selectedInventoryCandidateKeyMap[materialEntryKey(row)]"
                        multiple
                        collapse-tags
                        collapse-tags-tooltip
                        clearable
                        filterable
                        size="small"
                        style="width:100%;margin-top:4px"
                        placeholder="选择仓库/批次/库位（可多选）"
                      >
                        <el-option
                          v-for="candidate in getInventoryCandidates(row)"
                          :key="inventoryCandidateKey(candidate)"
                          :label="formatInventoryCandidateLabel(candidate)"
                          :value="inventoryCandidateKey(candidate)"
                        />
                      </el-select>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div class="material-drawer-footer">
                <el-alert title="仓库在补料任务池中备料、预览 PRD_FeedMtrl 草稿、提交 ERP。" type="warning" :closable="false" style="flex:1;margin-right:12px" />
                <el-button type="primary" size="small" :disabled="false" :loading="applyingFeedRequest" @click="submitFeedRequests" :icon="'Check'">提交补料申请</el-button>
              </div>
            </div>
          </el-drawer>

          <el-dialog v-model="overflowDialogVisible" title="超出可申请量处理" width="1040px" append-to-body>
            <el-alert
              title="以下物料本次申领数量超过允许领料数量。勾选后，系统会把超出数量自动生成补料申请；ERP 单据仍拆分为领料单和补料单。"
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom:12px"
            />
            <el-checkbox v-model="overflowAutoCreateFeed" style="margin-bottom:12px">
              超出数量直接生成补料申请
            </el-checkbox>
            <div v-if="overflowAutoCreateFeed" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
              <el-input
                v-model="overflowBatchReasonText"
                size="small"
                maxlength="200"
                style="width:300px"
                placeholder="批量填充补料原因（可选，用于一次写入所有行）"
              />
              <el-button size="small" :disabled="!overflowBatchReasonText.trim()" @click="applyOverflowReasonToAllRows">
                填充到所有行
              </el-button>
              <span style="color:var(--el-text-color-secondary);font-size:12px">
                补料原因按行独立记录，不同物料超领原因通常不同
              </span>
            </div>
            <el-table :data="overflowApplyRows" border size="small" max-height="360">
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="materialName" label="物料名称" min-width="120" show-overflow-tooltip />
              <el-table-column prop="baseUnitNumber" label="单位" width="64" align="center" />
              <el-table-column prop="normalizedRequestQty" label="申领数量" width="90" align="right" />
              <el-table-column prop="allowedPickQty" label="允许领料" width="90" align="right" />
              <el-table-column prop="feedQty" label="将补料" width="86" align="right" />
              <el-table-column label="损耗率" width="80" align="right">
                <template #default="{row}">{{ row.consumVolatility || 0 }}%</template>
              </el-table-column>
              <el-table-column label="补料原因编码" width="130">
                <template #default="{row}">
                  <el-input
                    v-model="overflowReasonNumberMap[String(row.pbomEntryId)]"
                    size="small"
                    :disabled="!overflowAutoCreateFeed"
                    placeholder="选填"
                  />
                </template>
              </el-table-column>
              <el-table-column label="补料原因" min-width="210">
                <template #default="{row}">
                  <el-input
                    v-model="overflowReasonTextMap[String(row.pbomEntryId)]"
                    size="small"
                    maxlength="200"
                    :disabled="!overflowAutoCreateFeed"
                    :placeholder="overflowAutoCreateFeed ? '必填' : '勾选后填写'"
                  />
                  <div
                    v-if="overflowRowReasonMissing(row)"
                    style="color:var(--el-color-danger);font-size:12px;line-height:18px;margin-top:2px"
                  >
                    该行补料原因不能为空
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <template #footer>
              <el-button @click="overflowDialogVisible=false">取消</el-button>
              <el-button type="primary" :disabled="!overflowConfirmEnabled" :loading="applyingPickRequest" @click="confirmOverflowPickApply">
                确认提交
              </el-button>
            </template>
          </el-dialog>

          <el-drawer v-model="materialRecordDrawerVisible" title="当前工单申请记录" size="86%" append-to-body>
            <div class="material-drawer-toolbar">
              <el-segmented v-model="materialRecordTypeFilter" :options="materialRecordTypeOptions" size="small" />
              <el-button size="small" @click="refreshMaterialRequests" :loading="pickTaskLoading || returnTaskLoading || feedTaskLoading" :icon="'Refresh'">刷新记录</el-button>
            </div>
            <el-table :data="filteredMaterialRequestRecords" v-loading="pickTaskLoading || returnTaskLoading || feedTaskLoading" border size="small" max-height="560" empty-text="暂无申请记录">
              <el-table-column label="申请类型" width="90" align="center">
                <template #default="{row}">
                  <el-tag :type="materialRecordTypeTag(row.type)" size="small">{{ row.typeText }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="materialCode" label="物料编码" width="120" />
              <el-table-column prop="materialName" label="物料名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="requestQty" label="申请数量" width="100" align="right" />
              <el-table-column prop="handledQty" label="办理数量" width="100" align="right" />
              <el-table-column label="状态" width="110">
                <template #default="{row}">
                  <el-tag :type="row.statusType" size="small">{{ row.statusText }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="erpBillNo" label="ERP单号" width="130" show-overflow-tooltip />
              <el-table-column prop="businessInfo" label="业务信息" min-width="180" show-overflow-tooltip />
              <el-table-column prop="failReason" label="失败信息" min-width="160" show-overflow-tooltip />
              <el-table-column label="申请时间" min-width="140">
                <template #default="{row}">
                  {{ formatTime(row.createTime) }}
                </template>
              </el-table-column>
            </el-table>
          </el-drawer>
        </el-tab-pane>

        <!-- ==================== TAB5: 工资核算 ==================== -->
        <el-tab-pane label="工资核算" name="wage">
          <div class="tab-toolbar" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <el-button size="small" @click="loadWageSettlements" :loading="wageLoading" :icon="'Refresh'">刷新</el-button>
              <el-button size="small" type="primary" @click="exportCurrentOrderWage" :disabled="!orderId" :icon="'Download'">导出</el-button>
            </div>
            <strong>合计工资：{{ formatMoney(wageTotalAmount) }}</strong>
          </div>
          <el-table :data="wageSettlements" v-loading="wageLoading" border size="small" max-height="500" empty-text="暂无工资核算结果">
            <el-table-column prop="stepNo" label="序号" width="60" />
            <el-table-column prop="stepName" label="工序名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="processCode" label="工序代码" width="100" />
            <el-table-column prop="operatorName" label="操作员" width="100" />
            <el-table-column prop="actualQuantity" label="完成数" width="80" align="right" />
            <el-table-column prop="defectQuantity" label="不良数" width="80" align="right" />
            <el-table-column prop="goodQuantity" label="良品数" width="80" align="right" />
            <el-table-column label="计价方式" width="90" align="center">
              <template #default="{row}">{{ getPriceTypeText(row.priceType) }}</template>
            </el-table-column>
            <el-table-column label="工资金额" width="110" align="right">
              <template #default="{row}"><strong>{{ formatMoney(row.wageAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="状态" width="120" align="center">
              <template #default="{row}">
                <el-tooltip v-if="row.failureReason || row.rejectReason" :content="row.failureReason || row.rejectReason" placement="top">
                  <el-tag :type="getWageStatusType(row.calcStatus)" size="small">{{ getWageStatusText(row.calcStatus) }}</el-tag>
                </el-tooltip>
                <el-tag v-else :type="getWageStatusType(row.calcStatus)" size="small">{{ getWageStatusText(row.calcStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="erpReportBillNo" label="ERP汇报单" width="140" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <!-- ==================== TAB6: 二维码 ==================== -->
        <el-tab-pane label="二维码" name="qrcode">
          <div class="qrcode-panel">
            <el-card class="qrcode-card">
              <template #header><span>工单二维码</span></template>
              <img v-if="qrCodeUrl" class="qrcode-image" :src="qrCodeUrl" alt="工单二维码" />
              <div v-else class="qrcode-empty">加载二维码中...</div>
              <div class="qrcode-actions">
                <el-button size="small" @click="refreshQrCode" :icon="'Refresh'">刷新二维码</el-button>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 完成工序对话框 -->
    <el-dialog v-model="completeDialogVisible" title="工序报工" width="620px" class="complete-report-dialog">
      <div v-if="currentStep" class="report-summary">
        <div>
          <div class="report-step-name">{{ currentStep.stepName }}</div>
          <div class="report-step-meta">
            <span>工序代码：{{ currentStep.processCode || '-' }}</span>
            <span>标准工时：{{ formatStandardHours(currentStep) }}</span>
            <span>本批认领数量：{{ currentStep.inputQuantity ?? 0 }}</span>
          </div>
        </div>
        <el-tag :type="flowStatusType(currentStep.flowStatus)" size="small">{{ flowStatusText(currentStep.flowStatus) }}</el-tag>
      </div>
      <el-form :model="completeForm" label-width="96px" size="small" class="report-form">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="完成数量" required>
              <el-input-number v-model="completeForm.actualQuantity" :min="0" :precision="0" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="不良数量" required>
              <el-input-number v-model="completeForm.defectQuantity" :min="0" :max="completeForm.actualQuantity" :precision="0" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="良品数量">
              <el-input-number :model-value="completeGoodQuantity" disabled controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="实际工时" required>
              <div class="actual-time-inputs">
                <el-input-number v-model="completeForm.actualHoursPart" :min="0" :precision="0" controls-position="right" />
                <span>时</span>
                <el-input-number v-model="completeForm.actualMinutesPart" :min="0" :max="59" :precision="0" controls-position="right" />
                <span>分</span>
                <el-input-number v-model="completeForm.actualSecondsPart" :min="0" :max="59" :precision="0" controls-position="right" />
                <span>秒</span>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作员" required>
              <el-input v-model="completeForm.operatorName" placeholder="默认当前登录用户" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="currentStep?.stepType === 'INSPECTION' && completeForm.defectQuantity > 0" label="不良处置" required>
          <el-radio-group v-model="completeForm.reworkRequired">
            <el-radio :value="true">返修</el-radio>
            <el-radio :value="false">不返修（报废）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert
          :title="`完成数量用于模具模次计算；良品数 ${completeGoodQuantity} 用于计件工资核算；不良数不能大于完成数。`"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom:12px"
        />
        <el-form-item label="备注">
          <el-input v-model="completeForm.remark" type="textarea" :rows="3" placeholder="可填写异常说明、换模、补充报工依据等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="confirmComplete" :loading="completing" :icon="'Check'">确认报工</el-button>
      </template>
    </el-dialog>

    <!-- 异常上报对话框 -->
    <el-dialog v-model="exceptionDialogVisible" title="异常上报" width="450px">
      <el-form :model="exceptionForm" label-width="100px" size="small">
        <el-form-item label="异常类型">
          <el-select v-model="exceptionForm.exceptionType" style="width:100%">
            <el-option label="设备故障" value="EQUIPMENT" />
            <el-option label="模具异常" value="MOULD" />
            <el-option label="量具异常" value="GAUGE" />
            <el-option label="质量异常" value="QUALITY" />
            <el-option label="工单异常" value="ORDER" />
            <el-option label="其他异常" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常描述"><el-input v-model="exceptionForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="阻断生产"><el-switch v-model="exceptionForm.isBlocking" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exceptionDialogVisible=false">取消</el-button>
        <el-button type="danger" @click="confirmException" :loading="reportingException" :icon="'Check'">确认上报</el-button>
      </template>
    </el-dialog>

    <!-- 文档预览抽屉 -->
    <el-drawer v-model="documentDrawerVisible" :title="'文档 - ' + (documentStep?.stepName || '')" :size="drawerSize" @close="handleDocumentDrawerClose">
      <div v-loading="documentLoading">
        <div v-if="stepDocuments.length === 0 && !documentLoading" style="text-align:center;padding:40px;color:#909399">
          暂无工序文档
        </div>
        <div v-for="doc in stepDocuments" :key="doc.id" class="document-item">
          <div class="document-info">
            <div class="document-name">
              <el-icon style="margin-right:8px">
                <Document />
              </el-icon>
              <span>{{ doc.docName || doc.originalFilename }}</span>
              <el-tag size="small" style="margin-left:8px">{{ doc.fileExt?.toUpperCase() }}</el-tag>
            </div>
            <div class="document-meta">
              <span>{{ formatDocumentType(doc.docType) }}</span>
              <span style="margin:0 8px">|</span>
              <span>{{ formatFileSize(doc.fileSize) }}</span>
              <span v-if="doc.createdByName" style="margin:0 8px">|</span>
              <span v-if="doc.createdByName">{{ doc.createdByName }}</span>
              <span v-if="doc.createTime" style="margin:0 8px">|</span>
              <span v-if="doc.createTime">{{ formatTime(doc.createTime) }}</span>
            </div>
          </div>
          <div class="document-actions">
            <el-button size="small" type="primary" @click="previewDocument(doc)" :icon="'View'">预览</el-button>
            <el-button size="small" @click="downloadDocument(doc)" :icon="'Download'">下载</el-button>
          </div>
        </div>

        <!-- 文档预览区域 -->
        <div v-if="previewDoc" class="document-preview-area">
          <el-divider />
          <div class="preview-header">
            <span style="font-weight:bold">{{ previewDoc.originalFilename }}</span>
            <el-button size="small" @click="closePreview()" style="float:right">关闭预览</el-button>
          </div>
          <div class="preview-content">
            <!-- PDF预览 -->
            <iframe v-if="isPdfFile(previewDoc.fileExt)" :src="getDocumentPreviewUrl(previewDoc.filePath)" style="width:100%;height:500px;border:1px solid #e0e0e0;border-radius:4px" />
            <!-- 图片预览 -->
            <img v-else-if="isImageFile(previewDoc.fileExt)" :src="getDocumentPreviewUrl(previewDoc.filePath)" style="max-width:100%;max-height:500px;object-fit:contain" />
            <!-- Office文档：OnlyOffice预览 -->
            <div v-else-if="isOfficeFile(previewDoc.fileExt) && onlyOfficeEnabled" class="onlyoffice-wrapper">
              <div id="onlyoffice-container" class="onlyoffice-container"></div>
            </div>
            <!-- 其他文档类型 -->
            <div v-else class="office-preview-hint">
              <p style="margin-top:12px">该文档类型暂不支持在线预览，请下载查看</p>
              <el-button type="primary" @click="downloadDocument(previewDoc)" :icon="'Download'">下载查看</el-button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@vben/stores'
import { resolveStatus } from '#/shared/status/statusDictionary'
import {
  checkRouteAvailability, dispatchOrder, bindRoute, getFlowCards,
  startStepByFlowId, completeStepByFlowId, skipStep, regenerateFlowCards,
  forceRegenerateFlowCards,
  claimAndStartFlowCard, reconcileMissingInspectionFlow, heartbeatFlowCard, releaseFlowCard,
  getOrderExceptions, reportException, handleException, resolveException, escalateException,
  getOrderQrCodeUrl, ensureLocalOrder, getOrderSteps,
  queryMaterialList, getStepDocuments, getDocumentFileDownloadUrl,
  getOnlyOfficeConfig,
  applyPickWithOverfeed, getPickRequests, applyReturnRequest, getReturnRequests,
  applyFeedRequest, getFeedRequests, getMaterialEntryLocks,
  acquireMaterialEntryLock, releaseMaterialEntryLock, heartbeatMaterialEntryLock,
  type FlowCardItem, type RouteOption, type ExceptionItem, type MaterialListItem, type ProcessStepDocumentItem, type PickTaskItem, type ReturnTaskItem, type FeedTaskItem, type MaterialEntryLockItem
} from '@/api/production'
import { getStepQrCodeUrl } from '@/api/production-qrcode'
import { getOrderWageExportUrl, getOrderWageSettlements, type ProcessWageSettlement } from '@/api/processWage'
import { queryInventoryAvailableByBasis } from '#/api/inventory'
import { getMaterialRequestPolicyConfig, type InventoryAvailabilityRow } from '#/api/config'
import { openDocumentPreview } from '#/utils/documentPreview'
import { inventoryAvailabilityToSubmitFields, inventoryAvailabilityToWarehouse } from '../system/config/inventory-summary-basis-model'
import { formatFlowActionError } from './flow-error'
import {
  DEFAULT_INTEGER_UNIT_NUMBERS,
  DEFAULT_ONE_DECIMAL_UNIT_NUMBERS,
  buildApplySplit,
  getAllowedPickQty,
  normalizeQtyByUnit,
} from './order-detail-material-apply-model'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const orderNo = String(route.params.id)
const orderId = ref<number | null>(null)  // 从 ensureLocalOrder 获取
const moEntrySeq = ref(1)
const prdOrgId = ref('')
const prdOrgNumber = ref('')
const workshopNumber = ref('')
const erpAcctCode = ref(String(route.query.erpAcctCode || route.query.acctCode || ''))

function showFlowActionError(actionLabel: string, error: unknown, fallback: string) {
  ElMessage.error(formatFlowActionError(actionLabel, error, fallback))
}

// ==================== 状态 ====================
const loading = ref(true)
const activeTab = ref('basic')

async function handleTabChange(name: string) {
  if (name === 'material') {
    await loadMaterialList()
  }
}

const orderInfo = ref<any>(null)
const routeInfo = ref<any>(null)

// 路线绑定
const routeCheckLoading = ref(false)
const dispatchLoading = ref(false)
const routeCheckResult = ref<any>(null)
const routeOptions = ref<RouteOption[]>([])
const selectedRouteId = ref<number | null>(null)

// 流转卡
const flowCards = ref<FlowCardItem[]>([])
const flowCardLoading = ref(false)
const regenerateLoading = ref(false)
const flowHeartbeatTimers = new Map<number, number>()
const FLOW_HEARTBEAT_INTERVAL_MS = 60 * 1000
const visibleStepQrKey = ref('')
const stepQrVersionMap = ref<Record<string, number>>({})

// 完成工序
const completeDialogVisible = ref(false)
const completing = ref(false)
const currentStep = ref<FlowCardItem | null>(null)
const completeForm = reactive({
  actualHours: 0,
  actualHoursPart: 0,
  actualMinutesPart: 0,
  actualQuantity: 0,
  actualSecondsPart: 0,
  defectQuantity: 0,
  reworkRequired: undefined as boolean | undefined,
  operatorId: undefined as number | undefined,
  operatorName: '',
  remark: '',
})

// 异常
const exceptions = ref<ExceptionItem[]>([])
const exceptionLoading = ref(false)
const exceptionDialogVisible = ref(false)
const reportingException = ref(false)
const exceptionForm = reactive({ exceptionType: 'EQUIPMENT', description: '', isBlocking: false })
const exceptionStepNo = ref<number | null>(null)

// 生产用料清单
const materialList = ref<MaterialListItem[]>([])
const materialLoading = ref(false)
const wageSettlements = ref<ProcessWageSettlement[]>([])
const wageLoading = ref(false)
const wageTotalAmount = ref(0)
const pickTasks = ref<PickTaskItem[]>([])
const pickTaskLoading = ref(false)
const selectedMaterialRows = ref<MaterialListItem[]>([])
const applyQtyMap = reactive<Record<string, number>>({})
const applyingPickRequest = ref(false)
const applyUserName = ref('')
const defaultPriorityLevel = ref(0)
const pickPriorityType = ref<'NORMAL' | 'URGENT'>('NORMAL')
const integerUnitNumbers = ref(DEFAULT_INTEGER_UNIT_NUMBERS)
const oneDecimalUnitNumbers = ref(DEFAULT_ONE_DECIMAL_UNIT_NUMBERS)
const overflowDialogVisible = ref(false)
const overflowAutoCreateFeed = ref(false)
const overflowApplyRows = ref<any[]>([])
/** 补料原因按行独立记录，key 为 pbomEntryId：不同物料超领的原因通常不同。 */
const overflowReasonNumberMap = reactive<Record<string, string>>({})
const overflowReasonTextMap = reactive<Record<string, string>>({})
const overflowReasonTouched = ref(false)
/** 批量填充用的临时输入，本身不参与提交。 */
const overflowBatchReasonText = ref('')
const pendingPickApplyPayload = ref<any>(null)
/** 该行勾选自动补料但未填原因：只在用户交互过后展示，避免刚打开弹窗就一片红。 */
function overflowRowReasonMissing(row: any) {
  return (
    overflowAutoCreateFeed.value &&
    overflowReasonTouched.value &&
    !(overflowReasonTextMap[String(row.pbomEntryId)] || '').trim()
  )
}
/**
 * 重开弹窗时重置各行原因。
 * <p>reactive 对象不能整体替换，必须逐 key 删除，否则上一次申请的原因会残留在
 * 本次同 pbomEntryId 的行上，造成"没填却能提交"。</p>
 */
function resetOverflowReasonInputs(rows: any[]) {
  for (const key of Object.keys(overflowReasonTextMap)) {
    delete overflowReasonTextMap[key]
  }
  for (const key of Object.keys(overflowReasonNumberMap)) {
    delete overflowReasonNumberMap[key]
  }
  for (const row of rows) {
    overflowReasonTextMap[String(row.pbomEntryId)] = ''
    overflowReasonNumberMap[String(row.pbomEntryId)] = ''
  }
  overflowBatchReasonText.value = ''
  overflowReasonTouched.value = false
}
/** 多行超领原因相同时，避免逐行重复输入。 */
function applyOverflowReasonToAllRows() {
  const text = overflowBatchReasonText.value.trim()
  if (!text) return
  for (const row of overflowApplyRows.value) {
    overflowReasonTextMap[String(row.pbomEntryId)] = text
  }
}
/** 每一个超出行都必须有原因，缺一行就不放行提交。 */
const overflowConfirmEnabled = computed(
  () =>
    overflowAutoCreateFeed.value &&
    overflowApplyRows.value.length > 0 &&
    overflowApplyRows.value.every((row) =>
      Boolean((overflowReasonTextMap[String(row.pbomEntryId)] || '').trim()),
    ),
)
const returnTasks = ref<ReturnTaskItem[]>([])
const returnTaskLoading = ref(false)
const selectedReturnRows = ref<MaterialListItem[]>([])
const returnQtyMap = reactive<Record<string, number>>({})
const returnSourceQrMap = reactive<Record<string, string>>({})
const applyingReturnRequest = ref(false)
const returnApplyUserName = ref('')
const returnWarehouseNumber = ref('')
const returnWarehouseName = ref('')
/** 表头输入只作为「填充到所有行」的批量来源，不直接参与提交。 */
const returnBatchReasonNumber = ref('')
const returnBatchReasonText = ref('')
/** 退料原因按行独立记录，key 为 pbomEntryId：每个料的退料原因通常不同。 */
const returnReasonNumberMap = reactive<Record<string, string>>({})
const returnReasonTextMap = reactive<Record<string, string>>({})
function applyReturnReasonToAllRows() {
  const text = returnBatchReasonText.value.trim()
  const number = returnBatchReasonNumber.value.trim()
  if (!text && !number) return
  for (const row of materialList.value) {
    const key = String(row.pbomEntryId)
    if (text) returnReasonTextMap[key] = text
    if (number) returnReasonNumberMap[key] = number
  }
}
/** 只对已勾选的行要求原因：未参与提交的行留空是正常的。 */
function returnRowReasonMissing(row: MaterialListItem) {
  const key = String(row.pbomEntryId)
  if (!selectedReturnRows.value.some((item) => String(item.pbomEntryId) === key)) return false
  return Number(returnQtyMap[key] || 0) > 0 && !(returnReasonTextMap[key] || '').trim()
}
const feedTasks = ref<FeedTaskItem[]>([])
const feedTaskLoading = ref(false)
const selectedFeedRows = ref<MaterialListItem[]>([])
const feedQtyMap = reactive<Record<string, number>>({})
const applyingFeedRequest = ref(false)
const feedApplyUserName = ref('')
/** 表头输入只作为「填充到所有行」的批量来源，不直接参与提交。 */
const feedBatchReasonText = ref('')
/** 补料原因按行独立记录，key 为 pbomEntryId：每个料的补料原因通常不同。 */
const feedReasonNumberMap = reactive<Record<string, string>>({})
const feedReasonTextMap = reactive<Record<string, string>>({})
function applyFeedReasonToAllRows() {
  const text = feedBatchReasonText.value.trim()
  if (!text) return
  for (const row of materialList.value) {
    feedReasonTextMap[String(row.pbomEntryId)] = text
  }
}
/** 只对「本次补料量 > 0」的行要求原因：未参与提交的行留空是正常的。 */
function feedRowReasonMissing(row: MaterialListItem) {
  const key = String(row.pbomEntryId)
  return Number(feedQtyMap[key] || 0) > 0 && !(feedReasonTextMap[key] || '').trim()
}
const materialEntryLocks = ref<MaterialEntryLockItem[]>([])
const inventoryCandidateMap = reactive<Record<string, InventoryAvailabilityRow[]>>({})
const inventoryCandidateLoadingMap = reactive<Record<string, boolean>>({})
const selectedInventoryCandidateKeyMap = reactive<Record<string, string[]>>({})
type MaterialApplyType = 'PICK' | 'RETURN' | 'FEED'
type MaterialRecordType = 'ALL' | MaterialApplyType

const materialApplyDrawerVisible = ref(false)
// 当前持有的办理锁 token 列表（一次可能锁多行 pbomEntry）
const materialApplyLockTokens = ref<string[]>([])
let materialApplyHeartbeatTimer: ReturnType<typeof setInterval> | null = null
const materialRecordDrawerVisible = ref(false)
const materialApplyType = ref<MaterialApplyType>('PICK')
const materialRecordTypeFilter = ref<MaterialRecordType>('ALL')
const materialApplyTypeOptions = [
  { label: '领料申请', value: 'PICK' },
  { label: '退料申请', value: 'RETURN' },
  { label: '补料申请', value: 'FEED' },
]
const materialRecordTypeOptions = [
  { label: '全部', value: 'ALL' },
  { label: '领料', value: 'PICK' },
  { label: '退料', value: 'RETURN' },
  { label: '补料', value: 'FEED' },
]

// 二维码
const qrCodeUrl = ref('')

// 文档预览
const documentDrawerVisible = ref(false)
const documentLoading = ref(false)
const documentStep = ref<FlowCardItem | null>(null)
const stepDocuments = ref<ProcessStepDocumentItem[]>([])
const previewDoc = ref<ProcessStepDocumentItem | null>(null)

// OnlyOffice 预览
const drawerSize = ref(window.innerWidth < 768 ? '100%' : '80%')
const onlyOfficeEnabled = ref(false)
const onlyOfficeDocumentServerUrl = ref('')
const onlyOfficeJwtEnabled = ref(false)
const onlyOfficeScriptLoaded = ref(false)
const onlyOfficeEditor = ref<any>(null)

const canDispatch = computed(() => {
  if (!orderInfo.value) return false
  return !routeInfo.value && orderInfo.value.businessStatus !== 'DISPATCHED'
})

/** 排序后的流转卡：生产工序在前，检验工序在后 */
const currentOperator = computed(() => {
  const info: any = userStore.userInfo || {}
  return {
    operatorId: info.userId ? Number(info.userId) : undefined,
    operatorName: info.realName || info.username || '',
  }
})

const completeGoodQuantity = computed(() => Math.max(0, Number(completeForm.actualQuantity || 0) - Number(completeForm.defectQuantity || 0)))

const completeActualWorkSeconds = computed(() => {
  const hours = Math.max(0, Number(completeForm.actualHoursPart || 0))
  const minutes = Math.max(0, Number(completeForm.actualMinutesPart || 0))
  const seconds = Math.max(0, Number(completeForm.actualSecondsPart || 0))
  return (hours * 3600) + (minutes * 60) + seconds
})

const sortedFlowCards = computed(() => {
  return [...flowCards.value].sort((a, b) => {
    if (a.stepNo !== b.stepNo) return a.stepNo - b.stepNo
    // 同一序号：PRODUCTION 排在 INSPECTION 前面
    if (a.stepType !== b.stepType) {
      return a.stepType === 'PRODUCTION' ? -1 : 1
    }
    return 0
  })
})

const hasFlowCards = computed(() => flowCards.value.length > 0)

function flowStepQrKey(row: FlowCardItem): string {
  return `${orderId.value || 0}:${row.stepNo || 0}:${row.id || 0}`
}

function handleStepQrShow(row: FlowCardItem) {
  const key = flowStepQrKey(row)
  visibleStepQrKey.value = key
  stepQrVersionMap.value[key] = Date.now()
}

function handleStepQrHide(row: FlowCardItem) {
  if (visibleStepQrKey.value === flowStepQrKey(row)) visibleStepQrKey.value = ''
}

function isStepQrVisible(row: FlowCardItem): boolean {
  return Boolean(orderId.value && row.stepNo && visibleStepQrKey.value === flowStepQrKey(row))
}

function getFlowStepQrCodeUrl(row: FlowCardItem): string {
  if (!orderId.value || !row.stepNo) return ''
  const version = stepQrVersionMap.value[flowStepQrKey(row)] || Date.now()
  return `${getStepQrCodeUrl(orderId.value, row.stepNo)}?t=${version}`
}

const materialApplyDrawerTitle = computed(() => {
  const map: Record<MaterialApplyType, string> = {
    FEED: '补料申请',
    PICK: '领料申请',
    RETURN: '退料申请',
  }
  return map[materialApplyType.value]
})

const materialRequestRecords = computed(() => {
  const pickRecords = pickTasks.value.map((task) => ({
    businessInfo: `优先级：${task.priorityLevel ?? '-'}`,
    createTime: task.createTime,
    erpBillNo: task.erpBillNo,
    failReason: task.failReason || task.closeReason,
    handledQty: task.issuedQty ?? task.preparedQty ?? task.reservedQty ?? '-',
    id: `PICK-${task.id}`,
    materialCode: task.materialCode,
    materialName: task.materialName,
    requestQty: task.requestQty,
    statusText: pickTaskStatusText(task.taskStatus),
    statusType: pickTaskStatusType(task.taskStatus),
    type: 'PICK' as MaterialApplyType,
    typeText: '领料',
  }))
  const returnRecords = returnTasks.value.map((task) => ({
    businessInfo: `仓库：${task.warehouseNumber || task.warehouseName || '-'}；检验：${returnInspectionStatusText(task.inspectionStatus)}`,
    createTime: task.createTime,
    erpBillNo: task.erpBillNo,
    failReason: task.failReason,
    handledQty: task.requestQty ?? '-',
    id: `RETURN-${task.id}`,
    materialCode: task.materialCode,
    materialName: task.materialName,
    requestQty: task.requestQty,
    statusText: returnTaskStatusText(task.taskStatus),
    statusType: returnTaskStatusType(task.taskStatus),
    type: 'RETURN' as MaterialApplyType,
    typeText: '退料',
  }))
  const feedRecords = feedTasks.value.map((task) => ({
    businessInfo: `原因：${task.reasonText || task.reasonNumber || '-'}`,
    createTime: task.createTime,
    erpBillNo: task.erpBillNo,
    failReason: task.failReason || task.closeReason,
    handledQty: task.issuedQty ?? task.preparedQty ?? '-',
    id: `FEED-${task.id}`,
    materialCode: task.materialCode,
    materialName: task.materialName,
    requestQty: task.requestQty,
    statusText: feedTaskStatusText(task.taskStatus),
    statusType: feedTaskStatusType(task.taskStatus),
    type: 'FEED' as MaterialApplyType,
    typeText: '补料',
  }))

  return [...pickRecords, ...returnRecords, ...feedRecords].sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0))
})

const filteredMaterialRequestRecords = computed(() => {
  if (materialRecordTypeFilter.value === 'ALL') {
    return materialRequestRecords.value
  }
  return materialRequestRecords.value.filter(record => record.type === materialRecordTypeFilter.value)
})

// ==================== 生命周期 ====================
async function loadMaterialRequestPolicyConfig() {
  try {
    const res = await getMaterialRequestPolicyConfig()
    const data = res?.data || res
    integerUnitNumbers.value = data?.integerUnitNumbers || DEFAULT_INTEGER_UNIT_NUMBERS
    oneDecimalUnitNumbers.value = data?.oneDecimalUnitNumbers || DEFAULT_ONE_DECIMAL_UNIT_NUMBERS
  } catch {
    integerUnitNumbers.value = DEFAULT_INTEGER_UNIT_NUMBERS
    oneDecimalUnitNumbers.value = DEFAULT_ONE_DECIMAL_UNIT_NUMBERS
  }
}

onMounted(async () => {
  loading.value = true
  applyUserName.value = currentOperator.value.operatorName
  try {
    // 从列表页 localStorage 获取暂存的工单信息
    const cached = localStorage.getItem('order_detail_temp')
    // 同时维护一份持久化的 ERP 上下文，供刷新后恢复使用
    const persistKey = `order_erp_ctx_${orderNo}`
    await loadMaterialRequestPolicyConfig()
    let erpData: any = null
    if (cached) {
      erpData = JSON.parse(cached)
      localStorage.removeItem('order_detail_temp')
      // 持久化 ERP 上下文，刷新后可恢复
      localStorage.setItem(persistKey, JSON.stringify({
        prdOrgNumber: erpData?.prdOrgNumber,
        workshopNumber: erpData?.workshopNumber,
        erpAcctCode: erpData?.erpAcctCode || erpData?.acctCode,
        prdOrgId: erpData?.prdOrgId,
        moEntrySeq: erpData?.moEntrySeq,
      }))
    } else {
      // 刷新场景：尝试从持久化 key 恢复 ERP 上下文
      const persisted = localStorage.getItem(persistKey)
      if (persisted) {
        erpData = JSON.parse(persisted)
      }
    }
      if (erpData?.moEntrySeq) {
        moEntrySeq.value = Number(erpData.moEntrySeq) || 1
      }
      if (erpData?.prdOrgId) {
        prdOrgId.value = erpData.prdOrgId
      }
      if (erpData?.prdOrgNumber) {
        prdOrgNumber.value = erpData.prdOrgNumber
      }
      if (erpData?.workshopNumber) {
        workshopNumber.value = erpData.workshopNumber
      }
      if (erpData?.erpAcctCode || erpData?.acctCode) {
        erpAcctCode.value = String(erpData.erpAcctCode || erpData.acctCode)
      }

    // 确保工单在本地存在
    const res = await ensureLocalOrder({
      orderNo: orderNo,
      productCode: erpData?.materialId,
      productName: erpData?.materialName,
      planQty: erpData?.planQty,
      erpAcctCode: erpAcctCode.value || undefined,
      prdOrgNumber: prdOrgNumber.value,
      workshopNumber: workshopNumber.value,
    })
    if (res.success && res.data?.id) {
      orderId.value = Number(res.data.id)
      // 刷新页面时 order_detail_temp 已删除，从工单 DB 记录中恢复 ERP 上下文，
      // 避免下次 ensureLocalOrder / handleRouteCheck 等调用时带空字段触发后端报错。
      if (!prdOrgNumber.value && (res.data as any)?.erpPrdOrgNumber) {
        prdOrgNumber.value = String((res.data as any).erpPrdOrgNumber)
      }
      if (!workshopNumber.value && (res.data as any)?.erpWorkshopNumber) {
        workshopNumber.value = String((res.data as any).erpWorkshopNumber)
      }
      orderInfo.value = {
        id: res.data.id,
        orderNo: res.data.orderNo,
        productCode: res.data.productCode,
        productName: res.data.productName,
        planQty: res.data.planQty,
        completedQty: res.data.completedQty,
        businessStatus: res.data.businessStatus,
        erpOrderNo: erpData?.moBillNo || res.data.orderNo
      }

      // 加载路线信息
      await loadRouteInfo()
      await loadFlowCards()
      await loadExceptions()
      await loadMaterialList()
      await loadWageSettlements()
      await loadPickTasks()
      await loadReturnTasks()
      await loadFeedTasks()
      refreshQrCode()
    } else {
      ElMessage.error(res.message || '本地工单初始化失败')
      // fallback: 直接用 orderNo 作为展示
      orderInfo.value = {
        orderNo: orderNo,
        productCode: erpData?.materialId || '',
        productName: erpData?.materialName || '',
        planQty: erpData?.planQty || 0
      }
    }
  } catch (e: any) {
    console.error('加载工单详情失败', e)
    // fallback 显示
    orderInfo.value = { orderNo: orderNo }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  stopAllFlowHeartbeats()
  // 组件卸载时释放办理锁和心跳（覆盖正常关闭/路由离开场景）。
  // 注意：浏览器强刷时此处发出的异步请求可能被浏览器中止，
  // 此时锁将在 5 分钟 TTL 后自动过期释放。
  if (materialApplyHeartbeatTimer !== null) {
    clearInterval(materialApplyHeartbeatTimer)
    materialApplyHeartbeatTimer = null
  }
  for (const tok of materialApplyLockTokens.value) {
    releaseMaterialEntryLock(tok).catch(() => {})
  }
  materialApplyLockTokens.value = []
})

// ==================== 基础信息 ====================
function goBack() {
  router.push('/production/order')
}

function formatTime(ts: number | null | undefined) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

function formatMoney(value?: number) {
  if (value === null || value === undefined) return '0.00'
  const num = Number(value)
  if (Number.isNaN(num)) return '0.00'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function getPriceTypeText(type?: string) {
  const map: Record<string, string> = { HOUR: '计时', MIXED: '混合', PIECE: '计件' }
  return map[type || ''] || type || '-'
}

function getWageStatusText(status?: string) {
  return resolveStatus('processWage', 'calcStatus', status)
}

function getWageStatusType(status?: string) {
  const map: Record<string, string> = {
    AUDITED: 'warning', AUDIT_REJECTED: 'danger', CONFIRMED: 'primary',
    CONFIRM_REJECTED: 'danger', ERP_FAILED: 'danger', ERP_PUSHED: 'success',
    FAILED: 'danger', SUBMITTED: 'info'
  }
  return map[status || ''] || 'info'
}

function getBizStatusType(status: string) {
  const map: Record<string, string> = { PENDING: 'info', READY: 'success', DISPATCHED: 'primary', IN_PROGRESS: 'warning', COMPLETED: '', CANCELLED: 'danger' }
  return map[status] || 'info'
}

function getBizStatusText(status: string) {
  return resolveStatus('global', 'status', status)
}

// ==================== 路线绑定 ====================
async function loadRouteInfo() {
  if (!orderId.value) return
  try {
    const res = await getOrderSteps(orderId.value)
    if (res.success && res.data) {
      routeInfo.value = {
        routeName: res.data.routeName,
        version: res.data.routeVersion,
        statusDesc: res.data.routeStatus,
        stepCount: res.data.totalSteps
      }
      orderInfo.value = { ...orderInfo.value, ...res.data }
    }
  } catch {
    routeInfo.value = null
  }
}

async function handleRouteCheck() {
  routeCheckLoading.value = true
  routeCheckResult.value = null
  routeOptions.value = []
  selectedRouteId.value = null
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await checkRouteAvailability(orderId.value)
    routeCheckResult.value = res
    if (res.multiVersion && res.data) {
      routeOptions.value = res.data
    }
  } catch (e: any) {
    showFlowActionError('检查工艺路线', e, '检查失败')
  } finally {
    routeCheckLoading.value = false
  }
}

async function handleBindRoute() {
  if (!selectedRouteId.value) return
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await bindRoute(orderId.value, selectedRouteId.value)
    if (res.success) {
      ElMessage.success(res.message || '绑定成功')
      routeCheckResult.value = null
      await loadRouteInfo()
      await loadFlowCards()
    }
  } catch (e: any) {
    showFlowActionError('绑定工艺路线', e, '绑定失败')
  }
}

async function handleDispatch() {
  dispatchLoading.value = true
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await dispatchOrder(orderId.value)
    if (res.success) {
      ElMessage.success(res.message || '下达成功')
      await loadRouteInfo()
      await loadFlowCards()
    }
  } catch (e: any) {
    showFlowActionError('下达工单', e, '下达失败')
  } finally {
    dispatchLoading.value = false
  }
}

// ==================== 工序流转卡 ====================
function flowStatusType(s: string) {
  const map: Record<string, string> = { PENDING: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', SKIPPED: 'default' }
  return map[s] || 'info'
}
function flowStatusText(s: string) {
  return resolveStatus('flowCard', 'status', s)
}

function inspectionTaskStatusText(status?: string) {
  return resolveStatus('inspection', 'taskStatus', status)
}

function inspectionTaskStatusType(status?: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    IN_PROGRESS: 'primary',
    INSPECTING: 'primary',
    PASSED: 'success',
    FAILED: 'danger',
    COMPLETED: 'success',
    CANCELLED: 'info',
    CANCELED: 'info',
  }
  return map[status || ''] || 'info'
}

function inspectionErpStatusText(status?: string) {
  return resolveStatus('inspection', 'erpPushStatus', status)
}

function qualityDispositionText(disposition?: string) {
  // Use inspection.dispositionStatus for manufacturing-specific terms
  // (e.g. REWORK→返修, PENDING→待处置) rather than the generic global.status mapping.
  return resolveStatus('inspection', 'dispositionStatus', disposition)
}

function qualityDispositionType(disposition?: string) {
  const map: Record<string, string> = { PASS: 'success', REWORK: 'warning', SCRAP: 'danger', PENDING: 'info' }
  return map[disposition || ''] || 'info'
}

function isClaimedByCurrentOperator(row: FlowCardItem) {
  if (row.claimStatus !== 'CLAIMED') return false
  const operator = currentOperator.value
  if (row.claimOwnerId && operator.operatorId && Number(row.claimOwnerId) === Number(operator.operatorId)) {
    return true
  }
  return Boolean(row.claimOwnerName && operator.operatorName && row.claimOwnerName === operator.operatorName)
}

function isClaimedByOtherOperator(row: FlowCardItem) {
  return row.claimStatus === 'CLAIMED' && !isClaimedByCurrentOperator(row)
}

function canReleaseClaim(row: FlowCardItem) {
  return row.flowStatus === 'PENDING' && isClaimedByCurrentOperator(row) && Boolean(row.claimLockToken)
}

function canStartFlow(row: FlowCardItem) {
  return row.flowStatus === 'PENDING' && !isClaimedByOtherOperator(row)
}

function canCompleteFlow(row: FlowCardItem) {
  return row.flowStatus === 'IN_PROGRESS' && !isClaimedByOtherOperator(row)
}

function canReconcileInspection(row: FlowCardItem) {
  return row.stepType === 'PRODUCTION'
    && row.flowStatus === 'COMPLETED'
    && row.inspectionTask?.taskStatus !== 'COMPLETED'
    && !row.inspectionTask?.inspectionFlowId
}

function claimStatusText(row: FlowCardItem) {
  if (isClaimedByCurrentOperator(row)) return '我已认领'
  return resolveStatus('flowCard', 'claimStatus', row.claimStatus || 'WAITING')
}

function claimStatusType(row: FlowCardItem) {
  if (isClaimedByCurrentOperator(row)) return 'success'
  if (isClaimedByOtherOperator(row)) return 'danger'
  const map: Record<string, string> = {
    CLAIMED: 'warning',
    RELEASED: 'info',
    WAITING: 'info',
  }
  return map[row.claimStatus || 'WAITING'] || 'info'
}

function shouldHeartbeatFlow(row: FlowCardItem) {
  return row.flowStatus === 'IN_PROGRESS' && isClaimedByCurrentOperator(row) && Boolean(row.claimLockToken)
}

function updateFlowCard(updated?: FlowCardItem) {
  if (!updated?.id) return
  const index = flowCards.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) {
    flowCards.value.splice(index, 1, { ...flowCards.value[index], ...updated })
  }
}

function startFlowHeartbeat(row: FlowCardItem) {
  if (!shouldHeartbeatFlow(row) || flowHeartbeatTimers.has(row.id)) return
  const timer = window.setInterval(async () => {
    try {
      const latest = flowCards.value.find((item) => item.id === row.id) || row
      if (!shouldHeartbeatFlow(latest)) {
        stopFlowHeartbeat(row.id)
        return
      }
      const res = await heartbeatFlowCard(row.id, {
        claimLockToken: latest.claimLockToken,
        operatorId: currentOperator.value.operatorId,
        operatorName: currentOperator.value.operatorName,
      })
      if (res.success) {
        updateFlowCard(res.data)
      } else {
        stopFlowHeartbeat(row.id)
        ElMessage.warning(res.message || '流转卡认领心跳已失效，请刷新后重试')
      }
    } catch (e: any) {
      stopFlowHeartbeat(row.id)
      showFlowActionError('流转卡认领心跳', e, '流转卡认领心跳失败')
    }
  }, FLOW_HEARTBEAT_INTERVAL_MS)
  flowHeartbeatTimers.set(row.id, timer)
}

function stopFlowHeartbeat(flowId: number) {
  const timer = flowHeartbeatTimers.get(flowId)
  if (timer) {
    window.clearInterval(timer)
    flowHeartbeatTimers.delete(flowId)
  }
}

function stopAllFlowHeartbeats() {
  Array.from(flowHeartbeatTimers.keys()).forEach(stopFlowHeartbeat)
}

function syncFlowHeartbeats(rows: FlowCardItem[]) {
  const activeIds = new Set(rows.filter(shouldHeartbeatFlow).map((row) => row.id))
  rows.forEach(startFlowHeartbeat)
  Array.from(flowHeartbeatTimers.keys()).forEach((flowId) => {
    if (!activeIds.has(flowId)) {
      stopFlowHeartbeat(flowId)
    }
  })
}

async function loadFlowCards() {
  flowCardLoading.value = true
  try {
    if (!orderId.value) return
    const res = await getFlowCards(orderId.value)
    if (res.success) {
      flowCards.value = res.data || []
      syncFlowHeartbeats(flowCards.value)
    }
  } catch (e: any) {
    showFlowActionError('加载流转卡', e, '加载流转卡失败')
  } finally {
    flowCardLoading.value = false
  }
}

async function handleReconcileInspection(row: FlowCardItem) {
  try {
    await ElMessageBox.confirm(
      `当前生产批次 ${row.batchCode || row.stepName} 缺少检验流转卡，确认补建？`,
      '补建检验流转卡',
      { type: 'warning' },
    )
    const res = await reconcileMissingInspectionFlow(row.id)
    if (!res.success) {
      ElMessage.error(formatFlowActionError('补建检验流转卡', res.message, '补建检验流转卡失败'))
      return
    }
    ElMessage.success(res.message || '检验流转卡已补建')
    await loadFlowCards()
  } catch (error: any) {
    if (error !== 'cancel') showFlowActionError('补建检验流转卡', error, '补建检验流转卡失败')
  }
}

async function handleStartStep(row: FlowCardItem) {
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    if (!canStartFlow(row)) {
      ElMessage.warning(row.claimOwnerName ? `该批次已被 ${row.claimOwnerName} 认领` : '该批次当前不可开始')
      return
    }
    let res: any
    if (row.claimStatus !== 'CLAIMED') {
      const { value: claimQuantityText } = await ElMessageBox.prompt(
        `请输入批次 ${row.batchCode || row.stepName} 的本次认领数量`,
        '认领批次',
        {
          confirmButtonText: '认领并开始',
          cancelButtonText: '取消',
          inputValue: String(row.inputQuantity || ''),
          inputPattern: /^[1-9]\d*$/,
          inputErrorMessage: '请输入大于 0 的整数数量',
        },
      )
      const claimRes = await claimAndStartFlowCard(row.id, {
        ...currentOperator.value,
        claimQuantity: Number(claimQuantityText),
      })
      if (!claimRes.success) {
        ElMessage.error(claimRes.message || '领取批次失败')
        return
      }
      res = claimRes
    } else {
      res = await startStepByFlowId(row.id, currentOperator.value)
    }
    if (res.success) {
      ElMessage.success(res.message || '工序已开始')
      startFlowHeartbeat(res.data || row)
      await loadFlowCards()
    } else {
      if (row.claimStatus === 'CLAIMED' && isClaimedByCurrentOperator(row) && row.claimLockToken) {
        await releaseFlowCard(row.id, {
          claimLockToken: row.claimLockToken,
          operatorId: currentOperator.value.operatorId,
          operatorName: currentOperator.value.operatorName,
        })
        stopFlowHeartbeat(row.id)
        await loadFlowCards()
      }
      ElMessage.error(formatFlowActionError('开始工序', res.message, '开始工序失败'))
    }
  } catch (e: any) {
    showFlowActionError('开始工序', e, '开始工序失败')
  }
}

async function handleReleaseClaim(row: FlowCardItem) {
  try {
    if (!canReleaseClaim(row)) {
      ElMessage.warning('只能释放当前用户认领且尚未开始的流转卡批次')
      return
    }
    await ElMessageBox.confirm(`确定释放批次 ${row.batchCode || row.stepName} 的认领？`, '释放认领', { type: 'warning' })
    const res = await releaseFlowCard(row.id, {
      claimLockToken: row.claimLockToken,
      operatorId: currentOperator.value.operatorId,
      operatorName: currentOperator.value.operatorName,
    })
    if (res.success) {
      stopFlowHeartbeat(row.id)
      ElMessage.success(res.message || '认领已释放')
      await loadFlowCards()
    } else {
      ElMessage.error(formatFlowActionError('释放认领', res.message, '释放认领失败'))
    }
  } catch (e: any) {
    if (e !== 'cancel') showFlowActionError('释放认领', e, '释放认领失败')
  }
}

function showCompleteDialog(row: FlowCardItem) {
  currentStep.value = row
  completeForm.actualQuantity = row.actualQuantity || 0
  completeForm.defectQuantity = row.defectQuantity || 0
  completeForm.reworkRequired = row.stepType === 'INSPECTION'
    ? row.inspectionTask?.qualityDisposition === 'REWORK'
      ? true
      : row.inspectionTask?.qualityDisposition === 'SCRAP'
        ? false
        : row.reworkQuantity && row.reworkQuantity > 0
          ? true
          : row.scrapQuantity && row.scrapQuantity > 0
            ? false
            : undefined
    : undefined
  setActualTimeParts(row.actualWorkSeconds, row.actualHours || row.standardHours || 0, row.timeUnit)
  completeForm.operatorId = row.operatorId || currentOperator.value.operatorId
  completeForm.operatorName = row.operatorName || currentOperator.value.operatorName
  completeForm.remark = row.remark || ''
  completeDialogVisible.value = true
}

function setActualTimeParts(actualWorkSeconds?: number, fallbackValue = 0, fallbackUnit?: string) {
  const totalSeconds = actualWorkSeconds && actualWorkSeconds > 0
    ? actualWorkSeconds
    : durationToSeconds(fallbackValue, fallbackUnit)
  completeForm.actualHoursPart = Math.floor(totalSeconds / 3600)
  completeForm.actualMinutesPart = Math.floor((totalSeconds % 3600) / 60)
  completeForm.actualSecondsPart = totalSeconds % 60
  completeForm.actualHours = Math.ceil(totalSeconds / 60)
}

function durationToSeconds(value?: number, unit?: string) {
  const amount = Math.max(0, Number(value || 0))
  if ((unit || '').toUpperCase() === 'HOUR') return Math.round(amount * 3600)
  if ((unit || '').toUpperCase() === 'SECOND') return Math.round(amount)
  return Math.round(amount * 60)
}

async function confirmComplete() {
  if (!currentStep.value) return
  const actualQuantity = Number(completeForm.actualQuantity || 0)
  const defectQuantity = Number(completeForm.defectQuantity || 0)
  const actualWorkSeconds = completeActualWorkSeconds.value
  if (actualQuantity <= 0) { ElMessage.warning('完成数量必须大于0'); return }
  if (defectQuantity < 0) { ElMessage.warning('不良数量不能小于0'); return }
  if (defectQuantity > actualQuantity) { ElMessage.warning('不良数量不能大于完成数量'); return }
  if (!completeForm.operatorName?.trim()) { ElMessage.warning('操作员不能为空'); return }
  if (actualWorkSeconds <= 0) { ElMessage.warning('实际工时必须大于0'); return }
  if (currentStep.value.stepType === 'INSPECTION' && defectQuantity > 0 && typeof completeForm.reworkRequired !== 'boolean') {
    ElMessage.warning(String.fromCharCode(35831,20808,36873,25321,19981,33391,22788,32622,26041,24335))
    return
  }
  completing.value = true
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await completeStepByFlowId(currentStep.value.id, {
      actualHours: Math.ceil(actualWorkSeconds / 60),
      actualQuantity,
      actualWorkSeconds,
      defectQuantity,
      operatorId: completeForm.operatorId,
      operatorName: completeForm.operatorName.trim(),
      remark: completeForm.remark,
      reworkRequired: completeForm.reworkRequired,
    })
    if (res.success) {
      stopFlowHeartbeat(currentStep.value.id)
      ElMessage.success(res.message || '工序完成')
      completeDialogVisible.value = false
      await loadFlowCards()
    } else {
      ElMessage.error(formatFlowActionError('完成工序', res?.message || res, '完成工序失败'))
    }
  } catch (e: any) {
    showFlowActionError('完成工序', e, '完成工序失败')
  } finally {
    completing.value = false
  }
}

async function handleSkipStep(row: FlowCardItem) {
  try {
    await ElMessageBox.confirm(`确定跳过工序[${row.stepName}]?`, '确认跳过')
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await skipStep(orderId.value, row.stepNo, '管理员跳过')
    if (res.success) {
      ElMessage.success(res.message || '已跳过')
      await loadFlowCards()
    }
  } catch (e: any) {
    if (e !== 'cancel') showFlowActionError('跳过工序', e, '跳过失败')
  }
}

async function handleRegenerate() {
  try {
    if (hasFlowCards.value) {
      ElMessage.warning('当前工单已存在流转卡，无需重复初始化')
      return
    }
    await ElMessageBox.confirm(
      '确定按 ERP 当前剩余可汇报量首次生成工序流转卡？仅在当前工单暂无流转卡时执行。',
      '首次初始化流转卡',
    )
    regenerateLoading.value = true
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await regenerateFlowCards(orderId.value)
    if (res.success) {
      ElMessage.success(res.message || '已按 ERP 剩余可汇报量初始化')
      await loadFlowCards()
    } else {
      ElMessage.error(formatFlowActionError('初始化流转卡', res.message, '初始化失败'))
    }
  } catch (e: any) {
    if (e !== 'cancel') showFlowActionError('初始化流转卡', e, '初始化失败')
  } finally {
    regenerateLoading.value = false
  }
}

async function handleForceRegenerate() {
  try {
    if (!hasFlowCards.value) {
      ElMessage.warning('当前工单暂无流转卡，请直接初始化')
      return
    }
    await ElMessageBox.confirm(
      '确定按 ERP 当前剩余可汇报量重建流转卡？该操作会删除可安全删除的本地流转卡并立即重新生成；如已存在 ERP 汇报、检验或工资推送单据，后端会拒绝执行。',
      '强制重置并重建',
      { type: 'warning' },
    )
    regenerateLoading.value = true
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await forceRegenerateFlowCards(orderId.value, {
      confirmed: true,
      operatorId: currentOperator.value.operatorId,
      operatorName: currentOperator.value.operatorName,
    })
    if (res.success) {
      ElMessage.success(res.message || '已按 ERP 剩余可汇报量重建流转卡')
      await loadFlowCards()
    } else {
      ElMessage.error(formatFlowActionError('强制重置流转卡', res.message, '强制重置失败'))
    }
  } catch (e: any) {
    if (e !== 'cancel') showFlowActionError('强制重置流转卡', e, '强制重置失败')
  } finally {
    regenerateLoading.value = false
  }
}

function handlePrintFlowCard() {
  if (flowCards.value.length === 0) {
    ElMessage.warning('暂无工序流转卡数据')
    return
  }
  const url = router.resolve({
    path: `/production/order/${orderNo}/print`,
    query: {
      moEntrySeq: String(moEntrySeq.value || 1),
      ...(erpAcctCode.value ? { erpAcctCode: erpAcctCode.value } : {}),
      ...(prdOrgId.value ? { prdOrgId: prdOrgId.value } : {}),
      ...(prdOrgNumber.value ? { prdOrgNumber: prdOrgNumber.value } : {}),
      ...(workshopNumber.value ? { workshopNumber: workshopNumber.value } : {}),
    }
  }).href
  window.open(url, '_blank')
}

// ==================== 异常 ====================
function handlerStatusType(s: string) {
  const map: Record<string, string> = { REPORTED: 'danger', HANDLING: 'warning', RESOLVED: 'success', ESCALATED: 'danger' }
  return map[s] || 'info'
}

function getExceptionTypeDesc(exceptionType: string): string {
  return resolveStatus('productionException', 'exceptionType', exceptionType)
}

function getHandlerStatusDesc(status: string): string {
  return resolveStatus('productionException', 'handlerStatus', status)
}

async function loadExceptions() {
  exceptionLoading.value = true
  try {
    if (!orderId.value) return
    const res = await getOrderExceptions(orderId.value)
    if (res.success) exceptions.value = res.data
  } catch {
    // ignore
  } finally {
    exceptionLoading.value = false
  }
}

function showExceptionDialog(row: FlowCardItem) {
  exceptionStepNo.value = row.stepNo
  exceptionForm.exceptionType = 'EQUIPMENT'
  exceptionForm.description = ''
  exceptionForm.isBlocking = false
  exceptionDialogVisible.value = true
}

async function confirmException() {
  reportingException.value = true
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await reportException(orderId.value, exceptionStepNo.value!, {
      exceptionType: exceptionForm.exceptionType,
      description: exceptionForm.description,
      isBlocking: exceptionForm.isBlocking
    })
    if (res.success) {
      ElMessage.success('异常已上报')
      exceptionDialogVisible.value = false
      await loadExceptions()
      await loadFlowCards()
    }
  } catch (e: any) {
    showFlowActionError('上报异常', e, '上报失败')
  } finally {
    reportingException.value = false
  }
}

async function handleExceptionAction(row: ExceptionItem, action: string) {
  const actionNames: Record<string, string> = { handle: '处理', resolve: '解决', escalate: '升级' }
  try {
    await ElMessageBox.confirm(`确定${actionNames[action]}此异常?`, '确认')
    let res: any
    if (action === 'handle') {
      res = await handleException(row.id, { handlerName: '操作员' })
    } else if (action === 'resolve') {
      res = await resolveException(row.id, '已处理')
    } else {
      res = await escalateException(row.id, { handlerName: '主管', remark: '升级处理' })
    }
    if (res.success) {
      ElMessage.success(`${actionNames[action]}成功`)
      await loadExceptions()
    }
  } catch (e: any) {
    if (e !== 'cancel') showFlowActionError(actionNames[action] || '异常处理', e, `${actionNames[action] || '处理'}失败`)
  }
}

// ==================== 生产用料清单 ====================
async function loadMaterialList() {
  materialLoading.value = true
  try {
    const res = await queryMaterialList({
      moBillNo: orderNo,
      moEntrySeq: moEntrySeq.value || 1,
      prdOrgId: prdOrgId.value || undefined
    })
    if (res.success) {
      materialList.value = res.data || []
      await loadMaterialEntryLocks()
    }
  } catch (e: any) {
    console.error('加载生产用料清单失败', e)
  } finally {
    materialLoading.value = false
  }
}

async function loadWageSettlements() {
  if (!orderId.value) return
  wageLoading.value = true
  try {
    const res = await getOrderWageSettlements(orderId.value)
    if (res.success) {
      wageSettlements.value = res.data || []
      wageTotalAmount.value = Number(res.totalAmount || 0)
    }
  } catch (e: any) {
    console.error('加载工资核算结果失败', e)
  } finally {
    wageLoading.value = false
  }
}

function exportCurrentOrderWage() {
  if (!orderId.value) return
  window.open(getOrderWageExportUrl(orderId.value), '_blank')
}

async function loadPickTasks() {
  if (!orderId.value) return
  pickTaskLoading.value = true
  try {
    const res = await getPickRequests(orderId.value)
    if (res.success) {
      pickTasks.value = res.data || []
    }
  } finally {
    pickTaskLoading.value = false
  }
}

async function loadReturnTasks() {
  if (!orderId.value) return
  returnTaskLoading.value = true
  try {
    const res = await getReturnRequests(orderId.value)
    if (res.success) {
      returnTasks.value = res.data || []
    }
  } finally {
    returnTaskLoading.value = false
  }
}

async function loadFeedTasks() {
  if (!orderId.value) return
  feedTaskLoading.value = true
  try {
    const res = await getFeedRequests(orderId.value)
    if (res.success) {
      feedTasks.value = res.data || []
    }
  } finally {
    feedTaskLoading.value = false
  }
}

async function refreshMaterialRequests() {
  await Promise.all([loadPickTasks(), loadReturnTasks(), loadFeedTasks()])
}

async function openMaterialApplyDrawer(type: MaterialApplyType) {
  // 打开抽屉前先刷新用料清单（更新 MES 占用量），并清空上次填写的数量和库存候选选择。
  await loadMaterialList()
  Object.keys(applyQtyMap).forEach(k => delete applyQtyMap[k])
  Object.keys(feedQtyMap).forEach(k => delete feedQtyMap[k])
  Object.keys(selectedInventoryCandidateKeyMap).forEach(k => delete selectedInventoryCandidateKeyMap[k])
  Object.keys(inventoryCandidateMap).forEach(k => delete inventoryCandidateMap[k])

  if (!materialList.value.length) {
    ElMessage.warning('用料清单尚未加载，请稍后重试')
    return
  }
  materialApplyType.value = type

  // 批量 acquire 锁：检查清单内所有 pbomEntry
  const pbomEntryIds = materialList.value
    .map((row) => Number(row.pbomEntryId || 0))
    .filter((id) => id > 0)
  const tokens: string[] = []
  for (const pbomEntryId of pbomEntryIds) {
    try {
      const res: any = await acquireMaterialEntryLock({
        orderNo: orderNo,
        moEntrySeq: moEntrySeq.value || 1,
        pbomEntryId,
        operationType: type,
      })
      if (res?.success === false) {
        // 某行已被他人锁定：释放已获取的锁，阻止打开
        for (const tok of tokens) {
          releaseMaterialEntryLock(tok).catch(() => {})
        }
        ElMessage.error(res.message || '当前用料清单正在被其他人办理，请稍后重试')
        await loadMaterialEntryLocks()
        return
      }
      if (res?.data?.lockToken) {
        tokens.push(res.data.lockToken)
      }
    } catch (e: any) {
      for (const tok of tokens) {
        releaseMaterialEntryLock(tok).catch(() => {})
      }
      ElMessage.error(e?.message || '获取办理锁失败，请重试')
      return
    }
  }

  materialApplyLockTokens.value = tokens

  // 启动心跳（每 2.5 分钟续期，TTL=5分钟）
  materialApplyHeartbeatTimer = setInterval(async () => {
    for (const tok of materialApplyLockTokens.value) {
      heartbeatMaterialEntryLock(tok).catch(() => {})
    }
  }, 2.5 * 60 * 1000)

  materialApplyDrawerVisible.value = true
}

async function closeMaterialApplyDrawer() {
  if (materialApplyHeartbeatTimer !== null) {
    clearInterval(materialApplyHeartbeatTimer)
    materialApplyHeartbeatTimer = null
  }
  for (const tok of materialApplyLockTokens.value) {
    releaseMaterialEntryLock(tok).catch(() => {})
  }
  materialApplyLockTokens.value = []
  await loadMaterialEntryLocks()
}

async function openMaterialRecords() {
  materialRecordDrawerVisible.value = true
  await refreshMaterialRequests()
}

function materialEntryKey(row: MaterialListItem) {
  return String(row.pbomEntryId || `${row.moBillNo || orderNo}-${row.moEntrySeq || moEntrySeq.value}-${row.materialCode || ''}`)
}

function inventoryCandidateKey(row: InventoryAvailabilityRow) {
  return [
    row.sourceUseOrgNumber || '',
    row.warehouseNumber || '',
    row.lotNo || '',
    row.stockLoc || '',
    row.stockStatusNumber || '',
  ].join('|')
}

function getInventoryCandidates(row: MaterialListItem) {
  return inventoryCandidateMap[materialEntryKey(row)] || []
}

function isInventoryCandidateLoading(row: MaterialListItem) {
  return Boolean(inventoryCandidateLoadingMap[materialEntryKey(row)])
}

function getDemandOrgNumber(row: MaterialListItem) {
  return (prdOrgNumber.value || row.prdOrgNumber || '').trim()
}

async function loadInventoryCandidates(row: MaterialListItem, businessType: MaterialApplyType) {
  const entryKey = materialEntryKey(row)
  const demandOrgNumber = getDemandOrgNumber(row)
  if (!demandOrgNumber) {
    ElMessage.warning('缺少生产组织，无法按现有库存汇总依据查询库存')
    return
  }
  if (!row.materialCode) {
    ElMessage.warning('缺少物料编码，无法查询库存')
    return
  }
  inventoryCandidateLoadingMap[entryKey] = true
  try {
    const res = await queryInventoryAvailableByBasis({
      businessType,
      demandOrgNumber,
      erpAcctCode: erpAcctCode.value || undefined,
      materialNumber: row.materialCode,
      pageSize: 200,
      pbomEntryId: row.pbomEntryId ? Number(row.pbomEntryId) : undefined,
    })
    if (res.success === false) {
      ElMessage.error(res.message || '库存候选查询失败')
      return
    }
    const rows = res.data || []
    inventoryCandidateMap[entryKey] = rows
    if (!res.configured) {
      selectedInventoryCandidateKeyMap[entryKey] = []
      ElMessage.warning(res.message || '未配置现有库存汇总依据')
      return
    }
    if (rows.length === 0) {
      selectedInventoryCandidateKeyMap[entryKey] = []
      ElMessage.info('白名单仓库下暂无可用库存候选')
      return
    }
    if (!selectedInventoryCandidateKeyMap[entryKey]?.length) {
      // 自动贪心选批（FIFO）：若用户已填申领数量，按后端返回的 FIFO 顺序依次累加，
      // 直到累计可用量 >= 申领数量为止；未填数量时仅预选第一批（沿用旧行为）。
      const qtyMap = businessType === 'FEED' ? feedQtyMap
        : businessType === 'RETURN' ? returnQtyMap
        : applyQtyMap
      const requestQty = Number(qtyMap[String(row.pbomEntryId)] || 0)
      let autoSelected: string[]
      if (requestQty > 0) {
        autoSelected = []
        let covered = 0
        for (const candidate of rows) {
          autoSelected.push(inventoryCandidateKey(candidate))
          covered += Number(candidate.availableQty ?? candidate.qty ?? 0)
          if (covered >= requestQty) break
        }
      } else {
        const firstCandidate = rows[0]
        if (!firstCandidate) return
        autoSelected = [inventoryCandidateKey(firstCandidate)]
      }
      selectedInventoryCandidateKeyMap[entryKey] = autoSelected
      handleInventoryCandidateSelected(row)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '库存候选查询失败')
  } finally {
    inventoryCandidateLoadingMap[entryKey] = false
  }
}

function getSelectedInventoryCandidates(row: MaterialListItem): InventoryAvailabilityRow[] {
  const selectedKeys = selectedInventoryCandidateKeyMap[materialEntryKey(row)] || []
  if (!selectedKeys.length) return []
  return getInventoryCandidates(row).filter(c => selectedKeys.includes(inventoryCandidateKey(c)))
}

function getSelectedInventoryCandidate(row: MaterialListItem) {
  const candidates = getSelectedInventoryCandidates(row)
  return candidates[0]
}

function handleInventoryCandidateSelected(row: MaterialListItem) {
  const candidate = getSelectedInventoryCandidate(row)
  if (!candidate || materialApplyType.value !== 'RETURN') return
  const warehouse = inventoryAvailabilityToWarehouse(candidate)
  returnWarehouseNumber.value = warehouse.warehouseNumber || ''
  returnWarehouseName.value = warehouse.warehouseName || ''
}

function formatInventoryCandidateLabel(row: InventoryAvailabilityRow) {
  const stock = `${row.warehouseNumber || '-'} ${row.warehouseName || ''}`.trim()
  const lot = row.lotNo ? `批:${row.lotNo}` : '无批次'
  const loc = row.stockLoc ? `库位:${row.stockLoc}` : '无库位'
  const qty = `可用:${row.availableQty ?? row.qty ?? 0}${row.unit || ''}`
  const org = row.sourceUseOrgNumber ? `组织:${row.sourceUseOrgNumber}` : ''
  return [stock, lot, loc, qty, org].filter(Boolean).join(' / ')
}

function getSelectedInventoryCandidateSummary(row: MaterialListItem) {
  const candidates = getSelectedInventoryCandidates(row)
  if (!candidates.length) return ''
  const total = candidates.reduce((sum, c) => sum + Number(c.availableQty ?? c.qty ?? 0), 0)
  const unit = candidates[0]?.unit || ''
  return candidates.length === 1
    ? `可用 ${total}${unit}`
    : `已选 ${candidates.length} 批，合计可用 ${total}${unit}`
}

function materialRecordTypeTag(type: MaterialApplyType) {
  const map: Record<MaterialApplyType, string> = {
    FEED: 'success',
    PICK: 'primary',
    RETURN: 'warning',
  }
  return map[type] || 'info'
}

async function loadMaterialEntryLocks() {
  const ids = materialList.value
    .map((item) => Number(item.pbomEntryId || 0))
    .filter((id) => id > 0)
  if (!ids.length) {
    materialEntryLocks.value = []
    return
  }
  try {
    const res = await getMaterialEntryLocks({
      orderNo,
      moEntrySeq: moEntrySeq.value || 1,
      pbomEntryIds: ids,
    })
    if (res.success) {
      materialEntryLocks.value = res.data || []
    }
  } catch {
    materialEntryLocks.value = []
  }
}

function handleMaterialSelectionChange(rows: MaterialListItem[]) {
  selectedMaterialRows.value = rows
}

function handleReturnMaterialSelectionChange(rows: MaterialListItem[]) {
  selectedReturnRows.value = rows
}

function handleFeedMaterialSelectionChange(rows: MaterialListItem[]) {
  selectedFeedRows.value = rows
}

function getPreparingQty(row: MaterialListItem) {
  return pickTasks.value
    .filter(task => task.pbomEntryId === row.pbomEntryId && ['APPLIED', 'PREPARING', 'PREPARED', 'ISSUING'].includes(task.taskStatus))
    .reduce((sum, task) => sum + Number(task.reservedQty || 0), 0)
}

function getMaterialUnit(row: MaterialListItem) {
  return row.baseUnitNumber || row.unitNumber || '-'
}

function formatMaterialQty(row: MaterialListItem, qty?: number) {
  return normalizeQtyByUnit(qty || 0, row.baseUnitNumber, integerUnitNumbers.value, oneDecimalUnitNumbers.value)
}

function normalizeApplyQtyInput(row: MaterialListItem) {
  const key = String(row.pbomEntryId)
  applyQtyMap[key] = normalizeQtyByUnit(applyQtyMap[key] || 0, row.baseUnitNumber, integerUnitNumbers.value, oneDecimalUnitNumbers.value)
  // 如果该行候选已加载，数量变更后重新做 FIFO 预勾选
  const entryKey = materialEntryKey(row)
  if (inventoryCandidateMap[entryKey]?.length) {
    const rows = inventoryCandidateMap[entryKey]
    const requestQty = Number(applyQtyMap[entryKey] || 0)
    const autoSelected: string[] = []
    let accumulated = 0
    for (const candidate of rows) {
      autoSelected.push(inventoryCandidateKey(candidate))
      accumulated += Number(candidate.availableQty ?? candidate.qty ?? 0)
      if (requestQty > 0 && accumulated >= requestQty) break
    }
    selectedInventoryCandidateKeyMap[entryKey] = autoSelected
  }
}

function getAvailableApplyQty(row: MaterialListItem) {
  return getAllowedPickQty(row, getPreparingQty(row), integerUnitNumbers.value, oneDecimalUnitNumbers.value)
}

function getReturningQty(row: MaterialListItem) {
  return returnTasks.value
    .filter(task => task.pbomEntryId === row.pbomEntryId && ['APPLIED', 'PREVIEWED', 'SUBMITTED', 'APPROVING', 'APPROVED', 'INSPECTING'].includes(task.taskStatus))
    .reduce((sum, task) => sum + Number(task.requestQty || 0), 0)
}

function getAvailableReturnQty(row: MaterialListItem) {
  return Math.max(0, Number(row.wipQty || 0) - Number(getReturningQty(row) || 0))
}

function getFeedingQty(row: MaterialListItem) {
  return feedTasks.value
    .filter(task => task.pbomEntryId === row.pbomEntryId && ['APPLIED', 'PREPARING', 'PREPARED', 'PREVIEWED', 'SUBMITTED', 'APPROVING'].includes(task.taskStatus))
    .reduce((sum, task) => sum + Number(task.requestQty || 0), 0)
}

function getEntryLock(row: MaterialListItem) {
  return materialEntryLocks.value.find(lock => lock.pbomEntryId === row.pbomEntryId)
}

function getEntryLockText(row: MaterialListItem) {
  const lock = getEntryLock(row)
  if (!lock || !lock.locked) return ''
  return `${lock.ownerUserName || '其他用户'} 正在办理 ${lock.operationType || ''}`
}

function isEntryLocked(row: MaterialListItem) {
  return Boolean(getEntryLock(row)?.locked)
}

/** 提交侧专用：只有他人持有的锁才阻断；自己持有的锁（打开抽屉时 acquire）不阻断。 */
function isEntryLockedByOther(row: MaterialListItem) {
  const lock = getEntryLock(row)
  if (!lock?.locked) return false
  const myId = currentOperator.value.operatorId
  if (myId && lock.ownerUserId && Number(lock.ownerUserId) === Number(myId)) return false
  return true
}

async function submitPickRequests() {
  // 不再依赖行勾选：提交范围由「本次申领数量 > 0」决定，守卫只校验工单上下文。
  if (!orderId.value) return
  const built = buildPickApplyPayload()
  if (!built.payload.lines.length) {
    ElMessage.warning('没有可提交的领料申请，请检查清单状态和本次申领数量')
    return
  }
  if (built.overflowRows.length > 0) {
    pendingPickApplyPayload.value = built.payload
    overflowApplyRows.value = built.overflowRows
    overflowAutoCreateFeed.value = false
    // 每次重新打开弹窗都清空各行原因，避免上一次的输入被误带到本次申请。
    resetOverflowReasonInputs(built.overflowRows)
    overflowDialogVisible.value = true
    return
  }
  await executePickApply(built.payload)
}

function buildPickApplyPayload() {
  const lines: { pbomEntryId: number; requestQty: number; stockName?: string; stockNumber?: string; suggestedCandidates?: any[] }[] = []
  const overflowRows: any[] = []
  for (const row of materialList.value) {
    if (isEntryLockedByOther(row)) {
      ElMessage.warning(getEntryLockText(row))
      continue
    }
    if (row.documentStatus && row.documentStatus !== 'C') {
      ElMessage.warning(`生产用料清单未审核，不能申请领料：${row.materialCode || ''} ${row.documentStatusText || row.documentStatus}`)
      continue
    }
    const requestQty = normalizeQtyByUnit(applyQtyMap[String(row.pbomEntryId)] || 0, row.baseUnitNumber, integerUnitNumbers.value, oneDecimalUnitNumbers.value)
    applyQtyMap[String(row.pbomEntryId)] = requestQty
    if (requestQty <= 0) continue
    const stockCandidates = getSelectedInventoryCandidates(row)
    const stockCandidate = stockCandidates[0]
    const suggestedCandidates = stockCandidates.map(c => ({
      warehouseNumber: c.warehouseNumber || '',
      warehouseName: c.warehouseName || '',
      lotNo: c.lotNo || '',
      stockLoc: c.stockLoc || '',
      inboundDate: (c as any).inboundDate || '',
      availableQty: c.availableQty ?? c.qty ?? 0,
    }))
    const split = buildApplySplit(row, requestQty, getPreparingQty(row), integerUnitNumbers.value, oneDecimalUnitNumbers.value)
    if (split.feedQty > 0) {
      overflowRows.push({
        ...split,
        // 弹窗内按行填写补料原因需要 pbomEntryId 作为 key，回填 payload 时也靠它对齐分录。
        pbomEntryId: Number(row.pbomEntryId),
        baseUnitNumber: getMaterialUnit(row),
        consumVolatility: row.consumVolatility || 0,
        materialCode: row.materialCode,
        materialName: row.materialName,
      })
    }
    lines.push({
      pbomEntryId: Number(row.pbomEntryId),
      requestQty,
      stockName: stockCandidate?.warehouseName,
      stockNumber: stockCandidate?.warehouseNumber,
      suggestedCandidates,
    })
  }
  return {
    overflowRows,
    payload: {
      applyUserName: applyUserName.value || undefined,
      autoCreateFeedForOverflow: false,
      lines,
      moBillNo: orderNo,
      moEntrySeq: moEntrySeq.value || 1,
      priorityLevel: pickPriorityType.value === 'URGENT' ? 90 : 0,
      priorityType: pickPriorityType.value,
    },
  }
}

async function confirmOverflowPickApply() {
  if (!pendingPickApplyPayload.value) return
  if (!overflowAutoCreateFeed.value) {
    ElMessage.warning('请先勾选「超出数量直接生成补料申请」')
    return
  }
  // 勾选自动补料后，补料原因与手工补料申请保持同一口径：必填，且按行独立填写。
  overflowReasonTouched.value = true
  const missing = overflowApplyRows.value.filter(
    (row) => !(overflowReasonTextMap[String(row.pbomEntryId)] || '').trim(),
  )
  if (missing.length > 0) {
    ElMessage.warning(
      `以下物料未填写补料原因：${missing.map((row) => row.materialCode || row.pbomEntryId).join('、')}`,
    )
    return
  }
  // 把行级原因合并回 payload.lines：只有存在超出量的行才带原因字段。
  const overflowEntryIds = new Set(overflowApplyRows.value.map((row) => String(row.pbomEntryId)))
  const lines = (pendingPickApplyPayload.value.lines || []).map((line: any) => {
    const key = String(line.pbomEntryId)
    if (!overflowEntryIds.has(key)) return line
    return {
      ...line,
      overflowReasonNumber: (overflowReasonNumberMap[key] || '').trim() || undefined,
      overflowReasonText: (overflowReasonTextMap[key] || '').trim(),
    }
  })
  await executePickApply({
    ...pendingPickApplyPayload.value,
    autoCreateFeedForOverflow: true,
    lines,
  })
}

async function executePickApply(payload: any) {
  if (!orderId.value) return
  applyingPickRequest.value = true
  try {
    const res = await applyPickWithOverfeed(orderId.value, payload)
    if (res?.success === false) {
      throw new Error(res.message || '提交领料申请失败')
    }
    const pickCount = Number(res?.pickCount ?? res?.pickTasks?.length ?? 0)
    const feedCount = Number(res?.feedCount ?? res?.feedTasks?.length ?? 0)
    ElMessage.success(feedCount > 0 ? `领料申请已提交，超出部分已生成 ${feedCount} 条补料申请` : '领料申请已提交')
    selectedMaterialRows.value = []
    pendingPickApplyPayload.value = null
    overflowDialogVisible.value = false
    overflowApplyRows.value = []
    await Promise.all([loadPickTasks(), loadFeedTasks(), loadMaterialList()])
    // 只有后端确认 pickCount 和 feedCount 都为 0 时才警告，避免因计数为 0 但实际有补料任务的边界情况误报。
    if (pickCount === 0 && feedCount === 0 && res?.success !== false) {
      const tasksInPool = (pickTasks.value?.length ?? 0) + (feedTasks.value?.length ?? 0)
      if (tasksInPool === 0) {
        ElMessage.warning('没有生成领料或补料任务，请检查本次申领数量')
      }
    }
  } catch (e: any) {
    showFlowActionError('提交领料申请', e, '提交领料申请失败')
  } finally {
    applyingPickRequest.value = false
  }
}

async function submitReturnRequests() {
  if (!orderId.value || selectedReturnRows.value.length === 0) return
  const hasMissingWarehouse = selectedReturnRows.value.some(row => {
    const candidate = getSelectedInventoryCandidate(row)
    return !candidate?.warehouseNumber && !returnWarehouseNumber.value.trim()
  })
  if (hasMissingWarehouse) {
    ElMessage.warning('退料仓库编码不能为空')
    return
  }
  applyingReturnRequest.value = true
  try {
    for (const row of selectedReturnRows.value) {
      if (isEntryLockedByOther(row)) {
        ElMessage.warning(getEntryLockText(row))
        continue
      }
      const requestQty = Number(returnQtyMap[String(row.pbomEntryId)] || 0)
      if (requestQty <= 0) continue
      const stockCandidate = getSelectedInventoryCandidate(row)
      const selectedWarehouse = stockCandidate ? inventoryAvailabilityToWarehouse(stockCandidate) : undefined
      const stockFields = stockCandidate ? inventoryAvailabilityToSubmitFields(stockCandidate) : undefined
      await applyReturnRequest(orderId.value, {
        moBillNo: row.moBillNo,
        moEntrySeq: row.moEntrySeq,
        pbomEntryId: Number(row.pbomEntryId),
        requestQty,
        warehouseNumber: selectedWarehouse?.warehouseNumber || returnWarehouseNumber.value.trim(),
        warehouseName: selectedWarehouse?.warehouseName || returnWarehouseName.value.trim() || undefined,
        lotNo: stockFields?.lotNo,
        stockLoc: stockFields?.stockLoc,
        stockStatusName: stockFields?.stockStatusName,
        stockStatusNumber: stockFields?.stockStatusNumber,
        // 行级原因优先，留空时回退到表头输入，保持与旧行为兼容。
        // 行级原因优先；表头批量输入未点「填充到所有行」时也作为兜底，避免白填。
        returnReasonNumber: (returnReasonNumberMap[String(row.pbomEntryId)] || '').trim() || returnBatchReasonNumber.value.trim() || undefined,
        returnReasonText: (returnReasonTextMap[String(row.pbomEntryId)] || '').trim() || returnBatchReasonText.value.trim() || undefined,
        sourceQrToken: returnSourceQrMap[String(row.pbomEntryId)] || undefined,
        applyUserName: returnApplyUserName.value || undefined,
      })
    }
    ElMessage.success('退料申请已提交')
    selectedReturnRows.value = []
    await Promise.all([loadReturnTasks(), loadMaterialList()])
  } catch (e: any) {
    showFlowActionError('提交退料申请', e, '提交退料申请失败')
  } finally {
    applyingReturnRequest.value = false
  }
}

async function submitFeedRequests() {
  if (!orderId.value) return
  // 补料原因按行必填：先找出「本次补料量 > 0 但该行原因为空」的行，逐行拦截。
  const feedRowsToSubmit = materialList.value.filter(
    (row) => Number(feedQtyMap[String(row.pbomEntryId)] || 0) > 0,
  )
  if (feedRowsToSubmit.length === 0) {
    ElMessage.warning('没有可提交的补料申请，请先填写本次补料量')
    return
  }
  const feedMissingReason = feedRowsToSubmit.filter(
    (row) =>
      !(feedReasonTextMap[String(row.pbomEntryId)] || '').trim() && !feedBatchReasonText.value.trim(),
  )
  if (feedMissingReason.length > 0) {
    ElMessage.warning(
      `以下物料未填写补料原因：${feedMissingReason.map((row) => row.materialCode || row.pbomEntryId).join('、')}`,
    )
    return
  }
  applyingFeedRequest.value = true
  try {
    let submittedCount = 0
    for (const row of materialList.value) {
      if (isEntryLockedByOther(row)) {
        ElMessage.warning(getEntryLockText(row))
        continue
      }
      const requestQty = Number(feedQtyMap[String(row.pbomEntryId)] || 0)
      if (requestQty <= 0) continue
      const stockCandidates = getSelectedInventoryCandidates(row)
      const stockCandidate = stockCandidates[0]
      const stockFields = stockCandidate ? inventoryAvailabilityToSubmitFields(stockCandidate) : undefined
      const suggestedCandidates = stockCandidates.map(c => ({
        warehouseNumber: c.warehouseNumber || '',
        warehouseName: c.warehouseName || '',
        lotNo: c.lotNo || '',
        stockLoc: c.stockLoc || '',
        inboundDate: (c as any).inboundDate || '',
        availableQty: c.availableQty ?? c.qty ?? 0,
      }))
      const res = await applyFeedRequest(orderId.value, {
        moBillNo: row.moBillNo,
        moEntrySeq: row.moEntrySeq,
        pbomEntryId: Number(row.pbomEntryId),
        requestQty,
        // 原因编码只按行填写；原因说明行级优先，留空时回退到表头批量输入。
        reasonNumber: (feedReasonNumberMap[String(row.pbomEntryId)] || '').trim() || undefined,
        reasonText: (feedReasonTextMap[String(row.pbomEntryId)] || '').trim() || feedBatchReasonText.value.trim(),
        priorityLevel: defaultPriorityLevel.value,
        applyUserName: feedApplyUserName.value || undefined,
        ...(stockFields || {}),
        ...(suggestedCandidates.length ? { suggestedCandidates } : {}),
      })
      if (res?.success !== false) {
        submittedCount += 1
      }
    }
    if (submittedCount === 0) {
      ElMessage.warning('没有可提交的补料申请，请检查本次补料数量和分录锁定状态')
      return
    }
    ElMessage.success('补料申请已提交')
    selectedFeedRows.value = []
    await Promise.all([loadFeedTasks(), loadMaterialList()])
  } catch (e: any) {
    showFlowActionError('提交补料申请', e, '提交补料申请失败')
  } finally {
    applyingFeedRequest.value = false
  }
}

function materialDocumentStatusType(status?: string) {
  const map: Record<string, string> = {
    A: 'info',
    B: 'warning',
    C: 'success',
    D: 'warning',
    Z: 'info',
  }
  return status ? (map[status] || 'info') : 'info'
}

function pickTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'pickStatus', status)
}

function pickTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREPARING: 'warning',
    PREPARED: 'success',
    ISSUING: 'primary',
    SUBMITTED: 'success',
    APPROVING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TERMINATED: 'info',
    CLOSED: 'info',
    FAILED: 'danger',
  }
  return map[status] || 'info'
}

function returnTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'returnStatus', status)
}

function returnTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREVIEWED: 'primary',
    SUBMITTED: 'primary',
    APPROVING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TERMINATED: 'info',
    INSPECTING: 'warning',
    INSPECTED: 'success',
    CLOSED: 'info',
    FAILED: 'danger',
  }
  return map[status] || 'info'
}

function feedTaskStatusText(status: string) {
  return resolveStatus('materialTask', 'feedStatus', status)
}

function feedTaskStatusType(status: string) {
  const map: Record<string, string> = {
    APPLIED: 'info',
    PREPARING: 'warning',
    PREPARED: 'success',
    PREVIEWED: 'primary',
    SUBMITTED: 'primary',
    APPROVING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    TERMINATED: 'info',
    CLOSED: 'info',
    FAILED: 'danger',
  }
  return map[status] || 'info'
}

function returnInspectionStatusText(status?: string) {
  return resolveStatus('inspection', 'returnStatus', status)
}

// ==================== 二维码 ====================
function refreshQrCode() {
  if (!orderId.value) return
  qrCodeUrl.value = getOrderQrCodeUrl(orderId.value) + '?t=' + Date.now()
}

// ==================== 文档预览 ====================
async function showDocumentDrawer(row: FlowCardItem) {
  documentStep.value = row
  documentDrawerVisible.value = true
  documentLoading.value = true
  previewDoc.value = null
  // 加载OnlyOffice配置
  await loadOnlyOfficeConfig()
  try {
    if (!orderId.value) { ElMessage.warning("工单尚未完成本地初始化"); return }
    const res = await getStepDocuments(orderId.value, row.stepNo)
    if (res.success) {
      stepDocuments.value = res.data || []
    }
  } catch (e: any) {
    console.error('加载工序文档失败', e)
    stepDocuments.value = []
  } finally {
    documentLoading.value = false
  }
}

function handleDocumentDrawerClose() {
  closePreview()
  documentStep.value = null
  stepDocuments.value = []
}

function closePreview() {
  // 销毁OnlyOffice实例
  if (onlyOfficeEditor.value) {
    try {
      onlyOfficeEditor.value.destroyEditor()
    } catch (e) {
      console.warn('OnlyOffice销毁失败', e)
    }
    onlyOfficeEditor.value = null
  }
  previewDoc.value = null
}

async function previewDocument(doc: ProcessStepDocumentItem) {
  await openDocumentPreview({
    documentId: doc.id,
    fileExt: doc.fileExt,
    fileName: doc.originalFilename,
    source: 'process-route-document',
    url: getDocumentFileDownloadUrl(doc.filePath),
  })
}

function downloadDocument(doc: ProcessStepDocumentItem) {
  const url = getDocumentFileDownloadUrl(doc.filePath)
  window.open(url, '_blank')
}

function isPdfFile(ext?: string): boolean {
  return ext?.toLowerCase() === 'pdf'
}

function isImageFile(ext?: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext?.toLowerCase() || '')
}

function isOfficeFile(ext?: string): boolean {
  if (!ext) return false
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
  return officeExts.includes(ext.toLowerCase())
}

function formatDuration(value?: number, unit?: string): string {
  if (!value || value <= 0) return ''
  const unitText: Record<string, string> = { SECOND: '秒', MINUTE: '分钟', HOUR: '小时' }
  return `${value}${unitText[unit || ''] || '秒'}`
}

function formatStandardHours(row: FlowCardItem): string {
  const standardValue = row.standardDuration || row.standardHours
  const standardText = formatDuration(standardValue, row.timeUnit)
  const setupValue = row.setupDuration || row.setupTime
  const setupText = formatDuration(setupValue, row.setupTimeUnit || row.timeUnit)
  if (!standardText && !setupText) return '未设置'
  const parts = []
  if (standardText) parts.push(`标准 ${standardText}`)
  if (row.completeQuantity && row.completeQuantity > 0) parts.push(`/ ${row.completeQuantity}件`)
  if (setupText) parts.push(`准备 ${setupText}`)
  return parts.join(' ')
}

function getDocumentPreviewUrl(filePath: string): string {
  return getDocumentFileDownloadUrl(filePath)
}

function formatDocumentType(type?: string): string {
  const map: Record<string, string> = { INSPECTION_STANDARD: '检验标准', PROCESS_FILE: '工艺文件', SOP: '作业指导书' }
  return map[type || ''] || type || '未知'
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ==================== OnlyOffice 预览 ====================
async function loadOnlyOfficeConfig() {
  try {
    const res = await getOnlyOfficeConfig()
    if (res.success && res.data) {
      onlyOfficeEnabled.value = res.data.enabled
      onlyOfficeDocumentServerUrl.value = res.data.documentServerUrl
      onlyOfficeJwtEnabled.value = res.data.jwtEnabled
      if (res.data.enabled) {
        await loadOnlyOfficeScript()
      }
    }
  } catch (e) {
    console.warn('获取OnlyOffice配置失败', e)
  }
}

function loadOnlyOfficeScript(): Promise<void> {
  return new Promise((resolve) => {
    if (onlyOfficeScriptLoaded.value) {
      resolve()
      return
    }
    // 检查是否已全局加载
    if ((window as any).DocsAPI) {
      onlyOfficeScriptLoaded.value = true
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = onlyOfficeDocumentServerUrl.value + '/web-apps/apps/api/documents/api.js'
    script.async = true
    script.onload = () => {
      onlyOfficeScriptLoaded.value = true
      resolve()
    }
    script.onerror = () => {
      console.warn('OnlyOffice脚本加载失败')
      resolve() // 即使失败也resolve，避免阻塞流程
    }
    document.body.appendChild(script)
  })
}

</script>

<style scoped>
.order-detail-container {
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}
.detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.header-title {
  font-size: 18px;
  font-weight: bold;
  margin-left: 12px;
}
.detail-body {
  flex: 1;
  overflow: auto;
}
.section-card :deep(.el-card__header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tab-toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}
.material-drawer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.material-drawer-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.route-bound-info {
  padding: 8px 0;
}
.route-empty {
  padding: 20px 0;
}
.qrcode-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 16px;
}
.qrcode-card {
  width: min(360px, 100%);
  text-align: center;
}
.qrcode-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 20px;
}
.qrcode-image {
  width: min(260px, 100%);
  aspect-ratio: 1;
  object-fit: contain;
}
.qrcode-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(260px, 100%);
  aspect-ratio: 1;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}
.qrcode-actions {
  margin-top: 12px;
}

/* 文档预览样式 */
.document-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.document-item:last-child {
  border-bottom: none;
}
.document-info {
  flex: 1;
  min-width: 0;
}
.document-name {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
}
.document-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.document-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.document-actions {
  flex-shrink: 0;
  margin-left: 16px;
}
.document-preview-area {
  margin-top: 8px;
}
.preview-header {
  margin-bottom: 12px;
}
.office-preview-hint {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

/* OnlyOffice预览容器 */
.onlyoffice-wrapper {
  width: 100%;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}
.onlyoffice-container {
  width: 100%;
  height: 100%;
}

/* 移动端适配 */

.flow-step-cell,
.flow-action-cell,
.flow-batch-cell,
.flow-claim-cell,
.inspection-task-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.flow-step-name {
  color: var(--el-color-primary);
  cursor: help;
  text-decoration: underline dotted var(--el-color-primary-light-5);
  text-underline-offset: 3px;
}
.flow-step-qrcode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
}
.flow-step-qrcode-title {
  font-size: 13px;
  font-weight: 600;
}
.flow-step-qrcode-image,
.flow-step-qrcode-empty {
  width: 160px;
  height: 160px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}
.flow-step-qrcode-image {
  object-fit: contain;
  padding: 6px;
}
.flow-step-qrcode-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
.flow-step-qrcode-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 180px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
:global(.flow-step-qrcode-popover) {
  --el-popover-padding: 12px;
}
.claim-owner {
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-action-cell .el-button + .el-button {
  margin-left: 0;
}
.inventory-candidate-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.inventory-candidate-summary {
  min-width: 58px;
  color: #606266;
  font-size: 12px;
  white-space: nowrap;
}
.report-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f8fafc;
}
.report-step-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.report-step-meta {
  display: flex;
  gap: 14px;
  margin-top: 4px;
  color: #606266;
  font-size: 12px;
}
.report-form :deep(.el-input-number .el-input__inner) {
  text-align: left;
}
.actual-time-inputs {
  display: grid;
  grid-template-columns: minmax(70px, 1fr) auto minmax(62px, 0.8fr) auto minmax(62px, 0.8fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.actual-time-inputs :deep(.el-input-number) {
  width: 100%;
}
.actual-time-inputs span {
  color: #606266;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .onlyoffice-wrapper {
    height: 60vh;
  }
}

/* 文档预览区域在移动端适配 */


@media (max-width: 768px) {
  .document-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .document-actions {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
    display: flex;
    gap: 8px;
  }
  .document-actions .el-button {
    flex: 1;
  }
}
</style>
