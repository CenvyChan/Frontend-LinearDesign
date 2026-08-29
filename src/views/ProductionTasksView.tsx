import React, { useState } from 'react';
import {
  Layers,
  PlusCircle,
  RotateCcw,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Download,
  Calendar,
  User,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { ProductionTask } from '../types/mes';

export const ProductionTasksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pick' | 'feed' | 'return' | 'wage'>('pick');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const sampleTasks: ProductionTask[] = [
    {
      id: 'task-1',
      taskNo: 'PICK-202608-019',
      taskType: 'PICK',
      orderNo: 'WO-202608-0091',
      materialCode: '04.01.092',
      materialName: '镀金端子 (高导电汽车级)',
      spec: 'AMP-Gold-0.8mm',
      applyQty: 1200,
      actualQty: 1200,
      unit: 'PCS',
      status: 'ERP_FAILED',
      warehouseCode: '01-A-02',
      warehouseName: '华东主原料仓',
      applicant: '李华 (线长)',
      createdAt: '2026-08-29 08:30',
      erpErrorMsg: 'ERP账套 001 库存不足，批次冻结',
    },
    {
      id: 'task-2',
      taskNo: 'PICK-202608-020',
      taskType: 'PICK',
      orderNo: 'WO-202608-0092',
      materialCode: '01.03.110',
      materialName: '双绞屏蔽线 (橙色高压)',
      spec: '2.5mm² / 100m',
      applyQty: 600,
      actualQty: 600,
      unit: 'M',
      status: 'WAIT_ERP_AUDIT',
      warehouseCode: '01-B-01',
      warehouseName: '线缆专用仓',
      applicant: '张强',
      createdAt: '2026-08-29 09:15',
    },
    {
      id: 'task-3',
      taskNo: 'FEED-202608-004',
      taskType: 'FEED',
      orderNo: 'WO-202608-0088',
      materialCode: '05.02.001',
      materialName: '热缩套管 (阻燃环保)',
      spec: 'Φ6.0mm 黑色',
      applyQty: 50,
      actualQty: 50,
      unit: 'PCS',
      status: 'PENDING',
      warehouseCode: '01-A-04',
      warehouseName: '辅料仓',
      applicant: '王敏 (调试报损补料)',
      createdAt: '2026-08-29 09:40',
    },
    {
      id: 'task-4',
      taskNo: 'RET-202608-002',
      taskType: 'RETURN',
      orderNo: 'WO-202608-0075',
      materialCode: '02.01.018',
      materialName: '剩余铝箔屏蔽层',
      spec: 'Roll-50m',
      applyQty: 12,
      actualQty: 12,
      unit: 'Roll',
      status: 'COMPLETED',
      warehouseCode: '01-A-01',
      warehouseName: '华东主原料仓',
      applicant: '陈雷 (工单完工退余料)',
      createdAt: '2026-08-28 16:20',
      erpVoucherNo: 'ERP-TL-260828-091',
    },
  ];

  const pieceWages = [
    {
      id: 'w-1',
      workerName: '张强',
      workerNo: 'EMP-0891',
      orderNo: 'WO-202608-0091',
      processName: '自动裁线与端子压接 (OP30)',
      reportQty: 850,
      unitPrice: 0.28,
      totalAmount: 238.0,
      status: 'CONFIRMED',
      syncedToErp: true,
      time: '2026-08-29 11:30',
    },
    {
      id: 'w-2',
      workerName: '王芳',
      workerNo: 'EMP-0894',
      orderNo: 'WO-202608-0092',
      processName: '超声波焊接与导通 (OP40)',
      reportQty: 600,
      unitPrice: 0.35,
      totalAmount: 210.0,
      status: 'PENDING',
      syncedToErp: false,
      time: '2026-08-29 11:45',
    },
    {
      id: 'w-3',
      workerName: '李伟',
      workerNo: 'EMP-0762',
      orderNo: 'WO-202608-0088',
      processName: 'SMT贴片首检调机 (OP10)',
      reportQty: 4800,
      unitPrice: 0.04,
      totalAmount: 192.0,
      status: 'CONFIRMED',
      syncedToErp: true,
      time: '2026-08-29 10:10',
    },
  ];

  const filteredTasks = sampleTasks.filter((t) => {
    if (activeTab === 'pick' && t.taskType !== 'PICK') return false;
    if (activeTab === 'feed' && t.taskType !== 'FEED') return false;
    if (activeTab === 'return' && t.taskType !== 'RETURN') return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const toggleSelectTask = (id: string) => {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchPushErp = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('已成功下推选中的生产物料任务到 ERP 凭证接口！');
    }, 600);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              生产任务与计件工时池 (Tasks V2)
            </h1>
            <HelpTooltip
              title="生产任务池业务规则"
              content="统一管理车间发料申请、补料追溯、完工退料及工序计件工资结算。支持批量下推 ERP 生成标准生产领料与退料单据，状态失败支持一键原因重推。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            涵盖备料领料、报损补料、工单余料退库与计件工时工资自动核算
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => {
              setActiveTab('pick');
              setSelectedTasks([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'pick'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>备料领料池</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('feed');
              setSelectedTasks([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'feed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>补料任务池</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('return');
              setSelectedTasks([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'return'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>退料任务池</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('wage');
              setSelectedTasks([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'wage'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>计件工时结算</span>
          </button>
        </div>
      </div>

      {activeTab !== 'wage' ? (
        <>
          {/* Filter & Batch Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">状态筛选:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-black/30 text-gray-200 text-xs px-2.5 py-1 rounded-md border border-white/[0.08] focus:outline-none"
              >
                <option value="ALL">全部状态</option>
                <option value="ERP_FAILED">ERP 失败 (需处理)</option>
                <option value="WAIT_ERP_AUDIT">等待 ERP 审核</option>
                <option value="PENDING">待领取 / 待发料</option>
                <option value="COMPLETED">已完成</option>
              </select>

              <HelpTooltip
                title="任务池状态含义"
                content="【ERP 失败】代表单据因批次/锁库在 ERP 校验未过；【等待审核】表示已产生 ERP 单据草稿等待财务/仓库过账。"
                variant="icon"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchPushErp}
                disabled={selectedTasks.length === 0 || isSyncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTasks.length > 0
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>批量下推 ERP ({selectedTasks.length})</span>
              </button>

              <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-xs font-medium border border-white/[0.08] transition-colors">
                <Download className="w-3.5 h-3.5" />
                <span>导出表格</span>
              </button>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="rounded-lg bg-[#12141c] border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedTasks.length === filteredTasks.length &&
                          filteredTasks.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTasks(filteredTasks.map((t) => t.id));
                          else setSelectedTasks([]);
                        }}
                        className="rounded bg-gray-800 border-gray-700"
                      />
                    </th>
                    <th className="p-3">任务单号 / 工单</th>
                    <th className="p-3">物料名称 / 规格</th>
                    <th className="p-3">申请 / 实发数量</th>
                    <th className="p-3">发料仓库 / 库位</th>
                    <th className="p-3">申请人 / 时间</th>
                    <th className="p-3">任务状态</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        当前筛选条件下无任务记录
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const isSelected = selectedTasks.includes(task.id);
                      return (
                        <tr
                          key={task.id}
                          className={`hover:bg-white/[0.02] transition-colors ${
                            task.status === 'ERP_FAILED' ? 'bg-rose-500/[0.02]' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTask(task.id)}
                              className="rounded bg-gray-800 border-gray-700"
                            />
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-semibold text-gray-200">{task.taskNo}</div>
                            <div className="text-[11px] text-blue-400">{task.orderNo}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-200">{task.materialName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {task.materialCode} ({task.spec})
                            </div>
                          </td>
                          <td className="p-3 font-mono">
                            <span className="font-bold text-gray-100">{task.actualQty}</span>
                            <span className="text-gray-500 ml-1">/ {task.applyQty} {task.unit}</span>
                          </td>
                          <td className="p-3">
                            <div className="text-gray-300">{task.warehouseName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{task.warehouseCode}</div>
                          </td>
                          <td className="p-3 text-gray-400">
                            <div>{task.applicant}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{task.createdAt}</div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium inline-block ${
                                task.status === 'COMPLETED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : task.status === 'ERP_FAILED'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : task.status === 'WAIT_ERP_AUDIT'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {task.status}
                            </span>
                            {task.erpErrorMsg && (
                              <div className="text-[10px] text-rose-400 max-w-xs truncate mt-0.5" title={task.erpErrorMsg}>
                                {task.erpErrorMsg}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => alert(`正在对任务 ${task.taskNo} 执行重新下推...`)}
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                            >
                              下推 ERP
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Piece-rate wage calculation tab */
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-200 font-medium">计件结算周期: 2026年08月</span>
              <HelpTooltip
                title="计件工资核算规则"
                content="根据工序标准工价 × 报工合格件数自动计算。已复核确认的计件记录将直接推入 ERP 薪酬账套。"
                variant="badge"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>全量复核并推 ERP 薪酬</span>
            </button>
          </div>

          <div className="rounded-lg bg-[#12141c] border border-white/[0.08] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
                  <th className="p-3">员工姓名 / 工号</th>
                  <th className="p-3">关联工单</th>
                  <th className="p-3">执行工序与标准单价</th>
                  <th className="p-3">报工合格数</th>
                  <th className="p-3">计件金额 (元)</th>
                  <th className="p-3">ERP 薪酬同步</th>
                  <th className="p-3 text-right">报工时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {pieceWages.map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-medium text-gray-200">
                      <div>{w.workerName}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{w.workerNo}</div>
                    </td>
                    <td className="p-3 font-mono text-blue-400">{w.orderNo}</td>
                    <td className="p-3">
                      <div className="text-gray-300">{w.processName}</div>
                      <div className="text-[10px] text-gray-500 font-mono">¥{w.unitPrice} / 件</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-gray-100">{w.reportQty} 件</td>
                    <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                      ¥{w.totalAmount.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          w.syncedToErp
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {w.syncedToErp ? '已同步 ERP' : '待复核下推'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-gray-500 font-mono">{w.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
