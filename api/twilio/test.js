function formatTwilioNumber(raw, type) {
  let clean = String(raw || "").trim();
  const digits = clean.replace(/[^\d]/g, "");
  if (type === "whatsapp") {
    if (!clean.toLowerCase().startsWith("whatsapp:")) {
      clean = `whatsapp:+${digits}`;
    }
  } else {
    clean = clean.startsWith("+") ? clean : `+${digits}`;
  }
  return clean;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { accountSid, authToken, fromNumber, type, testPhone, message } = req.body || {};

  if (!accountSid || !authToken) {
    return res.status(400).json({ error: "Missing Twilio Account SID or Auth Token" });
  }

  const formattedTo = formatTwilioNumber(testPhone, type || "whatsapp");
  const formattedFrom = formatTwilioNumber(fromNumber || "+14155238886", type || "whatsapp");

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("To", formattedTo);
    params.append("From", formattedFrom);
    params.append("Body", message || "Test message from MessageFlow Dashboard");

    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const json = await response.json();
    if (response.ok) {
      return res.status(200).json({ success: true, sid: json.sid });
    } else {
      return res.status(response.status).json({
        success: false,
        error: json.message || json.detail || `Twilio error code: ${json.code}`
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
