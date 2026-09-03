"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

interface DashboardProps {
  onPageChange: (page: string) => void;
  onOpenSuperAdminModal?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange, onOpenSuperAdminModal }) => {
  const { user, userEmail, memberData, isAdmin, isSuperAdmin, isFaculty } = useAuth();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});

  // Mouse tilt handlers for desktop (solid 3D feel)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateY = ((x - centerX) / centerX) * 12;
    const rotateX = -((y - centerY) / centerY) * 12;

    setTransformStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`,
      transition: 'transform 0.1s ease-out',
    });
  };

  const handleMouseLeave = () => {
    setTransformStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    });
  };

  // Device orientation tilt handler for mobile
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const { beta, gamma } = e;
      if (beta === null || gamma === null) return;
      const clampedBeta = Math.min(Math.max(beta, -30), 30);
      const clampedGamma = Math.min(Math.max(gamma, -30), 30);
      const rotateX = (clampedBeta / 30) * 10;
      const rotateY = (clampedGamma / 30) * 10;

      setTransformStyle({
        transform: `perspective(1000px) rotateX(${-rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
        transition: 'transform 0.2s ease-out',
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Personalized user info calculation
  const rawFullName = memberData?.name || user?.displayName || (userEmail ? userEmail.split('@')[0] : 'Member');
  const firstName = rawFullName.trim().split(' ')[0] || 'Member';
  const designation = memberData?.position || (isSuperAdmin ? 'Super Administrator' : isAdmin ? 'Administrator' : isFaculty ? 'Faculty Mentor' : 'Club Member');
  const teamName = memberData?.team || (isFaculty ? 'Faculty Advisory' : (isSuperAdmin || isAdmin) ? 'Management' : 'General Crew');
  const regNumber = memberData?.registrationNumber || (isSuperAdmin ? 'SUPER ADMIN' : isAdmin ? 'ADMIN' : isFaculty ? 'FACULTY' : '');

  return (
    <div className="flex-grow min-h-[calc(100vh-117px)] overflow-y-auto p-4 md:p-8 bg-[#0a0a0a] relative text-left select-none">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Personalized Welcome & Hero Section (Strictly SOLID colors - NO GRADIENTS) */}
        <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 sm:p-8 bg-[#121212] border border-purple-600/40 rounded-3xl shadow-[0_0_40px_rgba(147,51,234,0.12)]">
          <div className="space-y-4 max-w-2xl text-left w-full">
            {/* Top Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-purple-700 text-white border border-purple-500 flex items-center gap-1.5 shadow-[0_0_12px_rgba(147,51,234,0.3)]">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                COMMAND CENTER
              </span>

              {isSuperAdmin ? (
                <span className="px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-purple-950 text-purple-200 border border-purple-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">verified_user</span>
                  SUPER ADMINISTRATOR
                </span>
              ) : isAdmin ? (
                <span className="px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-[#1f162b] text-purple-300 border border-purple-700/60 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">shield</span>
                  CLUB ADMIN
                </span>
              ) : isFaculty ? (
                <span className="px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-[#141b2d] text-indigo-300 border border-indigo-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">school</span>
                  FACULTY MENTOR
                </span>
              ) : (
                <span className="px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase bg-[#181818] text-slate-300 border border-[#333333] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">badge</span>
                  VERIFIED MEMBER
                </span>
              )}

              {regNumber && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-[#1a1a1a] text-purple-300 border border-[#2e2e2e]">
                  {regNumber}
                </span>
              )}
            </div>

            {/* Main Personalized Greeting */}
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight flex items-baseline gap-2 flex-wrap">
                <span>Welcome,</span>
                <span className="text-purple-400">{firstName}</span>
              </h1>
              
              {/* Designation Strip */}
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#1c1429] border border-purple-600/60 rounded-xl">
                <span className="material-symbols-outlined text-purple-400 text-lg">workspace_premium</span>
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">
                  {designation}
                </span>
                <span className="text-purple-500 font-bold">•</span>
                <span className="text-xs text-purple-300 font-bold tracking-wide">
                  {teamName}
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Direct access portal for the Virtual Reality &amp; Gaming Club ecosystem. Access digital ID passes, dues ledger, event planning proposals, and chapter roster.
            </p>
          </div>

          {/* Mouse & Device Tilt Hero Logo Card (Strictly Solid Background - NO GRADIENT) */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={transformStyle}
            className="w-full lg:w-80 h-44 rounded-2xl overflow-hidden border border-purple-600/50 flex items-center justify-center bg-[#07020d] relative shadow-[0_0_30px_rgba(147,51,234,0.2)] shrink-0 cursor-pointer select-none"
          >
            <img src="/vrgc-logo.png" alt="VRGC Hero Logo" className="w-full h-full object-cover opacity-90 pointer-events-none" />
          </div>
        </section>

        {/* Navigation Bento Grid (Strictly Solid Colors, No Gradients) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* 1. Digital ID Card Card */}
          <button
            onClick={() => onPageChange('idcard')}
            className="group relative flex flex-col items-start p-7 bg-[#141414] border border-[#292929] hover:border-purple-500 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(147,51,234,0.2)] hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-13 h-13 rounded-xl bg-[#1e132e] border border-purple-600/60 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.2)] group-hover:scale-105 group-hover:border-purple-400 transition-all">
                <span className="material-symbols-outlined text-2xl">badge</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#201533] text-purple-300 border border-purple-700/50">
                Identity Pass
              </span>
            </div>

            <div className="mb-auto z-10 space-y-1.5">
              <h3 className="text-xl text-white font-black tracking-tight group-hover:text-purple-300 transition-colors">
                Digital ID Card
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Claim your VRGC Digital ID credentials. Submit official profile photo and generate high-res membership pass.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
              <span className="text-[11px] text-purple-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                GENERATE CARD
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-700 group-hover:bg-purple-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(147,51,234,0.3)]">
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* 2. Payments & Dues Portal Card */}
          <button
            onClick={() => onPageChange('payments')}
            className="group relative flex flex-col items-start p-7 bg-[#141414] border border-[#292929] hover:border-emerald-500 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-13 h-13 rounded-xl bg-[#0f241c] border border-emerald-600/60 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-105 group-hover:border-emerald-400 transition-all">
                <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#102e22] text-emerald-300 border border-emerald-700/50">
                Finance Desk
              </span>
            </div>

            <div className="mb-auto z-10 space-y-1.5">
              <h3 className="text-xl text-white font-black tracking-tight group-hover:text-emerald-300 transition-colors">
                Payments &amp; Dues
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Manage club membership fees, active dues, automated Razorpay transactions, and view verified payment receipts.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
              <span className="text-[11px] text-emerald-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                PAY DUES
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-700 group-hover:bg-emerald-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* 3. Referral Program Card */}
          <button
            onClick={() => onPageChange('referrals')}
            className="group relative flex flex-col items-start p-7 bg-[#141414] border border-[#292929] hover:border-purple-500 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(147,51,234,0.2)] hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-13 h-13 rounded-xl bg-[#1e132e] border border-purple-600/60 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.2)] group-hover:scale-105 group-hover:border-purple-400 transition-all">
                <span className="material-symbols-outlined text-2xl">loyalty</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#201533] text-purple-300 border border-purple-700/50">
                Affiliate
              </span>
            </div>

            <div className="mb-auto z-10 space-y-1.5">
              <h3 className="text-xl text-white font-black tracking-tight group-hover:text-purple-300 transition-colors">
                Referral Program
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Expand the VRGC network. Track candidate referral statuses, inspect submitted dossiers, and earn recognition.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
              <span className="text-[11px] text-purple-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                OPEN PROGRAM
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-700 group-hover:bg-purple-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(147,51,234,0.3)]">
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* 4. Planned Future Events Card (Restored as requested) */}
          <button
            onClick={() => onPageChange('planned_events')}
            className="group relative flex flex-col items-start p-7 bg-[#141414] border border-[#292929] hover:border-indigo-500 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-13 h-13 rounded-xl bg-[#141b33] border border-indigo-600/60 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:scale-105 group-hover:border-indigo-400 transition-all">
                <span className="material-symbols-outlined text-2xl">event_upcoming</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#1b223d] text-indigo-300 border border-indigo-700/50">
                Proposals &amp; Roadmap
              </span>
            </div>

            <div className="mb-auto z-10 space-y-1.5">
              <h3 className="text-xl text-white font-black tracking-tight group-hover:text-indigo-300 transition-colors">
                Planned Future Events
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Review upcoming club event roadmaps, tentative schedules, faculty mentor approvals, and event proposals.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
              <span className="text-[11px] text-indigo-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                VIEW ROADMAP
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-700 group-hover:bg-indigo-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* 5. Members Roster Card (Visible to all) */}
          <button
            onClick={() => onPageChange('members')}
            className="group relative flex flex-col items-start p-7 bg-[#141414] border border-[#292929] hover:border-amber-500 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-13 h-13 rounded-xl bg-[#2a1d0f] border border-amber-600/60 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-105 group-hover:border-amber-400 transition-all">
                <span className="material-symbols-outlined text-2xl">groups</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#332414] text-amber-300 border border-amber-700/50">
                Chapter Directory
              </span>
            </div>

            <div className="mb-auto z-10 space-y-1.5">
              <h3 className="text-xl text-white font-black tracking-tight group-hover:text-amber-300 transition-colors">
                Members Roster
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Explore the complete VRGC crew directory, domain divisions, student leadership governance, and technical talent.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
              <span className="text-[11px] text-amber-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                EXPLORE ROSTER
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-700 group-hover:bg-amber-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* 6. Super Admin & Governance Card (Conditional for Super Admins / Admins) */}
          {(isSuperAdmin || isAdmin) && (
            <button
              onClick={() => {
                if (onOpenSuperAdminModal) {
                  onOpenSuperAdminModal();
                } else {
                  onPageChange('dashboard');
                }
              }}
              className="group relative flex flex-col items-start p-7 bg-[#141414] border border-purple-600/60 hover:border-purple-400 rounded-2xl transition-all duration-200 text-left overflow-hidden h-[300px] w-full shadow-[0_0_25px_rgba(147,51,234,0.15)] hover:shadow-[0_0_35px_rgba(147,51,234,0.3)] hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-4 z-10">
                <div className="w-13 h-13 rounded-xl bg-purple-900/60 border border-purple-500 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(147,51,234,0.3)] group-hover:scale-105 group-hover:border-purple-300 transition-all">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-purple-950 text-purple-200 border border-purple-600">
                  {isSuperAdmin ? 'Super Console' : 'Admin Tools'}
                </span>
              </div>

              <div className="mb-auto z-10 space-y-1.5">
                <h3 className="text-xl text-white font-black tracking-tight group-hover:text-purple-300 transition-colors">
                  Database &amp; Governance
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Manage whitelisted administrators, update the faculty database table in Firebase, and control chapter permissions.
                </p>
              </div>

              <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-[#262626]">
                <span className="text-[11px] text-purple-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  MANAGE CREDENTIALS
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-700 group-hover:bg-purple-600 flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(147,51,234,0.3)]">
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </div>
              </div>
            </button>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
