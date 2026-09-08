import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';

export interface SessionRecord {
  id: string;
  visitorId: string;
  userEmail: string | null;
  userName: string;
  userPhoto: string | null;
  userRole: string;
  isLoggedIn: boolean;
  enteredAt: string; // ISO string
  leftAt: string | null; // ISO string or null if currently online
  status: 'online' | 'offline';
  device: string; // e.g. "Windows • Chrome"
  deviceType: 'desktop' | 'mobile' | 'tablet';
  currentPath?: string;
  userAgent?: string;
}

const SESSION_STORAGE_KEY = 'vrgc_session_id';
const SESSION_START_KEY = 'vrgc_session_start';
const SESSION_SYNCED_KEY = 'vrgc_session_synced';
const VISITOR_ID_KEY = 'vrgc_visitor_id';

// ─── Device Detection Helper ──────────────────────────────────────────────────

export function parseUserDevice(): { device: string; deviceType: 'desktop' | 'mobile' | 'tablet' } {
  if (typeof window === 'undefined') {
    return { device: 'Unknown Server', deviceType: 'desktop' };
  }

  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/win/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/iphone|ipod/i.test(ua)) os = 'iPhone';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  const isMobile = /mobile|android|iphone|ipod/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua);
  const deviceType: 'desktop' | 'mobile' | 'tablet' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  return {
    device: `${os} • ${browser}`,
    deviceType,
  };
}

// ─── Persistent Visitor ID Helper ─────────────────────────────────────────────

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return `v_${Date.now()}`;
  }
}

// ─── Session Initialization (User Entered) ────────────────────────────────────
// Ensures exactly 1 write to Firestore per browser session

export async function initOrResumeSession(
  userInfo?: {
    email?: string | null;
    name?: string | null;
    photo?: string | null;
    role?: string | null;
  }
): Promise<string> {
  if (typeof window === 'undefined') return '';

  try {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    let enteredAt = sessionStorage.getItem(SESSION_START_KEY);
    const isSynced = sessionStorage.getItem(SESSION_SYNCED_KEY);

    const isLoggedIn = !!(userInfo && userInfo.email);
    const userEmail = userInfo?.email ? userInfo.email.toLowerCase().trim() : null;
    const userName = userInfo?.name || (isLoggedIn ? 'Member' : 'Guest Visitor');
    const userPhoto = userInfo?.photo || null;
    const userRole = userInfo?.role || (isLoggedIn ? 'Member' : 'Guest');

    // If session is already recorded and synced in this browser tab, skip Firestore write (Zero Quota Waste!)
    if (sessionId && enteredAt && isSynced === 'synced') {
      return sessionId;
    }

    const nowIso = new Date().toISOString();
    const visitorId = getOrCreateVisitorId();
    const { device, deviceType } = parseUserDevice();

    if (!sessionId || !enteredAt) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      enteredAt = nowIso;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      sessionStorage.setItem(SESSION_START_KEY, enteredAt);
    }

    const sessionData: SessionRecord = {
      id: sessionId,
      visitorId,
      userEmail,
      userName,
      userPhoto,
      userRole,
      isLoggedIn,
      enteredAt,
      leftAt: null,
      status: 'online',
      device,
      deviceType,
      userAgent: navigator.userAgent.substring(0, 150),
    };

    // Single write to Firestore
    await setDoc(doc(db, 'audit_sessions', sessionId), sessionData, { merge: true });
    sessionStorage.setItem(SESSION_SYNCED_KEY, 'synced');

    return sessionId;
  } catch (err) {
    console.warn('[SessionTracker] Init session warning:', err);
    return '';
  }
}

// ─── Session Finalization (User Offline / Tab Closed) ──────────────────────────
// Ensures exactly 1 write on browser unload

let hasFinalizedThisTab = false;

export async function finalizeSession(): Promise<void> {
  if (typeof window === 'undefined' || hasFinalizedThisTab) return;

  try {
    const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) return;

    hasFinalizedThisTab = true;
    const nowIso = new Date().toISOString();

    const payload: Partial<SessionRecord> = {
      leftAt: nowIso,
      status: 'offline',
    };

    await setDoc(doc(db, 'audit_sessions', sessionId), payload, { merge: true });
    sessionStorage.removeItem(SESSION_SYNCED_KEY);
  } catch (err) {
    console.warn('[SessionTracker] Finalize session error:', err);
  }
}

// ─── Format Duration Helper ───────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}
