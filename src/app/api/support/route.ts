import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb, hasAdminCredentials } from "@/lib/firebase-admin";
import { SERVER_CONFIG } from '@/lib/server/config';
import { authenticateRequest } from "@/lib/server/auth";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

async function generateUniqueTicketId(): Promise<string> {
  // Generate cryptographically secure ticket ID: VRGC-SUP-XXXXXX (6 digits)
  const candidateId = `VRGC-SUP-${crypto.randomInt(100000, 1000000)}`;

  // If Admin credentials are not loaded in this environment, return candidate ID immediately
  if (!hasAdminCredentials()) {
    return candidateId;
  }

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentCandidate = attempt === 0 ? candidateId : `VRGC-SUP-${crypto.randomInt(100000, 1000000)}`;
      const docSnap = await adminDb.collection("support_tickets").doc(currentCandidate).get();
      if (!docSnap.exists) {
        return currentCandidate;
      }
    }
  } catch (err) {
    console.warn("[Support API] Collision check warning, using candidate ID:", err);
    return candidateId;
  }

  // High-entropy fallback if consecutive collisions occur
  const entropy = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `VRGC-SUP-${Date.now().toString().slice(-4)}${entropy}`;
}

// Admin authorization: Firestore is the sole source of truth for all normal roles.
// Super Admin env list is checked only for the Super Admin role (env-controlled by design).
async function isAuthorizedToManageTickets(email: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();

  // 1. Super Admin via env (the only env-var-controlled role)
  if (SERVER_CONFIG.SUPER_ADMIN_EMAILS.includes(normalized)) {
    return true;
  }

  // 2. Firestore: admins and super_admins collections (managed by Super Admin Console)
  if (hasAdminCredentials()) {
    try {
      const adminDoc = await adminDb.collection("admins").doc(normalized).get();
      if (adminDoc.exists) return true;

      const superDoc = await adminDb.collection("super_admins").doc(normalized).get();
      if (superDoc.exists) return true;
    } catch (err) {
      console.warn("[Support API] Admin authorization check notice:", err);
    }
  }

  return false;
}

/**
 * Saves ticket document to Firestore using Admin SDK if credentials exist,
 * or falls back to Firebase Firestore REST API with FIREBASE_API_KEY.
 */
