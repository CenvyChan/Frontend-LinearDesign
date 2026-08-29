import React from 'react';
import {
  Layers,
  Search,
  Bell,
  RefreshCw,
  Sun,
  Moon,
  Command,
  Database,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface TopNavbarProps {
  currentAcct: string;
  onAcctChange: (acct: string) => void;
  onOpenCommandPalette: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentAcct,
  onAcctChange,
  onOpenCommandPalette,
  isDarkMode,
  onToggleTheme,
  onRefresh,
  isRefreshing = false,
}) => {
  const accounts = [
    { code: '001', name: '001 - 华东总厂 (MES-PRD)' },
    { code: '002', name: '002 - 华南制造基地 (MES-GZ)' },
    { code: '003', name: '003 - 新能源专用车间 (MES-EV)' },
  ];

  return (
    <header className="h-13 border-b border-white/[0.08] dark:border-white/[0.08] bg-[#0c0e14]/90 dark:bg-[#0c0e14]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Brand & Tenant Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-xs tracking-wider">
            MES
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-100 tracking-tight">
              智能制造协同中枢
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              V2.4 PRO
            </span>
            <HelpTooltip
              title="MES 多账套与业务架构"
              content="当前系统支持多租户与多 ERP 账套无缝协同。每个账套独立隔离物料、工单、工艺路线与单据下推凭证，操作员权限根据职责范围动态授权。"
              variant="badge"
              placement="bottom"
            />
          </div>
        </div>

        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Tenant/Account selector */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-md px-2 py-1 transition-colors">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          <select
            value={currentAcct}
            onChange={(e) => onAcctChange(e.target.value)}
            className="bg-transparent text-gray-200 text-xs focus:outline-none cursor-pointer pr-1"
          >
            {accounts.map((acct) => (
              <option key={acct.code} value={acct.code} className="bg-[#161922] text-gray-200">
                {acct.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-xs text-gray-400 hover:text-gray-200 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" />
            <span>搜索工单、批次、任务池、或执行诊断...</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="kbd-badge">⌘</kbd>
            <kbd className="kbd-badge">K</kbd>
          </div>
        </button>
      </div>

      {/* Right: Actions & User */}
      <div className="flex items-center gap-2">
        {/* Real-time status badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium">ERP 链路正常</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="刷新数据 (快捷键 R)"
          className="p-1.5 rounded-md hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 transition-colors relative"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {/* Notifications */}
        <button
          title="通知与报警中心"
          className="p-1.5 rounded-md hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 shadow-sm" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title="切换深色/浅色模式"
          className="p-1.5 rounded-md hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 transition-colors"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
            AD
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <div className="text-xs font-medium text-gray-200">系统管理员</div>
            <div className="text-[10px] text-gray-500">超级权限</div>
          </div>
        </div>
      </div>
    </header>
  );
};
