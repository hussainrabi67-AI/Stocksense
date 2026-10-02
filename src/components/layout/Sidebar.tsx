import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  Bot,
  Settings,
  Users,
  UserCheck,
  Building2,
  X,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  lowStockCount?: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenConnectionModal: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  isHighlight?: boolean;
  roleReq?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  lowStockCount = 0,
  mobileOpen,
  onCloseMobile,
  onOpenConnectionModal
}) => {
  const { role, user } = useAuth();

  const navItems: NavGroup[] = [
    {
      group: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
      ]
    },
    {
      group: 'INVENTORY & CATALOG',
      items: [
        { label: 'Products', path: '/products', icon: Package },
        { label: 'Stock Levels', path: '/inventory', icon: Layers },
        {
          label: 'Low Stock Alert',
          path: '/low-stock',
          icon: AlertTriangle,
          badge: lowStockCount > 0 ? `${lowStockCount}` : undefined,
          badgeColor: 'amber'
        }
      ]
    },
    {
      group: 'STOCK OPERATIONS',
      items: [
        { label: 'Stock IN (Receive)', path: '/stock-in', icon: ArrowDownToLine },
        { label: 'Stock OUT (Dispatch)', path: '/stock-out', icon: ArrowUpFromLine },
        { label: 'Movement History', path: '/history', icon: History }
      ]
    },
    {
      group: 'INTELLIGENCE & COPILOT',
      items: [
        { label: 'AI Inventory Copilot', path: '/assistant', icon: Bot, isHighlight: true }
      ]
    },
    {
      group: 'ADMINISTRATION',
      items: [
        ...(role === 'ADMIN'
          ? [
              {
                label: 'User Management',
                path: '/settings/users',
                icon: Users,
                roleReq: 'ADMIN'
              }
            ]
          : []),
        { label: 'Settings', path: '/settings', icon: Settings },
        { label: 'My Profile', path: '/profile', icon: UserCheck }
      ]
    }
  ];

  const handleItemClick = (path: string) => {
    onNavigate(path);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Mall Identity header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">RETAIL HUB</div>
            <div className="font-extrabold text-slate-900 text-sm tracking-tight leading-snug">
              Nowshera Mall
            </div>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navItems.map((group, idx) => (
          <div key={idx}>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;

                return (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item.path)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : item.isHighlight
                        ? 'text-teal-700 bg-teal-50/60 hover:bg-teal-100/80'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive
                            ? 'text-emerald-400'
                            : item.isHighlight
                            ? 'text-teal-600'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile & Mall Location Widget */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-700">Active Role</span>
          <Badge role={role} size="sm" />
        </div>
        <p className="text-[11px] text-slate-600 leading-tight">
          Logged in as <strong className="text-slate-800">{user?.full_name?.split(' ')[0]}</strong>
        </p>
        {role === 'ADMIN' && (
          <button
            onClick={onOpenConnectionModal}
            className="mt-3 w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Database className="w-3 h-3 text-emerald-600" />
            <span>PostgreSQL / n8n Setup</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 overflow-hidden z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
