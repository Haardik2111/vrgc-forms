"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, query, where, orderBy,
} from 'firebase/firestore';
import { createPaymentInFirestore } from '@/lib/payments';
import { PaymentItem } from '@/types/payment';

const SEAT_LIMIT = 80;

interface EventItem {
  id: string;
  title: string;
  category: string;
  date: string;
  location: string;
  fee: number;
  originalFee?: number;
  description: string;
  bannerUrl?: string;
  status: 'Upcoming' | 'Live' | 'Closed';
}

interface Registrant {
  docId: string;
  full_name: string;
  user_email: string;
  registration_number: string;
  phone: string;
  branch: string;
  registered_at: any;
}

interface EventRegisterProps {
  onRedirect?: () => void;
  externalUser?: any;
  externalUserEmail?: string;
  externalIsPaymentAdmin?: boolean;
}

const DEFAULT_EVENTS: EventItem[] = [
  {
    id: 'XP EXCHANGE',
    title: 'GameDev, FreshersTalk, MortalCombat, StumbleGuys & More...',
    category: 'Freshers Welcome',
    date: 'August 20, 2026',
    location: 'GAMING LAB, LC-005',
    fee: 0,
    originalFee: 99,
    description: 'Join the ultimate VR & Gaming showdown at VIT Bhopal!',
    status: 'Live',
  },
];

