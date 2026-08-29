import React, { useState } from 'react';
import {
  FileCode,
  Plus,
  Layers,
  Shield,
  Eye,
  Settings,
  CheckCircle2,
  Lock,
  Search,
  ExternalLink,
  Code2,
  Sparkles,
} from 'lucide-react';
import { HelpTooltip } from '../components/HelpTooltip';
import { FormModelItem } from '../types/mes';

export const FormModelStudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'designer' | 'runtime'>('models');
  const [selectedModel, setSelectedModel] = useState<FormModelItem | null>(null);

  const sampleModels: FormModelItem[] = [
    {
      id: 'm-1',
      modelKey: 'fm_mold_maintenance',
      modelName: '模具预防性保养与维修记录单',
      accountGroup: '001 (华东总厂)',
      version: 'V2.1',
      status: 'PUBLISHED',
      fieldCount: 18,
      detailTableCount: 2,
      views: [
        { id: 'v-1', viewName: '全部保养台账', routePath: '/form-model/mold-all', isDefault: true },
        { id: 'v-2', viewName: '待保养维修待办', routePath: '/form-model/mold-pending', isDefault: false },
      ],
      authorizations: [
        { principalType: 'ROLE', principalName: '设备维护主管', canView: true, canCreate: true, canExport: true },
        { principalType: 'ROLE', principalName: '车间操作工', canView: true, canCreate: true, canExport: false },
      ],
    },
    {
      id: 'm-2',
      modelKey: 'fm_special_inspection',
      modelName: '特种设备开工前置点检清单',
      accountGroup: '001, 002',
      version: 'V1.4',
      status: 'PUBLISHED',
      fieldCount: 24,
      detailTableCount: 1,
      views: [
        { id: 'v-3', viewName: '每日开工点检流水', routePath: '/form-model/precheck-log', isDefault: true },
      ],
      authorizations: [
        { principalType: 'ROLE', principalName: '班组长', canView: true, canCreate: true, canExport: true },
      ],
    },
    {
      id: 'm-3',
      modelKey: 'fm_process_wage_sheet',
      modelName: '多工序计件工资工时复合核算单',
      accountGroup: '001',
      version: 'V3.0-草稿',
      status: 'DRAFT',
      fieldCount: 32,
      detailTableCount: 3,
      views: [
        { id: 'v-4', viewName: '计件复核台账', routePath: '/form-model/wage-audit', isDefault: true },
      ],
      authorizations: [
        { principalType: 'USER', principalName: '财务核算员 (张会计)', canView: true, canCreate: true, canExport: true },
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
              动态表单建模与设计器 (Form Model Studio)
            </h1>
            <HelpTooltip
              title="表单建模设计体系"
              content="无需编写代码即可快速定义业务表单、明细子表、字段级校验逻辑及多账套访问权限。发布后将自动动态注入菜单和运行时路由。"
              variant="badge"
              placement="bottom"
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            主子表结构设计、RBAC 角色/账套隔离授权与运行时动态表格渲染
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'models' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>模型目录</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('designer');
              if (!selectedModel) setSelectedModel(sampleModels[0]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'designer' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>字段与明细设计器</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('runtime');
              if (!selectedModel) setSelectedModel(sampleModels[0]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'runtime' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>运行时动态预览</span>
          </button>
        </div>
      </div>

      {activeTab === 'models' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141c] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-200 font-medium">已发布动态表单模型 ({sampleModels.length})</span>
              <HelpTooltip
                title="表单生效原则"
                content="表单出现在用户菜单需同时满足：① 表单已发布；② 用户绑定了对应账套；③ 用户持有该表单或视图的只读授权。"
                variant="badge"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>新建表单模型</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sampleModels.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  setSelectedModel(m);
                  setActiveTab('designer');
                }}
                className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] hover:border-blue-500/40 cursor-pointer transition-all space-y-3 text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-gray-100 group-hover:text-blue-400 transition-colors">
                    {m.modelName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      m.status === 'PUBLISHED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                  标识: {m.modelKey} ({m.version})
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-white/[0.04]">
                  <span>{m.fieldCount} 个字段</span>
                  <span>{m.detailTableCount} 个明细子表</span>
                  <span className="text-gray-500 ml-auto">{m.views.length} 个视图</span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono pt-1">
                  <span>归属账套: {m.accountGroup}</span>
                  <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">进入设计 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'designer' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">
                正在设计: {selectedModel?.modelName || '模具保养单'}
              </span>
              <HelpTooltip
                title="设计器说明"
                content="左侧定义主表字段，右侧添加明细子表。通过【访问授权】面板按角色或用户分配只读与新增权限。"
                variant="badge"
              />
            </div>
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
              保存并发布新版本
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Field designer column */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-gray-300">
                <span>主表字段定义 (18 项)</span>
                <Plus className="w-3.5 h-3.5 text-blue-400 cursor-pointer" />
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { name: '模具编码 (mold_code)', type: 'TEXT (单行文本)', req: true },
                  { name: '保养类型 (maint_type)', type: 'SELECT (下拉单选)', req: true },
                  { name: '累计冲压次数 (total_strokes)', type: 'NUMBER (整数)', req: false },
                  { name: '维护保养人 (maintainer)', type: 'USER_SELECT (用户)', req: true },
                ].map((f, i) => (
                  <div key={i} className="p-2 rounded bg-black/30 border border-white/[0.04] flex justify-between items-center">
                    <div>
                      <div className="text-gray-200">{f.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{f.type}</div>
                    </div>
                    {f.req && <span className="text-[10px] text-rose-400 font-mono">*必填</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Detail Tables column */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-gray-300">
                <span>明细子表配置 (2 项)</span>
                <Plus className="w-3.5 h-3.5 text-blue-400 cursor-pointer" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 rounded bg-black/30 border border-blue-500/30">
                  <div className="font-medium text-gray-200">1. 更换备件清单 (parts_list)</div>
                  <div className="text-[10px] text-gray-400 mt-1">包含备件编码、领用数量、单价、ERP仓库</div>
                </div>
                <div className="p-2.5 rounded bg-black/30 border border-white/[0.04]">
                  <div className="font-medium text-gray-200">2. 点检判定项目 (check_items)</div>
                  <div className="text-[10px] text-gray-400 mt-1">包含点检项、标准参数、实测值、判定</div>
                </div>
              </div>
            </div>

            {/* Authorization matrix */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-gray-300">
                <span>菜单视图与权限授权</span>
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded bg-black/30 border border-white/[0.04] space-y-1">
                  <div className="text-gray-200 font-medium">设备维护主管</div>
                  <div className="text-[10px] text-emerald-400 font-mono">✅ 可查看 · ✅ 可新增 · ✅ 可导出</div>
                </div>
                <div className="p-2 rounded bg-black/30 border border-white/[0.04] space-y-1">
                  <div className="text-gray-200 font-medium">车间操作工</div>
                  <div className="text-[10px] text-blue-400 font-mono">✅ 可查看 · ✅ 可提交保养申请</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'runtime' && (
        <div className="p-4 rounded-lg bg-[#12141c] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-200">
                动态渲染预览: {selectedModel?.modelName || '模具保养台账'}
              </span>
              <HelpTooltip
                title="运行时动态渲染"
                content="根据 JSON Schema 自动生成高级筛选表单、数据表格与明细抽屉，支持单元格行内编辑与快速导出。"
                variant="badge"
              />
            </div>
            <span className="text-xs text-emerald-400 font-mono">模式: 真实数据流驱动</span>
          </div>

          <div className="rounded-lg bg-black/30 border border-white/[0.06] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400">
                  <th className="p-2.5">模具编码</th>
                  <th className="p-2.5">保养类型</th>
                  <th className="p-2.5">累计冲次</th>
                  <th className="p-2.5">维护保养人</th>
                  <th className="p-2.5">明细子表行数</th>
                  <th className="p-2.5">录入时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-2.5 font-mono font-bold text-blue-400">MJ-2026-8802</td>
                  <td className="p-2.5 text-gray-200">二级预防性研磨</td>
                  <td className="p-2.5 font-mono text-gray-200">48,900 次</td>
                  <td className="p-2.5 text-gray-300">张工 (机修组)</td>
                  <td className="p-2.5 font-mono text-gray-400">更换 2 件备件</td>
                  <td className="p-2.5 font-mono text-gray-500">2026-08-29 08:30</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-2.5 font-mono font-bold text-blue-400">MJ-2026-4401</td>
                  <td className="p-2.5 text-gray-200">一级日常润滑点检</td>
                  <td className="p-2.5 font-mono text-gray-200">12,400 次</td>
                  <td className="p-2.5 text-gray-300">李伟</td>
                  <td className="p-2.5 font-mono text-gray-400">更换 0 件备件</td>
                  <td className="p-2.5 font-mono text-gray-500">2026-08-28 17:00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
