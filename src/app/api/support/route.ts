import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let ticketId = "VRGC-SUP-PENDING";
  try {
    const body = await req.json();
    const { fullName, contactInfo, regNo, category, message } = body;
    if (body.ticketId) {
      ticketId = body.ticketId;
    }

    if (!fullName || !contactInfo || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const formattedRegNo = regNo ? String(regNo).trim().toUpperCase() : "Not provided";

    // Format Message Body for Formspree
    const formattedText = `
--------------------------------------------------
🚨 VRGC TECHNICAL SUPPORT TICKET: [${ticketId}]
--------------------------------------------------

ASSIGNED TO: Technical Support Desk
CATEGORY   : ${category.toUpperCase()}

--- USER DETAILS ---
FULL NAME : ${fullName}
REG / ROLL: ${formattedRegNo}
CONTACT   : ${contactInfo}

--- ISSUE DESCRIPTION ---
${message}

--------------------------------------------------
Automated message sent via VRGC Forms Technical Support Desk
`;

    const formspreeUrl = process.env.NEXT_PUBLIC_FORMSPREE_URL;
    if (!formspreeUrl) {
      console.error("NEXT_PUBLIC_FORMSPREE_URL is missing in environment");
      return NextResponse.json(
        { error: "Support desk service configuration error" },
        { status: 500 }
      );
    }

    // Send support complaint via Formspree
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
        _subject: `[${ticketId}] Support Ticket: ${category.toUpperCase()} - ${fullName}`,
      }),
    });

    const result = await formspreeResponse.json();

    if (!formspreeResponse.ok) {
      console.error("Formspree API error:", result);
      return NextResponse.json(
        { error: result.error || "Failed to deliver support email via Formspree" },
        { status: formspreeResponse.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Ticket submitted and delivered successfully via Formspree!",
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process support request" },
      { status: 500 }
    );
  }
}
