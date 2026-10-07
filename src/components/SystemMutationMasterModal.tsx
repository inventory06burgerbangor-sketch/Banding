import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Database,
  Download,
  Package,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SystemMutationRecord } from '../types/inventory';
import {
  parseSystemMutationBuffer,
  parseSystemMutationCsvText,
} from '../utils/analyzer';

interface SystemMutationMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SystemMutationRecord[];
  onUpdateRecords: (newRecords: SystemMutationRecord[], replaceAll: boolean) => void;
  defaultTargetItem?: string;
  defaultDay?: number;
  availableItemNames?: string[];
}

export const SystemMutationMasterModal: React.FC<SystemMutationMasterModalProps> = ({
  isOpen,
  onClose,
  records,
  onUpdateRecords,
  defaultTargetItem = 'Semua Item',
  defaultDay = 5,
  availableItemNames = [],
}) => {
  const [pasteText, setPasteText] = useState<string>('');
  const [replaceMode, setReplaceMode] = useState<boolean>(false);
  const [targetItem, setTargetItem] = useState<string>(defaultTargetItem || 'Semua Item');
  const [selectedUploadDay, setSelectedUploadDay] = useState<number | 'AUTO'>('AUTO');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTargetItem) {
      setTargetItem(defaultTargetItem);
    }
  }, [defaultTargetItem]);

  useEffect(() => {
    if (defaultDay && defaultDay >= 1 && defaultDay <= 7) {
      setSelectedUploadDay(defaultDay);
    }
  }, [defaultDay]);

  if (!isOpen) return null;

  const applyDayOverrideIfSelected = (
    parsed: SystemMutationRecord[]
  ): SystemMutationRecord[] => {
    if (selectedUploadDay === 'AUTO') return parsed;
    const dayNum = Number(selectedUploadDay);
    const dateStr = `${String(dayNum).padStart(2, '0')} Okt 2026`;
    return parsed.map((r) => ({
      ...r,
      dayNumber: dayNum,
      date: dateStr,
      itemName:
        targetItem && targetItem !== 'Semua Item' ? targetItem : r.itemName,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMessage(null);

    const fallbackDay = selectedUploadDay === 'AUTO' ? defaultDay || 5 : selectedUploadDay;
    const itemNameToUse = targetItem.trim() || 'Semua Item';

    try {
      const fileNameLower = file.name.toLowerCase();
      let parsed: SystemMutationRecord[] = [];

      if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseSystemMutationCsvText(text, itemNameToUse, fallbackDay);
      } else {
        const buffer = await file.arrayBuffer();
        parsed = parseSystemMutationBuffer(buffer, itemNameToUse, fallbackDay);
      }

      if (parsed.length === 0) {
        setErrorMsg(
          'Tidak ditemukan baris transaksi yang valid. Pastikan file memiliki judul horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar.'
        );
        e.target.value = '';
        return;
      }

      const finalRecords = applyDayOverrideIfSelected(parsed);
      onUpdateRecords(finalRecords, replaceMode);
      setStatusMessage(
        `Berhasil mengupload ${finalRecords.length} baris mutasi dari "${file.name}" untuk item "${itemNameToUse}"${
          selectedUploadDay !== 'AUTO' ? ` pada tanggal ${selectedUploadDay} Okt 2026` : ''
        }.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membaca file Excel/CSV Master Mutasi.');
    } finally {
      e.target.value = '';
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    setErrorMsg(null);
    setStatusMessage(null);

    const fallbackDay = selectedUploadDay === 'AUTO' ? defaultDay || 5 : selectedUploadDay;
    const itemNameToUse = targetItem.trim() || 'Semua Item';

    try {
      const parsed = parseSystemMutationCsvText(pasteText, itemNameToUse, fallbackDay);
      if (parsed.length === 0) {
        setErrorMsg(
          'Format teks belum terbaca. Gunakan judul horizontal: Tanggal, Nomor, Deksripsi, Masuk, Keluar.'
        );
        return;
      }
      const finalRecords = applyDayOverrideIfSelected(parsed);
      onUpdateRecords(finalRecords, replaceMode);
      setStatusMessage(
        `Berhasil menyimpan ${finalRecords.length} baris mutasi untuk "${itemNameToUse}"${
          selectedUploadDay !== 'AUTO' ? ` pada tanggal ${selectedUploadDay} Okt 2026` : ''
        }.`
      );
      setPasteText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memproses teks yang ditempel.');
    }
  };

  const handleDownloadTemplateCsv = () => {
    const header = ['Tanggal', 'Nomor', 'Deksripsi', 'Masuk', 'Keluar'];
    const sampleItem =
      targetItem && targetItem !== 'Semua Item' ? targetItem : 'Dus Besar';
    const sampleDay =
      selectedUploadDay !== 'AUTO'
        ? `${String(selectedUploadDay).padStart(2, '0')} Okt 2026`
        : '05 Okt 2026';
    const sampleRows = [
      [sampleDay, 'RI.2026.10.00210', `"${sampleItem} - Penerimaan Barang Gudang"`, 250, 0],
      [sampleDay, 'DO.2026.10.00315', `"${sampleItem} - Pengeluaran Surat Jalan Outlet"`, 0, 125],
    ];
    const csv = [header.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Template_Mutasi_${sampleItem.replace(/\s+/g, '_')}.csv`;
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
                Upload Master Mutasi Barang
              </h3>
              <p className="text-xs text-slate-400">
                Judul Horizontal: <strong>Tanggal | Nomor | Deksripsi | Masuk | Keluar</strong> (Isian data vertikal)
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

        {/* Pilihan Nama Item & Pilihan Tanggal untuk Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Pilihan Nama Item untuk Mutasi Ini:</span>
            </label>
            <select
              value={targetItem}
              onChange={(e) => setTargetItem(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="Semua Item">Semua Item (Sesuai isi kolom Deksripsi)</option>
              {availableItemNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Pilihan Tanggal Mutasi:</span>
            </label>
            <select
              value={selectedUploadDay}
              onChange={(e) =>
                setSelectedUploadDay(
                  e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value)
                )
              }
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-sky-500"
            >
              <option value="AUTO">Otomatis Baca Kolom Tanggal dari File</option>
              {[1, 2, 3, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  Set Tanggal Upload: {String(d).padStart(2, '0')} Okt 2026
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload & Paste Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          {/* Left: File Upload Box */}
          <div className="border border-dashed border-sky-500/50 bg-slate-950/70 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400">
                  1. Upload File Excel / CSV (5 Kolom Horizontal)
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template</span>
                </button>
              </div>

              {/* Preview Struktur Judul Horizontal */}
              <div className="mt-2.5 grid grid-cols-5 text-center text-[11px] font-mono bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="py-1.5 px-1 bg-slate-800/80 text-sky-300 font-semibold border-r border-slate-700">
                  Tanggal
                </div>
                <div className="py-1.5 px-1 bg-slate-800/80 text-sky-300 font-semibold border-r border-slate-700">
                  Nomor
                </div>
                <div className="py-1.5 px-1 bg-slate-800/80 text-sky-300 font-semibold border-r border-slate-700">
                  Deksripsi
                </div>
                <div className="py-1.5 px-1 bg-slate-800/80 text-emerald-300 font-semibold border-r border-slate-700">
                  Masuk
                </div>
                <div className="py-1.5 px-1 bg-slate-800/80 text-rose-300 font-semibold">
                  Keluar
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={!replaceMode}
                    onChange={() => setReplaceMode(false)}
                    className="accent-amber-500"
                  />
                  <span>Tambahkan ke Rekap (Append)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={replaceMode}
                    onChange={() => setReplaceMode(true)}
                    className="accent-amber-500"
                  />
                  <span>Ganti Seluruh Rekap</span>
                </label>
              </div>
            </div>

            <label className="mt-4 flex flex-col items-center justify-center py-5 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-sky-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-100">
                Pilih File Mutasi (.xlsx, .xls, .csv)
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Tanggal | Nomor | Deksripsi | Masuk | Keluar
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
                2. Paste Data Vertikal (Tanggal | Nomor | Deksripsi | Masuk | Keluar)
              </span>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Tanggal\tNomor\tDeksripsi\tMasuk\tKeluar\n05 Okt 2026\tRI.2026.10.00210\tPenerimaan Gudang\t242\t0\n05 Okt 2026\tDO.2026.10.00312\tPengeluaran Outlet\t0\t120`}
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
                Simpan ke Rekap Mutasi
              </button>
            </div>
          </div>
        </div>

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

        {/* Active Master Data Vertical Table */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Rekap Mutasi Sistem Terupload ({records.length} Baris)
            </span>
            <button
              type="button"
              onClick={() => {
                onUpdateRecords([], true);
                setStatusMessage('Rekap Mutasi Sistem telah dikosongkan ulang.');
              }}
              className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Ulang Rekap Mutasi</span>
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
            {records.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                    <th className="py-2.5 px-3 font-semibold">Nomor</th>
                    <th className="py-2.5 px-3 font-semibold">Deksripsi (Nama Item)</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-emerald-400">Masuk</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-rose-400">Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-slate-200 whitespace-nowrap">{r.date}</td>
                      <td className="py-2 px-3 text-sky-300 font-semibold">{r.transactionNo}</td>
                      <td className="py-2 px-3 font-sans text-slate-200">
                        <span className="font-semibold text-amber-300">{r.itemName}:</span>{' '}
                        {r.description}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {r.qtyIn > 0 ? `+${r.qtyIn.toLocaleString('id-ID')}` : '0'}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-400">
                        {r.qtyOut > 0 ? `-${r.qtyOut.toLocaleString('id-ID')}` : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                Rekap Mutasi Sistem saat ini kosong. Silakan upload file mutasi atau paste data vertikal di atas.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
