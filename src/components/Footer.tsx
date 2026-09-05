"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Code2, Sparkles, Mail, ShieldCheck } from 'lucide-react';
import { AboutModal } from './AboutModal';
import { useAuth } from '@/lib/auth-context';

const Footer: React.FC = () => {
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const { isSuperAdmin, isAdmin, userRole } = useAuth();
  const canResolveTickets = isSuperAdmin || isAdmin || userRole === 'Technical';

  return (
    <footer className="w-full relative md:sticky md:bottom-0 z-40 bg-[#070212]/80 backdrop-blur-xl border-t border-purple-500/20 text-[#cbd5e1] shadow-[0_-10px_40px_rgba(107,33,168,0.1)] pb-16 md:pb-0 transition-all duration-300">

      {/* VRGC Tech Team About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Main Ultra-Sleek Docked Footer Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-row items-center justify-between gap-2 text-xs relative z-20">

        {/* Left: Developer Credit (Clickable to open About VRGC Tech Team Page & Modal) */}
        <div className="flex items-center gap-1.5 font-medium text-slate-300 text-[10px] sm:text-[11px] md:text-xs">
          <Code2 className="w-3.5 h-3.5 text-purple-400 shrink-0 hidden sm:block" />
          <Link 
            href="/about"
            className="flex items-center gap-1 truncate hover:opacity-90 group transition-all text-left focus:outline-none"
            title="Click to view About VRGC Tech Team"
          >
            <span className="hidden sm:inline">Developed by</span>
            <span className="sm:hidden">By</span>
            <strong className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-extrabold flex items-center gap-1 underline underline-offset-2 decoration-purple-500/40 group-hover:decoration-pink-400">
              VRGC Tech Team <Sparkles className="w-3 h-3 text-pink-400 hidden sm:block group-hover:scale-125 transition-transform" />
            </strong>
          </Link>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="text-slate-400 text-[10px] sm:text-[11px] hidden md:inline">
            Copyright &copy; {new Date().getFullYear()} <strong className="text-purple-300">VRGC Club | VIT Bhopal</strong>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/contact"
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold shrink-0"
            title="Open Contact Us Page"
          >
            <Mail className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Contact Us</span>
            <span className="sm:hidden">Contact</span>
          </Link>

          {/* Only visible to Admin, Super Admin, and Technical Team */}
          {canResolveTickets && (
            <Link
              href="/contact?tab=resolve"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-500/50 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold shrink-0 cursor-pointer"
              title="Open Support Ticket Resolution Enclave"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Resolve Tickets</span>
            </Link>
          )}
        </div>

      </div>
    </footer>
  );
};

export default Footer;
