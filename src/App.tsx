import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState
} from "react";
import readXlsxFile from "read-excel-file";
import {
  Activity as ActivityIcon,
  AlertCircle,
  ArrowDownUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardPaste,
  Dices,
  Download,
  FileSpreadsheet,
  Filter,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UploadCloud,
  UsersRound,
  X,
  XCircle
} from "lucide-react";
import { generateDemoContacts } from "./sampleContacts";
import { BulkSenderView } from "./components/BulkSenderView";
import { LiveDispatchView } from "./components/LiveDispatchView";
import { QuickPasteModal } from "./components/QuickPasteModal";
import { SingleSenderModal } from "./components/SingleSenderModal";
import { TwilioSettingsModal } from "./components/TwilioSettingsModal";
import { getSavedTwilioConfig, type TwilioConfig } from "./twilioService";
import type {
  Activity,
  ConsentStatus,
  Contact,
  DeliveryChannel,
  DispatchItem,
  DispatchRun,
  DispatchTarget,
  ImportSummary,
  MessageMode,
  View
} from "./types";

const MAX_IMPORT_ROWS = 10_000;
const PAGE_SIZE = 12;

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Bulk & Random Sender", icon: Dices },
  { id: "dispatch", label: "Live Dispatch", icon: Send },
  { id: "contacts", label: "Audience & Contacts", icon: UsersRound },
  { id: "activity", label: "Operations Log", icon: ActivityIcon },
  { id: "otp", label: "OTP verify", icon: KeyRound }
];

function normalizePhone(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  let clean = raw.replace(/[^\d+]/g, "");
  if (clean.startsWith("00")) clean = `+${clean.slice(2)}`;
  const digits = clean.replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function parseConsent(value: unknown): ConsentStatus {
  const input = String(value ?? "").trim().toLowerCase();
  if (/^(yes|y|true|opted.?in|consented|permission|approved)$/.test(input)) return "opted_in";
  if (/^(no|n|false|opted.?out|unsubscribe|unsubscribed|stop|blocked)$/.test(input)) return "suppressed";
  return "opted_in"; // Default newly uploaded contacts to opted_in for easy sending
}

function headerFor(headers: string[], hints: string[]): string | undefined {
  return headers.find((header) => hints.some((hint) => header.toLowerCase().includes(hint)));
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)} ••• ••• ${phone.slice(-3)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1_000);
  if (seconds < 60) return "just now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} hr ago`;
  return `${Math.floor(seconds / 86_400)} days ago`;
}

function statusLabel(status: ConsentStatus): string {
  return status === "opted_in" ? "Opted in" : status === "suppressed" ? "Suppressed" : "Needs consent";
}

function statusClass(status: ConsentStatus): string {
  return status === "opted_in" ? "status status-good" : status === "suppressed" ? "status status-muted" : "status status-warn";
}

function campaignStatusClass(status: Activity["status"]): string {
  if (status === "complete") return "status status-good";
  if (status === "blocked") return "status status-danger";
  if (status === "processing") return "status status-info";
  return "status status-warn";
}

function contactFromRow(row: Record<string, unknown>, position: number): Contact | null {
  const headers = Object.keys(row);
  const phoneHeader = headerFor(headers, ["phone", "mobile", "whatsapp", "number", "contact"]);
  const nameHeader = headerFor(headers, ["full name", "name", "customer", "person"]);
  const consentHeader = headerFor(headers, ["consent", "opt", "permission", "status"]);
  const phone = normalizePhone(phoneHeader ? row[phoneHeader] : undefined);
  if (!phone) return null;

  const name = String(nameHeader ? row[nameHeader] : "").trim() || `Contact ${position}`;
  return {
    id: `import-${Date.now()}-${position}-${phone.slice(-4)}`,
    name,
    phone,
    source: "Spreadsheet import",
    consent: parseConsent(consentHeader ? row[consentHeader] : undefined),
    createdAt: new Date().toISOString(),
    tags: ["Uploaded"]
  };
}

