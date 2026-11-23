function toFast2SMSNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(-10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { apiKey, route, testPhone, message, senderId } = req.body || {};

  if (!apiKey) {
    return res.status(400).json({ error: "Missing Fast2SMS API Key" });
  }

  const cleanPhone = toFast2SMSNumber(testPhone);
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: "Please provide a valid 10-digit Indian mobile number" });
  }

  const payload = {
    route: route || "q",
    message: message || "Test message from MessageFlow Dashboard",
    language: "english",
    flash: 0,
    numbers: cleanPhone
  };
  if (senderId) {
    payload.sender_id = senderId;
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (json.return === true) {
      return res.status(200).json({ success: true, requestId: json.request_id });
    } else {
      const errorMsg = Array.isArray(json.message)
        ? json.message.join(", ")
        : json.message || "Fast2SMS rejected request";
      return res.status(400).json({ success: false, error: errorMsg });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
