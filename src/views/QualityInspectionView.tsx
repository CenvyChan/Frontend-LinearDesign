import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Search,
  Filter,
  Plus,
  Send,
  BarChart2,
  Sliders,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { QualityTask } from '../types/mes';

export const QualityInspectionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'schemes' | 'reports'>('tasks');
  const [selectedTask, setSelectedTask] = useState<QualityTask | null>(null);

  const sampleTasks: QualityTask[] = [
    {
      id: 'qc-1',
      taskNo: 'IPQC-202608-0112',
      orderNo: 'WO-202608-0091',
      schemeName: '端子压接导通与拉力标准方案',
      checkType: 'IPQC',
      sampleQty: 50,
      passQty: 49,
      failQty: 1,
      result: 'CONCESSION',
      inspector: '陈丽 (质检员)',
      inspectTime: '2026-08-29 10:20',
      erpPushStatus: 'PUSHED',
      items: [
        { paramName: '压接高度 (Crimp Height)', standard: '1.45 ± 0.05 mm', measured: '1.47 mm', result: 'OK' },
        { paramName: '导通电阻 (Contact Resistance)', standard: '< 10 mΩ', measured: '6.2 mΩ', result: 'OK' },
        { paramName: '端子拉拔力 (Pull Force)', standard: '≥ 85 N', measured: '82 N (轻微超差)', result: 'NG' },
      ],
    },
    {
      id: 'qc-2',
      taskNo: 'FQC-202608-0089',
      orderNo: 'WO-202608-0104',
      schemeName: '智能主板出货终检标准 (AQL 0.65)',
      checkType: 'FQC',
      sampleQty: 80,
      passQty: 80,
      failQty: 0,
      result: 'PASS',
      inspector: '刘伟 (QC主管)',
      inspectTime: '2026-08-29 09:10',
      erpPushStatus: 'PUSHED',
      items: [
        { paramName: '外观丝印完整度', standard: '无重影/无断线', measured: '清晰完整', result: 'OK' },
        { paramName: '上电自检功耗', standard: '< 2.5 W', measured: '1.82 W', result: 'OK' },
        { paramName: 'CAN 总线通讯报文', standard: '500 kbps 零丢包', measured: '通信正常', result: 'OK' },
      ],
    },
    {
      id: 'qc-3',
      taskNo: 'IQC-202608-0044',
      orderNo: 'PO-20260822-019',
      schemeName: '镀金端子来料检验方案',
      checkType: 'IQC',
      sampleQty: 120,
      passQty: 120,
      failQty: 0,
      result: 'PASS',
      inspector: '赵小琴',
      inspectTime: '2026-08-28 14:00',
      erpPushStatus: 'PUSHED',
      items: [
        { paramName: '镀层厚度 (Au Plating)', standard: '≥ 0.76 μm', measured: '0.82 μm', result: 'OK' },
        { paramName: '盐雾测试 (Salt Spray)', standard: '≥ 48 h 无氧化', measured: '72 h 正常', result: 'OK' },
      ],
    },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              质量控制与质检任务池 (Quality V2)
            </h1>
            <HelpTooltip
              title="质量质检业务说明"
              content="支持来料检验 (IQC)、过程检验 (IPQC)、成品出货检验 (FQC) 全流程。检验报告审核通过后自动生成 ERP 检验单据，不合格批次自动触发返工或让步放行。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            质检方案标准维护、现场抽检与实测参数录入、ERP 质量检验单实时对接
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>现场检验任务</span>
          </button>
          <button
            onClick={() => setActiveTab('schemes')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'schemes' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>质检方案标准</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>质量直通率报表</span>
          </button>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Tasks Table */}
          <div className="lg:col-span-2 rounded-lg bg-[#12141c] border border-white/[0.08] overflow-hidden">
            <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-200">检验任务记录列表</span>
                <HelpTooltip
                  title="检验判定状态"
                  content="合格 (PASS) 允许下步流转；让步接收 (CONCESSION) 需品质主管特批并留痕；不合格 (FAIL) 自动冻结工单流转卡。"
                  variant="badge"
                />
              </div>
              <span className="text-[11px] text-gray-500 font-mono">共 {sampleTasks.length} 条</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
                    <th className="p-3">检验单号 / 来源工单</th>
                    <th className="p-3">类型</th>
                    <th className="p-3">抽样 / 合格数</th>
                    <th className="p-3">判定结果</th>
                    <th className="p-3">质检员 / 时间</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sampleTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        selectedTask?.id === t.id ? 'bg-blue-600/10' : ''
                      }`}
                    >
                      <td className="p-3 font-mono">
                        <div className="font-semibold text-gray-200">{t.taskNo}</div>
                        <div className="text-[10px] text-blue-400">{t.orderNo}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono font-medium">
                          {t.checkType}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="text-emerald-400 font-bold">{t.passQty}</span>
                        <span className="text-gray-500"> / {t.sampleQty}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                            t.result === 'PASS'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : t.result === 'CONCESSION'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {t.result === 'PASS' ? '合格' : t.result === 'CONCESSION' ? '让步接收' : '不合格'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">
                        <div>{t.inspector}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{t.inspectTime}</div>
                      </td>
                      <td className="p-3 text-right">
                        <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                          查看参数
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Inspection Item Parameters & Details */}
          <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-semibold text-gray-200">实测参数校验明细</h2>
                <HelpTooltip
                  title="实测参数比对"
                  content="现场测量数值与方案上下限标准进行实时比对，任一必检项 NG 将影响最终检验报告结论。"
                  variant="badge"
                />
              </div>
            </div>

            {selectedTask ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04] text-xs space-y-1">
                  <div className="text-gray-400">方案名称:</div>
                  <div className="text-gray-200 font-medium">{selectedTask.schemeName}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-gray-400">检验项实测数据:</div>
                  {selectedTask.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-md bg-black/20 border border-white/[0.04] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-200">{item.paramName}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            item.result === 'OK'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {item.result}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                        <span>标准: {item.standard}</span>
                        <span className="text-blue-300">实测: {item.measured}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-mono">ERP 检验单: 已推送</span>
                  <button className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30">
                    打印质检合格证
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-gray-500">
                请在左侧列表中点击选择任意一条检验任务查看实测参数
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'schemes' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">标准检验方案库</span>
              <HelpTooltip
                title="检验方案配置说明"
                content="配置物料分类对应的必检参数、抽样标准 (GB/T 2828.1 或 C=0) 与上下限容差。"
                variant="badge"
              />
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium">
              <Plus className="w-3.5 h-3.5" />
              <span>新增检验方案</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {[
              { name: '新能源高压线束通用检验标准', code: 'SCH-EV-01', items: 8, type: 'IPQC' },
              { name: '智能中控主板 SMT / AOI 检测方案', code: 'SCH-SMT-04', items: 12, type: 'IPQC' },
              { name: '五金冲压件尺寸与公差验收标准', code: 'SCH-MT-09', items: 6, type: 'IQC' },
            ].map((sch, i) => (
              <div key={i} className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-200">{sch.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                    {sch.type}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono">方案编码: {sch.code}</div>
                <div className="text-xs text-gray-400 flex justify-between pt-2 border-t border-white/[0.04]">
                  <span>包含 {sch.items} 项必检参数</span>
                  <span className="text-blue-400 cursor-pointer hover:underline">编辑参数</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">全厂质量合格率与直通率 (FTT) 趋势</span>
              <HelpTooltip
                title="FTT 统计口径"
                content="按工序、班组与物料批次聚合统计首检合格率，自动标注主要缺陷分布。"
                variant="badge"
              />
            </div>
            <span className="text-xs text-emerald-400 font-mono font-bold">综合 FTT: 99.14%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded bg-black/30 border border-white/[0.04]">
              <div className="text-xs text-gray-400 mb-1">来料合格率 (IQC)</div>
              <div className="text-xl font-bold font-mono text-emerald-400">99.8%</div>
              <div className="text-[10px] text-gray-500 mt-1">供应商供货质量优异</div>
            </div>
            <div className="p-3 rounded bg-black/30 border border-white/[0.04]">
              <div className="text-xs text-gray-400 mb-1">制程首检合格率 (IPQC)</div>
              <div className="text-xl font-bold font-mono text-blue-400">98.9%</div>
              <div className="text-[10px] text-gray-500 mt-1">端子压接工序轻微毛刺</div>
            </div>
            <div className="p-3 rounded bg-black/30 border border-white/[0.04]">
              <div className="text-xs text-gray-400 mb-1">成品出货直通率 (FQC)</div>
              <div className="text-xl font-bold font-mono text-purple-400">99.6%</div>
              <div className="text-[10px] text-gray-500 mt-1">满足主机厂零缺陷交付</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
