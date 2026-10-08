import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, RefreshCw, Upload, X } from 'lucide-react';
import { convertExcelSpreadsheetToCsv } from '../utils/analyzer';
import { DEFAULT_SHEET_NAME } from '../data/rawSpreadsheetCsv';

interface SpreadsheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCsv: string;
  sheetUrl: string;
  sheetName?: string;
  onApplyCsv: (newCsv: string, newSheetUrl: string, newSheetName?: string) => void;
  onResetDefault: () => void;
}

export const SpreadsheetSyncModal: React.FC<SpreadsheetSyncModalProps> = ({
  isOpen,
  onClose,
  currentCsv,
  sheetUrl,
  sheetName = DEFAULT_SHEET_NAME,
  onApplyCsv,
  onResetDefault,
}) => {
  const [csvInput, setCsvInput] = useState(currentCsv);
  const [urlInput, setUrlInput] = useState(sheetUrl);
  const [sheetNameInput, setSheetNameInput] = useState(sheetName || DEFAULT_SHEET_NAME);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCsvInput(currentCsv);
      setUrlInput(sheetUrl);
      setSheetNameInput(sheetName || DEFAULT_SHEET_NAME);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentCsv, sheetUrl, sheetName]);

  if (!isOpen) return null;

  const fetchSheetData = async (targetUrl: string, targetSheetName: string) => {
    const res = await fetch('/api/fetch-spreadsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl.trim(),
        sheetName: targetSheetName.trim() || DEFAULT_SHEET_NAME,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error ||
          'Gagal memuat URL Spreadsheet. Pastikan Google Sheet diset "Anyone with the link can view".'
      );
    }
    if (!data.csvText || data.csvText.trim().length <= 10) {
      throw new Error('Data Spreadsheet kosong atau tidak valid.');
    }
    return data.csvText as string;
  };

  const handleFetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const fetchedCsv = await fetchSheetData(urlInput, sheetNameInput);
      setCsvInput(fetchedCsv);
      setSuccessMsg(
        `Berhasil menarik data terbaru dari Sheet "${sheetNameInput || DEFAULT_SHEET_NAME}".`
      );
      onApplyCsv(fetchedCsv, urlInput.trim(), sheetNameInput.trim() || DEFAULT_SHEET_NAME);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil data dari link Google Sheet.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleSaveAndSync = async () => {
    setErrorMsg(null);
    // Jika user mengisi URL baru dan belum mengubah isi manual, tarik otomatis dari URL tersebut
    if (urlInput.trim() && (urlInput.trim() !== sheetUrl || csvInput === currentCsv)) {
      setIsFetchingUrl(true);
      try {
        const fetchedCsv = await fetchSheetData(urlInput, sheetNameInput);
        setCsvInput(fetchedCsv);
        onApplyCsv(fetchedCsv, urlInput.trim(), sheetNameInput.trim() || DEFAULT_SHEET_NAME);
        onClose();
        return;
      } catch (err: any) {
        setErrorMsg(err?.message || 'Gagal mengambil data dari link Google Sheet.');
        setIsFetchingUrl(false);
        return;
      } finally {
        setIsFetchingUrl(false);
      }
    }

    onApplyCsv(csvInput, urlInput.trim(), sheetNameInput.trim() || DEFAULT_SHEET_NAME);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const convertedCsv = convertExcelSpreadsheetToCsv(buffer);
        if (convertedCsv) {
          setCsvInput(convertedCsv);
          setSuccessMsg(
            `File "${file.name}" berhasil dibaca (Sheet rekap Daily) — klik Simpan & Sinkronkan Data.`
          );
        }
      } else {
        const text = await file.text();
        if (text) {
          setCsvInput(text);
          setSuccessMsg(`File "${file.name}" berhasil dimuat — klik Simpan & Sinkronkan Data.`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membaca file Spreadsheet.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border border-[#B8C9BE] rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-[#1C2822]">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2EAE4]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#2D5A43]" />
            <div>
              <h3 className="text-lg font-bold text-[#1C2822]">
                Sinkronisasi Sumber Data Spreadsheet
              </h3>
              <p className="text-xs text-[#4A5D52]">
                Base Data: Sheet <span className="font-semibold text-[#1E3329]">rekap Daily</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#526358] hover:text-[#1C2822] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#3B5246] mb-1.5">
              Opsi 1: Link Google Sheets (Base Data: Sheet rekap Daily)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="sm:col-span-7 bg-[#F4F7F5] border border-[#B8C9BE] text-[#1C2822] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#2D5A43]"
              />
              <input
                type="text"
                value={sheetNameInput}
                onChange={(e) => setSheetNameInput(e.target.value)}
                placeholder="rekap Daily"
                title="Nama Sheet di Google Spreadsheet"
                className="sm:col-span-2 bg-[#F4F7F5] border border-[#B8C9BE] text-[#1C2822] text-xs font-semibold rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#2D5A43]"
              />
              <button
                type="button"
                disabled={isFetchingUrl || !urlInput.trim()}
                onClick={handleFetchFromUrl}
                className="sm:col-span-3 px-3 py-2 text-xs font-semibold bg-[#2D5A43] hover:bg-[#234735] disabled:opacity-50 text-white rounded-xl transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUrl ? 'animate-spin' : ''}`} />
                <span>Tarik Sheet</span>
              </button>
            </div>
            {errorMsg && <p className="text-xs text-rose-600 mt-1.5">{errorMsg}</p>}
            {successMsg && (
              <p className="text-xs text-[#1E6F43] font-semibold mt-1.5 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#3B5246]">
                Opsi 2: Paste Langsung dari Sheet rekap Daily (Ctrl+A, Ctrl+C lalu Ctrl+V) atau Upload File (.xlsx, .csv)
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D5A43] hover:underline cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File Spreadsheet</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={8}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="Paste seluruh isi Sheet rekap Daily di sini (mendukung format Copy-Paste langsung dari Google Sheets / Excel maupun CSV)..."
              className="w-full bg-[#F4F7F5] border border-[#B8C9BE] text-[#1C2822] font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-[#2D5A43]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E2EAE4]">
          <button
            type="button"
            onClick={() => {
              onResetDefault();
              onClose();
            }}
            className="px-3 py-2 text-xs font-medium text-[#526358] hover:text-[#1C2822] transition-colors"
          >
            Reset ke Base Sheet rekap Daily
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#3B5246] bg-[#E8EFEA] hover:bg-[#DCE7E0] rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isFetchingUrl}
              onClick={handleSaveAndSync}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#2D5A43] hover:bg-[#234735] disabled:opacity-50 rounded-xl transition-colors"
            >
              Simpan &amp; Sinkronkan Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
