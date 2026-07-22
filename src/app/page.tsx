"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import IDCard from '@/components/IDCard';
import Referrals from '@/components/Referrals';
import Tickets from '@/components/Tickets';
import Lobby25MemberEntry from '@/components/Lobby25MemberEntry';
import Lobby24MemberEntry from '@/components/Lobby24MemberEntry';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Home() {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Monitor auth state to check if user is admin from admins.csv
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminRes = await fetch('/admins.csv');
        let adminEmailsList: string[] = [];
        if (adminRes.ok) {
          const adminText = await adminRes.text();
          adminEmailsList = adminText.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('Email'))
            .map(email => email.toLowerCase());
        }

        onAuthStateChanged(auth, (user) => {
          if (user && user.email) {
            const isUserAdmin = adminEmailsList.includes(user.email.toLowerCase());
            setIsAdmin(isUserAdmin);
          } else {
            setIsAdmin(false);
          }
        });
      } catch (err) {
        console.error("Error reading admins CSV:", err);
      }
    };

    checkAdminStatus();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setToastKey((prev) => prev + 1);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handlePageChange = (pageId: string) => {
    if (pageId === 'tickets') {
      showToast('This section is locked and will be available in a future update.');
      return;
    }
    setActivePage(pageId);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard':
        return 'Dashboard';
      case 'batch25':
        return 'Lobby 25';
      case 'batch24':
        return 'Lobby 24';
      case 'referrals':
        return 'Referrals';
      case 'idcard':
        return 'ID Card Portal';
      case 'tickets':
        return 'Tickets';
      default:
        return 'Command Center';
    }
  };

  return (
    <div className="min-h-screen bg-[#05010a] text-[#e2e8f0] flex flex-col custom-scrollbar">
      {/* Top Navbar */}
      <Navbar pageTitle={getPageTitle()} />

      <div className="flex flex-1">
        {/* Left Side HUD Sidebar */}
        <Sidebar activePage={activePage} onPageChange={handlePageChange} isAdmin={isAdmin} />

        {/* Page Content Area */}
        <main className="flex-grow min-w-0 pb-24 md:pb-12 min-h-[calc(100vh-76px)] flex flex-col">
          {activePage === 'dashboard' && <Dashboard onPageChange={handlePageChange} />}
          {activePage === 'batch25' && <Lobby25MemberEntry onRedirect={() => handlePageChange('dashboard')} />}
          {activePage === 'batch24' && <Lobby24MemberEntry onRedirect={() => handlePageChange('dashboard')} />}
          {activePage === 'referrals' && <Referrals onRedirect={() => handlePageChange('dashboard')} />}
          {activePage === 'idcard' && <IDCard onRedirect={() => handlePageChange('dashboard')} />}
          {activePage === 'tickets' && <Tickets onRedirect={() => handlePageChange('dashboard')} />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0e0518]/95 backdrop-blur-lg border-t border-purple-500/30 flex justify-around py-3 z-50">
        <button
          onClick={() => handlePageChange('dashboard')}
          className={`flex flex-col items-center gap-1 ${activePage === 'dashboard' ? 'text-purple-400 font-bold' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-xl">dashboard</span>
          <span className="font-label-caps text-[9px]">HOME</span>
        </button>
        <button
          onClick={() => handlePageChange('referrals')}
          className={`flex flex-col items-center gap-1 ${activePage === 'referrals' ? 'text-purple-400 font-bold' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-xl">share</span>
          <span className="font-label-caps text-[9px]">REFER</span>
        </button>
        <button
          onClick={() => handlePageChange('idcard')}
          className={`flex flex-col items-center gap-1 ${activePage === 'idcard' ? 'text-purple-400 font-bold' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-xl">badge</span>
          <span className="font-label-caps text-[9px]">ID CARD</span>
        </button>
        <button
          onClick={() => handlePageChange('tickets')}
          className={`flex flex-col items-center gap-1 ${activePage === 'tickets' ? 'text-purple-400 font-bold' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-xl">confirmation_number</span>
          <span className="font-label-caps text-[9px]">TICKETS</span>
        </button>
      </nav>

      {/* Premium Glassmorphic Toast Notification */}
      {toast && (
        <div
          key={toastKey}
          className="fixed top-20 right-4 md:right-8 z-[100] bg-[#13091f]/95 border border-purple-500/40 backdrop-blur-xl px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.3)] text-white font-body-md flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-purple-400">info</span>
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}
