import React, { useState } from 'react';
import {
  Activity,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  FileText,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { WorkOrderDiagnostic } from '../types/mes';

export const OrderDiagnosticsView: React.FC = () => {
  const [searchOrderNo, setSearchOrderNo] = useState('WO-202608-0091');
  const [copied, setCopied] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedStageIdx, setSelectedStageIdx] = useState<number | null>(1);

  const sampleDiagnostics: Record<string, WorkOrderDiagnostic> = {
    'WO-202608-0091': {
      id: 'diag-1',
      orderNo: 'WO-202608-0091',
      productCode: 'PRD-EV-8820',
      productName: '新能源高压线束与连接器总成',
      batchNo: 'B260829-01',
      planQty: 1200,
      completedQty: 850,
      currentProcess: '自动端子压接与导通测试 (OP30)',
      healthScore: 68,
      status: 'BLOCKED',
      stages: [
        {
          name: '1. 工单生成与BOM展开',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '系统自动',
          timestamp: '2026-08-28 08:30:12',
          details: '工单主数据正常，BOM层级解析完成(共3级28项子物料)，工艺路线已匹配标准工时。',
        },
        {
          name: '2. 物料齐套与领料下推',
          status: 'blocked',
          erpStatus: 'FAILED',
          operator: '李华 (仓管员)',
          timestamp: '2026-08-28 10:15:44',
          details: 'ERP 领料单生成失败：子项物料 [04.01.092 镀金端子] 在账套 001 默认发料仓 01-A-02 无可用批次，被 ERP 事务回滚。',
        },
        {
          name: '3. 工序报工与计件流转',
          status: 'in_progress',
          erpStatus: 'PENDING',
          operator: '张强 (操作工)',
          timestamp: '2026-08-29 09:12:00',
          details: 'OP10 裁线已完成(1200件)，OP20 剥皮已完成(1200件)，OP30 端子压接进行中(850/1200件)。',
        },
        {
          name: '4. 质量检验 (IPQC/FQC)',
          status: 'pending',
          erpStatus: 'N_A',
          details: '等待 OP30 报工完成后触发过程检验任务 FQC-202608-91。',
        },
        {
          name: '5. 生产入库与ERP凭证核销',
          status: 'pending',
          erpStatus: 'N_A',
          details: '待质检合格判定后，由仓库执行扫码确认入库并生成 ERP 产品入库单。',
        },
      ],
      exceptions: [
        {
          type: 'ERP单据下推受阻',
          severity: 'high',
          message: '物料 04.01.092 在默认发料仓库无有效库存余额，导致 ERP 生产领料单无法过账。',
          solution: '请仓管员在「仓储与物流 → WMS任务池」执行调拨或待检物料快速上架入库后重试下推。',
        },
        {
          type: '报工与发料数量偏差',
          severity: 'medium',
          message: '前道工序已领料数量 (850 PCS) 超过 ERP 实际过账记录 (0 PCS)。',
          solution: '已触发车间预先补料临时授权，需在 4 小时内完成 ERP 补单闭环。',
        },
      ],
    },
    'WO-202608-0104': {
      id: 'diag-2',
      orderNo: 'WO-202608-0104',
      productCode: 'PRD-MCU-4401',
      productName: '智能中控主板总成 (V3.2)',
      batchNo: 'B260829-04',
      planQty: 500,
      completedQty: 500,
      currentProcess: '成品终检与包装入库 (OP60)',
      healthScore: 98,
      status: 'NORMAL',
      stages: [
        {
          name: '1. 工单生成与BOM展开',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '系统自动',
          timestamp: '2026-08-27 09:00:00',
          details: '工单全量校验通过。',
        },
        {
          name: '2. 物料齐套与领料下推',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '陈明',
          timestamp: '2026-08-27 11:30:20',
          details: 'ERP 领料单 LL-20260827-044 已过账。',
        },
        {
          name: '3. 工序报工与计件流转',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '王鹏',
          timestamp: '2026-08-28 17:40:00',
          details: '工序 SMT贴片、AOI光学检测、DIP插件全工序完工。',
        },
        {
          name: '4. 质量检验 (FQC)',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '刘伟 (QC主管)',
          timestamp: '2026-08-29 08:20:00',
          details: '检验报告 FQC-0829-01 合格，合格率 100%。',
        },
        {
          name: '5. 生产入库与ERP凭证核销',
          status: 'completed',
          erpStatus: 'SYNCED',
          operator: '赵亮',
          timestamp: '2026-08-29 09:45:00',
          details: '入库单 RK-20260829-1002 已成功推送到 ERP 财务账套。',
        },
      ],
      exceptions: [],
    },
  };

  const currentDiag = sampleDiagnostics[searchOrderNo] || sampleDiagnostics['WO-202608-0091'];

  const handleSearch = () => {
    setIsDiagnosing(true);
    setTimeout(() => {
      setIsDiagnosing(false);
    }, 400);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentDiag, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner with Clean Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              工单生命周期根因诊断 (Diagnostics V2)
            </h1>
            <HelpTooltip
              title="工单生命周期诊断说明"
              content="对照工单流转卡、发料领料、报工工时、质检报告与生产入库，自动串联 5 大关键节点，精准定位缺失单据、数量偏差与 ERP 推送报错。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            输入工单编号实时剖析全链路状态机，快速排查 ERP 凭证与生产阻断
          </p>
        </div>

        {/* Quick Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchOrderNo}
              onChange={(e) => setSearchOrderNo(e.target.value)}
              placeholder="输入工单号 (如 WO-202608-0091)"
              className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-[#12141c] border border-white/[0.1] text-xs text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isDiagnosing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            <span>执行诊断</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>工单基本信息</span>
            <span className="font-mono text-blue-400">{currentDiag.orderNo}</span>
          </div>
          <div className="font-medium text-xs text-gray-200 truncate">{currentDiag.productName}</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            编码: {currentDiag.productCode} | 批次: {currentDiag.batchNo}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>计划 / 完工进度</span>
            <span className="font-mono text-emerald-400">
              {((currentDiag.completedQty / currentDiag.planQty) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-gray-100">
            {currentDiag.completedQty} / {currentDiag.planQty} PCS
          </div>
          <div className="text-[10px] text-gray-500 truncate mt-1">
            当前: {currentDiag.currentProcess}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
          <div className="text-xs text-gray-400 flex items-center justify-between mb-1">
            <span>健康度评分</span>
            <HelpTooltip
              title="健康度评分机制"
              content="评分由全流程阻塞节点数、ERP 推送失败惩罚及超期滞留时长加权计算。低于 70 分即判定为严重阻塞。"
              variant="icon"
              placement="top"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl font-bold font-mono ${
                currentDiag.healthScore >= 90
                  ? 'text-emerald-400'
                  : currentDiag.healthScore >= 70
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentDiag.healthScore}
            </span>
            <span className="text-xs text-gray-400">/ 100 分</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {currentDiag.status === 'BLOCKED' ? '⚠️ 存在关键阻塞项' : '✅ 链路流转顺畅'}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#12141c] border border-white/[0.08] flex flex-col justify-between">
          <div className="text-xs text-gray-400 flex items-center justify-between">
            <span>诊断工具</span>
            <span className="text-[10px] text-gray-500 font-mono">JSON</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopyJson}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-xs font-medium border border-white/[0.08] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制诊断 JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Diagnostic Flow: Stages & Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: 5-Stage Step Flow */}
        <div className="lg:col-span-2 p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-semibold text-gray-200">5 阶段全生命周期状态机</h2>
              <HelpTooltip
                title="阶段状态判定规则"
                content="点击任意阶段节点可查看现场操作记录、操作员及 ERP 凭证同步详情。绿色代表已闭环，红色代表当前卡阻点。"
                variant="badge"
              />
            </div>
            <span className="text-[11px] text-gray-500">点击卡片查看明细</span>
          </div>

          <div className="space-y-2">
            {currentDiag.stages.map((stage, idx) => {
              const isSelected = selectedStageIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedStageIdx(idx)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500/40 shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      {stage.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {stage.status === 'blocked' && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      {stage.status === 'in_progress' && (
                        <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                      )}
                      {stage.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                      )}
                      <span className="font-medium text-xs text-gray-200">{stage.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          stage.erpStatus === 'SYNCED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : stage.erpStatus === 'FAILED'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        ERP: {stage.erpStatus}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-500 ${isSelected ? 'rotate-90 text-blue-400' : ''}`} />
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 pl-6 leading-relaxed">{stage.details}</p>

                  {stage.timestamp && (
                    <div className="pl-6 pt-1 text-[10px] text-gray-500 font-mono flex items-center gap-3">
                      <span>时间: {stage.timestamp}</span>
                      {stage.operator && <span>操作人: {stage.operator}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Root Cause Exceptions & Auto Recommendations */}
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-semibold text-gray-200">异常根因诊断与建议</h2>
                <HelpTooltip
                  title="根因分析引擎"
                  content="系统自动对比现场流转与 ERP 账务记录，智能归类异常类型并给出即时处置方案，支持一键发起重推。"
                  variant="badge"
                />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                {currentDiag.exceptions.length} 项发现
              </span>
            </div>

            {currentDiag.exceptions.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <span>该工单全链路诊断通过，无任何卡阻或单据异常</span>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDiag.exceptions.map((exc, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-rose-500/[0.04] border border-rose-500/20 space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        {exc.type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 uppercase font-mono">
                        {exc.severity}
                      </span>
                    </div>

                    <div className="text-xs text-gray-300 bg-black/20 p-2 rounded border border-white/[0.04]">
                      {exc.message}
                    </div>

                    <div className="text-[11px] text-blue-300/90 leading-snug bg-blue-500/[0.08] p-2 rounded border border-blue-500/20">
                      <strong className="text-blue-400">💡 处置指引: </strong>
                      {exc.solution}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-gray-500">ERP 凭证重推通道就绪</span>
            <button className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-medium text-xs transition-colors">
              发起 ERP 重新校验
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
