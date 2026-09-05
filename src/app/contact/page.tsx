"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Send,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  HelpCircle,
  ArrowLeft,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Eye,
  Filter,
  CheckSquare,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/lib/auth-context';
import Footer from '@/components/Footer';
import {
  SupportTicket,
  saveTicketToUserHistory,
  getUserHistoryTicketIds,
  fetchTicketById,
  fetchAllActiveTickets,
  resolveTicket,
  reopenTicket,
  isTicketExpired,
  getRemainingSolvedTime,
} from '@/lib/support';

const FAQS = [
  {
    q: 'How do I verify if my club membership payment went through?',
    a: 'Head to the Payments & Dues portal from the main dashboard. If your payment was successful via Razorpay, your status will show "Verified" with a transaction reference. If amount was deducted but still shows pending, submit a ticket below with your payment screenshot / Razorpay payment ID.',
  },
  {
    q: 'Why is my ID Card showing "Under Verification"?',
    a: 'ID Cards undergo a two-step audit by Domain Leads and Chapter Administrators to verify uploaded portraits, registration credentials, and club affiliations. Verification typically completes within 24–48 hours.',
  },
  {
    q: 'How can I change my allocated Primary Domain or Position?',
    a: 'Domain and Position metadata updates must be requested through your respective Domain Lead or Chapter Coordinator. You can also file a ticket below under the "Domain / Role Allocation" category.',
  },
  {
    q: 'Can non-members register for Planned Events and Hackathons?',
    a: 'Most flag-bearer tournaments and workshops have open public rounds. However, members receive priority seating, waived registration fees, and official VRGC digital credentials.',
  },
];

const CATEGORIES = [
  { id: 'payment', label: 'Payment & Dues', desc: 'Dues status, Razorpay issues, refund inquiry' },
  { id: 'idcard', label: 'ID Card & Dossier', desc: 'Photo rejection, details correction, download issue' },
  { id: 'membership', label: 'Domain / Roster', desc: 'Domain reallocation, roster details update' },
  { id: 'events', label: 'Planned Events', desc: 'Event registrations, hackathons, tournament queries' },
  { id: 'referrals', label: 'Referrals Portal', desc: 'Code issues, candidate status, milestone tracking' },
  { id: 'technical', label: 'Bug / Technical', desc: 'System glitch, login failure, access errors' },
  { id: 'other', label: 'General Inquiry', desc: 'Sponsorships, collaborations, other questions' },
];

function ContactPageContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');

  const { isSuperAdmin, isAdmin, userRole, userEmail } = useAuth();
  const canResolveTickets = isSuperAdmin || isAdmin || userRole === 'Technical';

  const [activeTab, setActiveTab] = useState<'submit' | 'track' | 'resolve'>(
    urlTab === 'resolve' ? 'resolve' : urlTab === 'track' ? 'track' : 'submit'
  );

  // Form State
  const [fullName, setFullName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [category, setCategory] = useState('payment');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Track & History State
  const [searchTicketId, setSearchTicketId] = useState('');
  const [trackedTicket, setTrackedTicket] = useState<SupportTicket | null>(null);
  const [isSearchingTicket, setIsSearchingTicket] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [userHistoryTickets, setUserHistoryTickets] = useState<SupportTicket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Admin Resolution Desk State
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [loadingAllTickets, setLoadingAllTickets] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<string>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');
  const [activeResolutionTicketId, setActiveResolutionTicketId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Auto-fill logged in user info
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.displayName && !fullName) setFullName(user.displayName);
        if (user.email && !contactInfo) setContactInfo(user.email);
      }
    });
    return () => unsub();
  }, []);

  // Update tab if URL changes
  useEffect(() => {
    if (urlTab === 'resolve' && canResolveTickets) {
      setActiveTab('resolve');
    } else if (urlTab === 'track') {
      setActiveTab('track');
    }
  }, [urlTab, canResolveTickets]);

  // Load User History on Tab Switch
  useEffect(() => {
    if (activeTab === 'track') {
      loadUserHistory();
    }
  }, [activeTab]);

  // Load Admin Tickets on Tab Switch
  useEffect(() => {
    if (activeTab === 'resolve' && canResolveTickets) {
      loadAdminTickets();
    }
  }, [activeTab, canResolveTickets]);

  const loadUserHistory = async () => {
    setLoadingHistory(true);
    try {
      const ids = getUserHistoryTicketIds();
      if (ids.length === 0) {
        setUserHistoryTickets([]);
        return;
      }
      const promises = ids.map((id) => fetchTicketById(id));
      const results = await Promise.all(promises);
      // Filter out nulls and tickets solved for more than 12 hours
      const valid = results.filter((t): t is SupportTicket => t !== null && !isTicketExpired(t));
      setUserHistoryTickets(valid);
    } catch (err) {
      console.error('Error loading history tickets:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAdminTickets = async () => {
    setLoadingAllTickets(true);
    try {
      const tickets = await fetchAllActiveTickets();
      setAllTickets(tickets);
    } catch (err) {
      console.error('Error loading admin tickets:', err);
    } finally {
      setLoadingAllTickets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !contactInfo.trim() || !message.trim()) {
      setErrorMsg('Please fill in your name, contact email/phone, and description.');
      return;
    }

    setIsSubmitting(true);
    const generatedId = `VRGC-SUP-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          contactInfo: contactInfo.trim(),
          regNo: regNo.trim().toUpperCase(),
          category,
          message: message.trim(),
          ticketId: generatedId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch ticket');
      }

      setTicketId(generatedId);
      // Save to localStorage history
      saveTicketToUserHistory(generatedId);
    } catch (err: any) {
      console.error('Contact submission error:', err);
      setErrorMsg(err.message || 'Failed to submit ticket. Please try again or email directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError('');
    setTrackedTicket(null);

    const cleanId = searchTicketId.trim().toUpperCase();
    if (!cleanId) {
      setSearchError('Please enter a valid Ticket ID (e.g. VRGC-SUP-481920).');
      return;
    }

    setIsSearchingTicket(true);
    try {
      const ticket = await fetchTicketById(cleanId);
      if (!ticket) {
        setSearchError(`No active record found for Ticket ID "${cleanId}".`);
      } else if (isTicketExpired(ticket)) {
        setSearchError(`Ticket "${cleanId}" was marked as SOLVED and has been archived following the 12-hour resolution window.`);
      } else {
        setTrackedTicket(ticket);
      }
    } catch (err: any) {
      setSearchError('Failed to retrieve ticket status: ' + err.message);
    } finally {
      setIsSearchingTicket(false);
    }
  };

  const handleResolveTicket = async (ticketIdToResolve: string) => {
    setResolvingId(ticketIdToResolve);
    try {
      await resolveTicket(
        ticketIdToResolve,
        userEmail || 'Admin',
        resolutionNoteInput.trim() || 'Issue verified and resolved by Technical Team.'
      );
      setActionSuccessMsg(`Ticket ${ticketIdToResolve} marked as SOLVED!`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      setActiveResolutionTicketId(null);
      setResolutionNoteInput('');
      await loadAdminTickets();
    } catch (err: any) {
      alert('Failed to resolve ticket: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const handleReopenTicket = async (ticketIdToReopen: string) => {
    setResolvingId(ticketIdToReopen);
    try {
      await reopenTicket(ticketIdToReopen);
      setActionSuccessMsg(`Ticket ${ticketIdToReopen} reopened as UNSOLVED.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      await loadAdminTickets();
    } catch (err: any) {
      alert('Failed to reopen ticket: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const copyTicketId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2500);
  };

  const handleResetForm = () => {
    setTicketId(null);
    setMessage('');
    setErrorMsg(null);
  };

  // Filtered tickets for Admin Resolution Desk
  const filteredAdminTickets = allTickets.filter((t) => {
    if (isTicketExpired(t)) return false;

    if (adminStatusFilter !== 'all' && t.status !== adminStatusFilter) {
      return false;
    }

    if (adminCategoryFilter !== 'all' && t.category !== adminCategoryFilter) {
      return false;
    }

    if (adminSearchQuery.trim()) {
      const q = adminSearchQuery.toLowerCase().trim();
      const matchId = t.ticketId.toLowerCase().includes(q);
      const matchName = t.fullName.toLowerCase().includes(q);
      const matchEmail = t.contactInfo.toLowerCase().includes(q);
      const matchReg = (t.regNo || '').toLowerCase().includes(q);
      const matchMsg = t.message.toLowerCase().includes(q);
      return matchId || matchName || matchEmail || matchReg || matchMsg;
    }

    return true;
  });

  const unsolvedCount = allTickets.filter((t) => t.status === 'unsolved' && !isTicketExpired(t)).length;

  return (
    <div className="min-h-screen bg-[#070212] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white relative overflow-x-hidden font-sans">
      {/* Background Ambient Cyber Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none -z-10 opacity-60" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#070212]/90 backdrop-blur-xl border-b border-purple-500/20 px-3 sm:px-8 py-3 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 text-xs font-bold transition-all cursor-pointer shrink-0 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Command Center</span>
          </Link>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline truncate">
            VRGC Help Desk &amp; Resolution Enclave
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/about"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-colors"
          >
            Tech Team
          </Link>
          <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 font-mono text-[10px] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            SLA: ACTIVE
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        
        {/* Header & Mode Selector Tabs */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>VRGC SUPPORT &amp; ISSUE TRACKER</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
            Official Support &amp;{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
              Resolution Desk
            </span>
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Submit a support dossier, track your generated Ticket ID in real-time, and check resolution status. Solved tickets are automatically archived after 12 hours.
          </p>

          {/* Tab Switcher Pills */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 pt-3 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'submit'
                  ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] border border-purple-400/60'
                  : 'bg-[#140b24] text-slate-400 border border-[#2b1642] hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>File Dossier</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('track')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'track'
                  ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] border border-purple-400/60'
                  : 'bg-[#140b24] text-slate-400 border border-[#2b1642] hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track &amp; History</span>
            </button>

            {/* Admin Resolution Center Tab (Only visible to Admin, Super Admin, and Technical Team) */}
            {canResolveTickets && (
              <button
                type="button"
                onClick={() => setActiveTab('resolve')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'resolve'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400'
                    : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Resolve Tickets</span>
                {unsolvedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
                    {unsolvedCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </section>

        {/* Action Success Banner */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionSuccessMsg}</span>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: FILE DOSSIER (SUBMISSION FORM) */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'submit' && (
          <div className="space-y-10">
            {/* Quick Contact Info Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <a
                href="mailto:vrgc@vitbhopal.ac.in"
                className="p-4 rounded-2xl bg-[#0e071c] border border-purple-500/30 hover:border-purple-500/60 transition-all block group"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-300 mb-2.5">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-xs">Official Email</h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">vrgc@vitbhopal.ac.in</p>
              </a>

              <div className="p-4 rounded-2xl bg-[#0e071c] border border-purple-500/30">
                <div className="w-8 h-8 rounded-xl bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mb-2.5">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-xs">SLA Response</h3>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">Within 2–6 Hours</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0e071c] border border-purple-500/30">
                <div className="w-8 h-8 rounded-xl bg-indigo-900/40 border border-indigo-500/40 flex items-center justify-center text-indigo-300 mb-2.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-xs">Base Enclave</h3>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">VIT Bhopal University</p>
              </div>

              <a
                href="https://www.instagram.com/vrgc.vitb"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-[#0e071c] border border-purple-500/30 hover:border-pink-500/60 transition-all block group"
              >
                <div className="w-8 h-8 rounded-xl bg-pink-900/40 border border-pink-500/40 flex items-center justify-center text-pink-300 mb-2.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-xs group-hover:text-pink-300 transition-colors">Social Comms</h3>
                <p className="text-[11px] text-pink-400 font-mono mt-0.5 group-hover:underline flex items-center gap-1">
                  <span>@vrgc.vitb</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </p>
              </a>
            </section>

            {/* Form Section */}
            <section className="bg-[#0c0517] border border-purple-500/40 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(147,51,234,0.15)] relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <MessageSquare className="w-6 h-6 text-purple-400" />
                      <span>File an Official Support Dossier</span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Dispatched directly to VRGC Executive Leads with real-time audit logging.
                    </p>
                  </div>

                  <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-purple-950/80 border border-purple-600/50 text-purple-300 self-start sm:self-auto">
                    256-BIT ENCRYPTED TICKET
                  </span>
                </div>

                {/* Success View */}
                {ticketId ? (
                  <div className="p-8 rounded-2xl bg-[#140b24] border border-emerald-500/50 space-y-5 text-center animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-500/60 text-emerald-300 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-white">Support Ticket Dispatched!</h3>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Your ticket has been recorded in the database. When marked as <strong className="text-emerald-300">SOLVED</strong>, it will remain visible in history for 12 hours before automatic removal.
                      </p>
                    </div>

                    {/* Ticket Reference Box */}
                    <div className="max-w-sm mx-auto p-4 rounded-xl bg-black/60 border border-emerald-500/40 flex items-center justify-between gap-2">
                      <div className="text-left font-mono">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Ticket Reference ID</span>
                        <span className="text-base font-black text-emerald-300">{ticketId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyTicketId(ticketId)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {copiedTicket ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTicketId(ticketId);
                          setActiveTab('track');
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Track Status Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-900 border border-purple-500/50 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Submit Another Query
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Submission Form */
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {errorMsg && (
                      <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Category Selection */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                        Select Issue Category <span className="text-purple-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {CATEGORIES.map((c) => {
                          const isSelected = category === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setCategory(c.id)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                                  : 'bg-[#140b24] border-[#2b1642] text-slate-300 hover:border-purple-500/40 hover:text-white'
                              }`}
                            >
                              <div className="text-xs font-black flex items-center justify-between">
                                <span>{c.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <p className={`text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                                {c.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Alex Johnson"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Official Email / Phone <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. name@vitbhopal.ac.in"
                          value={contactInfo}
                          onChange={(e) => setContactInfo(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Registration Number <span className="text-slate-500 font-mono text-[10px]">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 24BCE10999"
                          value={regNo}
                          onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 uppercase font-mono transition-colors"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-300 uppercase tracking-wider">
                          Detailed Issue Description <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                          {message.length}/1000 characters
                        </span>
                      </div>
                      <textarea
                        required
                        rows={4}
                        maxLength={1000}
                        placeholder="Describe your issue or inquiry with specific details (e.g. transaction ID, error message, browser, domain preference)..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors custom-scrollbar"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>Tickets are monitored directly by Chapter Technical Leads</span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Dispatching Ticket...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Dispatch Support Ticket</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: TRACK BY ID & PERSONAL TICKET HISTORY */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'track' && (
          <div className="space-y-8">
            {/* Search Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0c0517] border border-purple-500/40 shadow-xl space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-purple-400" />
                  <span>Find &amp; Track Support Issue by Generated ID</span>
                </h2>
                <p className="text-xs text-slate-300">
                  Enter your reference ID (e.g. <span className="text-purple-300 font-mono">VRGC-SUP-481920</span>) to check if your issue is Unsolved or Solved.
                </p>
              </div>

              <form onSubmit={handleTrackSearch} className="flex flex-col sm:flex-row gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Enter Ticket ID (e.g. VRGC-SUP-481920)..."
                  value={searchTicketId}
                  onChange={(e) => setSearchTicketId(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-purple-500 focus:outline-none text-xs text-white font-mono placeholder-slate-500 uppercase transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSearchingTicket}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isSearchingTicket ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Track Issue</span>
                </button>
              </form>

              {searchError && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Display Result If Found */}
              {trackedTicket && (
                <div className="p-5 rounded-2xl bg-[#140b24] border border-purple-500/40 space-y-3.5 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm text-purple-300">
                        {trackedTicket.ticketId}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                        {trackedTicket.category}
                      </span>
                    </div>

                    {/* Status Badge */}
                    {trackedTicket.status === 'solved' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 text-xs font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>SOLVED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500 text-xs font-black shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>UNSOLVED • UNDER REVIEW</span>
                      </div>
                    )}
                  </div>

                  {/* Solved 12h timer notice */}
                  {trackedTicket.status === 'solved' && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resolved by {trackedTicket.resolvedBy || 'VRGC Technical Lead'}</span>
                      </div>
                      {trackedTicket.resolutionNote && (
                        <p className="text-[11px] text-slate-300 italic">
                          &quot;{trackedTicket.resolutionNote}&quot;
                        </p>
                      )}
                      <div className="text-[10px] text-emerald-400 font-mono pt-1">
                        ⏰ {getRemainingSolvedTime(trackedTicket)} (will be removed automatically after 12 hours)
                      </div>
                    </div>
                  )}

                  {/* Unsolved notice */}
                  {trackedTicket.status === 'unsolved' && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200">
                      Our Technical team is actively investigating this dossier. When marked as resolved by an admin, the status will update to <strong className="text-white font-mono">SOLVED</strong> here.
                    </div>
                  )}

                  {/* Ticket Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-black/40 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">SUBMITTER:</span>
                      <span className="text-white truncate block">{trackedTicket.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">CONTACT:</span>
                      <span className="text-white truncate block">{trackedTicket.contactInfo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">DATE:</span>
                      <span className="text-slate-300 truncate block">{new Date(trackedTicket.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-purple-300 uppercase block mb-1">Issue Description:</span>
                    <p className="whitespace-pre-wrap">{trackedTicket.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* User Ticket History List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <span>My Generated Tickets History</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Active tickets generated on this device. Tickets marked as Solved disappear after 12 hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadUserHistory}
                  disabled={loadingHistory}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-slate-400 bg-[#0c0517] rounded-2xl border border-purple-500/20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-xs">Loading ticket history...</span>
                  </div>
                </div>
              ) : userHistoryTickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-[#0c0517] rounded-2xl border border-purple-500/20 text-xs space-y-2">
                  <p>No active tickets found in your history.</p>
                  <p className="text-[11px] text-slate-400">
                    Either you have not generated any tickets yet, or your previously solved tickets have completed their 12-hour resolution period.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {userHistoryTickets.map((t) => {
                    const isSolved = t.status === 'solved';
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border space-y-3 transition-all ${
                          isSolved
                            ? 'bg-[#0a1614] border-emerald-500/40 shadow-sm'
                            : 'bg-[#150b20] border-amber-500/40 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-white">{t.ticketId}</span>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                              {t.category}
                            </span>
                          </div>

                          {isSolved ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-500">
                              SOLVED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-500">
                              UNSOLVED
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {t.message}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono">
                          <span className="text-slate-400">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                          {isSolved && (
                            <span className="text-emerald-400">
                              {getRemainingSolvedTime(t)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: ADMIN RESOLUTION CENTER (Strict Role Gate) */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'resolve' && canResolveTickets && (
          <div className="space-y-6">
            {/* Header with quick stats */}
            <div className="p-6 rounded-3xl bg-[#0e071c] border border-amber-500/40 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black uppercase">
                      EXECUTIVE LEVEL
                    </span>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <span>Support Ticket Resolution Center</span>
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Direct access for Admin, Super Admin, and Technical Team to investigate, resolve, and audit complaints by Generated Ticket ID.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadAdminTickets}
                  disabled={loadingAllTickets}
                  className="px-3.5 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAllTickets ? 'animate-spin' : ''}`} />
                  <span>Reload Queue</span>
                </button>
              </div>

              {/* Filter Strip */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by Ticket ID, Full Name, Email, or Reg No..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#140b24] border border-[#2b1642] focus:border-amber-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
                  />
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setAdminStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      adminStatusFilter === 'all'
                        ? 'bg-amber-500 text-black font-black'
                        : 'bg-[#140b24] text-slate-400 hover:text-white border border-[#2b1642]'
                    }`}
                  >
                    All ({allTickets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminStatusFilter('unsolved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      adminStatusFilter === 'unsolved'
                        ? 'bg-amber-500 text-black font-black'
                        : 'bg-[#140b24] text-amber-300 hover:text-white border border-amber-500/30'
                    }`}
                  >
                    Unsolved ({unsolvedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminStatusFilter('solved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      adminStatusFilter === 'solved'
                        ? 'bg-emerald-500 text-black font-black'
                        : 'bg-[#140b24] text-emerald-300 hover:text-white border border-emerald-500/30'
                    }`}
                  >
                    Solved ({allTickets.length - unsolvedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Ticket Cards Queue */}
            {loadingAllTickets ? (
              <div className="p-12 text-center text-slate-400 bg-[#0c0517] rounded-3xl border border-amber-500/20">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-xs">Loading resolution queue from Firestore...</span>
                </div>
              </div>
            ) : filteredAdminTickets.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-[#0c0517] rounded-3xl border border-amber-500/20 text-xs space-y-1">
                <p className="font-bold text-white text-sm">No active support tickets match your filters.</p>
                <p className="text-slate-400">
                  Tickets that are resolved over 12 hours ago are automatically purged from the resolution desk.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAdminTickets.map((t) => {
                  const isSolved = t.status === 'solved';
                  const isResolvingThis = resolvingId === t.ticketId;
                  const isNoteFormOpen = activeResolutionTicketId === t.ticketId;

                  return (
                    <div
                      key={t.id}
                      className={`p-5 rounded-3xl border space-y-4 transition-all ${
                        isSolved
                          ? 'bg-[#091512] border-emerald-500/40'
                          : 'bg-[#12081e] border-amber-500/50 shadow-lg shadow-purple-950/20'
                      }`}
                    >
                      {/* Top bar: Ticket ID, Category, Submitter info, Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-black text-sm text-white bg-black/50 px-2.5 py-1 rounded-lg border border-white/10">
                            {t.ticketId}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                            {t.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(t.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Status Chip */}
                        {isSolved ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 text-xs font-black self-start sm:self-auto">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>SOLVED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500 text-xs font-black self-start sm:self-auto animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>UNSOLVED</span>
                          </div>
                        )}
                      </div>

                      {/* Submitter Bio Bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-black/40 p-3 rounded-2xl">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">NAME:</span>
                          <span className="text-white font-bold truncate block">{t.fullName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">CONTACT INFO:</span>
                          <a href={`mailto:${t.contactInfo}`} className="text-purple-300 hover:underline truncate block">
                            {t.contactInfo}
                          </a>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">REG NUMBER:</span>
                          <span className="text-slate-200 truncate block">{t.regNo || '—'}</span>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className="text-xs text-slate-200 bg-black/20 p-3.5 rounded-2xl border border-white/5 space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">Issue Description:</span>
                        <p className="whitespace-pre-wrap leading-relaxed">{t.message}</p>
                      </div>

                      {/* If Solved: Show Resolution Audit Details & Countdown */}
                      {isSolved && (
                        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-1 font-bold">
                            <span>Resolved by: {t.resolvedBy || 'Admin'}</span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              ⏰ {getRemainingSolvedTime(t)}
                            </span>
                          </div>
                          {t.resolutionNote && (
                            <p className="text-[11px] text-slate-300 italic pt-0.5">
                              Note: &quot;{t.resolutionNote}&quot;
                            </p>
                          )}
                        </div>
                      )}

                      {/* Resolution Actions */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
                        <span className="text-[10px] font-mono text-slate-400">
                          {isSolved ? 'Auto-deletes from queue 12h post-resolution' : 'Action required by admin'}
                        </span>

                        <div className="flex items-center gap-2">
                          {!isSolved ? (
                            isNoteFormOpen ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  placeholder="Add resolution note (optional)..."
                                  value={resolutionNoteInput}
                                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                                  className="px-3 py-1.5 rounded-xl bg-black border border-emerald-500/60 text-xs text-white focus:outline-none w-56"
                                />
                                <button
                                  type="button"
                                  disabled={isResolvingThis}
                                  onClick={() => handleResolveTicket(t.ticketId)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  {isResolvingThis ? 'Saving...' : 'Confirm Solved'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveResolutionTicketId(null)}
                                  className="px-2.5 py-1.5 rounded-xl bg-white/10 text-slate-300 text-xs font-bold hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveResolutionTicketId(t.ticketId);
                                  setResolutionNoteInput('Verified and resolved by VRGC Team.');
                                }}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark as Solved</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={isResolvingThis}
                              onClick={() => handleReopenTicket(t.ticketId)}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                              title="Reopen this ticket as Unsolved"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Reopen as Unsolved</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick FAQ Section */}
        <section className="space-y-4 pt-4 border-t border-purple-500/20">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              <span>Frequently Asked Questions</span>
            </h2>
            <p className="text-xs text-slate-400">
              Quick solutions to the most common portal queries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FAQS.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#0e071c] border border-purple-500/25 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="font-bold text-white text-xs sm:text-sm">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed border-t border-purple-500/15 pt-2 animate-in fade-in">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070212] flex items-center justify-center text-white text-xs">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    }>
      <ContactPageContent />
    </Suspense>
  );
}
