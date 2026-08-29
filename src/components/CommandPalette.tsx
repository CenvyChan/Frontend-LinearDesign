import React, { useState, useEffect } from 'react';
import {
  Search,
  Activity,
  Layers,
  CheckCircle2,
  Package,
  FileCode,
  Settings,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import { ActiveModule } from '../types/mes';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (module: ActiveModule) => void;
  onSearchOrder?: (orderNo: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectModule,
  onSearchOrder,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const quickActions = [
    {
      id: 'diag-wo',
      title: '诊断工单: WO-202608-0091 (新能源高压线束)',
      category: '工单异常诊断',
      module: 'order-diagnostics' as ActiveModule,
      orderNo: 'WO-202608-0091',
      icon: Activity,
    },
    {
      id: 'diag-wo-2',
      title: '诊断工单: WO-202608-0104 (智能中控主板总成)',
      category: '工单异常诊断',
      module: 'order-diagnostics' as ActiveModule,
      orderNo: 'WO-202608-0104',
      icon: Activity,
    },
    {
      id: 'task-pick',
      title: '处理备料任务池 (12 项等待领料与下推 ERP)',
      category: '生产执行',
      module: 'production-tasks' as ActiveModule,
      icon: Layers,
    },
    {
      id: 'qc-tasks',
      title: '审核现场质检检验任务 (IPQC 过程检验)',
      category: '质量管控',
      module: 'quality-inspection' as ActiveModule,
      icon: CheckCircle2,
    },
    {
      id: 'wms-instock',
      title: '生产入库确认池 (ERP 入库单下推与核销)',
      category: '仓储物流',
      module: 'inventory-wms' as ActiveModule,
      icon: Package,
    },
    {
      id: 'form-model-design',
      title: '打开动态表单建模设计器 (自定义扩展字段)',
      category: '低代码表单',
      module: 'form-model' as ActiveModule,
      icon: FileCode,
    },
    {
      id: 'resp-mapping',
      title: '维护 MES 职责树与 ERP 操作员映射 V2',
      category: '系统权限',
      module: 'system-factory' as ActiveModule,
      icon: Settings,
    },
  ];

  const filtered = quickActions.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        executeItem(filtered[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  const executeItem = (item: typeof quickActions[0]) => {
    onSelectModule(item.module);
    if (item.orderNo && onSearchOrder) {
      onSearchOrder(item.orderNo);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl bg-[#14161f] border border-gray-700/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-gray-800 gap-2.5">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            placeholder="输入指令、工单号、任务名或业务模块..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-500 hover:text-gray-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="kbd-badge text-[10px]">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              未找到匹配的工单或业务模块
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                    isSelected ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30' : 'text-gray-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="text-[10px] text-gray-500">{item.category}</div>
                    </div>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400 opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-3 py-2 border-t border-gray-800/80 bg-gray-900/50 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="kbd-badge text-[9px] mr-1">↑</kbd>
              <kbd className="kbd-badge text-[9px] mr-1">↓</kbd>
              选择
            </span>
            <span>
              <kbd className="kbd-badge text-[9px] mr-1">↵</kbd>
              确认进入
            </span>
          </div>
          <span className="text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-400" />
            MES 快速指令中枢
          </span>
        </div>
      </div>
    </div>
  );
};
