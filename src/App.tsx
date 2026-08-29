import React, { useState, useEffect } from 'react';
import { TopNavbar } from './components/TopNavbar';
import { SidebarNav } from './components/SidebarNav';
import { CommandPalette } from './components/CommandPalette';
import { ActiveModule } from './types/mes';

import { DashboardView } from './views/DashboardView';
import { OrderDiagnosticsView } from './views/OrderDiagnosticsView';
import { ProductionTasksView } from './views/ProductionTasksView';
import { QualityInspectionView } from './views/QualityInspectionView';
import { InventoryWmsView } from './views/InventoryWmsView';
import { FormModelStudioView } from './views/FormModelStudioView';
import { SystemFactoryView } from './views/SystemFactoryView';

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState('001 (华东总厂生产账套)');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Keyboard navigation shortcuts: 1-7 for modules, ⌘K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input or textarea, ignore single key shortcuts
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === '1') setActiveModule('dashboard');
      else if (e.key === '2') setActiveModule('order-diagnostics');
      else if (e.key === '3') setActiveModule('production-tasks');
      else if (e.key === '4') setActiveModule('quality-inspection');
      else if (e.key === '5') setActiveModule('inventory-wms');
      else if (e.key === '6') setActiveModule('form-model');
      else if (e.key === '7') setActiveModule('system-factory');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased text-gray-100 ${isDarkMode ? 'dark bg-[#0a0c10]' : 'bg-[#0f1218]'}`}>
      {/* Top Navbar */}
      <TopNavbar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenCommandPalette={() => setIsCommandOpen(true)}
        currentAccount={currentAccount}
        onChangeAccount={setCurrentAccount}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Main Layout: Sidebar + View Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <SidebarNav
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          exceptionCount={3}
          pendingTasksCount={12}
        />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0e1017] to-[#0a0c10]">
          {activeModule === 'dashboard' && <DashboardView onNavigate={(m) => setActiveModule(m as ActiveModule)} />}
          {activeModule === 'order-diagnostics' && <OrderDiagnosticsView />}
          {activeModule === 'production-tasks' && <ProductionTasksView />}
          {activeModule === 'quality-inspection' && <QualityInspectionView />}
          {activeModule === 'inventory-wms' && <InventoryWmsView />}
          {activeModule === 'form-model' && <FormModelStudioView />}
          {activeModule === 'system-factory' && <SystemFactoryView />}
        </main>
      </div>

      {/* Command Palette (⌘K) Modal */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectModule={setActiveModule}
      />
    </div>
  );
}
