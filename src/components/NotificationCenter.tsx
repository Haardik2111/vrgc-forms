"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';

export type IdeaNotifType =
  | 'faculty_review'
  | 'promoted'
  | 'approved'
  | 'rejected'
  | 'vote_milestone'
  | 'new_comment'
  | 'restored';

export interface AppNotification {
  id: string;
  type: IdeaNotifType | string;
  recipientEmail: string;
  actorName?: string;
  actorEmail?: string;
  ideaId?: string;
  ideaTitle?: string;
  message: string;
  read: boolean;
  createdAt: any;
  coordinatorNote?: string;
  channelName?: string;
  channelPath?: string;
}

export const getNotificationIcon = (type?: string, channelName?: string): string => {
  const t = (type || '').toLowerCase();
  const c = (channelName || '').toLowerCase();
  
  if (t === 'alert' || c.includes('alert')) return 'warning';
  if (t === 'announcement' || c.includes('announcement') || c.includes('broadcast')) return 'campaign';
  if (t === 'event' || c.includes('event')) return 'calendar_month';
  if (t === 'update' || c.includes('update')) return 'verified';
  if (t === 'milestone' || t === 'vote_milestone') return 'emoji_events';
  if (t === 'faculty_review' || c.includes('faculty')) return 'school';
  if (t === 'promoted' || t === 'promoted_broadcast' || c.includes('idea') || c.includes('curator')) return 'lightbulb';
  if (t === 'new_comment') return 'comment';
  if (t === 'approved') return 'check_circle';
  if (t === 'rejected') return 'cancel';
  if (t === 'restored') return 'restore';
  if (c.includes('lead') || t.includes('lead')) return 'military_tech';
  return 'notifications';
};

export const getNotificationIconStyle = (type?: string, channelName?: string): string => {
  const t = (type || '').toLowerCase();
  const c = (channelName || '').toLowerCase();
  
  if (t === 'alert' || c.includes('alert')) return 'bg-rose-950/60 border-rose-500/40 text-rose-300';
  if (t === 'announcement' || c.includes('announcement') || c.includes('broadcast')) return 'bg-purple-900/60 border-purple-500/40 text-purple-300';
  if (t === 'event' || c.includes('event')) return 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300';
  if (t === 'update' || c.includes('update')) return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
  if (t === 'milestone' || t === 'vote_milestone') return 'bg-amber-950/60 border-amber-500/40 text-amber-300';
  if (t === 'faculty_review' || c.includes('faculty')) return 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300';
  if (t === 'promoted' || c.includes('idea')) return 'bg-amber-950/40 border-amber-500/40 text-amber-300';
  return 'bg-purple-900/50 border-purple-500/40 text-purple-300';
};

const timeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// Gaming Vibe Beep Sound (Web Audio API - No external assets needed)
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Smooth, non-irritating synth pop
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05); // Soft volume
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio play failed', e);
  }
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const getTimestampMillis = (timestamp: any): number => {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (typeof timestamp === 'number') return timestamp;
  const parsed = new Date(timestamp).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
};

interface NotificationCenterProps {
  userEmail: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isFaculty: boolean;
  onNavigate: (path: string) => void;
}