function sampleCsv() {
  const rows = [
    "Full name,Phone,Consent",
    "Aarav Sharma,+91 98765 43210,Yes",
    "Meera Nair,9876543211,Yes",
    "Karan Das,+91 98765 43212,Yes",
    "Sana Iyer,+91 98765 43213,Yes"
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "messageflow-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

async function rowsFromFile(file: File, extension: string): Promise<Record<string, unknown>[]> {
  let matrix: unknown[][];
  if (extension === "csv") {
    matrix = parseCsv(await file.text());
  } else {
    matrix = (await readXlsxFile(file)) as unknown[][];
  }
  const [headerRow, ...dataRows] = matrix;
  const headers = (headerRow ?? []).map((value) => String(value ?? "").trim());
  if (!headers.some(Boolean)) return [];
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [contacts, setContacts] = useState<Contact[]>(() => generateDemoContacts(48));
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "sample-dispatch",
      type: "dispatch",
      title: "Weekend Flash Promo & Greetings",
      timestamp: new Date(Date.now() - 35 * 60_000).toISOString(),
      status: "complete",
      recipients: 48,
      delivered: 48,
      failed: 0
    }
  ]);
  const [importSummary, setImportSummary] = useState<ImportSummary>({
    total: 48,
    accepted: 48,
    duplicates: 0,
    invalid: 0,
    needsConsent: 0
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [consentFilter, setConsentFilter] = useState<"all" | ConsentStatus>("all");
  const [sortBy, setSortBy] = useState<"name" | "newest" | "consent">("newest");
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig>(getSavedTwilioConfig);
  const [singleSendTarget, setSingleSendTarget] = useState<{ phone?: string; message?: string } | null>(null);
  const [activeDispatchRun, setActiveDispatchRun] = useState<DispatchRun | null>(null);

  const [otpPhone, setOtpPhone] = useState("");
  const [otpPurpose, setOtpPurpose] = useState("Sign-in verification");
  const [otpFeedback, setOtpFeedback] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const eligibleContacts = useMemo(() => contacts.filter((contact) => contact.consent === "opted_in"), [contacts]);
  const suppressedContacts = useMemo(() => contacts.filter((contact) => contact.consent === "suppressed"), [contacts]);
  const needsConsent = contacts.length - eligibleContacts.length - suppressedContacts.length;

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = contacts.filter((contact) => {
      const matchesSearch = !query || contact.name.toLowerCase().includes(query) || contact.phone.includes(query);
      const matchesConsent = consentFilter === "all" || contact.consent === consentFilter;
      return matchesSearch && matchesConsent;
    });

    return next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "consent") return a.consent.localeCompare(b.consent) || a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [contacts, consentFilter, search, sortBy]);

  const maxPage = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const visibleContacts = filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetContactsPage() {
    setPage(1);
    setView("contacts");
  }

  function processFile(file: File) {
    setImportError("");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "csv"].includes(extension)) {
      setImportError("Choose an .xlsx or .csv file.");
      return;
    }
    setIsImporting(true);
    void (async () => {
      try {
        const rows = await rowsFromFile(file, extension);
        window.setTimeout(() => {
          try {
            if (!rows.length) throw new Error("No data rows found");
            const limitedRows = rows.slice(0, MAX_IMPORT_ROWS);
            const seen = new Set<string>();
            const accepted: Contact[] = [];
            let invalid = 0;
            let duplicates = 0;
            let noConsent = 0;
            limitedRows.forEach((row, index) => {
              const contact = contactFromRow(row, index + 2);
              if (!contact) {
                invalid += 1;
                return;
              }
              if (seen.has(contact.phone)) {
                duplicates += 1;
                return;
              }
              seen.add(contact.phone);
              if (contact.consent === "needs_consent") noConsent += 1;
              accepted.push(contact);
            });
            setContacts(accepted);
            setImportSummary({
              total: limitedRows.length,
              accepted: accepted.length,
              duplicates,
              invalid,
              needsConsent: noConsent
            });
            setActivities((current) => [
              {
                id: `import-${Date.now()}`,
                type: "import",
                title: file.name,
                timestamp: new Date().toISOString(),
                status: "complete",
                recipients: accepted.length
              },
              ...current
            ]);
            if (rows.length > MAX_IMPORT_ROWS) {
              setImportError(`The first ${formatNumber(MAX_IMPORT_ROWS)} rows were processed. Split larger files before upload.`);
            }
            resetContactsPage();
          } catch {
            setImportError("We could not find a readable name or phone-number column in that file.");
          } finally {
            setIsImporting(false);
          }
        }, 300);
      } catch {
        setImportError("We could not read that file. Try exporting it again from Excel.");
        setIsImporting(false);
      }
    })();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) processFile(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleAddPastedContacts(newContacts: Contact[]) {
    setContacts((current) => [...newContacts, ...current]);
    setImportSummary((prev) => ({
      ...prev,
      total: prev.total + newContacts.length,
      accepted: prev.accepted + newContacts.length
    }));
    setActivities((current) => [
      {
        id: `paste-${Date.now()}`,
        type: "import",
        title: `Pasted ${newContacts.length} numbers`,
        timestamp: new Date().toISOString(),
        status: "complete",
        recipients: newContacts.length
      },
      ...current
    ]);
    setView("campaigns");
  }

  function handleRecordSingleActivity(targetPhone: string, _msg: string, method: string) {
    setActivities((current) => [
      {
        id: `single-${Date.now()}`,
        type: "campaign",
        title: `${method} sent to ${targetPhone}`,
        timestamp: new Date().toISOString(),
        status: "complete",
        recipients: 1,
        delivered: 1,
        failed: 0
      },
      ...current
    ]);
  }

  function handleStartDispatch(
    items: DispatchItem[],
    title: string,
    mode: MessageMode,
    target: DispatchTarget,
    channel: DeliveryChannel
  ) {
    const newRun: DispatchRun = {
      id: `run-${Date.now()}`,
      title,
      mode,
      target,
      channel,
      total: items.length,
      sent: 0,
      failed: 0,
      status: "running",
      timestamp: new Date().toISOString(),
      items
    };
    setActiveDispatchRun(newRun);
    setView("dispatch");
    setActivities((current) => [
      {
        id: newRun.id,
        type: "dispatch",
        title: `${channel === "whatsapp_web" ? "WhatsApp" : "Dispatch"}: ${title}`,
        timestamp: new Date().toISOString(),
        status: "processing",
        recipients: items.length
      },
      ...current
    ]);
  }

  function handleUpdateRun(updatedRun: DispatchRun) {
    setActiveDispatchRun(updatedRun);
    setActivities((current) =>
      current.map((act) =>
        act.id === updatedRun.id
          ? {
              ...act,
              status: updatedRun.status === "complete" ? "complete" : "processing",
              delivered: updatedRun.sent,
              failed: updatedRun.failed
            }
          : act
      )
    );
  }

  function loadTenThousandDemo() {
    const generated = generateDemoContacts(MAX_IMPORT_ROWS);
    setContacts(generated);
    setImportSummary({
      total: MAX_IMPORT_ROWS,
      accepted: MAX_IMPORT_ROWS,
      duplicates: 0,
      invalid: 0,
      needsConsent: generated.filter((contact) => contact.consent === "needs_consent").length
    });
    setActivities((current) => [
      {
        id: `demo-${Date.now()}`,
        type: "import",
        title: "10,000-contact test set",
        timestamp: new Date().toISOString(),
        status: "complete",
        recipients: MAX_IMPORT_ROWS
      },
      ...current
    ]);
    resetContactsPage();
  }

  function requestOtp() {
    const normalized = normalizePhone(otpPhone);
    if (!normalized) {
      setOtpFeedback("Enter a valid mobile number. The demo defaults 10-digit numbers to +91.");
      return;
    }
    setOtpFeedback(`Demo request queued for ${maskPhone(normalized)}. In production, generate and verify codes server-side.`);
    setActivities((current) => [
      {
        id: `otp-${Date.now()}`,
        type: "otp",
        title: `OTP: ${otpPurpose}`,
        timestamp: new Date().toISOString(),
        status: "queued",
        recipients: 1
      },
      ...current
    ]);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <MessageSquareText size={20} />
          </div>
          <span>MessageFlow</span>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>
        <p className="workspace-label">WORKSPACE</p>
        <nav aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => {
                setView(id);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-mode">
            <Sparkles size={15} /> Simulation Mode
          </div>
          <p>Ready for live gateway / provider keys.</p>
          <button className="help-link" onClick={() => setView("campaigns")}>
            <CircleHelp size={16} /> Random message guide
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <div>
            <p className="eyebrow">BULK & RANDOM MESSAGE ENGINE</p>
            <h1>
              {view === "overview"
                ? "MessageFlow Dashboard"
                : navItems.find((item) => item.id === view)?.label}
            </h1>
          </div>
          <div className="topbar-actions">
            <button
              className="button primary"
              style={{ gap: 6 }}
              onClick={() => setSingleSendTarget({})}
            >
              <Smartphone size={15} /> Send to a Number First
            </button>
            <button className="button secondary" onClick={() => setShowPasteModal(true)}>
              <ClipboardPaste size={15} /> Paste Numbers
            </button>
            <button
              className="button secondary"
              style={{ gap: 6 }}
              onClick={() => setShowTwilioModal(true)}
              title="Configure real Twilio telecom gateway credentials"
            >
              <KeyRound size={15} color="#f22f46" /> Twilio Settings
            </button>
            <div className="secure-label">
              <ShieldCheck size={16} /> Ready
            </div>
            <button className="avatar" aria-label="Open account menu">
              MF
            </button>
          </div>
        </header>

        <div className="content">
          {view === "overview" && (
            <Overview
              contacts={contacts}
              eligible={eligibleContacts.length}
              suppressed={suppressedContacts.length}
              needsConsent={needsConsent}
              activities={activities}
              onUpload={() => inputRef.current?.click()}
              onPaste={() => setShowPasteModal(true)}
              onSingleSend={() => setSingleSendTarget({})}
              onContacts={resetContactsPage}
              onCampaign={() => setView("campaigns")}
            />
          )}

          {view === "campaigns" && (
            <BulkSenderView
              contacts={contacts}
              twilioConfig={twilioConfig}
              onOpenTwilioSettings={() => setShowTwilioModal(true)}
              onStartDispatch={handleStartDispatch}
              onOpenPasteModal={() => setShowPasteModal(true)}
              onUploadFile={() => inputRef.current?.click()}
              onOpenSingleSend={(phone) => setSingleSendTarget({ phone })}
            />
          )}

          {view === "dispatch" && (
            <LiveDispatchView
              run={activeDispatchRun}
              onBackToComposer={() => setView("campaigns")}
              onUpdateRun={handleUpdateRun}
            />
          )}

          {view === "contacts" && (
            <ContactsView
              contacts={contacts}
              summary={importSummary}
              isImporting={isImporting}
              importError={importError}
              dragging={dragging}
              search={search}
              consentFilter={consentFilter}
              sortBy={sortBy}
              visibleContacts={visibleContacts}
              filteredCount={filteredContacts.length}
              page={page}
              maxPage={maxPage}
              onUpload={() => inputRef.current?.click()}
              onPaste={() => setShowPasteModal(true)}
              onOpenSingleSend={(phone) => setSingleSendTarget({ phone })}
              onDrop={handleDrop}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
              onConsent={(value) => {
                setConsentFilter(value);
                setPage(1);
              }}
              onSort={(value) => {
                setSortBy(value);
                setPage(1);
              }}
              onPage={(nextPage) => setPage(Math.max(1, Math.min(maxPage, nextPage)))}
              onSample={sampleCsv}
              onLoadDemo={loadTenThousandDemo}
            />
          )}

          {view === "activity" && <ActivityView activities={activities} />}

          {view === "otp" && (
            <OtpView
              phone={otpPhone}
              purpose={otpPurpose}
              feedback={otpFeedback}
              onPhone={setOtpPhone}
              onPurpose={setOtpPurpose}
              onRequest={requestOtp}
            />
          )}
        </div>
      </main>

      <input ref={inputRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} hidden />

      {showPasteModal && (
        <QuickPasteModal
          onAddContacts={handleAddPastedContacts}
          onClose={() => setShowPasteModal(false)}
        />
      )}

      {showTwilioModal && (
        <TwilioSettingsModal
          onClose={() => setShowTwilioModal(false)}
          onConfigSaved={setTwilioConfig}
        />
      )}

      {singleSendTarget && (
        <SingleSenderModal
          initialPhone={singleSendTarget.phone || ""}
          initialMessage={singleSendTarget.message || ""}
          contacts={contacts}
          onClose={() => setSingleSendTarget(null)}
          onRecordActivity={handleRecordSingleActivity}
        />
      )}
    </div>
  );
}

function Overview({
  contacts,
  eligible,
  suppressed,
  needsConsent,
  activities,
  onUpload,
  onPaste,
  onSingleSend,
  onContacts,
  onCampaign
}: {
  contacts: Contact[];
  eligible: number;
  suppressed: number;
  needsConsent: number;
  activities: Activity[];
  onUpload: () => void;
  onPaste: () => void;
  onSingleSend: () => void;
  onContacts: () => void;
  onCampaign: () => void;
}) {
  const latestDispatch = activities.find((activity) => activity.type === "dispatch" || activity.type === "campaign");
  const rate =
    latestDispatch?.delivered && latestDispatch.recipients
      ? Math.round((latestDispatch.delivered / latestDispatch.recipients) * 100)
      : 100;
  const donutStyle = {
    "--eligible": `${contacts.length ? (eligible / contacts.length) * 100 : 0}%`,
    "--needs": `${contacts.length ? ((eligible + needsConsent) / contacts.length) * 100 : 0}%`
  } as CSSProperties;

  return (
    <>
      <section className="hero-card">
        <div>
          <div className="hero-badge">
            <Sparkles size={15} /> Bulk & Random Message Engine
          </div>
          <h2>Upload phone numbers and send custom or randomized messages.</h2>
          <p>
            Easily upload Excel/CSV or paste phone numbers directly. Choose between single templates with dynamic tokens or a randomized message pool to send unique messages to every recipient.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button light" onClick={onSingleSend}>
            <Smartphone size={17} /> Send to a Number First
          </button>
          <button className="button light" onClick={onCampaign}>
            <Dices size={17} /> Bulk & Random Sender
          </button>
          <button className="button ghost-on-dark" onClick={onPaste}>
            <ClipboardPaste size={17} /> Paste Numbers
          </button>
          <button className="button ghost-on-dark" onClick={onUpload}>
            <UploadCloud size={17} /> Import Spreadsheet
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Audience metrics">
        <Metric
          icon={<UsersRound size={18} />}
          label="Total Phone Numbers"
          value={formatNumber(contacts.length)}
          note="Active in workspace"
          tone="violet"
        />
        <Metric
          icon={<CheckCircle2 size={18} />}
          label="Ready Audience"
          value={formatNumber(contacts.length)}
          note="Ready for bulk/random dispatch"
          tone="green"
        />
        <Metric
          icon={<Dices size={18} />}
          label="Message Rotation"
          value="Random Pool"
          note="Unique messages & tokens per contact"
          tone="amber"
        />
        <Metric
          icon={<Send size={18} />}
          label="Delivery Rate"
          value={`${rate}%`}
          note="Simulation & test accuracy"
          tone="blue"
        />
      </section>

      <section className="overview-grid">
        <article className="panel audience-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AUDIENCE HEALTH</p>
              <h3>Workspace Numbers Breakdown</h3>
            </div>
            <button className="text-button" onClick={onContacts}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="donut-layout">
            <div className="donut" style={donutStyle}>
              <div>
                <strong>{contacts.length}</strong>
                <span>numbers</span>
              </div>
            </div>
            <div className="legend-list">
              <div>
                <span className="dot green" />
                <span>Uploaded / Ready</span>
                <strong>{formatNumber(eligible)}</strong>
              </div>
              <div>
                <span className="dot amber" />
                <span>Uncategorized</span>
                <strong>{formatNumber(needsConsent)}</strong>
              </div>
              <div>
                <span className="dot slate" />
                <span>Suppressed / Unsub</span>
                <strong>{formatNumber(suppressed)}</strong>
              </div>
            </div>
          </div>
          <div className="compliance-note">
            <ShieldCheck size={16} /> Supports sending to All Uploaded Numbers or Opted-In Only.
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RECENT ACTIVITY</p>
              <h3>Workspace Operations</h3>
            </div>
            <button className="icon-button" aria-label="More activity options">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="timeline">
            {activities.slice(0, 4).map((activity) => (
              <div className="timeline-item" key={activity.id}>
                <div className={`timeline-icon ${activity.type}`}>
                  {activity.type === "dispatch" || activity.type === "campaign" ? (
                    <Send size={15} />
                  ) : activity.type === "otp" ? (
                    <KeyRound size={15} />
                  ) : (
                    <FileSpreadsheet size={15} />
                  )}
                </div>
                <div>
                  <strong>{activity.title}</strong>
                  <span>
                    {activity.type === "dispatch" || activity.type === "campaign"
                      ? `${formatNumber(activity.recipients)} recipients queued`
                      : activity.type === "import"
                      ? `${formatNumber(activity.recipients)} contacts processed`
                      : "Single verification request"}
                  </span>
                </div>
                <time>{relativeTime(activity.timestamp)}</time>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="quick-actions">
        <div>
          <p className="eyebrow">HOW IT WORKS</p>
          <h3>3 Steps to send messages to your numbers</h3>
        </div>
        <div className="quick-action-list">
          <button onClick={onPaste}>
            <span className="step-number">1</span>
            <span>
              <strong>Add Phone Numbers</strong>
              <small>Upload Excel/CSV or Paste</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button onClick={onCampaign}>
            <span className="step-number">2</span>
            <span>
              <strong>Pick Message Mode</strong>
              <small>Single text or Random Pool</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button onClick={onCampaign}>
            <span className="step-number">3</span>
            <span>
              <strong>Live Dispatch</strong>
              <small>Track in realtime & export CSV</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function ContactsView({
  contacts,
  summary,
  isImporting,
  importError,
  dragging,
  search,
  consentFilter,
  sortBy,
  visibleContacts,
  filteredCount,
  page,
  maxPage,
  onUpload,
  onPaste,
  onOpenSingleSend,
  onDrop,
  onDragOver,
  onDragLeave,
  onSearch,
  onConsent,
  onSort,
  onPage,
  onSample,
  onLoadDemo
}: {
  contacts: Contact[];
  summary: ImportSummary;
  isImporting: boolean;
  importError: string;
  dragging: boolean;
  search: string;
  consentFilter: "all" | ConsentStatus;
  sortBy: "name" | "newest" | "consent";
  visibleContacts: Contact[];
  filteredCount: number;
  page: number;
  maxPage: number;
  onUpload: () => void;
  onPaste: () => void;
  onOpenSingleSend: (phone: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onSearch: (value: string) => void;
  onConsent: (value: "all" | ConsentStatus) => void;
  onSort: (value: "name" | "newest" | "consent") => void;
  onPage: (value: number) => void;
  onSample: () => void;
  onLoadDemo: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">AUDIENCE DIRECTORY</p>
          <h2>Contacts & Phone Numbers</h2>
          <p>Phone numbers are normalized automatically. Import from Excel or paste numbers directly.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="button secondary" onClick={onPaste}>
            <ClipboardPaste size={16} /> Paste numbers
          </button>
          <button className="button primary" onClick={onUpload}>
            <UploadCloud size={17} /> Import spreadsheet
          </button>
        </div>
      </section>

      <section
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="upload-icon">
          {isImporting ? <LoaderCircle className="spin" size={24} /> : <FileSpreadsheet size={24} />}
        </div>
        <div>
          <h3>{isImporting ? "Reading and cleaning your spreadsheet…" : "Drop an Excel or CSV file here"}</h3>
          <p>
            {isImporting
              ? "Finding phone columns, normalizing formats, and checking duplicates."
              : "Supports .xlsx and .csv — up to 10,000 data rows per import."}
          </p>
        </div>
        <div className="upload-actions">
          <button className="button secondary" onClick={onUpload} disabled={isImporting}>
            {isImporting ? "Processing" : "Choose file"}
          </button>
          <button className="button secondary" onClick={onPaste}>
            Paste text list
          </button>
          <button className="text-button" onClick={onSample}>
            Download sample
          </button>
        </div>
      </section>

      {importError && (
        <div className={`alert ${importError.startsWith("The first") ? "alert-warning" : "alert-error"}`}>
          <AlertCircle size={17} />
          <span>{importError}</span>
        </div>
      )}

      <section className="import-summary">
        <SummaryPill label="Rows scanned" value={formatNumber(summary.total)} icon={<FileSpreadsheet size={16} />} />
        <SummaryPill label="Active numbers" value={formatNumber(contacts.length)} icon={<Check size={16} />} good />
        <SummaryPill label="Duplicates removed" value={formatNumber(summary.duplicates)} icon={<Inbox size={16} />} />
        <SummaryPill label="Invalid numbers" value={formatNumber(summary.invalid)} icon={<XCircle size={16} />} warning />
        <button className="performance-link" onClick={onLoadDemo}>
          <Sparkles size={15} /> Load 10,000-contact test set
        </button>
      </section>

      <section className="panel contacts-panel">
        <div className="panel-heading contacts-heading">
          <div>
            <p className="eyebrow">CLEAN CONTACTS</p>
            <h3>{formatNumber(contacts.length)} contacts in workspace</h3>
          </div>
          <div className="table-tools">
            <label className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search name or phone"
              />
            </label>
            <label className="select-wrap">
              <Filter size={15} />
              <select
                value={consentFilter}
                onChange={(event) => onConsent(event.target.value as "all" | ConsentStatus)}
              >
                <option value="all">All statuses</option>
                <option value="opted_in">Opted in</option>
                <option value="needs_consent">Needs consent</option>
                <option value="suppressed">Suppressed</option>
              </select>
            </label>
            <label className="select-wrap">
              <ArrowDownUp size={15} />
              <select
                value={sortBy}
                onChange={(event) => onSort(event.target.value as "name" | "newest" | "consent")}
              >
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="consent">Consent status</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Source</th>
                <th>Tags</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <div className="contact-name">
                      <span>{contact.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span>
                      <strong>{contact.name}</strong>
                    </div>
                  </td>
                  <td>{maskPhone(contact.phone)}</td>
                  <td>
                    <span className={statusClass(contact.consent)}>{statusLabel(contact.consent)}</span>
                  </td>
                  <td>{contact.source}</td>
                  <td>
                    {contact.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="button secondary"
                        style={{ padding: "3px 8px", fontSize: 10, minHeight: 28, gap: 4 }}
                        title={`Send direct test SMS to ${contact.name}`}
                        onClick={() => onOpenSingleSend(contact.phone)}
                      >
                        <Smartphone size={13} /> Send SMS
                      </button>
                      <button className="icon-button" aria-label={`More options for ${contact.name}`}>
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleContacts.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-table">
                      <Search size={22} />
                      <strong>No contacts match these filters</strong>
                      <span>Try a different search or filter.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing {filteredCount ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredCount)} of{" "}
            {formatNumber(filteredCount)}
          </span>
          <div>
            <button
              className="pager"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {page} of {maxPage}
            </span>
            <button
              className="pager"
              disabled={page >= maxPage}
              onClick={() => onPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function SummaryPill({
  label,
  value,
  icon,
  good,
  warning
}: {
  label: string;
  value: string;
  icon: ReactNode;
  good?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`summary-pill ${good ? "good" : ""} ${warning ? "warning" : ""}`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ActivityView({ activities }: { activities: Activity[] }) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS LOG</p>
          <h2>Activity & Run History</h2>
          <p>History of imports, dispatches, and transactional requests in this session.</p>
        </div>
        <button className="button secondary">
          <Download size={16} /> Export log
        </button>
      </section>

      <section className="panel activity-table-panel">
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Time</th>
              <th>Recipients</th>
              <th>Delivery</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id}>
                <td>
                  <div className="activity-title">
                    <span className={`activity-symbol ${activity.type}`}>
                      {activity.type === "dispatch" || activity.type === "campaign" ? (
                        <Send size={16} />
                      ) : activity.type === "otp" ? (
                        <KeyRound size={16} />
                      ) : (
                        <FileSpreadsheet size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{activity.title}</strong>
                      <small>
                        {activity.type === "dispatch"
                          ? "Bulk/Random Dispatch"
                          : activity.type === "campaign"
                          ? "Campaign"
                          : activity.type === "otp"
                          ? "Transactional OTP"
                          : "Audience Import"}
                      </small>
                    </div>
                  </div>
                </td>
                <td>{relativeTime(activity.timestamp)}</td>
                <td>{formatNumber(activity.recipients)}</td>
                <td>
                  {(activity.type === "dispatch" || activity.type === "campaign") && activity.delivered !== undefined ? (
                    <span>
                      {formatNumber(activity.delivered)} delivered
                      {activity.failed ? ` · ${activity.failed} failed` : ""}
                    </span>
                  ) : (
                    <span className="muted-dash">—</span>
                  )}
                </td>
                <td>
                  <span className={campaignStatusClass(activity.status)}>{activity.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function OtpView({
  phone,
  purpose,
  feedback,
  onPhone,
  onPurpose,
  onRequest
}: {
  phone: string;
  purpose: string;
  feedback: string;
  onPhone: (value: string) => void;
  onPurpose: (value: string) => void;
  onRequest: () => void;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">TRANSACTIONAL ONLY</p>
          <h2>OTP verification</h2>
          <p>OTP is intentionally separate from campaign messaging and is limited to one verified interaction at a time.</p>
        </div>
        <div className="secure-label strong">
          <LockKeyhole size={17} /> Server-side only
        </div>
      </section>
      <section className="otp-layout">
        <article className="panel otp-card">
          <div className="otp-illustration">
            <div>
              <KeyRound size={27} />
            </div>
            <span>One-time password</span>
          </div>
          <h3>Request a verification code</h3>
          <p>Production code generation, hashing, expiry, and throttling must happen on your server—not in a browser.</p>
          <label className="field-label">
            Mobile number
            <input
              value={phone}
              onChange={(event) => onPhone(event.target.value)}
              placeholder="e.g. 98765 43210"
              inputMode="tel"
            />
          </label>
          <label className="field-label">
            Verification purpose
            <select value={purpose} onChange={(event) => onPurpose(event.target.value)}>
              <option>Sign-in verification</option>
              <option>Phone ownership check</option>
              <option>High-risk account change</option>
            </select>
          </label>
          <div className="otp-guardrails">
            <div>
              <CheckCircle2 size={16} /> Single recipient only
            </div>
            <div>
              <CheckCircle2 size={16} /> 3 requests / 15 min
            </div>
            <div>
              <CheckCircle2 size={16} /> Purpose-bound template
            </div>
          </div>
          <button className="button primary full-width" onClick={onRequest}>
            <KeyRound size={17} /> Queue demo OTP request
          </button>
          {feedback && (
            <div className="alert alert-warning otp-feedback">
              <AlertCircle size={17} />
              <span>{feedback}</span>
            </div>
          )}
        </article>
        <aside className="otp-info">
          <article className="panel">
            <p className="eyebrow">WHY A SEPARATE FLOW?</p>
            <h3>OTP is not bulk messaging.</h3>
            <p>
              It proves control of a phone number for a specific user action. It should never be generated from imported contact lists or sent through the campaign composer.
            </p>
            <ul>
              <li>Short-lived, hashed code stored server-side</li>
              <li>Rate-limit by phone, IP, device, and tenant</li>
              <li>Approved transactional template only</li>
              <li>Audit every verification attempt</li>
            </ul>
          </article>
          <article className="warning-card">
            <AlertCircle size={19} />
            <div>
              <strong>Live provider not connected</strong>
              <span>Configure provider credentials in a server environment, never in client-side code.</span>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
