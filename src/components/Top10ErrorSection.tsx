import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from '../types/inventory';
import { buildVarianceDateMutationComparisons } from '../utils/analyzer';

interface Top10LowestAccuracyProps {
  periodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  selectedItemId: string;
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
  systemMutations: SystemMutationRecord[];
  stockCards: AnalyzedStockCard[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

type FilterScope = 'operational_active' | 'all_active' | 'highest_qty_selisih';

export const Top10ErrorSection: React.FC<Top10LowestAccuracyProps> = ({
  periodItems,
  startDay,
  endDay,
  selectedItemId,
  onSelectItemAnalysis,
  systemMutations,
  stockCards,
  isOpen,
  onToggleOpen,
}) => {
  const [scope, setScope] = useState<FilterScope>('operational_active');
  const [expandedBubbleItemId, setExpandedBubbleItemId] = useState<string | null>(null);

  const top10Lowest = useMemo(() => {
    const activeInPeriod = periodItems.filter(
      (p) => p.periodSelisih > 0 || p.periodSO > 0 || p.activeDaysCount > 0
    );

    if (scope === 'operational_active') {
      return [...activeInPeriod]
        .filter(
          (p) =>
            p.periodSO >= 50 &&
            !p.item.name.toLowerCase().includes('rework') &&
            p.item.category !== 'Seragam & Merch' &&
            p.periodSelisih > 0
        )
        .sort(
          (a, b) =>
            a.periodAccuracyPercent - b.periodAccuracyPercent ||
            b.periodSelisih - a.periodSelisih
        )
        .slice(0, 10);
    }

    if (scope === 'all_active') {
      return [...activeInPeriod]
        .filter((p) => p.periodSelisih > 0)
        .sort(
          (a, b) =>
            a.periodAccuracyPercent - b.periodAccuracyPercent ||
            b.periodSelisih - a.periodSelisih
        )
        .slice(0, 10);
    }

    return [...activeInPeriod]
      .filter((p) => p.periodSelisih > 0)
      .sort(
        (a, b) =>
          b.periodSelisih - a.periodSelisih ||
          a.periodAccuracyPercent - b.periodAccuracyPercent
      )
      .slice(0, 10);
  }, [periodItems, scope]);

  const toggleItemBubble = (p: PeriodItemAnalysis) => {
    setExpandedBubbleItemId((prev) => (prev === p.item.id ? null : p.item.id));
  };

  const worstItem = top10Lowest[0];

  return (
    <section
      id="top10-lowest-accuracy"
      className="border border-slate-800 bg-slate-900/80 rounded-2xl p-5 shadow-xl transition-all"
    >
      {/* Compact Header Bar (Default Hidden / Only Appears When Clicked) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <Target className="w-3.5 h-3.5" />
              <span>Periode {startDay}–{endDay} Okt · Baseline 100%</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">
              Top 10 Akurasi Terendah
            </h2>
          </div>

          {!isOpen && worstItem && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-400">Terendah #1:</span>
              <strong className="text-slate-100">{worstItem.item.name}</strong>
              <span className="font-mono text-rose-400 font-bold">
                ({worstItem.periodAccuracyPercent.toFixed(2).replace('.', ',')}%)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={onToggleOpen}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              isOpen
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg'
            }`}
          >
            {isOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Sembunyikan Top 10</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Tampilkan Top 10</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Body: Only rendered when clicked */}
      {isOpen && (
        <div className="mt-5 pt-5 border-t border-slate-800 space-y-4">
          {/* Simplified Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Klik tombol <strong className="text-amber-300">Analisa</strong> untuk melihat hasil banding mutasi pada tanggal selisih &amp; rekomendasi pengecekan.
            </p>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setScope('operational_active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  scope === 'operational_active'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Operasional
              </button>
              <button
                type="button"
                onClick={() => setScope('all_active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  scope === 'all_active'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Semua Item
              </button>
              <button
                type="button"
                onClick={() => setScope('highest_qty_selisih')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  scope === 'highest_qty_selisih'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Qty Terbesar
              </button>
            </div>
          </div>

          {/* Simplified Top 10 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-2.5 px-3 font-medium w-10">#</th>
                  <th className="py-2.5 px-3 font-medium">Item</th>
                  <th className="py-2.5 px-3 font-medium text-right">Akurasi</th>
                  <th className="py-2.5 px-3 font-medium text-right">Deviasi</th>
                  <th className="py-2.5 px-3 font-medium text-right">Qty Selisih</th>
                  <th className="py-2.5 px-3 font-medium text-right">Total SO</th>
                  <th className="py-2.5 px-3 font-medium">Tgl Terendah</th>
                  <th className="py-2.5 px-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/70 text-sm">
                {top10Lowest.map((p, idx) => {
                  const { item } = p;
                  const isExpanded = expandedBubbleItemId === item.id;
                  const isSelected = selectedItemId === item.id;
                  const lowestRec = p.lowestAccuracyDayRecord;

                  const varianceComparisons = isExpanded
                    ? buildVarianceDateMutationComparisons(p, systemMutations, stockCards)
                    : [];

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`transition-colors ${
                          isExpanded || isSelected
                            ? 'bg-amber-500/10'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-400 font-semibold">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-400">
                            {item.category} · {item.uom}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-rose-400">
                          {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-rose-400">
                          {p.gapFromBaseline100.toFixed(2).replace('.', ',')}%
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-amber-300">
                          {p.periodSelisih.toLocaleString('id-ID')}{' '}
                          <span className="text-xs font-normal text-slate-400">{item.uom}</span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                          {p.periodSO.toLocaleString('id-ID')}
                        </td>

                        <td className="py-3 px-3">
                          {lowestRec ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs font-mono tabular-nums text-rose-200">
                              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                              <strong>{lowestRec.dateLabel}</strong> (
                              {(lowestRec.dailyAccuracyPercent ?? 0)
                                .toFixed(2)
                                .replace('.', ',')}
                              %)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleItemBubble(p)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                                isExpanded
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Analisa</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectItemAnalysis(p)}
                              title="Buka Detail Penuh"
                              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* INLINE BUBBLE ANALISA ITEM + HASIL BANDING HISTORY MUTASI PADA TANGGAL SELISIH */}
                      {isExpanded && (
                        <tr className="bg-slate-950/95">
                          <td colSpan={8} className="p-5 border-b-2 border-amber-500/50">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
                                <div>
                                  <h3 className="text-sm font-bold text-slate-100">
                                    Analisa Banding &amp; History Mutasi: <span className="text-amber-400">{item.name}</span>
                                  </h3>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Menampilkan hasil banding SO vs Sistem &amp; Kartu Stok pada tanggal terjadinya selisih beserta rekomendasi pengecekan.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onSelectItemAnalysis(p)}
                                  className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg self-start whitespace-nowrap"
                                >
                                  Buka di Panel Analisa Item &darr;
                                </button>
                              </div>

                              {/* Variance Dates Mutation Comparison Cards */}
                              <div className="space-y-2.5">
                                {varianceComparisons.slice(0, 3).map((vc) => (
                                  <div
                                    key={vc.day}
                                    className={`p-3.5 rounded-xl border ${
                                      vc.isLowestAccuracyDay
                                        ? 'border-rose-500/80 bg-rose-950/30'
                                        : 'border-slate-800 bg-slate-900/70'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-slate-100">
                                          Tanggal Selisih: {vc.dateLabel} 2026
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-rose-300 font-medium">
                                          Tipe: {vc.varianceTypeLabel}
                                        </span>
                                        {vc.isLowestAccuracyDay && (
                                          <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">
                                            AKURASI TERENDAH ({vc.dailyAccuracyPercent.toFixed(2).replace('.', ',')}%)
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono text-amber-300 font-semibold">
                                        Jumlah Selisih: {vc.qtySelisih.toLocaleString('id-ID')} {item.uom}
                                      </span>
                                    </div>

                                    <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                                      <strong className="text-amber-300">Potensi Selisih:</strong>{' '}
                                      {vc.potentialDiscrepancyFinding}
                                    </p>

                                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-xs text-emerald-300">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                                      <span>
                                        <strong>Rekomendasi Penyelesaian:</strong> {vc.checkRecommendation}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
