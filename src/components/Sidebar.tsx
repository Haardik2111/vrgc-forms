"use client";

import React from 'react';

import { PermissionsConfig, resolveUserPagePermission, PageId } from '@/lib/permissions';

interface SidebarProps {
  activePage: string;
  onPageChange: (pageId: string) => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isFaculty?: boolean;
  isAuthorized?: boolean;
  userRole?: string | null;
  permissionsConfig?: PermissionsConfig;
}

const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
  isAdmin = false,
  isSuperAdmin = false,
  isFaculty = false,
  isAuthorized = true,
  userRole,
  permissionsConfig,
}) => {
  // Base menu items
  const baseItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'members', label: 'Members Roster', icon: 'groups' },
    { id: 'planned_events', label: 'Planned Events', icon: 'event_upcoming' },
    { id: 'payments', label: isFaculty ? 'Payments View' : 'Payments & Dues', icon: 'payments' },
    { id: 'idcard', label: 'ID Card Portal', icon: 'badge' },
    { id: 'referrals', label: 'Referrals', icon: 'share' },
  ];

  // Filter based on permissions matrix
  const menuItems = baseItems.filter((item) => {
    if (item.id === 'dashboard') return true;
    if (isSuperAdmin) return true;
    if (!permissionsConfig) return true;

    const perm = resolveUserPagePermission(
      item.id as PageId,
      permissionsConfig,
      userRole,
      isSuperAdmin,
      isFaculty,
      isAuthorized
    );
    return perm.canView;
  });

  // If Super Admin, add dedicated Super Admin Enclave
  if (isSuperAdmin) {
    menuItems.push({
      id: 'superadmin',
      label: 'Super Admin',
      icon: 'admin_panel_settings',
    });
  }

  return (
    <aside className="h-[calc(100vh-76px)] w-64 hidden md:flex flex-col p-4 bg-[#090314] border-r border-purple-500/20 sticky top-[76px] select-none">
      <div className="flex flex-col gap-2 flex-grow">
        {/* Role indicator banner inside sidebar */}
        {isFaculty && (
          <div className="px-4 py-2 mb-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400 text-sm">school</span>
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
              Faculty Workspace
            </span>
          </div>
        )}

        {menuItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex items-center gap-4 px-4 py-3 text-left transition-all duration-200 rounded-xl ${
                isActive
                  ? 'text-white bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.4)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 hover:border-l-4 hover:border-purple-500 border-l-4 border-transparent'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-xs font-bold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