export default function EventRegister({ externalUser, externalUserEmail, externalIsPaymentAdmin }: EventRegisterProps) {
  const { user, userEmail, isPaymentAdmin, handleLogin } = useAuth();

  const currentUser = externalUser || user;
  const currentEmail = (externalUserEmail || userEmail || currentUser?.email || '').toLowerCase();
  const canManageEvents = externalIsPaymentAdmin ?? isPaymentAdmin;

  const [events, setEvents] = useState<EventItem[]>(DEFAULT_EVENTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [registeringEvent, setRegisteringEvent] = useState<EventItem | null>(null);
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Seat counter state — maps event_id → count of registrations
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});

  // Admin registrant panel state
  const [adminPanelEventId, setAdminPanelEventId] = useState<string | null>(null);
  const [adminRegistrants, setAdminRegistrants] = useState<Record<string, Registrant[]>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [registrantSearch, setRegistrantSearch] = useState<string>('');

  // Form inputs for user registration
  const [fullName, setFullName] = useState<string>(currentUser?.displayName || '');
  const [regNo, setRegNo] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [branch, setBranch] = useState<string>('');

  // Admin Event Creation Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Esports Tournament');
  const [newDate, setNewDate] = useState<string>('');
  const [newLocation, setNewLocation] = useState<string>('');
  const [newFee, setNewFee] = useState<string>('0');
  const [newOriginalFee, setNewOriginalFee] = useState<string>('100');
  const [newDescription, setNewDescription] = useState<string>('');
  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);

  // Extract reg number from email if applicable
  useEffect(() => {
    if (currentEmail) {
      const match = currentEmail.match(/\b\d{2}[a-zA-Z]{3}\d{5}\b/);
      if (match) {
        setRegNo(match[0].toUpperCase());
      }
    }
  }, [currentEmail]);

  // Load events from Firestore
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsCol = collection(db, 'events');
        const snap = await getDocs(eventsCol);
        if (!snap.empty) {
          const list: EventItem[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              title: data.title || '',
              category: data.category || 'Event',
              date: data.date || '',
              location: data.location || '',
              fee: Number(data.fee) || 0,
              originalFee: data.originalFee !== undefined ? Number(data.originalFee) : undefined,
              description: data.description || '',
              status: data.status || 'Upcoming',
            });
          });
          setEvents(list);
        }
      } catch (err) {
        console.warn('Events fetch fallback to default:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Real-time listener: watch all event_registrations and derive counts + current user's registrations
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'event_registrations'), (snap) => {
      const counts: Record<string, number> = {};
      const userRegs: Record<string, boolean> = {};
      snap.forEach((d) => {
        const data = d.data();
        const eid = data.event_id as string;
        if (!eid) return;
        counts[eid] = (counts[eid] || 0) + 1;
        if (currentEmail && data.user_email === currentEmail) {
          userRegs[eid] = true;
        }
      });
      setRegistrationCounts(counts);
      if (currentEmail) setRegisteredEvents(userRegs);
    });
    return () => unsub();
  }, [currentEmail]);

  // Admin: real-time listener for registrants of an open admin panel
  useEffect(() => {
    if (!adminPanelEventId || !canManageEvents) return;
    const q = query(
      collection(db, 'event_registrations'),
      where('event_id', '==', adminPanelEventId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Registrant[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          docId: d.id,
          full_name: data.full_name || '',
          user_email: data.user_email || '',
          registration_number: data.registration_number || '',
          phone: data.phone || '',
          branch: data.branch || '',
          registered_at: data.registered_at,
        });
      });
      setAdminRegistrants((prev) => ({ ...prev, [adminPanelEventId]: list }));
    });
    return () => unsub();
  }, [adminPanelEventId, canManageEvents]);

  // Admin: Create new Event and broadcast to database
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageEvents) return;
    if (!newTitle || newFee === '' || Number(newFee) < 0) return;

    setCreatingEvent(true);
    try {
      const newEventObj = {
        title: newTitle,
        category: newCategory,
        date: newDate || new Date().toISOString().split('T')[0],
        location: newLocation || 'VIT Bhopal Campus',
        fee: Number(newFee),
        originalFee: newOriginalFee !== '' ? Number(newOriginalFee) : undefined,
        description: newDescription || 'Official VRGC Event',
        status: 'Upcoming',
        created_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'events'), newEventObj);
      const createdItem: EventItem = {
        id: docRef.id,
        ...newEventObj,
        status: 'Upcoming',
      };

      setEvents((prev) => [createdItem, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewFee('0');
      setNewOriginalFee('100');
      setNewDescription('');
      setNewLocation('');
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setCreatingEvent(false);
    }
  };

  // User: Submit Event Registration Form (with server-side seat limit enforced via count check)
  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringEvent || !currentEmail) return;

    // Enforce seat limit before writing
    const currentCount = registrationCounts[registeringEvent.id] || 0;
    if (currentCount >= SEAT_LIMIT) {
      alert('Sorry, this event is now full. Registration is closed.');
      setRegisteringEvent(null);
      return;
    }

    setIsSubmittingReg(true);
    try {
      // 1. Record registration in Firestore 'event_registrations' collection
      await addDoc(collection(db, 'event_registrations'), {
        event_id: registeringEvent.id,
        event_title: registeringEvent.title,
        user_email: currentEmail,
        full_name: fullName || currentUser?.displayName || 'Student',
        registration_number: regNo.toUpperCase(),
        phone: phone || '',
        branch: branch || '',
        registered_at: serverTimestamp(),
        payment_status: registeringEvent.fee > 0 ? 'Pending' : 'Free',
      });

      // 2. If event has a fee, assign payment invoice to user's dues portal
      if (registeringEvent.fee > 0) {
        await createPaymentInFirestore({
          user_email: currentEmail,
          candidate_name: fullName || currentUser?.displayName || 'Student',
          registration_number: regNo.toUpperCase(),
          team: branch || 'Event Guest',
          title: `Registration Fee: ${registeringEvent.title}`,
          description: `Official registration for ${registeringEvent.title}. Location: ${registeringEvent.location}`,
          category: 'Event Registration',
          amount: registeringEvent.fee,
          currency: 'INR',
          status: 'Pending',
          due_date: registeringEvent.date ? new Date(`${registeringEvent.date}T23:59:59+05:30`).toISOString() : new Date().toISOString(),
        });
      }

      setRegisterSuccess(`Successfully registered for ${registeringEvent.title}! ${registeringEvent.fee > 0 ? 'Check your Payments portal for the fee invoice.' : ''}`);
      setRegisteringEvent(null);
    } catch (err: any) {
      console.error('Registration failed:', err);
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Admin: Remove a registrant
  const handleRemoveRegistrant = async (docId: string) => {
    if (!canManageEvents) return;
    if (!confirm('Remove this registrant? This will free up a seat.')) return;
    setRemovingId(docId);
    try {
      await deleteDoc(doc(db, 'event_registrations', docId));
      // onSnapshot listeners auto-update counts + registrant list
    } catch (err) {
      console.error('Failed to remove registrant:', err);
    } finally {
      setRemovingId(null);
    }
  };

  // Admin: Delete event from Firestore & state
  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!canManageEvents) return;
    if (!confirm(`Are you sure you want to delete the event "${title}"? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-300">

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-[#170a2c] via-[#0d041a] to-[#120524] border border-purple-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.15)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <span className="material-symbols-outlined text-sm">how_to_reg</span>
            <span>VIT BHOPAL EVENT REGISTRATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Upcoming Events & Gaming Tournaments
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Welcome to the official VRGC Events Desk! Browse upcoming esports tournaments, VR workshops, and campus gaming showcases. Open to all registered VIT Bhopal students.
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {canManageEvents && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-extrabold shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Create Event (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {registerSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{registerSuccess}</span>
          </div>
          <button onClick={() => setRegisterSuccess(null)} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0e0518]/60 border border-purple-500/20 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-purple-400">event_busy</span>
          <h3 className="text-xl font-bold text-white">No Active Events Available</h3>
          <p className="text-xs text-slate-400">Check back soon for new VRGC tournament announcements!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((evt) => {
            const isRegistered = registeredEvents[evt.id];
            const count = registrationCounts[evt.id] || 0;
            const seatsLeft = Math.max(0, SEAT_LIMIT - count);
            const isFull = seatsLeft === 0;
            const fillPct = Math.min(100, (count / SEAT_LIMIT) * 100);

            return (
              <div
                key={evt.id}
                className="rounded-3xl bg-gradient-to-b from-[#0f0520] to-[#080211] border border-purple-500/20 hover:border-purple-500/40 p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-2xl transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Accent top line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-500" />

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {evt.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        {evt.originalFee && evt.originalFee > evt.fee && (
                          <span className="text-xs text-slate-400 font-mono line-through font-semibold">
                            ₹{evt.originalFee}
                          </span>
                        )}
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          {evt.fee === 0 ? 'FREE ENTRY' : `₹${evt.fee}`}
                        </span>
                        {evt.originalFee && evt.originalFee > evt.fee && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            OFFER
                          </span>
                        )}
                      </div>
                      {canManageEvents && (
                        <button
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          title="Delete Event"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-purple-300 transition-colors leading-snug">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-line">
                      {evt.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="material-symbols-outlined text-purple-400 text-base">calendar_month</span>
                      <span className="font-mono">{evt.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 truncate">
                      <span className="material-symbols-outlined text-purple-400 text-base">location_on</span>
                      <span className="truncate">{evt.location}</span>
                    </div>
                  </div>

                  {/* ── Seat Counter ── */}
                  <div className="space-y-2">
                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isFull
                          ? 'bg-rose-500'
                          : fillPct > 75
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-purple-500 to-fuchsia-500'
                          }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>

                    {/* Counter pill — user view */}
                    {!canManageEvents && (
                      isFull ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-400 text-[10px] font-extrabold uppercase tracking-wide">
                          <span className="material-symbols-outlined text-xs">block</span>
                          Registration Closed — Full
                        </div>
                      ) : (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide
                          ${seatsLeft <= 10
                            ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300 animate-pulse'
                            : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          }`}>
                          <span className="material-symbols-outlined text-xs">timer</span>
                          {seatsLeft} seats left — Hurry!
                        </div>
                      )
                    )}

                    {/* Admin view: count + manage registrants button */}
                    {canManageEvents && (
                      <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 flex-wrap">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide
                          ${isFull
                            ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                            : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          }`}>
                          <span className="material-symbols-outlined text-xs">groups</span>
                          {count}/{SEAT_LIMIT} Registered
                          {isFull && <span className="ml-1 text-rose-400">— Full</span>}
                        </div>
                        <button
                          onClick={() => setAdminPanelEventId(evt.id)}
                          className="w-full xs:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">manage_accounts</span>
                          Manage Registrants
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Status: {evt.status}
                  </span>

                  {isRegistered ? (
                    <button
                      disabled
                      className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-default"
                    >
                      <span className="material-symbols-outlined text-base">task_alt</span>
                      <span>Registered</span>
                    </button>
                  ) : isFull ? (
                    <button
                      disabled
                      className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">lock</span>
                      <span>Registration Full</span>
                    </button>
                  ) : currentEmail ? (
                    <button
                      onClick={() => setRegisteringEvent(evt)}
                      className="w-full sm:w-auto justify-center px-6 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 active:scale-95 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all flex items-center gap-2"
                    >
                      <span>Register Now</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleLogin}
                      className="w-full sm:w-auto justify-center px-5 py-3 sm:py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">login</span>
                      <span>Sign In to Register</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Student Event Registration Form */}
      {registeringEvent && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#0e0518] border border-purple-500/40 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-8 space-y-5 shadow-[0_0_60px_rgba(168,85,247,0.3)] relative animate-in slide-in-from-bottom sm:fade-in duration-300 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setRegisteringEvent(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">REGISTER FOR EVENT</span>
              <h3 className="text-xl font-extrabold text-white leading-snug">{registeringEvent.title}</h3>
              <p className="text-xs text-slate-400">
                Official registration for VIT Bhopal students.
              </p>
            </div>

            <form onSubmit={handleConfirmRegistration} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abhinav Mishra"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 25BCY10254"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">WhatsApp Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-white">
                  <span>Entry Fee</span>
                  <span className="text-amber-400 font-mono">
                    {registeringEvent.fee === 0 ? 'FREE' : `₹${registeringEvent.fee} INR`}
                  </span>
                </div>
                {registeringEvent.fee > 0 && (
                  <p className="text-[10px] text-slate-400 leading-normal">
                    * Submitting this form will automatically generate an invoice in your Payments portal.
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegisteringEvent(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-extrabold shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {isSubmittingReg ? 'Confirming...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Registrant Manager */}
      {adminPanelEventId && canManageEvents && (() => {
        const allRegistrants = adminRegistrants[adminPanelEventId] || [];
        const q = registrantSearch.trim().toLowerCase();
        const filtered = q
          ? allRegistrants.filter((r) =>
              r.full_name.toLowerCase().includes(q) ||
              r.user_email.toLowerCase().includes(q) ||
              r.registration_number.toLowerCase().includes(q) ||
              r.phone.includes(q)
            )
          : allRegistrants;
        return (
          <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-[#0e0518] border border-purple-500/40 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-8 space-y-4 shadow-[0_0_60px_rgba(168,85,247,0.3)] relative animate-in slide-in-from-bottom sm:fade-in duration-300 max-h-[90vh] sm:max-h-[85vh] flex flex-col">
              <button
                onClick={() => { setAdminPanelEventId(null); setRegistrantSearch(''); }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              <div className="space-y-1 shrink-0">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">ADMIN — EVENT REGISTRANTS</span>
                <h3 className="text-xl font-extrabold text-white leading-snug">
                  {events.find((e) => e.id === adminPanelEventId)?.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {allRegistrants.length}/{SEAT_LIMIT} seats filled. Removing a user frees up a seat.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
                <input
                  type="text"
                  placeholder="Search by name, reg no., email, or phone…"
                  value={registrantSearch}
                  onChange={(e) => setRegistrantSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                {registrantSearch && (
                  <button
                    onClick={() => setRegistrantSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              {/* Registrant List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {allRegistrants.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-xs">No registrations yet.</div>
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-xs">No results for &ldquo;{registrantSearch}&rdquo;</div>
                ) : (
                  filtered.map((r, idx) => (
                    <div
                      key={r.docId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[10px] font-mono text-slate-500 w-5 shrink-0">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{r.full_name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.user_email}</p>
                          <p className="text-[10px] font-mono text-purple-300">{r.registration_number}</p>
                          {r.phone && <p className="text-[10px] text-slate-500">{r.phone}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRegistrant(r.docId)}
                        disabled={removingId === r.docId}
                        title="Remove registrant"
                        className="self-end sm:self-auto shrink-0 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs">person_remove</span>
                        {removingId === r.docId ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Admin Create Event */}
      {showCreateModal && canManageEvents && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
          <form
            onSubmit={handleCreateEvent}
            className="bg-[#0e0518] border border-amber-500/40 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-8 space-y-4 shadow-[0_0_60px_rgba(245,158,11,0.3)] relative text-xs max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">ADMIN EVENT DESK</span>
              <h3 className="text-xl font-extrabold text-white">Create Event / Tournament</h3>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. BGMI Squad Showdown 2026"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Original Price (₹ List Price)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  value={newOriginalFee}
                  onChange={(e) => setNewOriginalFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Offer Price (₹ Charged) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0 (Free)"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Venue / Location</label>
              <input
                type="text"
                placeholder="e.g. Auditorium, VIT Bhopal"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Description</label>
              <textarea
                rows={3}
                placeholder="Details, prize pool, and guidelines..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingEvent}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all"
              >
                {creatingEvent ? 'Publishing...' : 'Publish Event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
