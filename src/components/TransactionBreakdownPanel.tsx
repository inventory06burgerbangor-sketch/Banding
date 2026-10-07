import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Database,
  Download,
  FileSearch,
  Flame,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  StockCardEntry,
  SystemMutationRecord,
} from '../types/inventory';
import {
  buildVarianceDateMutationComparisons,
  parseSystemMutationBuffer,
  parseSystemMutationCsvText,
} from '../utils/analyzer';

interface TransactionBreakdownPanelProps {
  selectedAnalysis: PeriodItemAnalysis | null;
  allPeriodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  onChangeRange: (start: number, end: number) => void;
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis | null) => void;
  systemMutations: SystemMutationRecord[];
  onUpdateMutationRecords: (newRecords: SystemMutationRecord[], replaceAll: boolean) => void;
  stockCards: AnalyzedStockCard[];
  onSaveStockCard: (card: AnalyzedStockCard) => void;
  onClearAllUploads: () => void;
  onOpenMutationUploadModal: () => void;
}

export const TransactionBreakdownPanel: React.FC<TransactionBreakdownPanelProps> = ({
  selectedAnalysis,
  allPeriodItems,
  startDay,
  endDay,
  onChangeRange,
  onSelectItemAnalysis,
  systemMutations,
  onUpdateMutationRecords,
  stockCards,
  onSaveStockCard,
  onClearAllUploads,
  onOpenMutationUploadModal,
}) => {
  // Opsi Pilihan Tanggal (Spesifik Tanggal atau Semua Tanggal dalam Periode)
  const [selectedDateFilter, setSelectedDateFilter] = useState<number | 'ALL'>('ALL');

  // Opsi Pilihan Tanggal & Nama Item khusus saat Upload Mutasi / Kartu Stock
  const [uploadDayTarget, setUploadDayTarget] = useState<number | 'AUTO'>('AUTO');
  const [uploadItemTarget, setUploadItemTarget] = useState<string>(
    selectedAnalysis?.item.name || ''
  );

  // Search Item state
  const [searchQuery, setSearchQuery] = useState<string>(
    selectedAnalysis?.item.name || ''
  );
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [showFullDailyTable, setShowFullDailyTable] = useState<boolean>(false);

  // Inline Upload Mutasi state
  const [mutationUploadStatus, setMutationUploadStatus] = useState<string | null>(null);
  const [mutationUploadError, setMutationUploadError] = useState<string | null>(null);

  // Inline Upload Kartu Stock Opsional state
  const [isAnalyzingCard, setIsAnalyzingCard] = useState<boolean>(false);
  const [cardStatus, setCardStatus] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [showManualCardInput, setShowManualCardInput] = useState<boolean>(false);
  const [manualDay, setManualDay] = useState<number>(5);
  const [manualDocNo, setManualDocNo] = useState<string>('');
  const [manualIn, setManualIn] = useState<string>('0');
  const [manualOut, setManualOut] = useState<string>('0');
  const [manualBal, setManualBal] = useState<string>('0');

  // Sync searchQuery & uploadItemTarget when selectedAnalysis changes externally (e.g., from Top 10 click)
  useEffect(() => {
    if (selectedAnalysis) {
      setSearchQuery(selectedAnalysis.item.name);
      setUploadItemTarget(selectedAnalysis.item.name);
    }
  }, [selectedAnalysis]);

  // Filter items for Search Item bar
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allPeriodItems.slice(0, 15);
    return allPeriodItems.filter(
      (p) =>
        p.item.name.toLowerCase().includes(q) ||
        p.item.category.toLowerCase().includes(q)
    );
  }, [allPeriodItems, searchQuery]);

  // Effective target item name for uploads
  const effectiveUploadItemName =
    uploadItemTarget.trim() ||
    selectedAnalysis?.item.name ||
    allPeriodItems[0]?.item.name ||
    'Semua Item';

  // Matched Master Mutasi ONLY for the searched item (and filtered by selectedDateFilter if set)
  const matchingMutations = useMemo(() => {
    if (!selectedAnalysis) return [];
    const tItem = selectedAnalysis.item.name.toLowerCase().trim();
    return systemMutations.filter((m) => {
      if (selectedDateFilter !== 'ALL' && m.dayNumber !== selectedDateFilter) {
        return false;
      }
      const mItem = m.itemName.toLowerCase().trim();
      return (
        mItem === 'semua item' ||
        mItem === tItem ||
        mItem.includes(tItem) ||
        tItem.includes(mItem) ||
        m.description.toLowerCase().includes(tItem)
      );
    });
  }, [systemMutations, selectedAnalysis, selectedDateFilter]);

  // Matched Kartu Stok ONLY for the searched item
  const matchedStockCard = useMemo(() => {
    if (!selectedAnalysis) return null;
    const tItem = selectedAnalysis.item.name.toLowerCase().trim();
    return (
      stockCards.find(
        (sc) =>
          sc.itemName.toLowerCase().trim() === tItem ||
          sc.itemName.toLowerCase().includes(tItem) ||
          tItem.includes(sc.itemName.toLowerCase())
      ) || null
    );
  }, [stockCards, selectedAnalysis]);

  // Build Variance Date Comparisons ONLY for the searched item (and filtered by selectedDateFilter)
  const varianceComparisons = useMemo(() => {
    if (!selectedAnalysis) return [];
    return buildVarianceDateMutationComparisons(
      selectedAnalysis,
      systemMutations,
      stockCards,
      selectedDateFilter
    );
  }, [selectedAnalysis, systemMutations, stockCards, selectedDateFilter]);

  // Handle Direct Upload Mutasi File (Fixed bug: supports .csv/.txt/.xlsx/.xls, resets input value, applies selected item & date)
  const handleInlineMutationFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMutationUploadError(null);
    setMutationUploadStatus(null);

    const fallbackDay =
      uploadDayTarget !== 'AUTO'
        ? Number(uploadDayTarget)
        : selectedDateFilter !== 'ALL'
        ? Number(selectedDateFilter)
        : selectedAnalysis?.lowestAccuracyDayRecord?.day || 5;

    try {
      const fileNameLower = file.name.toLowerCase();
      let parsed: SystemMutationRecord[] = [];

      if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseSystemMutationCsvText(
          text,
          effectiveUploadItemName,
          fallbackDay
        );
      } else {
        const buffer = await file.arrayBuffer();
        parsed = parseSystemMutationBuffer(
          buffer,
          effectiveUploadItemName,
          fallbackDay
        );
      }

      if (parsed.length === 0) {
        setMutationUploadError(
          'Data mutasi tidak terbaca. Pastikan file memiliki judul horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar.'
        );
        e.target.value = '';
        return;
      }

      // Jika user memilih tanggal spesifik pada Pilihan Tanggal Upload, terapkan ke baris yang diupload
      const finalParsed = parsed.map((r) => {
        const forcedDay =
          uploadDayTarget !== 'AUTO' ? Number(uploadDayTarget) : r.dayNumber;
        return {
          ...r,
          dayNumber: forcedDay,
          date:
            uploadDayTarget !== 'AUTO'
              ? `${String(forcedDay).padStart(2, '0')} Okt 2026`
              : r.date,
          itemName:
            effectiveUploadItemName && effectiveUploadItemName !== 'Semua Item'
              ? effectiveUploadItemName
              : r.itemName,
        };
      });

      onUpdateMutationRecords(finalParsed, false);

      // Jika belum ada item yang di-search tetapi user memilih item saat upload, otomatis buka analisa item tersebut
      if (!selectedAnalysis && effectiveUploadItemName !== 'Semua Item') {
        const foundItem = allPeriodItems.find(
          (p) =>
            p.item.name.toLowerCase() === effectiveUploadItemName.toLowerCase()
        );
        if (foundItem) {
          onSelectItemAnalysis(foundItem);
        }
      }

      setMutationUploadStatus(
        `Berhasil mengupload ${finalParsed.length} baris mutasi untuk "${effectiveUploadItemName}" dari file ${file.name}.`
      );
    } catch (err: any) {
      setMutationUploadError(err?.message || 'Gagal membaca file mutasi.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDownload5ColTemplate = () => {
    const header = ['Tanggal', 'Nomor', 'Deksripsi', 'Masuk', 'Keluar'];
    const sampleItem = effectiveUploadItemName || 'Dus Besar';
    const sampleDate =
      uploadDayTarget !== 'AUTO'
        ? `${String(uploadDayTarget).padStart(2, '0')} Okt 2026`
        : selectedDateFilter !== 'ALL'
        ? `${String(selectedDateFilter).padStart(2, '0')} Okt 2026`
        : '05 Okt 2026';
    const rows = [
      [sampleDate, 'RI.2026.10.00210', `"${sampleItem} - Penerimaan Supplier"`, 242, 0],
      [sampleDate, 'DO.2026.10.00315', `"${sampleItem} - Pengeluaran Gudang"`, 0, 120],
    ];
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Template_Mutasi_5Kolom_${sampleItem.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Optional Kartu Stock Photo Upload (AI Vision OCR)
  const handleStockCardPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardError(null);
    setCardStatus(null);
    setIsAnalyzingCard(true);

    const targetName = effectiveUploadItemName;

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });

      const base64Data = dataUrl.split(',')[1] || '';
      const mimeType = file.type || 'image/jpeg';

      const response = await fetch('/api/analyze-stock-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          itemNameHint: targetName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menganalisa foto Kartu Stok.');
      }

      const forcedDay =
        uploadDayTarget !== 'AUTO'
          ? Number(uploadDayTarget)
          : selectedDateFilter !== 'ALL'
          ? Number(selectedDateFilter)
          : null;

      const newCard: AnalyzedStockCard = {
        id: `sc-${Date.now()}`,
        itemName: targetName || data.itemName || 'Item',
        uom: selectedAnalysis?.item.uom || data.uom || 'Unit',
        uploadedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        imagePreviewUrl: dataUrl,
        summaryAnalysis:
          data.summaryAnalysis ||
          'Kartu Stok berhasil diekstrak dan dibandingkan dengan data mutasi & SO.',
        anomaliesFound: Array.isArray(data.anomaliesFound) ? data.anomaliesFound : [],
        entries: Array.isArray(data.entries)
          ? data.entries.map((row: any, idx: number) => {
              const dNum = forcedDay || Number(row.dayNumber) || 5;
              return {
                id: `row-${Date.now()}-${idx}`,
                date:
                  forcedDay
                    ? `${String(forcedDay).padStart(2, '0')} Okt 2026`
                    : row.date || `${String(dNum).padStart(2, '0')} Okt 2026`,
                dayNumber: dNum,
                docNo: row.docNo || `KS-${idx + 1}`,
                qtyIn: Number(row.qtyIn) || 0,
                qtyOut: Number(row.qtyOut) || 0,
                balance: Number(row.balance) || 0,
                notes: row.notes || '-',
              };
            })
          : [],
      };

      onSaveStockCard(newCard);
      setCardStatus(
        `Foto Kartu Stok "${newCard.itemName}" (${newCard.entries.length} baris) berhasil diupload & dibandingkan.`
      );
    } catch (err: any) {
      setCardError(
        err?.message ||
          'Gagal menganalisa foto otomatis. Gunakan tombol + Input Manual Kartu Stok.'
      );
    } finally {
      setIsAnalyzingCard(false);
      e.target.value = '';
    }
  };

  const handleSaveManualStockCardRow = () => {
    const targetName = effectiveUploadItemName;
    const entry: StockCardEntry = {
      id: `manual-${Date.now()}`,
      date: `${String(manualDay).padStart(2, '0')} Okt 2026`,
      dayNumber: manualDay,
      docNo: manualDocNo.trim() || `KS-10/0${manualDay}`,
      qtyIn: Number(manualIn) || 0,
      qtyOut: Number(manualOut) || 0,
      balance: Number(manualBal) || 0,
      notes: 'Input Kartu Stok',
    };

    if (matchedStockCard) {
      const updated: AnalyzedStockCard = {
        ...matchedStockCard,
        entries: [
          ...matchedStockCard.entries.filter((e) => e.dayNumber !== manualDay),
          entry,
        ].sort((a, b) => a.dayNumber - b.dayNumber),
      };
      onSaveStockCard(updated);
    } else {
      const created: AnalyzedStockCard = {
        id: `sc-manual-${Date.now()}`,
        itemName: targetName,
        uom: selectedAnalysis?.item.uom || 'Unit',
        uploadedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        summaryAnalysis: `Data Kartu Stok untuk ${targetName} pada ${manualDay} Okt 2026.`,
        anomaliesFound: [],
        entries: [entry],
      };
      onSaveStockCard(created);
    }

    setCardStatus(
      `Baris Kartu Stok tanggal ${manualDay} Okt untuk "${targetName}" berhasil disimpan.`
    );
    setManualDocNo('');
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================== */}
      {/* BAR FILTER UTAMA ANALISA: OPSI PILIHAN TANGGAL & PILIHAN NAMA ITEM       */}
      {/* ======================================================================== */}
      <section className="border border-amber-500/40 bg-slate-900/90 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <FileSearch className="w-4 h-4" />
              <span>Filter &amp; Kontrol Analisa Item</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
              Opsi Pilihan Tanggal &amp; Nama Item Analisa
            </h2>
          </div>

          {/* Tombol Kosongkan Ulang Rekap Mutasi Sistem & Kartu Stock */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Mutasi Terupload: <strong className="text-sky-400">{systemMutations.length}</strong> · Kartu Stock:{' '}
              <strong className="text-amber-400">{stockCards.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                onClearAllUploads();
                setMutationUploadStatus(null);
                setCardStatus(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/40 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Ulang Mutasi &amp; Kartu Stock</span>
            </button>
          </div>
        </div>

        {/* Grid: 1. Pilihan Nama Item (Search / Dropdown) | 2. Pilihan Tanggal Analisa | 3. Periode Rentang */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Kolom A: Pilihan Nama Item (Dropdown + Search Input) */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Pilihan Nama Item (Search / Pilih Barang):</span>
            </label>
            <div className="flex gap-2">
              {/* Dropdown Pilihan Nama Item */}
              <select
                value={selectedAnalysis?.item.id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    onSelectItemAnalysis(null);
                    setSearchQuery('');
                    return;
                  }
                  const found = allPeriodItems.find((p) => p.item.id === val);
                  if (found) {
                    onSelectItemAnalysis(found);
                    setSearchQuery(found.item.name);
                    setUploadItemTarget(found.item.name);
                  }
                }}
                className="w-1/2 bg-slate-950 border border-slate-700 focus:border-amber-400 text-slate-100 text-xs rounded-xl px-3 py-2.5 font-medium focus:outline-none"
              >
                <option value="">-- Pilih Nama Item --</option>
                {allPeriodItems.map((p) => (
                  <option key={p.item.id} value={p.item.id}>
                    {p.item.name} (Selisih: {p.periodSelisih.toLocaleString('id-ID')} {p.item.uom})
                  </option>
                ))}
              </select>

              {/* Search Input Nama Item */}
              <div className="relative w-1/2">
                <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  placeholder="Ketik cari item..."
                  className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 text-slate-100 text-xs rounded-xl pl-8 pr-7 py-2.5 focus:outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      onSelectItemAnalysis(null);
                      setIsSearchDropdownOpen(false);
                    }}
                    title="Kosongkan pencarian item"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {isSearchDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-72 right-0 max-h-60 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800/80">
                    {searchResults.length > 0 ? (
                      searchResults.map((p) => (
                        <button
                          key={p.item.id}
                          type="button"
                          onClick={() => {
                            onSelectItemAnalysis(p);
                            setSearchQuery(p.item.name);
                            setUploadItemTarget(p.item.name);
                            setIsSearchDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-slate-900 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">{p.item.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {p.item.category} · {p.item.uom}
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-rose-400 font-bold">
                              {p.periodAccuracyPercent.toFixed(1).replace('.', ',')}%
                            </div>
                            <div className="text-amber-300 text-[11px]">
                              Selisih: {p.periodSelisih.toLocaleString('id-ID')}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-slate-400">Item tidak ditemukan.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kolom B: Pilihan Tanggal Spesifik Analisa */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>2. Pilihan Tanggal Analisa &amp; Mutasi:</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedDateFilter('ALL');
                  setUploadDayTarget('AUTO');
                }}
                className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  selectedDateFilter === 'ALL'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                Semua Tgl Selisih
              </button>
              {[1, 2, 3, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter(d);
                    setUploadDayTarget(d);
                    setManualDay(d);
                  }}
                  className={`px-2.5 py-2 text-xs font-mono font-semibold rounded-xl border transition-colors ${
                    selectedDateFilter === d
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {d} Okt
                </button>
              ))}
            </div>
          </div>

          {/* Kolom C: Rentang Periode Tanggal */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Rentang Periode (Dari – Sampai):
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={startDay}
                onChange={(e) => onChangeRange(Number(e.target.value), endDay)}
                className="w-1/2 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-2.5 py-2.5 font-mono"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} Okt
                  </option>
                ))}
              </select>
              <span className="text-slate-500 text-xs">s/d</span>
              <select
                value={endDay}
                onChange={(e) => onChangeRange(startDay, Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-2.5 py-2.5 font-mono"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} Okt
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/* 2. DUA KOLOM UPLOAD: Kolom Upload Mutasi & Kolom Upload Kartu Stock      */}
      {/* ======================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* KOLOM 1: Kolom Upload Mutasi (Judul Horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar) */}
        <section className="border border-sky-500/40 bg-slate-900/85 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                <Database className="w-4 h-4" />
                <span>Kolom Upload Mutasi (Master Data)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload5ColTemplate}
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template 5 Kolom</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenMutationUploadModal}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
                >
                  Paste / Kelola Tabel
                </button>
              </div>
            </div>

            {/* Pilihan Nama Item & Tanggal untuk Upload File Mutasi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Nama Item untuk Upload Mutasi:
                </label>
                <select
                  value={uploadItemTarget || selectedAnalysis?.item.name || ''}
                  onChange={(e) => {
                    const name = e.target.value;
                    setUploadItemTarget(name);
                    const found = allPeriodItems.find((p) => p.item.name === name);
                    if (found) {
                      onSelectItemAnalysis(found);
                      setSearchQuery(found.item.name);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5"
                >
                  <option value="Semua Item">Semua Item (Sesuai File)</option>
                  {allPeriodItems.map((p) => (
                    <option key={p.item.id} value={p.item.name}>
                      {p.item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Tanggal untuk Upload Mutasi:
                </label>
                <select
                  value={uploadDayTarget}
                  onChange={(e) =>
                    setUploadDayTarget(
                      e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value)
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5"
                >
                  <option value="AUTO">Sesuai Kolom Tanggal di File</option>
                  {[1, 2, 3, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      Khusus Tanggal {String(d).padStart(2, '0')} Okt 2026
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visual Preview Judul Horizontal 5 Kolom */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 text-xs font-mono">
              <div className="grid grid-cols-5 bg-slate-800/90 text-slate-200 font-semibold text-center border-b border-slate-700">
                <div className="py-1.5 px-2 border-r border-slate-700 text-sky-300">
                  Tanggal
                </div>
                <div className="py-1.5 px-2 border-r border-slate-700 text-sky-300">
                  Nomor
                </div>
                <div className="py-1.5 px-2 border-r border-slate-700 text-sky-300">
                  Deksripsi
                </div>
                <div className="py-1.5 px-2 border-r border-slate-700 text-emerald-300">
                  Masuk
                </div>
                <div className="py-1.5 px-2 text-rose-300">Keluar</div>
              </div>
              {matchingMutations.length > 0 ? (
                matchingMutations.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-5 text-[11px] text-slate-300 border-b border-slate-900/80 last:border-0"
                  >
                    <div className="py-1.5 px-2 border-r border-slate-900 truncate">
                      {m.date}
                    </div>
                    <div className="py-1.5 px-2 border-r border-slate-900 text-sky-400 truncate">
                      {m.transactionNo}
                    </div>
                    <div className="py-1.5 px-2 border-r border-slate-900 font-sans truncate">
                      {m.description}
                    </div>
                    <div className="py-1.5 px-2 border-r border-slate-900 text-right text-emerald-400">
                      {m.qtyIn > 0 ? `+${m.qtyIn.toLocaleString('id-ID')}` : '0'}
                    </div>
                    <div className="py-1.5 px-2 text-right text-rose-400">
                      {m.qtyOut > 0 ? `-${m.qtyOut.toLocaleString('id-ID')}` : '0'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2.5 text-center text-[11px] font-sans text-slate-500">
                  Rekap mutasi sistem kosong{selectedAnalysis ? ` untuk ${selectedAnalysis.item.name}` : ''}. Upload file mutasi di bawah untuk mengisi.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-dashed border-sky-500/50 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-slate-100">
                Upload File Mutasi (.xlsx, .xls, .csv) — {effectiveUploadItemName}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleInlineMutationFileUpload}
                className="hidden"
              />
            </label>

            {mutationUploadStatus && (
              <div className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{mutationUploadStatus}</span>
              </div>
            )}
            {mutationUploadError && (
              <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded-lg px-3 py-1.5">
                {mutationUploadError}
              </div>
            )}
          </div>
        </section>

        {/* KOLOM 2: Kolom Upload Kartu Stock (Opsional) */}
        <section className="border border-amber-500/40 bg-slate-900/85 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Camera className="w-4 h-4" />
                <span>Kolom Upload Kartu Stock (Opsional)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualCardInput((v) => !v)}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              >
                {showManualCardInput ? 'Tutup Input Manual' : '+ Input Manual Kartu Stock'}
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Unggah foto Kartu Stok fisik untuk item{' '}
              <strong className="text-amber-300">{effectiveUploadItemName}</strong>. Rekap Kartu Stock hanya muncul jika ada upload di tanggal tersebut.
            </p>

            {matchedStockCard ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-400">
                    Kartu Stok Terupload: {matchedStockCard.itemName} ({matchedStockCard.entries.length} Baris)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {matchedStockCard.uploadedAt}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {matchedStockCard.summaryAnalysis}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400">
                Rekap Kartu Stock saat ini kosong untuk <strong>{effectiveUploadItemName}</strong> (Belum ada upload Kartu Stock).
              </div>
            )}

            {showManualCardInput && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] text-slate-400 font-medium">
                  Tambah Baris Kartu Stok ({effectiveUploadItemName}):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <select
                    value={manualDay}
                    onChange={(e) => setManualDay(Number(e.target.value))}
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
                    placeholder="Nomor Bukti"
                    value={manualDocNo}
                    onChange={(e) => setManualDocNo(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="number"
                    placeholder="Masuk"
                    value={manualIn}
                    onChange={(e) => setManualIn(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Keluar"
                    value={manualOut}
                    onChange={(e) => setManualOut(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Saldo"
                    value={manualBal}
                    onChange={(e) => setManualBal(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualStockCardRow}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-dashed cursor-pointer transition-colors ${
                isAnalyzingCard
                  ? 'bg-amber-500/20 border-amber-500/60 cursor-wait'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50'
              }`}
            >
              {isAnalyzingCard ? (
                <>
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-xs font-semibold text-amber-300">
                    Menganalisa Foto Kartu Stok...
                  </span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-100">
                    Upload Foto Kartu Stock (.jpg, .png, .webp)
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={isAnalyzingCard}
                onChange={handleStockCardPhotoUpload}
                className="hidden"
              />
            </label>

            {cardStatus && (
              <div className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{cardStatus}</span>
              </div>
            )}
            {cardError && (
              <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded-lg px-3 py-1.5">
                {cardError}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ======================================================================== */}
      {/* 3. KOLOM HASIL ANALISA — HANYA TAMPILKAN UNTUK ITEM YANG DI-SEARCH       */}
      {/* ======================================================================== */}
      <section
        id="item-historical-analysis"
        className="border border-slate-800 bg-slate-900/85 rounded-2xl p-6 shadow-xl space-y-6"
      >
        {!selectedAnalysis ? (
          /* STATE KETIKA BELUM ADA ITEM YANG DI-SEARCH: HANYA TAMPILKAN ANALISA JIKA ITEM DI-SEARCH */
          <div className="py-10 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-amber-400" />
            </div>
            <div className="max-w-lg mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-slate-100">
                Silakan Search / Pilih Nama Item Terlebih Dahulu
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sesuai pengaturan, halaman ini <strong>hanya menampilkan hasil analisa untuk item yang di-search</strong>. Gunakan kolom <strong>Pilihan Nama Item / Search</strong> di atas (atau klik item dari Top 10) untuk membuka analisa selisih, perbandingan mutasi, dan rekomendasi penyelesaian.
              </p>
            </div>

            {/* Pilihan Cepat Item Selisih Terbesar untuk Memudahkan Search */}
            <div className="pt-2">
              <div className="text-[11px] text-slate-400 mb-2">
                Atau klik salah satu item untuk langsung melakukan Search Analisa:
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {allPeriodItems.slice(0, 8).map((p) => (
                  <button
                    key={p.item.id}
                    type="button"
                    onClick={() => {
                      onSelectItemAnalysis(p);
                      setSearchQuery(p.item.name);
                      setUploadItemTarget(p.item.name);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-950 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-800 rounded-xl transition-colors"
                  >
                    {p.item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* STATE KETIKA ITEM SUDAH DI-SEARCH: TAMPILKAN ANALISA KHUSUS ITEM TERSEBUT */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <FileSearch className="w-4 h-4" />
                  <span>
                    Hasil Analisa Item yang Di-Search (
                    {selectedDateFilter === 'ALL'
                      ? `Periode ${startDay}–${endDay} Okt`
                      : `Khusus Tanggal ${selectedDateFilter} Okt 2026`}
                    )
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-100 mt-1">
                  Analisa Item:{' '}
                  <span className="text-amber-400">{selectedAnalysis.item.name}</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({selectedAnalysis.item.category} · Satuan: {selectedAnalysis.item.uom})
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectItemAnalysis(null);
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 self-start sm:self-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup / Ganti Search Item</span>
              </button>
            </div>

            {/* SUMMARY KPI BAR FOR SEARCHED ITEM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
                <div className="text-xs text-slate-400">
                  Akurasi Item ({startDay}–{endDay} Okt)
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-amber-400 mt-1">
                  {selectedAnalysis.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                </div>
                <div className="text-xs font-mono text-rose-400 mt-0.5">
                  Deviasi: {selectedAnalysis.gapFromBaseline100.toFixed(2).replace('.', ',')}% dari 100%
                </div>
              </div>

              <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
                <div className="text-xs text-slate-400">Total Jumlah Selisih Periode</div>
                <div className="text-2xl font-mono tabular-nums font-bold text-rose-400 mt-1">
                  {selectedAnalysis.periodSelisih.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    {selectedAnalysis.item.uom}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  Total SO Fisik: {selectedAnalysis.periodSO.toLocaleString('id-ID')}{' '}
                  {selectedAnalysis.item.uom}
                </div>
              </div>

              <div className="border-2 border-rose-500/70 bg-rose-950/25 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                  <span>Highlight Tgl Akurasi Terendah</span>
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                </div>
                {selectedAnalysis.lowestAccuracyDayRecord ? (
                  <>
                    <div className="text-xl font-mono tabular-nums font-bold text-rose-400 mt-1">
                      {selectedAnalysis.lowestAccuracyDayRecord.dateLabel} (
                      {(selectedAnalysis.lowestAccuracyDayRecord.dailyAccuracyPercent ?? 0)
                        .toFixed(2)
                        .replace('.', ',')}
                      %)
                    </div>
                    <div className="text-xs font-mono text-rose-200 mt-0.5">
                      Jumlah Selisih:{' '}
                      {selectedAnalysis.lowestAccuracyDayRecord.selisih.toLocaleString('id-ID')}{' '}
                      {selectedAnalysis.item.uom}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-emerald-400 mt-2">Akurasi 100% Klop</div>
                )}
              </div>

              <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
                <div className="text-xs text-slate-400">
                  Status Rekap Pembanding ({selectedAnalysis.item.name})
                </div>
                <div className="text-xs text-slate-200 mt-1.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Mutasi Terupload:</span>
                    <span className="font-mono text-sky-400 font-semibold">
                      {matchingMutations.length > 0
                        ? `${matchingMutations.length} Baris`
                        : 'Kosong (Belum Upload)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Kartu Stock:</span>
                    <span className="font-mono text-amber-300 font-semibold">
                      {matchedStockCard && matchedStockCard.entries.length > 0
                        ? `${matchedStockCard.entries.length} Baris`
                        : 'Kosong (Belum Upload)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* HASIL ANALISA BERDASAR TANGGAL SELISIH, JUMLAH SELISIH & TIPE SELISIH + POTENSI SELISIH & REKOMENDASI PENYELESAIAN */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-amber-400" />
                    <span>
                      Rincian Analisa Berdasarkan Tanggal, Jumlah Selisih &amp; Tipe Selisih (
                      {varianceComparisons.length} Tanggal)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rekap Mutasi Sistem &amp; Kartu Stock hanya ditampilkan jika sudah ada upload untuk{' '}
                    <strong>{selectedAnalysis.item.name}</strong> pada tanggal tersebut.
                  </p>
                </div>
              </div>

              {varianceComparisons.length > 0 ? (
                <div className="space-y-4">
                  {varianceComparisons.map((vc) => {
                    const hasUploadsForThisDay =
                      vc.matchedSystemMutations.length > 0 ||
                      vc.matchedStockCardEntries.length > 0;

                    return (
                      <div
                        key={vc.day}
                        className={`rounded-2xl p-5 border transition-all space-y-4 ${
                          vc.isLowestAccuracyDay
                            ? 'border-2 border-rose-500 bg-rose-950/25 shadow-lg shadow-rose-950/30'
                            : 'border-slate-800 bg-slate-950/80'
                        }`}
                      >
                        {/* 1. Header Bar: Tanggal Selisih, Jumlah Selisih, dan Tipe Selisih */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3.5 border-b border-slate-800">
                          {/* Tanggal Selisih */}
                          <div className="flex items-center gap-2.5">
                            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-slate-100">
                              {vc.dateLabel} 2026
                            </div>
                            <div>
                              <div className="text-[11px] text-slate-400">Tanggal Analisa</div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-rose-400">
                                  Akurasi: {vc.dailyAccuracyPercent.toFixed(2).replace('.', ',')}%
                                </span>
                                {vc.isLowestAccuracyDay && (
                                  <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">
                                    TERENDAH
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Jumlah Selisih */}
                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center justify-between">
                            <div>
                              <div className="text-[11px] text-slate-400">Jumlah Selisih</div>
                              <div className="text-base font-mono tabular-nums font-bold text-amber-300">
                                {vc.qtySelisih.toLocaleString('id-ID')}{' '}
                                {selectedAnalysis.item.uom}
                              </div>
                            </div>
                            <div className="text-right font-mono tabular-nums text-[11px] text-slate-300">
                              <div>
                                SO Fisik:{' '}
                                <strong>
                                  {vc.soFisik !== null
                                    ? vc.soFisik.toLocaleString('id-ID')
                                    : '-'}
                                </strong>
                              </div>
                              <div>
                                Sistem:{' '}
                                <strong>
                                  {vc.stokAccurate !== null
                                    ? vc.stokAccurate.toLocaleString('id-ID')
                                    : '-'}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Tipe Selisih */}
                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 flex flex-col justify-center">
                            <div className="text-[11px] text-slate-400">Tipe Selisih</div>
                            <div className="text-xs font-semibold text-rose-300 mt-0.5 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>{vc.varianceTypeLabel}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Tabel Pembanding Data Mutasi & Kartu Stock pada Tanggal Tersebut (HANYA MUNCUL JIKA ADA UPLOAD DI TGL TERSEBUT) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-sky-400">
                              Rekap Mutasi Sistem &amp; Kartu Stock pada {vc.dateLabel} 2026:
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {hasUploadsForThisDay
                                ? `${vc.matchedSystemMutations.length} Mutasi · ${vc.matchedStockCardEntries.length} Kartu Stock`
                                : 'Kosong (Belum ada upload di tanggal ini)'}
                            </span>
                          </div>

                          {hasUploadsForThisDay ? (
                            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/70">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                                    <th className="py-2 px-3">Sumber Upload</th>
                                    <th className="py-2 px-3">Tanggal</th>
                                    <th className="py-2 px-3">Nomor</th>
                                    <th className="py-2 px-3">Deksripsi &amp; Jenis Transaksi</th>
                                    <th className="py-2 px-3 text-right text-emerald-400">
                                      Masuk
                                    </th>
                                    <th className="py-2 px-3 text-right text-rose-400">Keluar</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                                  {vc.matchedSystemMutations.map((m) => (
                                    <tr key={m.id}>
                                      <td className="py-2 px-3 font-sans">
                                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-[11px]">
                                          Mutasi Sistem
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">{m.date}</td>
                                      <td className="py-2 px-3 text-sky-300 font-semibold">
                                        {m.transactionNo}
                                      </td>
                                      <td className="py-2 px-3 font-sans text-slate-200">
                                        <span className="text-amber-300 font-medium">
                                          [{m.transactionType}]
                                        </span>{' '}
                                        {m.description}
                                      </td>
                                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                                        {m.qtyIn > 0
                                          ? `+${m.qtyIn.toLocaleString('id-ID')}`
                                          : '0'}
                                      </td>
                                      <td className="py-2 px-3 text-right text-rose-400 font-semibold">
                                        {m.qtyOut > 0
                                          ? `-${m.qtyOut.toLocaleString('id-ID')}`
                                          : '0'}
                                      </td>
                                    </tr>
                                  ))}

                                  {vc.matchedStockCardEntries.map((sc) => (
                                    <tr key={sc.id} className="bg-amber-950/20">
                                      <td className="py-2 px-3 font-sans">
                                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[11px]">
                                          Kartu Stock
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">{sc.date}</td>
                                      <td className="py-2 px-3 text-amber-300 font-semibold">
                                        {sc.docNo}
                                      </td>
                                      <td className="py-2 px-3 font-sans text-slate-200">
                                        {sc.notes} (Saldo Kartu:{' '}
                                        {sc.balance.toLocaleString('id-ID')}{' '}
                                        {selectedAnalysis.item.uom})
                                      </td>
                                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                                        {sc.qtyIn > 0
                                          ? `+${sc.qtyIn.toLocaleString('id-ID')}`
                                          : '0'}
                                      </td>
                                      <td className="py-2 px-3 text-right text-rose-400 font-semibold">
                                        {sc.qtyOut > 0
                                          ? `-${sc.qtyOut.toLocaleString('id-ID')}`
                                          : '0'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <span>
                                Rekap Mutasi Sistem &amp; Kartu Stock untuk{' '}
                                <strong className="text-slate-200">
                                  {selectedAnalysis.item.name}
                                </strong>{' '}
                                pada tanggal <strong className="text-slate-200">{vc.dateLabel} 2026</strong> masih kosong (belum ada file mutasi yang diupload untuk tanggal ini).
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadItemTarget(selectedAnalysis.item.name);
                                  setUploadDayTarget(vc.day);
                                  onOpenMutationUploadModal();
                                }}
                                className="px-3 py-1.5 text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg shrink-0"
                              >
                                + Upload Mutasi {vc.dateLabel}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 3. Temuan Potensi Selisih (Analisa Tanggal, Jenis Transaksi & Jumlah) + Rekomendasi Penyelesaian */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 text-xs">
                          {/* Potensi Selisih */}
                          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-1.5">
                            <div className="font-bold text-amber-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                Potensi Selisih (Analisa Tanggal, Jenis Transaksi &amp; Jumlah)
                              </span>
                            </div>
                            <p className="text-slate-200 leading-relaxed">
                              {vc.potentialDiscrepancyFinding}
                            </p>
                            <p className="text-[11px] text-slate-400 pt-1 border-t border-amber-500/20">
                              {vc.mutationComparisonResult}
                            </p>
                          </div>

                          {/* Rekomendasi Penyelesaian */}
                          <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-1.5 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>Rekomendasi Penyelesaian</span>
                              </div>
                              <p className="text-slate-100 leading-relaxed font-medium">
                                {vc.checkRecommendation}
                              </p>
                            </div>
                            <div className="text-[11px] text-emerald-400/90 pt-1 border-t border-emerald-500/20">
                              Target: Menutup selisih{' '}
                              {vc.qtySelisih.toLocaleString('id-ID')}{' '}
                              {selectedAnalysis.item.uom} agar kembali ke Baseline 100%.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/15 text-center text-sm text-emerald-300">
                  Item <strong>{selectedAnalysis.item.name}</strong> tidak memiliki selisih pada filter tanggal yang dipilih (Akurasi 100%).
                </div>
              )}
            </div>

            {/* Optional Toggle for Full 1-7 Oct Daily Table */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowFullDailyTable((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300"
              >
                <span>
                  {showFullDailyTable
                    ? 'Sembunyikan Tabel Rincian Harian (1–7 Okt)'
                    : 'Tampilkan Tabel Rincian Harian Lengkap (1–7 Okt)'}
                </span>
                {showFullDailyTable ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showFullDailyTable && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3 text-right">Akurasi</th>
                        <th className="py-2.5 px-3 text-right">Jumlah Selisih</th>
                        <th className="py-2.5 px-3 text-right">SO Fisik</th>
                        <th className="py-2.5 px-3 text-right">&Delta; SO</th>
                        <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 text-right">&Delta; Sistem</th>
                        <th className="py-2.5 px-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                      {selectedAnalysis.periodDaily.map((d) => (
                        <tr
                          key={d.day}
                          className={d.isLowestAccuracyDay ? 'bg-rose-950/40' : ''}
                        >
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {d.dateLabel} 2026
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-300">
                            {d.day === 4
                              ? '-'
                              : `${(d.dailyAccuracyPercent ?? 0)
                                  .toFixed(2)
                                  .replace('.', ',')}%`}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-rose-300">
                            {d.selisih.toLocaleString('id-ID')}{' '}
                            {selectedAnalysis.item.uom}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-200">
                            {d.so !== null ? d.so.toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {d.deltaSO !== null
                              ? `${d.deltaSO >= 0 ? '+' : ''}${d.deltaSO.toLocaleString(
                                  'id-ID'
                                )}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-200">
                            {d.accurate !== null
                              ? d.accurate.toLocaleString('id-ID')
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {d.deltaAccurate !== null
                              ? `${
                                  d.deltaAccurate >= 0 ? '+' : ''
                                }${d.deltaAccurate.toLocaleString('id-ID')}`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-300">
                            {d.transactionNote}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
