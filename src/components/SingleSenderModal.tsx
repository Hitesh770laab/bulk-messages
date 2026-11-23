import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  QrCode,
  RotateCcw,
  Smartphone,
  Sparkles,
  X
} from "lucide-react";
import { normalizePhoneNumber } from "../phoneParser";
import { resolveMessageTokens } from "../randomizer";
import type { Contact } from "../types";

interface SingleSenderModalProps {
  initialPhone?: string;
  initialMessage?: string;
  contacts?: Contact[];
  onClose: () => void;
  onRecordActivity?: (phone: string, message: string, method: string) => void;
}

const RANDOM_TEMPLATES = [
  "Hi {first_name}! You've won an exclusive {random_discount} discount. Use secret coupon code: {random_code}.",
  "Hello {first_name}, here is your account verification test SMS. Your security token is {random_code}.",
  "Hey {first_name}! Thank you for testing MessageFlow. Your lucky draw voucher number is #{lucky_number}.",
  "Greetings {first_name}! Special alert from Acme: your personalized reward code is {random_code} for {random_discount} OFF today."
];

export function SingleSenderModal({
  initialPhone = "",
  initialMessage = "",
  contacts = [],
  onClose,
  onRecordActivity
}: SingleSenderModalProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [recipientName, setRecipientName] = useState("Friend");
  const [message, setMessage] = useState(() => {
    if (initialMessage) return initialMessage;
    return "Hi {first_name}! This is a test SMS from MessageFlow. Your lucky code is {random_code}.";
  });
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [sentFeedback, setSentFeedback] = useState("");

  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const digitsOnly = normalizedPhone.replace(/[^\d+]/g, "").replace(/^\+/, "");

  // Resolve message tokens for preview
  const resolvedMessage = resolveMessageTokens(message, {
    id: "single-test",
    name: recipientName,
    phone: normalizedPhone,
    source: "Single Send",
    consent: "opted_in",
    createdAt: new Date().toISOString(),
    tags: []
  });

  function rollRandomMessage() {
    const template = RANDOM_TEMPLATES[Math.floor(Math.random() * RANDOM_TEMPLATES.length)];
    setMessage(template);
  }

  function handleSelectContact(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      setPhone(contact.phone);
      setRecipientName(contact.name);
    }
  }

  // Device SMS Protocol handler
  function handleSendViaDeviceSms() {
    if (!digitsOnly) {
      setSentFeedback("Please enter a valid phone number first.");
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    const smsUri = `sms:${digitsOnly}${separator}body=${encodeURIComponent(resolvedMessage)}`;

    // Trigger device SMS handler
    window.location.href = smsUri;

    setSentFeedback(`Opened your device SMS app for ${normalizedPhone}! Press Send on your device to deliver.`);
    onRecordActivity?.(normalizedPhone, resolvedMessage, "Device SMS");
  }

  // WhatsApp Web / App handler
  function handleSendViaWhatsApp() {
    if (!digitsOnly) {
      setSentFeedback("Please enter a valid phone number first.");
      return;
    }

    const waUri = `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(resolvedMessage)}`;
    window.open(waUri, "_blank");

    setSentFeedback(`Opened WhatsApp for ${normalizedPhone}!`);
    onRecordActivity?.(normalizedPhone, resolvedMessage, "WhatsApp");
  }

  function handleCopy() {
    navigator.clipboard.writeText(`Phone: ${normalizedPhone}\nMessage: ${resolvedMessage}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `sms:${digitsOnly}?body=${encodeURIComponent(resolvedMessage)}`
  )}`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal single-send-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={19} />
        </button>

        <div className="modal-icon single-icon">
          <Smartphone size={22} />
        </div>

        <p className="eyebrow">DIRECT NUMBER DELIVERY</p>
        <h2>Send SMS to a Particular Number</h2>
        <p className="modal-copy">
          Send a real SMS directly to this number using your device's native SMS app or WhatsApp. No API setup required.
        </p>

        {/* Contact picker if available */}
        {contacts.length > 0 && (
          <div className="picker-row">
            <span>Or select from uploaded contacts:</span>
            <select
              onChange={(e) => handleSelectContact(e.target.value)}
              defaultValue=""
              className="contact-select"
            >
              <option value="" disabled>
                -- Choose from uploaded audience --
              </option>
              {contacts.slice(0, 30).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="single-input-grid">
          <label className="field-label">
            Recipient Mobile Number
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210 or +91 98765 43210"
            />
          </label>

          <label className="field-label">
            Recipient Name (Optional)
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Rahul"
            />
          </label>
        </div>

        {/* Message Editor */}
        <div className="single-message-wrap">
          <div className="single-message-heading">
            <span className="field-title">SMS Message</span>
            <button type="button" className="text-button" onClick={rollRandomMessage}>
              <Sparkles size={14} /> Roll random message
            </button>
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your SMS message here..."
          />

          <div className="token-pills-row">
            <span>Tokens:</span>
            <button
              type="button"
              className="token-chip"
              onClick={() => setMessage((m) => `${m} {first_name}`)}
            >
              Name
            </button>
            <button
              type="button"
              className="token-chip"
              onClick={() => setMessage((m) => `${m} {random_code}`)}
            >
              Promo Code
            </button>
            <button
              type="button"
              className="token-chip"
              onClick={() => setMessage((m) => `${m} {random_discount}`)}
            >
              Discount
            </button>
            <button
              type="button"
              className="token-chip"
              onClick={() => setMessage((m) => `${m} {lucky_number}`)}
            >
              Lucky Number
            </button>
          </div>
        </div>

        {/* Resolved Live Bubble Preview */}
        <div className="single-preview-box">
          <div className="preview-label-row">
            <span>What will arrive on phone:</span>
            <button
              className="icon-button"
              title="Re-randomize dynamic tokens"
              onClick={() => setMessage((m) => `${m} `)}
            >
              <RotateCcw size={13} />
            </button>
          </div>
          <div className="sms-speech-bubble">{resolvedMessage}</div>
        </div>

        {sentFeedback && (
          <div className="alert alert-warning" style={{ margin: "10px 0" }}>
            <span>{sentFeedback}</span>
          </div>
        )}

        {/* QR Code expansion for Desktop users wanting to send from phone */}
        {showQr && (
          <div className="qr-scan-card">
            <p>Scan with your phone's camera to open your phone's SMS app immediately:</p>
            <img src={qrCodeUrl} alt="Scan to send SMS" width={160} height={160} />
            <small>Phone: {normalizedPhone}</small>
          </div>
        )}

        {/* Action Buttons */}
        <div className="single-send-actions">
          <button
            className="button primary main-sms-btn"
            onClick={handleSendViaDeviceSms}
            disabled={!phone.trim()}
          >
            <Smartphone size={17} /> Send via Phone / Device SMS
          </button>

          <button
            className="button secondary"
            onClick={handleSendViaWhatsApp}
            disabled={!phone.trim()}
          >
            <MessageSquare size={16} /> Send via WhatsApp
          </button>

          <button
            className="button secondary"
            onClick={() => setShowQr(!showQr)}
            title="Scan QR on your mobile camera"
          >
            <QrCode size={16} /> {showQr ? "Hide QR" : "Scan QR"}
          </button>

          <button className="button secondary" onClick={handleCopy} title="Copy number & text">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="single-footer-help">
          <small>
            <ExternalLink size={12} /> Clicking "Send via Phone SMS" uses your operating system's SMS handler (Phone Link on Windows, or Messages on mobile) to send a genuine cellular SMS.
          </small>
        </div>
      </section>
    </div>
  );
}
