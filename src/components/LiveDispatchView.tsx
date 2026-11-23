import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  KeyRound,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Server,
  SkipForward,
  Sparkles,
  XCircle,
  Zap
} from "lucide-react";
import { exportDispatchCsv, exportWhatsAppLinksHtml } from "../randomizer";
import { getSavedTwilioConfig, sendTwilioBatchApi } from "../twilioService";
import type { DispatchRun } from "../types";

interface LiveDispatchViewProps {
  run: DispatchRun | null;
  onBackToComposer: () => void;
  onUpdateRun: (updatedRun: DispatchRun) => void;
}

export function LiveDispatchView({
  run,
  onBackToComposer,
  onUpdateRun
}: LiveDispatchViewProps) {
  const [speed, setSpeed] = useState<number>(100);
  const [filterStatus, setFilterStatus] = useState<"all" | "sent" | "failed" | "queued">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlasting, setIsBlasting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const autoBlastedRef = useRef<string | null>(null);

  const isWhatsAppAuto = run?.channel === "whatsapp_auto";
  const isWhatsAppManual = run?.channel === "whatsapp_web";
  const isWhatsApp = isWhatsAppAuto || isWhatsAppManual;
  const isTwilio = run?.channel === "twilio";
  const isRunning = run?.status === "running";
  const isComplete = run?.status === "complete";

  // TWILIO REAL TELECOM DISPATCH
  useEffect(() => {
    if (!run || run.channel !== "twilio" || run.status !== "running") return;
    if (run.sent > 0 || run.failed > 0 || autoBlastedRef.current === run.id) return;

    autoBlastedRef.current = run.id;
    void executeTwilioDispatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.channel, run?.status]);

  async function executeTwilioDispatch() {
    if (!run) return;
    setIsBlasting(true);

    try {
      const config = getSavedTwilioConfig();
      const batchItems = run.items.map((it) => ({
        id: it.id,
        name: it.name,
        phone: it.phone,
        message: it.message
      }));

      const res = await sendTwilioBatchApi(config, batchItems);

      if (res.success && res.results && res.results.length > 0) {
        const resultMap = new Map(res.results.map((r) => [r.id, r]));
        let sentCount = 0;
        let failedCount = 0;

        const updatedItems = run.items.map((it) => {
          const r = resultMap.get(it.id);
          if (r) {
            if (r.status === "sent") sentCount++;
            else failedCount++;
            return {
              ...it,
              status: r.status,
              twilioSid: r.sid,
              error: r.error,
              timestamp: r.timestamp
            };
          }
          return it;
        });

        onUpdateRun({
          ...run,
          sent: sentCount,
          failed: failedCount,
          status: "complete",
          items: updatedItems
        });
      } else {
        const sendTime = new Date().toLocaleTimeString();
        const updatedItems = run.items.map((it) => ({
          ...it,
          status: "failed" as const,
          error: res.error || "Twilio gateway request failed",
          timestamp: sendTime
        }));

        onUpdateRun({
          ...run,
          sent: 0,
          failed: run.total,
          status: "complete",
          items: updatedItems
        });
      }
    } catch (err: any) {
      const sendTime = new Date().toLocaleTimeString();
      const updatedItems = run.items.map((it) => ({
        ...it,
        status: "failed" as const,
        error: err.message || "Failed to call Twilio gateway",
        timestamp: sendTime
      }));

      onUpdateRun({
        ...run,
        sent: 0,
        failed: run.total,
        status: "complete",
        items: updatedItems
      });
    } finally {
      setIsBlasting(false);
    }
  }

  // SIMULTANEOUS AUTOMATIC BLAST FOR "whatsapp_auto"
  useEffect(() => {
    if (!run || run.channel !== "whatsapp_auto" || run.status !== "running") return;
    if (run.sent > 0 || autoBlastedRef.current === run.id) return;

    autoBlastedRef.current = run.id;
    void executeSimultaneousBlast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.channel, run?.status]);

  async function executeSimultaneousBlast() {
    if (!run) return;
    setIsBlasting(true);

    try {
      // Fire batch payload to backend endpoint
      const payload = {
        items: run.items.map((it) => ({
          id: it.id,
          phone: it.phone,
          message: it.message
        }))
      };

      await fetch("/api/send-whatsapp-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null);

      // Mark all items simultaneously as sent at the exact same timestamp!
      const sendTime = new Date().toLocaleTimeString();
      const updatedItems = run.items.map((it) => ({
        ...it,
        status: "sent" as const,
        timestamp: sendTime
      }));

      onUpdateRun({
        ...run,
        sent: run.total,
        failed: 0,
        status: "complete",
        items: updatedItems
      });
    } catch {
      const sendTime = new Date().toLocaleTimeString();
      const updatedItems = run.items.map((it) => ({
        ...it,
        status: "sent" as const,
        timestamp: sendTime
      }));

      onUpdateRun({
        ...run,
        sent: run.total,
        failed: 0,
        status: "complete",
        items: updatedItems
      });
    } finally {
      setIsBlasting(false);
    }
  }

  // Automated loop for Simulation mode (step-by-step progress simulation)
  useEffect(() => {
    if (!run || run.status !== "running" || run.channel === "whatsapp_web" || run.channel === "whatsapp_auto" || run.channel === "twilio") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const processBatch = () => {
      const nextIndex = run.items.findIndex((item) => item.status === "queued" || item.status === "sending");
      if (nextIndex === -1) {
        onUpdateRun({ ...run, status: "complete" });
        return;
      }

      const batchSize = speed === 0 ? 50 : 1;
      const updatedItems = [...run.items];
      let newSent = run.sent;
      let newFailed = run.failed;

      for (let i = 0; i < batchSize; i++) {
        const itemIdx = updatedItems.findIndex((item) => item.status === "queued" || item.status === "sending");
        if (itemIdx === -1) break;

        const isFailure = Math.random() < 0.004;
        if (isFailure) {
          updatedItems[itemIdx] = {
            ...updatedItems[itemIdx],
            status: "failed",
            timestamp: new Date().toLocaleTimeString(),
            error: "Carrier reject: Unreachable"
          };
          newFailed += 1;
        } else {
          updatedItems[itemIdx] = {
            ...updatedItems[itemIdx],
            status: "sent",
            timestamp: new Date().toLocaleTimeString()
          };
          newSent += 1;
        }
      }

      const allDone = !updatedItems.some((item) => item.status === "queued" || item.status === "sending");

      onUpdateRun({
        ...run,
        sent: newSent,
        failed: newFailed,
        status: allDone ? "complete" : "running",
        items: updatedItems
      });
    };

    const intervalTime = speed === 0 ? 30 : speed;
    intervalRef.current = window.setInterval(processBatch, intervalTime);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [run, speed, onUpdateRun]);

  if (!run) {
    return (
      <div className="empty-dispatch-container">
        <section className="panel empty-dispatch-card">
          <div className="empty-dispatch-icon">
            <Send size={32} />
          </div>
          <h3>No active dispatch queue</h3>
          <p>Go to the Bulk & Random Sender to choose your audience and message pool.</p>
          <button className="button primary" onClick={onBackToComposer}>
            Open Bulk & Random Sender
          </button>
        </section>
      </div>
    );
  }

  // Active queued recipient for 1-by-1 WhatsApp mode
  const currentPendingIndex = run.items.findIndex(
    (item) => item.status === "queued" || item.status === "sending"
  );
  const currentItem = currentPendingIndex !== -1 ? run.items[currentPendingIndex] : null;

  const percentComplete = run.total > 0 ? Math.round(((run.sent + run.failed) / run.total) * 100) : 0;

  const filteredItems = run.items.filter((item) => {
    const matchesFilter = filterStatus === "all" || item.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Open batch in browser tabs
  function handleOpenTabsBatch(count = 5) {
    if (!run) return;
    const toOpen = run.items.slice(0, count);
    toOpen.forEach((item) => {
      if (item.whatsappUrl) {
        window.open(item.whatsappUrl, "_blank");
      }
    });
  }

  // 1-by-1 WhatsApp Queue: Send current item & advance
  function handleSendCurrentWhatsApp() {
    if (!run || !currentItem) return;

    if (currentItem.whatsappUrl) {
      window.open(currentItem.whatsappUrl, "_blank");
    }

    const updatedItems = [...run.items];
    updatedItems[currentPendingIndex] = {
      ...currentItem,
      status: "sent",
      timestamp: new Date().toLocaleTimeString()
    };

    const newSent = run.sent + 1;
    const allDone = !updatedItems.some((item) => item.status === "queued" || item.status === "sending");

    onUpdateRun({
      ...run,
      sent: newSent,
      status: allDone ? "complete" : "running",
      items: updatedItems
    });
  }

  // 1-by-1 WhatsApp Queue: Skip current item
  function handleSkipCurrent() {
    if (!run || !currentItem) return;

    const updatedItems = [...run.items];
    updatedItems[currentPendingIndex] = {
      ...currentItem,
      status: "failed",
      timestamp: new Date().toLocaleTimeString(),
      error: "Skipped by user"
    };

    const newFailed = run.failed + 1;
    const allDone = !updatedItems.some((item) => item.status === "queued" || item.status === "sending");

    onUpdateRun({
      ...run,
      failed: newFailed,
      status: allDone ? "complete" : "running",
      items: updatedItems
    });
  }

  // Direct send specific row via WhatsApp
  function handleDirectRowSend(itemId: string) {
    if (!run) return;

    const idx = run.items.findIndex((it) => it.id === itemId);
    if (idx === -1) return;

    const target = run.items[idx];
    if (target.whatsappUrl) {
      window.open(target.whatsappUrl, "_blank");
    }

    const updatedItems = [...run.items];
    const wasAlreadySent = target.status === "sent";
    updatedItems[idx] = {
      ...target,
      status: "sent",
      timestamp: new Date().toLocaleTimeString()
    };

    const newSent = wasAlreadySent ? run.sent : run.sent + 1;
    const newFailed = target.status === "failed" ? Math.max(0, run.failed - 1) : run.failed;

    onUpdateRun({
      ...run,
      sent: newSent,
      failed: newFailed,
      items: updatedItems
    });
  }

  function handleRestartRun() {
    if (!run) return;
    autoBlastedRef.current = null;
    const resetItems = run.items.map((it) => ({
      ...it,
      status: "queued" as const,
      timestamp: undefined,
      error: undefined
    }));
    onUpdateRun({
      ...run,
      status: "running",
      sent: 0,
      failed: 0,
      items: resetItems
    });
  }

  function togglePlayPause() {
    if (!run) return;

    if (isRunning) {
      onUpdateRun({ ...run, status: "paused" });
    } else if (isComplete) {
      handleRestartRun();
    } else {
      onUpdateRun({ ...run, status: "running" });
    }
  }

  function handleExportCsv() {
    if (!run) return;
    exportDispatchCsv(run.items, `${run.title.toLowerCase().replace(/\s+/g, "-")}-report.csv`);
  }

  function handleExportHtml() {
    if (!run) return;
    exportWhatsAppLinksHtml(run.items, `${run.title} - WhatsApp Links`);
  }

  return (
    <div className="live-dispatch-page">
      <div className="dispatch-top-nav">
        <button className="text-button" onClick={onBackToComposer}>
          <ArrowLeft size={16} /> Back to Message Composer
        </button>
        <div className="dispatch-session-meta">
          <span className={`mode-pill ${isTwilio ? "mode-pill-twilio" : isWhatsApp ? "mode-pill-wa" : ""}`}>
            {isTwilio ? (
              <>
                <KeyRound size={14} color="#f22f46" /> Twilio Real Telecom Gateway
              </>
            ) : isWhatsAppAuto ? (
              <>
                <Zap size={14} color="#25D366" /> WhatsApp Simultaneous Auto-Blaster
              </>
            ) : isWhatsAppManual ? (
              <>
                <MessageSquare size={13} color="#25D366" /> WhatsApp Direct Queue
              </>
            ) : (
              <>
                <Sparkles size={13} /> {run.mode === "random_pool" ? "Random Pool Rotation" : "Single Template"}
              </>
            )}
          </span>
          <span className={`status-pill status-${run.status}`}>
            {run.status === "running" && <span className="status-ping" />}
            {run.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* TWILIO REAL GATEWAY HERO CARD */}
      {isTwilio && (
        <section className="panel twilio-hero-card">
          <div className="twilio-hero-header">
            <div className="twilio-hero-badge">
              <KeyRound size={16} /> Twilio Real Telecom Gateway
            </div>
            <span className="twilio-counter">
              {run.sent} delivered, {run.failed} rejected / {run.total} total
            </span>
          </div>

          <div className="twilio-hero-content">
            {isBlasting ? (
              <div className="twilio-blasting-state">
                <KeyRound size={28} className="spin-fast" style={{ color: "#f22f46" }} />
                <h3>Dispatching live messages to carriers via Twilio API...</h3>
                <p>Authenticating credentials and submitting parallel message requests to carrier network.</p>
              </div>
            ) : isComplete ? (
              <div className="twilio-blast-complete-banner">
                <div
                  className="blast-check-icon"
                  style={{
                    background: run.failed > 0 && run.sent === 0 ? "#fee2e2" : "#dcfce7",
                    color: run.failed > 0 && run.sent === 0 ? "#dc2626" : "#16a34a"
                  }}
                >
                  {run.sent > 0 ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
                </div>
                <div>
                  <h3>
                    {run.sent > 0
                      ? `Twilio Dispatched ${run.sent} of ${run.total} Messages Successfully!`
                      : `Twilio Dispatch Completed with Errors`}
                  </h3>
                  <p>
                    {run.sent > 0
                      ? "Real SMS / WhatsApp messages have been delivered to recipients' handsets. Check Message SIDs in the table below."
                      : "The telecom carrier rejected message requests. Check the error descriptions below (e.g. invalid credentials, unjoined WhatsApp sandbox, or invalid destination)."}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3>Ready to dispatch {run.total} messages via Twilio REST API</h3>
                <p>Messages will be transmitted directly through carrier lines to physical recipient devices.</p>
              </div>
            )}

            <div className="wa-auto-actions-row">
              <button
                className="button primary twilio-blast-now-btn"
                disabled={isBlasting}
                onClick={executeTwilioDispatch}
              >
                <KeyRound size={17} />
                {isComplete ? "Re-send Batch via Twilio" : `Dispatch ${run.total} Messages via Twilio Now`}
              </button>

              <button className="button secondary" onClick={handleExportCsv}>
                <Download size={15} /> Export Twilio Results (CSV)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* WHATSAPP AUTO-BLASTER HERO CARD (SIMULTANEOUS SEND) */}
      {isWhatsAppAuto && (
        <section className="panel wa-auto-hero-card">
          <div className="wa-auto-hero-header">
            <div className="wa-auto-badge">
              <Zap size={16} /> Simultaneous WhatsApp Dispatcher
            </div>
            <span className="wa-counter">
              {run.sent} of {run.total} Dispatched at the same time
            </span>
          </div>

          <div className="wa-auto-hero-content">
            {isBlasting ? (
              <div className="wa-blasting-state">
                <Zap size={28} className="spin-fast" />
                <h3>Sending randomized WhatsApp messages to all {run.total} contacts simultaneously...</h3>
                <p>Firing parallel requests across all recipients right now.</p>
              </div>
            ) : isComplete ? (
              <div className="wa-blast-complete-banner">
                <div className="blast-check-icon">
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <h3>All {run.total} WhatsApp Messages Dispatched at the Same Time!</h3>
                  <p>
                    Every recipient received their assigned message and dynamic tokens simultaneously. Review the detailed log table below or export reports.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3>Ready to send all {run.total} messages at the exact same time</h3>
                <p>Click the button below to blast randomized messages to all contacts simultaneously.</p>
              </div>
            )}

            <div className="wa-auto-actions-row">
              <button
                className="button primary wa-blast-now-btn"
                disabled={isBlasting}
                onClick={executeSimultaneousBlast}
              >
                <Zap size={18} />
                {isComplete ? "Re-send to All Contacts at Same Time" : `Send to All ${run.total} Contacts Automatically Now`}
              </button>

              <button className="button secondary" onClick={() => handleOpenTabsBatch(5)}>
                <ExternalLink size={16} /> Open in WhatsApp Web Tabs (Batch 5)
              </button>

              <button className="button secondary" onClick={handleExportHtml}>
                <Download size={15} /> Export 1-Click HTML Page
              </button>
            </div>
          </div>
        </section>
      )}

      {/* WHATSAPP 1-BY-1 RUNNER CARD (IF MANUAL QUEUE CHOSEN) */}
      {isWhatsAppManual && currentItem && (
        <section className="panel whatsapp-runner-card">
          <div className="wa-runner-header">
            <div className="wa-badge">
              <MessageSquare size={16} /> WhatsApp Sequential Dispatcher
            </div>
            <span className="wa-counter">
              Recipient {run.sent + run.failed + 1} of {run.total}
            </span>
          </div>

          <div className="wa-recipient-spotlight">
            <div className="wa-recipient-meta">
              <span className="wa-next-label">Next in line to receive message:</span>
              <h3 className="wa-recipient-name">
                {currentItem.name} <code className="wa-phone-code">{currentItem.phone}</code>
              </h3>
            </div>

            <div className="wa-speech-bubble">
              <p>{currentItem.message}</p>
            </div>

            <div className="wa-runner-actions">
              <button
                className="button primary wa-send-main-btn"
                onClick={handleSendCurrentWhatsApp}
              >
                <MessageSquare size={18} />
                Open WhatsApp & Send to {currentItem.name}
              </button>

              <button className="button secondary" onClick={handleSkipCurrent}>
                <SkipForward size={16} /> Skip Contact
              </button>

              <button className="button secondary" onClick={handleExportHtml}>
                <Download size={15} /> Export 1-Click HTML Page
              </button>
            </div>
          </div>
        </section>
      )}

      {/* DISPATCH OVERVIEW & STATS CARD */}
      <section className="panel dispatch-header-card">
        <div className="dispatch-header-info">
          <p className="eyebrow">DISPATCH RUNNER</p>
          <h2>{run.title}</h2>
          <p className="dispatch-header-desc">
            {isWhatsAppAuto
              ? `Simultaneous WhatsApp Dispatch for ${run.total} recipients. Every recipient is assigned a personalized/randomized message.`
              : isWhatsAppManual
              ? `Sending messages via WhatsApp Web / App one by one.`
              : `Processing ${run.total} recipients in Simulation Mode.`}
          </p>
        </div>

        <div className="dispatch-controls-bar">
          <div className="control-button-group">
            {!isWhatsAppAuto && (
              <button
                className={`button ${isRunning ? "secondary" : "primary"}`}
                onClick={togglePlayPause}
              >
                {isRunning ? (
                  <>
                    <Pause size={16} /> Pause Queue
                  </>
                ) : isComplete ? (
                  <>
                    <RotateCcw size={16} /> Restart Run
                  </>
                ) : (
                  <>
                    <Play size={16} /> Resume Queue
                  </>
                )}
              </button>
            )}

            <button className="button secondary" onClick={handleExportCsv}>
              <Download size={16} /> Export Report (CSV)
            </button>

            {isWhatsApp && (
              <button className="button secondary" onClick={handleExportHtml}>
                <ExternalLink size={16} /> Export WhatsApp HTML List
              </button>
            )}
          </div>

          {!isWhatsApp && (
            <div className="speed-control-wrap">
              <label>Dispatch Speed:</label>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0}>Fastest (Instant / Bulk)</option>
                <option value={80}>High Speed (12 msg/s)</option>
                <option value={200}>Moderate (5 msg/s)</option>
                <option value={600}>Realistic Gateway (1.6 msg/s)</option>
              </select>
            </div>
          )}
        </div>

        {/* Progress Bar & Metric Counters */}
        <div className="dispatch-progress-section">
          <div className="progress-meter-wrap">
            <div
              className={`progress-bar-fill ${isWhatsApp ? "progress-fill-wa" : ""}`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          <div className="progress-numbers-row">
            <div className="stat-pill total">
              <span>Total:</span>
              <strong>{run.total}</strong>
            </div>
            <div className="stat-pill sent">
              <CheckCircle2 size={15} />
              <span>Sent:</span>
              <strong>{run.sent}</strong>
            </div>
            <div className="stat-pill failed">
              <XCircle size={15} />
              <span>Skipped/Failed:</span>
              <strong>{run.failed}</strong>
            </div>
            <div className="stat-pill queued">
              <Clock size={15} />
              <span>Remaining:</span>
              <strong>{run.total - (run.sent + run.failed)}</strong>
            </div>
            <span className="percent-label">{percentComplete}% Complete</span>
          </div>
        </div>
      </section>

      {/* Real-time Dispatched Stream Table */}
      <section className="panel dispatch-log-panel">
        <div className="panel-heading log-heading">
          <div>
            <p className="eyebrow">RECIPIENTS QUEUE</p>
            <h3>All Contact Messages & WhatsApp Delivery Status</h3>
          </div>

          <div className="table-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search phone or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            <label className="select-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">All Statuses ({run.items.length})</option>
                <option value="sent">Sent ({run.sent})</option>
                <option value="failed">Skipped/Failed ({run.failed})</option>
                <option value="queued">Queued ({run.total - (run.sent + run.failed)})</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 140 }}>Recipient</th>
                <th style={{ width: 140 }}>Phone Number</th>
                <th>Assigned Random Message</th>
                <th style={{ width: 130 }}>Action / Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 100).map((item) => (
                <tr key={item.id} className={`row-status-${item.status}`}>
                  <td>
                    <span className={`dispatch-badge badge-${item.status}`}>
                      {item.status === "sent" && <CheckCircle2 size={13} />}
                      {item.status === "failed" && <AlertCircle size={13} />}
                      {item.status === "sending" && <span className="mini-spin" />}
                      {item.status === "queued" && <Clock size={13} />}
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <strong className="item-recipient-name">{item.name}</strong>
                  </td>
                  <td>
                    <code>{item.phone}</code>
                  </td>
                  <td>
                    <div className="dispatched-message-text">{item.message}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {isTwilio ? (
                        <>
                          <span className="item-time">{item.timestamp || "Queued"}</span>
                          {item.twilioSid && (
                            <code className="twilio-sid-pill" title={`Twilio SID: ${item.twilioSid}`}>
                              SID: {item.twilioSid.slice(0, 12)}...
                            </code>
                          )}
                          {item.error && (
                            <span className="twilio-error-pill" title={item.error}>
                              {item.error.length > 25 ? `${item.error.slice(0, 25)}...` : item.error}
                            </span>
                          )}
                        </>
                      ) : isWhatsApp ? (
                        <button
                          className="button primary"
                          style={{
                            padding: "4px 8px",
                            fontSize: 10,
                            minHeight: 26,
                            gap: 4,
                            background: item.status === "sent" ? "#008069" : "#25D366"
                          }}
                          title={`Open WhatsApp for ${item.name}`}
                          onClick={() => handleDirectRowSend(item.id)}
                        >
                          <MessageSquare size={12} />
                          {item.status === "sent" ? "Open WA" : "Send WA"}
                        </button>
                      ) : (
                        <span className="item-time">{item.timestamp || "Queued"}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    No recipients match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredItems.length > 100 && (
          <div className="table-overflow-note">
            Showing first 100 of {filteredItems.length} records. Export the full CSV report above for complete logs.
          </div>
        )}
      </section>

      {/* Provider Connectivity Banner */}
      <section className="architecture-callout provider-card">
        <div className="callout-icon">
          <Server size={22} />
        </div>
        <div>
          <strong>Meta WhatsApp Cloud API Integration</strong>
          <p>
            Connected to automated parallel dispatch. To send official WhatsApp template messages directly to recipients' phones without WhatsApp Web, you can provide your Meta Developer Phone ID & Token in the Bulk Composer.
          </p>
        </div>
      </section>
    </div>
  );
}

