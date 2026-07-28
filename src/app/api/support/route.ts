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

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is missing in environment");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const leadName = "Technical Support Desk";

    // Format Message Body for Email & Resend Dashboard
    const formattedText = `
--------------------------------------------------
🚨 VRGC TECHNICAL SUPPORT TICKET: [${ticketId}]
--------------------------------------------------

ASSIGNED TO: ${leadName}
CATEGORY   : ${category.toUpperCase()}

--- USER DETAILS ---
FULL NAME : ${fullName}
REG / ROLL: ${regNo || "Not provided"}
CONTACT   : ${contactInfo}

--- ISSUE DESCRIPTION ---
${message}

--------------------------------------------------
Automated message sent via VRGC Forms Technical Support Desk
`;

    // Send email via Resend REST API
    const resendPayload: Record<string, any> = {
      from: "VRGC Technical Desk <onboarding@resend.dev>",
      to: ["delivered@resend.dev"],
      subject: `[${ticketId}] Support Ticket: ${category.toUpperCase()} - ${fullName}`,
      text: formattedText,
    };

    // If contactInfo is a valid email, set reply_to
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.trim())) {
      resendPayload.reply_to = contactInfo.trim();
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    const result = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", result);
      return NextResponse.json(
        { error: result.message || "Failed to deliver support email via Resend" },
        { status: resendResponse.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Ticket submitted and delivered successfully via Resend!",
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process support request" },
      { status: 500 }
    );
  }
}
