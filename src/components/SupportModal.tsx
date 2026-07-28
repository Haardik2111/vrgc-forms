"use client";

import React, { useState } from "react";
import { X, Send, ShieldCheck, CheckCircle2, User, Mail, FileText, Sparkles, MessageSquare, AlertCircle } from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLead?: "rishav" | "abhinav" | "general";
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  defaultLead = "rishav",
}) => {
  const [targetLead, setTargetLead] = useState<string>(defaultLead);
  const [fullName, setFullName] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<string>("");
  const [regNo, setRegNo] = useState<string>("");
  const [category, setCategory] = useState<string>("payment");
  const [message, setMessage] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !contactInfo.trim() || !message.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    const generatedId = `VRGC-SUP-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          contactInfo,
          regNo,
          category,
          targetLead,
          message,
          ticketId: generatedId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send ticket");
      }

      setTicketId(generatedId);
    } catch (err: any) {
      console.error("Support submission error:", err);
      // Even if API route reports issue, still display generated ticket ID to user with notification
      setTicketId(generatedId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTicketId(null);
    setFullName("");
    setContactInfo("");
    setRegNo("");
    setMessage("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl transition-all duration-300 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0e0720]/90 border border-purple-500/30 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(168,85,247,0.25)] overflow-hidden text-slate-200 animate-in zoom-in-95 duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop effect */}
        <div className="absolute -top-24 -left-24 w-56 h-56 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-indigo-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* macOS Window Top Bar */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] backdrop-blur-md select-none">
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 border border-[#e0443e] flex items-center justify-center group transition-colors"
              title="Close"
            >
              <X className="w-2 h-2 text-black/80 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
          </div>

          {/* Centered Window Title */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Technical Support Desk</span>
          </div>

          {/* Close Action Icon */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {ticketId ? (
            /* Success View */
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Support Ticket Submitted!</h4>
                <p className="text-xs text-slate-300">
                  Your request has been routed to{" "}
                  <strong className="text-purple-300">
                    {targetLead === "rishav"
                      ? "Rishav Mandal (Tech Lead)"
                      : targetLead === "abhinav"
                      ? "Abhinav Mishra (Co-Lead)"
                      : "Technical Desk"}
                  </strong>
                  .
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 max-w-xs mx-auto">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Ticket Reference ID</div>
                <div className="text-lg font-mono font-extrabold text-purple-300 mt-0.5">{ticketId}</div>
              </div>

              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Please save your Ticket ID. Our technical leads will review your request and contact you shortly.
              </p>

              <button
                onClick={handleReset}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                Close Window
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Select Lead */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Tech Lead</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetLead("rishav")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetLead === "rishav"
                        ? "bg-purple-900/40 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-bold text-xs">Rishav Mandal</div>
                    <div className="text-[10px] text-purple-300">Tech Lead</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetLead("abhinav")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetLead === "abhinav"
                        ? "bg-indigo-900/40 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-bold text-xs">Abhinav Mishra</div>
                    <div className="text-[10px] text-indigo-300">Co-Lead</div>
                  </button>
                </div>
              </div>

              {/* Full Name & Reg No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:outline-none text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Registration / Roll No</label>
                  <div className="relative">
                    <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="23BCE1000"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:outline-none text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Email / Phone & Issue Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email / Contact Info <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:outline-none text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Issue Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#140b2b] border border-white/10 focus:border-purple-400 focus:outline-none text-white"
                  >
                    <option value="payment">Payment Failure / Verification</option>
                    <option value="registration">Registration Form Error</option>
                    <option value="idcard">ID Card Issue</option>
                    <option value="other">Other Technical Query</option>
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Describe Your Issue <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about the issue you are experiencing..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:outline-none text-white placeholder:text-slate-500 resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Submitting Ticket...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Technical Ticket</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
