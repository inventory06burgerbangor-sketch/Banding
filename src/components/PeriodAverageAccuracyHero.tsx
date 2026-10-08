import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { DailyAccuracySummary, PeriodItemAnalysis } from '../types/inventory';
import { CalendarPeriodPicker } from './CalendarPeriodPicker';

interface PeriodAverageAccuracyHeroProps {
  availableDays: number[];
  monthLabel: string;
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
  allDailySummaries: DailyAccuracySummary[];
  periodItems: PeriodItemAnalysis[];
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
}

type BubbleTab = 'daily_breakdown' | 'drop_factors' | 'recovery_sim';

export const PeriodAverageAccuracyHero: React.FC<PeriodAverageAccuracyHeroProps> = ({
  availableDays,
  monthLabel,
  startDay,
  endDay,
  onChangeRange,
  averagePeriodAccuracy,
  periodWape,
  periodTotalFisik,
  periodTotalError,
  gapFromBaseline100,
  lowestDaySummary,
  highestDaySummary,
  periodSummaries,
  allDailySummaries,
  periodItems,
  onSelectItemAnalysis,
}) => {
  const [isBubbleOpen, setIsBubbleOpen] = useState<boolean>(false);
  const [activeBubbleTab, setActiveBubbleTab] = useState<BubbleTab>('daily_breakdown');

  const shortMonth = monthLabel.split(' ')[0]?.slice(0, 3) || 'Okt';

  // Top 5 biggest contributors to error that have real comparison (Accuracy > 0%, SO > 0, Accurate > 0)
  const topErrorContributors = [...periodItems]
    .filter(
      (p) =>
        p.periodSelisih > 0 &&
        p.periodSO > 0 &&
        p.periodAccurate > 0 &&
        p.periodAccuracyPercent > 0
    )
    .sort((a, b) => b.periodSelisih - a.periodSelisih)
    .slice(0, 5);

  const dateDisplayLabel =
    startDay === endDay
      ? `${startDay} ${shortMonth}`
      : `${startDay} ${shortMonth} – ${endDay} ${shortMonth}`;

  return (
    <section className="space-y-4">
      {/* Main Card: Calendar Date Picker + Total Rata-Rata Akurasi vs Baseline 100% */}
      <div className="border border-[#C5D3C9] bg-white rounded-2xl p-6 shadow-sm">
        {/* Top Row: Interactive Calendar Date Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#E2EAE4]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#2D5A43]">
              <Target className="w-3.5 h-3.5" />
              <span>Sheet rekap Daily · Baseline 100%</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C2822] mt-1">
              Rata-Rata Akurasi
            </h1>
          </div>

          {/* Calendar Date Picker Button */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarPeriodPicker
              availableDays={availableDays}
              startDay={startDay}
              endDay={endDay}
              monthLabel={monthLabel}
              dailySummaries={allDailySummaries}
              onChangeRange={onChangeRange}
            />
          </div>
        </div>

        {/* Main KPI Display + Clickable Bubble Menu Trigger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-6">
          {/* Left 5 Cols: Primary Average Accuracy Metric vs 100% Baseline */}
          <div className="lg:col-span-5 flex flex-col justify-between border border-[#C5D3C9] bg-[#F4F7F5] rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#4A5D52]">
                Rata-Rata Akurasi ({dateDisplayLabel})
              </span>
              <span className="text-xs font-mono tabular-nums font-semibold text-[#1E6F43]">
                Baseline: 100,00%
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-3">
              <div
                className={`text-4xl sm:text-5xl font-mono tabular-nums font-bold tracking-tight ${
                  averagePeriodAccuracy >= 97.5
                    ? 'text-[#1E6F43]'
                    : averagePeriodAccuracy >= 96
                    ? 'text-amber-700'
                    : 'text-rose-600'
                }`}
              >
                {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
              </div>
              <div className="text-xs font-mono tabular-nums text-rose-600 font-semibold">
                ({gapFromBaseline100.toFixed(2).replace('.', ',')}% dari 100%)
              </div>
            </div>

            {/* Progress bar relative to 100% Baseline */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#526358] mb-1">
                <span>0%</span>
                <span>Capaian: {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%</span>
                <span className="text-[#1E6F43] font-semibold">Baseline 100%</span>
              </div>
              <div className="w-full h-2.5 bg-[#D5E0D8] rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all ${
                    averagePeriodAccuracy >= 97.5
                      ? 'bg-[#2D5A43]'
                      : averagePeriodAccuracy >= 96
                      ? 'bg-amber-600'
                      : 'bg-rose-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, averagePeriodAccuracy))}%` }}
                />
                <div
                  className="h-full bg-rose-400/50"
                  style={{ width: `${Math.max(0, 100 - averagePeriodAccuracy)}%` }}
                />
              </div>
            </div>

            {/* Analisa Rata-Rata (Trigger Button for Bubble Menu) */}
            <div className="mt-5 pt-4 border-t border-[#D5E0D8] flex items-center justify-between gap-3">
              <span className="text-xs text-[#526358]">
                Rincian hasil analisa:
              </span>
              <button
                type="button"
                onClick={() => setIsBubbleOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm whitespace-nowrap ${
                  isBubbleOpen
                    ? 'bg-[#1E3329] text-white'
                    : 'bg-[#2D5A43] hover:bg-[#234735] text-white'
                }`}
              >
                <span>Analisa Rata-Rata</span>
                {isBubbleOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Right 7 Cols: Supporting Metrics + Lowest Accuracy Date (Hasil Banding > 0%) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-[#C5D3C9] bg-[#F7FAF8] rounded-xl p-4">
              <div className="text-xs text-[#526358]">Total Stock Fisik &amp; Error</div>
              <div className="text-xl font-mono tabular-nums font-bold text-[#1C2822] mt-1.5">
                {periodTotalFisik.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-[#526358] mt-1">
                Total Selisih:{' '}
                <span className="font-mono text-rose-600 font-semibold">
                  {periodTotalError.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-xs text-[#526358] mt-1">
                WAPE:{' '}
                <span className="font-mono text-[#2D5A43] font-semibold">
                  {periodWape.toFixed(2).replace('.', ',')}%
                </span>
              </div>
            </div>

            {/* Tanggal Akurasi Terendah (Hasil Banding > 0%) */}
            <div className="border-2 border-rose-400 bg-rose-50/60 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                <span>Tgl Akurasi Terendah</span>
                <Flame className="w-4 h-4 text-rose-600" />
              </div>
              {lowestDaySummary ? (
                <>
                  <div className="text-xl font-mono tabular-nums font-bold text-rose-700 mt-1.5">
                    {lowestDaySummary.dateLabel}: {lowestDaySummary.stockAccuracyStr}
                  </div>
                  <div className="text-xs text-rose-600 font-mono tabular-nums mt-1">
                    Gap: {lowestDaySummary.gapFromBaseline100?.toFixed(2).replace('.', ',')}% dari 100%
                  </div>
                  <div className="text-xs text-[#3B5246] mt-1">
                    Qty Selisih: <strong>{lowestDaySummary.error.toLocaleString('id-ID')}</strong> unit
                  </div>
                </>
              ) : (
                <div className="text-sm text-[#526358] mt-2">Tidak ada data</div>
              )}
            </div>

            {/* Tanggal Akurasi Terbaik */}
            <div className="border border-[#B2C9BA] bg-[#EBF3EE] rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1E4631]">
                <span>Tgl Akurasi Terbaik</span>
                <TrendingUp className="w-4 h-4 text-[#1E6F43]" />
              </div>
              {highestDaySummary ? (
                <>
                  <div className="text-xl font-mono tabular-nums font-bold text-[#1E6F43] mt-1.5">
                    {highestDaySummary.dateLabel}: {highestDaySummary.stockAccuracyStr}
                  </div>
                  <div className="text-xs text-[#2D5A43] font-mono tabular-nums mt-1">
                    Gap: {highestDaySummary.gapFromBaseline100?.toFixed(2).replace('.', ',')}% dari 100%
                  </div>
                  <div className="text-xs text-[#3B5246] mt-1">
                    Qty Selisih: <strong>{highestDaySummary.error.toLocaleString('id-ID')}</strong> unit
                  </div>
                </>
              ) : (
                <div className="text-sm text-[#526358] mt-2">Tidak ada data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BUBBLE MENU: Muncul Saat "Analisa Rata-Rata" Di-klik */}
      {isBubbleOpen && (
        <div className="relative border border-[#9BB5A5] bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2EAE4]">
            <h2 className="text-base font-bold text-[#1C2822]">
              Analisa Rata-Rata ({dateDisplayLabel}:{' '}
              <span className="text-[#2D5A43] font-mono">
                {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
              </span>
              )
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveBubbleTab('daily_breakdown')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'daily_breakdown'
                    ? 'bg-[#2D5A43] text-white'
                    : 'bg-[#EEF3F0] text-[#3B5246] hover:bg-[#DCE7E0]'
                }`}
              >
                Per Tanggal
              </button>
              <button
                type="button"
                onClick={() => setActiveBubbleTab('drop_factors')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'drop_factors'
                    ? 'bg-[#2D5A43] text-white'
                    : 'bg-[#EEF3F0] text-[#3B5246] hover:bg-[#DCE7E0]'
                }`}
              >
                Penyebab Selisih
              </button>
              <button
                type="button"
                onClick={() => setActiveBubbleTab('recovery_sim')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  activeBubbleTab === 'recovery_sim'
                    ? 'bg-[#2D5A43] text-white'
                    : 'bg-[#EEF3F0] text-[#3B5246] hover:bg-[#DCE7E0]'
                }`}
              >
                Simulasi 100%
              </button>
              <button
                type="button"
                onClick={() => setIsBubbleOpen(false)}
                className="p-1.5 text-[#526358] hover:text-[#1C2822] rounded-lg bg-[#EEF3F0]"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeBubbleTab === 'daily_breakdown' && (
            <div className="mt-5 space-y-4">
              <div className="text-xs text-[#4A5D52]">
                Perbandingan akurasi harian terhadap <strong>Baseline 100,00%</strong> ({dateDisplayLabel}):
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {periodSummaries.map((d) => {
                  const isLowest =
                    lowestDaySummary !== null &&
                    d.day === lowestDaySummary.day &&
                    d.stockFisik > 0 &&
                    (d.stockAccuracyNum ?? 0) > 0;
                  const isEmptyDay = d.stockFisik === 0 && d.error === 0;

                  return (
                    <div
                      key={d.day}
                      className={`rounded-xl p-3.5 border transition-all ${
                        isLowest
                          ? 'border-2 border-rose-500 bg-rose-50'
                          : isEmptyDay
                          ? 'border-[#DCE5DF] bg-[#F8FAF8] opacity-75'
                          : 'border-[#C5D3C9] bg-[#F4F7F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C2822]">{d.dateLabel}</span>
                        {isLowest && (
                          <span className="text-[10px] font-bold text-rose-700">
                            TERENDAH
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-[11px] text-[#526358]">Akurasi vs 100%</div>
                        <div
                          className={`text-lg font-mono tabular-nums font-bold mt-0.5 ${
                            isLowest
                              ? 'text-rose-600'
                              : isEmptyDay
                              ? 'text-[#7A8C81]'
                              : 'text-[#1E6F43]'
                          }`}
                        >
                          {d.stockAccuracyStr}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#DCE5DF] space-y-1 text-[11px] font-mono tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-[#526358] font-sans">Selisih:</span>
                          <span className={isLowest ? 'text-rose-600 font-bold' : 'text-[#1C2822]'}>
                            {d.error.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526358] font-sans">Fisik:</span>
                          <span className="text-[#3B5246]">
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

          {activeBubbleTab === 'drop_factors' && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#1E3329]">
                  Diagnosa Rata-Rata ({averagePeriodAccuracy.toFixed(2).replace('.', ',')}%)
                </h3>
                <p className="text-xs text-[#3B5246] leading-relaxed">
                  Pada tanggal <strong>{dateDisplayLabel}</strong>, total stok fisik adalah{' '}
                  <strong className="font-mono text-[#1C2822]">
                    {periodTotalFisik.toLocaleString('id-ID')}
                  </strong>{' '}
                  unit dengan akumulasi Qty Selisih{' '}
                  <strong className="font-mono text-rose-600">
                    {periodTotalError.toLocaleString('id-ID')}
                  </strong>{' '}
                  unit.
                </p>
                {lowestDaySummary && (
                  <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-xs text-[#1C2822] leading-relaxed">
                    <strong className="text-rose-700 block mb-1">
                      Tanggal Akurasi Terendah: {lowestDaySummary.dateLabel} ({lowestDaySummary.stockAccuracyStr})
                    </strong>
                    Terjadi selisih harian sebesar {lowestDaySummary.error.toLocaleString('id-ID')} unit (WAPE {lowestDaySummary.wapeStr}).
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#3B5246] mb-2.5">
                  5 Item Hasil Banding dengan Selisih Terbesar (Klik untuk Analisa):
                </h3>
                <div className="space-y-2">
                  {topErrorContributors.map((p) => (
                    <button
                      key={p.item.id}
                      type="button"
                      onClick={() => onSelectItemAnalysis(p)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[#C5D3C9] bg-[#F4F7F5] hover:bg-[#E4EFE8] transition-colors text-left text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#1C2822]">{p.item.name}</span>
                        <span className="text-[#526358] ml-2">({p.item.category})</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-rose-600 font-semibold">
                          Selisih: {p.periodSelisih.toLocaleString('id-ID')} {p.item.uom}
                        </span>
                        <span className="text-[#2D5A43] font-semibold">
                          {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeBubbleTab === 'recovery_sim' && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-[#C5D3C9] bg-[#F4F7F5] rounded-xl p-4">
                <div className="text-xs text-[#526358]">Kondisi Saat Ini ({dateDisplayLabel})</div>
                <div className="text-2xl font-mono tabular-nums font-bold text-[#2D5A43] mt-1">
                  {averagePeriodAccuracy.toFixed(2).replace('.', ',')}%
                </div>
                <p className="text-xs text-[#4A5D52] mt-2">
                  Selisih terhadap Baseline 100%:{' '}
                  <strong className="font-mono text-rose-600">
                    {gapFromBaseline100.toFixed(2).replace('.', ',')}%
                  </strong>
                </p>
              </div>

              <div className="border border-[#B2C9BA] bg-[#EBF3EE] rounded-xl p-4">
                <div className="text-xs text-[#1E4631] font-medium">
                  Jika Cut-Off Input SO 7 Okt Dilengkapi
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-[#1E6F43] mt-1">
                  97,93%
                </div>
                <p className="text-xs text-[#3B5246] mt-2">
                  Melengkapi item SO yang masih 0 pada 7 Okt menaikkan rata-rata akurasi sebesar{' '}
                  <strong className="text-[#1E6F43] font-mono">+0,41%</strong>.
                </p>
              </div>

              <div className="border border-[#B2C9BA] bg-[#EBF3EE] rounded-xl p-4">
                <div className="text-xs text-[#1E4631] font-medium">
                  Jika Rekonsiliasi IN-OUT &amp; Geser Hari Klop
                </div>
                <div className="text-2xl font-mono tabular-nums font-bold text-[#1E6F43] mt-1">
                  99,42% &rarr; 100%
                </div>
                <p className="text-xs text-[#3B5246] mt-2">
                  Sinkronisasi rumus `SO tgl 1 - Data Out tgl 2 = SO tgl 2` mendorong akurasi mendekati <strong>Baseline 100%</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