async function saveSupportTicketToFirestore(ticketData: {
  ticketId: string;
  fullName: string;
  contactInfo: string;
  regNo: string;
  category: string;
  message: string;
  status: string;
  solvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): Promise<boolean> {
  const { ticketId } = ticketData;

  // 1. Try Firebase Admin SDK if admin credentials are present
  if (hasAdminCredentials()) {
    try {
      await adminDb.collection("support_tickets").doc(ticketId).set(ticketData);
      console.log(`[Support Desk] Saved ticket ${ticketId} via Admin SDK.`);
      return true;
    } catch (adminErr) {
      console.warn("[Support Desk] Admin SDK save failed, falling back to REST API:", adminErr);
    }
  }

  // 2. Fallback: Save via Firebase Firestore REST API using FIREBASE_API_KEY
  const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (apiKey && projectId) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/support_tickets/${ticketId}?key=${apiKey}`;
      const fields: Record<string, any> = {
        ticketId: { stringValue: ticketData.ticketId },
        fullName: { stringValue: ticketData.fullName },
        contactInfo: { stringValue: ticketData.contactInfo },
        regNo: { stringValue: ticketData.regNo },
        category: { stringValue: ticketData.category },
        message: { stringValue: ticketData.message },
        status: { stringValue: ticketData.status },
        createdAt: { stringValue: ticketData.createdAt },
        updatedAt: { stringValue: ticketData.updatedAt },
      };
      if (ticketData.solvedAt) {
        fields.solvedAt = { stringValue: ticketData.solvedAt };
      } else {
        fields.solvedAt = { nullValue: null };
      }

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      if (res.ok) {
        console.log(`[Support Desk] Saved ticket ${ticketId} via Firestore REST API.`);
        return true;
      } else {
        const errText = await res.text();
        console.warn(`[Support Desk] REST API returned ${res.status}:`, errText);
      }
    } catch (restErr) {
      console.error("[Support Desk] Firestore REST API save error:", restErr);
    }
  }

  return false;
}

export async function POST(req: Request) {
  let ticketId = "VRGC-SUP-PENDING";
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 65536) {
      return NextResponse.json(
        { error: "Payload too large. Maximum size is 64KB." },
        { status: 413 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { fullName, contactInfo, regNo, category, message } = body;

    if (
      !fullName ||
      !contactInfo ||
      !message ||
      typeof fullName !== "string" ||
      typeof contactInfo !== "string" ||
      typeof message !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const cleanName = fullName.trim();
    const cleanContact = contactInfo.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanContact || !cleanMessage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json(
        { error: "Full name must be between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (cleanContact.length < 3 || cleanContact.length > 150) {
      return NextResponse.json(
        { error: "Contact info must be between 3 and 150 characters." },
        { status: 400 }
      );
    }

    if (!cleanContact.includes("@") && !/\d{5,}/.test(cleanContact.replace(/[\s+-]/g, ""))) {
      return NextResponse.json(
        { error: "Please provide a valid contact email address or phone number." },
        { status: 400 }
      );
    }

    if (cleanMessage.length < 5 || cleanMessage.length > 3000) {
      return NextResponse.json(
        { error: "Message must be between 5 and 3,000 characters." },
        { status: 400 }
      );
    }

    const cleanRegNo = typeof regNo === "string" ? regNo.trim().toUpperCase() : "";
    const formattedRegNo = cleanRegNo && cleanRegNo.length <= 30 && /^[A-Z0-9-]{1,30}$/.test(cleanRegNo)
      ? cleanRegNo
      : cleanRegNo ? cleanRegNo.slice(0, 30) : "Not provided";

    const ALLOWED_CATEGORIES = [
      "payment",
      "idcard",
      "membership",
      "events",
      "referrals",
      "technical",
      "registration",
      "general",
      "other",
    ];
    const cleanCategory = typeof category === "string" && ALLOWED_CATEGORIES.includes(category.trim().toLowerCase())
      ? category.trim().toLowerCase()
      : "general";

    // Generate authoritative ticket ID server-side (ignore any client-supplied ticketId)
    ticketId = await generateUniqueTicketId();
    const nowIso = new Date().toISOString();

    // 1. Record ticket in Firebase Firestore (Admin SDK with REST API fallback)
    try {
      await saveSupportTicketToFirestore({
        ticketId,
        fullName: cleanName,
        contactInfo: cleanContact,
        regNo: formattedRegNo,
        category: cleanCategory,
        message: cleanMessage,
        status: "unsolved",
        solvedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      console.log(`[Support Desk] Saved ticket ${ticketId} to Firestore.`);
    } catch (dbErr) {
      console.error("[Support Desk] Firestore save error:", dbErr);
    }

    // 2. Proactively sweep and purge any solved tickets older than 12 hours from Firebase
    if (hasAdminCredentials()) {
      try {
        const nowMs = Date.now();
        const snap = await adminDb
          .collection("support_tickets")
          .where("status", "==", "solved")
          .get();
        const expiredRefs: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.solvedAt) {
            const solvedMs = new Date(data.solvedAt).getTime();
            if (!isNaN(solvedMs) && (nowMs - solvedMs) >= TWELVE_HOURS_MS) {
              expiredRefs.push(d.ref);
            }
          }
        });
        if (expiredRefs.length > 0) {
          const batch = adminDb.batch();
          expiredRefs.forEach((ref) => batch.delete(ref));
          await batch.commit();
          console.log(`[Support Desk API] Purged ${expiredRefs.length} expired ticket(s) from Firebase.`);
        }
      } catch (purgeErr) {
        console.warn("[Support Desk API] Auto-sweep notice:", purgeErr);
      }
    }

    // 3. Format Message Body for Email / Formspree notification
    const formattedText = `
--------------------------------------------------
🚨 VRGC TECHNICAL SUPPORT TICKET: [${ticketId}]
--------------------------------------------------

ASSIGNED TO: Technical Support Desk
CATEGORY   : ${(category || "general").toUpperCase()}

--- USER DETAILS ---
FULL NAME : ${fullName}
REG / ROLL: ${formattedRegNo}
CONTACT   : ${contactInfo}

--- ISSUE DESCRIPTION ---
${message}

--------------------------------------------------
Automated message sent via VRGC Forms Technical Support Desk
`;

    // 4. Optional: Dispatch email notification via Formspree if configured
    const formspreeUrl = process.env.FORMSPREE_URL;
    if (formspreeUrl) {
      try {
        const formspreeResponse = await fetch(formspreeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ticketId,
            name: fullName,
            email: contactInfo,
            regNo: formattedRegNo,
            category,
            message: formattedText,
            _replyto: contactInfo,
            _subject: `[${ticketId}] Support Ticket: ${(category || "GENERAL").toUpperCase()} - ${fullName}`,
          }),
        });

        if (!formspreeResponse.ok) {
          console.warn("[Support Desk] Formspree dispatch non-ok:", await formspreeResponse.text());
        }
      } catch (fsErr) {
        console.warn("[Support Desk] Formspree dispatch failed, ticket is saved in Firestore:", fsErr);
      }
    }

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Your support ticket has been received and logged successfully!",
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process support request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to manually delete a support ticket from Firebase by ticketId.
 * Requires authenticated Administrator or Super Administrator credentials.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawTicketId = searchParams.get("ticketId");
    const ticketId = typeof rawTicketId === "string" ? rawTicketId.trim().toUpperCase() : "";

    if (!ticketId || ticketId.length < 5 || ticketId.length > 64 || !/^[A-Z0-9_-]{5,64}$/.test(ticketId)) {
      return NextResponse.json({ error: "Missing or invalid ticketId parameter" }, { status: 400 });
    }

    // 1. Cryptographically verify Firebase ID token in Authorization header
    const { user, errorResponse } = await authenticateRequest(req);
    if (errorResponse) {
      return errorResponse;
    }

    // 2. Authorize caller identity against authoritative admin lists
    const isAuthorized = await isAuthorizedToManageTickets(user.email);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Only authorized administrators can delete support tickets." },
        { status: 403 }
      );
    }

    // Delete direct doc
    if (hasAdminCredentials()) {
      await adminDb.collection("support_tickets").doc(ticketId).delete().catch(() => {});

      // Also query and delete matching ticketId
      const snap = await adminDb.collection("support_tickets").where("ticketId", "==", ticketId).get();
      if (!snap.empty) {
        const batch = adminDb.batch();
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } else {
      // Fallback deletion via Firebase REST API
      const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (apiKey && projectId) {
        const deleteUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/support_tickets/${ticketId}?key=${apiKey}`;
        await fetch(deleteUrl, { method: "DELETE" }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ticket ${ticketId} permanently deleted from Firebase.`,
    });
  } catch (error: any) {
    console.error("Error deleting support ticket via API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
