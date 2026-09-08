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
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
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
  userRole: string | null;
  isFaculty: boolean;
  isAuthorized: boolean;
  memberData: MemberData | null;
  authLoading: boolean;
  authError: string;
  refreshUser: () => Promise<void>;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userEmail: '',
  isSuperAdmin: false,
  isAdmin: false,
  isPaymentAdmin: false,
  userRole: null,
  isFaculty: false,
  isAuthorized: false,
  memberData: null,
  authLoading: true,
  authError: '',
  refreshUser: async () => {},
  handleLogin: async () => {},
  handleLogout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaymentAdmin, setIsPaymentAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
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
      setUserRole(null);
      setIsFaculty(false);
      setIsAuthorized(false);
      setMemberData(null);
      setAuthError('');
      setAuthLoading(false);
      return;
    }

    const em = firebaseUser.email.toLowerCase().trim();
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
        setUserRole(null);
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
      const configSuperAdmins = (CONFIG.SUPER_ADMIN_EMAILS || []).map((e) => e.toLowerCase().trim());
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

      // 3. Check Admin & Role status (Firestore 'admins' and 'roles' collections)
      const configAdmins = CONFIG.ADMIN_EMAILS.map((e) => e.toLowerCase().trim());
      let isDbAdmin = false;
      let assignedRole: string | null = null;

      try {
        // Direct doc check in admins collection (doc ID = email)
        const adminDoc = await getDoc(doc(db, 'admins', em));
        if (adminDoc.exists()) {
          isDbAdmin = true;
          const adminDocData = adminDoc.data();
          if (adminDocData?.role === 'super_admin' || adminDocData?.isSuperAdmin) {
            setIsSuperAdmin(true);
            assignedRole = 'Super Admin';
          } else if (adminDocData?.role) {
            assignedRole = adminDocData.role;
          } else {
            assignedRole = 'Admin';
          }
        } else {
          // Check query in case document was created with an auto-id or different casing
          const adminQuery = query(collection(db, 'admins'), where('email', '==', em));
          const adminSnap = await getDocs(adminQuery);
          if (!adminSnap.empty) {
            isDbAdmin = true;
            const adminDocData = adminSnap.docs[0].data();
            if (adminDocData?.role === 'super_admin' || adminDocData?.isSuperAdmin) {
              setIsSuperAdmin(true);
              assignedRole = 'Super Admin';
            } else if (adminDocData?.role) {
              assignedRole = adminDocData.role;
            } else {
              assignedRole = 'Admin';
            }
          }
        }

        // Direct doc check in roles table (doc ID = email)
        const roleDoc = await getDoc(doc(db, 'roles', em));
        if (roleDoc.exists()) {
          const roleData = roleDoc.data();
          isDbAdmin = true;
          if (roleData?.role) {
            if (roleData.role === 'super_admin' || roleData.role === 'Super Admin') {
              setIsSuperAdmin(true);
              assignedRole = 'Super Admin';
            } else if (!assignedRole || assignedRole === 'Admin') {
              assignedRole = roleData.role;
            }
          }
        } else {
          // Check query in roles in case doc ID is different
          const roleQuery = query(collection(db, 'roles'), where('email', '==', em));
          const roleSnap = await getDocs(roleQuery);
          if (!roleSnap.empty) {
            isDbAdmin = true;
            const roleData = roleSnap.docs[0].data();
            if (roleData?.role) {
              if (roleData.role === 'super_admin' || roleData.role === 'Super Admin') {
                setIsSuperAdmin(true);
                assignedRole = 'Super Admin';
              } else if (!assignedRole || assignedRole === 'Admin') {
                assignedRole = roleData.role;
              }
            }
          }
        }
      } catch (adminErr) {
        console.warn('Firestore admin/role check fallback:', adminErr);
      }

      // 4. Query Firestore 'members' collection by email
      let memberRecord: MemberData | null = null;
      try {
        const memberQuery = query(collection(db, 'members'), where('email', '==', em));
        const memberSnap = await getDocs(memberQuery);
        if (!memberSnap.empty) {
          const userEntries = memberSnap.docs.map((d) => d.data() as MemberData);
          const teams = [...new Set(userEntries.map((m) => m.team).filter(Boolean))].join(', ');
          const positions = [...new Set(userEntries.map((m) => m.position).filter(Boolean))].join(', ');
          const first = userEntries[0];
          memberRecord = {
            name: first.name || firebaseUser.displayName || 'Member',
            registrationNumber: first.registrationNumber || '',
            phone: first.phone || '',
            email: em,
            team: teams || first.team || 'General Crew',
            position: positions || first.position || 'Member',
          };
          // If role was explicitly assigned on member doc
          if (!assignedRole && (first as any).role) {
            assignedRole = (first as any).role;
          }
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
              position: d.position || d.role || (assignedRole || 'Member'),
            };
            if (!assignedRole && d.role) {
              assignedRole = d.role;
            }
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
                position: d.position || d.role || (assignedRole || 'Member'),
              };
              if (!assignedRole && d.role) {
                assignedRole = d.role;
              }
            }
          }
        } catch (idErr) {
          console.warn('Firestore id_cards check warning:', idErr);
        }
      }

      const isPaymentAdminEmail = PAYMENT_ADMIN_EMAILS.includes(em) || assignedRole === 'Payment Admin';
      const admin = superAdmin || isDbAdmin || isPaymentAdminEmail || em === PAYMENT_ADMIN_EMAIL || configAdmins.includes(em) || !!assignedRole;
      const paymentAdmin = superAdmin || isPaymentAdminEmail;

      if (superAdmin) {
        assignedRole = 'Super Admin';
      } else if (!assignedRole && admin) {
        assignedRole = 'Admin';
      }

      setUserRole(assignedRole);
      setIsAdmin(admin);
      setIsPaymentAdmin(paymentAdmin);

      if (memberRecord) {
        setMemberData({
          ...memberRecord,
          position: assignedRole || memberRecord.position || (superAdmin ? 'Super Administrator' : admin ? 'Administrator' : 'Club Member'),
        });
        setIsAuthorized(true);
        setAuthError('');
      } else if (admin) {
        setMemberData({
          name: firebaseUser.displayName || (superAdmin ? 'Super Administrator' : (assignedRole || 'Administrator')),
          registrationNumber: superAdmin ? 'SUPER-ADMIN' : (assignedRole ? assignedRole.toUpperCase() : 'ADMIN'),
          phone: '',
          email: em,
          team: assignedRole ? `${assignedRole} Division` : 'Management',
          position: superAdmin ? 'Super Administrator' : (assignedRole || 'Lead'),
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
    let unsubs: (() => void)[] = [];

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous real-time role listeners
      unsubs.forEach((u) => u());
      unsubs = [];

      setAuthLoading(true);
      resolveUser(firebaseUser);

      // Set up real-time live listeners on admins and roles so Super Admin updates take effect live!
      if (firebaseUser && firebaseUser.email) {
        const em = firebaseUser.email.toLowerCase().trim();
        try {
          const unsubAdmin = onSnapshot(doc(db, 'admins', em), () => {
            resolveUser(firebaseUser);
          });
          unsubs.push(unsubAdmin);
        } catch (adminListenErr) {
          console.warn('Real-time admin listener fallback:', adminListenErr);
        }

        try {
          const unsubRole = onSnapshot(doc(db, 'roles', em), () => {
            resolveUser(firebaseUser);
          });
          unsubs.push(unsubRole);
        } catch (roleListenErr) {
          console.warn('Real-time role listener fallback:', roleListenErr);
        }
      }
    });

    return () => {
      unsubscribe();
      unsubs.forEach((u) => u());
    };
  }, [resolveUser]);

  const refreshUser = useCallback(async () => {
    await resolveUser(auth.currentUser);
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
        userRole,
        isFaculty,
        isAuthorized,
        memberData,
        authLoading,
        authError,
        refreshUser,
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
