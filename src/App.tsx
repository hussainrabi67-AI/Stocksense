import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { StockInPage } from './pages/StockInPage';
import { StockOutPage } from './pages/StockOutPage';
import { HistoryPage } from './pages/HistoryPage';
import { LowStockPage } from './pages/LowStockPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ConnectionModal } from './components/common/ConnectionModal';
import { getLowStockProducts } from './lib/api';

function MainApp() {
  const { isAuthenticated, isLoading, role } = useAuth();

  // Internal routing state synced with window.location.hash
  const getInitialPath = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash.startsWith('/')) return hash;
    }
    return '/dashboard';
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);
  const [selectedStockProductId, setSelectedStockProductId] = useState<string | undefined>();
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  const navigate = (path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      window.location.hash = path;
      window.scrollTo(0, 0);
    }
  };

  // Sync hash changes (e.g. back/forward button)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash.startsWith('/')) {
        setCurrentPath(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Refresh low stock count
  const refreshLowStockCount = async () => {
    try {
      const low = await getLowStockProducts(role);
      setLowStockCount(low.length);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshLowStockCount();
    }
  }, [isAuthenticated, role, currentPath]);

  // Loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold tracking-wider uppercase text-emerald-400">
            Initializing StockSense...
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, always show LoginPage
  if (!isAuthenticated || currentPath === '/login') {
    return <LoginPage onLoginSuccess={() => navigate('/dashboard')} />;
  }

  // Handle action triggers from Inventory / Low Stock
  const handleSelectProductForStock = (productId: string, action: 'IN' | 'OUT') => {
    setSelectedStockProductId(productId);
    navigate(action === 'IN' ? '/stock-in' : '/stock-out');
  };

  // Page Routing
  const renderCurrentPage = () => {
    switch (currentPath) {
      case '/dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case '/products':
      case '/stock-items':
        return <ProductsPage />;
      case '/inventory':
        return (
          <InventoryPage
            onNavigate={navigate}
            onSelectProductForStock={handleSelectProductForStock}
          />
        );
      case '/stock-in':
        return (
          <StockInPage
            preselectedProductId={selectedStockProductId}
            onNavigate={navigate}
          />
        );
      case '/stock-out':
        return (
          <StockOutPage
            preselectedProductId={selectedStockProductId}
            onNavigate={navigate}
          />
        );
      case '/history':
        return <HistoryPage />;
      case '/low-stock':
        return (
          <LowStockPage
            onNavigate={navigate}
            onSelectProductForStock={handleSelectProductForStock}
          />
        );
      case '/assistant':
        return <AssistantPage onRefreshInventory={refreshLowStockCount} />;
      case '/settings':
        return <SettingsPage onOpenConnectionModal={() => setConnectionModalOpen(true)} />;
      case '/settings/users':
        return <UsersPage />;
      case '/profile':
        return <ProfilePage onNavigate={navigate} />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <AppLayout
      currentPath={currentPath}
      onNavigate={navigate}
      lowStockCount={lowStockCount}
    >
      {renderCurrentPage()}

      {/* Floating Setup Modal when requested from settings */}
      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        onRefresh={() => window.location.reload()}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
