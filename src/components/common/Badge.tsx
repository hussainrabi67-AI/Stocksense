import React from 'react';
import { UserRole, MovementType, RequestStatus } from '../../types/inventory';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'role' | 'stock' | 'movement' | 'status' | 'default';
  role?: UserRole;
  movement?: MovementType;
  status?: RequestStatus | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ACTIVE' | 'INACTIVE';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  role,
  movement,
  status,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  // Role badges
  if (role) {
    const roleStyles: Record<UserRole, string> = {
      ADMIN: 'bg-purple-100 text-purple-800 border border-purple-200',
      MANAGER: 'bg-blue-100 text-blue-800 border border-blue-200',
      STAFF: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${roleStyles[role]} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
        {children || role}
      </span>
    );
  }

  // Movement badges
  if (movement) {
    const movStyles: Record<MovementType, string> = {
      IN: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      OUT: 'bg-blue-50 text-blue-700 border border-blue-200',
      DAMAGE: 'bg-rose-50 text-rose-700 border border-rose-200',
      ADJUSTMENT: 'bg-amber-50 text-amber-700 border border-amber-200'
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-md font-mono ${sizeClasses} ${movStyles[movement]} ${className}`}>
        {movement === 'IN' && '↓ IN'}
        {movement === 'OUT' && '↑ OUT'}
        {movement === 'DAMAGE' && '⚠ DAMAGE'}
        {movement === 'ADJUSTMENT' && '⇄ ADJUST'}
      </span>
    );
  }

  // Stock / Request status badges
  if (status) {
    let style = 'bg-slate-100 text-slate-700 border-slate-200';
    let label: string = status;

    if (status === 'IN_STOCK' || status === 'CONFIRMED' || status === 'ACTIVE') {
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      label = status === 'IN_STOCK' ? 'In Stock' : status === 'CONFIRMED' ? 'Confirmed' : 'Active';
    } else if (status === 'LOW_STOCK' || status === 'PENDING') {
      style = 'bg-amber-50 text-amber-700 border-amber-200';
      label = status === 'LOW_STOCK' ? 'Low Stock' : 'Pending Confirmation';
    } else if (status === 'OUT_OF_STOCK' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'INACTIVE') {
      style = 'bg-rose-50 text-rose-700 border-rose-200';
      label = status === 'OUT_OF_STOCK' ? 'Out of Stock' : status === 'INACTIVE' ? 'Deactivated' : status;
    }

    return (
      <span className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses} ${style} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {children || label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
};
