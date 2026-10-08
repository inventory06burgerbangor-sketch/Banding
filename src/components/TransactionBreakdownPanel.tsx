import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Compass,
  FileSearch,
  Flame,
  Layers,
  Loader2,
  Radar,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  AnalyzedStockCard,
  DailyAccuracySummary,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from '../types/inventory';
import {
  buildVarianceDateMutationComparisons,
  parseSystemMutationBuffer,
  parseSystemMutationCsvText,
} from '../utils/analyzer';
import { CalendarPeriodPicker } from './CalendarPeriodPicker';

interface TransactionBreakdownPanelProps {
  selectedAnalysis: PeriodItemAnalysis | null;
  allPeriodItems: PeriodItemAnalysis[];
  availableDays: number[];
  monthLabel: string;
  dailySummaries?: DailyAccuracySummary[];
  startDay: number;
  endDay: number;
  onChangeRange: (start: number, end: number) => void;
  onSelectItemAnalysis: (item: PeriodItemAnalysis | null) => void;
  systemMutations: SystemMutationRecord[];
  onUpdateMutationRecords: (
    records: SystemMutationRecord[],
    replaceAll?: boolean
  ) => void;
  stockCards: AnalyzedStockCard[];
  onSaveStockCard: (card: AnalyzedStockCard) => void;
}

