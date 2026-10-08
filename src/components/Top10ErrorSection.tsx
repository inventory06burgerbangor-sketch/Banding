import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  Target,
} from 'lucide-react';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from '../types/inventory';
import { buildVarianceDateMutationComparisons } from '../utils/analyzer';

interface Top10ErrorSectionProps {
  periodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  selectedItemId: string;
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
  systemMutations: SystemMutationRecord[];
  stockCards?: AnalyzedStockCard[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

type SortMode = 'lowest_accuracy' | 'highest_selisih' | 'sheet_rightmost';

export const Top10ErrorSection: React.FC<Top10ErrorSectionProps> = ({
  periodItems,
  startDay,
  endDay,
  selectedItemId,
  onSelectItemAnalysis,
  systemMutations,
  stockCards = [],
  isOpen,
  onToggleOpen,
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('lowest_accuracy');
  const [expandedBubbleItemId, setExpandedBubbleItemId] = useState<string | null>(null);

  const top10 = useMemo(() => {
    // Jangan masukkan 0% sebagai Terendah: hanya ambil item yang benar-benar hasil banding (SO > 0, Accurate != 0, Akurasi > 0%)
    const validComparedItems = periodItems.filter((p) => {
      const hasRealDayComparison = p.periodDaily.some(
        (d) =>
          d.so !== null &&
          d.so > 0 &&
          d.accurate !== null &&
          d.accurate !== 0 &&
          (d.dailyAccuracyPercent ?? 0) > 0
      );
      return (
        hasRealDayComparison &&
        p.periodSelisih > 0 &&
        p.periodSO > 0 &&
        p.periodAccuracyPercent > 0 &&
        (p.item.sheetAccuracyPercent === null || p.item.sheetAccuracyPercent > 0)
      );
    });

    if (sortMode === 'lowest_accuracy') {
      return [...validComparedItems]
        .sort(
          (a, b) =>
            a.periodAccuracyPercent - b.periodAccuracyPercent ||
            b.periodSelisih - a.periodSelisih
        )
        .slice(0, 10);
    }

    if (sortMode === 'highest_selisih') {
      return [...validComparedItems]
        .sort((a, b) => b.periodSelisih - a.periodSelisih)
        .slice(0, 10);
    }

    return [...validComparedItems]
      .filter((p) => (p.item.sheetAccuracyPercent ?? 0) > 0)
      .sort(
        (a, b) =>
          (a.item.sheetAccuracyPercent ?? 100) - (b.item.sheetAccuracyPercent ?? 100) ||
          b.item.totalSelisih - a.item.totalSelisih
      )
      .slice(0, 10);
  }, [periodItems, sortMode]);

  const lowestItemPreview = top10[0] || null;

  const dateText =
    startDay === endDay ? `${startDay} Okt` : `${startDay}–${endDay} Okt`;

  return (
    <section
      id="top10-lowest-accuracy"
      className="border border-[#C5D3C9] bg-white rounded-2xl p-5 shadow-sm transition-all"
    >
      {/* Header Bar with Hide/Show Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#2D5A43]">
              <Target className="w-3.5 h-3.5" />
              <span>Hasil Banding Nyata (&gt; 0%) · {dateText}</span>
            </div>
            <h2 className="text-lg font-bold text-[#1C2822] mt-0.5">
              Top 10 Akurasi Terendah
            </h2>
          </div>

          {!isOpen && lowestItemPreview && (
            <div className="text-xs text-[#4A5D52] bg-[#F2F6F3] border border-[#D0DDD4] rounded-xl px-3 py-1.5">
              Terendah #1: <strong className="text-[#1C2822]">{lowestItemPreview.item.name}</strong>{' '}
              <span className="font-mono text-rose-600 font-semibold">
                ({lowestItemPreview.periodAccuracyPercent.toFixed(2).replace('.', ',')}%)
              </span>
            </div>
          )}
        </div>

        {/* Hide / Show Option Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleOpen}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              isOpen
                ? 'bg-[#E8EFEA] hover:bg-[#DCE7E0] text-[#1E3329] border border-[#B8C9BE]'
                : 'bg-[#2D5A43] hover:bg-[#234735] text-white shadow-sm'
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

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-5 pt-4 border-t border-[#E2EAE4] space-y-4">
          {/* Sort Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-[#4A5D52]">
              Menampilkan item yang benar-benar terbanding antara SO Fisik &amp; Accurate (0% tidak dimasukkan):
            </span>
            <div className="flex items-center gap-1 p-1 bg-[#EBF1ED] border border-[#C5D3C9] rounded-xl self-start">
              <button
                type="button"
                onClick={() => setSortMode('lowest_accuracy')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortMode === 'lowest_accuracy'
                    ? 'bg-[#2D5A43] text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Akurasi Terendah
              </button>
              <button
                type="button"
                onClick={() => setSortMode('highest_selisih')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortMode === 'highest_selisih'
                    ? 'bg-[#2D5A43] text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Qty Selisih Terbesar
              </button>
              <button
                type="button"
                onClick={() => setSortMode('sheet_rightmost')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortMode === 'sheet_rightmost'
                    ? 'bg-[#2D5A43] text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Kolom Ujung Sheet
              </button>
            </div>
          </div>

          {/* 10 Rows */}
          <div className="space-y-2.5">
            {top10.map((entry, idx) => {
              const { item } = entry;
              const isSelected = item.id === selectedItemId;
              const isBubbleExpanded = expandedBubbleItemId === item.id;
              const acc = entry.periodAccuracyPercent;
              const lowestDay = entry.lowestAccuracyDayRecord;

              const itemMutationComparisons = isBubbleExpanded
                ? buildVarianceDateMutationComparisons(entry, systemMutations, stockCards)
                : [];

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl transition-all ${
                    isSelected
                      ? 'bg-[#EAF2ED] border-[#2D5A43]'
                      : 'bg-[#F8FAF8] border-[#C5D3C9] hover:border-[#8AA896]'
                  }`}
                >
                  <div className="p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    {/* Col 1-4: Rank + Name */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          idx < 3
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : 'bg-[#E2ECE5] text-[#1E3329] border border-[#B8C9BE]'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#1C2822] truncate">
                            {item.name}
                          </h3>
                          <span className="text-[11px] font-mono text-[#526358] shrink-0">
                            ({item.uom})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#526358] truncate">
                          {item.category} · Akurasi Sheet:{' '}
                          <span className="font-mono text-[#1E3329] font-semibold">
                            {item.sheetRightmostErrorCol}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Col 5-6: Akurasi vs Baseline 100% */}
                    <div className="lg:col-span-3">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[#526358]">Akurasi Banding:</span>
                        <span className="font-mono tabular-nums font-bold text-rose-600 text-sm">
                          {acc.toFixed(2).replace('.', ',')}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#D5E0D8] rounded-full overflow-hidden mt-1.5 flex">
                        <div
                          className="h-full bg-[#2D5A43]"
                          style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                        />
                        <div
                          className="h-full bg-rose-500/70"
                          style={{ width: `${Math.max(0, 100 - acc)}%` }}
                        />
                      </div>
                    </div>

                    {/* Col 7-9: Qty Selisih & Tgl Terendah (> 0%) */}
                    <div className="lg:col-span-3 flex items-center justify-between sm:justify-around gap-2 border-t lg:border-t-0 pt-2 lg:pt-0 border-[#DCE5DF]">
                      <div>
                        <div className="text-[10px] text-[#526358]">Qty Selisih</div>
                        <div className="text-xs font-mono tabular-nums font-bold text-rose-600">
                          {entry.periodSelisih.toLocaleString('id-ID')} {item.uom}
                        </div>
                      </div>

                      {lowestDay && (
                        <div className="px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700">
                            <Flame className="w-3 h-3 text-rose-600" />
                            <span>Terendah: {lowestDay.dateLabel}</span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-[#1C2822]">
                            {(lowestDay.dailyAccuracyPercent ?? 0).toFixed(1).replace('.', ',')}% (
                            {lowestDay.selisih.toLocaleString('id-ID')})
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Col 10-12: Actions */}
                    <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBubbleItemId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#E8EFEA] hover:bg-[#D8E5DC] text-[#1E3329] border border-[#B8C9BE] transition-colors whitespace-nowrap"
                      >
                        {isBubbleExpanded ? 'Tutup' : 'Ringkasan'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectItemAnalysis(entry)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2D5A43] hover:bg-[#234735] text-white transition-colors whitespace-nowrap"
                      >
                        <span>Analisa</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Summary */}
                  {isBubbleExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-[#DCE5DF] bg-white rounded-b-xl space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {entry.periodDaily.map((d) => {
                          const isLowest = d.isLowestAccuracyDay;
                          const isInactive =
                            (d.so === null || d.so === 0) &&
                            (d.accurate === null || d.accurate === 0);

                          return (
                            <div
                              key={d.day}
                              className={`p-2.5 rounded-lg border text-xs font-mono tabular-nums ${
                                isLowest
                                  ? 'border-2 border-rose-500 bg-rose-50'
                                  : isInactive
                                  ? 'border-[#E2EAE4] bg-[#F8FAF8] opacity-60'
                                  : 'border-[#C5D3C9] bg-[#F4F7F5]'
                              }`}
                            >
                              <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-[#1C2822]">{d.dateLabel}</span>
                                {isLowest && (
                                  <span className="text-[9px] font-bold text-rose-700">
                                    TERENDAH
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-sm font-bold text-[#1E6F43]">
                                {d.dailyAccuracyPercent !== null
                                  ? `${d.dailyAccuracyPercent.toFixed(1).replace('.', ',')}%`
                                  : '-'}
                              </div>
                              <div className="mt-1 text-[11px] text-[#4A5D52]">
                                Selisih:{' '}
                                <strong className={d.selisih > 0 ? 'text-rose-600' : 'text-[#1C2822]'}>
                                  {d.selisih.toLocaleString('id-ID')}
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {itemMutationComparisons.length > 0 && (
                        <div className="p-3 rounded-lg border border-[#C5D3C9] bg-[#F4F7F5] text-xs space-y-1.5">
                          <div className="font-semibold text-[#1E3329]">
                            Ringkasan Acuan SO Sebelumnya &amp; Rekomendasi Arahan:
                          </div>
                          {itemMutationComparisons.slice(0, 2).map((mc) => (
                            <div key={mc.day} className="text-[#3B5246]">
                              • <strong>{mc.dateLabel}</strong>: {mc.previousSOReferenceSummary} —{' '}
                              <span className="text-[#1E6F43] font-medium">
                                {mc.checkRecommendation}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
