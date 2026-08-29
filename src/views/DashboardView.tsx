import React from 'react';
import {
  TrendingUp,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Cpu,
  BarChart3,
  Flame,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { MetricCard } from '../types/mes';

export const DashboardView: React.FC<{ onNavigate: (module: string) => void }> = ({
  onNavigate,
}) => {
  const metrics: MetricCard[] = [
    {
      label: '产线综合稼动率 (OEE)',
      value: '91.8%',
      change: '+2.4%',
      trend: 'up',
      tone: 'success',
      helpText: 'OEE = 时间利用率 × 性能利用率 × 合格品率。当前华东总厂 SM01-SM06 产线保持在世界级标杆水平（>85%）。',
    },
    {
      label: '工单准时交付率 (OTIF)',
      value: '97.2%',
      change: '+0.8%',
      trend: 'up',
      tone: 'primary',
      helpText: '统计当月计划交付与实际入库齐套比率，当前 3 张高优先级工单正在加速流转。',
    },
    {
      label: '生产质检直通率 (FTT)',
      value: '99.14%',
      change: '-0.12%',
      trend: 'down',
      tone: 'warning',
      helpText: '首检合格率（First Time Through），未经历返工/返修的合格品比率。SMT 贴片段轻微毛刺需注意。',
    },
    {
      label: '在制阻塞工单数',
      value: '3 批',
      change: '-2 批',
      trend: 'up',
      tone: 'danger',
      helpText: '当前在制工单中因缺料、ERP 审核超时或质检未下推而卡住的批次，点击可直接进入生命周期诊断排除异常。',
    },
  ];

  const workshopStatus = [
    { name: '总装一线 (SM01)', plan: 2400, actual: 2310, status: 'RUNNING', speed: '96.2%', operator: '张工 (班长)' },
    { name: '精密SMT贴片 (SM02)', plan: 5000, actual: 4980, status: 'RUNNING', speed: '99.6%', operator: '李伟' },
    { name: '注塑成型单元 (SM03)', plan: 1800, actual: 1650, status: 'WARNING', speed: '91.6%', operator: '赵明 (温度波动)' },
    { name: '激光打标与包装 (SM04)', plan: 3200, actual: 3190, status: 'RUNNING', speed: '99.7%', operator: '王芳' },
  ];

  const recentAlerts = [
    {
      id: 'AL-901',
      time: '10 分钟前',
      level: 'HIGH',
      title: '工单 WO-202608-0091 ERP 领料单推送超时',
      desc: '原材料 04.01.092 批次库存未在 ERP 及时过账，导致现场领料任务阻塞。',
      action: '前往生命周期诊断',
      target: 'order-diagnostics',
    },
    {
      id: 'AL-902',
      time: '28 分钟前',
      level: 'MEDIUM',
      title: '模具 MJ-2026-8802 达到预警冲次上限',
      desc: '当前冲压次数已达 48,900 / 50,000，建议在下个批次前安排预防性保养研磨。',
      action: '查看工厂设备',
      target: 'system-factory',
    },
    {
      id: 'AL-903',
      time: '1 小时前',
      level: 'LOW',
      title: '成品入库检验 FQC-202608-31 待入库确认',
      desc: '合格品数量 500 PCS 已完成质检审核，等待仓库扫码上架推 ERP。',
      action: '前往仓储入库',
      target: 'inventory-wms',
    },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* View Header with Help */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              制造智能驾驶舱 (Analytics V2)
            </h1>
            <HelpTooltip
              title="制造驾驶舱指标说明"
              content="实时汇聚全厂 OEE、工单进度、ERP 同步状态及异常报警。数据每 3 秒增量同步，点击指标卡或预警项可一键穿透至对应业务模块。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            实时汇总车间工单、设备稼动率、质量直通率与 ERP 链路状态
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">
            更新时间: {new Date().toLocaleTimeString()}
          </span>
          <button
            onClick={() => onNavigate('order-diagnostics')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-md transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>智能工单诊断</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-[#12141c] border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="truncate">{m.label}</span>
              <HelpTooltip
                title={m.label}
                content={m.helpText}
                variant="icon"
                placement="top"
              />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-gray-100">{m.value}</span>
              {m.change && (
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    m.trend === 'up' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {m.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {m.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Live Workshop Status + Real-time Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Production Line Status */}
        <div className="lg:col-span-2 p-3.5 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-semibold text-gray-200">车间生产单元实时状态</h2>
              <HelpTooltip
                title="生产单元监控逻辑"
                content="实时监测各车间工作中心节拍进度、达成率及现场负责人。当速度低于 92% 或产生异常停机时将自动变色预警。"
                variant="badge"
              />
            </div>
            <span className="text-[11px] text-gray-500 font-mono">4 个工作中心在线</span>
          </div>

          <div className="space-y-2">
            {workshopStatus.map((line, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 font-medium text-gray-200">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        line.status === 'RUNNING' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span>{line.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-gray-400">负责: {line.operator}</span>
                    <span className="text-blue-400 font-semibold">{line.speed}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      line.status === 'RUNNING'
                        ? 'bg-gradient-to-r from-blue-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-rose-400'
                    }`}
                    style={{ width: `${(line.actual / line.plan) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                  <span>计划: {line.plan} 件</span>
                  <span>已完成: {line.actual} 件</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Realtime Alerts */}
        <div className="p-3.5 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-semibold text-gray-200">实时异常拦截与预警</h2>
                <HelpTooltip
                  title="异常拦截与自愈规则"
                  content="异常由系统根据 ERP 单据对接、工单物料齐套比、检验超差指标自动检测生成。高优先级异常需在 30 分钟内闭环。"
                  variant="badge"
                />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                3 项待处理
              </span>
            </div>

            <div className="space-y-2.5">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-2.5 rounded-md bg-rose-500/[0.03] border border-rose-500/20 space-y-1 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-rose-300 truncate">
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-gray-500 shrink-0">{alert.time}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug">{alert.desc}</p>
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => onNavigate(alert.target)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                    >
                      <span>{alert.action}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-gray-500">
            <span>钉钉/企微实时预警规则已启用</span>
            <button
              onClick={() => onNavigate('system-factory')}
              className="text-blue-400 hover:underline"
            >
              配置规则
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
