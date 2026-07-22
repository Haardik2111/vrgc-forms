import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VRGC | Elite Member Portal & Digital ID Dossier",
  description: "Virtual Reality & Gaming Club Direct Access Command Center and Digital ID Card System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
        />
      </head>
      <body className="bg-[#05010a] text-[#e2e8f0] antialiased min-h-screen selection:bg-purple-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
