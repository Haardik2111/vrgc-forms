"use client";

import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { supabase } from '../lib/supabase';
import { CONFIG } from '../lib/config';

interface IDCardProps {
  onRedirect: () => void;
}

interface MemberData {
  name: string;
  registrationNumber: string;
  phone: string;
  email: string;
  team: string;
  position: string;
}

interface CandidateSubmission {
  id?: string;
  name: string;
  registrationNumber: string;
  phone: string;
  team: string;
  position: string;
  email: string;
  photoUrl: string;
  avatarUrl: string;
  submittedAt: string;
  status: string;
}

const IDCard: React.FC<IDCardProps> = ({ onRedirect }) => {
  const getAdminDisplayRoleOrTeam = (team?: string, position?: string) => {
    const t = (team || '').toLowerCase();
    const p = (position || '').toLowerCase();
    const isSpecial = t === 'student coordinator' || t.includes('president') || p === 'student coordinator' || p.includes('president');
    if (isSpecial) {
      return {
        isSpecial: true,
        label: 'ROLE / POSITION',
        value: t === 'student coordinator' ? 'Student Coordinator' : position
      };
    }
    return {
      isSpecial: false,
      label: 'TEAM / DIVISION',
      value: team
    };
  };

  // Authentication & Member Data States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Tab selections
  const [activeSubTab, setActiveSubTab] = useState<'portal' | 'admin'>('portal');

  // Member Fields
  const [memberData, setMemberData] = useState<MemberData | null>(null);

  // Form Submission States
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [existingSubmission, setExistingSubmission] = useState<CandidateSubmission | null>(null);

  // Data Correction Report States
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportIssueText, setReportIssueText] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  // Admin Candidates & filters state
  const [candidates, setCandidates] = useState<CandidateSubmission[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<CandidateSubmission | null>(null);

  // Google Sheets Force Sync states
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetsCooldown, setSheetsCooldown] = useState<number>(0);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Cooldown timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sheetsCooldown > 0) {
      timer = setInterval(() => {
        setSheetsCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sheetsCooldown]);

  // Fetch CSV files & monitor Auth State on mount
  useEffect(() => {
    const fetchCSVData = async () => {
      setAuthLoading(true);
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

        const memberRes = await fetch('/members.csv');
        let membersList: MemberData[] = [];
        if (memberRes.ok) {
          const memberText = await memberRes.text();
          const lines = memberText.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
          const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
          const regIdx = headers.findIndex(h => h.toLowerCase() === 'registration number');
          const phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone');
          const teamIdx = headers.findIndex(h => h.toLowerCase() === 'team');
          const posIdx = headers.findIndex(h => h.toLowerCase() === 'position');

          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const currentLine = lines[i].split(',');
            membersList.push({
              name: currentLine[nameIdx] ? currentLine[nameIdx].trim() : '',
              registrationNumber: currentLine[regIdx] ? currentLine[regIdx].trim() : '',
              phone: currentLine[phoneIdx] ? currentLine[phoneIdx].trim() : '',
              email: currentLine[emailIdx] ? currentLine[emailIdx].trim().toLowerCase() : '',
              team: currentLine[teamIdx] ? currentLine[teamIdx].trim() : '',
              position: currentLine[posIdx] ? currentLine[posIdx].trim() : 'Member'
            });
          }
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const lowerEmail = user.email ? user.email.toLowerCase() : '';
            const matchedAdmin = adminEmailsList.includes(lowerEmail);
            setIsAdmin(matchedAdmin);

            const matchedMember = membersList.find(m => m.email === lowerEmail);
            if (matchedMember) {
              setMemberData(matchedMember);
              setIsAuthorized(true);
              await checkExistingSubmission(user.email || '');
            } else if (matchedAdmin) {
              setMemberData({
                name: user.displayName || 'Administrator',
                registrationNumber: 'ADMIN',
                phone: '',
                email: user.email || '',
                team: 'Management',
                position: 'Lead'
              });
              setIsAuthorized(true);
              await checkExistingSubmission(user.email || '');
            } else {
              setIsAuthorized(false);
              setAuthError('Access Denied: You are not authorized. Only registered members can access this portal.');
              await signOut(auth);
            }
          } else {
            setCurrentUser(null);
            setIsAuthorized(false);
            setMemberData(null);
            setExistingSubmission(null);
            setIsAdmin(false);
          }
          setAuthLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Error loading CSV auth data: ", err);
        setAuthLoading(false);
      }
    };

    fetchCSVData();
  }, []);

  // Subscribe to real-time updates from 'id_cards' Firestore collection (Admins only)
  useEffect(() => {
    if (!currentUser || !isAdmin) return;

    setLoadingData(true);
    const unsub = onSnapshot(collection(db, 'id_cards'), (snapshot) => {
      const candidatesData: CandidateSubmission[] = [];
      snapshot.forEach((doc) => {
        candidatesData.push({ id: doc.id, ...doc.data() } as CandidateSubmission);
      });
      candidatesData.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setCandidates(candidatesData);
      setLoadingData(false);
    }, (error) => {
      console.error("Firestore subscription error:", error);
      setLoadingData(false);
    });

    return () => unsub();
  }, [currentUser, isAdmin]);

  const checkExistingSubmission = async (email: string) => {
    try {
      const docRef = doc(db, 'id_cards', email.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setExistingSubmission(docSnap.data() as CandidateSubmission);
      } else {
        setExistingSubmission(null);
      }
    } catch (err) {
      console.error('Error checking existing submission:', err);
    }
  };

  const handleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized domain')) {
        setAuthError('Unauthorized Domain: Add your Vercel domain (e.g. your-app.vercel.app) to Firebase Console > Authentication > Settings > Authorized Domains.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completion. Please try again.');
      } else {
        setAuthError(err?.message || 'Failed to sign in. Please verify your Google Account.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsAuthorized(false);
      setMemberData(null);
      setExistingSubmission(null);
      setIsAdmin(false);
      setActiveSubTab('portal');
    } catch (err) {
      console.error('Signout error:', err);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB.');
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar must be less than 5MB.');
      return;
    }

    setAvatarFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !currentUser || !memberData) return;
    if (!photoFile) {
      setSubmitError('Please upload an identification photo.');
      return;
    }
    if (!avatarFile && !avatarUrlInput.trim()) {
      setSubmitError('Please upload a gaming avatar file or paste a direct GIF/Image URL link.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Helper to sanitize text for file names
      const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const userRegNo = memberData.registrationNumber || 'NO_REG';
      const userNameStr = sanitize(memberData.name || 'user');
      const userEmailStr = sanitize(currentUser.email || 'email');
      const timestamp = Date.now();

      // 1. Upload Identification Photo to 'id-cards' Bucket
      const photoExt = photoFile.name.split('.').pop();
      const photoFileName = `${userRegNo}_${userNameStr}_${userEmailStr}_photo_${timestamp}.${photoExt}`;
      const photoFilePath = `id-photos/${photoFileName}`;

      const { error: photoUploadError } = await supabase.storage
        .from('id-cards')
        .upload(photoFilePath, photoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (photoUploadError) {
        throw new Error(`Supabase photo upload failed: ${photoUploadError.message}.`);
      }

      const { data: { publicUrl: photoPublicUrl } } = supabase.storage
        .from('id-cards')
        .getPublicUrl(photoFilePath);

      // 2. Upload Gaming Avatar strictly to 'avatar' Bucket (or use direct URL link)
      let avatarPublicUrl = avatarUrlInput.trim();
      if (avatarFile) {
        const avatarExt = avatarFile.name.split('.').pop();
        const avatarFileName = `${userRegNo}_${userNameStr}_${userEmailStr}_avatar_${timestamp}.${avatarExt}`;
        const avatarFilePath = `avatars/${avatarFileName}`;

        const { error: avatarUploadError } = await supabase.storage
          .from('avatar')
          .upload(avatarFilePath, avatarFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (avatarUploadError) {
          throw new Error(`Supabase avatar upload failed to 'avatar' bucket: ${avatarUploadError.message}. Make sure 'avatar' bucket is created as Public with RLS upload policies.`);
        }

        const { data: { publicUrl: uploadedUrl } } = supabase.storage
          .from('avatar')
          .getPublicUrl(avatarFilePath);
          
        avatarPublicUrl = uploadedUrl;
      }

      // 3. Save Submission details to Firestore
      const submissionData: CandidateSubmission = {
        name: memberData.name,
        registrationNumber: memberData.registrationNumber,
        phone: memberData.phone,
        team: memberData.team,
        position: memberData.position,
        email: currentUser.email || '',
        photoUrl: photoPublicUrl,
        avatarUrl: avatarPublicUrl,
        submittedAt: new Date().toISOString(),
        status: 'Pending'
      };

      await setDoc(doc(db, 'id_cards', (currentUser.email || '').toLowerCase()), submissionData);

      setSubmitSuccess(true);
      setExistingSubmission(submissionData);
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmitError(err.message || 'An error occurred during submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportIssueText.trim() || !currentUser || !memberData) return;

    setIsSubmittingReport(true);
    setReportStatus(null);

    try {
      await addDoc(collection(db, 'data_reports'), {
        name: memberData.name,
        registrationNumber: memberData.registrationNumber,
        email: currentUser.email,
        team: memberData.team,
        position: memberData.position,
        reportedIssue: reportIssueText,
        submittedAt: new Date().toISOString(),
        status: 'Pending'
      });

      setReportStatus('success');
      setReportIssueText('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportStatus(null);
      }, 2000);
    } catch (err: any) {
      console.error("Error reporting data issue:", err);
      setReportStatus("Error: " + err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSyncAllToSheets = async () => {
    if (sheetsCooldown > 0 || isSyncingSheets) return;
    if (!CONFIG.GOOGLE_SCRIPT_ID_CARD_URL) {
      setSyncToastMessage("Google Script URL is not configured.");
      setTimeout(() => setSyncToastMessage(null), 4000);
      return;
    }

    setIsSyncingSheets(true);

    try {
      const syncPromises = candidates.map(c => {
        const sheetSyncUrl = `${CONFIG.GOOGLE_SCRIPT_ID_CARD_URL}?action=sync_idcard&email=${encodeURIComponent(c.email)}&name=${encodeURIComponent(c.name)}&regNo=${encodeURIComponent(c.registrationNumber)}&phone=${encodeURIComponent(c.phone || '')}&team=${encodeURIComponent(c.team || '')}&position=${encodeURIComponent(c.position || 'Member')}&photoUrl=${encodeURIComponent(c.photoUrl || '')}&submittedAt=${encodeURIComponent(c.submittedAt || '')}&status=${encodeURIComponent(c.status || 'Pending')}`;
        return fetch(sheetSyncUrl, { mode: 'no-cors' })
          .then(() => true)
          .catch(err => {
            console.error("Sheets row sync failed:", err);
            return false;
          });
      });

      const results = await Promise.allSettled(syncPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      setSyncToastMessage(`Parallel sync completed! Transmitted ${successCount} ID record(s) to IDCardDetails.`);
      setTimeout(() => setSyncToastMessage(null), 4500);
      setSheetsCooldown(60);
    } catch (err) {
      console.error("Error during force sync to Sheets:", err);
      setSyncToastMessage("Sync failed. Check connection or script configuration.");
      setTimeout(() => setSyncToastMessage(null), 4500);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleDownload = async (candidate: CandidateSubmission) => {
    if (!candidate.photoUrl) return;
    setDownloadingId(candidate.id || candidate.email);

    try {
      const response = await fetch(candidate.photoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${candidate.registrationNumber || 'ID'}_Photo.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Direct download failed, opening in new tab:", err);
      window.open(candidate.photoUrl, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (candidate: CandidateSubmission) => {
    if (!window.confirm(`Are you sure you want to delete the entry for ${candidate.name}? This will unlock their form response.`)) {
      return;
    }

    try {
      if (candidate.photoUrl) {
        const index = candidate.photoUrl.indexOf('id-photos/');
        if (index !== -1) {
          const filePath = decodeURIComponent(candidate.photoUrl.substring(index));
          await supabase.storage.from('id-cards').remove([filePath]);
        }
      }
      if (candidate.avatarUrl) {
        const avatarIdx = candidate.avatarUrl.indexOf('avatars/');
        if (avatarIdx !== -1) {
          const avatarFilePath = decodeURIComponent(candidate.avatarUrl.substring(avatarIdx));
          const bucketName = candidate.avatarUrl.includes('/avatar/') ? 'avatar' : 'id-cards';
          await supabase.storage.from(bucketName).remove([avatarFilePath]);
        } else {
          const photoIdx = candidate.avatarUrl.indexOf('id-photos/');
          if (photoIdx !== -1) {
            const filePath = decodeURIComponent(candidate.avatarUrl.substring(photoIdx));
            await supabase.storage.from('id-cards').remove([filePath]);
          }
        }
      }

      await deleteDoc(doc(db, 'id_cards', candidate.email.toLowerCase()));

      if (currentUser && candidate.email.toLowerCase() === (currentUser.email || '').toLowerCase()) {
        setExistingSubmission(null);
        setSubmitSuccess(false);
      }

      setSyncToastMessage(`Deleted submission for ${candidate.name}. Form response unlocked.`);
      setTimeout(() => setSyncToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete entry: " + err.message);
    }
  };

  const toggleStatus = async (candidate: CandidateSubmission) => {
    try {
      const currentStatus = candidate.status || 'Pending';
      const newStatus = currentStatus === 'Approved' ? 'Pending' : 'Approved';
      await updateDoc(doc(db, 'id_cards', candidate.email.toLowerCase()), {
        status: newStatus
      });

      if (previewCandidate && previewCandidate.email.toLowerCase() === candidate.email.toLowerCase()) {
        setPreviewCandidate(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      console.error("Status update failed:", err);
      alert("Failed to update status: " + err.message);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const name = (c.name || '').toLowerCase();
    const reg = (c.registrationNumber || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const search = searchQuery.toLowerCase();

    const matchesSearch = name.includes(search) || reg.includes(search) || email.includes(search);
    const matchesTeam = selectedTeam === 'All' || (c.team && c.team.toLowerCase() === selectedTeam.toLowerCase());
    return matchesSearch && matchesTeam;
  });

  if (authLoading) {
    return (
      <main className="flex-grow min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-[64px] text-primary animate-spin">
            sync
          </span>
          <p className="font-code-sm text-primary tracking-widest text-sm">
            VALIDATING REGISTERED IDENTITY...
          </p>
        </div>
      </main>
    );
  }

  if (!currentUser || !isAuthorized) {
    return (
      <main className="flex-grow min-h-screen flex items-center justify-center p-6 relative overflow-hidden text-left bg-mesh">
        <div className="glass-panel p-10 md:p-12 rounded-2xl max-w-lg w-full text-center space-y-6 border border-purple-500/20 relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.15)] bg-black/70 backdrop-blur-xl">
          <div className="space-y-3">
            <span className="font-label-caps text-xs text-purple-400 tracking-widest block font-bold">IDENTITY CONFIRMATION</span>
            <h2 className="font-display-lg text-3xl md:text-4xl text-white font-extrabold tracking-tight uppercase">
              Member ID Portal
            </h2>
            <p className="font-body-md text-slate-300 max-w-sm mx-auto text-sm">
              Please authenticate using your registered email address to access the digital ID Card System.
            </p>
          </div>

          {authError && (
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-400 text-sm font-body-md text-left flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">lock_hazard</span>
              <div>
                <strong className="block font-bold">AUTHENTICATION ERROR</strong>
                <span className="opacity-95">{authError}</span>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleLogin}
              className="w-full bg-white text-black font-extrabold py-4 px-8 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:bg-slate-100 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-3 font-label-caps text-xs tracking-wider"
            >
              <span className="material-symbols-outlined font-bold text-black">login</span>
              <span>AUTHENTICATE WITH GOOGLE</span>
            </button>

            <button
              onClick={onRedirect}
              className="w-full bg-black/40 border border-purple-500/30 hover:border-purple-400 text-slate-300 hover:text-white py-3.5 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 text-xs font-bold font-label-caps tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>BACK TO DASHBOARD</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow min-h-screen relative overflow-hidden text-left bg-mesh">
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-left">
            <span className="font-label-caps text-xs text-primary tracking-widest block mb-2 font-bold">
              VRGC SECURE DOSSIER REGISTRY
            </span>
            <h2 className="font-display-lg text-3xl md:text-5xl mb-4 text-white font-extrabold tracking-tight uppercase">
              ID CARD ISSUANCE
            </h2>
            <p className="font-body-lg text-on-surface-variant max-w-xl text-sm md:text-base leading-relaxed">
              Verify your candidate records and upload your profile photo to register your digital ID Card.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 self-start md:self-end z-20">
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:border-red-500/50 px-5 py-2.5 rounded-full text-xs font-label-caps tracking-wider transition-all flex items-center gap-2 font-bold"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>LOGOUT</span>
            </button>
          </div>
        </header>

        {/* Tab Headers (Admins Only) */}
        {isAdmin && (
          <div className="flex border-b border-outline-variant/30 mb-8 relative z-20">
            <button
              onClick={() => setActiveSubTab('portal')}
              className={`px-6 py-3 font-label-caps tracking-wider text-xs md:text-sm font-bold border-b-2 transition-all duration-300 ${
                activeSubTab === 'portal'
                  ? 'border-primary text-primary shadow-[0_4px_12px_rgba(207,92,255,0.15)]'
                  : 'border-transparent text-on-surface-variant hover:text-white'
              }`}
            >
              ID CARD PORTAL
            </button>
            <button
              onClick={() => setActiveSubTab('admin')}
              className={`px-6 py-3 font-label-caps tracking-wider text-xs md:text-sm font-bold border-b-2 transition-all duration-300 flex items-center gap-1.5 ${
                activeSubTab === 'admin'
                  ? 'border-red-500 text-red-400 shadow-[0_4px_12px_rgba(239,68,68,0.25)]'
                  : 'border-transparent text-red-400/80 hover:text-red-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm text-red-400">admin_panel_settings</span>
              <span>ADMIN DASHBOARD</span>
            </button>
          </div>
        )}

        {/* SUB TAB 1: PORTAL */}
        {activeSubTab === 'portal' && (
          <div className="space-y-6">
            {existingSubmission ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 stagger-in">
                {/* 3D Flip Card Container */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="relative w-full max-w-[340px] aspect-[2.2/3.4] cursor-pointer group [perspective:1000px]"
                >
                  <div className={`relative w-full h-full duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    
                    {/* FRONT OF THE ID CARD */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] select-none">
                      <div className="relative overflow-hidden w-full h-full rounded-3xl border border-[#a855f7]/35 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(168,85,247,0.25)]">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40"></div>
                        
                        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>

                        <div className="flex justify-between items-start border-b border-[#a855f7]/25 pb-3 relative z-10">
                          <div className="text-left w-full">
                            <div className="flex items-center gap-1 justify-center">
                              <span className="material-symbols-outlined text-[14px] text-[#a855f7]">sports_esports</span>
                              <h4 className="font-display-lg text-sm text-white font-black tracking-widest leading-none">VRGC</h4>
                            </div>
                            <span className="text-[#a855f7]/80 text-[5px] font-code-sm tracking-wider uppercase block mt-1 font-bold text-center">VIRTUAL REALITY & GAMING CLUB</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center my-3 relative z-10">
                          <div className="w-36 h-36 rounded-2xl border-2 border-[#a855f7]/30 p-1 bg-black/40 shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden">
                            <img 
                              src={existingSubmission.photoUrl} 
                              alt="Member Avatar" 
                              className="w-full h-full object-cover rounded-xl"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1 right-1 bg-gradient-to-r from-[#a855f7]/80 to-[#cf5cff]/80 text-white text-[6px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase shadow-md pointer-events-none opacity-85">
                              VERIFIED
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#0b0512]/90 border border-[#a855f7]/25 p-3 rounded-2xl relative z-10 space-y-2.5">
                          <div className="border-b border-white/5 pb-1.5 text-left">
                            <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">NAME</span>
                            <h3 className="font-display-lg text-sm text-white font-extrabold tracking-wide uppercase truncate leading-none">
                              {existingSubmission.name}
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-left">
                            <div>
                              <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">REGISTRATION NO.</span>
                              <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block">
                                {existingSubmission.registrationNumber}
                              </span>
                            </div>
                            <div>
                              {(() => {
                                const displayInfo = getAdminDisplayRoleOrTeam(existingSubmission.team, existingSubmission.position);
                                return (
                                  <>
                                    <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">{displayInfo.label === 'TEAM / DIVISION' ? 'TEAM' : displayInfo.label}</span>
                                    <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block uppercase truncate">
                                      {displayInfo.value}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 justify-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7] animate-pulse"></span>
                            <span className="font-code-sm text-[8px] text-[#ddb7ff] font-extrabold uppercase tracking-widest leading-none">
                              {(() => {
                                const displayInfo = getAdminDisplayRoleOrTeam(existingSubmission.team, existingSubmission.position);
                                return displayInfo.isSpecial ? displayInfo.value : (existingSubmission.position || 'CORE MEMBER');
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="absolute bottom-1 right-2 text-[5px] font-bold text-white/20 font-code-sm uppercase tracking-widest pointer-events-none">
                          TAP TO FLIP
                        </div>
                      </div>
                    </div>

                    {/* BACK OF THE ID CARD */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] select-none">
                      <div className="relative overflow-hidden w-full h-full rounded-3xl border border-[#a855f7]/35 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(168,85,247,0.25)]">
                        {existingSubmission.avatarUrl && (
                          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl">
                            <img 
                              src={existingSubmission.avatarUrl} 
                              alt="Avatar Watermark" 
                              className="w-full h-full object-cover opacity-[0.75]"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-[#05010a]/15 bg-gradient-to-b from-transparent via-[#05010a]/40 to-[#05010a]/75"></div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40"></div>
                        
                        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>

                        <div className="text-center relative z-10 border-b border-[#a855f7]/25 pb-2">
                          <h4 className="font-display-lg text-sm text-white font-black tracking-widest uppercase">VRGC</h4>
                          <span className="font-code-sm text-[5px] text-[#a855f7]/80 tracking-wider block mt-0.5">VIRTUAL REALITY & GAMING CLUB</span>
                        </div>

                        <div className="my-3 flex flex-col items-center justify-center relative z-10">
                          <div className="w-28 h-28 rounded-xl border border-white/10 bg-white p-1.5 shadow-[0_0_25px_rgba(168,85,247,0.25)]">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=a855f7&bgcolor=ffffff&data=${encodeURIComponent(`${window.location.origin}/#/card/${existingSubmission.registrationNumber}`)}`} 
                              alt="Scan to Verify" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="font-code-sm text-[6px] text-[#a855f7] font-black uppercase tracking-widest block mt-2">SCAN TO CONNECT</span>
                        </div>

                        <div className="space-y-1.5 border-t border-[#a855f7]/25 pt-2.5 relative z-10 text-[7px] font-code-sm text-white/70 text-left w-full pl-2">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[10px] text-[#a855f7]">alternate_email</span>
                            <span>@vrgc_official</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[10px] text-[#a855f7]">forum</span>
                            <span>discord.gg/vrgc</span>
                          </div>
                        </div>

                        <div className="text-center text-[7px] font-extrabold text-[#a855f7]/80 tracking-widest mt-2.5 uppercase relative z-10">
                          PLAY • CREATE • INNOVATE
                        </div>

                        <div className="absolute bottom-1 right-2 text-[5px] font-bold text-white/20 font-code-sm uppercase tracking-widest pointer-events-none">
                          TAP TO FLIP
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 mt-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold bg-green-500/5 px-2.5 py-1 rounded-full border border-green-500/20">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    <span>DOSSIER ACTIVE (RESPONSE RECORDED)</span>
                  </div>
                  
                  <div className="flex gap-4 mt-2">
                    <button
                      onClick={() => handleDownload(existingSubmission)}
                      className="group flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#a855f7]/30 hover:border-[#a855f7] hover:text-white transition-all text-xs font-bold font-label-caps bg-black/40"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>DOWNLOAD PHOTO</span>
                    </button>
                    {existingSubmission.avatarUrl && (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(existingSubmission.avatarUrl);
                            const blob = await response.blob();
                            const blobUrl = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.download = `${existingSubmission.registrationNumber || 'ID'}_Avatar.jpg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(blobUrl);
                          } catch (err) {
                            window.open(existingSubmission.avatarUrl, '_blank');
                          }
                        }}
                        className="group flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#a855f7]/30 hover:border-[#a855f7] hover:text-white transition-all text-xs font-bold font-label-caps bg-black/40"
                      >
                        <span className="material-symbols-outlined text-sm">sports_esports</span>
                        <span>DOWNLOAD AVATAR</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* FORM SUBMISSION VIEW (FIRST TIME) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start stagger-in">
                {/* Live Preview Card */}
                <div className="lg:col-span-5 flex flex-col items-center gap-6">
                  <div className="w-full flex justify-between items-center">
                    <h3 className="font-label-caps text-xs text-outline tracking-wider font-bold">LIVE PREVIEW</h3>
                    <span className="text-[10px] text-[#a855f7] font-bold uppercase tracking-widest font-code-sm">TAP CARD TO FLIP</span>
                  </div>
                  
                  <div 
                    onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                    className="relative w-full max-w-[320px] aspect-[2.2/3.4] cursor-pointer group [perspective:1000px]"
                  >
                    <div className={`relative w-full h-full duration-700 [transform-style:preserve-3d] ${isPreviewFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                      
                      {/* FRONT PREVIEW */}
                      <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] select-none">
                        <div className="relative overflow-hidden w-full h-full rounded-3xl border border-[#a855f7]/35 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40"></div>
                          
                          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>

                          <div className="flex justify-between items-start border-b border-[#a855f7]/25 pb-3 relative z-10">
                            <div className="text-left w-full">
                              <div className="flex items-center gap-1 justify-center">
                                <span className="material-symbols-outlined text-[14px] text-[#a855f7]">sports_esports</span>
                                <h4 className="font-display-lg text-sm text-white font-black tracking-widest leading-none">VRGC</h4>
                              </div>
                              <span className="text-[#a855f7]/80 text-[5px] font-code-sm tracking-wider uppercase block mt-1 font-bold text-center">VIRTUAL REALITY & GAMING CLUB</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center my-3 relative z-10">
                            <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-[#a855f7]/30 p-1 bg-black/40 shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden flex items-center justify-center">
                              {photoPreview ? (
                                <img 
                                  src={photoPreview} 
                                  alt="ID Preview" 
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                <div className="text-center p-4 space-y-1 text-white/40">
                                  <span className="material-symbols-outlined text-[#a855f7]/55 text-3xl animate-pulse">face</span>
                                  <p className="font-code-sm text-[8px] tracking-widest uppercase font-bold text-white/50">UPLOAD IMAGE</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#0b0512]/90 border border-[#a855f7]/25 p-3 rounded-2xl relative z-10 space-y-2.5">
                            <div className="border-b border-white/5 pb-1.5 text-left">
                              <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">NAME</span>
                              <h3 className="font-display-lg text-sm text-white font-extrabold tracking-wide uppercase truncate leading-none">
                                {memberData?.name || 'FULL NAME'}
                              </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-left">
                              <div>
                                <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">REGISTRATION NO.</span>
                                <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block">
                                  {memberData?.registrationNumber || '24XXXXXX'}
                                </span>
                              </div>
                              <div>
                                {(() => {
                                  const displayInfo = getAdminDisplayRoleOrTeam(memberData?.team, memberData?.position);
                                  return (
                                    <>
                                      <span className="font-code-sm text-[6px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-extrabold">{displayInfo.label === 'TEAM / DIVISION' ? 'TEAM' : displayInfo.label}</span>
                                      <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block uppercase truncate">
                                        {displayInfo.value || 'TECH/DESIGN'}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 justify-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7] animate-pulse"></span>
                              <span className="font-code-sm text-[8px] text-[#ddb7ff] font-extrabold uppercase tracking-widest leading-none">
                                {(() => {
                                  const displayInfo = getAdminDisplayRoleOrTeam(memberData?.team, memberData?.position);
                                  return displayInfo.isSpecial ? displayInfo.value : (memberData?.position || 'CORE MEMBER');
                                })()}
                              </span>
                            </div>
                          </div>

                          <div className="absolute bottom-1 right-2 text-[5px] font-bold text-white/20 font-code-sm uppercase tracking-widest pointer-events-none">
                            TAP TO FLIP
                          </div>
                        </div>
                      </div>

                      {/* BACK PREVIEW */}
                      <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] select-none">
                        <div className="relative overflow-hidden w-full h-full rounded-3xl border border-[#a855f7]/35 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                          {avatarPreview && (
                            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl">
                              <img 
                                src={avatarPreview} 
                                alt="Avatar Watermark Preview" 
                                className="w-full h-full object-cover opacity-[0.75]"
                              />
                              <div className="absolute inset-0 bg-[#05010a]/15 bg-gradient-to-b from-transparent via-[#05010a]/40 to-[#05010a]/75"></div>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40"></div>
                          
                          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#a855f7]/40 pointer-events-none"></div>
                          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#a855f7]/40 pointer-events-none"></div>

                          <div className="text-center relative z-10 border-b border-[#a855f7]/25 pb-2">
                            <h4 className="font-display-lg text-sm text-white font-black tracking-widest uppercase">VRGC</h4>
                            <span className="font-code-sm text-[5px] text-[#a855f7]/80 tracking-wider block mt-0.5">VIRTUAL REALITY & GAMING CLUB</span>
                          </div>

                          <div className="my-3 flex flex-col items-center justify-center relative z-10">
                            <div className="w-28 h-28 rounded-xl border border-white/10 bg-white p-1.5 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=a855f7&bgcolor=ffffff&data=${encodeURIComponent(`${window.location.origin}/#/card/${memberData?.registrationNumber || '24XXXXXX'}`)}`} 
                                alt="Scan to Verify" 
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="font-code-sm text-[6px] text-[#a855f7] font-black uppercase tracking-widest block mt-2">SCAN TO VERIFY</span>
                          </div>

                          <div className="space-y-1.5 border-t border-[#a855f7]/25 pt-2.5 relative z-10 text-[7px] font-code-sm text-white/70 text-left w-full pl-2">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[10px] text-[#a855f7]">alternate_email</span>
                              <span>@vrgc_official</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[10px] text-[#a855f7]">forum</span>
                              <span>discord.gg/vrgc</span>
                            </div>
                          </div>

                          <div className="text-center text-[7px] font-extrabold text-[#a855f7]/80 tracking-widest mt-2.5 uppercase relative z-10">
                            PLAY • CREATE • INNOVATE
                          </div>

                          <div className="absolute bottom-1 right-2 text-[5px] font-bold text-white/20 font-code-sm uppercase tracking-widest pointer-events-none">
                            TAP TO FLIP
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="lg:col-span-7 space-y-6">
                  <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl space-y-8 border border-purple-500/20 text-left bg-black/70 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block font-label-caps text-[10px] text-purple-300 mb-2 tracking-widest font-bold">&nbsp;&nbsp;MEMBER FULL NAME : </label>
                        <input
                          readOnly
                          value={memberData?.name || ''}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 font-body-md focus:outline-none cursor-not-allowed text-xs md:text-sm"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block font-label-caps text-[10px] text-purple-300 mb-2 tracking-widest font-bold">&nbsp;&nbsp;REGISTRATION NUMBER : </label>
                        <input
                          readOnly
                          value={memberData?.registrationNumber || ''}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-2.5 text-purple-400 font-code-sm focus:outline-none cursor-not-allowed uppercase text-xs md:text-sm"
                          type="text"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block font-label-caps text-[10px] text-purple-300 mb-2 tracking-widest font-bold">&nbsp;&nbsp;CONTACT : </label>
                        <input
                          readOnly
                          value={memberData?.phone || ''}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 font-body-md focus:outline-none cursor-not-allowed text-xs md:text-sm"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block font-label-caps text-[10px] text-purple-300 mb-2 tracking-widest font-bold">&nbsp;&nbsp;ASSIGNED TEAM : </label>
                        <input
                          readOnly
                          value={memberData?.team || ''}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 font-body-md focus:outline-none cursor-not-allowed text-xs md:text-sm"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block font-label-caps text-[10px] text-purple-300 mb-2 tracking-widest font-bold">&nbsp;&nbsp;ROLE / POSITION : </label>
                        <input
                          readOnly
                          value={memberData?.position || 'Member'}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-2.5 text-white/90 font-body-md focus:outline-none cursor-not-allowed uppercase text-xs md:text-sm"
                          type="text"
                        />
                      </div>
                    </div>

                    {/* Image Selection - Perfectly Matched Height Level */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                      <div className="flex flex-col space-y-2 h-full">
                        <label className="block font-label-caps text-[10px] text-purple-300 tracking-widest font-bold uppercase truncate">
                        &nbsp;UPLOAD IDENTIFICATION PHOTO :
                        </label>
                        <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-5 transition-all duration-300 bg-black/60 hover:bg-black/80 relative flex-1 min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <span className="material-symbols-outlined text-3xl text-purple-400/80 mb-1">cloud_upload</span>
                          <p className="font-body-md text-xs text-white/90 font-bold truncate max-w-[200px]">
                            {photoFile ? photoFile.name : "Choose Profile Image"}
                          </p>
                          <p className="font-code-sm text-[9px] text-slate-400 mt-1">PNG, JPG, or WEBP up to 5MB</p>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2 h-full">
                        <label className="block font-label-caps text-[10px] text-purple-300 tracking-widest font-bold uppercase truncate">
                        &nbsp;UPLOAD GAMING AVATAR (FOR BACKSIDE) :
                        </label>
                        <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-4 transition-all duration-300 bg-black/60 hover:bg-black/80 relative flex-1 min-h-[110px] flex flex-col items-center justify-center text-center cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,image/gif"
                            onChange={handleAvatarChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          {avatarPreview ? (
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-yellow-400/80 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                              <img 
                                src={avatarPreview} 
                                alt="Avatar Preview" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-2xl text-purple-400/80 mb-0.5">sports_esports</span>
                              <p className="font-body-md text-xs text-white/90 font-bold truncate max-w-[200px]">
                                {avatarFile ? avatarFile.name : "Choose File (PNG/JPG/GIF)"}
                              </p>
                              <p className="font-code-sm text-[9px] text-slate-400 mt-0.5">Up to 5MB file upload</p>
                            </>
                          )}
                        </div>

                        {/* Direct GIF / Avatar URL Input */}
                        <div className="pt-1">
                          <label className="block text-[9px] font-label-caps text-purple-300/80 mb-1 tracking-wider font-bold">
                          &nbsp;OR PASTE DIRECT GIF / IMAGE URL &nbsp;LINK:
                          </label>
                          <div className="relative">
                            <input
                              type="url"
                              placeholder="https://media.giphy.com/media/.../giphy.gif"
                              value={avatarUrlInput}
                              onChange={(e) => {
                                let url = e.target.value.trim();
                                setAvatarUrlInput(url);
                                if (url) {
                                  // Auto-format Giphy webpage URLs to direct raw GIF URLs
                                  if (url.includes('giphy.com/gifs/')) {
                                    const parts = url.split('-');
                                    const gifId = parts[parts.length - 1];
                                    if (gifId) url = `https://media.giphy.com/media/${gifId}/giphy.gif`;
                                  }
                                  setAvatarPreview(url);
                                } else if (!avatarFile) {
                                  setAvatarPreview(null);
                                }
                              }}
                              className="w-full bg-black/80 border border-purple-500/30 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-purple-400 font-code-sm placeholder:text-slate-500"
                            />
                            {avatarUrlInput && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAvatarUrlInput('');
                                  setAvatarFile(null);
                                  setAvatarPreview(null);
                                }}
                                className="absolute right-2 top-2 text-slate-400 hover:text-white"
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-xl text-xs font-body-md">
                        {submitError}
                      </div>
                    )}

                    <div className="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
                      <span className="font-code-sm text-[9px] text-on-surface-variant text-center sm:text-left">
                        SUBMITTING THIS FORM REGISTERS A SINGLE PORTAL RESPONSE.
                      </span>

                      <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-center">
                        <button
                          type="button"
                          onClick={() => setShowReportModal(true)}
                          className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-[#262626] text-red-400 border border-red-500/20 hover:border-red-500/40 font-bold py-3.5 px-6 rounded-full text-xs transition-all flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">report_problem</span>
                          <span>REPORT ERROR</span>
                        </button>

                        <button
                          disabled={isSubmitting}
                          className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3.5 px-8 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-xs font-label-caps tracking-widest uppercase"
                          type="submit"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-sm text-black">sync</span> REGISTERING...
                            </>
                          ) : (
                            'SUBMIT DOSSIER'
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 2: ADMIN DASHBOARD */}
        {activeSubTab === 'admin' && isAdmin && (
          <div className="space-y-6 stagger-in text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="font-display-lg text-lg text-white font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">admin_panel_settings</span>
                  Candidate Dossier Submissions
                </h3>
                <p className="text-xs text-on-surface-variant max-w-lg mt-0.5">
                  Select and verify candidate digital identity dossiers.
                </p>
              </div>

              <button
                disabled={isSyncingSheets || sheetsCooldown > 0}
                onClick={handleSyncAllToSheets}
                className={`px-4 py-2.5 rounded-xl border text-xs font-label-caps tracking-wider flex items-center justify-center gap-2 shrink-0 transition-all duration-300 font-bold ${
                  sheetsCooldown > 0 || isSyncingSheets
                    ? 'bg-black/40 border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'
                    : 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary shadow-[0_0_15px_rgba(207,92,255,0.2)] active:scale-95'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${isSyncingSheets ? 'animate-spin text-primary' : ''}`}>
                  {isSyncingSheets ? 'sync' : sheetsCooldown > 0 ? 'hourglass_top' : 'cloud_upload'}
                </span>
                <span>
                  {isSyncingSheets 
                    ? 'PARALLEL SYNCING...' 
                    : sheetsCooldown > 0 
                      ? `COOLDOWN (${sheetsCooldown}s)` 
                      : 'SYNC TO GOOGLE SHEETS'}
                </span>
              </button>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search candidate name, registration number, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/30 border border-outline-variant/30 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary placeholder:text-white/25 transition-all duration-300"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] font-label-caps text-outline tracking-wider font-bold">TEAM:</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-black/50 border border-outline-variant/30 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-0 focus:border-primary cursor-pointer hover:bg-black/80 font-label-caps"
                >
                  <option value="All">All Teams</option>
                  <option value="Design">Design</option>
                  <option value="Education">Education</option>
                  <option value="Esports">Esports</option>
                  <option value="PR">PR</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Technical">Technical</option>
                  <option value="Management">Management</option>
                </select>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl relative overflow-hidden space-y-4">
              <div className="space-y-4 relative z-10">
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-outline-variant/20 text-xs text-on-surface-variant font-label-caps tracking-widest font-bold">
                  <div className="col-span-3">CANDIDATE</div>
                  <div className="col-span-3">CONTACT / TEAM</div>
                  <div className="col-span-2 text-center">SUBMITTED</div>
                  <div className="col-span-2 text-center">STATUS</div>
                  <div className="col-span-2 text-right">ACTIONS</div>
                </div>

                {loadingData ? (
                  <div className="py-12 text-center text-on-surface-variant font-code-sm animate-pulse">
                    LOADING SECURE RECORDS...
                  </div>
                ) : filteredCandidates.length > 0 ? (
                  filteredCandidates.map((c) => {
                    const submissionDate = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : "N/A";
                    return (
                      <div
                        key={c.id}
                        onClick={() => setPreviewCandidate(c)}
                        className="grid grid-cols-12 gap-2 md:gap-4 p-3.5 md:p-4 rounded-xl border border-white/5 bg-white/5 items-center hover:scale-[1.01] hover:border-primary/30 transition-all duration-200 cursor-pointer"
                      >
                        <div className="col-span-8 md:col-span-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg border border-primary/30 bg-black/40 overflow-hidden shrink-0">
                            <img src={c.photoUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs md:text-sm truncate">{c.name}</div>
                            <div className="text-[10px] md:text-xs text-primary font-code-sm">{c.registrationNumber}</div>
                          </div>
                        </div>

                        <div className="hidden md:block col-span-3 text-xs text-on-surface-variant font-code-sm space-y-0.5">
                          <div className="truncate text-white">{c.email}</div>
                          <div>
                            {c.phone || "No Phone"} |{' '}
                            <span className="text-primary font-bold uppercase">
                              {(() => {
                                const display = getAdminDisplayRoleOrTeam(c.team, c.position);
                                return display.value;
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="hidden md:block col-span-2 text-center text-xs text-on-surface-variant font-code-sm">
                          {submissionDate}
                        </div>

                        <div className="col-span-2 md:col-span-2 text-center flex justify-center">
                          <span
                            className={`px-3 py-1 rounded-full border text-[9px] font-label-caps font-bold tracking-wider ${
                              c.status === 'Approved'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            }`}
                          >
                            {c.status || 'Pending'}
                          </span>
                        </div>

                        <div className="col-span-2 md:col-span-2 flex justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStatus(c); }}
                            className={`p-2 rounded-lg border transition-all shrink-0 relative z-30 ${
                              c.status === 'Approved'
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                                : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            }`}
                            title={c.status === 'Approved' ? 'Mark as Pending' : 'Approve Dossier'}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {c.status === 'Approved' ? 'history' : 'verified'}
                            </span>
                          </button>

                          <button
                            disabled={downloadingId === c.id}
                            onClick={(e) => { e.stopPropagation(); handleDownload(c); }}
                            className="p-2 rounded-lg bg-white/5 border border-white/5 text-on-surface-variant hover:text-white hover:border-white/20 transition-all shrink-0 relative z-30"
                            title="Download ID Photo"
                          >
                            <span className={`material-symbols-outlined text-sm ${downloadingId === c.id ? 'animate-spin' : ''}`}>
                              {downloadingId === c.id ? 'sync' : 'download'}
                            </span>
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                            className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all shrink-0 relative z-30"
                            title="Delete and Unlock Response"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 text-center text-on-surface-variant italic text-xs md:text-sm">
                    No matching candidate ID dossiers found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </section>

      {/* Mismatch report modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[200]">
          <div className="glass-panel p-6 md:p-8 rounded-2xl max-w-lg w-full border border-outline-variant/30 relative space-y-6 text-left">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-base">report_problem</span>
                <h3 className="font-headline-sm text-sm md:text-base text-white font-bold uppercase tracking-wider">Report Registration Error</h3>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-on-surface-variant hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              If the pre-filled information displayed on your dossier (Name, Registration number, Team, Role) does not match your official files, describe the errors below. Administrators will verify and revise.
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block font-label-caps text-[10px] text-outline mb-1.5 tracking-widest font-bold">DESCRIPTION OF ISSUE</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Example: My name spelling is incorrect. It should be spelled 'Siddharth' instead of 'Sidhart'..."
                  value={reportIssueText}
                  onChange={(e) => setReportIssueText(e.target.value)}
                  className="w-full bg-black/40 border border-outline-variant/30 rounded-xl px-4 py-3 text-white placeholder:text-white/20 font-body-md text-xs md:text-sm focus:outline-none focus:border-primary transition-all"
                ></textarea>
              </div>

              {reportStatus && (
                <div className={`p-3 rounded-lg text-xs font-bold ${
                  reportStatus === 'success' 
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                    : 'bg-error/10 border border-error/20 text-error'
                }`}>
                  {reportStatus === 'success' ? 'Report logged! Admins have been notified.' : reportStatus}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-5 py-2.5 rounded-full border border-outline hover:bg-white/5 text-xs font-bold font-label-caps"
                >
                  CANCEL
                </button>
                <button
                  disabled={isSubmittingReport}
                  type="submit"
                  className="bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 px-6 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                >
                  {isSubmittingReport ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span> SUBMITTING...
                    </>
                  ) : (
                    'SUBMIT REPORT'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Candidate detailed view modal */}
      {previewCandidate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[200]">
          <div className="bg-[#0b0612]/95 border border-[#a855f7]/30 backdrop-blur-2xl p-6 md:p-8 rounded-3xl max-w-2xl w-full relative text-left space-y-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] overflow-hidden">
            <button 
              onClick={() => setPreviewCandidate(null)}
              className="absolute right-4 top-4 text-white/50 hover:text-white hover:rotate-90 transition-all duration-300 p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-2 border-b border-white/15 pb-3">
              <span className="material-symbols-outlined text-primary text-base animate-pulse">folder_shared</span>
              <h4 className="font-display-lg text-sm text-white font-extrabold uppercase tracking-widest">
                Candidate ID Card Dossier
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-5 flex flex-col items-center justify-center relative py-4">
                <div className="w-48 h-48 rounded-2xl border-2 border-[#a855f7]/30 p-1 relative z-10 bg-black/40 shadow-[0_0_30px_rgba(168,85,247,0.15)] group">
                  <div className="w-full h-full rounded-xl overflow-hidden bg-black relative">
                    <img 
                      src={previewCandidate.photoUrl} 
                      alt="Avatar" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs font-body-md">
                  <div className="border-b border-white/5 pb-2">
                    <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">FULL NAME</span>
                    <span className="text-white text-sm font-bold block truncate">{previewCandidate.name}</span>
                  </div>
                  <div className="border-b border-white/5 pb-2">
                    <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">REG NO</span>
                    <span className="text-[#ddb7ff] text-sm font-bold font-code-sm block">{previewCandidate.registrationNumber}</span>
                  </div>
                  {(() => {
                    const display = getAdminDisplayRoleOrTeam(previewCandidate.team, previewCandidate.position);
                    if (display.isSpecial) {
                      return (
                        <div className="col-span-2 border-b border-white/5 pb-2">
                          <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">ROLE / POSITION</span>
                          <span className="text-white text-sm font-bold block uppercase">{display.value}</span>
                        </div>
                      );
                    } else {
                      return (
                        <>
                          <div className="border-b border-white/5 pb-2">
                            <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">TEAM / DIVISION</span>
                            <span className="text-white text-sm font-bold block uppercase">{previewCandidate.team}</span>
                          </div>
                          <div className="border-b border-white/5 pb-2">
                            <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">ROLE / POSITION</span>
                            <span className="text-white text-sm font-bold block uppercase">{previewCandidate.position}</span>
                          </div>
                        </>
                      );
                    }
                  })()}
                  <div className="border-b border-white/5 pb-2">
                    <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">PHONE NUMBER</span>
                    <span className="text-white text-sm block font-code-sm">{previewCandidate.phone || "N/A"}</span>
                  </div>
                  <div className="border-b border-white/5 pb-2">
                    <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block font-bold mb-0.5">SUBMISSION DATE</span>
                    <span className="text-white/60 block font-code-sm">
                      {previewCandidate.submittedAt ? new Date(previewCandidate.submittedAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="col-span-2 border-b border-white/5 pb-2">
                    <span className="font-code-sm text-[8px] text-[#a855f7] uppercase tracking-widest block mb-0.5 font-bold">EMAIL ADDRESS</span>
                    <span className="text-white block font-code-sm text-xs font-semibold break-all">{previewCandidate.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <span className="font-code-sm text-[8px] text-white/45 tracking-widest block font-bold uppercase">DOSSIER STATUS:</span>
                  <span
                    className={`px-3 py-1 rounded-full border text-[9px] font-label-caps font-black tracking-wider uppercase ${
                      previewCandidate.status === 'Approved'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.1)]'
                        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.1)]'
                    }`}
                  >
                    {previewCandidate.status || 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5 pt-6 border-t border-white/10">
              <button
                onClick={() => toggleStatus(previewCandidate)}
                className={`w-full sm:flex-1 font-bold py-3 px-6 rounded-full text-xs font-bold font-label-caps flex items-center justify-center gap-2 border transition-all duration-300 hover:scale-[1.01] ${
                  previewCandidate.status === 'Approved'
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 shadow-[0_0_20px_rgba(250,204,21,0.15)]'
                    : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 shadow-[0_0_20px_rgba(74,222,128,0.15)]'
                }`}
              >
                <span className="material-symbols-outlined text-sm font-bold">
                  {previewCandidate.status === 'Approved' ? 'history' : 'verified'}
                </span>
                <span>{previewCandidate.status === 'Approved' ? 'MARK PENDING' : 'APPROVE DOSSIER'}</span>
              </button>

              <button
                onClick={() => { handleDownload(previewCandidate); setPreviewCandidate(null); }}
                className="w-full sm:flex-1 bg-gradient-to-r from-[#a855f7] to-[#cf5cff] hover:opacity-90 text-white font-bold py-3 px-6 rounded-full text-xs font-bold font-label-caps flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] shadow-[0_0_25px_rgba(168,85,247,0.3)]"
              >
                <span className="material-symbols-outlined text-sm font-bold">download</span>
                <span>DOWNLOAD PHOTO</span>
              </button>

              <button
                onClick={() => { handleDelete(previewCandidate); setPreviewCandidate(null); }}
                className="w-full sm:w-auto bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 text-red-400 px-6 py-3 rounded-full text-xs font-bold font-label-caps flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01]"
              >
                <span className="material-symbols-outlined text-sm font-bold">delete</span>
                <span>DELETE DOSSIER</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Toast Notification */}
      {syncToastMessage && (
        <div className="fixed bottom-6 right-6 z-[250] stagger-in glass-panel p-4 rounded-xl border border-green-500/40 bg-black/90 backdrop-blur-md flex items-center gap-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-w-md">
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <h4 className="text-green-400 font-bold text-xs uppercase tracking-wider">Secure Dossier Registry</h4>
            <p className="text-xs text-on-surface-variant leading-snug">{syncToastMessage}</p>
          </div>
          <button 
            onClick={() => setSyncToastMessage(null)}
            className="text-on-surface-variant hover:text-white p-1 text-xs"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

    </main>
  );
};

export default IDCard;
