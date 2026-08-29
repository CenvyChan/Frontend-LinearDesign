<template>
  <div class="process-route-container">
    <!-- == 鍒楄〃妯″紡锛氭悳绱?琛ㄦ牸+鍒嗛〉 == -->
    <template v-if="!showForm">
      <div class="search-area">
        <el-input v-model="searchKeyword" placeholder="搜索编码/名称/物料" clearable style="width:200px" @keyup.enter="handleSearch" />
        <el-select v-model="searchCategory" placeholder="工艺分类" clearable style="width:140px">
          <el-option v-for="(label,key) in RouteCategoryLabels" :key="key" :label="label" :value="key" />
        </el-select>
        <el-select v-model="searchStatus" placeholder="状态" clearable style="width:120px">
          <el-option v-for="(label,key) in RouteStatusLabels" :key="key" :label="label" :value="key" />
        </el-select>
        <el-checkbox v-model="latestOnly" @change="handleSearch">只取最新版本</el-checkbox>
        <el-button type="primary" @click="handleSearch" :icon="'Search'">搜索</el-button>
        <el-button type="success" @click="handleAdd" :icon="'Plus'">新增</el-button>
        <el-button :icon="'Download'" @click="handleExport">导出</el-button>
        <el-divider direction="vertical" />
        <el-button :disabled="selectedRows.length===0" @click="handleBatchCopySelected" :icon="'CopyDocument'">复制选中</el-button>
        <el-button :disabled="selectedRows.length===0" @click="handleExportSelected" :icon="'Download'">导出选中</el-button>
        <el-button :disabled="selectedRows.length===0" @click="openBatchAction('SUBMIT')" :icon="'Check'">批量提交</el-button>
        <el-button :disabled="selectedRows.length===0" @click="openBatchAction('APPROVE')" :icon="'Check'">批量审核</el-button>
        <el-button :disabled="selectedRows.length===0" @click="openBatchAction('ACTIVATE')" :icon="'Check'">批量启用</el-button>
        <el-button :disabled="selectedRows.length===0" @click="openBatchAction('DISABLE')" :icon="'Delete'">批量失效</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" border stripe @selection-change="handleSelectionChange" @row-dblclick="openRowActionDialog">
        <el-table-column type="selection" width="44" />
        <el-table-column prop="routeCode" label="路线编码" width="130" show-overflow-tooltip />
        <el-table-column prop="routeName" label="路线名称" width="140" show-overflow-tooltip />
        <el-table-column prop="routeCategory" label="分类" width="100">
          <template #default="{row}">{{ RouteCategoryLabels[row.routeCategory] || '-' }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column prop="materialCode" label="物料编码" width="130" />
        <el-table-column prop="materialName" label="物料名称" width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{row}">
            <el-tag :type="statusTagType(row.status)" size="small">{{ resolveStatus('processRoute', 'status', row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="420" fixed="right">
          <template #default="{row}">
            <div class="action-buttons">
              <el-button size="small" link @click="handleView(row)" :icon="'View'">查看</el-button>
              <el-button size="small" link type="primary" @click="handleIterate(row)" v-if="row.status===RouteStatus.ACTIVE" :icon="'RefreshRight'">迭代</el-button>
              <el-button size="small" link type="warning" @click="handleEdit(row)" v-if="row.status===RouteStatus.DRAFT||row.status===RouteStatus.REVIEWING" :icon="'Edit'">编辑</el-button>
              <el-button size="small" link type="success" @click="handleStatusAction(row)" v-if="row.status===RouteStatus.DRAFT" :icon="'Check'">提交</el-button>
              <el-button size="small" link type="success" @click="handleStatusAction(row)" v-if="row.status===RouteStatus.REVIEWING" :icon="'Check'">审核</el-button>
              <el-button size="small" link type="success" @click="handleStatusAction(row)" v-if="row.status===RouteStatus.APPROVED" :icon="'Check'">启用</el-button>
              <el-button size="small" link type="info" @click="handleStatusAction(row)" v-if="row.status===RouteStatus.ACTIVE" :icon="'Delete'">失效</el-button>
              <el-button size="small" link type="warning" @click="handleStatusAction(row)" v-if="row.status===RouteStatus.DISABLED" :icon="'RefreshRight'">重新生效</el-button>
              <el-button size="small" link @click="handleCopy(row)" :icon="'CopyDocument'">复制</el-button>
              <el-button size="small" link type="danger" @click="handleDelete(row)" v-if="row.status!==RouteStatus.ACTIVE" :icon="'Delete'">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-area">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total"
          :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData" @current-change="loadData" />
      </div>
    </template>

    <!-- == 新增/编辑 内联表单 (替代抽屉+Tabs) == -->
    <div v-if="showForm" class="form-container" v-loading="formLoading">
      <div style="margin-bottom:16px">
        <el-button @click="closeForm" :icon="'ArrowLeft'">返回列表</el-button>
        <span style="margin-left:12px;font-size:16px;font-weight:bold">{{ drawerTitle }}</span>
        <span v-if="editId" style="margin-left:12px;color:#909399;font-size:13px">版本: {{ formData.version || '-' }}</span>
        <el-button v-if="editId" size="small" style="margin-left:12px" @click="openVersionHistory" :icon="'View'"><span style="display:flex;align-items:center;gap:4px">版本历史</span></el-button>
      </div>

      <!-- 基础信息卡片 -->
      <el-card class="form-section-card">
        <template #header><span>基础信息</span></template>
        <el-form :model="formData" label-width="110px" size="small">
          <el-row :gutter="20">
            <el-col :span="6"><el-form-item label="工艺路线编码" required><el-input v-model="formData.routeCode" :disabled="isViewMode" /></el-form-item></el-col>
            <el-col :span="6"><el-form-item label="工艺路线名称"><el-input v-model="formData.routeName" :disabled="isViewMode" /></el-form-item></el-col>
            <el-col :span="6"><el-form-item label="工艺路线分类">
              <el-select v-model="formData.routeCategory" :disabled="isViewMode" style="width:100%">
                <el-option v-for="(label,key) in RouteCategoryLabels" :key="key" :label="label" :value="key" />
              </el-select>
            </el-form-item></el-col>
            <el-col :span="6"><el-form-item label="版本号"><el-input v-model="formData.version" :disabled="isViewMode" /></el-form-item></el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="8"><el-form-item label="物料编码">
              <div :class="{'material-code-error': materialCodeError}" style="display:flex;align-items:center;flex:1">
                <el-autocomplete v-model="formData.materialCode" :fetch-suggestions="searchMaterialSuggestions"
                  :disabled="isViewMode" :loading="materialSearchLoading" placeholder="输入编码/名称搜索物料"
                  value-key="number" popper-class="material-suggestion-popper" clearable @select="onMaterialSelected" @clear="handleMaterialCodeClear"
                  @input="handleMaterialCodeInput" @blur="onMaterialCodeBlur" style="flex:1">
                  <template #default="{ item }">
                    <div class="material-suggestion">
                      <span>{{ item.number }}</span>
                      <span>{{ item.name || '-' }}</span>
                      <span>{{ item.specification || '-' }}</span>
                    </div>
                  </template>
                </el-autocomplete>
                <el-button type="primary" link :icon="'Plus'" :disabled="!formData.materialCode||isViewMode" @click="openMaterialDialog" />
              </div>
            </el-form-item></el-col>
            <el-col :span="8"><el-form-item label="物料名称"><el-input v-model="formData.materialName" :disabled="isViewMode" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="产品规格"><el-input v-model="formData.productSpec" :disabled="isViewMode" /></el-form-item></el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="8"><el-form-item label="BOM版本号">
              <div style="display:flex;align-items:center">
                <el-input v-model="formData.bomVersion" :disabled="isViewMode" style="flex:1" />
                <el-button type="primary" link :icon="'Search'" :disabled="!formData.materialCode||isViewMode" @click="openBomVersionDialog" />
              </div>
            </el-form-item></el-col>
            <el-col :span="8"><el-form-item label="客户名称">
              <div style="display:flex;align-items:center">
                <el-autocomplete v-model="formData.customerName" :fetch-suggestions="searchCustomerSuggestions"
                  :disabled="isViewMode" placeholder="输入编码/名称搜索客户"
                  value-key="label" clearable @select="onCustomerSelected" @clear="handleCustomerNameInput('')" @input="handleCustomerNameInput" @blur="onCustomerBlur" style="flex:1" />
                <el-button type="primary" link :icon="'Search'" :disabled="isViewMode" @click="openCustomerDialog" />
              </div>
            </el-form-item></el-col>
            <el-col :span="8"><el-form-item label="项目名称"><el-input v-model="formData.projectName" :disabled="isViewMode" /></el-form-item></el-col>
          </el-row>
          <el-form-item label="备注"><el-input v-model="formData.remark" type="textarea" :rows="2" :disabled="isViewMode" /></el-form-item>
        </el-form>
      </el-card>

      <!-- 工序流程卡片 -->
      <el-card class="form-section-card">
        <template #header><span>工序流程</span></template>
        <!-- 宸ュ簭娴佺▼鍥炬寚绀?-->
        <div class="step-flow-indicator" v-if="(formData.steps||[]).length>0">
          <div class="flow-steps">
            <div v-for="(step,idx) in formData.steps" :key="idx" class="flow-step-item" :class="{'active':selectedStepIndex===idx}" @click="selectedStepIndex=idx">
              <div class="flow-circle">{{ idx+1 }}</div>
              <div class="flow-label">{{ step.processName || step.processCode || '工序'+(idx+1) }}</div>
              <div v-if="idx<(formData.steps||[]).length-1" class="flow-arrow">→</div>
            </div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <el-button type="primary" size="small" @click="addStep" :disabled="isViewMode">添加工序</el-button>
          <el-button type="success" size="small" @click="saveStepOrder" :disabled="isViewMode" :icon="'Check'">保存排序</el-button>
        </div>
        <el-table :data="formData.steps" border size="small" max-height="400">
          <el-table-column label="排序" width="64" align="center">
            <template #default="{ $index }">
              <div class="step-order-actions">
                <el-tooltip content="上移" placement="top">
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :disabled="$index===0||isViewMode"
                    aria-label="上移"
                    @click="moveStep($index,-1)">
                    <span class="step-order-arrow" aria-hidden="true">↑</span>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="下移" placement="top">
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :disabled="$index===(formData.steps?.length??0)-1||isViewMode"
                    aria-label="下移"
                    @click="moveStep($index,1)">
                    <span class="step-order-arrow" aria-hidden="true">↓</span>
                  </el-button>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="工序池" min-width="220">
            <template #default="{row}">
              <el-select
                v-model="row.processPoolId"
                clearable
                filterable
                :disabled="isViewMode"
                :loading="processPoolLoading"
                placeholder="选择工序池"
                size="small"
                style="width:100%"
                @change="applyProcessPoolToStep(row, row.processPoolId)"
              >
                <el-option
                  v-for="item in processPoolOptions"
                  :key="item.id"
                  :label="`${item.processCode} ${item.processName}`"
                  :value="item.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="工序代码" width="100">
            <template #default="{row}"><el-input v-model="row.processCode" size="small" :disabled="isViewMode" /></template>
          </el-table-column>
          <el-table-column label="工序名称" width="100">
            <template #default="{row}"><el-input v-model="row.processName" size="small" :disabled="isViewMode" /></template>
          </el-table-column>
          <el-table-column label="步骤名称" width="120">
            <template #default="{row}"><el-input v-model="row.stepName" size="small" :disabled="isViewMode" /></template>
          </el-table-column>
          <el-table-column label="标准工时" min-width="220">
            <template #default="{row}">
              <div style="display:flex;gap:4px;align-items:center">
                <el-select v-model="row.timeUnit" :disabled="isViewMode" size="small" style="width:70px">
                  <el-option v-for="(l,k) in TimeUnitLabels" :key="k" :label="l" :value="k" />
                </el-select>
                <el-input v-model="row.standardDuration" type="number" min="0" :disabled="isViewMode" size="small" style="width:60px" placeholder="时长" />
                <span style="color:#999;font-size:12px">/</span>
                <el-input v-model="row.completeQuantity" type="number" min="1" :disabled="isViewMode" size="small" style="width:60px" placeholder="数量" />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="准备工时" min-width="170">
            <template #default="{row}">
              <div style="display:flex;gap:4px;align-items:center">
                <el-select v-model="row.setupTimeUnit" :disabled="isViewMode" size="small" style="width:70px">
                  <el-option v-for="(l,k) in TimeUnitLabels" :key="k" :label="l" :value="k" />
                </el-select>
                <el-input v-model="row.setupDuration" type="number" min="0" :disabled="isViewMode" size="small" style="width:60px" placeholder="时长" />
              </div>
            </template>
          </el-table-column>
          <!-- 参数行内直接显示 -->
          <el-table-column label="检验" width="110">
            <template #default="{row, $index}">
              <el-tooltip
                v-if="isLastStep($index)"
                content="末道工序必须报检(QC)，不可修改"
                placement="top"
              >
                <el-select v-model="row.inspectionMethod" disabled size="small" style="width:100%">
                  <el-option v-for="(l,k) in InspectionMethodLabels" :key="k" :label="l" :value="k" />
                </el-select>
              </el-tooltip>
              <el-select v-else v-model="row.inspectionMethod" :disabled="isViewMode" size="small" style="width:100%">
                <el-option v-for="(l,k) in InspectionMethodLabels" :key="k" :label="l" :value="k" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="汇报" width="110">
            <template #default="{row}">
              <el-select v-model="row.reportMethod" :disabled="isViewMode" size="small" style="width:100%">
                <el-option v-for="(l,k) in ReportMethodLabels" :key="k" :label="l" :value="k" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="汇报控制" width="110">
            <template #default="{row}">
              <el-select v-model="row.reportOrder" :disabled="isViewMode" size="small" style="width:100%">
                <el-option v-for="(l,k) in ReportOrderLabels" :key="k" :label="l" :value="k" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="缺陷" width="280">
            <template #default="{row}">
              <el-select v-model="row.defectTypes" multiple filterable allow-create default-first-option :disabled="isViewMode" size="small" style="width:100%">
                <el-option v-for="d in commonDefects" :key="d" :label="d" :value="d" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ $index }">
              <el-button size="small" type="danger" @click="removeStep($index)" :disabled="isViewMode" :icon="'Delete'">删除该工序</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 资源绑定卡片 -->
      <el-card class="form-section-card">
        <template #header><span>资源绑定</span></template>
        <div class="resource-cards">
          <div class="resource-group">
            <div class="resource-header">
              <span>工作中心</span>
              <el-button size="small" type="primary" link @click="openResourceDialogForStep('workCenter')" :disabled="isViewMode" :icon="'Plus'">添加</el-button>
            </div>
            <div class="resource-tags">
              <template v-for="(wc,idx) in currentStepResources('workCenters')" :key="idx">
                <el-tag closable :disable-transitions="isViewMode" @close="removeStepResource('workCenters',idx)">{{ wc.workCenter?.name || wc.workCenterName || '工作中心' }}</el-tag>
              </template>
              <span v-if="currentStepResources('workCenters').length===0" class="resource-empty">未绑定</span>
            </div>
          </div>
          <div class="resource-group">
            <div class="resource-header">
              <span>机台设备</span>
              <el-button size="small" type="primary" link @click="openResourceDialogForStep('machine')" :disabled="isViewMode" :icon="'Plus'">添加</el-button>
            </div>
            <div class="resource-tags">
              <template v-for="(m,idx) in currentStepResources('machines')" :key="idx">
                <el-tag closable :disable-transitions="isViewMode" @close="removeStepResource('machines',idx)">{{ m.machine?.name || m.machineName || m.machine?.code || m.machineCode || '设备' }}</el-tag>
              </template>
              <span v-if="currentStepResources('machines').length===0" class="resource-empty">未绑定</span>
            </div>
          </div>
          <div class="resource-group">
            <div class="resource-header">
              <span>工装夹具</span>
              <el-button size="small" type="primary" link @click="openResourceDialogForStep('tooling')" :disabled="isViewMode" :icon="'Plus'">添加</el-button>
            </div>
            <div class="resource-tags">
              <template v-for="(t,idx) in currentStepResources('toolings')" :key="idx">
                <el-tag closable :disable-transitions="isViewMode" @close="removeStepResource('toolings',idx)">{{ t.tooling?.name || t.toolingName || t.tooling?.code || t.toolingCode || '工装' }}</el-tag>
              </template>
              <span v-if="currentStepResources('toolings').length===0" class="resource-empty">未绑定</span>
            </div>
          </div>
          <div class="resource-group">
            <div class="resource-header">
              <span>量具检具</span>
              <el-button size="small" type="primary" link @click="openResourceDialogForStep('gauge')" :disabled="isViewMode" :icon="'Plus'">添加</el-button>
            </div>
            <div class="resource-tags">
              <template v-for="(g,idx) in currentStepResources('gauges')" :key="idx">
                <el-tag closable :disable-transitions="isViewMode" @close="removeStepResource('gauges',idx)">{{ g.gauge?.name || g.gaugeName || g.gauge?.code || g.gaugeCode || '量具' }}</el-tag>
              </template>
              <span v-if="currentStepResources('gauges').length===0" class="resource-empty">未绑定</span>
            </div>
          </div>
          <div class="resource-group">
            <div class="resource-header">
              <span>模具</span>
              <el-button size="small" type="primary" link @click="openResourceDialogForStep('mould')" :disabled="isViewMode" :icon="'Plus'">添加</el-button>
            </div>
            <div class="resource-tags">
              <template v-for="(md,idx) in currentStepResources('moulds')" :key="idx">
                <el-tag closable :disable-transitions="isViewMode" @close="removeStepResource('moulds',idx)">
                  {{ md.mould?.mouldName || md.mouldName || md.mould?.mouldCode || md.mouldCode || '模具' }}
                  <span style="margin-left:4px;color:#909399;font-size:11px">(绌?{{ md.cavityCount || '-' }}, 姣忔ā={{ md.outputPerShot || 1 }})</span>
                </el-tag>
              </template>
              <span v-if="currentStepResources('moulds').length===0" class="resource-empty">未绑定</span>
            </div>
          </div>
          <div v-if="!selectedStep" class="resource-empty-hint">请先在工序流程中选择一个工序步骤</div>
        </div>
      </el-card>

      <!-- 工序文档卡片 -->
      <el-card class="form-section-card">
        <template #header><span>工序文档（检验标准/工艺文件/SOP）</span></template>
        <div v-if="!selectedStep" class="resource-empty-hint">请先在工序流程中选择一个工序步骤</div>
        <div v-else>
          <div style="margin-bottom:12px">
            <el-button size="small" type="primary" @click="openDocUploadDialog" :disabled="isViewMode" :icon="'Upload'">上传文档</el-button>
          </div>
          <el-table :data="stepDocuments" border size="small" v-loading="docLoading" max-height="300" v-if="stepDocuments.length">
            <el-table-column label="文档名称" min-width="160">
              <template #default="{row}">{{ row.docName }}</template>
            </el-table-column>
            <el-table-column label="类型" width="130">
              <template #default="{row}">
                <el-tag :type="DocTypeColors[row.docType] || ''" size="small">{{ DocTypeLabels[row.docType] || row.docType }}</el-tag>
              </template>
            </el-table-column>
	            <el-table-column label="文件名" min-width="200">
              <template #default="{row}">{{ row.originalFilename }}</template>
            </el-table-column>
	            <el-table-column label="上传人" width="100">
              <template #default="{row}">{{ row.createdByName || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{row}">
                <el-button size="small" type="danger" link @click="handleDeleteDocument(row)" :disabled="isViewMode" :icon="'Delete'">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!stepDocuments.length && !docLoading" style="color:#999;text-align:center;padding:20px">暂无文档，点击上方按钮上传</div>
        </div>
      </el-card>

      <!-- BOM物料清单卡片 -->
      <el-card class="form-section-card">
        <template #header><span>EBOM物料清单</span></template>
        <el-table :data="bomData" border size="small" v-loading="bomLoading" max-height="400">
          <el-table-column label="序号" type="index" width="60" />
          <el-table-column prop="childMaterialNumber" label="物料编码" width="140" />
          <el-table-column prop="childMaterialName" label="物料名称" width="160" show-overflow-tooltip />
          <el-table-column prop="materialModel" label="物料规格" min-width="320" />
          <el-table-column label="基本用量" width="110">
            <template #default="{row}">{{ calcQuantity(row) }}</template>
          </el-table-column>
          <el-table-column prop="numerator" label="分子" width="80" />
          <el-table-column prop="denominator" label="分母" width="80" />
          <el-table-column label="损耗率" width="100">
            <template #default="{row}">{{ calcScrapRate(row) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="!bomData.length && !bomLoading" style="color:#999;text-align:center;padding:20px">
          选择物料后自动查询最新BOM版本并展开
        </div>
      </el-card>

      <!-- 底部操作按钮 -->
      <div class="form-action-bar">
        <el-button @click="closeForm">取消</el-button>
        <el-button :loading="submitting" @click="handleDraftSave" v-if="!isViewMode && !isIterateMode" :icon="'RefreshRight'">暂存</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit" v-if="!isViewMode && !isIterateMode" :icon="'RefreshRight'">保存</el-button>
        <el-button type="primary" :loading="submitting" @click="handleIterateSubmit" v-if="isIterateMode" :icon="'RefreshRight'">确认迭代</el-button>
        <el-button @click="closeForm" v-if="isViewMode && !isIterateMode">关闭</el-button>
      </div>
    </div>

    <!-- == 璧勬簮閫夋嫨瀵硅瘽妗?== -->
    <el-dialog v-model="resourceDialog.visible" :title="resourceDialog.title" width="720px" destroy-on-close>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <el-input
          v-model="resourceDialog.keyword"
          :placeholder="resourceDialog.type === 'workCenter' ? '工作中心编码/名称' : resourceDialog.type === 'machine' ? '机台编码/名称' : resourceDialog.type === 'tooling' ? '工装编码/名称' : resourceDialog.type === 'gauge' ? '量具编码/名称' : '模具编码/名称'"

          style="width:220px"
          @keyup.enter="searchResourceList"
        />
        <el-button type="primary" @click="searchResourceList" :icon="'Search'">搜索</el-button>
        <el-button @click="resetResourceSearch" :icon="'RefreshRight'">重置</el-button>
      </div>
      <el-table ref="resourceTableRef" :data="resourceDialog.list" border size="small" row-key="id" reserve-selection @selection-change="onResourceSelectChange">
        <el-table-column type="selection" width="40" />
        <el-table-column label="编码" width="120">
          <template #default="{row}">{{ row.code || row.mouldCode || '-' }}</template>
        </el-table-column>
        <el-table-column label="名称" width="150">
          <template #default="{row}">{{ row.name || row.mouldName || '-' }}</template>
        </el-table-column>
        <el-table-column label="型号" width="120">
          <template #default="{row}">{{ row.model || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{row}">{{ resolveStatus('processRoute', 'status', row.status) }}</template>
        </el-table-column>
      </el-table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <el-pagination
          v-model:current-page="resourceDialog.currentPage"
          v-model:page-size="resourceDialog.pageSize"
          :page-sizes="[10,20,50]"
          :total="resourceDialog.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleResourcePageChange"
          @current-change="handleResourcePageChange"
        />
      </div>
      <template #footer>
        <el-button @click="resourceDialog.visible=false">取消</el-button>
        <el-button type="primary" @click="confirmResourceBinding">确定</el-button>
      </template>
    </el-dialog>

    <!-- == BOM鐗堟湰閫夋嫨瀵硅瘽妗?== -->
    <el-dialog v-model="bomVersionDialog.visible" title="选择BOM版本" width="600px" destroy-on-close>
      <el-table :data="bomVersionDialog.list" border size="small" highlight-current-row @current-change="onBomVersionSelectChange">
	        <el-table-column prop="bomNumber" label="BOM版本号" min-width="180" />
	        <el-table-column prop="documentStatus" label="状态" width="80">
	          <template #default="{row}">{{ row.documentStatus==='C'?'已审核':row.documentStatus }}</template>
        </el-table-column>
      </el-table>
      <p v-if="bomVersionDialog.list.length===0 && !bomVersionDialog.loading" style="color:#999;text-align:center;padding:20px">暂无BOM版本数据</p>
      <template #footer>
        <el-button @click="bomVersionDialog.visible=false">取消</el-button>
        <el-button type="primary" @click="confirmBomVersionSelection">确定</el-button>
      </template>
    </el-dialog>

    <!-- == 瀹㈡埛鎼滅储瀵硅瘽妗?== -->
    <el-dialog v-model="customerDialog.visible" title="选择客户" width="600px" destroy-on-close>
      <el-input v-model="customerDialog.keyword" placeholder="输入客户编码/名称搜索" clearable style="margin-bottom:12px" @keyup.enter="searchCustomerData" />
      <el-button type="primary" size="small" :loading="customerDialog.loading" @click="searchCustomerData" style="margin-bottom:12px;margin-left:8px" :icon="'Search'">搜索</el-button>
      <el-table :data="customerDialog.list" border size="small" highlight-current-row @current-change="onCustomerSelectChange" max-height="400">
        <el-table-column prop="number" label="客户编码" width="140" />
        <el-table-column prop="name" label="客户名称" min-width="200" />
      </el-table>
      <p v-if="customerDialog.list.length===0 && !customerDialog.loading" style="color:#999;text-align:center;padding:20px">输入关键字后点击搜索</p>
      <template #footer>
        <el-button @click="customerDialog.visible=false">取消</el-button>
        <el-button type="primary" @click="confirmCustomerSelection">确定</el-button>
      </template>
    </el-dialog>

    <!-- == 鐗╂枡鎼滅储瀵硅瘽妗?== -->
    <el-dialog v-model="materialDialog.visible" title="选择物料" width="700px" destroy-on-close>
      <el-input v-model="materialDialog.keyword" placeholder="输入物料编码/名称搜索" clearable style="margin-bottom:12px" @keyup.enter="searchMaterialData" />
      <el-button type="primary" size="small" :loading="materialDialog.loading" @click="searchMaterialData" style="margin-bottom:12px;margin-left:8px" :icon="'Search'">搜索</el-button>
      <el-table :data="materialDialog.list" border size="small" highlight-current-row @current-change="onMaterialSelectChange" max-height="400">
        <el-table-column prop="number" label="物料编码" width="140" />
        <el-table-column prop="name" label="物料名称" min-width="160" />
        <el-table-column prop="specification" label="规格型号" min-width="140" />
      </el-table>
      <p v-if="materialDialog.list.length===0 && !materialDialog.loading" style="color:#999;text-align:center;padding:20px">输入关键字后点击搜索</p>
      <template #footer>
        <el-button @click="materialDialog.visible=false">取消</el-button>
        <el-button type="primary" @click="confirmMaterialSelection">确定</el-button>
      </template>
    </el-dialog>

    <!-- == 鏂囨。涓婁紶瀵硅瘽妗?== -->
    <el-dialog v-model="docUploadDialog.visible" title="上传工序文档" width="500px" destroy-on-close>
      <el-form :model="docUploadDialog.form" label-width="100px" size="small">
        <el-form-item label="文档类型" required>
          <el-select v-model="docUploadDialog.form.docType" style="width:100%">
            <el-option v-for="(label,key) in DocTypeLabels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="文档名称" required>
          <el-input v-model="docUploadDialog.form.docName" placeholder="输入文档名称" />
        </el-form-item>
        <el-form-item label="选择文件" required>
          <input type="file" ref="fileInputRef" style="width:100%" @change="onFileSelected" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.dwg" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="docUploadDialog.form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="docUploadDialog.visible=false">取消</el-button>
        <el-button type="primary" :loading="docUploading" @click="handleDocUpload" :icon="'Upload'">上传</el-button>
      </template>
   </el-dialog>

    <!-- == 鐗堟湰鍘嗗彶瀵硅瘽妗?== -->
    <el-dialog v-model="versionHistory.visible" title="版本历史" width="700px" destroy-on-close>
      <el-table :data="versionHistory.list" border size="small" v-loading="versionHistory.loading" highlight-current-row @row-click="onVersionSelect" max-height="400">
        <el-table-column prop="routeCode" label="路线编码" width="140" />
        <el-table-column prop="version" label="版本" width="80" />
	        <el-table-column label="状态" width="90">
          <template #default="{row}">
            <el-tag :type="statusTagType(row.status)" size="small">{{ resolveStatus('processRoute', 'status', row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="routeName" label="路线名称" min-width="160" />
        <el-table-column prop="materialCode" label="物料编码" width="130" />
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click="switchToVersion(row)" v-if="row.id !== editId" :icon="'RefreshRight'">切换至此版本</el-button>
            <span v-else style="color:#909399;font-size:12px">当前版本</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="versionHistory.visible=false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rowActionDialog.visible" title="工艺路线操作" width="620px" destroy-on-close>
      <div v-if="rowActionDialog.row" class="route-action-summary">
        <div><span>路线编码</span><strong>{{ rowActionDialog.row.routeCode || '-' }}</strong></div>
        <div><span>路线名称</span><strong>{{ rowActionDialog.row.routeName || '-' }}</strong></div>
        <div><span>物料</span><strong>{{ rowActionDialog.row.materialCode || '-' }}</strong></div>
        <div><span>版本</span><strong>{{ rowActionDialog.row.version || '-' }}</strong></div>
        <div><span>状态</span><el-tag :type="statusTagType(rowActionDialog.row.status)" size="small">{{ resolveStatus('processRoute', 'status', rowActionDialog.row.status) }}</el-tag></div>
      </div>
      <div v-if="rowActionDialog.row" class="route-action-panel">
        <el-button v-for="action in availableRowActions(rowActionDialog.row)" :key="action.key" :type="action.type" :icon="action.icon" @click="runRowAction(action.key)">
          {{ action.label }}
        </el-button>
      </div>
      <template #footer>
        <el-button @click="rowActionDialog.visible=false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchConfirm.visible" :title="`${batchConfirm.label}确认`" width="760px" destroy-on-close>
      <div class="batch-summary">
        已选择 {{ selectedRows.length }} 行，可执行 {{ batchExecutableRows.length }} 行，跳过 {{ batchSkippedRows.length }} 行。
      </div>
      <el-table :data="selectedRows" border size="small" max-height="320">
        <el-table-column prop="routeCode" label="路线编码" width="140" show-overflow-tooltip />
        <el-table-column prop="routeName" label="路线名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{row}">{{ resolveStatus('processRoute', 'status', row.status) }}</template>
        </el-table-column>
        <el-table-column label="预检结果" width="180">
          <template #default="{row}">
            <el-tag :type="canBatchOperate(row, batchConfirm.action) ? 'success' : 'info'" size="small">
              {{ canBatchOperate(row, batchConfirm.action) ? '可执行' : batchSkipText(row, batchConfirm.action) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="batchConfirm.visible=false">取消</el-button>
        <el-button type="primary" :loading="batchConfirm.loading" @click="confirmBatchAction">确认执行</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchResult.visible" title="批量操作结果" width="820px" destroy-on-close>
      <div class="batch-summary">
        本次{{ batchResult.actionLabel }}共选择 {{ batchResult.total }} 行，成功 {{ batchResult.successCount }} 行，失败 {{ batchResult.failedCount }} 行，跳过 {{ batchResult.skippedCount }} 行。
      </div>
      <el-table :data="batchResult.items" border size="small" max-height="360">
        <el-table-column prop="routeCode" label="路线编码" width="140" show-overflow-tooltip />
        <el-table-column prop="routeName" label="路线名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="action" label="操作" width="110">
          <template #default="{row}">{{ batchActionLabels[row.action] || row.action }}</template>
        </el-table-column>
        <el-table-column prop="status" label="结果" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'SUCCESS' ? 'success' : row.status === 'SKIPPED' ? 'info' : 'danger'" size="small">
              {{ row.status === 'SUCCESS' ? '成功' : row.status === 'SKIPPED' ? '跳过' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="失败原因" min-width="180" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="closeBatchResult">关闭</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ProcessRoute' })

import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProcessRouteList, getProcessRouteById, createProcessRoute,
  updateProcessRoute, deleteProcessRoute, iterateProcessRoute,
  submitProcessRoute, approveProcessRoute, activateProcessRoute, disableProcessRoute,
  reactivateProcessRoute,
  batchProcessRouteAction,
  updateStepOrder,
  getStepDocumentList, deleteStepDocument, uploadStepDocument,
  getVersionHistory, getVersionHistoryByMaterial, getNextVersion, getNextVersionByMaterial,
  exportProcessRoute,
  DocTypeLabels, DocTypeColors,
  RouteStatus, RouteCategoryLabels, RouteStatusLabels,
  InspectionMethod, InspectionMethodLabels, ReportMethodLabels, ReportOrderLabels,
  TimeUnit, TimeUnitLabels
} from '#/api/processRoute'
import { getMachineList } from '#/api/machine'
import { getToolingList } from '#/api/tooling'
import { getWorkCenterList } from '#/api/workCenter'
import { getProcessPoolOptions } from '#/api/processPool'
import { getGaugeList } from '#/api/gauge'
import { getErpMouldList } from '#/api/mould'
import { queryBomExpand, searchMaterials, getLatestBomVersion, getBomVersionsByMaterial, searchCustomers } from '#/api/bom'
import { downloadBlob } from '#/utils/download'
import { createProcessRouteCopyDraft } from './process-route-copy-model'
import type { ProcessRoute, ProcessRouteBatchAction, ProcessRouteBatchActionItem, ProcessStep, ProcessStepDocument } from '#/api/processRoute'
import type { ProcessPool } from '#/api/processPool'
import { resolveStatus } from '#/shared/status/statusDictionary'

// ============ localStorage辅助：获取当前组织ID ============
const getCurrentOrgId = (): string | null => localStorage.getItem('mes_current_org_id')

// ============ 鐘舵€?& 甯搁噺 ============

const loading = ref(false)
const formLoading = ref(false)
const submitting = ref(false)
const tableData = ref<ProcessRoute[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const searchCategory = ref('')
const searchStatus = ref('')
const latestOnly = ref(true)
const processPoolLoading = ref(false)
const processPoolOptions = ref<ProcessPool[]>([])
const selectedRows = ref<ProcessRoute[]>([])

const selectedStepIndex = ref<number | null>(null)

const resourceTableRef = ref<any>(null)

const editId = ref<number | null>(null)

const formMode = computed(() => {
  const name = route.name
  if (name === 'ProcessRouteAdd') return 'add'
  if (name === 'ProcessRouteEdit') return route.query.mode === 'iterate' ? 'iterate' : 'edit'
  if (name === 'ProcessRouteView') return 'view'
  return null
})

const showForm = computed(() => formMode.value !== null)
const isViewMode = computed(() => formMode.value === 'view')
const isIterateMode = computed(() => formMode.value === 'iterate')

const selectedStep = computed(() => {
  if (selectedStepIndex.value === null) return null
  return (formData.steps || [])[selectedStepIndex.value] || null
})

/** 判断指定索引的工序是否为末道工序 */
const syncSelectedStepIndex = (preferredIndex?: number) => {
  const steps = formData.steps || []
  if (!steps.length) {
    selectedStepIndex.value = null
    stepDocuments.value = []
    return
  }
  if (typeof preferredIndex === 'number' && preferredIndex >= 0 && preferredIndex < steps.length) {
    selectedStepIndex.value = preferredIndex
    return
  }
  if (selectedStepIndex.value === null || selectedStepIndex.value >= steps.length) {
    selectedStepIndex.value = 0
  }
}

const isLastStep = (index: number) => {
  const step = (formData.steps || [])[index]
  // Q7: 浼樺厛浣跨敤鍚庣杩斿洖鐨?isLastStep 瀛楁
  if (step && step.isLastStep !== undefined && step.isLastStep !== null) {
    return step.isLastStep
  }
  // 鍏煎鏃ф暟鎹細閫氳繃 stepNo 鏈€澶у€兼帹绠?
  const steps = formData.steps || []
  if (steps.length === 0) return false
  let maxStepNo = -1
  let maxIndex = -1
  steps.forEach((s, i) => {
    if ((s.stepNo || 0) > maxStepNo) {
      maxStepNo = s.stepNo || 0
      maxIndex = i
    }
  })
  return index === maxIndex
}

/** 应用末道工序报检规则：确保末道工序的检验方式为QC */
const applyLastStepInspectionRule = () => {
  const steps = formData.steps as ProcessStep[]
  if (!steps || steps.length === 0) return
  // 确保 stepNo 连续
  steps.forEach((s, i) => { s.stepNo = i + 1 })
  // Q7: 设置所有工序的 isLastStep 标记
  const lastIndex = steps.length - 1
  steps.forEach((s, i) => { s.isLastStep = i === lastIndex })
  // 鎵惧埌鏈亾宸ュ簭锛坰tepNo 鏈€澶х殑宸ュ簭锛?
  const lastStep = steps.reduce((max, s) => (s.stepNo || 0) > ((max?.stepNo) || 0) ? s : max, steps[0]!)
  if (lastStep && lastStep.inspectionMethod !== InspectionMethod.QC) {
    lastStep.inspectionMethod = InspectionMethod.QC
  }
}

const bomLoading = ref(false)
const bomData = ref<any[]>([])

// BOM鐗堟湰閫夋嫨瀵硅瘽妗嗙姸鎬?
const bomVersionDialog = reactive({
  visible: false,
  loading: false,
  list: [] as { bomNumber: string; documentStatus: string }[],
  selected: null as { bomNumber: string; documentStatus: string } | null
})

// 瀹㈡埛鎼滅储瀵硅瘽妗嗙姸鎬?
const customerDialog = reactive({
  visible: false,
  loading: false,
  keyword: '',
  list: [] as { number: string; name: string }[],
  selected: null as { number: string; name: string } | null
})

// 鐗╂枡鎼滅储瀵硅瘽妗嗙姸鎬?
const materialDialog = reactive({
  visible: false,
  loading: false,
  keyword: '',
  list: [] as { number: string; name: string; specification: string }[],
  selected: null as { number: string; name: string; specification: string } | null
})

const commonDefects = ['毛刺', '尺寸不良', '表面划伤', '变形', '气孔', '缩水', '飞边', '缺料']

const formData = reactive<Partial<ProcessRoute>>({
  routeCode: '',
  routeName: '',
  routeCategory: undefined,
  materialCode: '',
  materialName: '',
  productSpec: '',
  customerCode: '',
  customerName: '',
  projectName: '',
  bomVersion: '',
  remark: '',
  steps: []
})

const drawerTitle = computed(() => {
  if (formMode.value === 'add') return '新增工艺路线'
  if (formMode.value === 'view') return formData.routeCode ? `查看工艺路线 - ${formData.routeCode}` : '查看工艺路线'
  if (formMode.value === 'iterate') return formData.routeCode ? `迭代工艺路线 - ${formData.routeCode}` : '迭代工艺路线'
  if (formMode.value === 'edit') return formData.routeCode ? `编辑工艺路线 - ${formData.routeCode}` : '编辑工艺路线'
  return ''
})

// 物料搜索
const router = useRouter()
const route = useRoute()
const materialSearchLoading = ref(false)
const materialCodeError = ref(false)
const isCopySession = ref(false)
const originalMaterialCode = ref('')
const autoVersionMaterialCode = ref('')

type RowActionKey = 'view' | 'copy' | 'edit' | 'iterate' | 'status' | 'delete'
type RowActionConfig = { icon: string; key: RowActionKey; label: string; type?: '' | 'danger' | 'info' | 'primary' | 'success' | 'warning' }

const rowActionDialog = reactive({
  visible: false,
  row: null as ProcessRoute | null
})

const batchActionLabels: Record<string, string> = {
  SUBMIT: '提交',
  APPROVE: '审核',
  ACTIVATE: '启用',
  DISABLE: '失效',
  REACTIVATE: '重新生效',
  DELETE: '删除',
  COPY: '复制',
  EXPORT: '导出'
}

const batchConfirm = reactive({
  visible: false,
  action: 'SUBMIT' as ProcessRouteBatchAction,
  label: '批量提交',
  loading: false
})

const batchResult = reactive({
  visible: false,
  actionLabel: '',
  total: 0,
  successCount: 0,
  failedCount: 0,
  skippedCount: 0,
  items: [] as ProcessRouteBatchActionItem[]
})

const batchExecutableRows = computed(() => selectedRows.value.filter(row => canBatchOperate(row, batchConfirm.action)))
const batchSkippedRows = computed(() => selectedRows.value.filter(row => !canBatchOperate(row, batchConfirm.action)))

const shouldAutoRefreshVersion = (materialCode: string) => {
  if (!materialCode || isViewMode.value) return false
  if (isCopySession.value || isIterateMode.value || formMode.value === 'add') return true
  return Boolean(originalMaterialCode.value && materialCode !== originalMaterialCode.value)
}

const refreshVersionByMaterial = async (materialCode?: string) => {
  const normalizedMaterialCode = (materialCode || formData.materialCode || '').trim()
  if (!shouldAutoRefreshVersion(normalizedMaterialCode)) return
  try {
    const res = await getNextVersionByMaterial(normalizedMaterialCode, editId.value || undefined)
    if (res.success && res.data) {
      formData.version = res.data
      autoVersionMaterialCode.value = normalizedMaterialCode
    }
  } catch { /* 淇濈暀褰撳墠鐗堟湰鍙凤紝鐢变繚瀛樻椂鍞竴鎬ф牎楠屽厹搴?*/ }
}


const resetMaterialLinkedFields = () => {
  formData.materialName = ''
  formData.productSpec = ''
  formData.bomVersion = ''
  bomData.value = []
}

const resetCustomerLinkedFields = () => {
  formData.customerCode = ''
}

const handleMaterialCodeInput = () => {
  resetMaterialLinkedFields()
  materialCodeError.value = false
  autoVersionMaterialCode.value = ''
}

const handleMaterialCodeClear = () => {
  formData.materialCode = ''
  formData.version = ''
  handleMaterialCodeInput()
}

const handleCustomerNameInput = (value: string) => {
  formData.customerName = value
  resetCustomerLinkedFields()
}

const searchMaterialSuggestions = async (queryString: string, cb: any) => {
  if (!queryString.trim()) { cb([]); return }
  materialSearchLoading.value = true
  try {
    const orgId = getCurrentOrgId()
    const res = await searchMaterials(queryString.trim(), orgId ?? undefined)
    if (res.success && res.data) {
      cb(res.data.map((item: any) => ({
        ...item,
        value: item.number,
        label: `${item.number} | ${item.name}${item.specification ? ' | ' + item.specification : ''}`
      })))
    } else {
      cb([])
    }
  } catch { cb([]) }
  finally { materialSearchLoading.value = false }
}

const onMaterialSelected = async (item: any) => {
  formData.materialCode = item.number
  formData.materialName = item.name
  formData.productSpec = item.specification || ''
  materialCodeError.value = false
  await refreshVersionByMaterial(item.number)
  // 自动查询最新BOM版本
  const orgId = getCurrentOrgId()
  try {
    const res = await getLatestBomVersion(item.number, orgId ?? undefined)
    if (res.success && res.data) {
      formData.bomVersion = res.data
      // 自动展开BOM
      expandBom()
    }
  } catch { /* silent */ }
}

/** 鐗╂枡缂栫爜澶辩劍鏃惰嚜鍔ㄧ骇鑱旀悳绱㈠～鍏?*/
const onMaterialCodeBlur = async () => {
  if (!formData.materialCode) return
  const orgId = getCurrentOrgId()
  try {
    const res = await searchMaterials(formData.materialCode, orgId ?? undefined)
    if (res.success && res.data && res.data.length > 0) {
      const item = res.data[0]
      formData.materialCode = item.number
      formData.materialName = item.name
      formData.productSpec = item.specification || ''
      const bomRes = await getLatestBomVersion(item.number, orgId ?? undefined)
      if (bomRes.success && bomRes.data) {
        formData.bomVersion = bomRes.data
        expandBom()
      }
      materialCodeError.value = false
      await refreshVersionByMaterial(item.number)
    } else {
      materialCodeError.value = true
    }
  } catch {
    materialCodeError.value = true
  }
}

// 资源选择
const resourceDialog = reactive<{
  visible: boolean
  title: string
  type: string
  keyword: string
  stepIndex: number
  sourceList: any[]
  list: any[]
  selected: any[]
  selectedMap: Record<string, any>
  syncingSelection: boolean
  currentPage: number
  pageSize: number
  total: number
}>({
  visible: false,
  title: '',
  type: '',
  keyword: '',
  stepIndex: -1,
  sourceList: [],
  list: [],
  selected: [],
  selectedMap: {},
  syncingSelection: false,
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// 鐗堟湰鍘嗗彶鐘舵€?
const versionHistory = reactive({
  visible: false,
  loading: false,
  list: [] as any[]
})

// ============ 生命周期 ============

const handleRouteMode = async () => {
  isCopySession.value = route.query.from === 'copy'
  if (formMode.value === null) {
    await loadData()
    return
  }
  resetForm()
  if (formMode.value === 'add') {
    if (route.query.from === 'copy' && route.query.copyFrom) {
      isCopySession.value = true
      await loadCopyDraft(Number(route.query.copyFrom))
    }
    return
  }
  const id = route.params.id as string
  if (id) {
    await loadFormData(Number(id))
    // 迭代模式下，自动获取并显示下一个版本号
    if (formMode.value === 'iterate') {
      try {
        const res = await getNextVersion(Number(id))
        if (res.success && res.data) {
          formData.version = res.data
          autoVersionMaterialCode.value = formData.materialCode || ''
        }
      } catch { /* 静默失败，保留当前版本号 */ }
    }
  }
}

const loadProcessPoolOptions = async (keyword?: string) => {
  processPoolLoading.value = true
  try {
    const res = await getProcessPoolOptions(keyword)
    if (res.success) {
      processPoolOptions.value = res.data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    processPoolLoading.value = false
  }
}

const applyProcessPoolToStep = (row: ProcessStep, processPoolId?: number) => {
  const pool = processPoolOptions.value.find(item => item.id === processPoolId)
  row.processPoolId = processPoolId
  row.processPoolCode = pool?.processCode
  row.processPoolName = pool?.processName
  if (!pool) return
  row.processCode = pool.processCode
  row.processName = pool.processName
  if (!row.stepName) row.stepName = pool.processName
  row.standardHours = pool.standardHours ?? 0
  row.completeQuantity = pool.completeQuantity ?? 1
  row.timeUnit = pool.timeUnit || TimeUnit.MINUTE
  row.standardDuration = pool.standardDuration
  row.setupTime = pool.setupTime ?? 0
  row.setupTimeUnit = pool.setupTimeUnit || TimeUnit.MINUTE
  row.setupDuration = pool.setupDuration
  row.inspectionMethod = pool.inspectionMethod as any
  row.reportMethod = pool.reportMethod as any
  row.reportOrder = pool.reportOrder as any
  row.defectTypes = pool.defectTypes
    ? pool.defectTypes.split(',').map(item => item.trim()).filter(Boolean) as any
    : row.defectTypes
  row.sopFilePath = pool.sopFilePath
}

onMounted(async () => {
  isCopySession.value = route.query.from === 'copy'
  await loadProcessPoolOptions()
  // Q8: 复制模式提示用户填写物料编码
  if (isCopySession.value) {
    ElMessage.warning('请填写物料编码后保存，当前为复制版本')
  }
  if (formMode.value === null) await loadData()
  await handleRouteMode()
})

watch(() => route.name, async () => {
  await handleRouteMode()
})

// ============ 数据加载 ============

const loadData = async () => {
  loading.value = true
  try {
    const res = await getProcessRouteList({
      keyword: searchKeyword.value,
      category: searchCategory.value || undefined,
      status: searchStatus.value || undefined,
      latestOnly: latestOnly.value,
      page: currentPage.value,
      pageSize: pageSize.value
    })
    if (res.success) {
      tableData.value = res.data
      total.value = res.total
    }
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

const handleSearch = () => { currentPage.value = 1; loadData() }

const handleSelectionChange = (rows: ProcessRoute[]) => {
  selectedRows.value = rows
}

const handleExport = async () => {
  try {
    const blob = await exportProcessRoute({
      keyword: searchKeyword.value || undefined,
      category: searchCategory.value || undefined,
      status: searchStatus.value || undefined
    })
    downloadBlob(blob, '工艺路线导出.xlsx')
  } catch {
    ElMessage.error('导出失败')
  }
}

const selectedRowsAsTableText = () => {
  const header = ['路线编码', '路线名称', '分类', '版本', '物料编码', '物料名称', '状态']
  const rows = selectedRows.value.map(row => [
    row.routeCode || '',
    row.routeName || '',
    RouteCategoryLabels[row.routeCategory as keyof typeof RouteCategoryLabels] || row.routeCategory || '',
    row.version || '',
    row.materialCode || '',
    row.materialName || '',
    resolveStatus('processRoute', 'status', row.status)
  ])
  return [header, ...rows].map(cols => cols.map(value => String(value).replace(/\t/g, ' ')).join('\t')).join('\n')
}

const handleExportSelected = async () => {
  if (!selectedRows.value.length) return
  const csv = '\ufeff' + selectedRowsAsTableText()
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), '选中工艺路线.csv')
  showBatchResult('EXPORT', selectedRows.value.map(row => ({
    action: 'EXPORT',
    id: row.id,
    routeCode: row.routeCode,
    routeName: row.routeName,
    status: 'SUCCESS',
    success: true
  })))
}

const handleBatchCopySelected = async () => {
  if (!selectedRows.value.length) return
  try {
    await navigator.clipboard.writeText(selectedRowsAsTableText())
    ElMessage.success('已复制选中工艺路线')
  } catch {
    ElMessage.warning('浏览器暂不允许写入剪贴板，请使用导出选中')
  }
  showBatchResult('COPY', selectedRows.value.map(row => ({
    action: 'COPY',
    id: row.id,
    routeCode: row.routeCode,
    routeName: row.routeName,
    status: 'SUCCESS',
    success: true,
    message: '可逐条点击复制进入新增页'
  })))
}

const closeForm = async () => {
  resetForm()
  await router.push('/production/process-route')
  // 杩斿洖鍒楄〃鍚庣珛鍗冲埛鏂版暟鎹紝纭繚鐢ㄦ埛鐪嬪埌鏈€鏂扮姸鎬?
  await loadData()
}

// ============ 鐘舵€佹樉绀鸿緟鍔?============

const statusTagType = (status: string) => {
  const map: Record<string, string> = {
    [RouteStatus.DRAFT]: 'warning',
    [RouteStatus.REVIEWING]: '',
    [RouteStatus.APPROVED]: 'success',
    [RouteStatus.ACTIVE]: 'success',
    [RouteStatus.DISABLED]: 'info'
  }
  return map[status] || 'info'
}

// ============ 新增 / 编辑 / 查看 / 迭代 ============

const resetForm = () => {
  editId.value = null
  materialCodeError.value = false
  originalMaterialCode.value = ''
  autoVersionMaterialCode.value = ''
  selectedStepIndex.value = null
  stepDocuments.value = []
  selectedFile.value = null
  formData.routeCode = ''
  formData.routeName = ''
  formData.routeCategory = undefined
  formData.materialCode = ''
  formData.materialName = ''
  formData.productSpec = ''
  formData.customerName = ''
  formData.projectName = ''
  formData.bomVersion = ''
  formData.remark = ''
  formData.steps = []
  formData.status = undefined
  formData.version = ''
  bomData.value = []
}

const handleAdd = () => {
  resetForm()
  router.push('/production/process-route/add')
}

const handleView = async (row: ProcessRoute) => {
  // 不再调用 resetForm()，handleRouteMode 中会自动重置
  router.push(`/production/process-route/view/${row.id}`)
}

const handleEdit = async (row: ProcessRoute) => {
  resetForm()
  router.push(`/production/process-route/edit/${row.id}`)
}

const handleIterate = async (row: ProcessRoute) => {
  resetForm()
  router.push(`/production/process-route/edit/${row.id}?mode=iterate`)
}

const applyRouteFormData = (data: Partial<ProcessRoute>) => {
  editId.value = data.id ?? null
  formData.routeCode = data.routeCode
  formData.routeName = data.routeName
  formData.routeCategory = data.routeCategory
  formData.materialCode = data.materialCode
  originalMaterialCode.value = data.materialCode || ''
  formData.materialName = data.materialName
  formData.productSpec = data.productSpec
  formData.customerCode = data.customerCode
  formData.customerName = data.customerName
  formData.projectName = data.projectName
  formData.bomVersion = data.bomVersion
  formData.effectiveDate = data.effectiveDate
  formData.orgId = data.orgId
  formData.orgName = data.orgName
  formData.remark = data.remark
  formData.status = data.status
  formData.version = data.version
  formData.erpRouteId = data.erpRouteId
  const steps = (data.steps || []).sort((a, b) => a.stepNo - b.stepNo)
  formData.steps = deserializeDefectTypes(steps)
  applyLastStepInspectionRule()
  syncSelectedStepIndex()
  if (formData.bomVersion && formData.materialCode) {
    expandBom()
  }
}

const loadCopyDraft = async (id: number) => {
  formLoading.value = true
  try {
    const res = await getProcessRouteById(id)
    if (res.success) {
      applyRouteFormData(createProcessRouteCopyDraft(res.data as ProcessRoute))
      editId.value = null
      if (formData.materialCode) {
        await refreshVersionByMaterial(formData.materialCode)
      }
    } else {
      ElMessage.error(res.message || '获取复制数据失败')
      await router.push('/production/process-route')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('获取复制数据失败')
  } finally { formLoading.value = false }
}

const loadFormData = async (id: number) => {
  formLoading.value = true
  try {
    const res = await getProcessRouteById(id)
    if (res.success) {
      const data = res.data as ProcessRoute
      applyRouteFormData(data)
      if (isCopySession.value && formData.materialCode) {
        await refreshVersionByMaterial(formData.materialCode)
      }
    }
  } catch (e) { console.error(e) }
  finally { formLoading.value = false }
}

// ============ 鎻愪氦锛堝垱寤?鏇存柊锛?============

const handleDraftSave = async () => {
  if (!formData.routeCode) { ElMessage.warning('请输入工艺路线编码'); return }
  
  // 物料编码为空时弹出确认对话框（和保存按钮行为一致）
  if (!formData.materialCode || !formData.materialCode.trim()) {
    try {
      await ElMessageBox.confirm(
        '由于你未填写物料编码，这条工艺路线将不会进行保存',
        '提示',
        {
          confirmButtonText: '是',
          cancelButtonText: '否',
          type: 'warning',
          distinguishCancelAndClose: true
        }
      )
      if (editId.value) {
        try {
          await deleteProcessRoute(editId.value)
        } catch { /* 鍒犻櫎澶辫触涔熺户缁繑鍥?*/ }
      }
      await router.push('/production/process-route')
      await loadData()
    } catch (action: any) {
      materialCodeError.value = true
    }
    return
  }
  
  submitting.value = true
  try {
    const steps = formData.steps || []
    steps.forEach((s, i) => { s.stepNo = i + 1 })
    formData.steps = serializeDefectTypes(steps)

    let res: any
    if (editId.value) {
      res = await updateProcessRoute(editId.value, formData)
    } else {
      formData.status = RouteStatus.DRAFT
      res = await createProcessRoute(formData)
    }
    if (res.success) {
      ElMessage.success('暂存成功')
      isCopySession.value = false
      if (!editId.value && res.data?.id) {
        editId.value = res.data.id
      }
    } else {
      ElMessage.error(res.message || '暂存失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('暂存失败')
  } finally { submitting.value = false }
}

const handleSubmit = async () => {
  if (!formData.routeCode) { ElMessage.warning('请输入工艺路线编码'); return }
  if (!formData.routeName) { ElMessage.warning('请输入工艺路线名称'); return }
  
  // 物料编码为空时弹出确认对话框
  if (!formData.materialCode || !formData.materialCode.trim()) {
    try {
      await ElMessageBox.confirm(
        '由于你未填写物料编码，这条工艺路线将不会进行保存',
        '提示',
        {
          confirmButtonText: '是',
          cancelButtonText: '否',
          type: 'warning',
          distinguishCancelAndClose: true
        }
      )
      // 鐐瑰嚮銆屾槸銆嶏細鍒犻櫎鏈～鍐欑墿鏂欑紪鐮佺殑璁板綍骞惰繑鍥炲垪琛?
      if (editId.value) {
        try {
          await deleteProcessRoute(editId.value)
        } catch { /* 鍒犻櫎澶辫触涔熺户缁繑鍥?*/ }
      }
      await router.push('/production/process-route')
      await loadData()
    } catch (action: any) {
      // 鐐瑰嚮銆屽惁銆嶏細闃绘淇濆瓨锛岀孩鑹叉爣璇嗘彁閱?
      materialCodeError.value = true
    }
    return
  }
  
  submitting.value = true
  try {
    const steps = formData.steps || []
    steps.forEach((s, i) => { s.stepNo = i + 1 })
    formData.steps = serializeDefectTypes(steps)

    let res: any
    if (editId.value) {
      res = await updateProcessRoute(editId.value, formData)
    } else {
      formData.status = RouteStatus.DRAFT
      res = await createProcessRoute(formData)
    }
    if (res.success) {
      ElMessage.success(editId.value ? '更新成功' : '创建成功')
      isCopySession.value = false
      await router.push('/production/process-route')
      await loadData()
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('操作失败')
  } finally { submitting.value = false }
}

const handleIterateSubmit = async () => {
  if (!editId.value) return
  submitting.value = true
  try {
    const res = await iterateProcessRoute(editId.value)
    if (res.success) {
      ElMessage.success('迭代成功: ' + (res.data as any).version)
      await router.push('/production/process-route')
      await loadData()
    } else {
      ElMessage.error(res.message || '迭代失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('迭代失败')
  } finally { submitting.value = false }
}

// ============ 版本历史 ============

const openVersionHistory = async () => {
  if (!editId.value) { ElMessage.warning('请先保存工艺路线'); return }
  if (!editId.value && !(formData.materialCode || '').trim()) { ElMessage.warning('请先填写物料编码'); return }
  versionHistory.visible = true
  versionHistory.loading = true
  try {
    const materialCode = (formData.materialCode || '').trim()
    const res = materialCode
      ? await getVersionHistoryByMaterial(materialCode)
      : await getVersionHistory(editId.value)
    if (res.success) {
      versionHistory.list = res.data || []
    } else {
      ElMessage.error(res.message || '获取版本历史失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('获取版本历史失败')
  } finally { versionHistory.loading = false }
}

const onVersionSelect = (row: any) => {
  // 双击或单击行触发查看
  if (row.id !== editId.value) {
    switchToVersion(row)
  }
}

const switchToVersion = async (row: any) => {
  versionHistory.visible = false
  // 閲嶆柊鍔犺浇閫変腑鐗堟湰鐨勮鎯?
  await loadFormData(row.id)
  editId.value = row.id
  ElMessage.success(`已切换到版本: ${row.version}`)
}

// ============ 复制 ============

const handleCopy = async (row: ProcessRoute) => {
  try {
    await ElMessageBox.confirm(`确定复制工艺路线 [${row.routeCode}]？复制后将进入新增页，保存前不会写入数据库。`, '提示', { type: 'info' })
    await router.push(`/production/process-route/add?from=copy&copyFrom=${row.id}`)
  } catch (e) { /* 取消 */ }
}

const openRowActionDialog = (row: ProcessRoute) => {
  rowActionDialog.row = row
  rowActionDialog.visible = true
}

const availableRowActions = (row: ProcessRoute): RowActionConfig[] => {
  const actions: RowActionConfig[] = [
    { icon: 'View', key: 'view', label: '查看' },
    { icon: 'CopyDocument', key: 'copy', label: '复制' }
  ]
  if (row.status === RouteStatus.ACTIVE) {
    actions.push({ icon: 'RefreshRight', key: 'iterate', label: '迭代', type: 'primary' })
    actions.push({ icon: 'Delete', key: 'status', label: '失效', type: 'info' })
  }
  if (row.status === RouteStatus.DRAFT || row.status === RouteStatus.REVIEWING) {
    actions.push({ icon: 'Edit', key: 'edit', label: '修改', type: 'warning' })
  }
  if ([RouteStatus.DRAFT, RouteStatus.REVIEWING, RouteStatus.APPROVED, RouteStatus.DISABLED].includes(row.status)) {
    const label = row.status === RouteStatus.DRAFT
      ? '提交'
      : row.status === RouteStatus.REVIEWING
        ? '审核'
        : row.status === RouteStatus.APPROVED
          ? '启用'
          : '重新生效'
    actions.push({ icon: 'Check', key: 'status', label, type: row.status === RouteStatus.DISABLED ? 'warning' : 'success' })
  }
  if (row.status !== RouteStatus.ACTIVE) {
    actions.push({ icon: 'Delete', key: 'delete', label: '删除', type: 'danger' })
  }
  return actions
}

const runRowAction = async (key: RowActionKey) => {
  const row = rowActionDialog.row
  if (!row) return
  rowActionDialog.visible = false
  if (key === 'view') await handleView(row)
  if (key === 'copy') await handleCopy(row)
  if (key === 'edit') await handleEdit(row)
  if (key === 'iterate') await handleIterate(row)
  if (key === 'status') await handleStatusAction(row)
  if (key === 'delete') await handleDelete(row)
}

// ============ 删除 ============

const handleDelete = async (row: ProcessRoute) => {
  try {
    await ElMessageBox.confirm(`确定删除工艺路线 [${row.routeCode}]？`, '提示', { type: 'warning' })
    const res = await deleteProcessRoute(row.id)
    if (res.success) {
      ElMessage.success('删除成功')
      await loadData()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) { /* 取消 */ }
}

// ============ 鐘舵€佹祦杞?============

const statusActionMap: Record<string, { fn: (id: number) => any; msg: string; confirm: string }> = {
  [RouteStatus.DRAFT]: { fn: submitProcessRoute, msg: '提交审核', confirm: '确定提交审核该工艺路线？' },
  [RouteStatus.REVIEWING]: { fn: approveProcessRoute, msg: '审核通过', confirm: '确定审核通过该工艺路线？' },
  [RouteStatus.APPROVED]: { fn: activateProcessRoute, msg: '启用', confirm: '确定启用该工艺路线？启用后同物料其他启用版本将自动失效。' },
  [RouteStatus.ACTIVE]: { fn: disableProcessRoute, msg: '失效', confirm: '确定失效该工艺路线？' },
  [RouteStatus.DISABLED]: { fn: reactivateProcessRoute, msg: '重新生效', confirm: '确定重新生效该工艺路线？启用后同物料其他启用版本将自动失效。' }
}

const batchAllowedStatusMap: Record<ProcessRouteBatchAction, string[]> = {
  SUBMIT: [RouteStatus.DRAFT],
  APPROVE: [RouteStatus.REVIEWING],
  ACTIVATE: [RouteStatus.APPROVED],
  DISABLE: [RouteStatus.ACTIVE],
  REACTIVATE: [RouteStatus.DISABLED],
  DELETE: [RouteStatus.DRAFT, RouteStatus.REVIEWING, RouteStatus.APPROVED, RouteStatus.DISABLED]
}

const canBatchOperate = (row: ProcessRoute, action: ProcessRouteBatchAction) => {
  return batchAllowedStatusMap[action]?.includes(row.status) || false
}

const batchSkipText = (row: ProcessRoute, action: ProcessRouteBatchAction) => {
  if (canBatchOperate(row, action)) return '可执行'
  const label = batchActionLabels[action] || action
  return `当前状态不可${label}`
}

const openBatchAction = (action: ProcessRouteBatchAction) => {
  batchConfirm.action = action
  batchConfirm.label = `批量${batchActionLabels[action] || action}`
  batchConfirm.visible = true
}

const showBatchResult = (action: string, items: ProcessRouteBatchActionItem[]) => {
  batchResult.actionLabel = batchActionLabels[action] || action
  batchResult.items = items
  batchResult.total = items.length
  batchResult.successCount = items.filter(item => item.status === 'SUCCESS').length
  batchResult.failedCount = items.filter(item => item.status === 'FAILED').length
  batchResult.skippedCount = items.filter(item => item.status === 'SKIPPED').length
  batchResult.visible = true
}

const confirmBatchAction = async () => {
  const executableRows = batchExecutableRows.value
  const skippedItems: ProcessRouteBatchActionItem[] = batchSkippedRows.value.map(row => ({
    action: batchConfirm.action,
    id: row.id,
    routeCode: row.routeCode,
    routeName: row.routeName,
    status: 'SKIPPED',
    success: false,
    message: batchSkipText(row, batchConfirm.action)
  }))
  if (!executableRows.length) {
    showBatchResult(batchConfirm.action, skippedItems)
    batchConfirm.visible = false
    return
  }
  batchConfirm.loading = true
  try {
    const res = await batchProcessRouteAction({
      action: batchConfirm.action,
      ids: executableRows.map(row => row.id)
    })
    const result = res.data || {}
    const items = [...(result.items || []), ...skippedItems]
    showBatchResult(batchConfirm.action, items)
    batchConfirm.visible = false
    if (!res.success) {
      ElMessage.error(res.message || '批量操作失败')
    }
  } catch (e) {
    ElMessage.error('批量操作失败')
  } finally {
    batchConfirm.loading = false
  }
}

const closeBatchResult = async () => {
  batchResult.visible = false
  await loadData()
}

const handleStatusAction = async (row: ProcessRoute) => {
  const action = statusActionMap[row.status]
  if (!action) return
  try {
    await ElMessageBox.confirm(action.confirm, '提示', { type: 'warning' })
    const res = await action.fn(row.id)
    if (res.success) {
      ElMessage.success(action.msg + '成功')
      await loadData()
    } else {
      ElMessage.error(res.message || action.msg + '失败')
    }
  } catch (e) { /* 取消 */ }
}

// ============ 工序操作 ============

const addStep = () => {
  const steps = formData.steps as ProcessStep[]
  steps.push({
    stepNo: steps.length + 1,
    processPoolId: undefined,
    processCode: '',
    processName: '',
    stepName: '',
    standardHours: 0,
    setupTime: 0,
    timeUnit: TimeUnit.MINUTE,
    standardDuration: undefined,
    completeQuantity: 1,
    setupTimeUnit: TimeUnit.MINUTE,
    setupDuration: undefined,
    inspectionMethod: undefined,
    reportMethod: undefined,
    reportOrder: undefined,
    defectTypes: [] as any
  } as any)
  // 新增工序后重新应用末道工序报检规则
  applyLastStepInspectionRule()
  syncSelectedStepIndex(steps.length - 1)
}

const removeStep = (index: number) => {
  const steps = formData.steps as ProcessStep[]
  steps.splice(index, 1)
  steps.forEach((s, i) => { s.stepNo = i + 1 })
  // 删除工序后重新应用末道工序报检规则
  applyLastStepInspectionRule()
  syncSelectedStepIndex(Math.min(index, steps.length - 1))
}

const moveStep = (index: number, dir: number) => {
  const steps = formData.steps as ProcessStep[]
  const target = index + dir
  if (target < 0 || target >= steps.length) return
  ;[steps[index], steps[target]] = [steps[target] as ProcessStep, steps[index] as ProcessStep]
  steps.forEach((s, i) => { s.stepNo = i + 1 })
  // 移动工序后重新应用末道工序报检规则
  applyLastStepInspectionRule()
}

const saveStepOrder = async () => {
  if (!editId.value) { ElMessage.warning('请先保存工艺路线基本信息'); return }
  const steps = formData.steps as ProcessStep[]
  const stepIds = steps.filter(s => s.id).map(s => s.id!)
  if (stepIds.length < 2) { ElMessage.info('工序数量不足，无需排序'); return }
  try {
    const res = await updateStepOrder(editId.value, stepIds)
    if (res.success) {
      ElMessage.success('排序已保存')
    } else {
      ElMessage.error(res.message || '排序保存失败')
    }
  } catch (e) {
    ElMessage.error('排序保存失败')
  }
}

// ============ 工序文档管理 ============

const stepDocuments = ref<ProcessStepDocument[]>([])
const docLoading = ref(false)
const docUploading = ref(false)
const selectedFile = ref<File | null>(null)

const docUploadDialog = reactive({
  visible: false,
  form: {
    docType: 'INSPECTION_STANDARD' as string,
    docName: '',
    remark: ''
  }
})

const loadStepDocuments = async () => {
  const step = selectedStep.value
  if (!step || !step.id) { stepDocuments.value = []; return }
  docLoading.value = true
  try {
    const res = await getStepDocumentList(step.id)
    if (res.success) {
      stepDocuments.value = res.data || []
    }
  } catch { /* silent */ }
  finally { docLoading.value = false }
}

const openDocUploadDialog = () => {
  const step = selectedStep.value
  if (!step) { ElMessage.warning('请先在工序流程中选择一个工序步骤'); return }
  if (!step.id) { ElMessage.warning('请先保存当前工序步骤再上传文档'); return }
  docUploadDialog.form = { docType: 'INSPECTION_STANDARD', docName: '', remark: '' }
  selectedFile.value = null
  docUploadDialog.visible = true
}

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectedFile.value = input.files ? (input.files[0] ?? null) : null
  }
}

const handleDocUpload = async () => {
  const step = selectedStep.value
  if (!step) { ElMessage.warning('请选择工序步骤'); return }
  if (!step.id) { ElMessage.warning('请先保存当前工序步骤再上传文档'); return }
  if (!docUploadDialog.form.docName) { ElMessage.warning('请输入文档名称'); return }
  if (!selectedFile.value) { ElMessage.warning('请选择文件'); return }
  docUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append('stepId', String(step.id))
    fd.append('docName', docUploadDialog.form.docName)
    fd.append('docType', docUploadDialog.form.docType)
    if (docUploadDialog.form.remark) fd.append('remark', docUploadDialog.form.remark)
    const res = await uploadStepDocument(fd)
    if (res.success) {
      ElMessage.success('上传成功')
      docUploadDialog.visible = false
      loadStepDocuments()
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败')
  } finally { docUploading.value = false }
}

const handleDeleteDocument = async (doc: ProcessStepDocument) => {
  try {
    await ElMessageBox.confirm(`确定删除文档 [${doc.docName}]？`, '提示', { type: 'warning' })
    const res = await deleteStepDocument(doc.id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadStepDocuments()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch { /* cancel */ }
}

// 鐩戝惉閫変腑姝ラ鍙樺寲锛岃嚜鍔ㄥ姞杞芥枃妗?
watch(selectedStep, () => {
  loadStepDocuments()
})

// ============ JSON搴忓垪鍖栬緟鍔?============

const serializeDefectTypes = (steps: any[]) => {
  return steps.map(s => {
    if (Array.isArray(s.defectTypes)) {
      s.defectTypes = JSON.stringify(s.defectTypes)
    }
    return s
  })
}

const deserializeDefectTypes = (steps: any[]) => {
  return steps.map(s => {
    if (typeof s.defectTypes === 'string' && s.defectTypes) {
      try {
        s.defectTypes = JSON.parse(s.defectTypes)
      } catch { /* keep as is */ }
    } else if (!s.defectTypes) {
      s.defectTypes = []
    }
    return s
  })
}

// ============ 资源绑定辅助函数 ============

const currentStepResources = (resourceType: string): any[] => {
  const step = selectedStep.value
  if (!step) return []
  if (resourceType === 'workCenters') return step.workCenters || []
  if (resourceType === 'machines') return step.machines || []
  if (resourceType === 'toolings') return step.toolings || []
  if (resourceType === 'gauges') return step.gauges || []
  if (resourceType === 'moulds') return step.moulds || []
  return []
}

const removeStepResource = (resourceType: string, index: number) => {
  const step = selectedStep.value
  if (!step) return
  if (resourceType === 'workCenters') step.workCenters?.splice(index, 1)
  if (resourceType === 'machines') step.machines?.splice(index, 1)
  if (resourceType === 'toolings') step.toolings?.splice(index, 1)
  if (resourceType === 'gauges') step.gauges?.splice(index, 1)
  if (resourceType === 'moulds') step.moulds?.splice(index, 1)
}

const openResourceDialogForStep = (type: string) => {
  const step = selectedStep.value
  if (!step) { ElMessage.warning('请先在工序流程中选择一个工序步骤'); return }
  openResourceDialog(step, type)
}

// ============ 资源绑定 ============

const openResourceDialog = async (row: ProcessStep, type: string) => {
  const stepIndex = (formData.steps as ProcessStep[]).indexOf(row)
  if (stepIndex < 0) return

  const typeMap: Record<string, string> = {
    workCenter: '工作中心',
    machine: '机台设备',
    tooling: '工装夹具',
    gauge: '閲忓叿妫€鍏?',
    mould: '模具'
  }

  resourceDialog.type = type
  resourceDialog.stepIndex = stepIndex
  resourceDialog.title = `选择${typeMap[type] || type}`
  resourceDialog.selected = []
  resourceDialog.selectedMap = {}
  resourceDialog.syncingSelection = false
  resourceDialog.keyword = ''
  resourceDialog.currentPage = 1

  try {
    let list: any[] = []
    const boundItems = currentStepResources(resourceTypeToCollection(type))
    if (type === 'workCenter') {
      const res = await getWorkCenterList()
      if (res.success) list = res.data
    } else if (type === 'machine') {
      const res = await getMachineList()
      if (res.success) list = res.data
    } else if (type === 'tooling') {
      const res = await getToolingList()
      if (res.success) list = res.data
    } else if (type === 'gauge') {
      const res = await getGaugeList()
      if (res.success) list = res.data
    } else if (type === 'mould') {
      const res = await getErpMouldList()
      if (res.success) {
        list = (res.data || []).map((item: any) => ({
          ...item,
          id: item.id ?? item.erpMouldId,
          code: item.code ?? item.mouldCode,
          name: item.name ?? item.mouldName
        }))
      }
    } else {
      list = []
    }
    resourceDialog.sourceList = list
    resourceDialog.list = list
    resourceDialog.total = list.length
    resourceDialog.selectedMap = {}
    resourceDialog.sourceList.forEach((item: any) => {
      if (boundItems.some((bound: any) => String(bound.id ?? bound.workCenterId ?? bound.machineId ?? bound.toolingId ?? bound.gaugeId ?? bound.mouldId) === String(item.id))) {
        resourceDialog.selectedMap[String(item.id)] = item
      }
    })
    resourceDialog.visible = true
    applyResourcePagination()
  } catch (e) {
    ElMessage.error('加载资源列表失败')
  }
}

const onResourceSelectChange = (selected: any[]) => {
  if (resourceDialog.syncingSelection) return
  resourceDialog.selected = selected
  const pageIds = new Set(resourceDialog.list.map((item: any) => String(item.id)))
  Object.keys(resourceDialog.selectedMap).forEach((key) => {
    if (pageIds.has(key)) delete resourceDialog.selectedMap[key]
  })
  selected.forEach((item: any) => {
    resourceDialog.selectedMap[String(item.id)] = item
  })
}

const confirmResourceBinding = () => {
  const step = (formData.steps as ProcessStep[])[resourceDialog.stepIndex]
  if (!step) return

  const selected = Object.values(resourceDialog.selectedMap)
  if (!selected.length) { ElMessage.warning('请选择资源'); return }

  const type = resourceDialog.type
  if (type === 'workCenter') {
    step.workCenters = selected.map((item: any) => ({
      workCenterId: item.id,
      workCenterName: item.name,
      isPrimary: false
    }))
  } else if (type === 'machine') {
    step.machines = selected.map((item: any) => ({
      machineId: item.id,
      machineName: item.name,
      machineCode: item.code,
      isRequired: false,
      quantity: 1
    }))
  } else if (type === 'tooling') {
    step.toolings = selected.map((item: any) => ({
      toolingId: item.id,
      toolingName: item.name,
      toolingCode: item.code,
      isRequired: false,
      quantity: 1
    }))
  } else if (type === 'gauge') {
    step.gauges = selected.map((item: any) => ({
      gaugeId: item.id,
      gaugeName: item.name,
      gaugeCode: item.code,
      isRequired: false
    }))
  } else if (type === 'mould') {
    step.moulds = selected.map((item: any) => ({
      mouldId: item.id ?? item.erpMouldId,
      mouldName: item.mouldName || item.name,
      mouldCode: item.mouldCode || item.code,
      isRequired: false,
      cavityCount: item.cavityCount || 1,
      outputPerShot: 1
    }))
  }

  resourceDialog.selected = []
  resourceDialog.selectedMap = {}
  resourceDialog.visible = false
  ElMessage.success(`已绑定 ${selected.length} 个${type === 'machine' ? '机台设备' : type === 'tooling' ? '工装夹具' : type === 'workCenter' ? '工作中心' : type === 'gauge' ? '量具检具' : '模具'}`)
}

const resourceTypeToCollection = (type: string): string => {
  const map: Record<string, string> = {
    workCenter: 'workCenters',
    machine: 'machines',
    tooling: 'toolings',
    gauge: 'gauges',
    mould: 'moulds'
  }
  return map[type] || type + 's'
}

const applyResourcePagination = () => {
  const keyword = resourceDialog.keyword.trim().toLowerCase()
  const filtered = keyword
    ? resourceDialog.sourceList.filter((item: any) => {
        const code = String(item.code || item.mouldCode || item.name || '').toLowerCase()
        const name = String(item.name || item.mouldName || item.code || '').toLowerCase()
        return code.includes(keyword) || name.includes(keyword)
      })
    : resourceDialog.sourceList

  resourceDialog.total = filtered.length
  const start = (resourceDialog.currentPage - 1) * resourceDialog.pageSize
  const end = start + resourceDialog.pageSize
  resourceDialog.list = filtered.slice(start, end)
  nextTick(() => {
    if (!resourceTableRef.value) return
    resourceDialog.syncingSelection = true
    resourceTableRef.value.clearSelection()
    resourceDialog.list.forEach((item: any) => {
      if (resourceDialog.selectedMap[String(item.id)]) {
        resourceTableRef.value!.toggleRowSelection(item, true)
      }
    })
    resourceDialog.syncingSelection = false
  })
}

const searchResourceList = () => {
  resourceDialog.currentPage = 1
  applyResourcePagination()
}

const resetResourceSearch = () => {
  resourceDialog.keyword = ''
  resourceDialog.currentPage = 1
  applyResourcePagination()
}

const handleResourcePageChange = () => {
  applyResourcePagination()
}
// ============ BOM展开 ============

const expandBom = async () => {
  if (!formData.bomVersion) { ElMessage.warning('请输入BOM版本号'); return }
  bomLoading.value = true
  const orgId = getCurrentOrgId()
  try {
    const res = await queryBomExpand({ bomNumber: formData.bomVersion, useOrgId: orgId ? Number(orgId) : undefined, maxLevel: 1 })
    if (res.success) {
      bomData.value = res.data || []
      if (!bomData.value.length) ElMessage.info('BOM展开无数据')
    } else {
      ElMessage.error(res.message || 'BOM展开失败')
    }
  } catch (e) {
    ElMessage.error('BOM展开请求失败')
  } finally { bomLoading.value = false }
}

// ============ BOM版本选择 ============

const openBomVersionDialog = async () => {
  if (!formData.materialCode) { ElMessage.warning('请先选择物料'); return }
  bomVersionDialog.visible = true
  bomVersionDialog.loading = true
  bomVersionDialog.selected = null
  const orgId = getCurrentOrgId()
  try {
    const res = await getBomVersionsByMaterial(formData.materialCode, orgId ?? undefined)
    if (res.success) {
      bomVersionDialog.list = res.data || []
    } else {
      bomVersionDialog.list = []
      ElMessage.error(res.message || '查询BOM版本失败')
    }
  } catch {
    bomVersionDialog.list = []
    ElMessage.error('查询BOM版本失败')
  } finally { bomVersionDialog.loading = false }
}

const onBomVersionSelectChange = (row: any) => {
  bomVersionDialog.selected = row
}

const confirmBomVersionSelection = () => {
  if (!bomVersionDialog.selected) { ElMessage.warning('请选择一个BOM版本'); return }
  formData.bomVersion = bomVersionDialog.selected.bomNumber
  bomVersionDialog.visible = false
  expandBom()
}

// ============ 客户搜索 ============

const searchCustomerSuggestions = async (queryString: string, cb: any) => {
  if (!queryString.trim()) { cb([]); return }
  const orgId = getCurrentOrgId()
  try {
    const res = await searchCustomers(queryString.trim(), orgId ?? undefined)
    if (res.success && res.data) {
      cb(res.data.map((item: any) => ({
        ...item,
        value: item.number,
        label: `${item.number} | ${item.name}`
      })))
    } else {
      cb([])
    }
  } catch { cb([]) }
}

const onCustomerSelected = (item: any) => {
  formData.customerCode = item.number
  formData.customerName = item.name
}

/** 瀹㈡埛澶辩劍鏃惰嚜鍔ㄧ骇鑱旀悳绱㈠～鍏?*/
const onCustomerBlur = async () => {
  if (!formData.customerName) return
  const orgId = getCurrentOrgId()
  try {
    const res = await searchCustomers(formData.customerName, orgId ?? undefined)
    if (res.success && res.data && res.data.length > 0) {
      const item = res.data[0]
      formData.customerCode = item.number
      formData.customerName = item.name
    }
  } catch { /* silent */ }
}

const openCustomerDialog = () => {
  customerDialog.visible = true
  customerDialog.keyword = formData.customerCode || ''
  customerDialog.list = []
  customerDialog.selected = null
}

const searchCustomerData = async () => {
  if (!customerDialog.keyword.trim()) { ElMessage.warning('请输入搜索关键字'); return }
  customerDialog.loading = true
  const orgId = getCurrentOrgId()
  try {
    const res = await searchCustomers(customerDialog.keyword.trim(), orgId ?? undefined)
    if (res.success) {
      customerDialog.list = res.data || []
    } else {
      customerDialog.list = []
      ElMessage.error(res.message || '搜索客户失败')
    }
  } catch {
    customerDialog.list = []
    ElMessage.error('搜索客户失败')
  } finally { customerDialog.loading = false }
}

const onCustomerSelectChange = (row: any) => {
  customerDialog.selected = row
}

const confirmCustomerSelection = () => {
  if (!customerDialog.selected) { ElMessage.warning('请选择一个客户'); return }
  formData.customerCode = customerDialog.selected.number
  formData.customerName = customerDialog.selected.name
  customerDialog.visible = false
}

// ============ 物料搜索弹窗 ============

const openMaterialDialog = () => {
  if (!formData.materialCode) { ElMessage.warning('请先输入物料编码搜索关键字'); return }
  materialDialog.visible = true
  materialDialog.keyword = formData.materialCode || ''
  materialDialog.list = []
  materialDialog.selected = null
}

const searchMaterialData = async () => {
  if (!materialDialog.keyword.trim()) { ElMessage.warning('请输入搜索关键字'); return }
  materialDialog.loading = true
  const orgId = getCurrentOrgId()
  try {
    const res = await searchMaterials(materialDialog.keyword.trim(), orgId ?? undefined)
    if (res.success) {
      materialDialog.list = res.data || []
    } else {
      materialDialog.list = []
      ElMessage.error(res.message || '搜索物料失败')
    }
  } catch {
    materialDialog.list = []
    ElMessage.error('搜索物料失败')
  } finally { materialDialog.loading = false }
}

const onMaterialSelectChange = (row: any) => {
  materialDialog.selected = row
}

const confirmMaterialSelection = () => {
  if (!materialDialog.selected) { ElMessage.warning('请选择一个物料'); return }
  const item = materialDialog.selected
  formData.materialCode = item.number
  formData.materialName = item.name
  formData.productSpec = item.specification || ''
  materialCodeError.value = false
  materialDialog.visible = false
  // 自动查询最新BOM版本
  const orgId = getCurrentOrgId()
  getLatestBomVersion(item.number, orgId ?? undefined).then(res => {
    if (res.success && res.data) {
      formData.bomVersion = res.data
      expandBom()
    }
  }).catch(() => {})
}

// ============ 用量计算辅助 ============

const calcQuantity = (row: any) => {
  if (row.numerator != null && row.denominator != null && row.denominator !== 0) {
    return (row.numerator / row.denominator).toFixed(4)
  }
  return row.numerator != null ? String(row.numerator) : '-'
}

const calcScrapRate = (row: any) => {
  const fixed = row.fixedScrap != null ? row.fixedScrap : 0
  const variable = row.variableScrap != null ? row.variableScrap : 0
  const total = fixed + variable
  return total > 0 ? total + '%' : '-'
}
</script>

<style scoped>
.process-route-container { padding: 20px; }
.search-area { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
.pagination-area { margin-top: 20px; display: flex; justify-content: flex-end; }

/* ========== 鎿嶄綔鍒楁寜閽按骞虫帓鍒?========== */
.action-buttons { display: flex; gap: 4px; flex-wrap: nowrap; white-space: nowrap; align-items: center; }
.action-buttons .el-button { flex-shrink: 0; }
.route-action-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-bottom: 16px; padding: 12px; border: 1px solid var(--el-border-color-light); border-radius: 4px; }
.route-action-summary > div { min-width: 0; display: flex; gap: 8px; align-items: center; }
.route-action-summary span { flex: 0 0 64px; color: var(--el-text-color-secondary); font-size: 12px; }
.route-action-summary strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.route-action-panel { display: flex; flex-wrap: wrap; gap: 8px; }
.batch-summary { margin-bottom: 12px; color: var(--el-text-color-regular); }

/* ========== 内联表单 ========== */
.form-container { margin-top: 20px; padding-bottom: 96px; }
.form-section-card { margin-bottom: 20px; }
.form-section-card :deep(.el-card__header) { font-weight: bold; background: #f5f7fa; padding: 12px 20px; }

/* ========== 宸ュ簭娴佺▼鍥?========== */
.step-flow-indicator { margin-bottom: 16px; padding: 12px 16px; background: #fafafa; border: 1px solid #e8e8e8; border-radius: 4px; }
.flow-steps { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.flow-step-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
.flow-step-item:hover { background: #e6f7ff; }
.flow-step-item.active { background: #bae7ff; outline: 1px solid #1890ff; }
.flow-circle { width: 26px; height: 26px; border-radius: 50%; background: #1890ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; flex-shrink: 0; }
.flow-label { font-size: 13px; color: #333; white-space: nowrap; max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.flow-arrow { color: #bbb; font-size: 16px; margin: 0 4px; user-select: none; }
.step-order-actions { display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.step-order-actions :deep(.el-button) { width: 24px; height: 24px; margin-left: 0; padding: 2px; }
.step-order-arrow { display: inline-flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; font-weight: 700; }
.form-action-bar { position: sticky; bottom: 0; z-index: 20; display: flex; justify-content: flex-end; gap: 8px; padding: 16px 88px 16px 0; background: linear-gradient(90deg, rgba(255,255,255,0.72), #fff 30%); border-top: 1px solid #ebeef5; box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.06); }

/* ========== 资源绑定卡片 ========== */
.resource-cards { display: flex; flex-wrap: wrap; gap: 12px; }
.resource-group { flex: 1; min-width: 200px; max-width: 280px; border: 1px solid #e8e8e8; border-radius: 6px; padding: 12px; background: #fafafa; }
.resource-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: bold; font-size: 14px; color: #333; }
.resource-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.resource-empty { color: #bbb; font-size: 12px; font-style: italic; }
.resource-empty-hint { width: 100%; text-align: center; color: #999; padding: 20px 0; font-size: 13px; }

/* ========== 物料编码错误提示 ========== */
.material-code-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset !important;
}
.material-code-error :deep(.el-input__inner) {
  color: #f56c6c;
}
:global(.material-suggestion-popper) {
  min-width: 460px;
}
.material-suggestion {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(140px, 1.2fr) minmax(110px, 1fr);
  gap: 12px;
}
.material-suggestion span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
