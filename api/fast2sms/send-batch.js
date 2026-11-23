function toFast2SMSNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(-10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { apiKey, route, items, senderId } = req.body || {};

  if (!apiKey) {
    return res.status(400).json({ error: "Missing Fast2SMS API Key" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No recipient items provided in batch" });
  }

  const results = await Promise.all(
    items.map(async (item) => {
      const cleanPhone = toFast2SMSNumber(item.phone);
      if (cleanPhone.length !== 10) {
        return {
          id: item.id,
          phone: item.phone,
          status: "failed",
          error: "Not a valid 10-digit Indian mobile number",
          timestamp: new Date().toLocaleTimeString()
        };
      }

      const payload = {
        route: route || "q",
        message: item.message || "",
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
        const sendTime = new Date().toLocaleTimeString();

        if (json.return === true) {
          return {
            id: item.id,
            phone: item.phone,
            status: "sent",
            requestId: json.request_id,
            timestamp: sendTime
          };
        } else {
          const errorMsg = Array.isArray(json.message)
            ? json.message.join(", ")
            : json.message || "Fast2SMS rejected dispatch";
          return {
            id: item.id,
            phone: item.phone,
            status: "failed",
            error: errorMsg,
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
