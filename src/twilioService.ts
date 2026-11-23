export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // e.g. "whatsapp:+14155238886" or "+1234567890"
  type: "whatsapp" | "sms";
}

const STORAGE_KEY = "messageflow_twilio_config";

export function getSavedTwilioConfig(): TwilioConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  return {
    accountSid: "",
    authToken: "",
    fromNumber: "whatsapp:+14155238886", // Default Twilio WhatsApp sandbox number
    type: "whatsapp"
  };
}

export function saveTwilioConfig(config: TwilioConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export interface TwilioSendItem {
  id: string;
  name: string;
  phone: string;
  message: string;
}

export interface TwilioItemResult {
  id: string;
  phone: string;
  status: "sent" | "failed";
  sid?: string;
  error?: string;
  timestamp: string;
}

export async function sendTwilioBatchApi(
  config: TwilioConfig,
  items: TwilioSendItem[]
): Promise<{ success: boolean; results: TwilioItemResult[]; error?: string }> {
  try {
    const res = await fetch("/api/twilio/send-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountSid: config.accountSid.trim(),
        authToken: config.authToken.trim(),
        fromNumber: config.fromNumber.trim(),
        type: config.type,
        items
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, results: [], error: data.error || "Failed to dispatch via Twilio" };
    }

    return data;
  } catch (err: any) {
    return { success: false, results: [], error: err.message || "Network error calling Twilio endpoint" };
  }
}

export async function testTwilioConnectionApi(
  config: TwilioConfig,
  testPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const res = await fetch("/api/twilio/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountSid: config.accountSid.trim(),
        authToken: config.authToken.trim(),
        fromNumber: config.fromNumber.trim(),
        type: config.type,
        testPhone,
        message
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Twilio test failed" };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach Twilio endpoint" };
  }
}
