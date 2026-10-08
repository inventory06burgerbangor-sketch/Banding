import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  LineChart,
  Search,
  TrendingUp,
} from 'lucide-react';
import { DailyAccuracySummary, PeriodItemAnalysis } from '../types/inventory';

interface DashboardChartsSectionProps {
  periodSummaries: DailyAccuracySummary[];
  periodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  monthLabel: string;
  lowestDaySummary: DailyAccuracySummary | null;
  onSelectItemAnalysis: (item: PeriodItemAnalysis) => void;
}

export const DashboardChartsSection: React.FC<DashboardChartsSectionProps> = ({
  periodSummaries,
  periodItems,
  startDay,
  endDay,
  monthLabel,
  lowestDaySummary,
  onSelectItemAnalysis,
}) => {
  // Keduanya HANYA MUNCUL JIKA DI-KLIK (Default: false)
  const [isDailyChartOpen, setIsDailyChartOpen] = useState<boolean>(false);
  const [isItemChartOpen, setIsItemChartOpen] = useState<boolean>(false);

  // State untuk interaksi pada Grafik Akurasi per Tanggal
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // State untuk Grafik Opsional Per Item
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [selectedChartItemId, setSelectedChartItemId] = useState<string>('');
  const [itemChartMode, setItemChartMode] = useState<'QTY_COMPARE' | 'ACCURACY_TREND'>(
    'QTY_COMPARE'
  );

  // Filter tanggal yang benar-benar ada hasil banding (> 0%)
  const validDailySummaries = useMemo(
    () =>
      periodSummaries.filter(
        (s) =>
          s.stockAccuracyNum !== null &&
          s.stockAccuracyNum > 0 &&
          (s.stockFisik > 0 || s.error > 0)
      ),
    [periodSummaries]
  );

  // Item yang dipilih pada Grafik Opsional Per Item
  const activeChartItem: PeriodItemAnalysis | null = useMemo(() => {
    if (selectedChartItemId) {
      const found = periodItems.find((p) => p.item.id === selectedChartItemId);
      if (found) return found;
    }
    // Default pilih item pertama yang punya selisih jika user membuka panel grafik per item
    const firstWithVariance = periodItems.find((p) => p.periodSelisih > 0);
    return firstWithVariance || periodItems[0] || null;
  }, [periodItems, selectedChartItemId]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return periodItems;
    return periodItems.filter(
      (p) =>
        p.item.name.toLowerCase().includes(q) ||
        p.item.category.toLowerCase().includes(q)
    );
  }, [periodItems, itemSearchQuery]);

  // Data harian untuk item yang dipilih pada Grafik Per Item
  const itemChartDays = useMemo(() => {
    if (!activeChartItem) return [];
    return activeChartItem.periodDaily.filter(
      (d) =>
        (d.so !== null && d.so > 0) ||
        (d.accurate !== null && d.accurate !== 0) ||
        d.selisih > 0
    );
  }, [activeChartItem]);

  const maxItemQty = useMemo(() => {
    if (itemChartDays.length === 0) return 100;
    let maxVal = 10;
    for (const d of itemChartDays) {
      maxVal = Math.max(maxVal, d.so ?? 0, d.accurate ?? 0, d.selisih);
    }
    return maxVal;
  }, [itemChartDays]);

  return (
    <section className="space-y-3">
      {/* =================================================================== */}
      {/* 1. GRAFIK AKURASI PER TANGGAL (HANYA MUNCUL JIKA DI-KLIK)            */}
      {/* =================================================================== */}
      <div className="bg-white border border-[#C5D3C9] rounded-2xl shadow-sm overflow-hidden">
        <div
          onClick={() => setIsDailyChartOpen((prev) => !prev)}
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#F6F9F7] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8EFEA] border border-[#C5D3C9] flex items-center justify-center text-[#2D5A43]">
              <LineChart className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1C2822]">
                  Grafik Akurasi per Tanggal ({startDay}–{endDay} {monthLabel})
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#E8EFEA] text-[#2D5A43] border border-[#C5D3C9]">
                  {validDailySummaries.length} Tanggal Aktif
                </span>
              </div>
              <p className="text-xs text-[#4A5D52]">
                Klik untuk menampilkan visualisasi grafik tren akurasi harian terhadap Baseline 100%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDailyChartOpen((prev) => !prev);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isDailyChartOpen
                ? 'bg-[#2D5A43] text-white border-[#2D5A43]'
                : 'bg-[#E8EFEA] hover:bg-[#DCE7E0] text-[#1E3329] border-[#B8C9BE]'
            }`}
          >
            {isDailyChartOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Sembunyikan Grafik Tanggal</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Tampilkan Grafik Akurasi per Tanggal</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {isDailyChartOpen && (
          <div className="border-t border-[#E2EAE4] p-5 bg-[#F9FBF9] space-y-4">
            {validDailySummaries.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#526358] bg-white rounded-xl border border-[#DCE5DF]">
                Belum ada tanggal dengan hasil banding akurasi (&gt; 0%) pada rentang tanggal ini.
              </div>
            ) : (
              <>
                {/* Legend & Info Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E6F43]">
                      <span className="w-3 h-0.5 border-b-2 border-dashed border-[#1E6F43] inline-block" />
                      Baseline Target: 100%
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#2D5A43] font-medium">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#2D5A43] inline-block" />
                      Akurasi Harian Normal
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block" />
                      Akurasi Terendah ({lowestDaySummary?.dateLabel}:{' '}
                      {lowestDaySummary?.stockAccuracyStr})
                    </span>
                  </div>
                  <span className="text-[11px] text-[#526358]">
                    Arahkan kursor pada batang/titik tanggal untuk melihat detail Stock Fisik &amp; Error
                  </span>
                </div>

                {/* Interactive Bar + Line SVG Chart */}
                <div className="bg-white border border-[#D4E0D8] rounded-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 items-end pt-6 pb-2">
                    {validDailySummaries.map((s) => {
                      const acc = s.stockAccuracyNum ?? 0;
                      const isLowest =
                        lowestDaySummary !== null && s.day === lowestDaySummary.day;
                      const isHovered = hoveredDay === s.day;
                      // Skala visual tinggi bar (min 18% agar mudah dibaca, max 100%)
                      const barHeightPct = Math.max(18, Math.min(100, acc));
                      const gap = (acc - 100).toFixed(2);

                      return (
                        <div
                          key={s.day}
                          onMouseEnter={() => setHoveredDay(s.day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`group relative flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer ${
                            isLowest
                              ? 'bg-rose-50/70 border-rose-300 shadow-sm'
                              : isHovered
                              ? 'bg-[#EEF5F0] border-[#2D5A43]'
                              : 'bg-[#F8FAF8] border-[#E2EAE4] hover:border-[#94B0A0]'
                          }`}
                        >
                          {/* Badge Persentase di atas Bar */}
                          <div className="flex items-center gap-1 mb-2">
                            {isLowest && <Flame className="w-3.5 h-3.5 text-rose-600" />}
                            <span
                              className={`text-xs font-bold font-mono tabular-nums ${
                                isLowest
                                  ? 'text-rose-700'
                                  : acc >= 95
                                  ? 'text-[#1E6F43]'
                                  : 'text-amber-700'
                              }`}
                            >
                              {acc.toFixed(2)}%
                            </span>
                          </div>

                          {/* Track Bar dengan Garis Baseline 100% di Puncak */}
                          <div className="w-full h-36 bg-[#EBF0EC] rounded-lg relative overflow-hidden flex items-end p-1 border border-[#D5E0D8]">
                            {/* Garis Baseline 100% */}
                            <div
                              className="absolute top-1 left-0 right-0 border-t-2 border-dashed border-[#1E6F43]/60 z-10"
                              title="Baseline 100%"
                            />
                            <div
                              style={{ height: `${barHeightPct}%` }}
                              className={`w-full rounded-md transition-all duration-300 ${
                                isLowest
                                  ? 'bg-gradient-to-t from-rose-700 to-rose-500'
                                  : acc >= 95
                                  ? 'bg-gradient-to-t from-[#2D5A43] to-[#468365]'
                                  : 'bg-gradient-to-t from-amber-600 to-amber-500'
                              }`}
                            />
                          </div>

                          {/* Label Tanggal & Gap */}
                          <div className="mt-2.5 text-center">
                            <div className="text-xs font-bold text-[#1C2822]">
                              {s.dateLabel}
                            </div>
                            <div
                              className={`text-[10px] font-mono tabular-nums font-semibold ${
                                isLowest ? 'text-rose-700' : 'text-[#526358]'
                              }`}
                            >
                              Gap: {gap}%
                            </div>
                          </div>

                          {/* Ringkasan Fisik & Error */}
                          <div className="mt-2 pt-2 border-t border-[#E2EAE4] w-full text-[10px] space-y-0.5 font-mono tabular-nums">
                            <div className="flex justify-between text-[#4A5D52]">
                              <span>Fisik:</span>
                              <span className="font-semibold text-[#1C2822]">
                                {s.stockFisik.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-between text-rose-700">
                              <span>Error:</span>
                              <span className="font-semibold">
                                {s.error.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. GRAFIK OPSIONAL PER ITEM (HANYA MUNCUL JIKA DI-KLIK)              */}
      {/* =================================================================== */}
      <div className="bg-white border border-[#C5D3C9] rounded-2xl shadow-sm overflow-hidden">
        <div
          onClick={() => setIsItemChartOpen((prev) => !prev)}
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#F6F9F7] transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8EFEA] border border-[#C5D3C9] flex items-center justify-center text-[#2D5A43]">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1C2822]">
                  Grafik Opsional Per Item
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#E8EFEA] text-[#2D5A43] border border-[#C5D3C9]">
                  Opsional · Pilih Item
                </span>
              </div>
              <p className="text-xs text-[#4A5D52]">
                Klik untuk menampilkan grafik perbandingan SO Fisik vs Accurate, kriteria Fisik Kurang / Lebih, &amp; tren akurasi per item
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsItemChartOpen((prev) => !prev);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isItemChartOpen
                ? 'bg-[#2D5A43] text-white border-[#2D5A43]'
                : 'bg-[#E8EFEA] hover:bg-[#DCE7E0] text-[#1E3329] border-[#B8C9BE]'
            }`}
          >
            {isItemChartOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Sembunyikan Grafik Per Item</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Tampilkan Grafik Per Item</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {isItemChartOpen && (
          <div className="border-t border-[#E2EAE4] p-5 bg-[#F9FBF9] space-y-4">
            {/* Toolbar Pilih Item & Mode Grafik */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end bg-white p-4 rounded-xl border border-[#D4E0D8]">
              {/* Cari Nama Item */}
              <div className="lg:col-span-4">
                <label className="block text-[11px] font-semibold text-[#3B5246] mb-1">
                  Cari Nama Item
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#526358] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Ketik nama item (contoh: Bun Burger, Patty, Cup)..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#F4F7F5] border border-[#B8C9BE] rounded-xl text-[#1C2822] focus:outline-none focus:border-[#2D5A43]"
                  />
                </div>
              </div>

              {/* Dropdown Pilih Item */}
              <div className="lg:col-span-5">
                <label className="block text-[11px] font-semibold text-[#3B5246] mb-1">
                  Pilih Item untuk Ditampilkan di Grafik ({filteredItemOptions.length} Item)
                </label>
                <select
                  value={activeChartItem?.item.id || ''}
                  onChange={(e) => setSelectedChartItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-[#F4F7F5] border border-[#B8C9BE] rounded-xl text-[#1C2822] focus:outline-none focus:border-[#2D5A43]"
                >
                  {filteredItemOptions.map((p) => (
                    <option key={p.item.id} value={p.item.id}>
                      {p.item.name} ({p.item.uom}) — Akurasi: {p.periodAccuracyPercent.toFixed(2)}% | Selisih:{' '}
                      {p.periodSelisih.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Grafik */}
              <div className="lg:col-span-3 flex items-center gap-1.5 bg-[#E8EFEA] p-1 rounded-xl border border-[#C5D3C9]">
                <button
                  type="button"
                  onClick={() => setItemChartMode('QTY_COMPARE')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                    itemChartMode === 'QTY_COMPARE'
                      ? 'bg-[#2D5A43] text-white shadow-sm'
                      : 'text-[#3B5246] hover:text-[#1C2822]'
                  }`}
                >
                  SO vs Accurate
                </button>
                <button
                  type="button"
                  onClick={() => setItemChartMode('ACCURACY_TREND')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                    itemChartMode === 'ACCURACY_TREND'
                      ? 'bg-[#2D5A43] text-white shadow-sm'
                      : 'text-[#3B5246] hover:text-[#1C2822]'
                  }`}
                >
                  Tren Akurasi %
                </button>
              </div>
            </div>

            {activeChartItem && (
              <div className="bg-white border border-[#D4E0D8] rounded-xl p-4 space-y-4">
                {/* Header Ringkasan Item Terpilih */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2EAE4]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#1C2822]">
                        {activeChartItem.item.name}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#E8EFEA] text-[#2D5A43] rounded-md">
                        {activeChartItem.item.uom}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#F4F7F5] text-[#4A5D52] rounded-md border border-[#D4E0D8]">
                        {activeChartItem.item.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A5D52] mt-0.5">
                      Rata-rata Akurasi: <strong className="text-[#1E6F43]">{activeChartItem.periodAccuracyPercent.toFixed(2)}%</strong> · Total SO Fisik:{' '}
                      <strong className="font-mono">{activeChartItem.periodSO.toLocaleString('id-ID')}</strong> · Total Selisih:{' '}
                      <strong className="font-mono text-rose-700">{activeChartItem.periodSelisih.toLocaleString('id-ID')} {activeChartItem.item.uom}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectItemAnalysis(activeChartItem)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#2D5A43] hover:bg-[#234735] text-white rounded-xl transition-colors shadow-sm"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Buka Deepsearch &amp; Breakdown Item Ini</span>
                  </button>
                </div>

                {/* Visualisasi Grafik Item per Tanggal */}
                {itemChartDays.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#526358]">
                    Item ini belum memiliki transaksi SO / Accurate pada rentang tanggal yang dipilih.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                    {itemChartDays.map((d, idx) => {
                      const soVal = d.so ?? 0;
                      const accVal = d.accurate ?? 0;
                      const prevRec = idx > 0 ? itemChartDays[idx - 1] : null;
                      const prevSO = prevRec?.so ?? null;
                      const outImplied =
                        prevRec?.accurate !== null && prevRec?.accurate !== undefined && d.accurate !== null
                          ? Math.max(0, prevRec.accurate - accVal)
                          : 0;
                      const inImplied =
                        prevRec?.accurate !== null && prevRec?.accurate !== undefined && d.accurate !== null
                          ? Math.max(0, accVal - prevRec.accurate)
                          : 0;
                      const expectedSO =
                        prevSO !== null ? prevSO + inImplied - outImplied : accVal;

                      const isFisikKurang = soVal < accVal;
                      const isFisikLebih = soVal > accVal;
                      const soHeightPct = Math.max(12, Math.min(100, (soVal / maxItemQty) * 100));
                      const accHeightPct = Math.max(
                        12,
                        Math.min(100, (Math.max(0, accVal) / maxItemQty) * 100)
                      );
                      const accDayPct = d.dailyAccuracyPercent ?? 100;

                      return (
                        <div
                          key={d.day}
                          className={`p-3 rounded-xl border flex flex-col justify-between ${
                            d.isLowestAccuracyDay
                              ? 'bg-rose-50/70 border-rose-300'
                              : d.selisih > 0
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-[#F8FAF8] border-[#E2EAE4]'
                          }`}
                        >
                          {/* Header Tanggal & Kriteria Badge */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-xs font-bold text-[#1C2822]">
                              {d.dateLabel}
                            </span>
                            {isFisikKurang ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800 border border-rose-300">
                                Fisik Kurang
                              </span>
                            ) : isFisikLebih ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                                Fisik Lebih
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#E6F4EA] text-[#1E6F43]">
                                Sesuai
                              </span>
                            )}
                          </div>

                          {/* Chart Area */}
                          {itemChartMode === 'QTY_COMPARE' ? (
                            <div className="h-32 bg-white rounded-lg border border-[#DCE5DF] p-2 flex items-end justify-center gap-3">
                              {/* Bar SO Fisik */}
                              <div className="flex flex-col items-center h-full justify-end flex-1">
                                <span className="text-[10px] font-mono font-bold text-[#2D5A43] mb-1">
                                  {soVal.toLocaleString('id-ID')}
                                </span>
                                <div
                                  style={{ height: `${soHeightPct}%` }}
                                  className="w-full max-w-[28px] rounded-t-md bg-[#2D5A43]"
                                  title={`SO Fisik: ${soVal.toLocaleString('id-ID')}`}
                                />
                                <span className="text-[9px] font-semibold text-[#526358] mt-1">
                                  SO
                                </span>
                              </div>

                              {/* Bar Accurate */}
                              <div className="flex flex-col items-center h-full justify-end flex-1">
                                <span className="text-[10px] font-mono font-bold text-slate-600 mb-1">
                                  {accVal.toLocaleString('id-ID')}
                                </span>
                                <div
                                  style={{ height: `${accHeightPct}%` }}
                                  className="w-full max-w-[28px] rounded-t-md bg-slate-400"
                                  title={`Stok Accurate: ${accVal.toLocaleString('id-ID')}`}
                                />
                                <span className="text-[9px] font-semibold text-[#526358] mt-1">
                                  Acc
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-32 bg-white rounded-lg border border-[#DCE5DF] p-2 flex flex-col items-center justify-end relative">
                              <div className="absolute top-2 left-0 right-0 border-t border-dashed border-[#1E6F43]/60" />
                              <span
                                className={`text-xs font-mono font-bold mb-1 ${
                                  d.isLowestAccuracyDay ? 'text-rose-700' : 'text-[#1E6F43]'
                                }`}
                              >
                                {accDayPct.toFixed(1)}%
                              </span>
                              <div
                                style={{ height: `${Math.max(15, accDayPct)}%` }}
                                className={`w-10 rounded-t-md ${
                                  d.isLowestAccuracyDay
                                    ? 'bg-rose-600'
                                    : accDayPct >= 95
                                    ? 'bg-[#2D5A43]'
                                    : 'bg-amber-500'
                                }`}
                              />
                              <span className="text-[9px] font-semibold text-[#526358] mt-1">
                                Akurasi
                              </span>
                            </div>
                          )}

                          {/* Footer Detail Acuan SO Sebelumnya & Selisih */}
                          <div className="mt-2.5 pt-2 border-t border-[#E2EAE4] text-[10px] space-y-1 font-mono tabular-nums">
                            {prevSO !== null && (
                              <div className="flex justify-between text-[#4A5D52]">
                                <span>Harusnya:</span>
                                <span className="font-semibold text-[#1C2822]">
                                  {expectedSO.toLocaleString('id-ID')}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-[#4A5D52]">Selisih:</span>
                              <span
                                className={`font-bold ${
                                  d.selisih > 0 ? 'text-rose-700' : 'text-[#1E6F43]'
                                }`}
                              >
                                {d.selisih > 0
                                  ? `${isFisikKurang ? '-' : '+'}${d.selisih.toLocaleString('id-ID')}`
                                  : '0'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
