import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SystemMutationRecord } from '../types/inventory';
import {
  INITIAL_SYSTEM_MUTATION_MASTER,
  parseSystemMutationBuffer,
  parseSystemMutationCsvText,
} from '../utils/analyzer';

interface SystemMutationMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SystemMutationRecord[];
  onUpdateRecords: (newRecords: SystemMutationRecord[], replaceAll: boolean) => void;
}

export const SystemMutationMasterModal: React.FC<SystemMutationMasterModalProps> = ({
  isOpen,
  onClose,
  records,
  onUpdateRecords,
}) => {
  const [pasteText, setPasteText] = useState<string>('');
  const [replaceMode, setReplaceMode] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSystemMutationBuffer(buffer);
      if (parsed.length === 0) {
        setErrorMsg(
          'Tidak ditemukan baris transaksi yang valid. Pastikan file memiliki kolom Tanggal, Nama Barang/Item, Qty Masuk/Keluar, atau Saldo.'
        );
        return;
      }
      onUpdateRecords(parsed, replaceMode);
      setStatusMessage(
        `Berhasil memuat ${parsed.length} baris transaksi dari "${file.name}" sebagai Master Data Histori Mutasi Sistem.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membaca file Excel/CSV Histori Mutasi.');
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    setErrorMsg(null);
    setStatusMessage(null);

    try {
      const parsed = parseSystemMutationCsvText(pasteText);
      if (parsed.length === 0) {
        setErrorMsg('Format teks belum terbaca. Pastikan menyertakan baris header dan data.');
        return;
      }
      onUpdateRecords(parsed, replaceMode);
      setStatusMessage(
        `Berhasil menerapkan ${parsed.length} baris dari input teks sebagai Master Data Histori Mutasi Sistem.`
      );
      setPasteText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memproses teks yang ditempel.');
    }
  };

  const handleDownloadTemplateCsv = () => {
    const header = [
      'Tanggal',
      'Nama Barang',
      'No. Bukti',
      'Tipe Transaksi',
      'Qty Masuk',
      'Qty Keluar',
      'Saldo Akhir',
      'Satuan',
      'Gudang',
      'Keterangan',
    ];
    const sampleRows = INITIAL_SYSTEM_MUTATION_MASTER.map((r) => [
      r.date,
      `"${r.itemName}"`,
      r.transactionNo,
      `"${r.transactionType}"`,
      r.qtyIn,
      r.qtyOut,
      r.balanceAfter ?? '',
      r.uom,
      `"${r.warehouse}"`,
      `"${r.description}"`,
    ]);
    const csv = [header.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Master_Histori_Mutasi_Sistem.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Upload &amp; Kelola Master Data Histori Mutasi By Sistem
              </h3>
              <p className="text-xs text-slate-400">
                Mendukung file Excel (.xlsx, .xls), CSV (.csv), maupun Copy-Paste langsung dari laporan Histori Mutasi Accurate / ERP.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload & Mode Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {/* Left: File Upload Box */}
          <div className="border border-dashed border-sky-500/50 bg-slate-950/70 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400">
                  1. Upload File Excel / CSV Master Mutasi
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Standar</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Deteksi otomatis kolom: <span className="font-mono text-slate-300">Tanggal</span>,{' '}
                <span className="font-mono text-slate-300">Nama Barang / Item</span>,{' '}
                <span className="font-mono text-slate-300">No. Bukti</span>,{' '}
                <span className="font-mono text-slate-300">Tipe Transaksi</span>,{' '}
                <span className="font-mono text-slate-300">Masuk (In)</span>,{' '}
                <span className="font-mono text-slate-300">Keluar (Out)</span>, dan{' '}
                <span className="font-mono text-slate-300">Saldo</span>.
              </p>

              {/* Mode: Replace vs Append */}
              <div className="flex items-center gap-3 mt-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={replaceMode}
                    onChange={() => setReplaceMode(true)}
                    className="accent-amber-500"
                  />
                  <span>Jadikan Master Baru (Ganti Data Lama)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={!replaceMode}
                    onChange={() => setReplaceMode(false)}
                    className="accent-amber-500"
                  />
                  <span>Tambahkan (Append)</span>
                </label>
              </div>
            </div>

            <label className="mt-4 flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-sky-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-100">
                Pilih File Histori Mutasi (.xlsx, .xls, .csv)
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Format file yang Anda kirim nanti juga langsung kompatibel di sini
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Right: Copy-Paste Box */}
          <div className="border border-slate-800 bg-slate-950/70 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-400">
                2. Atau Paste Langsung Tabel Histori Mutasi dari Excel / Accurate
              </span>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Tanggal,Nama Barang,No. Bukti,Tipe Transaksi,Qty Masuk,Qty Keluar,Saldo Akhir,Satuan,Keterangan..."
                className="w-full mt-2 bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handlePasteSubmit}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-lg transition-colors"
              >
                Simpan Paste ke Master Data
              </button>
            </div>
          </div>
        </div>

        {/* Status / Error Message */}
        {statusMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Current Active Master Data Preview Table */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Preview Master Data Histori Mutasi Sistem Aktif ({records.length} Baris Transaksi)
            </span>
            <button
              type="button"
              onClick={() => {
                onUpdateRecords(INITIAL_SYSTEM_MUTATION_MASTER, true);
                setStatusMessage('Master Data Histori Mutasi dikembalikan ke data default.');
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset ke Sample Default</span>
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Nama Barang</th>
                  <th className="py-2 px-3">No. Bukti</th>
                  <th className="py-2 px-3">Tipe Transaksi</th>
                  <th className="py-2 px-3 text-right">Masuk (In)</th>
                  <th className="py-2 px-3 text-right">Keluar (Out)</th>
                  <th className="py-2 px-3 text-right">Saldo</th>
                  <th className="py-2 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{r.date}</td>
                    <td className="py-2 px-3 font-sans font-semibold text-slate-100">
                      {r.itemName}
                    </td>
                    <td className="py-2 px-3 text-sky-300">{r.transactionNo}</td>
                    <td className="py-2 px-3 font-sans text-slate-300">{r.transactionType}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      {r.qtyIn > 0 ? `+${r.qtyIn.toLocaleString('id-ID')}` : '0'}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-400">
                      {r.qtyOut > 0 ? `-${r.qtyOut.toLocaleString('id-ID')}` : '0'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">
                      {r.balanceAfter !== null ? r.balanceAfter.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-400 truncate max-w-xs">
                      {r.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
          >
            Selesai &amp; Terapkan ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
