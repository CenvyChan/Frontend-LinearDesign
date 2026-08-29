import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, ExternalLink, Sparkles } from 'lucide-react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  variant?: 'badge' | 'icon' | 'subtle';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  shortcut?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title = '业务帮助说明',
  variant = 'badge',
  placement = 'bottom',
  className = '',
  shortcut,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = 0;
    let left = 0;

    if (placement === 'top') {
      top = rect.top + scrollY - 8;
      left = rect.left + scrollX + rect.width / 2;
    } else if (placement === 'bottom') {
      top = rect.bottom + scrollY + 8;
      left = rect.left + scrollX + rect.width / 2;
    } else if (placement === 'left') {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.left + scrollX - 8;
    } else {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.right + scrollX + 8;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      className={`inline-flex items-center select-none ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      tabIndex={0}
      role="button"
      aria-label="查看帮助信息"
    >
      {variant === 'badge' ? (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium tracking-tight rounded-md 
            bg-blue-500/10 text-blue-400 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 
            hover:border-blue-500/30 transition-all cursor-help"
        >
          <HelpCircle className="w-3 h-3 text-blue-400" />
          <span>Help</span>
        </span>
      ) : variant === 'icon' ? (
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold
            text-gray-400 hover:text-blue-400 bg-gray-800/60 hover:bg-blue-500/10 border border-gray-700/50 
            hover:border-blue-500/30 transition-all cursor-help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 
            cursor-help transition-colors underline decoration-dotted underline-offset-2"
        >
          <Info className="w-3 h-3" />
          <span>帮助</span>
        </span>
      )}

      {isOpen && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform:
              placement === 'top'
                ? 'translate(-50%, -100%)'
                : placement === 'bottom'
                ? 'translate(-50%, 0)'
                : placement === 'left'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
            zIndex: 9999,
          }}
          className="w-72 max-w-sm p-3 rounded-lg shadow-2xl bg-[#161922] dark:bg-[#12141c] text-gray-200 
            border border-gray-700/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-none"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-800">
            <div className="flex items-center gap-1.5 font-medium text-xs text-gray-100">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>{title}</span>
            </div>
            {shortcut && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
                {shortcut}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-300 leading-relaxed font-normal">
            {typeof content === 'string' ? <p>{content}</p> : content}
          </div>
          <div className="mt-2 pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500">
            <span>MES 业务规则引擎</span>
            <span className="text-blue-400/80">悬浮即查</span>
          </div>
        </div>
      )}
    </div>
  );
};
