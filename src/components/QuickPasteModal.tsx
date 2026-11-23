import { useState } from "react";
import { ClipboardPaste, Plus, Sparkles, X } from "lucide-react";
import { parsePastedNumbers } from "../phoneParser";
import type { Contact } from "../types";

interface QuickPasteModalProps {
  onAddContacts: (contacts: Contact[]) => void;
  onClose: () => void;
}

export function QuickPasteModal({ onAddContacts, onClose }: QuickPasteModalProps) {
  const [pasteText, setPasteText] = useState("");
  const [previewStats, setPreviewStats] = useState<{ total: number; invalid: number; duplicates: number } | null>(null);

  function handleCalculate() {
    const { contacts, invalidCount, duplicateCount } = parsePastedNumbers(pasteText);
    setPreviewStats({
      total: contacts.length,
      invalid: invalidCount,
      duplicates: duplicateCount
    });
  }

  function handleImport() {
    const { contacts } = parsePastedNumbers(pasteText);
    if (contacts.length > 0) {
      onAddContacts(contacts);
      onClose();
    }
  }

  function handleLoadSample() {
    const sample = `+91 98765 43210, Aarav Sharma
9876543211, Meera Nair
+91 98765 43212, Rohan Gupta
9876543213, Priya Patel
9876543214, Karan Das
+91 98765 43215, Ananya Singh
9876543216, Vikram Mehta
9876543217, Kavya Iyer`;
    setPasteText(sample);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal paste-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={19} />
        </button>

        <div className="modal-icon paste-icon">
          <ClipboardPaste size={22} />
        </div>

        <p className="eyebrow">QUICK NUMBER ENTRY</p>
        <h2>Paste Phone Numbers</h2>
        <p className="modal-copy">
          Paste a list of phone numbers (one per line, or with names e.g. <code>9876543210, John</code>). 10-digit numbers default to +91.
        </p>

        <div className="paste-actions-top">
          <button className="text-button" onClick={handleLoadSample}>
            <Sparkles size={14} /> Insert sample 8 numbers
          </button>
        </div>

        <textarea
          className="paste-textarea"
          rows={7}
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPreviewStats(null);
          }}
          placeholder={`9876543210\n+91 98765 43211, Priya\n9876543212, Rahul\n+1 415 555 2671, Alex`}
        />

        {previewStats && (
          <div className="paste-preview-banner">
            <span>
              ✓ <strong>{previewStats.total}</strong> valid numbers parsed
            </span>
            {previewStats.duplicates > 0 && <span>· {previewStats.duplicates} duplicates removed</span>}
            {previewStats.invalid > 0 && <span>· {previewStats.invalid} invalid ignored</span>}
          </div>
        )}

        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          {!previewStats ? (
            <button className="button primary" disabled={!pasteText.trim()} onClick={handleCalculate}>
              Review Numbers
            </button>
          ) : (
            <button className="button primary" disabled={previewStats.total === 0} onClick={handleImport}>
              <Plus size={16} /> Add {previewStats.total} Contacts
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
