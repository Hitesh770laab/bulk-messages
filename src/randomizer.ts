import type { Contact, DispatchItem, MessageMode } from "./types";

export interface MessagePreset {
  id: string;
  name: string;
  description: string;
  messages: string[];
}

export const MESSAGE_PRESETS: MessagePreset[] = [
  {
    id: "promotions",
    name: "Promotions & Discounts",
    description: "Different discount tiers and flash deals with unique promo codes",
    messages: [
      "Hi {first_name}, surprise! You've unlocked {random_discount} OFF today. Use secret promo code {random_code} at checkout.",
      "Hello {first_name}! Flash sale alert from Acme. Claim your voucher {random_code} for an instant {random_discount} discount.",
      "Hey {first_name}, thank you for being a valued customer! Here is an exclusive {random_discount} discount token: {random_code}.",
      "Good news {first_name}! Weekend special offer just for you. Use code {random_code} to save {random_discount} on your next order."
    ]
  },
  {
    id: "greetings",
    name: "Personalized Greetings",
    description: "Warm, varied greetings and positive messages",
    messages: [
      "Hi {first_name}, hope you are having an incredible week! Your lucky number today is {lucky_number}.",
      "Hello {first_name}, sending you warm wishes from the Acme team! Have a productive and joyful day.",
      "Hey {first_name}, just checking in to see how you're doing. Feel free to reach out if you need anything!",
      "Greetings {first_name}! Wishing you bright moments today. Today's daily positive energy score: {lucky_number}/100."
    ]
  },
  {
    id: "contests",
    name: "Contests & Lucky Draw",
    description: "Randomized lottery / ticket numbers and giveaway codes",
    messages: [
      "Congratulations {first_name}! Your entry ticket for the Acme Lucky Draw is #{random_code}. Stay tuned for results!",
      "Hi {first_name}, you have been selected for our monthly giveaway draw! Your lucky draw number is {random_code}.",
      "Hey {first_name}, your VIP raffle ticket #{random_code} has been registered. Good luck in this week's drawing!",
      "Hello {first_name}, you're in the running! Your exclusive contestant entry code is #{random_code}."
    ]
  },
  {
    id: "reminders",
    name: "Service & Account Updates",
    description: "Varied update notifications with reference IDs",
    messages: [
      "Hi {first_name}, your monthly account review is ready for review. Reference code: {random_code}.",
      "Notice for {first_name}: your scheduled priority support window is confirmed. Confirmation token: {random_code}.",
      "Hello {first_name}, an updated service summary has been generated for your mobile number {phone}. Ticket: {random_code}.",
      "Reminder for {first_name}: check out the new features available in your portal today. Session ID: {random_code}."
    ]
  }
];

const DISCOUNTS = ["10%", "15%", "20%", "25%", "30%", "40%", "50%"];

function generateRandomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const prefix = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

function getRandomDiscount(): string {
  return DISCOUNTS[Math.floor(Math.random() * DISCOUNTS.length)];
}

function getRandomLuckyNumber(): number {
  return Math.floor(10 + Math.random() * 89);
}

export function resolveMessageTokens(template: string, contact: Contact): string {
  const firstName = contact.name.trim().split(" ")[0] || "Friend";
  const fullName = contact.name.trim() || "Valued User";
  const phone = contact.phone;

  return template
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{name\}/gi, fullName)
    .replace(/\{phone\}/gi, phone)
    .replace(/\{random_code\}/gi, generateRandomCode())
    .replace(/\{random_discount\}/gi, getRandomDiscount())
    .replace(/\{lucky_number\}/gi, String(getRandomLuckyNumber()))
    .replace(/\{date\}/gi, new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }));
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanDigits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(message)}`;
}

export function assignMessagesToContacts(
  contacts: Contact[],
  mode: MessageMode,
  singleMessage: string,
  messagePool: string[]
): DispatchItem[] {
  const cleanPool = messagePool.map((m) => m.trim()).filter(Boolean);
  const activePool = cleanPool.length > 0 ? cleanPool : [singleMessage.trim() || "Hello from MessageFlow!"];

  return contacts.map((contact, index) => {
    let rawTemplate: string;
    if (mode === "single") {
      rawTemplate = singleMessage.trim() || "Hello from MessageFlow!";
    } else {
      const randomIndex = Math.floor(Math.random() * activePool.length);
      rawTemplate = activePool[randomIndex];
    }

    const message = resolveMessageTokens(rawTemplate, contact);
    const whatsappUrl = buildWhatsAppUrl(contact.phone, message);

    return {
      id: `disp-${Date.now()}-${index}-${contact.phone.slice(-4)}`,
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      message,
      whatsappUrl,
      status: "queued"
    };
  });
}

export function exportDispatchCsv(items: DispatchItem[], filename = "dispatch-report.csv"): void {
  const headers = ["Phone Number", "Contact Name", "Status", "Timestamp", "Message", "WhatsApp URL"];
  const rows = items.map((item) => [
    `"${item.phone}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.status}"`,
    `"${item.timestamp || new Date().toISOString()}"`,
    `"${item.message.replace(/"/g, '""')}"`,
    `"${(item.whatsappUrl || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportWhatsAppLinksHtml(items: DispatchItem[], title = "WhatsApp Bulk Message Links"): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; color: #111b21; }
    .container { max-width: 820px; margin: 0 auto; background: #fff; padding: 28px; border-radius: 14px; box-shadow: 0 3px 14px rgba(0,0,0,0.06); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e9edef; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { margin: 0; color: #008069; font-size: 22px; }
    .badge { background: #d9fdd3; color: #008069; padding: 4px 10px; border-radius: 999px; font-weight: bold; font-size: 12px; }
    p { margin: 6px 0 0; color: #667781; font-size: 13px; line-height: 1.5; }
    .item { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid #f0f2f5; }
    .item-info { flex: 1; }
    .item-name { font-weight: bold; font-size: 14px; color: #111b21; }
    .item-phone { color: #54656f; font-size: 12px; font-family: monospace; margin-left: 8px; }
    .item-msg { margin-top: 8px; font-size: 13px; color: #111b21; background: #e7fce3; border: 1px solid #c2f5bb; padding: 10px 14px; border-radius: 8px; line-height: 1.45; }
    .btn { display: inline-flex; align-items: center; gap: 7px; background: #25d366; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; font-size: 13px; white-space: nowrap; transition: 0.15s ease; }
    .btn:hover { background: #20bd5a; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>${title}</h1>
        <p>Click "Send WhatsApp" next to any contact to open WhatsApp with the personalized message pre-filled.</p>
      </div>
      <span class="badge">${items.length} Contacts</span>
    </div>
    <div class="list">
      ${items
        .map(
          (it, idx) => `
        <div class="item">
          <div class="item-info">
            <div>
              <span class="item-name">${it.name}</span>
              <span class="item-phone">${it.phone}</span>
            </div>
            <div class="item-msg">${it.message}</div>
          </div>
          <a class="btn" href="${it.whatsappUrl}" target="_blank" rel="noopener">
            💬 Send #${idx + 1}
          </a>
        </div>
      `
        )
        .join("")}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-whatsapp-links.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
