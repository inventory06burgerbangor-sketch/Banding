import React, { useState } from 'react';
import { FileSpreadsheet, RefreshCw, Upload, X } from 'lucide-react';

interface SpreadsheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCsv: string;
  sheetUrl: string;
  onApplyCsv: (newCsv: string, newSheetUrl: string) => void;
  onResetDefault: () => void;
}

export const SpreadsheetSyncModal: React.FC<SpreadsheetSyncModalProps> = ({
  isOpen,
  onClose,
  currentCsv,
  sheetUrl,
  onApplyCsv,
  onResetDefault,
}) => {
  const [csvInput, setCsvInput] = useState(currentCsv);
  const [urlInput, setUrlInput] = useState(sheetUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  if (!isOpen) return null;

  const handleFetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    setErrorMsg(null);
    try {
      let fetchUrl = urlInput.trim();
      // Convert standard Google Sheets link to export CSV link if needed
      const match = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && !fetchUrl.includes('export?format=csv') && !fetchUrl.includes('output=csv')) {
        const gidMatch = fetchUrl.match(/gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
      }
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(`Gagal memuat URL (${res.status}). Pastikan Google Sheet diset "Anyone with the link can view" atau gunakan paste CSV.`);
      }
      const text = await res.text();
      setCsvInput(text);
      onApplyCsv(text, fetchUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil data dari link Google Sheet.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      if (content) {
        setCsvInput(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Sumber Data Spreadsheet &amp; Sinkronisasi 30 Detik
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Opsi 1: Link Google Sheets (Auto-Fetch Setiap 30 Detik)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={isFetchingUrl || !urlInput.trim()}
                onClick={handleFetchFromUrl}
                className="px-4 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUrl ? 'animate-spin' : ''}`} />
                <span>Hubungkan Sheet</span>
              </button>
            </div>
            {errorMsg && <p className="text-xs text-rose-400 mt-1.5">{errorMsg}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Opsi 2: Paste Raw CSV Spreadsheet atau Upload File (.csv)
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File CSV</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={8}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs rounded-lg p-3 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onResetDefault();
              onClose();
            }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reset ke Data Oktober Default
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyCsv(csvInput, urlInput.trim());
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
            >
              Terapkan &amp; Analisa Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
