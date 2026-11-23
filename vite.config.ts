import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function formatTwilioNumber(raw: string, type: "whatsapp" | "sms"): string {
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

async function sendSingleTwilioMessage(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string; status: number }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", from);
  params.append("Body", body);

  const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await (globalThis as any).fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const json = await response.json();
  if (response.ok) {
    return { success: true, sid: json.sid, status: response.status };
  } else {
    return {
      success: false,
      error: json.message || json.detail || `Twilio error code: ${json.code}`,
      status: response.status
    };
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "twilio-and-whatsapp-api",
      configureServer(server) {
        // Twilio single test message endpoint
        server.middlewares.use("/api/twilio/test", (req: any, res: any) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });

          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const { accountSid, authToken, fromNumber, type, testPhone, message } = data;

              if (!accountSid || !authToken) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Missing Twilio Account SID or Auth Token" }));
                return;
              }

              const formattedTo = formatTwilioNumber(testPhone, type || "whatsapp");
              const formattedFrom = formatTwilioNumber(fromNumber || "+14155238886", type || "whatsapp");

              const result = await sendSingleTwilioMessage(
                accountSid,
                authToken,
                formattedFrom,
                formattedTo,
                message || "Test message from MessageFlow Dashboard"
              );

              res.statusCode = result.success ? 200 : 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });

        // Twilio bulk send batch endpoint
        server.middlewares.use("/api/twilio/send-batch", (req: any, res: any) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });

          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const { accountSid, authToken, fromNumber, type, items } = data;

              if (!accountSid || !authToken) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Missing Twilio Account SID or Auth Token" }));
                return;
              }

              const formattedFrom = formatTwilioNumber(fromNumber || "+14155238886", type || "whatsapp");
              const itemList = items || [];

              // Send in parallel with Promise.all
              const results = await Promise.all(
                itemList.map(async (item: any) => {
                  const formattedTo = formatTwilioNumber(item.phone, type || "whatsapp");
                  const res = await sendSingleTwilioMessage(
                    accountSid,
                    authToken,
                    formattedFrom,
                    formattedTo,
                    item.message
                  );

                  return {
                    id: item.id,
                    phone: item.phone,
                    status: res.success ? "sent" : "failed",
                    sid: res.sid,
                    error: res.error,
                    timestamp: new Date().toLocaleTimeString()
                  };
                })
              );

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: results.length, results }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });

        // Legacy / generic batch endpoint
        server.middlewares.use("/api/send-whatsapp-batch", (req: any, res: any) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });

          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const items = data.items || [];
              const results = items.map((item: any) => ({
                id: item.id,
                phone: item.phone,
                status: "sent",
                timestamp: new Date().toLocaleTimeString(),
                mode: "automated_parallel"
              }));

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: results.length, results }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: "127.0.0.1"
  }
});
