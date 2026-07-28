"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Code2, Sparkles, ShieldCheck, Terminal, Cpu, Heart, 
  ExternalLink, Crown, Award, UserCheck, Star, ArrowLeft, 
  CheckCircle2, Layers, Zap 
} from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface TeamMember {
  name: string;
  role: string;
  rank: number;
  regNo?: string;
  email?: string;
  position?: string;
  team?: string;
  avatarUrl?: string;
}

const TECH_TEAM_LIST: TeamMember[] = [
  {
    name: "Rishav Mandal",
    role: "Technical Lead",
    rank: 1,
    regNo: "24BSA10096",
  },
  {
    name: "Abhinav Mishra",
    role: "Technical Co-Lead",
    rank: 2,
    regNo: "25BCY10254",
  },
  {
    name: "Jaiyansh Dhaulakhandi",
    role: "Core Technical Member",
    rank: 3,
  },
  {
    name: "Anmol Shrivastava",
    role: "Core Technical Member",
    rank: 4,
  },
  {
    name: "Mohit Borekar",
    role: "Core Technical Member",
    rank: 5,
  },
];

export default function AboutPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(TECH_TEAM_LIST);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      try {
        const updatedList = await Promise.all(
          TECH_TEAM_LIST.map(async (m) => {
            let firestoreData: any = null;

            try {
              const idCardsQuery = query(collection(db, 'id_cards'));
              const idCardsSnap = await getDocs(idCardsQuery);
              idCardsSnap.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.name && data.name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])) {
                  firestoreData = data;
                }
              });

              if (!firestoreData) {
                const membersQuery = query(collection(db, 'members'));
                const membersSnap = await getDocs(membersQuery);
                membersSnap.forEach((docSnap) => {
                  const data = docSnap.data();
                  if (data.name && data.name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])) {
                    firestoreData = data;
                  }
                });
              }
            } catch (err) {
              console.warn(`Firestore lookup for ${m.name} fallback:`, err);
            }

            return {
              ...m,
              regNo: firestoreData?.registrationNumber || firestoreData?.regNo || m.regNo || '',
              email: firestoreData?.email || m.email || '',
              position: m.role,
              team: firestoreData?.team || 'Technical Team',
              avatarUrl: firestoreData?.photoUrl || firestoreData?.avatarUrl || `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(m.name)}`,
            };
          })
        );
        setTeamMembers(updatedList);
      } catch (e) {
        console.error('Failed to fetch tech team details:', e);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMemberDetails();
  }, []);

  return (
    <div className="min-h-screen bg-[#070212] text-white flex flex-col selection:bg-purple-500 selection:text-white">
      {/* Background Decorative Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-purple-900/20 blur-[120px] pointer-events-none -z-10" />

      {/* Navigation Bar */}
      <Navbar pageTitle="About VRGC Tech Team" />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12">

        {/* Hero Banner Header */}
        <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-purple-950/40 via-[#0d071e] to-pink-950/30 border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden md:block">
            <Code2 className="w-64 h-64 text-purple-400" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 text-xs font-bold border border-white/10 transition-all mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Command Center</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Official Technical Division</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-purple-400 tracking-tight">
              VRGC Technical Team
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Engineering the digital infrastructure for the <strong className="text-purple-300">Virtual Reality & Gaming Club (VRGC)</strong> at VIT Bhopal. Built from the ground up to streamline student registrations, digital member passes, financial audits, and technical operations.
            </p>
          </div>
        </div>

        {/* Team Roster Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Technical Leadership & Core Roster</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">Ranked by role preference and technical responsibilities</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-bold hidden sm:block">
              {teamMembers.length} Core Members
            </span>
          </div>

          {/* Roster Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {teamMembers.map((member) => {
              const isLead = member.rank === 1;
              const isCoLead = member.rank === 2;

              return (
                <div
                  key={member.name}
                  className={`relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between gap-4 ${
                    isLead 
                      ? 'bg-gradient-to-br from-amber-500/10 via-purple-950/40 to-pink-950/20 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.12)]' 
                      : isCoLead
                      ? 'bg-gradient-to-br from-purple-950/50 via-[#0d071e] to-pink-950/30 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                      : 'bg-white/5 border-white/10 hover:border-purple-500/30'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      {/* Rank Badge */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-md ${
                        isLead 
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' 
                          : isCoLead
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                          : 'bg-white/10 text-slate-300'
                      }`}>
                        {isLead ? <Crown className="w-4 h-4 fill-black" /> : `#${member.rank}`}
                      </div>

                      {/* Status Tag */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                        isLead 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isCoLead
                          ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700'
                      }`}>
                        {isLead ? <Award className="w-3 h-3 text-amber-400" /> : <UserCheck className="w-3 h-3 text-purple-400" />}
                        <span>{isLead ? 'Technical Lead' : isCoLead ? 'Technical Co-Lead' : 'Core Member'}</span>
                      </span>
                    </div>

                    {/* Member Details */}
                    <div className="flex items-center gap-3.5 pt-1">
                      <img 
                        src={member.avatarUrl || `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(member.name)}`} 
                        alt={member.name}
                        className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 object-cover shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-base text-white">{member.name}</h3>
                          {isLead && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                        </div>
                        <p className="text-xs text-purple-300 font-semibold">{member.role}</p>
                        {member.regNo && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {member.regNo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Team Tag */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Division</span>
                    <strong className="text-purple-200 font-semibold">{member.team || 'Technical Team'}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Technical Architecture & Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-base">
              <Terminal className="w-5 h-5" />
              <span>Full-Stack Platform</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Custom built with Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS for max performance and seamless UX.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-pink-400 font-bold text-base">
              <ShieldCheck className="w-5 h-5" />
              <span>Cloud Realtime DB</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Powered by Firebase Firestore real-time subscriptions and Supabase cloud storage for secure member passes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
              <Zap className="w-5 h-5" />
              <span>Automated Workflows</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automated invoice expiration timers, Formspree support tickets, and HMAC-verified payment verification pipelines.
            </p>
          </div>
        </section>

        {/* Tech Stack Pills */}
        <section className="p-6 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Technologies & Frameworks Used</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Next.js 15', 'React 19', 'TypeScript', 'Firebase Firestore', 'Supabase Storage', 'Formspree API', 'Tailwind CSS', 'Razorpay SDK'].map((tech) => (
              <span key={tech} className="px-3 py-1.5 rounded-xl bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs font-semibold">
                {tech}
              </span>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
