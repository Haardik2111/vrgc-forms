"use client";

import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, isFirebaseConfigured } from '../lib/firebase';
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

interface SubmissionData {
  id?: string;
  name: string;
  registrationNumber: string;
  phone?: string;
  team?: string;
  position?: string;
  email: string;
  photoUrl: string;
  avatarUrl?: string;
  submittedAt: string;
  status: string;
}

const IDCard: React.FC<IDCardProps> = ({ onRedirect }) => {
  // Authentication & Member Data States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  // Tab selections
  const [activeSubTab, setActiveSubTab] = useState<'portal' | 'admin'>('portal');

  // Member Fields (fetched from members.csv)
  const [memberData, setMemberData] = useState<MemberData | null>(null);

  // Form Submission States
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [existingSubmission, setExistingSubmission] = useState<SubmissionData | null>(null);

  // Admin Candidates
  const [candidates, setCandidates] = useState<SubmissionData[]>([]);

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
          if (lines.length > 0) {
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
            }
          } else if (!isDemoUser) {
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
  }, [isDemoUser]);

  const checkExistingSubmission = async (email: string) => {
    try {
      if (!email || !db) return;
      const docRef = doc(db, 'id_cards', email.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setExistingSubmission(docSnap.data() as SubmissionData);
      } else {
        setExistingSubmission(null);
      }
    } catch (err) {
      console.error('Error checking existing submission:', err);
    }
  };

  // Google Login
  const handleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Firebase Login Error:', err);
      enableDemoMode();
    }
  };

  // Demo Mode Activator
  const enableDemoMode = () => {
    setIsDemoUser(true);
    const demoMember: MemberData = {
      name: 'Alex Rivera',
      registrationNumber: '24BCE10293',
      phone: '9876543210',
      email: 'alex.dev@gmail.com',
      team: 'Development',
      position: 'Core Member'
    };
    setMemberData(demoMember);
    setIsAuthorized(true);
    setIsAdmin(true);
    setAuthLoading(false);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Signout error:', err);
    }
    setIsDemoUser(false);
    setCurrentUser(null);
    setIsAuthorized(false);
    setMemberData(null);
    setExistingSubmission(null);
    setIsAdmin(false);
    setActiveSubTab('portal');
  };

  // File Upload Handlers
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
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
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Submit ID Card Details
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!photoFile && !photoPreview) {
      setSubmitError('Please upload an identification photo.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      let photoPublicUrl = photoPreview || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
      let avatarPublicUrl = avatarPreview || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80';

      const submissionData: SubmissionData = {
        name: memberData?.name || 'Alex Rivera',
        registrationNumber: memberData?.registrationNumber || '24BCE10293',
        phone: memberData?.phone || '9876543210',
        team: memberData?.team || 'Development',
        position: memberData?.position || 'Core Member',
        email: memberData?.email || currentUser?.email || 'alex.dev@gmail.com',
        photoUrl: photoPublicUrl,
        avatarUrl: avatarPublicUrl,
        submittedAt: new Date().toISOString(),
        status: 'Approved'
      };

      if (db) {
        try {
          await setDoc(doc(db, 'id_cards', submissionData.email.toLowerCase()), submissionData);
        } catch (err) {
          console.warn("Firestore setDoc fallback:", err);
        }
      }

      setExistingSubmission(submissionData);
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmitError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (candidate: SubmissionData) => {
    if (!candidate.photoUrl) return;

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
      window.open(candidate.photoUrl, '_blank');
    }
  };

  if (authLoading) {
    return (
      <main className="flex-grow min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-purple-400 animate-spin">
            sync
          </span>
          <p className="font-code-sm text-purple-400 tracking-widest text-sm">
            VALIDATING REGISTERED IDENTITY...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="flex-grow min-h-[85vh] flex items-center justify-center p-6 relative overflow-hidden bg-mesh">
        <div className="glass-panel p-8 md:p-12 rounded-2xl max-w-lg w-full text-center space-y-8 border border-purple-500/30 relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
          <div className="space-y-3">
            <span className="font-label-caps text-xs text-purple-400 tracking-widest block font-bold">
              IDENTITY CONFIRMATION
            </span>
            <h2 className="font-display-lg text-3xl md:text-4xl text-white font-extrabold tracking-tight uppercase">
              Member ID Portal
            </h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Please authenticate using your registered email address to access the digital ID Card System.
            </p>
          </div>

          {authError && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg text-xs font-code-sm">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-8 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined font-bold">login</span>
              <span>AUTHENTICATE WITH GOOGLE</span>
            </button>

            <button
              onClick={enableDemoMode}
              className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold py-3 px-6 rounded-full transition-all text-xs font-label-caps"
            >
              PREVIEW WITH DEMO ACCOUNT
            </button>
          </div>

          <button
            onClick={onRedirect}
            className="w-full bg-transparent border border-slate-700 text-slate-300 hover:bg-white/5 py-3.5 px-8 rounded-full transition-all flex items-center justify-center gap-2 text-xs font-bold font-label-caps"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>BACK TO DASHBOARD</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow min-h-screen relative overflow-hidden text-left bg-mesh p-4 md:p-8">
      <section className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-purple-500/10 pb-6">
          <div className="text-left">
            <span className="font-label-caps text-xs text-purple-400 tracking-widest block mb-2 font-bold">
              VRGC SECURE DOSSIER REGISTRY
            </span>
            <h2 className="font-display-lg text-3xl md:text-5xl text-white font-extrabold tracking-tight uppercase">
              ID CARD ISSUANCE
            </h2>
            <p className="text-slate-400 max-w-xl text-sm md:text-base leading-relaxed mt-2">
              Verify your candidate records and upload your profile photo to register your digital ID Card.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 self-start md:self-end">
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-full text-xs font-label-caps tracking-wider transition-all flex items-center gap-2 font-bold"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>LOGOUT</span>
            </button>
          </div>
        </header>

        {/* Tab Headers for Admin */}
        {isAdmin && (
          <div className="flex border-b border-purple-500/20">
            <button
              onClick={() => setActiveSubTab('portal')}
              className={`px-6 py-3 font-label-caps tracking-wider text-xs md:text-sm font-bold border-b-2 transition-all duration-300 ${
                activeSubTab === 'portal'
                  ? 'border-purple-500 text-purple-400 shadow-[0_4px_12px_rgba(168,85,247,0.2)]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              ID CARD PORTAL
            </button>
            <button
              onClick={() => setActiveSubTab('admin')}
              className={`px-6 py-3 font-label-caps tracking-wider text-xs md:text-sm font-bold border-b-2 transition-all duration-300 flex items-center gap-2 ${
                activeSubTab === 'admin'
                  ? 'border-red-500 text-red-400 shadow-[0_4px_12px_rgba(239,68,68,0.25)]'
                  : 'border-transparent text-red-400/80 hover:text-red-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              <span>ADMIN DASHBOARD</span>
            </button>
          </div>
        )}

        {/* PORTAL TAB */}
        {activeSubTab === 'portal' && (
          <div className="space-y-8">
            {existingSubmission ? (
              /* ONE-TIME SUBMISSION COMPLETED VIEW */
              <div className="flex flex-col items-center justify-center py-6 px-4 stagger-in space-y-6">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest font-code-sm">TAP CARD TO FLIP (3D PREVIEW)</span>

                {/* 3D Flip Card Container */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="relative w-full max-w-[340px] aspect-[2.2/3.4] cursor-pointer group [perspective:1000px]"
                >
                  <div className={`relative w-full h-full duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    
                    {/* FRONT OF THE ID CARD */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] select-none">
                      <div className="relative overflow-hidden w-full h-full rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(168,85,247,0.3)]">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40"></div>
                        
                        {/* Crop Marks */}
                        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-purple-500/50"></div>
                        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-purple-500/50"></div>
                        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-purple-500/50"></div>
                        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-purple-500/50"></div>

                        {/* Logo Header */}
                        <div className="border-b border-purple-500/30 pb-3 relative z-10 text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className="material-symbols-outlined text-base text-purple-400">sports_esports</span>
                            <h4 className="font-display-lg text-base text-white font-black tracking-widest leading-none">VRGC</h4>
                          </div>
                          <span className="text-purple-400/80 text-[6px] font-code-sm tracking-wider uppercase block mt-1 font-bold">VIRTUAL REALITY & GAMING CLUB</span>
                        </div>

                        {/* Portrait Frame */}
                        <div className="flex flex-col items-center justify-center my-2 relative z-10">
                          <div className="w-36 h-36 rounded-2xl border-2 border-purple-500/40 p-1 bg-black/50 shadow-[0_0_20px_rgba(168,85,247,0.2)] relative overflow-hidden">
                            <img 
                              src={existingSubmission.photoUrl} 
                              alt="Member Avatar" 
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <div className="absolute bottom-1.5 right-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase shadow">
                              VERIFIED
                            </div>
                          </div>
                        </div>

                        {/* Details Panel */}
                        <div className="bg-[#0b0512]/95 border border-purple-500/30 p-3 rounded-2xl relative z-10 space-y-2">
                          <div className="border-b border-white/10 pb-1 text-left">
                            <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">NAME</span>
                            <h3 className="font-display-lg text-sm text-white font-extrabold tracking-wide uppercase truncate leading-tight">
                              {existingSubmission.name}
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-left">
                            <div>
                              <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">REGISTRATION NO.</span>
                              <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block">
                                {existingSubmission.registrationNumber}
                              </span>
                            </div>
                            <div>
                              <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">TEAM</span>
                              <span className="font-code-sm text-[10px] text-white font-bold tracking-wider block uppercase truncate">
                                {existingSubmission.team || 'Development'}
                              </span>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-white/5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7] animate-pulse"></span>
                            <span className="font-code-sm text-[8px] text-purple-200 font-extrabold uppercase tracking-widest">
                              {existingSubmission.position || 'CORE MEMBER'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BACK OF THE ID CARD */}
                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] select-none">
                      <div className="relative overflow-hidden w-full h-full rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(168,85,247,0.3)]">
                        {existingSubmission.avatarUrl && (
                          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl opacity-75">
                            <img 
                              src={existingSubmission.avatarUrl} 
                              alt="Avatar Watermark" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-[#05010a]/50 bg-gradient-to-b from-transparent via-[#05010a]/60 to-[#05010a]"></div>
                          </div>
                        )}

                        <div className="text-center relative z-10 border-b border-purple-500/30 pb-2">
                          <h4 className="font-display-lg text-base text-white font-black tracking-widest uppercase">VRGC</h4>
                          <span className="font-code-sm text-[6px] text-purple-400 tracking-wider block font-bold mt-0.5">VIRTUAL REALITY & GAMING CLUB</span>
                        </div>

                        {/* Verification QR Code */}
                        <div className="my-2 flex flex-col items-center justify-center relative z-10">
                          <div className="w-28 h-28 rounded-xl border border-white/20 bg-white p-1.5 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=a855f7&bgcolor=ffffff&data=${encodeURIComponent(`https://vrgc.club/card/${existingSubmission.registrationNumber}`)}`} 
                              alt="Scan to Verify" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="font-code-sm text-[7px] text-purple-400 font-extrabold uppercase tracking-widest block mt-2">SCAN TO CONNECT</span>
                        </div>

                        {/* Social Handles */}
                        <div className="space-y-1.5 border-t border-purple-500/30 pt-2 relative z-10 text-[8px] font-code-sm text-slate-300 text-left pl-2">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[11px] text-purple-400">alternate_email</span>
                            <span>@vrgc_official</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[11px] text-purple-400">forum</span>
                            <span>discord.gg/vrgc</span>
                          </div>
                        </div>

                        <div className="text-center text-[7px] font-extrabold text-purple-300 tracking-widest mt-2 uppercase relative z-10">
                          PLAY • CREATE • INNOVATE
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => handleDownload(existingSubmission)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-purple-500/40 hover:border-purple-500 hover:text-white transition-all text-xs font-bold font-label-caps bg-black/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>DOWNLOAD ID PHOTO</span>
                  </button>
                </div>
              </div>
            ) : (
              /* FORM SUBMISSION VIEW */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start stagger-in">
                {/* Live Preview Card */}
                <div className="lg:col-span-5 flex flex-col items-center gap-4">
                  <div className="w-full flex justify-between items-center">
                    <h3 className="font-label-caps text-xs text-slate-400 tracking-wider font-bold">LIVE PREVIEW</h3>
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest font-code-sm">TAP CARD TO FLIP</span>
                  </div>
                  
                  <div 
                    onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                    className="relative w-full max-w-[320px] aspect-[2.2/3.4] cursor-pointer group [perspective:1000px]"
                  >
                    <div className={`relative w-full h-full duration-700 [transform-style:preserve-3d] ${isPreviewFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                      
                      {/* FRONT OF PREVIEW */}
                      <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] select-none">
                        <div className="relative overflow-hidden w-full h-full rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_40px_rgba(168,85,247,0.2)]">
                          <div className="border-b border-purple-500/30 pb-3 text-center">
                            <h4 className="font-display-lg text-base text-white font-black tracking-widest">VRGC</h4>
                            <span className="text-purple-400/80 text-[6px] font-code-sm tracking-wider uppercase block mt-0.5">VIRTUAL REALITY & GAMING CLUB</span>
                          </div>

                          <div className="flex flex-col items-center justify-center my-2">
                            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-purple-500/40 p-1 bg-black/40 flex items-center justify-center overflow-hidden">
                              {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <div className="text-center p-2 text-slate-500">
                                  <span className="material-symbols-outlined text-3xl text-purple-400">face</span>
                                  <p className="font-code-sm text-[8px] uppercase tracking-widest mt-1">UPLOAD PHOTO</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#0b0512]/90 border border-purple-500/30 p-3 rounded-2xl space-y-2 text-left">
                            <div>
                              <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">NAME</span>
                              <h3 className="font-display-lg text-xs text-white font-extrabold tracking-wide uppercase truncate">
                                {memberData?.name || 'MEMBER NAME'}
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">REGISTRATION</span>
                                <span className="font-code-sm text-[9px] text-white font-bold block">
                                  {memberData?.registrationNumber || '24BCEXXXX'}
                                </span>
                              </div>
                              <div>
                                <span className="font-code-sm text-[6px] text-purple-400 uppercase tracking-widest block font-bold">TEAM</span>
                                <span className="font-code-sm text-[9px] text-white font-bold block uppercase truncate">
                                  {memberData?.team || 'DEVELOPMENT'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BACK OF PREVIEW */}
                      <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] select-none">
                        <div className="relative overflow-hidden w-full h-full rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#12051e] via-[#05010a] to-[#0c0416] p-6 flex flex-col justify-between shadow-[0_0_40px_rgba(168,85,247,0.2)]">
                          {avatarPreview && (
                            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl opacity-75">
                              <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-[#05010a]/50"></div>
                            </div>
                          )}

                          <div className="text-center relative z-10 border-b border-purple-500/30 pb-2">
                            <h4 className="font-display-lg text-base text-white font-black tracking-widest">VRGC</h4>
                          </div>

                          <div className="my-2 flex flex-col items-center justify-center relative z-10">
                            <div className="w-24 h-24 rounded-xl bg-white p-1">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=a855f7&bgcolor=ffffff&data=${encodeURIComponent(`https://vrgc.club/card/${memberData?.registrationNumber || '24BCE00000'}`)}`} 
                                alt="QR Code" 
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </div>

                          <div className="text-center text-[7px] font-extrabold text-purple-300 tracking-widest uppercase relative z-10">
                            PLAY • CREATE • INNOVATE
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Registration Form */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="glass-panel p-8 rounded-2xl border border-purple-500/30 space-y-6 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                    <div className="border-b border-white/10 pb-4">
                      <h3 className="text-xl font-bold text-white uppercase">CANDIDATE DOSSIER DETAILS</h3>
                      <p className="text-xs text-slate-400 mt-1">Review fetched registration records and upload high-res images.</p>
                    </div>

                    {submitError && (
                      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs">
                        {submitError}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Full Name</label>
                          <input
                            type="text"
                            disabled
                            value={memberData?.name || ''}
                            className="w-full bg-black/60 border border-purple-500/20 text-slate-300 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Registration Number</label>
                          <input
                            type="text"
                            disabled
                            value={memberData?.registrationNumber || ''}
                            className="w-full bg-black/60 border border-purple-500/20 text-slate-300 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Team / Division</label>
                          <input
                            type="text"
                            disabled
                            value={memberData?.team || ''}
                            className="w-full bg-black/60 border border-purple-500/20 text-slate-300 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Position</label>
                          <input
                            type="text"
                            disabled
                            value={memberData?.position || ''}
                            className="w-full bg-black/60 border border-purple-500/20 text-slate-300 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* File Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                            1. Profile Identification Photo *
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                            2. Gaming Avatar Image *
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-6 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2 mt-4"
                      >
                        <span className="material-symbols-outlined">badge</span>
                        <span>{isSubmitting ? 'GENERATING ID CARD...' : 'GENERATE DIGITAL ID CARD'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </section>
    </main>
  );
};

export default IDCard;
