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

  const { accountSid, authToken, fromNumber, type, items } = req.body || {};

  if (!accountSid || !authToken) {
    return res.status(400).json({ error: "Missing Twilio Account SID or Auth Token" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No recipient items provided in batch" });
  }

  const formattedFrom = formatTwilioNumber(fromNumber || "+14155238886", type || "whatsapp");
  const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const results = await Promise.all(
    items.map(async (item) => {
      try {
        const to = formatTwilioNumber(item.phone, type || "whatsapp");
        const params = new URLSearchParams();
        params.append("To", to);
        params.append("From", formattedFrom);
        params.append("Body", item.message || "");

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        });

        const json = await response.json();
        const sendTime = new Date().toLocaleTimeString();

        if (response.ok) {
          return {
            id: item.id,
            phone: item.phone,
            status: "sent",
            sid: json.sid,
            timestamp: sendTime
          };
        } else {
          return {
            id: item.id,
            phone: item.phone,
            status: "failed",
            error: json.message || json.detail || `Twilio error: ${json.code}`,
            timestamp: sendTime
          };
        }
      } catch (err) {
        return {
          id: item.id,
          phone: item.phone,
          status: "failed",
          error: err.message || "Network exception",
          timestamp: new Date().toLocaleTimeString()
        };
      }
    })
  );

  return res.status(200).json({ success: true, count: results.length, results });
}
