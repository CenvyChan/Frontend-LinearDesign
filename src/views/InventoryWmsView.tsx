import React, { useState } from 'react';
import {
  Package,
  QrCode,
  Layers,
  ArrowDownToLine,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Printer,
  Send,
  Warehouse,
  Boxes,
  Eye,
  Check,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { InStockTask } from '../types/mes';

export const InventoryWmsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'instock' | 'locations' | 'barcode'>('instock');
  const [selectedInstocks, setSelectedInstocks] = useState<string[]>([]);
  const [isPushing, setIsPushing] = useState(false);

  // Barcode designer state
  const [labelTemplate, setLabelTemplate] = useState('standard-mat');
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [sampleBarcode, setSampleBarcode] = useState('MAT-202608-0091');
  const [printed, setPrinted] = useState(false);

  const sampleInStocks: InStockTask[] = [
    {
      id: 'ins-1',
      instockNo: 'IN-202608-041',
      orderNo: 'WO-202608-0104',
      productName: '智能中控主板总成 (V3.2)',
      reportQty: 500,
      qualifiedQty: 500,
      targetWarehouse: '成品总仓 (02-A-01)',
      locationCode: 'LOC-FG-081',
      status: 'WAIT_ERP_AUDIT',
      handler: '赵亮 (仓管)',
      reportTime: '2026-08-29 09:45',
    },
    {
      id: 'ins-2',
      instockNo: 'IN-202608-042',
      orderNo: 'WO-202608-0075',
      productName: '五金冲压固定支架',
      reportQty: 1200,
      qualifiedQty: 1190,
      targetWarehouse: '华东半成品仓 (01-C-02)',
      locationCode: 'LOC-WIP-012',
      status: 'PENDING_CONFIRM',
      handler: '李华',
      reportTime: '2026-08-29 10:15',
    },
    {
      id: 'ins-3',
      instockNo: 'IN-202608-039',
      orderNo: 'WO-202608-0062',
      productName: '新能源高压线束成品',
      reportQty: 300,
      qualifiedQty: 300,
      targetWarehouse: '成品总仓 (02-A-02)',
      locationCode: 'LOC-FG-045',
      status: 'ERP_FAILED',
      erpErrorMsg: 'ERP 账套 001 目标仓库无对应物料编码入库权限',
      handler: '陈雷',
      reportTime: '2026-08-28 17:30',
    },
  ];

  const locationInventory = [
    { loc: 'LOC-FG-081', wh: '成品总仓', matCode: 'PRD-MCU-4401', matName: '智能中控主板总成', qty: 1500, max: 2000, status: 'NORMAL' },
    { loc: 'LOC-WIP-012', wh: '华东半成品仓', matCode: 'PRD-ST-9912', matName: '五金冲压固定支架', qty: 2800, max: 3000, status: 'NORMAL' },
    { loc: 'LOC-RAW-001', wh: '华东主原料仓', matCode: '04.01.092', matName: '镀金端子', qty: 240, max: 5000, status: 'LOW_STOCK' },
    { loc: 'LOC-RAW-004', wh: '华东主原料仓', matCode: '01.03.110', matName: '双绞屏蔽线', qty: 4500, max: 5000, status: 'FULL' },
  ];

  const handleConfirmPush = () => {
    setIsPushing(true);
    setTimeout(() => {
      setIsPushing(false);
      alert('已成功向 ERP 发送产品入库单审核请求并过账！');
    }, 500);
  };

  const handlePrint = () => {
    setPrinted(true);
    setTimeout(() => setPrinted(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-100 tracking-tight">
              仓储物流与入库确认池 (Inventory & WMS V2)
            </h1>
            <HelpTooltip
              title="仓储物流中心规则"
              content="生产汇报单和产品入库检验通过后，在此确认入库并推 ERP 产品入库单。支持库位可视化分布、动态条码标签排版设计与批量打印。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            产成品入库确认、WMS 库位库存矩阵与工业条码标签排版设计器
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('instock')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'instock' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>生产入库确认池</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'locations' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>库位库存矩阵</span>
          </button>
          <button
            onClick={() => setActiveTab('barcode')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'barcode' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>条码标签设计器</span>
          </button>
        </div>
      </div>

      {activeTab === 'instock' && (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-200 font-medium">入库任务状态:</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                {sampleInStocks.length} 项待核销
              </span>
              <HelpTooltip
                title="入库确认前置条件"
                content="入库需满足：① 工单完工报工审核通过；② FQC 成品检验合格；③ 目标仓库具备有效库位分配。"
                variant="icon"
              />
            </div>

            <button
              onClick={handleConfirmPush}
              disabled={isPushing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm"
            >
              <Send className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
              <span>批量确认并推 ERP 入库单</span>
            </button>
          </div>

          {/* In-stock Tasks Table */}
          <div className="rounded-lg bg-[#12141c] border border-white/[0.08] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
                  <th className="p-3">入库单号 / 来源工单</th>
                  <th className="p-3">产品名称</th>
                  <th className="p-3">报工 / 合格入库数</th>
                  <th className="p-3">目标仓库与库位</th>
                  <th className="p-3">经办人 / 时间</th>
                  <th className="p-3">单据状态</th>
                  <th className="p-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sampleInStocks.map((ins) => (
                  <tr
                    key={ins.id}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      ins.status === 'ERP_FAILED' ? 'bg-rose-500/[0.02]' : ''
                    }`}
                  >
                    <td className="p-3 font-mono">
                      <div className="font-semibold text-gray-200">{ins.instockNo}</div>
                      <div className="text-[10px] text-blue-400">{ins.orderNo}</div>
                    </td>
                    <td className="p-3 font-medium text-gray-200">{ins.productName}</td>
                    <td className="p-3 font-mono">
                      <span className="text-emerald-400 font-bold">{ins.qualifiedQty}</span>
                      <span className="text-gray-500"> / {ins.reportQty} PCS</span>
                    </td>
                    <td className="p-3">
                      <div className="text-gray-300">{ins.targetWarehouse}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{ins.locationCode}</div>
                    </td>
                    <td className="p-3 text-gray-400">
                      <div>{ins.handler}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{ins.reportTime}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          ins.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : ins.status === 'ERP_FAILED'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {ins.status}
                      </span>
                      {ins.erpErrorMsg && (
                        <div className="text-[10px] text-rose-400 truncate max-w-xs mt-0.5">
                          {ins.erpErrorMsg}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => alert(`已触发 ${ins.instockNo} ERP 单据重推校验`)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-blue-500/10"
                      >
                        入库确认
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-gray-200">仓库库位实时容积与库存分布</span>
              <HelpTooltip
                title="库位警戒机制"
                content="当库位存量低于 10% 标为 LOW_STOCK（缺料预警），达到 90% 标为 FULL（满仓预警）。"
                variant="badge"
              />
            </div>
            <span className="text-xs text-gray-500 font-mono">4 个重点库位已监控</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {locationInventory.map((loc, i) => (
              <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-200">{loc.loc}</span>
                    <span className="text-[10px] text-gray-500">({loc.wh})</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      loc.status === 'NORMAL'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : loc.status === 'LOW_STOCK'
                        ? 'bg-rose-500/15 text-rose-400 animate-pulse'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {loc.status}
                  </span>
                </div>

                <div className="text-xs text-gray-300">{loc.matName}</div>
                <div className="text-[10px] text-gray-500 font-mono">编码: {loc.matCode}</div>

                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mt-1">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${(loc.qty / loc.max) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>当前存量: {loc.qty}</span>
                  <span>最大容积: {loc.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'barcode' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Settings */}
          <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-semibold text-gray-200">标签排版配置参数</h2>
                <HelpTooltip
                  title="条码排版引擎"
                  content="支持 Code128、QR 二维码、DataMatrix 工业条码。自动绑定 MES 物料流转卡与批次追溯号。"
                  variant="badge"
                />
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">标签模板类型:</label>
                <select
                  value={labelTemplate}
                  onChange={(e) => setLabelTemplate(e.target.value)}
                  className="w-full bg-black/30 text-gray-200 p-2 rounded border border-white/[0.08] focus:outline-none"
                >
                  <option value="standard-mat">标准物料标识卡 (80mm × 50mm)</option>
                  <option value="order-card">工单流转流转卡 (100mm × 75mm)</option>
                  <option value="product-label">汽车级成品合格标签 (60mm × 40mm)</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">编码格式:</label>
                <select
                  value={barcodeType}
                  onChange={(e) => setBarcodeType(e.target.value)}
                  className="w-full bg-black/30 text-gray-200 p-2 rounded border border-white/[0.08] focus:outline-none"
                >
                  <option value="CODE128">CODE 128 一维条形码</option>
                  <option value="QR">QR Code 二维矩阵码</option>
                  <option value="DATAMATRIX">DataMatrix 工业激光打标码</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">测试条码编码内容:</label>
                <input
                  type="text"
                  value={sampleBarcode}
                  onChange={(e) => setSampleBarcode(e.target.value)}
                  className="w-full bg-black/30 text-gray-200 p-2 rounded border border-white/[0.08] font-mono focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-sm"
                >
                  {printed ? <Check className="w-4 h-4 text-emerald-300" /> : <Printer className="w-4 h-4" />}
                  <span>{printed ? '打印指令已发送' : '发送打印至斑马打印机'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Live Preview Rendering */}
          <div className="lg:col-span-2 p-4 rounded-lg bg-[#12141c] border border-white/[0.08] flex flex-col items-center justify-center min-h-[300px]">
            <div className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>实际打印标签渲染预览 (80mm × 50mm 工业级热敏纸)</span>
            </div>

            {/* Rendered Label Card */}
            <div className="w-80 p-4 rounded-md bg-white text-gray-900 shadow-xl border border-gray-300 space-y-2 select-none text-left">
              <div className="flex justify-between items-start border-b border-gray-300 pb-1">
                <div>
                  <div className="text-[10px] font-bold text-blue-900 tracking-wider">MES 工业制造追溯标签</div>
                  <div className="text-xs font-bold font-mono">{sampleBarcode}</div>
                </div>
                <span className="text-[9px] bg-gray-200 px-1 py-0.2 rounded font-mono">PASS</span>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px] leading-tight pt-1">
                <div>物料名称: <strong className="font-semibold">镀金汽车端子</strong></div>
                <div>工单批次: <strong className="font-mono">B260829-01</strong></div>
                <div>检验判定: <strong className="text-emerald-700">FQC 合格</strong></div>
                <div>装箱数量: <strong className="font-mono">500 PCS</strong></div>
              </div>

              {/* Barcode Graphic Simulation */}
              <div className="py-2 flex flex-col items-center justify-center bg-gray-50 rounded border border-gray-200 mt-2">
                {barcodeType === 'CODE128' ? (
                  <div className="h-10 flex items-end gap-[2px]">
                    {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 2, 4, 1, 2].map((w, i) => (
                      <div key={i} className="bg-black h-8" style={{ width: `${w * 1.5}px` }} />
                    ))}
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-black p-1 rounded-sm grid grid-cols-6 gap-[1px]">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div
                        key={i}
                        className={`${(i * 7 + 3) % 2 === 0 ? 'bg-white' : 'bg-black'} rounded-[0.5px]`}
                      />
                    ))}
                  </div>
                )}
                <span className="font-mono text-[9px] text-gray-600 mt-1 tracking-widest">
                  *{sampleBarcode}*
                </span>
              </div>

              <div className="text-[8px] text-gray-500 text-center font-mono pt-1">
                打印时间: 2026-08-29 10:30 | 产线: SM01
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
