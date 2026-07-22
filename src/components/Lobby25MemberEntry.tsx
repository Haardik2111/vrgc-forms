"use client";

import React, { useState } from 'react';
import { CONFIG } from '../lib/config';

interface Lobby25Props {
  onRedirect?: () => void;
}

const Lobby25MemberEntry: React.FC<Lobby25Props> = ({ onRedirect }) => {
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [role, setRole] = useState('Social Media');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !registrationNumber.trim() || !email.trim() || !phone.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      formType: 'batch_members',
      lobbyType: 'Lobby25Regn',
      members: [
        {
          name,
          registrationNumber,
          role,
          email,
          phone,
        }
      ],
    };

    const handleSuccess = () => {
      setIsSubmitting(false);
      setShowThankYou(true);
      setTimeout(() => {
        if (onRedirect) onRedirect();
      }, 1200);
    };

    if (!CONFIG.GOOGLE_SCRIPT_REFERRAL_URL) {
      setTimeout(() => {
        handleSuccess();
      }, 400);
      return;
    }

    try {
      await fetch(CONFIG.GOOGLE_SCRIPT_REFERRAL_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      handleSuccess();
    } catch (error) {
      console.error('Error submitting entry', error);
      setIsSubmitting(false);
      alert('Submission failed. Check your network status and Web App configurations.');
    }
  };

  if (showThankYou) {
    return (
      <main className="flex-grow min-h-[70vh] flex items-center justify-center relative overflow-hidden bg-mesh">
        <div className="glass-panel p-12 rounded-2xl max-w-md text-center space-y-6 border border-purple-500/20 relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.15)] stagger-in">
          <span className="material-symbols-outlined text-[80px] text-purple-400 animate-pulse">
            check_circle
          </span>
          <h2 className="font-display-lg text-3xl text-white font-extrabold">THANK YOU</h2>
          <p className="font-body-lg text-slate-400">
            Lobby 25 candidate details have been successfully transmitted to the club database.
          </p>
          <div className="pt-4 flex items-center justify-center gap-2 text-purple-400 font-label-caps text-xs">
            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            <span>REDIRECTING TO COMMAND CENTER...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow min-h-screen relative overflow-hidden bg-mesh text-left">
      <section className="max-w-3xl mx-auto px-4 py-12 md:py-24">
        {/* Header Section */}
        <header className="mb-12 stagger-in">
          <h2 className="font-display-lg text-3xl md:text-5xl mb-4 text-white font-extrabold uppercase">
            Batch Member Entry (Lobby 25)
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Register the next generation of prospective members. Please provide the operational identity for the candidate in Lobby 25.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-grow bg-purple-500/20"></div>
            <span className="font-code-sm text-purple-400 tracking-widest text-xs font-bold">LOBBY 25 SINGLE ENTRY</span>
            <div className="h-px flex-grow bg-purple-500/20"></div>
          </div>
        </header>

        {/* Tally-Inspired Form Body */}
        <form className="glass-panel p-8 md:p-12 rounded-2xl space-y-12 relative overflow-hidden stagger-in border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.1)]" onSubmit={handleSubmit}>
          <div className="space-y-10 relative z-10">
            {/* Full Name */}
            <div className="relative">
              <label className="block font-label-caps text-xs text-purple-300 font-bold mb-3 tracking-widest">
                FULL NAME *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-t-0 border-x-0 border-b-2 border-purple-500/30 py-3 text-xl text-white placeholder:text-slate-600 focus:border-purple-500 focus:outline-none transition-all"
                placeholder="Enter legal identity..."
                type="text"
              />
            </div>

            {/* Registration Number & Team Preference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <label className="block font-label-caps text-xs text-purple-300 font-bold mb-3 tracking-widest">
                  REGISTRATION NUMBER *
                </label>
                <input
                  required
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-t-0 border-x-0 border-b-2 border-purple-500/30 py-3 text-lg font-code-sm text-purple-300 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none transition-all uppercase"
                  placeholder="24XXXXXX"
                  type="text"
                />
              </div>
              <div className="relative">
                <label className="block font-label-caps text-xs text-purple-300 font-bold mb-3 tracking-widest">
                  TEAM PREFERENCE *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0e0518] border-t-0 border-x-0 border-b-2 border-purple-500/30 py-3 text-base text-white focus:border-purple-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="Social Media">Social Media</option>
                  <option value="Technical Team">Technical Team</option>
                  <option value="Design Team">Design Team</option>
                  <option value="PR">PR</option>
                  <option value="Esports">Esports</option>
                  <option value="Education">Education</option>
                </select>
              </div>
            </div>

            {/* Contact Email & Phone Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <label className="block font-label-caps text-xs text-purple-300 font-bold mb-3 tracking-widest">
                  CONTACT EMAIL *
                </label>
                <input
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-t-0 border-x-0 border-b-2 border-purple-500/30 py-3 text-base font-code-sm text-white placeholder:text-slate-600 focus:border-purple-500 focus:outline-none transition-all"
                  placeholder="name.24xx@vitbhopal.ac.in"
                  type="email"
                />
              </div>
              <div className="relative">
                <label className="block font-label-caps text-xs text-purple-300 font-bold mb-3 tracking-widest">
                  PHONE NUMBER *
                </label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  className="w-full bg-transparent border-t-0 border-x-0 border-b-2 border-purple-500/30 py-3 text-base font-code-sm text-white placeholder:text-slate-600 focus:border-purple-500 focus:outline-none transition-all"
                  placeholder="9830XXXXXX"
                  type="tel"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col items-center pt-6 border-t border-purple-500/20 relative z-10">
            <button
              disabled={isSubmitting}
              className="w-full md:w-auto min-w-[240px] bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-10 rounded-full text-sm shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span> Submitting...
                </>
              ) : (
                'SUBMIT LOBBY 25 DOSSIER'
              )}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default Lobby25MemberEntry;
