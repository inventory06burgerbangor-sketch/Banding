import React, { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Flame,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { DailyAccuracySummary, PeriodItemAnalysis } from '../types/inventory';

interface PeriodAverageAccuracyHeroProps {
  startDay: number;
  endDay: number;
  onChangeRange: (start: number, end: number) => void;
  averagePeriodAccuracy: number;
  weightedPeriodAccuracy: number;
  periodWape: number;
  periodTotalFisik: number;
  periodTotalError: number;
  gapFromBaseline100: number;
  lowestDaySummary: DailyAccuracySummary | null;
  highestDaySummary: DailyAccuracySummary | null;
  periodSummaries: DailyAccuracySummary[];
  periodItems: PeriodItemAnalysis[];
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
}

type BubbleTab = 'daily_breakdown' | 'drop_factors' | 'recovery_sim';

export const PeriodAverageAccuracyHero: React.FC<PeriodAverageAccuracyHeroProps> = ({
  startDay,
  endDay,
  onChangeRange,
  averagePeriodAccuracy,
  weightedPeriodAccuracy,
  periodWape,
  periodTotalFisik,
  periodTotalError,
  gapFromBaseline100,
  lowestDaySummary,
  highestDaySummary,
  periodSummaries,
  periodItems,
  onSelectItemAnalysis,
}) => {
  const [isBubbleOpen, setIsBubbleOpen] = useState<boolean>(true);
  const [activeBubbleTab, setActiveBubbleTab] = useState<BubbleTab>('daily_breakdown');

  const availableDays = [1, 2, 3, 4, 5, 6, 7];

  // Top 5 biggest contributors to error in the selected period
  const topErrorContributors = [...periodItems]
    .filter((p) => p.periodSelisih > 0)
    .sort((a, b) => b.periodSelisih - a.periodSelisih)
    .slice(0, 5);

  return (
    <section className="space-y-4">
      {/* Main Card: Date Period Picker + Total Rata-Rata Akurasi vs Baseline 100% */}
      <div className="border border-slate-800 bg-slate-900/80 rounded-2xl p-6 shadow-xl">
        {/* Top Row: Period Date Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <Target className="w-3.5 h-3.5" />
              <span>Target Baseline Akurasi: 100,00%</span>
              <span aria-hidden="true">·</span>
              <span>Filter Periode Tanggal Dinamis</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
              Total Rata-Rata Stock Accuracy Selama Periode Tanggal Terpilih
            </h1>
          </div>

          {/* Date Range Controls */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Periode:</span>
            </div>

            <select
              aria-label="Dari Tanggal"
              value={startDay}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChangeRange(val, Math.max(val, endDay));
              }}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {availableDays.map((d) => (
                <option key={`start-${d}`} value={d}>
                  {d} Oktober 2026
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-500">s/d</span>

            <select
              aria-label="Sampai Tanggal"
              value={endDay}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChangeRange(Math.min(startDay, val), val);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {availableDays.map((d) => (
                <option key={`end-${d}`} value={d}>
                  {d} Oktober 2026
                </option>
              ))}
            </select>

            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeRange(1, 7)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                  startDay === 1 && endDay === 7
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                }`}
              >
                1–7 Okt
              </button>
              <button
                type="button"
                onClick={() => onChangeRange(1, 6)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                  startDay === 1 && endDay === 6
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                }`}
              >
                1–6 Okt (Normal)
              </button>
              <button
                type="button"
                onClick={() => onChangeRange(7, 7)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                  startDay === 7 && endDay === 7
                    ? 'bg-rose-500 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                }`}
              >
                Khusus 7 Okt
              </button>
            </div>
          </div>
        </div>

        {/* Main KPI Display + Clickable Bubble Menu Trigger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-6">
          {/* Left 5 Cols: Primary Average Accuracy Metric vs 100% Baseline */}
          <div className="lg:col-span-5 flex flex-col justify-between border border-slate-800 bg-slate-950/90 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Rata-Rata Akurasi ({startDay} Okt – {endDay} Okt)
              </span>
              <span className="text-xs font-mono tabular-nums text-emerald-400">
                Baseline: 100,00%
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-3">
              <div
                className={`text-4xl sm:text-5xl font-mono tabular-nums font-bold tracking-tight ${
                  averagePeriodAccuracy >= 97.5
                    ? 'text-emerald-400'
                    : averagePeriodAccuracy >= 96
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
              </div>
              <div className="text-xs font-mono tabular-nums text-rose-400 font-semibold">
                ({gapFromBaseline100.toFixed(2).replace('.', ',')}% dari 100%)
              </div>
            </div>

            {/* Progress bar relative to 100% Baseline */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 mb-1">
                <span>0%</span>
                <span>Capaian: {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%</span>
                <span className="text-emerald-400 font-semibold">Baseline 100%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all ${
                    averagePeriodAccuracy >= 97.5
                      ? 'bg-emerald-500'
                      : averagePeriodAccuracy >= 96
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, averagePeriodAccuracy))}%` }}
                />
                <div
                  className="h-full bg-rose-500/40"
                  style={{ width: `${Math.max(0, 100 - averagePeriodAccuracy)}%` }}
                />
              </div>
            </div>

            {/* Opsi Analisa Hasil Rata-Rata (Trigger Button for Bubble Menu) */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Klik untuk membuka rincian analisa rata-rata:
              </span>
              <button
                type="button"
                onClick={() => setIsBubbleOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all shadow-lg whitespace-nowrap ${
                  isBubbleOpen
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Opsi Analisa Hasil Rata-Rata</span>
                {isBubbleOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Right 7 Cols: Supporting Period Metrics + Lowest Accuracy Date Highlight */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
              <div className="text-xs text-slate-400">Total Stock Fisik &amp; Error</div>
              <div className="text-xl font-mono tabular-nums font-bold text-slate-100 mt-1.5">
                {periodTotalFisik.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Total Selisih:{' '}
                <span className="font-mono text-rose-400 font-semibold">
                  {periodTotalError.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                WAPE Periode:{' '}
                <span className="font-mono text-amber-300 font-semibold">
                  {periodWape.toFixed(2).replace('.', ',')}%
                </span>
              </div>
            </div>

            {/* Highlight Tanggal Akurasi Terendah */}
            <div className="border-2 border-rose-500/70 bg-rose-950/25 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span>Tgl Akurasi Terendah</span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              {lowestDaySummary ? (
                <>
                  <div className="text-xl font-mono tabular-nums font-bold text-rose-400 mt-1.5">
                    {lowestDaySummary.dateLabel}: {lowestDaySummary.stockAccuracyStr}
                  </div>
                  <div className="text-xs text-rose-200/90 font-mono tabular-nums mt-1">
                    Gap: {lowestDaySummary.gapFromBaseline100?.toFixed(2).replace('.', ',')}% dari 100%
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Qty Selisih: <strong>{lowestDaySummary.error.toLocaleString('id-ID')}</strong> unit
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 mt-2">Tidak ada data</div>
              )}
            </div>

            {/* Tanggal Akurasi Tertinggi */}
            <div className="border border-emerald-500/40 bg-emerald-950/15 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                <span>Tgl Akurasi Terbaik</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              {highestDaySummary ? (
                <>
                  <div className="text-xl font-mono tabular-nums font-bold text-emerald-400 mt-1.5">
                    {highestDaySummary.dateLabel}: {highestDaySummary.stockAccuracyStr}
                  </div>
                  <div className="text-xs text-emerald-200/90 font-mono tabular-nums mt-1">
                    Gap: {highestDaySummary.gapFromBaseline100?.toFixed(2).replace('.', ',')}% dari 100%
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Qty Selisih: <strong>{highestDaySummary.error.toLocaleString('id-ID')}</strong> unit
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 mt-2">Tidak ada data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BUBBLE MENU BARU: Muncul Saat "Opsi Analisa Hasil Rata-Rata" Di-klik */}
      {isBubbleOpen && (
        <div className="relative border-2 border-amber-500/60 bg-slate-900/95 rounded-2xl p-6 shadow-2xl">
          {/* Bubble Menu Header & Sub-Bubble Selector Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-base font-bold text-slate-100">
                Bubble Menu Analisa Rata-Rata Akurasi ({startDay} Okt – {endDay} Okt:{' '}
                <span className="text-amber-400 font-mono">
                  {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
                </span>{' '}
                vs Baseline 100%)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveBubbleTab('daily_breakdown')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'daily_breakdown'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                1. Breakdown Akurasi per Tanggal
              </button>
              <button
                type="button"
                onClick={() => setActiveBubbleTab('drop_factors')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'drop_factors'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                2. Penyebab Deviasi dari 100%
              </button>
              <button
                type="button"
                onClick={() => setActiveBubbleTab('recovery_sim')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'recovery_sim'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                3. Simulasi Menuju Baseline 100%
              </button>
              <button
                type="button"
                onClick={() => setIsBubbleOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-full bg-slate-950 border border-slate-800"
                title="Tutup Bubble Analisa"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bubble Content 1: Daily Breakdown with Highlight on Lowest Accuracy Date */}
          {activeBubbleTab === 'daily_breakdown' && (
            <div className="mt-5 space-y-4">
              <div className="text-xs text-slate-300">
                Perbandingan akurasi harian terhadap <strong>Baseline 100,00%</strong> selama periode{' '}
                <strong>
                  {startDay} Okt – {endDay} Okt
                </strong>
                . Tanggal dengan akurasi terendah di-highlight merah menyala:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {periodSummaries.map((d) => {
                  const isLowest =
                    lowestDaySummary !== null &&
                    d.day === lowestDaySummary.day &&
                    d.stockFisik > 0;
                  const isHoliday = d.day === 4 || d.stockFisik === 0;

                  return (
                    <div
                      key={d.day}
                      className={`rounded-xl p-3.5 border transition-all ${
                        isLowest
                          ? 'border-2 border-rose-500 bg-rose-950/40 shadow-lg shadow-rose-950/30'
                          : isHoliday
                          ? 'border-slate-800/60 bg-slate-950/40 opacity-65'
                          : 'border-slate-800 bg-slate-950/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{d.dateLabel}</span>
                        {isLowest && (
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/50 px-1.5 py-0.5 rounded">
                            TERENDAH
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-[11px] text-slate-400">Akurasi vs 100%</div>
                        <div
                          className={`text-xl font-mono tabular-nums font-bold mt-0.5 ${
                            isLowest
                              ? 'text-rose-400'
                              : isHoliday
                              ? 'text-slate-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {d.stockAccuracyStr}
                        </div>
                        {!isHoliday && d.gapFromBaseline100 !== null && (
                          <div className="text-[11px] font-mono tabular-nums text-rose-400">
                            {d.gapFromBaseline100.toFixed(2).replace('.', ',')}% dari 100%
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-[11px] font-mono tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Qty Selisih:</span>
                          <span className={isLowest ? 'text-rose-300 font-bold' : 'text-amber-300'}>
                            {d.error.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-sans">Stok Fisik:</span>
                          <span className="text-slate-300">
                            {d.stockFisik.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bubble Content 2: Top Contributors Pulling Accuracy Below 100% */}
          {activeBubbleTab === 'drop_factors' && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-300">
                  Diagnosa Mengapa Rata-Rata Berada di {averagePeriodAccuracy.toFixed(2).replace('.', ',')}% (Deviasi{' '}
                  {gapFromBaseline100.toFixed(2).replace('.', ',')}% dari Baseline 100%)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Selama rentang <strong>{startDay} Okt – {endDay} Okt</strong>, total stok fisik yang dihitung adalah{' '}
                  <strong className="font-mono text-slate-100">
                    {periodTotalFisik.toLocaleString('id-ID')}
                  </strong>{' '}
                  unit dengan akumulasi Qty Selisih sebesar{' '}
                  <strong className="font-mono text-rose-400">
                    {periodTotalError.toLocaleString('id-ID')}
                  </strong>{' '}
                  unit.
                </p>
                {lowestDaySummary && (
                  <div className="p-3.5 rounded-xl border border-rose-500/50 bg-rose-950/25 text-xs text-slate-200 leading-relaxed">
                    <strong className="text-rose-300 block mb-1">
                      Highlight Titik Terendah: {lowestDaySummary.dateLabel} ({lowestDaySummary.stockAccuracyStr})
                    </strong>
                    {lowestDaySummary.day === 7
                      ? 'Pada 7 Oktober, 20 item Frozen, Chiller, dan Dus belum diinput nilai SO fisiknya (masih 0) sementara saldo sistem Accurate aktif, sehingga menyumbang selisih 33.851 unit dalam sehari.'
                      : `Pada ${lowestDaySummary.dateLabel}, terjadi selisih harian sebesar ${lowestDaySummary.error.toLocaleString('id-ID')} unit (WAPE ${lowestDaySummary.wapeStr}) yang didominasi oleh lonjakan selisih Tray Kentang, Dus Medium, dan Butter.`}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
                  5 Item Penyumbang Qty Selisih Terbesar pada Periode {startDay}–{endDay} Okt (Klik untuk Analisa Item):
                </h3>
                <div className="space-y-2">
                  {topErrorContributors.map((p) => (
                    <button
                      key={p.item.id}
                      type="button"
                      onClick={() => onSelectItemAnalysis(p)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-amber-500/60 transition-colors text-left text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-100">{p.item.name}</span>
                        <span className="text-slate-400 ml-2">({p.item.category})</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-rose-400 font-semibold">
                          Selisih: {p.periodSelisih.toLocaleString('id-ID')} {p.item.uom}
                        </span>
                        <span className="text-amber-300">
                          Akurasi: {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bubble Content 3: Recovery Simulation toward 100% Baseline */}
          {activeBubbleTab === 'recovery_sim' && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
                <div className="text-xs text-slate-400">Kondisi Saat Ini ({startDay}–{endDay} Okt)</div>
                <div className="text-2xl font-mono tabular-nums font-bold text-amber-400 mt-1">
                  {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Selisih terhadap Baseline 100%:{' '}
                  <strong className="font-mono text-rose-400">
                    {gapFromBaseline100.toFixed(2).replace('.', ',')}%
                  </strong>
                </p>
              </div>

              <div className="border border-emerald-500/40 bg-emerald-950/15 rounded-xl p-4">
                <div className="text-xs text-emerald-300 font-medium">
                  Jika Cut-Off Input SO 7 Okt Dilengkapi
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-emerald-400 mt-1">
                  97,93%
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Melengkapi 20 item SO yang masih 0 pada 7 Okt langsung menaikkan rata-rata akurasi sebesar{' '}
                  <strong className="text-emerald-300 font-mono">+0,41%</strong>.
                </p>
              </div>

              <div className="border border-sky-500/40 bg-sky-950/15 rounded-xl p-4">
                <div className="text-xs text-sky-300 font-medium">
                  Jika Mapping SO=0 &amp; Surat Jalan 3 Okt Klop
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-sky-400 mt-1">
                  99,42% &rarr; 100%
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Sinkronisasi rumus VLOOKUP (Dus Medium, Jawara Patty) dan posting SJ Tray Kentang 6.000 Pcs mendorong akurasi mendekati <strong>Baseline 100%</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
