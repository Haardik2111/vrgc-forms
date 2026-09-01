"use client";

import React, { useRef, useState, useEffect } from 'react';

interface DashboardProps {
  onPageChange: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});

  // Mouse tilt handlers for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation degree (max 15 degrees)
    const rotateY = ((x - centerX) / centerX) * 15;
    const rotateX = -((y - centerY) / centerY) * 15;

    setTransformStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`,
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
      const { beta, gamma } = e; // beta: -180 to 180 (X-axis), gamma: -90 to 90 (Y-axis)
      if (beta === null || gamma === null) return;
      
      // Limit beta and gamma to reasonable tilt range (e.g. -30 to 30)
      const clampedBeta = Math.min(Math.max(beta, -30), 30);
      const clampedGamma = Math.min(Math.max(gamma, -30), 30);
      
      // Map to rotation degrees (max 12deg)
      const rotateX = (clampedBeta / 30) * 12;
      const rotateY = (clampedGamma / 30) * 12;

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

  return (
    <div className="flex-grow min-h-[calc(100vh-117px)] overflow-y-auto p-4 md:p-8 bg-mesh relative text-left select-none">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header / Hero Section */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-8 stagger-in pb-8 border-b border-purple-500/10">
          <div className="space-y-3 max-w-2xl text-left w-full">
            <span className="font-label-caps text-xs text-purple-400 tracking-widest block font-bold">
              COMMAND CENTER
            </span>
            <h2 className="font-display-lg text-3xl md:text-[40px] text-white font-extrabold uppercase tracking-tight">
              Direct Access Portal
            </h2>
            <p className="font-body-lg text-slate-400 text-sm md:text-base leading-relaxed">
              Streamlined navigation for the Elite Tier ecosystem. Select a destination to initiate your workflow.
            </p>
          </div>
          {/* Mouse & Device Tilt Hero Logo Card */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={transformStyle}
            className="w-full md:w-80 h-44 rounded-2xl overflow-hidden border border-purple-500/30 flex items-center justify-center bg-gradient-to-br from-[#0e0518] to-[#05010a] relative shadow-[0_0_40px_rgba(168,85,247,0.15)] flex-shrink-0 cursor-pointer select-none"
          >
            <img src="/vrgc-logo.png" alt="VRGC Hero Logo" className="w-full h-full object-cover opacity-85 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05010a] via-transparent to-transparent pointer-events-none"></div>
          </div>
        </section>

        {/* Navigation Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Referral Program Card */}
          <button
            onClick={() => onPageChange('referrals')}
            className="group relative flex flex-col items-start p-8 bg-gradient-to-b from-[#130728] via-[#0b0318] to-[#06010d] border border-purple-500/25 hover:border-purple-500/60 rounded-3xl transition-all duration-300 text-left overflow-hidden h-[320px] w-full shadow-[0_0_25px_rgba(168,85,247,0.08)] hover:shadow-[0_0_35px_rgba(168,85,247,0.25)] hover:-translate-y-1.5"
          >
            {/* Ambient Background Glow Halos */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/35 transition-all duration-500" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[170px] text-purple-400">share</span>
            </div>

            {/* Badge Pill */}
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-110 group-hover:border-purple-400 transition-all duration-300">
                <span className="material-symbols-outlined text-purple-300 text-3xl group-hover:rotate-12 transition-transform">loyalty</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                Recruitment
              </span>
            </div>

            <div className="mb-auto z-10 space-y-2">
              <h3 className="font-display-lg text-xl text-white font-extrabold tracking-tight group-hover:text-purple-300 transition-colors">
                Referral Program
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Expand the VRGC network. Track candidate referral statuses, inspect submitted dossiers, and earn recognition.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-purple-500/15">
              <span className="font-code-sm text-[11px] text-purple-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>OPEN PROGRAM</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-purple-500/20 group-hover:bg-purple-600 border border-purple-500/40 flex items-center justify-center text-white transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* Payments & Dues Portal Card */}
          <button
            onClick={() => onPageChange('payments')}
            className="group relative flex flex-col items-start p-8 bg-gradient-to-b from-[#130728] via-[#0b0318] to-[#06010d] border border-purple-500/25 hover:border-emerald-500/60 rounded-3xl transition-all duration-300 text-left overflow-hidden h-[320px] w-full shadow-[0_0_25px_rgba(168,85,247,0.08)] hover:shadow-[0_0_35px_rgba(16,185,129,0.2)] hover:-translate-y-1.5"
          >
            {/* Ambient Background Glow Halos */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/30 transition-all duration-500" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[170px] text-emerald-400">payments</span>
            </div>

            {/* Badge Pill */}
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 group-hover:border-emerald-400 transition-all duration-300">
                <span className="material-symbols-outlined text-emerald-300 text-3xl group-hover:rotate-12 transition-transform">account_balance_wallet</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                Finance Desk
              </span>
            </div>

            <div className="mb-auto z-10 space-y-2">
              <h3 className="font-display-lg text-xl text-white font-extrabold tracking-tight group-hover:text-emerald-300 transition-colors">
                Payments &amp; Dues
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Manage club membership fees, active dues, automated Razorpay transactions, and view verified payment receipts.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-emerald-500/15">
              <span className="font-code-sm text-[11px] text-emerald-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>PAY DUES</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 group-hover:bg-emerald-600 border border-emerald-500/40 flex items-center justify-center text-white transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </div>
          </button>

          {/* ID Card Portal Card */}
          <button
            onClick={() => onPageChange('idcard')}
            className="group relative flex flex-col items-start p-8 bg-gradient-to-b from-[#130728] via-[#0b0318] to-[#06010d] border border-purple-500/25 hover:border-amber-500/60 rounded-3xl transition-all duration-300 text-left overflow-hidden h-[320px] w-full shadow-[0_0_25px_rgba(168,85,247,0.08)] hover:shadow-[0_0_35px_rgba(245,158,11,0.2)] hover:-translate-y-1.5"
          >
            {/* Ambient Background Glow Halos */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/30 transition-all duration-500" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 opacity-60 group-hover:opacity-100 transition-opacity" />

            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <span className="material-symbols-outlined text-[170px] text-amber-400">badge</span>
            </div>

            {/* Badge Pill */}
            <div className="flex items-center justify-between w-full mb-4 z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-110 group-hover:border-amber-400 transition-all duration-300">
                <span className="material-symbols-outlined text-amber-300 text-3xl group-hover:rotate-12 transition-transform">badge</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                Identity Pass
              </span>
            </div>

            <div className="mb-auto z-10 space-y-2">
              <h3 className="font-display-lg text-xl text-white font-extrabold tracking-tight group-hover:text-amber-300 transition-colors">
                Digital ID Card
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Claim your VRGC Digital ID credentials. Submit official profile photo and generate high-res ID pass.
              </p>
            </div>

            <div className="mt-4 w-full flex items-center justify-between z-10 pt-4 border-t border-amber-500/15">
              <span className="font-code-sm text-[11px] text-amber-300 font-extrabold tracking-widest uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>GENERATE CARD</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-amber-500/20 group-hover:bg-amber-600 border border-amber-500/40 flex items-center justify-center text-white transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
