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
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json(
        { error: "Resend API key missing on server" },
        { status: 500 }
      );
    }

    const leadName =
      targetLead === "rishav"
        ? "Rishav Mandal (Tech Lead)"
        : targetLead === "abhinav"
        ? "Abhinav Mishra (Co-Lead)"
        : "Technical Desk";

    // Format HTML Email Content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0b0518; color: #e2e8f0; padding: 24px; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #c084fc; margin-top: 0;">🚨 New Technical Support Ticket</h2>
        <div style="background-color: #1a0b36; padding: 16px; border-radius: 8px; border: 1px solid #7e22ce; margin-bottom: 20px;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>Ticket Reference:</strong> <span style="color: #a855f7; font-family: monospace;">${ticketId}</span></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Target Recipient:</strong> ${leadName}</p>
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

        <h3 style="color: #93c5fd; margin-bottom: 8px;">Issue Details</h3>
        <div style="background-color: #150d2a; padding: 14px; border-radius: 8px; border-left: 4px solid #a855f7; font-size: 14px; line-height: 1.6; color: #f1f5f9;">
          ${message.replace(/\n/g, "<br/>")}
        </div>

        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0 12px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">VRGC Technical Support Desk Automated Alert</p>
      </div>
    `;

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VRGC Support <onboarding@resend.dev>",
        to: ["onboarding@resend.dev"], // In testing mode, sends to the account owner
        subject: `[${ticketId}] Technical Support: ${category} - ${fullName}`,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      return NextResponse.json(
        { error: resendData.message || "Failed to send email via Resend" },
        { status: resendResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      ticketId,
      emailId: resendData.id,
    });
  } catch (error: any) {
    console.error("Error in support API route:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