export const TransactionBreakdownPanel: React.FC<TransactionBreakdownPanelProps> = ({
  selectedAnalysis,
  allPeriodItems,
  availableDays,
  monthLabel,
  dailySummaries = [],
  startDay,
  endDay,
  onChangeRange,
  onSelectItemAnalysis,
  systemMutations,
  onUpdateMutationRecords,
  stockCards,
  onSaveStockCard,
}) => {
  // 1. State Upload Mutasi Sistem & Upload Kartu Stock (Hanya menampilkan "Upload berhasil")
  const [mutationUploadSuccess, setMutationUploadSuccess] = useState<boolean>(false);
  const [mutationUploadError, setMutationUploadError] = useState<string | null>(null);

  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [stockCardUploadSuccess, setStockCardUploadSuccess] = useState<boolean>(false);
  const [stockCardUploadError, setStockCardUploadError] = useState<string | null>(null);

  // 2. State Search Item, Filter ("Tampilkan semua" vs "Tampilkan hanya selisih"), dan Breakdown per tanggal
  const [searchQuery, setSearchQuery] = useState<string>(
    selectedAnalysis ? selectedAnalysis.item.name : ''
  );
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<'ALL_DATES' | 'VARIANCE_ONLY'>(
    'VARIANCE_ONLY'
  );
  const [criteriaFilter, setCriteriaFilter] = useState<
    'ALL' | 'FISIK_KURANG' | 'FISIK_LEBIH'
  >('ALL');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (selectedAnalysis) {
      setSearchQuery(selectedAnalysis.item.name);
      // Buka otomatis tanggal dengan akurasi terendah (>0%) atau tanggal pertama yang berselisih
      const firstVarDay =
        selectedAnalysis.lowestAccuracyDayRecord?.day ??
        selectedAnalysis.periodDaily.find((d) => d.selisih > 0)?.day;
      if (firstVarDay) {
        setExpandedDays({ [firstVarDay]: true });
      } else {
        setExpandedDays({});
      }
    }
  }, [selectedAnalysis]);

  const toggleDayBreakdown = (day: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  // Search suggestions
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allPeriodItems.slice(0, 25);
    return allPeriodItems
      .filter(
        (p) =>
          p.item.name.toLowerCase().includes(q) ||
          p.item.category.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allPeriodItems, searchQuery]);

  // Hasil analisa berdasarkan item yang di-search
  const allComparisonsForItem = useMemo(() => {
    if (!selectedAnalysis) return [];
    return buildVarianceDateMutationComparisons(
      selectedAnalysis,
      systemMutations,
      stockCards,
      'ALL',
      displayMode
    );
  }, [selectedAnalysis, systemMutations, stockCards, displayMode]);

  const dateComparisons = useMemo(() => {
    if (criteriaFilter === 'ALL') return allComparisonsForItem;
    return allComparisonsForItem.filter((c) => c.majorCriteria === criteriaFilter);
  }, [allComparisonsForItem, criteriaFilter]);

  // Ringkasan 2 Kriteria Besar (Fisik Kurang vs Fisik Lebih) untuk item yang di-search
  const criteriaSummary = useMemo(() => {
    const kurangList = allComparisonsForItem.filter(
      (c) => c.majorCriteria === 'FISIK_KURANG'
    );
    const lebihList = allComparisonsForItem.filter(
      (c) => c.majorCriteria === 'FISIK_LEBIH'
    );
    const totalKurangQty = kurangList.reduce((acc, c) => acc + c.qtySelisih, 0);
    const totalLebihQty = lebihList.reduce((acc, c) => acc + c.qtySelisih, 0);
    return {
      kurangCount: kurangList.length,
      lebihCount: lebihList.length,
      totalKurangQty,
      totalLebihQty,
      kurangDays: kurangList.map((c) => c.dateLabel),
      lebihDays: lebihList.map((c) => c.dateLabel),
    };
  }, [allComparisonsForItem]);

  // Handler 1: Upload Mutasi Sistem
  const handleSystemMutationUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMutationUploadSuccess(false);
    setMutationUploadError(null);

    try {
      const targetItemName = selectedAnalysis
        ? selectedAnalysis.item.name
        : 'Semua Item';
      const knownItemNames = allPeriodItems.map((p) => p.item.name);
      const lower = file.name.toLowerCase();
      let parsedRecords: SystemMutationRecord[] = [];
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        parsedRecords = parseSystemMutationBuffer(
          buffer,
          targetItemName,
          startDay,
          knownItemNames,
          file.name
        );
      } else {
        const text = await file.text();
        parsedRecords = parseSystemMutationCsvText(
          text,
          targetItemName,
          startDay,
          knownItemNames,
          file.name
        );
      }

      if (parsedRecords.length === 0) {
        setMutationUploadError('Format file tidak terbaca.');
      } else {
        onUpdateMutationRecords(parsedRecords, false);
        setMutationUploadSuccess(true);
      }
    } catch {
      setMutationUploadError('Gagal memproses file.');
    } finally {
      e.target.value = '';
    }
  };

  // Handler 2: Upload Kartu Stock
  const handleStockCardPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPhoto(true);
    setStockCardUploadSuccess(false);
    setStockCardUploadError(null);

    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });

      const base64Data = dataUrl.split(',')[1] || '';
      const response = await fetch('/api/analyze-stock-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
          hintItemName: selectedAnalysis?.item.name || '',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Gagal menganalisa Kartu Stock.');
      }

      const newCard: AnalyzedStockCard = {
        id: `sc-${Date.now()}`,
        itemName:
          result.itemName || selectedAnalysis?.item.name || 'Item Kartu Stock',
        uom: result.uom || selectedAnalysis?.item.uom || 'Unit',
        uploadedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        imagePreviewUrl: dataUrl,
        summaryAnalysis: result.summaryAnalysis || '',
        anomaliesFound: Array.isArray(result.anomaliesFound)
          ? result.anomaliesFound
          : [],
        entries: Array.isArray(result.entries)
          ? result.entries.map((en: any, i: number) => ({
              id: `sce-${Date.now()}-${i}`,
              date: String(en.date || '-'),
              dayNumber: Number(en.dayNumber) || 1,
              docNo: String(en.docNo || '-'),
              qtyIn: Number(en.qtyIn) || 0,
              qtyOut: Number(en.qtyOut) || 0,
              balance: Number(en.balance) || 0,
              notes: String(en.notes || ''),
            }))
          : [],
      };

      onSaveStockCard(newCard);
      setStockCardUploadSuccess(true);
    } catch {
      setStockCardUploadError('Gagal memproses Kartu Stock.');
    } finally {
      setIsAnalyzingPhoto(false);
      e.target.value = '';
    }
  };

  return (
    <section id="item-historical-analysis" className="space-y-6">
      {/* ===================================================================== */}
      {/* URUTAN 1: UPLOAD MUTASI SISTEM & UPLOAD KARTU STOCK                    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1A. Upload Mutasi Sistem */}
        <div className="bg-white border border-[#C5D3C9] rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-[#1C2822] block">
              Upload Mutasi Sistem
            </span>
            {mutationUploadSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E6F43]">
                <CheckCircle2 className="w-4 h-4" />
                Upload berhasil
              </span>
            )}
            {mutationUploadError && (
              <span className="text-xs font-medium text-rose-600 block">
                {mutationUploadError}
              </span>
            )}
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D5A43] hover:bg-[#234735] text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 shadow-sm">
            <Upload className="w-4 h-4" />
            <span>Upload</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={handleSystemMutationUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* 1B. Upload Kartu Stock */}
        <div className="bg-white border border-[#C5D3C9] rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-[#1C2822] block">
              Upload Kartu Stock
            </span>
            {stockCardUploadSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E6F43]">
                <CheckCircle2 className="w-4 h-4" />
                Upload berhasil
              </span>
            )}
            {stockCardUploadError && (
              <span className="text-xs font-medium text-rose-600 block">
                {stockCardUploadError}
              </span>
            )}
          </div>

          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 shadow-sm ${
              isAnalyzingPhoto
                ? 'bg-[#638270] text-white cursor-wait'
                : 'bg-[#2D5A43] hover:bg-[#234735] text-white'
            }`}
          >
            {isAnalyzingPhoto ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>Upload</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={isAnalyzingPhoto}
              onChange={handleStockCardPhotoUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* URUTAN 2: SEARCH BAR ITEM + PILIHAN TANGGAL MUTASI + FILTER            */}
      {/* ===================================================================== */}
      <div className="bg-white border border-[#C5D3C9] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Kolom 1: Search Bar Untuk Item */}
          <div className="lg:col-span-5 relative">
            <label className="block text-xs font-semibold text-[#3B5246] mb-1.5">
              Cari &amp; Pilih Nama Item
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#526358] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                  if (e.target.value.trim() === '') {
                    onSelectItemAnalysis(null);
                  }
                }}
                placeholder="Ketik nama item (contoh: Bun Burger, Beef Patty, Mayo)..."
                className="w-full bg-[#F4F7F5] border border-[#B8C9BE] focus:border-[#2D5A43] rounded-xl pl-10 pr-9 py-2.5 text-xs font-medium text-[#1C2822] placeholder-[#6C7E73] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onSelectItemAnalysis(null);
                    setIsSearchDropdownOpen(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#526358] hover:text-[#1C2822]"
                  title="Kosongkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isSearchDropdownOpen && (
              <div className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto bg-white border border-[#B8C9BE] rounded-xl shadow-xl divide-y divide-[#E6ECE8]">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#526358]">
                    Item &ldquo;{searchQuery}&rdquo; tidak ditemukan.
                  </div>
                ) : (
                  searchResults.map((p) => {
                    const isSelected = selectedAnalysis?.item.id === p.item.id;
                    return (
                      <button
                        key={p.item.id}
                        type="button"
                        onClick={() => {
                          onSelectItemAnalysis(p);
                          setSearchQuery(p.item.name);
                          setIsSearchDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-[#E6EFE9] text-[#1C2822]'
                            : 'hover:bg-[#F4F7F5] text-[#1C2822]'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold">{p.item.name}</div>
                          <div className="text-[11px] text-[#526358]">
                            {p.item.category} · Satuan: {p.item.uom}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div
                            className={`text-xs font-bold ${
                              p.periodAccuracyPercent < 85
                                ? 'text-rose-600'
                                : p.periodAccuracyPercent < 95
                                ? 'text-amber-600'
                                : 'text-[#1E6F43]'
                            }`}
                          >
                            Akurasi {p.periodAccuracyPercent.toFixed(2)}%
                          </div>
                          <div className="text-[11px] text-[#526358]">
                            Selisih: {p.periodSelisih.toLocaleString('id-ID')} {p.item.uom}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Kolom 2: Pilihan Tanggal Mutasi */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-[#3B5246] mb-1.5">
              Tanggal Mutasi
            </label>
            <CalendarPeriodPicker
              availableDays={availableDays}
              startDay={startDay}
              endDay={endDay}
              monthLabel={monthLabel}
              dailySummaries={dailySummaries}
              onChangeRange={onChangeRange}
            />
          </div>

          {/* Kolom 3: Menu Pilihan: Tampilkan semua - Tampilkan hanya selisih */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-[#3B5246] mb-1.5">
              Filter Tampilan Tanggal
            </label>
            <select
              value={displayMode}
              onChange={(e) =>
                setDisplayMode(e.target.value as 'ALL_DATES' | 'VARIANCE_ONLY')
              }
              className="w-full bg-[#F4F7F5] border border-[#B8C9BE] focus:border-[#2D5A43] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C2822] focus:outline-none"
            >
              <option value="VARIANCE_ONLY">Tampilkan hanya selisih</option>
              <option value="ALL_DATES">Tampilkan semua</option>
            </select>
          </div>
        </div>

        {/* ================================================================= */}
        {/* HASIL ANALISA ITEM YANG DI-SEARCH                                 */}
        {/* ================================================================= */}
        {!selectedAnalysis ? (
          <div className="border border-dashed border-[#B8C9BE] rounded-2xl p-10 text-center bg-[#F6F9F7]">
            <FileSearch className="w-8 h-8 text-[#2D5A43] mx-auto mb-2.5 opacity-80" />
            <p className="text-sm font-semibold text-[#1C2822]">
              Silakan cari dan pilih item pada kolom Search di atas
            </p>
            <p className="text-xs text-[#526358] mt-1">
              Analisa menggunakan Acuan Hitungan SO Sebelumnya, terbagi dalam 2 Kriteria Besar (Fisik Kurang &amp; Fisik Lebih) beserta Deepsearch dan Rekomendasi Arahan.
            </p>
          </div>
        ) : (
          <div
            className="space-y-5"
            onClick={() => {
              if (isSearchDropdownOpen) setIsSearchDropdownOpen(false);
            }}
          >
            {/* Ringkasan Item Terpilih */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#F2F6F3] border border-[#C5D3C9]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#1C2822]">
                    {selectedAnalysis.item.name}
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#E0EBE4] text-[#234735]">
                    {selectedAnalysis.item.uom}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-white border border-[#C5D3C9] text-[#3B5246]">
                    Tanggal {startDay}–{endDay} {monthLabel}
                  </span>
                </div>
                <p className="text-xs text-[#4A5D52] mt-1">
                  Acuan Analisa: <strong>Hitungan SO Sebelumnya</strong> (Contoh: Jika Tgl 1 ada 20, Tgl 2 Out 5 → SO Tgl 2 harusnya 15) · Terbagi ke dalam 2 Kriteria Besar: <strong>Fisik Kurang</strong> &amp; <strong>Fisik Lebih</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
                <div>
                  <span className="text-[10px] uppercase text-[#526358] block">
                    Akurasi Item
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      selectedAnalysis.periodAccuracyPercent < 85
                        ? 'text-rose-600'
                        : selectedAnalysis.periodAccuracyPercent < 95
                        ? 'text-amber-600'
                        : 'text-[#1E6F43]'
                    }`}
                  >
                    {selectedAnalysis.periodAccuracyPercent.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#526358] block">
                    Total Selisih
                  </span>
                  <span className="text-sm font-bold text-rose-600">
                    {selectedAnalysis.periodSelisih.toLocaleString('id-ID')}{' '}
                    {selectedAnalysis.item.uom}
                  </span>
                </div>
                {selectedAnalysis.lowestAccuracyDayRecord && (
                  <div>
                    <span className="text-[10px] uppercase text-rose-700 font-semibold block">
                      Akurasi Terendah (&gt;0%)
                    </span>
                    <span className="text-sm font-bold text-rose-600">
                      {selectedAnalysis.lowestAccuracyDayRecord.dateLabel} (
                      {(
                        selectedAnalysis.lowestAccuracyDayRecord.dailyAccuracyPercent ?? 0
                      ).toFixed(2)}
                      %)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* =============================================================== */}
            {/* RINGKASAN 2 KRITERIA BESAR SELISIH (FISIK KURANG & FISIK LEBIH)  */}
            {/* =============================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kriteria 1: FISIK KURANG */}
              <div
                onClick={() =>
                  setCriteriaFilter((prev) =>
                    prev === 'FISIK_KURANG' ? 'ALL' : 'FISIK_KURANG'
                  )
                }
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  criteriaFilter === 'FISIK_KURANG'
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300'
                    : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wider">
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    <span>Kriteria Besar 1: FISIK KURANG</span>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                    {criteriaSummary.kurangCount} Tanggal ({criteriaSummary.totalKurangQty.toLocaleString('id-ID')}{' '}
                    {selectedAnalysis.item.uom})
                  </span>
                </div>
                <p className="text-xs text-[#2B3A32] leading-relaxed">
                  Kondisi saat <strong>Realisasi SO Fisik Aktual lebih rendah</strong> dari Hasil SO Seharusnya (Acuan SO Sebelumnya - Out + In) maupun Stok Accurate.
                </p>
                {criteriaSummary.kurangDays.length > 0 && (
                  <div className="mt-2 text-[11px] text-rose-800 font-medium">
                    Tanggal Terdampak: <strong>{criteriaSummary.kurangDays.join(', ')}</strong>
                  </div>
                )}
              </div>

              {/* Kriteria 2: FISIK LEBIH */}
              <div
                onClick={() =>
                  setCriteriaFilter((prev) =>
                    prev === 'FISIK_LEBIH' ? 'ALL' : 'FISIK_LEBIH'
                  )
                }
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  criteriaFilter === 'FISIK_LEBIH'
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                    : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                    <span>Kriteria Besar 2: FISIK LEBIH</span>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                    {criteriaSummary.lebihCount} Tanggal ({criteriaSummary.totalLebihQty.toLocaleString('id-ID')}{' '}
                    {selectedAnalysis.item.uom})
                  </span>
                </div>
                <p className="text-xs text-[#2B3A32] leading-relaxed">
                  Kondisi saat <strong>Realisasi SO Fisik Aktual lebih tinggi</strong> dari Hasil SO Seharusnya (Acuan SO Sebelumnya - Out + In) maupun Stok Accurate.
                </p>
                {criteriaSummary.lebihDays.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-900 font-medium">
                    Tanggal Terdampak: <strong>{criteriaSummary.lebihDays.join(', ')}</strong>
                  </div>
                )}
              </div>
            </div>

            {criteriaFilter !== 'ALL' && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#E8EFEA] text-xs text-[#1E3329]">
                <span>
                  Menampilkan khusus kriteria:{' '}
                  <strong>
                    {criteriaFilter === 'FISIK_KURANG' ? 'FISIK KURANG' : 'FISIK LEBIH'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCriteriaFilter('ALL')}
                  className="font-semibold text-[#2D5A43] hover:underline"
                >
                  Tampilkan Kedua Kriteria
                </button>
              </div>
            )}

            {/* Daftar Tanggal beserta Tombol Breakdown */}
            {dateComparisons.length === 0 ? (
              <div className="border border-[#C5D3C9] rounded-xl p-8 text-center bg-[#F6F9F7]">
                <CheckCircle2 className="w-6 h-6 text-[#1E6F43] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#1C2822]">
                  Tidak ada tanggal berselisih untuk item ini pada filter yang dipilih.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dateComparisons.map((comp) => {
                  const isExpanded = Boolean(expandedDays[comp.day]);
                  const hasVariance =
                    comp.qtySelisih > 0 ||
                    (comp.deviationFromExpected !== null &&
                      comp.deviationFromExpected !== 0);

                  return (
                    <div
                      key={comp.day}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        comp.isLowestAccuracyDay
                          ? 'border-rose-400 bg-rose-50/40'
                          : hasVariance
                          ? 'border-[#B8C9BE] bg-white'
                          : 'border-[#D5E0D8] bg-[#F8FAF8]'
                      }`}
                    >
                      {/* Baris Ringkas Tanggal + Kriteria Badge + Tombol Breakdown */}
                      <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                              comp.isLowestAccuracyDay
                                ? 'bg-rose-600 text-white'
                                : hasVariance
                                ? 'bg-[#2D5A43] text-white'
                                : 'bg-[#E2EAE4] text-[#2B3D34]'
                            }`}
                          >
                            {comp.dateLabel}
                          </span>

                          {comp.isLowestAccuracyDay && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                              <Flame className="w-3 h-3" />
                              Akurasi Terendah
                            </span>
                          )}

                          {/* Badge 2 Kriteria Besar */}
                          {comp.majorCriteria === 'FISIK_KURANG' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              Kriteria: FISIK KURANG
                            </span>
                          ) : comp.majorCriteria === 'FISIK_LEBIH' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Kriteria: FISIK LEBIH
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#E6F4EA] text-[#1E6F43]">
                              Sesuai Acuan
                            </span>
                          )}

                          <span className="text-xs text-[#4A5D52]">
                            {comp.varianceTypeLabel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                            {comp.prevSO !== null && comp.prevSO !== undefined && (
                              <span className="text-[#4A5D52]">
                                SO {comp.prevDayLabel}:{' '}
                                <strong className="text-[#1C2822]">
                                  {comp.prevSO.toLocaleString('id-ID')}
                                </strong>
                              </span>
                            )}
                            {comp.expectedSOFromPrev !== null && (
                              <span className="text-[#2D5A43]">
                                Harusnya:{' '}
                                <strong>
                                  {comp.expectedSOFromPrev.toLocaleString('id-ID')}
                                </strong>
                              </span>
                            )}
                            <span className="text-[#4A5D52]">
                              SO Aktual:{' '}
                              <strong className="text-[#1C2822]">
                                {comp.soFisik !== null
                                  ? comp.soFisik.toLocaleString('id-ID')
                                  : '-'}
                              </strong>
                            </span>
                            <span className="text-[#4A5D52]">
                              Accurate:{' '}
                              <strong className="text-[#1C2822]">
                                {comp.stokAccurate !== null
                                  ? comp.stokAccurate.toLocaleString('id-ID')
                                  : '-'}
                              </strong>
                            </span>
                            <span
                              className={`font-bold ${
                                comp.qtySelisih > 0
                                  ? 'text-rose-600'
                                  : 'text-[#1E6F43]'
                              }`}
                            >
                              Selisih: {comp.qtySelisih.toLocaleString('id-ID')}{' '}
                              {selectedAnalysis.item.uom}
                            </span>
                          </div>

                          {/* Tombol Breakdown per Tanggal */}
                          <button
                            type="button"
                            onClick={() => toggleDayBreakdown(comp.day)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isExpanded
                                ? 'bg-[#2D5A43] text-white'
                                : 'bg-[#E8EFEA] hover:bg-[#DCE7E0] text-[#1E3329] border border-[#B8C9BE]'
                            }`}
                          >
                            <span>Breakdown</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* ISI BREAKDOWN:                                            */}
                      {/* 1. Hitungan Acuan SO Sebelumnya                           */}
                      {/* 2. Breakdown 2 Kriteria Besar (Fisik Kurang & Fisik Lebih)*/}
                      {/*    + Kemungkinan Sumber Selisih Masing-Masing             */}
                      {/* 3. Hasil Deepsearch Lintas Tanggal & Mutasi               */}
                      {/* 4. Rekomendasi yang Bersifat Arahan                       */}
                      {/* ========================================================= */}
                      {isExpanded && (
                        <div className="border-t border-[#D5E0D8] bg-[#F7FAF8] p-4 space-y-4 text-xs">
                          {/* 1. Hitungan Acuan SO Sebelumnya */}
                          <div className="p-3.5 rounded-xl bg-white border border-[#C5D3C9] space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="inline-flex items-center gap-1.5 font-bold text-[#1E3329]">
                                <Calculator className="w-4 h-4 text-[#2D5A43]" />
                                <span>
                                  Acuan Hitungan SO Sebelumnya ({comp.prevDayLabel || 'Saldo Awal'} → {comp.dateLabel})
                                </span>
                              </div>
                              {comp.expectedSOFromPrev !== null && (
                                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                                  {comp.prevSO !== null && comp.prevSO !== undefined && (
                                    <span className="px-2 py-0.5 rounded bg-[#E8EFEA] text-[#1E3329] font-semibold">
                                      SO {comp.prevDayLabel}: {comp.prevSO.toLocaleString('id-ID')}
                                    </span>
                                  )}
                                  {comp.inToday > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                      In: +{comp.inToday.toLocaleString('id-ID')}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                                    Out: -{comp.outToday.toLocaleString('id-ID')}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#2D5A43] text-white font-bold">
                                    SO Harusnya: {comp.expectedSOFromPrev.toLocaleString('id-ID')}{' '}
                                    {selectedAnalysis.item.uom}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold">
                                    SO Aktual: {(comp.soFisik ?? 0).toLocaleString('id-ID')}{' '}
                                    {selectedAnalysis.item.uom}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-[#2B3A32] leading-relaxed font-medium">
                              {comp.previousSOReferenceSummary}
                            </p>
                            <p className="text-[#4A5D52] leading-relaxed pt-1 border-t border-[#E6ECE8]">
                              {comp.dateAndQtyMatchSummary}
                            </p>
                          </div>

                          {/* 2. Breakdown 2 Kriteria Besar: FISIK KURANG & FISIK LEBIH */}
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 font-bold text-[#1E3329]">
                              <Layers className="w-4 h-4 text-[#2D5A43]" />
                              <span>
                                Breakdown 2 Kriteria Besar Selisih &amp; Kemungkinan Sumber Selisih
                              </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Panel Kriteria 1: FISIK KURANG */}
                              {comp.fisikKurangBreakdown && (
                                <div
                                  className={`p-4 rounded-xl border space-y-3 ${
                                    comp.majorCriteria === 'FISIK_KURANG'
                                      ? 'bg-rose-50/70 border-rose-400 shadow-sm'
                                      : 'bg-white/70 border-[#D5E0D8] opacity-75'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-rose-200/80 pb-2">
                                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                      <ArrowDownRight className="w-4 h-4 text-rose-600" />
                                      <span>1. Kriteria: FISIK KURANG</span>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                        comp.majorCriteria === 'FISIK_KURANG'
                                          ? 'bg-rose-600 text-white'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {comp.majorCriteria === 'FISIK_KURANG'
                                        ? `AKTIF (-${comp.fisikKurangBreakdown.discrepancyQty.toLocaleString('id-ID')} ${selectedAnalysis.item.uom})`
                                        : '0 (Tidak Terjadi)'}
                                    </span>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold text-rose-900 mb-1">
                                      Breakdown Hitungan Fisik Kurang:
                                    </div>
                                    <ul className="space-y-1 text-[#2B3A32] list-disc list-inside leading-relaxed">
                                      {comp.fisikKurangBreakdown.breakdownCalculations.map(
                                        (calc, i) => (
                                          <li key={i}>{calc}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>

                                  {comp.majorCriteria === 'FISIK_KURANG' && (
                                    <div className="pt-2 border-t border-rose-200/80">
                                      <div className="text-[11px] font-bold text-rose-900 mb-1">
                                        Kemungkinan Sumber Selisih (Fisik Kurang):
                                      </div>
                                      <ul className="space-y-1 text-[#2B3A32] list-disc list-inside leading-relaxed">
                                        {comp.fisikKurangBreakdown.possibleSources.map(
                                          (src, i) => (
                                            <li key={i}>{src}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Panel Kriteria 2: FISIK LEBIH */}
                              {comp.fisikLebihBreakdown && (
                                <div
                                  className={`p-4 rounded-xl border space-y-3 ${
                                    comp.majorCriteria === 'FISIK_LEBIH'
                                      ? 'bg-amber-50/70 border-amber-400 shadow-sm'
                                      : 'bg-white/70 border-[#D5E0D8] opacity-75'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                      <ArrowUpRight className="w-4 h-4 text-amber-600" />
                                      <span>2. Kriteria: FISIK LEBIH</span>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                        comp.majorCriteria === 'FISIK_LEBIH'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {comp.majorCriteria === 'FISIK_LEBIH'
                                        ? `AKTIF (+${comp.fisikLebihBreakdown.discrepancyQty.toLocaleString('id-ID')} ${selectedAnalysis.item.uom})`
                                        : '0 (Tidak Terjadi)'}
                                    </span>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold text-amber-900 mb-1">
                                      Breakdown Hitungan Fisik Lebih:
                                    </div>
                                    <ul className="space-y-1 text-[#2B3A32] list-disc list-inside leading-relaxed">
                                      {comp.fisikLebihBreakdown.breakdownCalculations.map(
                                        (calc, i) => (
                                          <li key={i}>{calc}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>

                                  {comp.majorCriteria === 'FISIK_LEBIH' && (
                                    <div className="pt-2 border-t border-amber-200/80">
                                      <div className="text-[11px] font-bold text-amber-900 mb-1">
                                        Kemungkinan Sumber Selisih (Fisik Lebih):
                                      </div>
                                      <ul className="space-y-1 text-[#2B3A32] list-disc list-inside leading-relaxed">
                                        {comp.fisikLebihBreakdown.possibleSources.map(
                                          (src, i) => (
                                            <li key={i}>{src}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 3. Hasil Deepsearch & Rekomendasi yang Bersifat Arahan */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Kolom Kiri: Hasil Deepsearch */}
                            <div className="p-4 rounded-xl bg-white border border-[#C5D3C9] space-y-2.5">
                              <div className="inline-flex items-center gap-1.5 font-bold text-[#1E3329]">
                                <Radar className="w-4 h-4 text-[#2D5A43]" />
                                <span>
                                  Hasil Deepsearch (Pelacakan Lintas Tanggal, Mutasi &amp; Geser Hari)
                                </span>
                              </div>
                              <ul className="space-y-2 text-[#2B3A32] leading-relaxed">
                                {comp.deepSearchFindings.map((finding, idx) => (
                                  <li
                                    key={idx}
                                    className="p-2.5 rounded-lg bg-[#F4F7F5] border border-[#DCE5DF]"
                                  >
                                    {finding}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Kolom Kanan: Rekomendasi yang Bersifat Arahan */}
                            <div className="p-4 rounded-xl bg-[#EAF2ED] border border-[#9BB8A7] space-y-2.5">
                              <div className="inline-flex items-center gap-1.5 font-bold text-[#1E3329]">
                                <Compass className="w-4 h-4 text-[#2D5A43]" />
                                <span>
                                  Rekomendasi Arahan Penyelesaian (Langkah Tindak Lanjut)
                                </span>
                              </div>
                              <ul className="space-y-2 text-[#1C2822] leading-relaxed">
                                {comp.directiveRecommendations.map((dir, idx) => (
                                  <li
                                    key={idx}
                                    className="p-2.5 rounded-lg bg-white/90 border border-[#B8C9BE] font-medium"
                                  >
                                    {dir}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Tabel Rincian Mutasi Sistem Terupload pada Tanggal Ini (Jika Ada Upload) */}
                          {comp.matchedSystemMutations.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-white border border-[#C5D3C9]">
                              <div className="font-bold text-[#1C2822] mb-2">
                                Data Mutasi Sistem Terupload ({comp.dateLabel}) — Referensi Ujung Analisa
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-[#D5E0D8] text-[11px] text-[#4A5D52]">
                                      <th className="py-1.5 pr-3">Tanggal</th>
                                      <th className="py-1.5 pr-3">Deksripsi</th>
                                      <th className="py-1.5 pr-3 text-right">Masuk</th>
                                      <th className="py-1.5 pr-3 text-right">Keluar</th>
                                      <th className="py-1.5 text-right">Nomor (Referensi Akhir)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#E8EFEA] font-mono">
                                    {comp.matchedSystemMutations.map((m) => (
                                      <tr key={m.id}>
                                        <td className="py-1.5 pr-3">{m.date}</td>
                                        <td className="py-1.5 pr-3 font-sans">
                                          {m.description}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right text-[#1E6F43]">
                                          {m.qtyIn > 0
                                            ? `+${m.qtyIn.toLocaleString('id-ID')}`
                                            : '0'}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right text-rose-600">
                                          {m.qtyOut > 0
                                            ? `-${m.qtyOut.toLocaleString('id-ID')}`
                                            : '0'}
                                        </td>
                                        <td className="py-1.5 text-right font-semibold text-[#526358]">
                                          {m.transactionNo}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
