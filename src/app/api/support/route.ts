import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function POST(req: Request) {
  let ticketId = "VRGC-SUP-PENDING";
  try {
    const body = await req.json();
    const { fullName, contactInfo, regNo, category, message } = body;
    if (body.ticketId) {
      ticketId = body.ticketId;
    } else {
      ticketId = `VRGC-SUP-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    if (!fullName || !contactInfo || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const formattedRegNo = regNo ? String(regNo).trim().toUpperCase() : "Not provided";
    const nowIso = new Date().toISOString();

    // 1. Always record ticket in Firebase Firestore
    try {
      await setDoc(doc(db, "support_tickets", ticketId), {
        ticketId,
        fullName: fullName.trim(),
        contactInfo: contactInfo.trim(),
        regNo: formattedRegNo,
        category: category || "general",
        message: message.trim(),
        status: "unsolved",
        solvedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      console.log(`[Support Desk] Saved ticket ${ticketId} to Firestore.`);
    } catch (dbErr) {
      console.error("[Support Desk] Firestore save error:", dbErr);
    }

    // 2. Format Message Body for Email / Formspree notification
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

    // 3. Optional: Dispatch email notification via Formspree if configured
    const formspreeUrl = process.env.FORMSPREE_URL || process.env.NEXT_PUBLIC_FORMSPREE_URL;
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
