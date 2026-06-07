import { useRef, useState } from "react";
import { API, PORTFOLIO_ID, ACCOUNT_ID } from "../constants";
import { C, sectionStyle, labelStyle } from "../theme";

const TRANSACTION_TYPES = ["BUY","SELL","DIVIDEND","DEPOSIT","WITHDRAWAL","FEE","TRANSFER"];

const emptyForm = {
  symbol: "", transactionType: "BUY", quantity: "", pricePerUnit: "",
  fees: "0", transactionDate: "", notes: "",
};

export default function Import() {
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [csvFile, setCsvFile]       = useState<File | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [txResult, setTxResult]     = useState<any>(null);
  const [txError, setTxError]       = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) setCsvFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCsvFile(f);
  };

  const handleImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append("portfolioId", PORTFOLIO_ID);
      fd.append("accountId",   ACCOUNT_ID);
      fd.append("file",        csvFile);
      const res = await fetch(`${API}/imports/robinhood`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setImportResult(data);
      setCsvFile(null);
    } catch (e: any) {
      setImportError(e.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleManualSubmit = async () => {
    setSubmitting(true);
    setTxResult(null);
    setTxError(null);
    try {
      const res = await fetch(`${API}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId:       ACCOUNT_ID,
          symbol:          form.symbol.trim().toUpperCase(),
          transactionType: form.transactionType,
          quantity:        Number(form.quantity),
          pricePerUnit:    Number(form.pricePerUnit),
          fees:            Number(form.fees),
          transactionDate: form.transactionDate,
          notes:           form.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTxResult(data);
      setForm(emptyForm);
    } catch (e: any) {
      setTxError(e.message ?? "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: C.bg, color: C.text, border: `1px solid rgba(200,169,106,0.35)`,
    borderRadius: "10px", padding: "10px 14px", fontSize: "14px",
    fontFamily: C.font, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ color: C.text, fontFamily: C.font }}>
      <p style={labelStyle}>Data Management</p>
      <h2 style={{ fontSize: "48px", marginTop: "12px", marginBottom: "4px" }}>Import</h2>
      <p style={{ color: C.muted, marginBottom: "40px" }}>
        Import transactions from a brokerage CSV or enter them manually.
      </p>

      {/* CSV Import */}
      <section style={{ ...sectionStyle, marginBottom: "32px" }}>
        <p style={labelStyle}>Brokerage Import</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Robinhood CSV</h3>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? C.gold : "rgba(200,169,106,0.35)"}`,
            borderRadius: "16px", padding: "48px",
            textAlign: "center", cursor: "pointer",
            background: dragOver ? "rgba(200,169,106,0.04)" : "transparent",
            transition: "all 0.15s",
          }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
          {csvFile
            ? <p style={{ color: C.gold, margin: 0 }}>📄 {csvFile.name}</p>
            : <>
                <p style={{ color: C.muted, margin: "0 0 8px" }}>Drop your CSV here or click to browse</p>
                <p style={{ color: C.muted, fontSize: "12px", margin: 0 }}>Supports Robinhood export format</p>
              </>
          }
        </div>

        {csvFile && (
          <button onClick={handleImport} disabled={importing}
            style={{ marginTop: "20px", background: C.gold, color: C.bg, border: "none",
              borderRadius: "10px", padding: "12px 28px", cursor: "pointer",
              fontFamily: C.font, fontSize: "15px", fontWeight: 700, opacity: importing ? 0.7 : 1 }}>
            {importing ? "Importing…" : "Confirm Import"}
          </button>
        )}

        {importResult && (
          <div style={{ marginTop: "24px", padding: "20px", background: "rgba(143,214,148,0.08)",
            border: `1px solid rgba(143,214,148,0.25)`, borderRadius: "12px" }}>
            <p style={{ color: C.green, fontWeight: 700, margin: "0 0 8px" }}>Import successful</p>
            <p style={{ color: C.muted, margin: "4px 0", fontSize: "14px" }}>
              Transactions imported: <strong style={{ color: C.text }}>{importResult.transactionsImported}</strong>
            </p>
            <p style={{ color: C.muted, margin: "4px 0", fontSize: "14px" }}>
              Duplicates skipped: <strong style={{ color: C.text }}>{importResult.transactionsSkipped}</strong>
            </p>
            <p style={{ color: C.muted, margin: "4px 0", fontSize: "14px" }}>
              Assets created: <strong style={{ color: C.text }}>{importResult.assetsCreated}</strong>
            </p>
          </div>
        )}

        {importError && (
          <div style={{ marginTop: "24px", padding: "20px", background: "rgba(224,108,117,0.08)",
            border: `1px solid rgba(224,108,117,0.25)`, borderRadius: "12px" }}>
            <p style={{ color: C.red, margin: 0 }}>Import failed: {importError}</p>
          </div>
        )}
      </section>

      {/* Manual Entry */}
      <section style={sectionStyle}>
        <p style={labelStyle}>Manual Entry</p>
        <h3 style={{ fontSize: "24px", margin: "8px 0 24px" }}>Add Transaction</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
          {/* Symbol */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Symbol</p>
            <input value={form.symbol} onChange={e => setForm(v => ({...v, symbol: e.target.value}))}
              placeholder="e.g. AAPL" style={inputStyle} />
          </div>

          {/* Type */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Transaction Type</p>
            <select value={form.transactionType} onChange={e => setForm(v => ({...v, transactionType: e.target.value}))}
              style={{ ...inputStyle, cursor: "pointer" }}>
              {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Date</p>
            <input type="date" value={form.transactionDate}
              onChange={e => setForm(v => ({...v, transactionDate: e.target.value}))}
              style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>

          {/* Quantity */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Quantity</p>
            <input type="number" value={form.quantity} placeholder="0.00"
              onChange={e => setForm(v => ({...v, quantity: e.target.value}))} style={inputStyle} />
          </div>

          {/* Price */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Price Per Unit ($)</p>
            <input type="number" value={form.pricePerUnit} placeholder="0.00"
              onChange={e => setForm(v => ({...v, pricePerUnit: e.target.value}))} style={inputStyle} />
          </div>

          {/* Fees */}
          <div>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Fees ($)</p>
            <input type="number" value={form.fees} placeholder="0.00"
              onChange={e => setForm(v => ({...v, fees: e.target.value}))} style={inputStyle} />
          </div>

          {/* Notes */}
          <div style={{ gridColumn: "span 3" }}>
            <p style={{ color: C.muted, fontSize: "12px", margin: "0 0 6px" }}>Notes (optional)</p>
            <input value={form.notes} onChange={e => setForm(v => ({...v, notes: e.target.value}))}
              placeholder="e.g. Earnings dip buy" style={inputStyle} />
          </div>
        </div>

        <button onClick={handleManualSubmit} disabled={submitting}
          style={{ marginTop: "24px", background: C.gold, color: C.bg, border: "none",
            borderRadius: "10px", padding: "12px 28px", cursor: "pointer",
            fontFamily: C.font, fontSize: "15px", fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Adding…" : "Add Transaction"}
        </button>

        {txResult && (
          <div style={{ marginTop: "20px", padding: "16px 20px", background: "rgba(143,214,148,0.08)",
            border: `1px solid rgba(143,214,148,0.25)`, borderRadius: "12px" }}>
            <p style={{ color: C.green, margin: 0, fontSize: "14px" }}>
              Transaction added — {txResult.symbol} {txResult.transactionType} {txResult.quantity} @ ${txResult.pricePerUnit}
            </p>
          </div>
        )}

        {txError && (
          <div style={{ marginTop: "20px", padding: "16px 20px", background: "rgba(224,108,117,0.08)",
            border: `1px solid rgba(224,108,117,0.25)`, borderRadius: "12px" }}>
            <p style={{ color: C.red, margin: 0, fontSize: "14px" }}>{txError}</p>
          </div>
        )}
      </section>
    </div>
  );
}
