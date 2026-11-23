import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  MessageSquare,
  Save,
  Send,
  Smartphone,
  X
} from "lucide-react";
import {
  getSavedTwilioConfig,
  saveTwilioConfig,
  testTwilioConnectionApi,
  type TwilioConfig
} from "../twilioService";

interface TwilioSettingsModalProps {
  onClose: () => void;
  onConfigSaved: (config: TwilioConfig) => void;
}

export function TwilioSettingsModal({ onClose, onConfigSaved }: TwilioSettingsModalProps) {
  const [config, setConfig] = useState<TwilioConfig>(() => getSavedTwilioConfig());
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleSave() {
    saveTwilioConfig(config);
    onConfigSaved(config);
    onClose();
  }

  async function handleTest() {
    if (!config.accountSid || !config.authToken) {
      setTestResult({ success: false, message: "Please fill in Account SID and Auth Token." });
      return;
    }
    if (!testPhone.trim()) {
      setTestResult({ success: false, message: "Please enter a test phone number." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testTwilioConnectionApi(
      config,
      testPhone.trim(),
      `Hi from MessageFlow! Your Twilio ${config.type.toUpperCase()} integration is working perfectly.`
    );

    setTesting(false);
    if (res.success) {
      setTestResult({
        success: true,
        message: `Success! Message delivered. Twilio SID: ${res.sid}`
      });
      // Also save since it worked
      saveTwilioConfig(config);
      onConfigSaved(config);
    } else {
      setTestResult({
        success: false,
        message: res.error || "Failed to send message via Twilio."
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal twilio-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={19} />
        </button>

        <div className="modal-icon twilio-icon">
          <KeyRound size={22} />
        </div>

        <p className="eyebrow">LIVE TELECOM INTEGRATION</p>
        <h2>Twilio API Settings</h2>
        <p className="modal-copy">
          Enter your Twilio credentials to physically dispatch real WhatsApp or SMS messages to contacts' mobile phones.
        </p>

        <div className="twilio-fields-form">
          <label className="field-label">
            Account SID
            <input
              type="text"
              value={config.accountSid}
              onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
              placeholder="e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </label>

          <label className="field-label">
            Auth Token
            <input
              type="password"
              value={config.authToken}
              onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
              placeholder="Your Twilio Auth Token"
            />
          </label>

          <div className="channel-switch-row">
            <span className="field-title">Channel Type:</span>
            <div className="radio-pill-group">
              <button
                type="button"
                className={`pill-option ${config.type === "whatsapp" ? "active" : ""}`}
                onClick={() =>
                  setConfig({
                    ...config,
                    type: "whatsapp",
                    fromNumber: config.fromNumber.startsWith("whatsapp:")
                      ? config.fromNumber
                      : `whatsapp:${config.fromNumber || "+14155238886"}`
                  })
                }
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
              <button
                type="button"
                className={`pill-option ${config.type === "sms" ? "active" : ""}`}
                onClick={() =>
                  setConfig({
                    ...config,
                    type: "sms",
                    fromNumber: config.fromNumber.replace("whatsapp:", "")
                  })
                }
              >
                <Smartphone size={14} /> SMS
              </button>
            </div>
          </div>

          <label className="field-label">
            Twilio Sender Number
            <input
              type="text"
              value={config.fromNumber}
              onChange={(e) => setConfig({ ...config, fromNumber: e.target.value })}
              placeholder={
                config.type === "whatsapp"
                  ? "whatsapp:+14155238886"
                  : "+1234567890"
              }
            />
            <small style={{ color: "#79849a", fontSize: 10, marginTop: 4 }}>
              {config.type === "whatsapp"
                ? "For Twilio WhatsApp Sandbox, leave as whatsapp:+14155238886"
                : "Enter your active Twilio phone number with country code (e.g. +1234567890)"}
            </small>
          </label>
        </div>

        {/* Test Send Section */}
        <div className="twilio-test-box">
          <span className="field-title">Test Your Twilio Connection:</span>
          <div className="twilio-test-input-row">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Your phone number e.g. +91 98765 43210"
            />
            <button
              className="button secondary"
              disabled={testing || !testPhone.trim()}
              onClick={handleTest}
            >
              {testing ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
              Send 1 Test
            </button>
          </div>

          {testResult && (
            <div
              className={`alert ${testResult.success ? "alert-success" : "alert-error"}`}
              style={{ marginTop: 10 }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="twilio-help-tip">
          <small>
            <ExternalLink size={12} /> Don't have Twilio credentials yet? Get a free trial account with $15 test credits at{" "}
            <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noreferrer">
              twilio.com/try-twilio
            </a>
            .
          </small>
        </div>

        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={handleSave}>
            <Save size={16} /> Save Credentials
          </button>
        </div>
      </section>
    </div>
  );
}
