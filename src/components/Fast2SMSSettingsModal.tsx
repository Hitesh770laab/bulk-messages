import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Flame,
  LoaderCircle,
  Save,
  Send,
  Smartphone,
  X
} from "lucide-react";
import {
  getSavedFast2SMSConfig,
  saveFast2SMSConfig,
  testFast2SMSConnectionApi,
  type Fast2SMSConfig
} from "../fast2smsService";

interface Fast2SMSSettingsModalProps {
  onClose: () => void;
  onConfigSaved: (config: Fast2SMSConfig) => void;
}

export function Fast2SMSSettingsModal({ onClose, onConfigSaved }: Fast2SMSSettingsModalProps) {
  const [config, setConfig] = useState<Fast2SMSConfig>(() => getSavedFast2SMSConfig());
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleSave() {
    saveFast2SMSConfig(config);
    onConfigSaved(config);
    onClose();
  }

  async function handleTest() {
    if (!config.apiKey.trim()) {
      setTestResult({ success: false, message: "Please enter your Fast2SMS API Key." });
      return;
    }
    if (!testPhone.trim()) {
      setTestResult({ success: false, message: "Please enter a 10-digit Indian mobile number." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testFast2SMSConnectionApi(
      config,
      testPhone.trim(),
      "MessageFlow Test: Your Fast2SMS integration is live and working!"
    );

    setTesting(false);
    if (res.success) {
      setTestResult({
        success: true,
        message: `Success! SMS dispatched to ${testPhone}. Fast2SMS Request ID: ${res.requestId}`
      });
      saveFast2SMSConfig(config);
      onConfigSaved(config);
    } else {
      setTestResult({
        success: false,
        message: res.error || "Failed to send test SMS via Fast2SMS."
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal fast2sms-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={19} />
        </button>

        <div className="modal-icon fast2sms-icon">
          <Flame size={22} />
        </div>

        <p className="eyebrow">LOW-COST INDIAN TELECOM (~₹0.18 / SMS)</p>
        <h2>Fast2SMS API Settings</h2>
        <p className="modal-copy">
          Deliver real cellular SMS messages to Indian numbers (+91) at ~₹0.18 per SMS. Recharge directly via UPI (Google Pay, PhonePe, Paytm).
        </p>

        <div className="twilio-fields-form">
          <label className="field-label">
            Fast2SMS API Key (Authorization Header)
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="Paste your Fast2SMS API key here"
            />
          </label>

          <div className="field-label">
            Delivery Route
            <div className="fast2sms-route-select">
              <button
                type="button"
                className={config.route === "q" ? "active" : ""}
                onClick={() => setConfig({ ...config, route: "q" })}
              >
                <strong>Quick SMS (`route: q`)</strong>
                <span>Instant sending. No DLT registration or paperwork needed.</span>
              </button>

              <button
                type="button"
                className={config.route === "dlt" ? "active" : ""}
                onClick={() => setConfig({ ...config, route: "dlt" })}
              >
                <strong>DLT Route (`route: dlt`)</strong>
                <span>For registered business entities with pre-approved Header ID.</span>
              </button>
            </div>
          </div>

          {config.route === "dlt" && (
            <label className="field-label">
              Sender ID (DLT Header)
              <input
                type="text"
                value={config.senderId || ""}
                onChange={(e) => setConfig({ ...config, senderId: e.target.value })}
                placeholder="e.g. ACMECO (6 capital letters)"
                maxLength={6}
              />
            </label>
          )}

          {/* Single Test Message Box */}
          <div className="twilio-test-box">
            <div className="twilio-test-header">
              <Smartphone size={16} />
              <span>Test Fast2SMS Connection First</span>
            </div>
            <div className="twilio-test-row">
              <input
                type="tel"
                placeholder="10-digit mobile (e.g. 9876543210)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <button
                type="button"
                className="button primary"
                disabled={testing || !config.apiKey.trim()}
                onClick={handleTest}
              >
                {testing ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                {testing ? "Sending..." : "Send Test SMS"}
              </button>
            </div>

            {testResult && (
              <div className={`twilio-result-box ${testResult.success ? "success" : "error"}`}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="twilio-docs-box">
            <strong>Where to get your Fast2SMS API Key:</strong>
            <p style={{ margin: "4px 0" }}>
              1. Sign up free at <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer">fast2sms.com <ExternalLink size={11} /></a>
              <br />
              2. Go to <strong>Dev API</strong> in the left sidebar and copy your API authorization key.
              <br />
              3. You get free test credits upon signup, and can recharge ₹100 anytime via UPI.
            </p>
          </div>
        </div>

        <div className="twilio-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={handleSave}>
            <Save size={15} /> Save & Apply
          </button>
        </div>
      </section>
    </div>
  );
}
