export type ConsentStatus = "opted_in" | "needs_consent" | "suppressed";
export type View = "overview" | "contacts" | "campaigns" | "dispatch" | "activity" | "otp";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  source: string;
  consent: ConsentStatus;
  createdAt: string;
  tags: string[];
}

export interface ImportSummary {
  total: number;
  accepted: number;
  duplicates: number;
  invalid: number;
  needsConsent: number;
}

export interface Activity {
  id: string;
  type: "campaign" | "otp" | "import" | "dispatch";
  title: string;
  timestamp: string;
  status: "complete" | "queued" | "processing" | "draft" | "blocked";
  recipients: number;
  delivered?: number;
  failed?: number;
}

export type MessageMode = "single" | "random_pool";
export type DispatchTarget = "all" | "opted_in";
export type DeliveryChannel = "fast2sms" | "twilio" | "whatsapp_auto" | "whatsapp_web" | "whatsapp_api" | "device_sms" | "simulation";

export interface DispatchItem {
  id: string;
  contactId: string;
  name: string;
  phone: string;
  message: string;
  whatsappUrl?: string;
  twilioSid?: string;
  fast2smsRequestId?: string;
  status: "queued" | "sending" | "sent" | "failed";
  timestamp?: string;
  error?: string;
}

export interface DispatchRun {
  id: string;
  title: string;
  mode: MessageMode;
  target: DispatchTarget;
  channel: DeliveryChannel;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "paused" | "complete" | "aborted";
  timestamp: string;
  items: DispatchItem[];
}
