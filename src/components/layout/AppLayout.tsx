import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { ConnectionModal } from '../common/ConnectionModal';
import { AICopilotPopup } from '../ai/AICopilotPopup';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  lowStockCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPath,
  onNavigate,
  lowStockCount = 0,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        lowStockCount={lowStockCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenConnectionModal={() => setConnectionModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentPath={currentPath}
          onNavigate={onNavigate}
          onOpenConnectionModal={() => setConnectionModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Floating AI Copilot Popup */}
      <AICopilotPopup onNavigate={onNavigate} />

      {/* Connection & Setup Modal */}
      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        onRefresh={() => {
          // Triggers re-renders when credentials change
          window.location.reload();
        }}
      />
    </div>
  );
};
