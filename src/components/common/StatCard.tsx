import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple' | 'slate';
  badgeText?: string;
  badgeType?: 'neutral' | 'warning' | 'danger' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  badgeText,
  badgeType = 'neutral'
}) => {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-700'
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      iconBg: 'bg-blue-100 text-blue-700'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100 text-amber-700'
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      iconBg: 'bg-rose-100 text-rose-700'
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      iconBg: 'bg-purple-100 text-purple-700'
    },
    slate: {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-100',
      iconBg: 'bg-slate-100 text-slate-700'
    }
  }[color];

  const badgeStyles = {
    neutral: 'bg-slate-100 text-slate-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
    success: 'bg-emerald-100 text-emerald-800'
  }[badgeType];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</span>
        <div className={`p-2 rounded-lg ${colorMap.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {badgeText && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyles}`}>
            {badgeText}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}
    </div>
  );
};
