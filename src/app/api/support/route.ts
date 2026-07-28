import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let ticketId = "VRGC-SUP-PENDING";
  try {
    const body = await req.json();
    const { fullName, contactInfo, regNo, category, targetLead, message } = body;
    if (body.ticketId) {
      ticketId = body.ticketId;
    }

    if (!fullName || !contactInfo || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
    if (!accessKey) {
      console.error("WEB3FORMS_ACCESS_KEY is missing in environment");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    let leadName: string;
    if (targetLead === "rishav") {
      leadName = "Rishav Mandal (Tech Lead)";
    } else if (targetLead === "abhinav") {
      leadName = "Abhinav Mishra (Co-Lead)";
    } else {
      leadName = "Technical Desk (Rishav & Abhinav)";
    }

    // Format Message Body for Web3Forms
    const formattedText = `
--------------------------------------------------
🚨 VRGC TECHNICAL SUPPORT TICKET: [${ticketId}]
--------------------------------------------------

ASSIGNED TO: ${leadName}
CATEGORY   : ${category}

--- USER DETAILS ---
FULL NAME : ${fullName}
REG / ROLL: ${regNo || "Not provided"}
CONTACT   : ${contactInfo}

--- ISSUE DESCRIPTION ---
${message}

--------------------------------------------------
Automated message sent via VRGC Forms Technical Support Desk
`;

    // Send email via Web3Forms API (100% Free, No Domain Needed)
    const web3Response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: accessKey,
        name: fullName,
        email: contactInfo,
        replyto: contactInfo,
        subject: `[${ticketId}] Support Issue: ${category} - ${fullName}`,
        message: formattedText,
        from_name: "VRGC Technical Support Desk",
      }),
    });

    const result = await web3Response.json();

    if (!web3Response.ok || !result.success) {
      console.error("Web3Forms API error:", result);
      return NextResponse.json(
        { error: result.message || "Failed to deliver support email" },
        { status: web3Response.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Ticket submitted and email delivered successfully!",
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json({
      success: true,
      ticketId,
    });
  }
}
