"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { CONFIG } from '@/lib/config';

import { checkIsFaculty, ensureDefaultTestFaculty } from '@/lib/faculty';

// Designated payment admin emails loaded from CONFIG
export const PAYMENT_ADMIN_EMAILS = CONFIG.PAYMENT_ADMIN_EMAILS;
export const PAYMENT_ADMIN_EMAIL = PAYMENT_ADMIN_EMAILS[0] || '';
export const ADMIN_EMAIL = PAYMENT_ADMIN_EMAILS[0] || '';

const googleProvider = new GoogleAuthProvider();

export interface MemberData {
  name: string;
  registrationNumber: string;
  phone: string;
  email: string;
  team: string;
  position: string;
}

interface AuthContextType {
  user: User | null;
  userEmail: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPaymentAdmin: boolean;
  isFaculty: boolean;
  isAuthorized: boolean;
  memberData: MemberData | null;
  authLoading: boolean;
  authError: string;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userEmail: '',
  isSuperAdmin: false,
  isAdmin: false,
  isPaymentAdmin: false,
  isFaculty: false,
  isAuthorized: false,
  memberData: null,
  authLoading: true,
  authError: '',
  handleLogin: async () => {},
  handleLogout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaymentAdmin, setIsPaymentAdmin] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Resolve user against Firestore Database
  const resolveUser = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser || !firebaseUser.email) {
      setUser(null);
      setUserEmail('');
      setIsSuperAdmin(false);
      setIsAdmin(false);
      setIsPaymentAdmin(false);
      setIsFaculty(false);
      setIsAuthorized(false);
      setMemberData(null);
      setAuthError('');
      setAuthLoading(false);
      return;
    }

    const em = firebaseUser.email.toLowerCase();
    setUser(firebaseUser);
    setUserEmail(em);

    try {
      // Ensure test faculty exists in Firestore in background
      ensureDefaultTestFaculty().catch(() => {});

      // 1. Check Faculty status (Firestore 'faculty' collection or test faculty)
      const facultyRecord = await checkIsFaculty(em);
      if (facultyRecord) {
        setIsFaculty(true);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsPaymentAdmin(false);
        setIsAuthorized(true);
        setMemberData({
          name: facultyRecord.name || firebaseUser.displayName || 'Faculty Member',
          registrationNumber: facultyRecord.facultyId || 'FACULTY',
          phone: facultyRecord.phone || '',
          email: em,
          team: facultyRecord.department ? `Faculty (${facultyRecord.department})` : 'Faculty Advisory',
          position: facultyRecord.designation || 'Faculty Mentor',
        });
        setAuthError('');
        setAuthLoading(false);
        return;
      }

      setIsFaculty(false);

      // 2. Check Super Admin status (env variable or Firestore 'super_admins' collection or admins with role 'super_admin')
      const configSuperAdmins = (CONFIG.SUPER_ADMIN_EMAILS || []).map((e) => e.toLowerCase());
      let isDbSuperAdmin = false;
      try {
        const superDoc = await getDoc(doc(db, 'super_admins', em));
        if (superDoc.exists()) {
          isDbSuperAdmin = true;
        }
      } catch (superErr) {
        console.warn('Firestore super_admins check fallback:', superErr);
      }
      const superAdmin = isDbSuperAdmin || configSuperAdmins.includes(em);
      setIsSuperAdmin(superAdmin);

      // 3. Check Admin status (Firestore 'admins' collection OR Config env / payment admin OR super admin)
      const configAdmins = CONFIG.ADMIN_EMAILS.map((e) => e.toLowerCase());
      let isDbAdmin = false;

      try {
        // Direct doc check (doc id = email)
        const adminDoc = await getDoc(doc(db, 'admins', em));
        if (adminDoc.exists()) {
          isDbAdmin = true;
          const adminDocData = adminDoc.data();
          if (adminDocData?.role === 'super_admin' || adminDocData?.isSuperAdmin) {
            setIsSuperAdmin(true);
          }
        } else {
          // Query check by 'email' field
          const adminQuery = query(collection(db, 'admins'), where('email', '==', em));
          const adminSnap = await getDocs(adminQuery);
          if (!adminSnap.empty) {
            isDbAdmin = true;
            const firstData = adminSnap.docs[0].data();
            if (firstData?.role === 'super_admin' || firstData?.isSuperAdmin) {
              setIsSuperAdmin(true);
            }
          }
        }
      } catch (adminErr) {
        console.warn('Firestore admin check fallback:', adminErr);
      }

      const isPaymentAdminEmail = PAYMENT_ADMIN_EMAILS.includes(em);
      const admin = superAdmin || isDbAdmin || isPaymentAdminEmail || em === PAYMENT_ADMIN_EMAIL || configAdmins.includes(em);
      const paymentAdmin = superAdmin || isPaymentAdminEmail;
      setIsAdmin(admin);
      setIsPaymentAdmin(paymentAdmin);

      // 3. Query Firestore 'members' collection by email
      let memberRecord: MemberData | null = null;
      try {
        const memberQuery = query(collection(db, 'members'), where('email', '==', em));
        const memberSnap = await getDocs(memberQuery);
        if (!memberSnap.empty) {
          const userEntries = memberSnap.docs.map((d) => d.data() as MemberData);
          const teams = [...new Set(userEntries.map((m) => m.team).filter(Boolean))].join(', ');
          const positions = [...new Set(userEntries.map((m) => m.position).filter(Boolean))].join(', ');
          memberRecord = {
            name: userEntries[0].name || firebaseUser.displayName || 'Member',
            registrationNumber: userEntries[0].registrationNumber || '',
            phone: userEntries[0].phone || '',
            email: em,
            team: teams || 'Member',
            position: positions || 'Member',
          };
        }
      } catch (memberErr) {
        console.warn('Firestore member check warning:', memberErr);
      }

      // If not in members collection, also check id_cards collection
      if (!memberRecord) {
        try {
          const idDoc = await getDoc(doc(db, 'id_cards', em));
          if (idDoc.exists()) {
            const d = idDoc.data();
            memberRecord = {
              name: d.name || firebaseUser.displayName || 'Member',
              registrationNumber: d.regNo || d.registrationNumber || '',
              phone: d.phone || '',
              email: em,
              team: d.team || 'General',
              position: d.position || d.role || (admin ? 'Lead' : 'Member'),
            };
          } else {
            const idQuery = query(collection(db, 'id_cards'), where('email', '==', em));
            const idSnap = await getDocs(idQuery);
            if (!idSnap.empty) {
              const d = idSnap.docs[0].data();
              memberRecord = {
                name: d.name || firebaseUser.displayName || 'Member',
                registrationNumber: d.regNo || d.registrationNumber || '',
                phone: d.phone || '',
                email: em,
                team: d.team || 'General',
                position: d.position || d.role || (admin ? 'Lead' : 'Member'),
              };
            }
          }
        } catch (idErr) {
          console.warn('Firestore id_cards check warning:', idErr);
        }
      }

      if (memberRecord) {
        setMemberData(memberRecord);
        setIsAuthorized(true);
        setAuthError('');
      } else if (admin) {
        setMemberData({
          name: firebaseUser.displayName || (superAdmin ? 'Super Administrator' : 'Administrator'),
          registrationNumber: superAdmin ? 'SUPER-ADMIN' : 'ADMIN',
          phone: '',
          email: em,
          team: 'Management',
          position: superAdmin ? 'Super Administrator' : 'Lead',
        });
        setIsAuthorized(true);
        setAuthError('');
      } else {
        setIsAuthorized(false);
        setMemberData(null);
        setAuthError('Access Denied: Only verified club members, admins, and faculty are authorized to access the VRGC Forms Portal.');
        signOut(auth).catch(console.error);
      }
    } catch (err: any) {
      console.error('AuthProvider resolution error:', err);
      setAuthError('Authentication error occurred. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthLoading(true);
      resolveUser(firebaseUser);
    });

    return () => unsubscribe();
  }, [resolveUser]);

  const handleLogin = useCallback(async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthError('Unauthorized domain. Add this domain to Firebase Console → Authentication → Authorized Domains.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed. Please try again.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setAuthError('Login request already pending or cancelled. Please try again.');
      } else {
        setAuthError(err?.message || 'Failed to sign in.');
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Signout error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userEmail,
        isSuperAdmin,
        isAdmin,
        isPaymentAdmin,
        isFaculty,
        isAuthorized,
        memberData,
        authLoading,
        authError,
        handleLogin,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