export default function NotificationCenter({ userEmail, isAdmin, isSuperAdmin, isFaculty, onNavigate }: NotificationCenterProps) {
  const { memberData, userRole } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toastNotif, setToastNotif] = useState<AppNotification | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevNotifsRef = useRef<AppNotification[]>([]);

  useEffect(() => {
    if (!userEmail) return;

    // Build recipient keys for targeted and broadcast notifications
    const recipientKeys = [userEmail.toLowerCase(), userEmail, '*'];
    recipientKeys.push('ROLE:member');
    if (isAdmin || isSuperAdmin) recipientKeys.push('ROLE:admin');
    if (isSuperAdmin) recipientKeys.push('ROLE:superadmin');
    if (isFaculty) recipientKeys.push('ROLE:faculty');

    // Role-specific broadcasts (e.g., Casters, Technical, custom roles)
    if (userRole) {
      recipientKeys.push(`ROLE:${userRole.toLowerCase().trim()}`);
      recipientKeys.push(`ROLE:${userRole.trim()}`);
    }

    // Domain / Team specific broadcasts (e.g., DOMAIN:Technical, DOMAIN:Design)
    if (memberData?.team) {
      const teams = memberData.team.split(/[,/&]+/).map((t) => t.trim()).filter(Boolean);
      teams.forEach((t) => {
        recipientKeys.push(`DOMAIN:${t.toLowerCase()}`);
        recipientKeys.push(`DOMAIN:${t}`);
        recipientKeys.push(`TEAM:${t.toLowerCase()}`);
        recipientKeys.push(`TEAM:${t}`);
      });
    }

    // Position / Leadership specific broadcasts (e.g., POSITION:Lead, POSITION:Co-Lead, ROLE:leads)
    if (memberData?.position) {
      recipientKeys.push(`POSITION:${memberData.position.trim()}`);
      recipientKeys.push(`POSITION:${memberData.position.toLowerCase().trim()}`);
      const posLower = memberData.position.toLowerCase();
      if (
        posLower.includes('lead') ||
        posLower.includes('co-lead') ||
        posLower.includes('head') ||
        posLower.includes('president') ||
        posLower.includes('coordinator')
      ) {
        recipientKeys.push('ROLE:leads');
        recipientKeys.push('ROLE:leadership');
        recipientKeys.push('POSITION:lead');
        recipientKeys.push('POSITION:leads');
        recipientKeys.push('POSITION:co-lead');
      }
    }

    // Deduplicate and cap at 30 (Firestore 'in' limit is 30)
    const finalKeys = Array.from(new Set(recipientKeys)).slice(0, 30);

    const q = query(
      collection(db, 'idea_notifications'),
      where('recipientEmail', 'in', finalKeys)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();

      // 1. Delete notifications from Firestore DB that are older than 14 days
      const expiredDocs = snap.docs.filter((d) => {
        const data = d.data();
        const millis = getTimestampMillis(data.createdAt);
        return now - millis > FOURTEEN_DAYS_MS;
      });

      if (expiredDocs.length > 0) {
        for (let i = 0; i < expiredDocs.length; i += 400) {
          const chunk = expiredDocs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((d) => {
            batch.delete(doc(db, 'idea_notifications', d.id));
          });
          batch.commit().catch((err) => {
            console.warn('Failed to prune expired notifications (>14d):', err);
          });
        }
      }

      // 2. Filter notifications older than 7 days from Notification Hub UI
      const validDocs = snap.docs.filter((d) => {
        const data = d.data();
        const millis = getTimestampMillis(data.createdAt);
        return now - millis <= SEVEN_DAYS_MS;
      });

      const list: AppNotification[] = validDocs.map((d) => {
        const data = d.data();
        let channelPath = data.channelPath;
        if (!channelPath) {
          if (data.channelName === 'Idea Curator Hub') channelPath = 'ideahub';
          else if (data.channelName === 'Planned Events') channelPath = 'planned_events';
          else if (data.channelName === 'Members') channelPath = 'members';
          else channelPath = 'dashboard';
        }
        // Fix legacy notifications mapped to planned_events
        if (data.channelName === 'Idea Curator Hub' && !data.isBroadcast && channelPath === 'planned_events') {
          channelPath = 'ideahub';
        }

        return {
          id: d.id,
          type: data.type || 'promoted',
          recipientEmail: data.recipientEmail || '',
          actorName: data.actorName || '',
          actorEmail: data.actorEmail || '',
          ideaId: data.ideaId || '',
          ideaTitle: data.ideaTitle || '',
          message: data.message || '',
          read: !!data.read,
          createdAt: data.createdAt,
          coordinatorNote: data.coordinatorNote || '',
          channelName: data.channelName || (data.ideaTitle ? 'Idea Curator Hub' : 'Notification Hub'),
          channelPath,
        };
      });
      
      // Memory sort descending
      list.sort((a, b) => {
        const tA = getTimestampMillis(a.createdAt);
        const tB = getTimestampMillis(b.createdAt);
        return tB - tA;
      });

      // Check for strictly NEW unread notifications to show toast
      const newNotifs = list.filter(n => !n.read);
      const oldUnreadCount = prevNotifsRef.current.filter(n => !n.read).length;
      
      if (newNotifs.length > oldUnreadCount && newNotifs.length > 0) {
        // Just got a new notification
        const latest = newNotifs[0];
        setToastNotif(latest);
        playNotificationSound();
        
        // Remove toast after 3 seconds
        setTimeout(() => {
          setToastNotif((current) => (current?.id === latest.id ? null : current));
        }, 3000);
      }
      
      prevNotifsRef.current = list;
      setNotifications(list);
    });
    return () => unsub();
  }, [userEmail, isAdmin, isSuperAdmin, isFaculty, userRole, memberData?.team, memberData?.position]);

  // Click outside to close panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelOpen &&
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  const markNotifRead = useCallback(async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'idea_notifications', notifId), { read: true });
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'idea_notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch {}
  }, [notifications]);

  const handleChannelClick = (channelPath?: string) => {
    setPanelOpen(false);
    if (!channelPath) {
      onNavigate('dashboard');
      return;
    }
    const trimmed = channelPath.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      window.open(trimmed, '_blank', 'noopener,noreferrer');
      return;
    }
    const clean = trimmed.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (clean === '' || clean === 'home') {
      onNavigate('dashboard');
    } else if (clean === 'events' || clean === 'planned-events') {
      onNavigate('planned_events');
    } else if (clean === 'ideas' || clean === 'idea-hub') {
      onNavigate('ideahub');
    } else {
      onNavigate(clean);
    }
  };

  const handleNotifClick = (notif: AppNotification) => {
    markNotifRead(notif.id);
    const target = notif.channelPath || (notif.channelName === 'Idea Curator Hub' ? 'ideahub' : 'dashboard');
    handleChannelClick(target);
  };

  if (!userEmail) return null;

  // Group by channel
  const channels = Array.from(new Set(notifications.map(n => n.channelName || 'System')));
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* ─── FLOATING BELL BUTTON (Left Sidebar-ish location) ─── */}
      <div className="fixed bottom-16 md:bottom-16 left-5 md:left-8 z-[9900]">
        <button
          ref={buttonRef}
          onClick={() => setPanelOpen(!panelOpen)}
          title="Notification Hub"
          className={`relative p-2.5 sm:p-3.5 rounded-full transition-all duration-200 cursor-pointer border flex items-center justify-center hover:scale-105 active:scale-95 ${
            panelOpen
              ? 'bg-purple-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)] border-purple-300'
              : 'bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] border-purple-400'
          }`}
        >
          <span className="material-symbols-outlined text-lg sm:text-xl group-hover:rotate-12 transition-transform duration-300">
            {unreadCount > 0 ? 'notifications_active' : 'notifications'}
          </span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-600 border border-white/20 text-white text-[9px] sm:text-[10px] font-black flex items-center justify-center shadow-[0_0_12px_rgba(225,29,72,0.8)] animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ─── 3-SECOND POP-UP TOAST ─── */}
      <AnimatePresence>
        {toastNotif && !panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.2 } }}
            onClick={() => handleNotifClick(toastNotif)}
            className="fixed bottom-32 left-5 md:left-8 z-[9950] max-w-[320px] w-[calc(100vw-3rem)] cursor-pointer bg-gradient-to-br from-[#1c0d2e] to-[#0a0514] border border-purple-500/60 p-4 rounded-2xl shadow-[0_10px_40px_rgba(168,85,247,0.4)]"
          >
            <div className="flex gap-3 items-start">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${getNotificationIconStyle(toastNotif.type, toastNotif.channelName)}`}>
                <span className="material-symbols-outlined text-lg">
                  {getNotificationIcon(toastNotif.type, toastNotif.channelName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider mb-1 flex justify-between items-center">
                  <span>{toastNotif.channelName || 'New Alert'}</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                </h4>
                <p className="text-sm text-slate-200 line-clamp-2 leading-tight">
                  {toastNotif.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SLIDE-IN PANEL ─── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            className="fixed bottom-32 left-5 md:left-8 z-[9900] w-[380px] max-w-[calc(100vw-3rem)] max-h-[70vh] flex flex-col bg-[#0b0b12]/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(147,51,234,0.15)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-[#140b24]/90 border-b border-purple-900/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-purple-400">rss_feed</span>
                <h3 className="text-lg font-black text-white tracking-wide uppercase">Notification Hub</h3>
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-purple-400 hover:text-purple-200 font-bold uppercase tracking-widest transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setPanelOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Channels & Notifications */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-[#1c122e] flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-3xl text-purple-500/50">notifications_off</span>
                  </div>
                  <p className="text-sm font-bold text-slate-300">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">No pending updates right now.</p>
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {channels.map(channel => {
                    const channelNotifs = notifications.filter(n => (n.channelName || 'System') === channel);
                    const channelUnreadCount = channelNotifs.filter(n => !n.read).length;
                    
                    return (
                      <div key={channel} className="bg-[#121212] rounded-2xl border border-white/5 overflow-hidden">
                        {/* Channel Header (Clickable) */}
                        <div 
                          onClick={() => {
                            const firstWithPath = channelNotifs.find(n => n.channelPath)?.channelPath;
                            const fallbackPath = channel === 'Idea Curator Hub' ? 'ideahub' : 'dashboard';
                            handleChannelClick(firstWithPath || fallbackPath);
                          }}
                          className="px-4 py-3 bg-[#181818] border-b border-white/5 flex justify-between items-center cursor-pointer hover:bg-[#202020] transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-purple-400 group-hover:scale-110 transition-transform">
                              {channel === 'Idea Curator Hub'
                                ? 'lightbulb'
                                : channel.toLowerCase().includes('broadcast') || channel.toLowerCase().includes('announcement')
                                  ? 'campaign'
                                  : channel.toLowerCase().includes('alert')
                                    ? 'warning'
                                    : channel.toLowerCase().includes('lead')
                                      ? 'shield_person'
                                      : channel.toLowerCase().includes('faculty')
                                        ? 'school'
                                        : 'tag'}
                            </span>
                            <span className="text-sm font-bold text-slate-200">{channel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">{channelNotifs.length} total</span>
                            {channelUnreadCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black shadow-[0_0_10px_rgba(225,29,72,0.5)] animate-pulse">
                                {channelUnreadCount} NEW
                              </span>
                            )}
                            <span className="material-symbols-outlined text-[16px] text-slate-600 group-hover:text-purple-400 transition-colors">arrow_forward</span>
                          </div>
                        </div>

                        {/* Channel Notifications List */}
                        <div className="divide-y divide-white/5">
                          {channelNotifs.slice(0, 5).map(notif => {
                            return (
                            <button
                              key={notif.id}
                              onClick={() => handleNotifClick(notif)}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/[0.04] group/item ${
                                !notif.read ? 'bg-purple-900/15' : ''
                              }`}
                            >
                              {/* Actual Notification Icon */}
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 shadow-sm transition-transform group-hover/item:scale-105 ${getNotificationIconStyle(notif.type, notif.channelName)}`}>
                                <span className="material-symbols-outlined text-[16px]">
                                  {getNotificationIcon(notif.type, notif.channelName)}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] leading-snug ${notif.read ? 'text-slate-400' : 'text-slate-200 font-medium'}`}>
                                  {notif.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] text-slate-500 font-mono">{timeAgo(notif.createdAt)}</span>
                                  {notif.channelPath && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-purple-300 font-mono">
                                      → {notif.channelPath}
                                    </span>
                                  )}
                                  {notif.actorName && (
                                    <span className="text-[10px] text-slate-500 italic truncate max-w-[120px]">
                                      by {notif.actorName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!notif.read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0 animate-pulse" />
                              )}
                            </button>
                            );
                          })}
                          {channelNotifs.length > 5 && (
                            <div className="px-4 py-2 text-center bg-[#151515]">
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">+ {channelNotifs.length - 5} older</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
