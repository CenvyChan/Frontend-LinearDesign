import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Layers,
  CheckCircle2,
  Package,
  FileCode,
  Settings,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { ActiveModule } from '../types/mes';

interface SidebarNavProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  exceptionCount?: number;
  pendingTasksCount?: number;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeModule,
  onSelectModule,
  exceptionCount = 3,
  pendingTasksCount = 12,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveModule,
      name: '制造驾驶舱',
      sub: 'Analytics V2',
      icon: LayoutDashboard,
      shortcut: '1',
    },
    {
      id: 'order-diagnostics' as ActiveModule,
      name: '工单生命周期',
      sub: 'Order Diagnostics',
      icon: Activity,
      shortcut: '2',
      badge: exceptionCount > 0 ? `${exceptionCount} 异常` : undefined,
      badgeTone: 'danger',
    },
    {
      id: 'production-tasks' as ActiveModule,
      name: '生产任务池',
      sub: 'Pick / Feed / Return',
      icon: Layers,
      shortcut: '3',
      badge: pendingTasksCount > 0 ? `${pendingTasksCount}` : undefined,
      badgeTone: 'warning',
    },
    {
      id: 'quality-inspection' as ActiveModule,
      name: '质量与质检',
      sub: 'QC & Inspection',
      icon: CheckCircle2,
      shortcut: '4',
    },
    {
      id: 'inventory-wms' as ActiveModule,
      name: '仓储与物流',
      sub: 'In-stock & WMS',
      icon: Package,
      shortcut: '5',
    },
    {
      id: 'form-model' as ActiveModule,
      name: '动态表单建模',
      sub: 'Form Model Studio',
      icon: FileCode,
      shortcut: '6',
    },
    {
      id: 'system-factory' as ActiveModule,
      name: '工厂与系统配置',
      sub: 'Factory & Integration',
      icon: Settings,
      shortcut: '7',
    },
  ];

  return (
    <aside className="w-56 border-r border-white/[0.08] bg-[#0c0e14]/95 flex flex-col justify-between select-none shrink-0">
      <div className="p-3 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          业务协同导航
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all group relative ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-medium border border-blue-500/20 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
                    }`}
                  />
                  <div className="text-left truncate">
                    <div className="truncate">{item.name}</div>
                    <div className="text-[10px] text-gray-600 dark:text-gray-500 truncate leading-none mt-0.5">
                      {item.sub}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                        item.badgeTone === 'danger'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <kbd className="kbd-badge opacity-40 group-hover:opacity-100 transition-opacity">
                    {item.shortcut}
                  </kbd>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Card */}
      <div className="p-3 border-t border-white/[0.08] bg-white/[0.01]">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-gray-900 to-[#12141c] border border-white/[0.06] text-xs">
          <div className="flex items-center justify-between text-gray-300 mb-1">
            <span className="font-medium flex items-center gap-1 text-[11px]">
              <Flame className="w-3 h-3 text-amber-400" />
              车间执行状态
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">98.4% OEE</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden my-1.5">
            <div className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full w-[92%]" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>在制工单: 42</span>
            <span>待质检: 8</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
