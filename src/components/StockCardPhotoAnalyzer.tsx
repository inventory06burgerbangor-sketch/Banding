import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Flame,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  StockCardEntry,
  SystemMutationRecord,
} from '../types/inventory';

interface StockCardPhotoAnalyzerProps {
  stockCards: AnalyzedStockCard[];
  onSaveStockCard: (card: AnalyzedStockCard) => void;
  onDeleteStockCard: (id: string) => void;
  periodItems: PeriodItemAnalysis[];
  selectedItem: PeriodItemAnalysis;
  onSelectItemAnalysis: (item: PeriodItemAnalysis) => void;
  systemMutations: SystemMutationRecord[];
}

export const StockCardPhotoAnalyzer: React.FC<StockCardPhotoAnalyzerProps> = ({
  stockCards,
  onSaveStockCard,
  onDeleteStockCard,
  periodItems,
  selectedItem,
  onSelectItemAnalysis,
  systemMutations,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [targetItemName, setTargetItemName] = useState<string>(selectedItem.item.name);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string>(
    stockCards[0]?.id || ''
  );

  // Quick manual entry states for adding a row to active stock card
  const [newDay, setNewDay] = useState<number>(5);
  const [newDocNo, setNewDocNo] = useState<string>('');
  const [newQtyIn, setNewQtyIn] = useState<string>('0');
  const [newQtyOut, setNewQtyOut] = useState<string>('0');
  const [newBalance, setNewBalance] = useState<string>('0');
  const [newNotes, setNewNotes] = useState<string>('');

  const activeCard = useMemo(() => {
    const bySelected = stockCards.find(
      (c) => c.itemName.toLowerCase() === selectedItem.item.name.toLowerCase()
    );
    if (activeCardId) {
      const found = stockCards.find((c) => c.id === activeCardId);
      if (found) return found;
    }
    return bySelected || stockCards[0] || null;
  }, [stockCards, activeCardId, selectedItem.item.name]);

  // Find corresponding spreadsheet item for 3-way historical tracking comparison
  const linkedPeriodItem = useMemo(() => {
    if (!activeCard) return selectedItem;
    return (
      periodItems.find(
        (p) =>
          p.item.name.toLowerCase().trim() === activeCard.itemName.toLowerCase().trim() ||
          p.item.name.toLowerCase().includes(activeCard.itemName.toLowerCase()) ||
          activeCard.itemName.toLowerCase().includes(p.item.name.toLowerCase())
      ) || selectedItem
    );
  }, [activeCard, periodItems, selectedItem]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
      });
      reader.readAsDataURL(file);

      const dataUrl = await base64Promise;
      const base64Data = dataUrl.split(',')[1] || '';
      const mimeType = file.type || 'image/jpeg';

      const response = await fetch('/api/analyze-stock-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          itemNameHint: targetItemName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menganalisa foto Kartu Stok.');
      }

      const newCard: AnalyzedStockCard = {
        id: `sc-upload-${Date.now()}`,
        itemName: data.itemName || targetItemName || selectedItem.item.name,
        uom: data.uom || selectedItem.item.uom || 'Unit',
        uploadedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        imagePreviewUrl: dataUrl,
        summaryAnalysis:
          data.summaryAnalysis ||
          'Foto Kartu Stok berhasil diekstrak dan dihubungkan ke Banding Historical Tracking.',
        anomaliesFound: Array.isArray(data.anomaliesFound) ? data.anomaliesFound : [],
        entries: Array.isArray(data.entries)
          ? data.entries.map((row: any, idx: number) => ({
              id: `row-${Date.now()}-${idx}`,
              date: row.date || `${row.dayNumber || 1} Okt 2026`,
              dayNumber: Number(row.dayNumber) || 1,
              docNo: row.docNo || `KS-${idx + 1}`,
              qtyIn: Number(row.qtyIn) || 0,
              qtyOut: Number(row.qtyOut) || 0,
              balance: Number(row.balance) || 0,
              notes: row.notes || '-',
            }))
          : [],
      };

      onSaveStockCard(newCard);
      setActiveCardId(newCard.id);
      setSuccessMsg(
        `Foto Kartu Stok "${newCard.itemName}" berhasil dianalisa (${newCard.entries.length} baris mutasi) & digunakan untuk Banding Historical.`
      );

      // Sync selected item if matched
      const matched = periodItems.find(
        (p) => p.item.name.toLowerCase() === newCard.itemName.toLowerCase()
      );
      if (matched) {
        onSelectItemAnalysis(matched);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Gagal menganalisa foto secara otomatis. Anda tetap dapat menambahkan baris Kartu Stok secara manual di bawah.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddManualRow = () => {
    if (!activeCard) return;
    const entry: StockCardEntry = {
      id: `manual-${Date.now()}`,
      date: `${String(newDay).padStart(2, '0')} Okt 2026`,
      dayNumber: newDay,
      docNo: newDocNo.trim() || `KS-10/${newDay}`,
      qtyIn: Number(newQtyIn) || 0,
      qtyOut: Number(newQtyOut) || 0,
      balance: Number(newBalance) || 0,
      notes: newNotes.trim() || 'Input Kartu Stok',
    };

    const updated: AnalyzedStockCard = {
      ...activeCard,
      entries: [...activeCard.entries.filter((e) => e.dayNumber !== newDay), entry].sort(
        (a, b) => a.dayNumber - b.dayNumber
      ),
    };
    onSaveStockCard(updated);
    setNewDocNo('');
    setNewNotes('');
    setSuccessMsg(`Baris Kartu Stok tanggal ${newDay} Okt berhasil diperbarui.`);
  };

  return (
    <section
      id="stock-card-photo-menu"
      className="border border-slate-800 bg-slate-900/80 rounded-2xl p-6 shadow-xl"
    >
      {/* Header with Simple Menu Title & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Camera className="w-3.5 h-3.5" />
            <span>Menu Opsional · AI Vision OCR &amp; Banding Historical</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mt-0.5">
            Foto Kartu Stok (Opsional)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload foto Kartu Stok fisik gudang untuk dianalisa isinya dan dibandingkan langsung dengan SO Fisik &amp; Mutasi Sistem.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <span className="text-xs font-mono text-slate-400">
            {stockCards.length} Kartu Stok Aktif
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <span>{isExpanded ? 'Sembunyikan' : 'Buka Kartu Stok'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-800 space-y-5">
          {/* Upload Photo + Select Stock Card Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 5 Cols: Upload Foto Kartu Stok */}
            <div className="lg:col-span-5 border border-dashed border-amber-500/50 bg-slate-950/70 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload &amp; Analisa Foto Kartu Stok</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pilih item target lalu unggah foto Kartu Stok fisik (<code>.jpg</code>, <code>.png</code>). Sistem membaca tabel masuk/keluar/sisa secara otomatis.
                </p>

                <div className="mt-3">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Item Kartu Stok:
                  </label>
                  <select
                    value={targetItemName}
                    onChange={(e) => setTargetItemName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                  >
                    {periodItems.map((p) => (
                      <option key={p.item.id} value={p.item.name}>
                        {p.item.name} ({p.item.uom})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label
                className={`flex flex-col items-center justify-center py-5 px-4 rounded-xl border cursor-pointer transition-colors ${
                  isAnalyzing
                    ? 'bg-amber-500/20 border-amber-500/60 cursor-wait'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin mb-1.5" />
                    <span className="text-xs font-semibold text-amber-300">
                      Menganalisa Isi Foto Kartu Stok...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-amber-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-100">
                      Pilih Foto Kartu Stok (.jpg, .png, .webp)
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Otomatis diekstrak &amp; dibandingkan ke Historical Tracking
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isAnalyzing}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Right 7 Cols: Active Stock Card Summary & Selector */}
            <div className="lg:col-span-7 border border-slate-800 bg-slate-950/70 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Kartu Stok Terhubung:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {stockCards.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          setActiveCardId(sc.id);
                          const matched = periodItems.find(
                            (p) => p.item.name.toLowerCase() === sc.itemName.toLowerCase()
                          );
                          if (matched) onSelectItemAnalysis(matched);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          activeCard?.id === sc.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        {sc.itemName}
                      </button>
                    ))}
                    {activeCard && stockCards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteStockCard(activeCard.id)}
                        title="Hapus Kartu Stok Ini"
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {activeCard ? (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-100">
                        Hasil Analisa Kartu Stok: <span className="text-amber-400">{activeCard.itemName}</span> ({activeCard.uom})
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Update: {activeCard.uploadedAt}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                      {activeCard.summaryAnalysis}
                    </p>

                    {activeCard.anomaliesFound.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-rose-300">
                          Temuan Selisih Kartu Stok vs Sistem:
                        </div>
                        {activeCard.anomaliesFound.map((anom, i) => (
                          <div
                            key={i}
                            className="text-xs text-rose-200 bg-rose-950/35 border border-rose-500/40 rounded-lg px-3 py-1.5 flex items-start gap-2"
                          >
                            <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{anom}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    Belum ada Kartu Stok dipilih. Silakan upload foto Kartu Stok di sebelah kiri.
                  </div>
                )}
              </div>

              {/* Quick Manual Row Input for Active Card */}
              {activeCard && (
                <div className="pt-3 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-400 mb-2">
                    Tambah / Koreksi Baris Kartu Stok ({activeCard.itemName}):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <select
                      value={newDay}
                      onChange={(e) => setNewDay(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                    >
                      {[1, 2, 3, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {d} Okt
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="No. Bukti/SJ"
                      value={newDocNo}
                      onChange={(e) => setNewDocNo(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                    />
                    <input
                      type="number"
                      placeholder="Masuk"
                      value={newQtyIn}
                      onChange={(e) => setNewQtyIn(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Keluar"
                      value={newQtyOut}
                      onChange={(e) => setNewQtyOut(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Saldo Kartu"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualRow}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Tabel Banding Historical Tracking: Kartu Stok (Foto) vs SO Fisik vs Mutasi Sistem */}
          {activeCard && (
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Banding Historical Tracking: Kartu Stok vs SO vs Sistem ({linkedPeriodItem.item.name})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Membandingkan isi Kartu Stok fisik terhadap angka Stock Opname (SO) dan History Mutasi Sistem per tanggal.
                  </p>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Bukti Kartu Stok</th>
                      <th className="py-2.5 px-3 text-right">Mutasi Kartu (In / Out)</th>
                      <th className="py-2.5 px-3 text-right text-amber-300">Saldo Kartu Stok</th>
                      <th className="py-2.5 px-3 text-right">Stok Fisik (SO)</th>
                      <th className="py-2.5 px-3 text-right">Stok Accurate</th>
                      <th className="py-2.5 px-3">Hasil Banding &amp; Rekomendasi Pengecekan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {linkedPeriodItem.periodDaily
                      .filter((d) => d.day !== 4)
                      .map((d) => {
                        const cardRow = activeCard.entries.find((e) => e.dayNumber === d.day);
                        const sysMuts = systemMutations.filter(
                          (m) =>
                            m.dayNumber === d.day &&
                            m.itemName.toLowerCase().includes(linkedPeriodItem.item.name.toLowerCase())
                        );

                        const cardBal = cardRow ? cardRow.balance : null;
                        const soVal = d.so ?? 0;
                        const accVal = d.accurate ?? 0;
                        const hasVariance = d.selisih > 0;

                        let comparisonNote = 'Kartu Stok, SO Fisik, dan Sistem seimbang.';
                        if (cardBal !== null) {
                          if (d.day === 7 && soVal === 0 && cardBal > 0) {
                            comparisonNote = `Kartu Stok mencatat ${cardBal.toLocaleString(
                              'id-ID'
                            )} ${activeCard.uom} (${cardRow?.docNo}), tetapi SO belum diinput (0). Rekomendasi: Salin saldo Kartu Stok ke SO 7 Okt.`;
                          } else if (cardBal === soVal && cardBal !== accVal) {
                            comparisonNote = `Kartu Stok (${cardBal.toLocaleString(
                              'id-ID'
                            )}) KLOP dengan SO Fisik (${soVal.toLocaleString(
                              'id-ID'
                            )}), namun berbeda dari Sistem Accurate (${accVal.toLocaleString(
                              'id-ID'
                            )}). Rekomendasi: Cek bukti Kartu Stok [${
                              cardRow?.docNo
                            }] (${cardRow?.notes}) yang belum diposting di Accurate.`;
                          } else if (cardBal !== soVal) {
                            comparisonNote = `Saldo Kartu Stok (${cardBal.toLocaleString(
                              'id-ID'
                            )}) selisih ${Math.abs(cardBal - soVal).toLocaleString(
                              'id-ID'
                            )} dari SO Fisik (${soVal.toLocaleString(
                              'id-ID'
                            )}). Rekomendasi: Hitung ulang fisik rak & cek bukti [${cardRow?.docNo}].`;
                          }
                        } else if (hasVariance) {
                          comparisonNote = `Selisih SO vs Sistem ${d.selisih.toLocaleString(
                            'id-ID'
                          )} ${activeCard.uom}. ${
                            sysMuts[0]
                              ? `Cek mutasi sistem ${sysMuts[0].transactionNo}.`
                              : 'Cek mutasi tanggal ini.'
                          }`;
                        }

                        return (
                          <tr
                            key={d.day}
                            className={
                              d.isLowestAccuracyDay
                                ? 'bg-rose-950/40'
                                : hasVariance
                                ? 'bg-amber-500/5'
                                : ''
                            }
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                              {d.dateLabel} 2026
                            </td>
                            <td className="py-2.5 px-3 text-sky-300">
                              {cardRow ? cardRow.docNo : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {cardRow ? (
                                <span>
                                  <span className="text-emerald-400">
                                    +{cardRow.qtyIn.toLocaleString('id-ID')}
                                  </span>{' '}
                                  /{' '}
                                  <span className="text-rose-400">
                                    -{cardRow.qtyOut.toLocaleString('id-ID')}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                              {cardBal !== null ? cardBal.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-200">
                              {d.so !== null ? d.so.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-200">
                              {d.accurate !== null ? d.accurate.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-200 leading-relaxed">
                              {comparisonNote}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
