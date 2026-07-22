<div align="center">

# 🎮 VRGC Forms & Member Dossier Portal
### Virtual Reality & Gaming Club • Official Candidate Referral & ID Card System

[![Next.js](https://img.shields.io/badge/Next.js-16.2.11-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Media_Storage-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Production-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Build Status](https://img.shields.io/badge/Build-Passing-10B981?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

<br/>

*An interactive, high-performance web platform built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Firebase**, and **Supabase** for candidate referral management, digital identity issuance, and real-time administrative scoring.*

</div>

---

## 📌 Table of Contents

- [🌟 Features](#-features)
  - [1. Candidate Referral System & Recruiter Leaderboard](#1-candidate-referral-system--recruiter-leaderboard)
  - [2. Digital ID Card Issuance & 3D Interactive Flip Preview](#2-digital-id-card-issuance--3d-interactive-flip-preview)
  - [3. Master Admin Control Panel](#3-master-admin-control-panel)
  - [4. Data Correction & Mismatch Reporting](#4-data-correction--mismatch-reporting)
- [📂 Project Architecture](#-project-architecture)
- [⚙️ Tech Stack & Dependencies](#%EF%B8%8F-tech-stack--dependencies)
- [🚀 Local Development Setup](#-local-development-setup)
- [☁️ Cloud & Production Deployment Guide](#%EF%B8%8F-cloud--production-deployment-guide)
  - [Firebase Console Domain Setup](#firebase-console-domain-setup)
  - [Supabase Storage Bucket Setup](#supabase-storage-bucket-setup)
  - [Vercel One-Click Deploy](#vercel-one-click-deploy)
- [🤝 Contributing & Support](#-contributing--support)

---

## 🌟 Features

### 1. Candidate Referral System & Recruiter Leaderboard
- **Google Verified Identity Security**: Automated check against `members.csv` to ensure referrals originate from authorized active club members.
- **Member HUD Perks Panel**: Displays real-time referrer statistics, XP points, leaderboard ranks, and recruitment guidelines.
- **Disciplinary Guardrails**: Clear warnings preventing false entries, protecting club operation rules.

### 2. Digital ID Card Issuance & 3D Interactive Flip Preview
- **Interactive 3D Cyberpunk Badge**: 
  - **Front**: Holographic `VERIFIED` watermark badge, tech grid overlays, corner crop marks, official VRGC branding, member photo, registration number, assigned team, and role badge (`CORE MEMBER` / `LEAD`).
  - **Back**: Custom Gaming Avatar background watermark, dynamic QR code (`api.qrserver.com`), official social handles (`@vrgc_official`, `discord.gg/vrgc`), and motto `PLAY • CREATE • INNOVATE`.
- **Dual Supabase Storage**: Passport photos & gaming avatars are uploaded to Supabase Storage (`id-cards/id-photos/`).
- **Direct High-Res Downloads**: Instant one-click file download buttons for member photos & avatars.

### 3. Master Admin Control Panel
- **Whitelisted Admin Access**: Governed by `admins.csv` permissions.
- **Search & Filter Suite**: Filter candidate dossiers by query string (`Candidate Name`, `Registration Number`, `Email`, `Phone`, `Referrer`) or team dropdowns (`Design`, `Education`, `Esports`, `PR`, `Social Media`, `Technical`, `Management`).
- **Candidate Dossier Inspector**: Modal popups to review full candidate details, update status (`Pending`, `In Process`, `Invited to Interview`, `Interview Taken`, `Admitted`, `Rejected`), or delete entries.
- **Google Sheets Parallel Force Sync**: One-click parallel sync trigger transmitting records to Google Sheets web app scripts.

### 4. Data Correction & Mismatch Reporting
- Built-in report modal allowing members to log data correction tickets directly to the `data_reports` Firestore collection.

---

## 📂 Project Architecture

```bash
vrgc-forms/
├── public/
│   ├── admins.csv             # Whitelisted admin account emails
│   ├── members.csv            # Official VRGC member lookup database
│   └── vrgc-logo.png          # High-resolution VRGC logo graphic
├── src/
│   ├── app/
│   │   ├── card/[regNo]/      # Dynamic digital ID card public route
│   │   │   └── page.tsx       # Dynamic card page unwrapping regNo params
│   │   ├── favicon.ico
│   │   ├── globals.css        # Design tokens, Google Fonts, glassmorphism utilities
│   │   ├── layout.tsx         # Root HTML structure & font providers
│   │   └── page.tsx           # Main application router container
│   ├── components/
│   │   ├── IDCard.tsx         # Digital ID Card registration, 3D flip preview & admin panel
│   │   ├── Referrals.tsx      # Candidate referral form, recruiter leaderboard & control panel
│   │   └── Sidebar.tsx        # Responsive navigation sidebar matching VRGC theme
│   └── lib/
│       ├── config.ts          # Centralized environment & Apps Script configuration
│       ├── firebase.ts        # Firebase Auth & Firestore client SDK initialization
│       └── supabase.ts        # Supabase Storage client initialization
├── .gitignore
├── next.config.ts             # Next.js App Router build configuration
├── package.json               # Package dependencies & scripts
├── README.md                  # Project documentation & Shields.io badges
└── tsconfig.json              # TypeScript compiler settings
```

---

## ⚙️ Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 16.2.11 (App Router + Turbopack) |
| **UI Library** | React 19.0.0 |
| **Language** | TypeScript 5.0 |
| **Styling** | Tailwind CSS 4.0 + Vanilla CSS Glassmorphism |
| **Icons & Typography** | Google Material Symbols + Sora + Hanken Grotesk + JetBrains Mono |
| **Database** | Firebase Cloud Firestore |
| **Auth Provider** | Firebase Google Authentication |
| **Media Bucket** | Supabase Storage (`id-cards`) |
| **Hosting Platform** | Vercel Deployment Engine |

---

## 🚀 Local Development Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/vrgc-forms.git
cd vrgc-forms
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Verify Production Build

```bash
npm run build
npm run start
```

---

## ☁️ Cloud & Production Deployment Guide

### Firebase Console Domain Setup
When deploying to Vercel (e.g. `vrgc-forms.vercel.app`), Firebase Google Auth popup requires adding your domain:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select project **`vrgc-forms`** → **Authentication** → **Settings** tab.
3. Select **Authorized domains** → Click **Add domain**.
4. Enter your Vercel deployment URL (e.g., `vrgc-forms.vercel.app`).

### Supabase Storage Bucket Setup
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Storage** → Create a public bucket named **`id-cards`**.
3. Ensure public read policy is enabled for `id-photos/*`.

### Vercel One-Click Deploy
1. Push your repository to GitHub.
2. Import repository into [Vercel](https://vercel.com/new).
3. Select **Next.js** framework preset and click **Deploy**.

---

## 🤝 Contributing & Support

Contributions, issues, and feature requests are welcome!  
Feel free to check out the [issues page](https://github.com/your-org/vrgc-forms/issues).

<div align="center">

Designed and developed with ❤️ for **Virtual Reality & Gaming Club (VRGC)**.

</div>
