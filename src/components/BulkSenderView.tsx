import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Dices,
  Download,
  Eye,
  KeyRound,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Shuffle,
  Smartphone,
  Sparkles,
  Trash2,
  UsersRound,
  Wand2,
  Zap
} from "lucide-react";
import {
  MESSAGE_PRESETS,
  assignMessagesToContacts,
  exportWhatsAppLinksHtml
} from "../randomizer";
import type { TwilioConfig } from "../twilioService";
import type {
  Contact,
  DeliveryChannel,
  DispatchItem,
  DispatchTarget,
  MessageMode
} from "../types";

interface BulkSenderViewProps {
  contacts: Contact[];
  twilioConfig: TwilioConfig;
  onOpenTwilioSettings: () => void;
  onStartDispatch: (
    items: DispatchItem[],
    title: string,
    mode: MessageMode,
    target: DispatchTarget,
    channel: DeliveryChannel
  ) => void;
  onOpenPasteModal: () => void;
  onUploadFile: () => void;
  onOpenSingleSend: (phone?: string) => void;
}

export function BulkSenderView({
  contacts,
  twilioConfig,
  onOpenTwilioSettings,
  onStartDispatch,
  onOpenPasteModal,
  onUploadFile,
  onOpenSingleSend
}: BulkSenderViewProps) {
  const [target, setTarget] = useState<DispatchTarget>("all");
  const [channel, setChannel] = useState<DeliveryChannel>(
    twilioConfig.accountSid ? "twilio" : "whatsapp_auto"
  );
  const [metaPhoneId, setMetaPhoneId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [mode, setMode] = useState<MessageMode>("random_pool");
  const [campaignTitle, setCampaignTitle] = useState("WhatsApp Special Offer & Greetings");
  const [singleMessage, setSingleMessage] = useState(
    "Hi {first_name}, surprise! You've unlocked {random_discount} OFF today. Use secret promo code {random_code} at checkout."
  );

  // Pool of messages
  const [messagePool, setMessagePool] = useState<string[]>([
    "Hi {first_name}, surprise! You've unlocked {random_discount} OFF today. Use secret promo code {random_code} at checkout.",
    "Hello {first_name}! Flash sale alert from Acme. Claim your voucher {random_code} for an instant {random_discount} discount.",
    "Hey {first_name}, thank you for being a valued customer! Here is an exclusive {random_discount} discount token: {random_code}.",
    "Greetings {first_name}! Special alert from Acme: your account reward voucher is {random_code}."
  ]);

  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Filter contacts based on chosen target
  const targetedContacts = useMemo(() => {
    if (target === "opted_in") {
      return contacts.filter((c) => c.consent === "opted_in");
    }
    return contacts;
  }, [contacts, target]);

  // Generate preview assignments
  const previewAssignments = useMemo(() => {
    if (targetedContacts.length === 0) return [];
    const sample = targetedContacts.slice(0, 8);
    return assignMessagesToContacts(sample, mode, singleMessage, messagePool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetedContacts, mode, singleMessage, messagePool, shuffleSeed]);

  function handleAddPoolMessage() {
    setMessagePool([
      ...messagePool,
      "Hi {first_name}, special update for your number {phone}! Your lucky draw code is {random_code}."
    ]);
  }

  function handleUpdatePoolMessage(index: number, text: string) {
    const next = [...messagePool];
    next[index] = text;
    setMessagePool(next);
  }

  function handleDeletePoolMessage(index: number) {
    if (messagePool.length <= 1) return;
    setMessagePool(messagePool.filter((_, i) => i !== index));
  }

  function handleApplyPreset(presetId: string) {
    const preset = MESSAGE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setMessagePool([...preset.messages]);
      setCampaignTitle(`WhatsApp: ${preset.name}`);
    }
  }

  function insertToken(token: string, poolIndex?: number) {
    if (mode === "single" || poolIndex === undefined) {
      setSingleMessage((prev) => `${prev} ${token}`);
    } else {
      const next = [...messagePool];
      next[poolIndex] = `${next[poolIndex]} ${token}`;
      setMessagePool(next);
    }
  }

  function handleLaunch() {
    if (targetedContacts.length === 0) return;
    if (channel === "twilio" && (!twilioConfig.accountSid || !twilioConfig.authToken)) {
      onOpenTwilioSettings();
      return;
    }
    const allAssignments = assignMessagesToContacts(targetedContacts, mode, singleMessage, messagePool);
    onStartDispatch(
      allAssignments,
      campaignTitle.trim() || "Untitled Dispatch",
      mode,
      target,
      channel
    );
  }

  function handleExportWhatsAppLinks() {
    if (targetedContacts.length === 0) return;
    const allAssignments = assignMessagesToContacts(targetedContacts, mode, singleMessage, messagePool);
    exportWhatsAppLinksHtml(
      allAssignments,
      campaignTitle.trim() || "WhatsApp Bulk Message Links"
    );
  }

  const tokenList = [
    { label: "First Name", token: "{first_name}" },
    { label: "Full Name", token: "{name}" },
    { label: "Phone", token: "{phone}" },
    { label: "Random Code", token: "{random_code}" },
    { label: "Random Discount", token: "{random_discount}" },
    { label: "Lucky Number", token: "{lucky_number}" },
    { label: "Date", token: "{date}" }
  ];

  return (
    <div className="bulk-sender-container">
      <section className="page-heading">
        <div>
          <p className="eyebrow">MESSAGING STUDIO</p>
          <h2>Bulk & Random Message Dispatcher</h2>
          <p>
            Upload or paste phone numbers, compose custom text, or send unique random messages across your audience via WhatsApp or SMS.
          </p>
        </div>
        <div className="header-badge-row">
          <button
            className="button primary"
            style={{ fontSize: 11 }}
            onClick={() => onOpenSingleSend()}
          >
            <Smartphone size={15} /> Send Test SMS / WhatsApp First
          </button>
          <span className="badge-simulation">
            {channel === "twilio" ? (
              <>
                <KeyRound size={14} color="#f22f46" /> Twilio Real Telecom ({twilioConfig.type.toUpperCase()})
              </>
            ) : channel === "whatsapp_auto" ? (
              <>
                <Zap size={14} color="#25D366" /> WhatsApp Auto Mode
              </>
            ) : channel === "whatsapp_web" ? (
              <>
                <MessageSquare size={14} color="#25D366" /> WhatsApp Web Mode
              </>
            ) : channel === "device_sms" ? (
              <>
                <Smartphone size={14} /> SMS Mode
              </>
            ) : (
              <>
                <Sparkles size={14} /> Simulation Mode
              </>
            )}
          </span>
        </div>
      </section>

      {/* Test First Banner */}
      <section className="test-send-banner">
        <div className="test-send-info">
          <div className="test-send-icon">
            <MessageSquare size={20} />
          </div>
          <div>
            <strong>Test WhatsApp or SMS to a particular number first</strong>
            <p>
              Verify real message delivery to your own phone number before running through your full contact list.
            </p>
          </div>
        </div>
        <button className="button light" onClick={() => onOpenSingleSend()}>
          <Smartphone size={16} /> Send to Specific Number
        </button>
      </section>

      {/* Target Audience selection bar */}
      <section className="panel target-audience-bar">
        <div className="target-summary">
          <div className="target-icon">
            <UsersRound size={20} />
          </div>
          <div>
            <strong>Selected Audience: {targetedContacts.length} recipients</strong>
            <span>
              Total in workspace: {contacts.length} numbers (
              {contacts.filter((c) => c.consent === "opted_in").length} opted-in)
            </span>
          </div>
        </div>

        <div className="target-controls">
          <div className="radio-pill-group">
            <button
              className={`pill-option ${target === "all" ? "active" : ""}`}
              onClick={() => setTarget("all")}
            >
              All Uploaded ({contacts.length})
            </button>
            <button
              className={`pill-option ${target === "opted_in" ? "active" : ""}`}
              onClick={() => setTarget("opted_in")}
            >
              Opted-In Only ({contacts.filter((c) => c.consent === "opted_in").length})
            </button>
          </div>

          <div className="target-add-buttons">
            <button className="button secondary" onClick={onOpenPasteModal}>
              <Plus size={15} /> Paste Numbers
            </button>
            <button className="button secondary" onClick={onUploadFile}>
              Upload File
            </button>
          </div>
        </div>
      </section>

      {contacts.length === 0 && (
        <div className="alert alert-warning" style={{ marginTop: 14 }}>
          <AlertCircle size={17} />
          <span>
            No phone numbers in workspace yet. Click <strong>Paste Numbers</strong> or <strong>Upload File</strong> above to add recipients.
          </span>
        </div>
      )}

      {/* Main Grid: Composer on Left, Recipient Preview on Right */}
      <div className="sender-layout-grid">
        <div className="sender-main-column">
          {/* Dispatch Setup & Mode Toggle */}
          <article className="panel composer-card">
            {/* Delivery Channel Selector */}
            <div className="channel-selector-box">
              <span className="channel-box-title">Delivery Channel:</span>
              <div className="channel-buttons-row">
                <button
                  type="button"
                  className={`channel-choice-btn ${channel === "twilio" ? "active-twilio" : ""}`}
                  onClick={() => setChannel("twilio")}
                >
                  <KeyRound size={16} />
                  <span>🚀 Twilio Real API (WhatsApp / SMS)</span>
                  <span className="mini-badge-instant" style={{ background: "#f22f46", color: "#fff" }}>
                    REAL TELECOM
                  </span>
                </button>
                <button
                  type="button"
                  className={`channel-choice-btn ${channel === "whatsapp_auto" ? "active-wa-auto" : ""}`}
                  onClick={() => setChannel("whatsapp_auto")}
                >
                  <Zap size={16} />
                  <span>⚡ WhatsApp Auto-Send (Simultaneous)</span>
                  <span className="mini-badge-instant">AUTOMATED</span>
                </button>
                <button
                  type="button"
                  className={`channel-choice-btn ${channel === "whatsapp_web" ? "active-wa" : ""}`}
                  onClick={() => setChannel("whatsapp_web")}
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp Web (1-by-1 Queue)</span>
                </button>
                <button
                  type="button"
                  className={`channel-choice-btn ${channel === "device_sms" ? "active-sms" : ""}`}
                  onClick={() => setChannel("device_sms")}
                >
                  <Smartphone size={16} />
                  <span>Device Cellular SMS</span>
                </button>
                <button
                  type="button"
                  className={`channel-choice-btn ${channel === "simulation" ? "active-sim" : ""}`}
                  onClick={() => setChannel("simulation")}
                >
                  <Sparkles size={16} />
                  <span>Simulated Test Run</span>
                </button>
              </div>

              {channel === "twilio" && (
                <div className="twilio-notice-box">
                  <div className="twilio-notice-info">
                    <div className="twilio-status-icon" style={{ color: twilioConfig.accountSid ? "#16a34a" : "#dc2626" }}>
                      {twilioConfig.accountSid ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div>
                      <strong>
                        Twilio Status: {twilioConfig.accountSid ? "Connected & Ready to Send" : "Credentials Required for Real Sending"}
                      </strong>
                      <p>
                        {twilioConfig.accountSid
                          ? `Channel: ${twilioConfig.type.toUpperCase()} from ${twilioConfig.fromNumber} (Account: ${twilioConfig.accountSid.slice(0, 8)}...)`
                          : "Enter your Twilio Account SID & Token to dispatch real messages directly to phone carriers."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button light"
                    style={{ fontSize: 12, padding: "7px 14px", flexShrink: 0 }}
                    onClick={onOpenTwilioSettings}
                  >
                    <KeyRound size={14} /> {twilioConfig.accountSid ? "Edit Twilio Settings" : "Connect Twilio Account"}
                  </button>
                </div>
              )}

              {channel === "whatsapp_auto" && (
                <div className="wa-auto-notice">
                  <div className="wa-auto-text">
                    <Zap size={18} />
                    <div>
                      <strong>Simultaneous WhatsApp Dispatch Active</strong>
                      <p>
                        When you click launch, all {targetedContacts.length} contacts receive their randomized messages automatically at the exact same time without manual clicking!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: 11 }}
                    onClick={() => setShowApiConfig(!showApiConfig)}
                  >
                    <KeyRound size={13} /> {showApiConfig ? "Hide Meta Cloud API Keys" : "Connect Meta WhatsApp Cloud API (Optional)"}
                  </button>
                </div>
              )}

              {showApiConfig && (
                <div className="api-config-drawer">
                  <div className="api-config-fields">
                    <label>
                      <span>Meta WhatsApp Phone Number ID (Optional)</span>
                      <input
                        type="text"
                        value={metaPhoneId}
                        onChange={(e) => setMetaPhoneId(e.target.value)}
                        placeholder="e.g. 104829105829102"
                      />
                    </label>
                    <label>
                      <span>Meta Graph API Permanent Token (Optional)</span>
                      <input
                        type="password"
                        value={metaToken}
                        onChange={(e) => setMetaToken(e.target.value)}
                        placeholder="EAABwzL..."
                      />
                    </label>
                  </div>
                  <small>Leave empty to run in instant automated sandbox mode, or enter your Meta Cloud API keys to physically deliver real template messages.</small>
                </div>
              )}
            </div>

            <div className="panel-heading" style={{ marginTop: 16 }}>
              <div>
                <p className="eyebrow">MESSAGE STRATEGY</p>
                <h3>Choose Dispatch Mode</h3>
              </div>
              <label className="title-field-wrap">
                <span>Campaign Name</span>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. WhatsApp Flash Sale"
                />
              </label>
            </div>

            <div className="mode-toggle-tabs">
              <button
                className={`mode-tab ${mode === "random_pool" ? "active" : ""}`}
                onClick={() => setMode("random_pool")}
              >
                <Dices size={18} />
                <div>
                  <strong>Random Message Pool</strong>
                  <small>Pick a different random message for each contact</small>
                </div>
              </button>

              <button
                className={`mode-tab ${mode === "single" ? "active" : ""}`}
                onClick={() => setMode("single")}
              >
                <Send size={18} />
                <div>
                  <strong>Single Message with Tokens</strong>
                  <small>Same core template with dynamic random tokens</small>
                </div>
              </button>
            </div>

            {/* MODE A: Random Message Pool */}
            {mode === "random_pool" && (
              <div className="pool-builder">
                <div className="preset-bar">
                  <span className="preset-label">
                    <Wand2 size={14} /> Quick Presets:
                  </span>
                  <div className="preset-chips">
                    {MESSAGE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        className="preset-chip"
                        onClick={() => handleApplyPreset(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pool-list">
                  {messagePool.map((msg, index) => (
                    <div className="pool-item" key={index}>
                      <div className="pool-item-header">
                        <span className="pool-badge">Variation #{index + 1}</span>
                        {messagePool.length > 1 && (
                          <button
                            className="icon-button delete-btn"
                            title="Remove this variation"
                            onClick={() => handleDeletePoolMessage(index)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={3}
                        value={msg}
                        onChange={(e) => handleUpdatePoolMessage(index, e.target.value)}
                        placeholder="Write a message variation..."
                      />

                      <div className="token-pills-row">
                        <span>Insert token:</span>
                        {tokenList.map((t) => (
                          <button
                            key={t.token}
                            type="button"
                            className="token-chip"
                            onClick={() => insertToken(t.token, index)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pool-footer-actions">
                  <button className="button secondary" onClick={handleAddPoolMessage}>
                    <Plus size={15} /> Add Another Message Variation
                  </button>
                  <span className="pool-count-label">
                    {messagePool.length} active variations in rotation
                  </span>
                </div>
              </div>
            )}

            {/* MODE B: Single Message */}
            {mode === "single" && (
              <div className="single-message-builder">
                <label className="field-label">
                  Message Content
                  <textarea
                    rows={5}
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    placeholder="Enter your message template..."
                  />
                </label>

                <div className="token-pills-row">
                  <span>Insert dynamic token:</span>
                  {tokenList.map((t) => (
                    <button
                      key={t.token}
                      type="button"
                      className="token-chip"
                      onClick={() => insertToken(t.token)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>

        {/* Right Column: Live Recipient Preview & Launch Card */}
        <div className="sender-side-column">
          <article className="panel launch-card">
            <div className="launch-card-header">
              <p className="eyebrow">READY TO DISPATCH</p>
              <h3>Audience Overview</h3>
            </div>

            <div className="launch-stat-box">
              <span className="launch-stat-num">{targetedContacts.length}</span>
              <span className="launch-stat-label">Recipients in this queue</span>
            </div>

            <ul className="dispatch-feature-checklist">
              <li>
                <CheckCircle2 size={16} /> Delivery:{" "}
                {channel === "twilio"
                  ? `🚀 Twilio Real Telecom (${twilioConfig.type.toUpperCase()})`
                  : channel === "whatsapp_auto"
                  ? "⚡ WhatsApp Auto-Send (Simultaneous)"
                  : channel === "whatsapp_web"
                  ? "WhatsApp Web / App"
                  : channel === "device_sms"
                  ? "Cellular SMS"
                  : "Simulated Test"}
              </li>
              <li>
                <CheckCircle2 size={16} /> Mode:{" "}
                {mode === "random_pool" ? "Random Pool Rotation" : "Single Template"}
              </li>
              <li>
                <CheckCircle2 size={16} /> Dynamic personalization ({tokenList.length} token tags supported)
              </li>
              <li>
                <CheckCircle2 size={16} /> Instant parallel dispatch across all contacts
              </li>
            </ul>

            <button
              className={`button primary full-width launch-button ${
                channel === "twilio"
                  ? "twilio-launch-btn"
                  : channel === "whatsapp_auto"
                  ? "wa-auto-launch-btn"
                  : channel === "whatsapp_web"
                  ? "wa-primary-btn"
                  : ""
              }`}
              disabled={targetedContacts.length === 0}
              onClick={handleLaunch}
            >
              {channel === "twilio" ? (
                <>
                  <Send size={18} />
                  🚀 Dispatch to All {targetedContacts.length} Contacts via Real Twilio {twilioConfig.type.toUpperCase()}
                </>
              ) : channel === "whatsapp_auto" ? (
                <>
                  <Zap size={18} />
                  ⚡ Send to All {targetedContacts.length} Contacts Automatically Now
                </>
              ) : channel === "whatsapp_web" ? (
                <>
                  <MessageSquare size={17} />
                  Start WhatsApp Queue ({targetedContacts.length})
                </>
              ) : (
                <>
                  <Send size={16} />
                  Review & Start Dispatch ({targetedContacts.length})
                </>
              )}
            </button>

            {(channel === "whatsapp_web" || channel === "whatsapp_auto") && (
              <button
                type="button"
                className="button secondary full-width"
                style={{ marginTop: 9 }}
                disabled={targetedContacts.length === 0}
                onClick={handleExportWhatsAppLinks}
              >
                <Download size={15} /> Export WhatsApp 1-Click Page (HTML)
              </button>
            )}
          </article>

          {/* Interactive Live Preview */}
          <article className="panel preview-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LIVE PREVIEW</p>
                <h3>What Recipients Will Receive</h3>
              </div>
              <button
                className="icon-button"
                title="Reshuffle random assignments"
                onClick={() => setShuffleSeed((s) => s + 1)}
              >
                <Shuffle size={17} />
              </button>
            </div>

            <p className="preview-subtitle">
              Simulated token resolution and message assignments for your audience:
            </p>

            <div className="preview-items-scroll">
              {previewAssignments.map((item, idx) => (
                <div className="preview-bubble-item" key={idx}>
                  <div className="preview-recipient-info">
                    <div>
                      <strong>{item.name}</strong>
                      <span style={{ marginLeft: 8 }}>{item.phone}</span>
                    </div>
                    <button
                      className="text-button"
                      style={{ fontSize: 10, gap: 3 }}
                      title={`Send test SMS/WhatsApp to ${item.phone}`}
                      onClick={() => onOpenSingleSend(item.phone)}
                    >
                      <Smartphone size={12} /> Test SMS
                    </button>
                  </div>
                  <div className="sms-speech-bubble">{item.message}</div>
                </div>
              ))}

              {previewAssignments.length === 0 && (
                <div className="empty-preview">
                  <Eye size={22} />
                  <span>Add contacts to preview resolved messages.</span>
                </div>
              )}
            </div>

            {previewAssignments.length > 0 && (
              <div className="preview-card-footer">
                <button
                  className="text-button"
                  onClick={() => setShuffleSeed((s) => s + 1)}
                >
                  <RotateCcw size={14} /> Reshuffle random draws
                </button>
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
