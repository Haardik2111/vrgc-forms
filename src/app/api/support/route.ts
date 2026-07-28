import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, contactInfo, regNo, category, targetLead, message, ticketId } = body;

    if (!fullName || !contactInfo || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("RESEND_API_KEY is missing");
      return NextResponse.json({ success: true, ticketId, note: "API key missing" });
    }

    const RISHAV_EMAIL = "rishav.24bsa10096@vitbhopal.ac.in";
    const ABHINAV_EMAIL = "abhinav.25bcy10254@vitbhopal.ac.in";

    let recipientEmails: string[];
    let leadName: string;

    if (targetLead === "rishav") {
      recipientEmails = [RISHAV_EMAIL];
      leadName = "Rishav Mandal (Tech Lead)";
    } else if (targetLead === "abhinav") {
      recipientEmails = [ABHINAV_EMAIL];
      leadName = "Abhinav Mishra (Co-Lead)";
    } else {
      recipientEmails = [RISHAV_EMAIL, ABHINAV_EMAIL];
      leadName = "Technical Desk (Rishav & Abhinav)";
    }

    // Format HTML Email Content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0b0518; color: #e2e8f0; padding: 24px; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #c084fc; margin-top: 0;">🚨 New Technical Support Ticket</h2>
        <div style="background-color: #1a0b36; padding: 16px; border-radius: 8px; border: 1px solid #7e22ce; margin-bottom: 20px;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>Ticket Reference:</strong> <span style="color: #a855f7; font-family: monospace;">${ticketId}</span></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Assigned To:</strong> ${leadName}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Issue Category:</strong> ${category}</p>
        </div>

        <h3 style="color: #93c5fd; margin-bottom: 8px;">User Information</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 140px;">Full Name:</td>
            <td style="padding: 6px 0; color: #ffffff; font-weight: bold;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Registration No:</td>
            <td style="padding: 6px 0; color: #ffffff;">${regNo || "Not provided"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Contact Info:</td>
            <td style="padding: 6px 0; color: #38bdf8;">${contactInfo}</td>
          </tr>
        </table>

        <h3 style="color: #93c5fd; margin-bottom: 8px;">Issue Description</h3>
        <div style="background-color: #150d2a; padding: 14px; border-radius: 8px; border-left: 4px solid #a855f7; font-size: 14px; line-height: 1.6; color: #f1f5f9;">
          ${message.replace(/\n/g, "<br/>")}
        </div>

        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0 12px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">VRGC Technical Support Desk Automated Alert</p>
      </div>
    `;

    const senderEmail = process.env.RESEND_FROM_EMAIL || "VRGC Support <onboarding@resend.dev>";

    // Attempt sending to lead email addresses
    let resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderEmail,
        to: recipientEmails,
        reply_to: contactInfo,
        subject: `[${ticketId}] Technical Support: ${category} - ${fullName}`,
        html: htmlContent,
      }),
    });

    let resendData = await resendResponse.json();

    // Fallback if domain is not verified yet (sends to Resend account owner email)
    if (!resendResponse.ok && resendData.message?.includes("validation_error")) {
      console.warn("Unverified domain fallback: Sending ticket to onboarding@resend.dev");
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "VRGC Support <onboarding@resend.dev>",
          to: ["onboarding@resend.dev"],
          subject: `[${ticketId}] Technical Support: ${category} - ${fullName}`,
          html: htmlContent,
        }),
      });
      resendData = await resendResponse.json();
    }

    return NextResponse.json({
      success: true,
      ticketId,
      emailId: resendData.id || null,
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json({
      success: true,
      ticketId: body?.ticketId || "VRGC-SUP-PENDING",
    });
  }
}
