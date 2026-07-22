export const CONFIG = {
  // Deployed Google Apps Script Web App URL (Referrals):
  GOOGLE_SCRIPT_REFERRAL_URL: process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_REFERRAL_URL || "https://script.google.com/macros/s/AKfycbxuT5zFYuGtq82pThzfCpleVt_6aoLfA4zuaxHCqz6fGO7BLb4U3QIzxn46tz4Xyce9/exec",
  
  // ID Card Form Sheets Sync URL:
  GOOGLE_SCRIPT_ID_CARD_URL: process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_ID_CARD_URL || "https://script.google.com/macros/s/AKfycbz-TxnI2WRVEDRWXML_FDKp2FwxuXvSIYQ8lxg0DZlepEGkJoxtTl8nmMoLzlLH1FMt/exec",
  
  // Supabase Configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rpecopoisqjkrxwcccxc.supabase.co",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZWNvcG9pc3Fqa3J4d2NjY3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDgwMzUsImV4cCI6MjEwMDIyNDAzNX0.IjndZHhClKb8hpL-xnhhat99QUeC7gydZ5krcytUI80",

  // ID Card Form Whitelisted Admins
  ADMIN_EMAILS: [
    "parardha.24bcg10003@vitbhopal.ac.in",
    "haardik.24bcg10051@vitbhopal.ac.in",
    "rishav.24bsa10096@vitbhopal.ac.in",
    "abhinav.25bcy10254@vitbhopal.ac.in",
    "anmol.25bai10263@vitbhopal.ac.in",
    "jaiyansh.25bcy10268@vitbhopal.ac.in",
    "admin@vrgc.club",
    "alex.dev@gmail.com"
  ],

  // Live Firebase Production Configuration
  FIREBASE_CONFIG: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA9IuuKniQtjMLODY71YxqnQXsmtqvnGPI",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "vrgc-forms.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vrgc-forms",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "vrgc-forms.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "417600749438",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:417600749438:web:c95ec2840619d478d5bd2f",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-V40J7BPNEN"
  }
};
