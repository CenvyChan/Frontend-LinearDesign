import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Shield,
  Bell,
  Database,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Send,
  Users,
  Building,
  Key,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';

export const SystemFactoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'equipment' | 'responsibility' | 'notification' | 'sync'>('equipment');

  const machines = [
    { code: 'M-SMT-01', name: '高速贴片机 (Panasonic NPM-D3)', center: 'SMT贴片车间', status: 'RUNNING', temp: '42°C', health: 98, lastMaint: '2026-08-20' },
    { code: 'M-PRS-02', name: '250T 伺服精密冲床', center: '冲压成型车间', status: 'WARNING', temp: '58°C (油温偏高)', health: 86, lastMaint: '2026-08-15' },
    { code: 'M-WIR-04', name: '全自动高速双头裁线端子压接机', center: '线束装配车间', status: 'RUNNING', temp: '38°C', health: 95, lastMaint: '2026-08-25' },
    { code: 'M-LSR-01', name: '光纤激光打标机 (50W IPG)', center: '包装总装车间', status: 'RUNNING', temp: '29°C', health: 99, lastMaint: '2026-08-28' },
  ];

  const mappings = [
    { mesUser: '张强 (EMP-0891)', erpOperator: 'ZHANG_Q (生产部)', acct: '001 华东总厂', org: '制造一部', role: '车间主操工', status: 'BOUND' },
    { mesUser: '李华 (EMP-0742)', erpOperator: 'LI_H (仓储部)', acct: '001, 002', org: '供应链中心', role: '高级仓管员', status: 'BOUND' },
    { mesUser: '刘伟 (EMP-0610)', erpOperator: 'LIU_W (品管部)', acct: '001, 002, 003', org: '质量控制部', role: 'QC检验主管', status: 'BOUND' },
  ];

  const notificationRules = [
    { id: 'nr-1', name: 'ERP 领料单推送失败即时报警', channel: '钉钉群机器人', trigger: '任务状态变为 ERP_FAILED', enabled: true },
    { id: 'nr-2', name: '工单 FQC 终检不合格预警', channel: '企业微信应用消息', trigger: '检验判定为 FAIL / 严重超差', enabled: true },
    { id: 'nr-3', name: '模具寿命达到 90% 预防性维护提醒', channel: '短信 + 站内信', trigger: '累计冲次 >= 额定冲次 * 0.9', enabled: true },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              工厂建模与系统协同配置 (Factory & System V2)
            </h1>
            <HelpTooltip
              title="工厂建模与集成说明"
              content="统一管理机台/工装设备状态矩阵、MES 用户与 ERP 操作员映射、多渠道消息通知规则及主数据双向同步通道。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            设备健康状态、MES-ERP 职责隔离工作台、钉钉预警规则与主数据同步
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'equipment' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>机台工装矩阵</span>
          </button>
          <button
            onClick={() => setActiveTab('responsibility')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'responsibility' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>职责与操作员映射</span>
          </button>
          <button
            onClick={() => setActiveTab('notification')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'notification' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>通知报警规则</span>
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'sync' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>主数据同步</span>
          </button>
        </div>
      </div>

      {activeTab === 'equipment' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-200 font-medium">车间关键生产机台与工装 ({machines.length})</span>
              <HelpTooltip
                title="设备综合健康度"
                content="结合温升、主轴振动、已连续运行时长与保养周期动态评估，低于 88% 自动下发预防性维护工单。"
                variant="badge"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>注册新设备</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {machines.map((m, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-200">{m.code}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        m.status === 'RUNNING'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-400">健康度: {m.health}%</div>
                </div>

                <div className="font-medium text-xs text-gray-200">{m.name}</div>
                <div className="text-[11px] text-gray-500">所属单元: {m.center}</div>

                <div className="flex justify-between items-center pt-2 border-t border-white/[0.04] text-xs">
                  <span className="text-gray-400 font-mono">状态: {m.temp}</span>
                  <span className="text-gray-500 font-mono">上次保养: {m.lastMaint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'responsibility' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-200 font-medium">MES 职责与 ERP 操作员绑定关系 (V2)</span>
              <HelpTooltip
                title="职责映射说明"
                content="维护 MES 操作用户在不同账套、业务组织下的下推单据签名，彻底解耦 ERP 账套物理登录凭证。"
                variant="badge"
              />
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium">
              + 新增操作员映射
            </button>
          </div>

          <div className="rounded-lg bg-[#12141c] border border-white/[0.08] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
                  <th className="p-3">MES 用户</th>
                  <th className="p-3">绑定 ERP 操作员编码</th>
                  <th className="p-3">生效账套</th>
                  <th className="p-3">所属组织</th>
                  <th className="p-3">职责角色</th>
                  <th className="p-3 text-right">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {mappings.map((mp, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-medium text-gray-200">{mp.mesUser}</td>
                    <td className="p-3 font-mono text-blue-400">{mp.erpOperator}</td>
                    <td className="p-3 font-mono text-gray-300">{mp.acct}</td>
                    <td className="p-3 text-gray-300">{mp.org}</td>
                    <td className="p-3 text-gray-400">{mp.role}</td>
                    <td className="p-3 text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono font-medium">
                        {mp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notification' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">消息通知与自动报警触发规则</span>
              <HelpTooltip
                title="预警通知机制"
                content="实时监听产线异常、ERP 推送失败和质检缺陷，毫秒级推送到钉钉群机器人、企业微信应用或现场大屏。"
                variant="badge"
              />
            </div>
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white">
              + 添加预警规则
            </button>
          </div>

          <div className="space-y-2">
            {notificationRules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-200 flex items-center gap-2">
                    <span>{rule.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                      {rule.channel}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">触发条件: {rule.trigger}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-medium">已启用</span>
                  <button className="text-xs text-blue-400 hover:underline">编辑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">ERP 主数据全量与增量同步中枢</span>
              <HelpTooltip
                title="主数据同步机制"
                content="物料字典、计量单位、工艺路线及人员组织在系统启动及变更时自动触发双向比对与增量更新。"
                variant="badge"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>立即执行主数据同步</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: '物料主数据与规格', count: '14,290 条', syncTime: '10 分钟前', status: 'SUCCESS' },
              { name: 'BOM 标准装配清单', count: '380 套', syncTime: '25 分钟前', status: 'SUCCESS' },
              { name: '工艺路线与工时工价', count: '920 项', syncTime: '1 小时前', status: 'SUCCESS' },
            ].map((sync, i) => (
              <div key={i} className="p-3 rounded-lg bg-black/30 border border-white/[0.04] space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-gray-200">
                  <span>{sync.name}</span>
                  <span className="text-emerald-400 font-mono">OK</span>
                </div>
                <div className="text-sm font-bold font-mono text-gray-100">{sync.count}</div>
                <div className="text-[10px] text-gray-500 font-mono">上次同步: {sync.syncTime}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
