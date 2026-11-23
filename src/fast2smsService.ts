export interface Fast2SMSConfig {
  apiKey: string;
  route: "q" | "dlt";
  senderId?: string; // Optional custom sender ID if registered on DLT
}

const STORAGE_KEY = "messageflow_fast2sms_config";

export function getSavedFast2SMSConfig(): Fast2SMSConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  return {
    apiKey: "",
    route: "q"
  };
}

export function saveFast2SMSConfig(config: Fast2SMSConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export interface Fast2SMSSendItem {
  id: string;
  name: string;
  phone: string;
  message: string;
}

export interface Fast2SMSItemResult {
  id: string;
  phone: string;
  status: "sent" | "failed";
  requestId?: string;
  error?: string;
  timestamp: string;
}

export async function sendFast2SMSBatchApi(
  config: Fast2SMSConfig,
  items: Fast2SMSSendItem[]
): Promise<{ success: boolean; results: Fast2SMSItemResult[]; error?: string }> {
  try {
    const res = await fetch("/api/fast2sms/send-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: config.apiKey.trim(),
        route: config.route,
        senderId: config.senderId?.trim(),
        items
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, results: [], error: data.error || "Failed to dispatch via Fast2SMS" };
    }

    return data;
  } catch (err: any) {
    return { success: false, results: [], error: err.message || "Network error calling Fast2SMS API" };
  }
}

export async function testFast2SMSConnectionApi(
  config: Fast2SMSConfig,
  testPhone: string,
  message: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const res = await fetch("/api/fast2sms/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: config.apiKey.trim(),
        route: config.route,
        senderId: config.senderId?.trim(),
        testPhone,
        message
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Fast2SMS test failed" };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || "Network error connecting to Fast2SMS" };
  }
}
