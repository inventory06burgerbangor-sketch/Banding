import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Sparkles,
  Target,
} from 'lucide-react';
import { PeriodItemAnalysis, SystemMutationRecord } from '../types/inventory';

interface Top10LowestAccuracyProps {
  periodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  selectedItemId: string;
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
  systemMutations: SystemMutationRecord[];
}

type FilterScope = 'operational_active' | 'all_active' | 'highest_qty_selisih';

export const Top10ErrorSection: React.FC<Top10LowestAccuracyProps> = ({
  periodItems,
  startDay,
  endDay,
  selectedItemId,
  onSelectItemAnalysis,
  systemMutations,
}) => {
  const [scope, setScope] = useState<FilterScope>('operational_active');
  // Track which item has its inline "Opsi Analisa Item" bubble expanded right inside the Top 10 list
  const [expandedBubbleItemId, setExpandedBubbleItemId] = useState<string | null>(null);

  const top10Lowest = useMemo(() => {
    const activeInPeriod = periodItems.filter(
      (p) => p.periodSelisih > 0 || p.periodSO > 0 || p.activeDaysCount > 0
    );

    if (scope === 'operational_active') {
      // Operational F&B & Packaging items with periodSO >= 50 (excludes unmapped SO=0 & rework) sorted by Lowest Accuracy % first
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
      // All items with variance in period sorted by Lowest Accuracy % first (0,00% -> upward)
      return [...activeInPeriod]
        .filter((p) => p.periodSelisih > 0)
        .sort(
          (a, b) =>
            a.periodAccuracyPercent - b.periodAccuracyPercent ||
            b.periodSelisih - a.periodSelisih
        )
        .slice(0, 10);
    }

    // Sorted by Largest Qty Selisih in the selected date period
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
    if (expandedBubbleItemId === p.item.id) {
      setExpandedBubbleItemId(null);
    } else {
      setExpandedBubbleItemId(p.item.id);
    }
  };

  return (
    <section
      id="top10-lowest-accuracy"
      className="border border-slate-800 bg-slate-900/80 rounded-2xl p-6 shadow-xl"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Target className="w-3.5 h-3.5" />
            <span>Baseline Akurasi: 100,00%</span>
            <span aria-hidden="true">·</span>
            <span>
              Periode Terpilih: {startDay} Okt – {endDay} Okt 2026
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">
            Top 10 Item dengan Akurasi Terendah ({startDay} Okt – {endDay} Okt)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Diurutkan dari item dengan <strong>% Stock Accuracy paling rendah</strong> terhadap Baseline 100% pada rentang tanggal yang dipilih. Klik tombol{' '}
            <strong className="text-amber-300">Opsi Analisa Item</strong> pada baris mana pun untuk membuka breakdown historical akurasi, Qty Selisih, dan highlight tanggal akurasi terendah.
          </p>
        </div>

        {/* Scope Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl self-start shrink-0">
          <button
            type="button"
            onClick={() => setScope('operational_active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              scope === 'operational_active'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Utama Operasional (SO &ge; 50)
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
            Semua Item (Termasuk 0%)
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
            Qty Selisih Terbesar
          </button>
        </div>
      </div>

      {/* Top 10 Table with Expandable Per-Item Bubble Analysis */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="py-3 px-3 font-medium w-12">Rank</th>
              <th className="py-3 px-3 font-medium">Nama Item &amp; Kategori</th>
              <th className="py-3 px-3 font-medium text-right">
                Stock Accuracy ({startDay}–{endDay} Okt)
              </th>
              <th className="py-3 px-3 font-medium text-right">Gap vs Baseline 100%</th>
              <th className="py-3 px-3 font-medium text-right">Qty Selisih Periode</th>
              <th className="py-3 px-3 font-medium text-right">Total SO Periode</th>
              <th className="py-3 px-3 font-medium">
                Highlight Tanggal Akurasi Terendah
              </th>
              <th className="py-3 px-3 font-medium text-right">
                Opsi Analisa Tiap Item
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70 text-sm">
            {top10Lowest.map((p, idx) => {
              const { item } = p;
              const isExpanded = expandedBubbleItemId === item.id;
              const isSelected = selectedItemId === item.id;
              const lowestRec = p.lowestAccuracyDayRecord;
              const itemMutations = systemMutations.filter(
                (m) =>
                  m.itemName.toLowerCase() === item.name.toLowerCase() &&
                  m.dayNumber >= startDay &&
                  m.dayNumber <= endDay
              );

              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={`transition-colors ${
                      isExpanded || isSelected
                        ? 'bg-amber-500/10'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-slate-400 font-semibold">
                      {String(idx + 1).padStart(2, '0')}.
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-100">{item.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        <span>{item.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Satuan: {item.uom}</span>
                      </div>
                    </td>

                    {/* Stock Accuracy % vs 100% Baseline */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="font-mono tabular-nums font-bold text-base text-rose-400">
                        {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                      </div>
                      <div className="w-28 ml-auto h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 flex">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, p.periodAccuracyPercent))}%`,
                          }}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{
                            width: `${Math.max(0, 100 - p.periodAccuracyPercent)}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* Gap vs Baseline 100% */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-semibold text-rose-400">
                      {p.gapFromBaseline100.toFixed(2).replace('.', ',')}%
                    </td>

                    {/* Qty Selisih */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-amber-300">
                      {p.periodSelisih.toLocaleString('id-ID')}{' '}
                      <span className="text-xs font-normal text-slate-400">{item.uom}</span>
                    </td>

                    {/* Total SO */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-300">
                      {p.periodSO.toLocaleString('id-ID')}{' '}
                      <span className="text-xs font-normal text-slate-500">{item.uom}</span>
                    </td>

                    {/* Highlight Tanggal dengan Akurasi Terendah */}
                    <td className="py-3.5 px-3">
                      {lowestRec ? (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs font-mono tabular-nums text-rose-200">
                          <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <div>
                            <span className="font-bold text-rose-300">
                              {lowestRec.dateLabel}:{' '}
                              {(lowestRec.dailyAccuracyPercent ?? 0)
                                .toFixed(2)
                                .replace('.', ',')}
                              %
                            </span>
                            <span className="text-slate-300 ml-1.5">
                              (Selisih: {lowestRec.selisih.toLocaleString('id-ID')} {item.uom})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>

                    {/* Opsi Analisa Tiap Item Buttons */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                          <span>Opsi Analisa Item</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectItemAnalysis(p)}
                          title="Buka di Panel Breakdown Penuh"
                          className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* INLINE BUBBLE MENU ANALISA TIAP ITEM (Historical Stock Akurasi, Qty Selisih, Highlight Tgl Terendah) */}
                  {isExpanded && (
                    <tr className="bg-slate-950/90">
                      <td colSpan={8} className="p-5 border-b-2 border-amber-500/50">
                        <div className="space-y-4">
                          {/* Top Summary of Item Bubble */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
                            <div>
                              <div className="text-xs font-semibold text-amber-400">
                                Breakdown Historical Stock Akurasi &amp; Qty Selisih ({startDay} Okt – {endDay} Okt)
                              </div>
                              <h3 className="text-base font-bold text-slate-100 mt-0.5">
                                {item.name} — Rata-Rata Akurasi Periode:{' '}
                                <span className="text-rose-400 font-mono">
                                  {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
                                </span>{' '}
                                (Baseline 100,00%)
                              </h3>
                              <p className="text-xs text-slate-300 mt-1">
                                {item.rootCauseSummary}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-start">
                              <button
                                type="button"
                                onClick={() => onSelectItemAnalysis(p)}
                                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
                              >
                                Lihat Grafik &amp; Histori Mutasi Lengkap &darr;
                              </button>
                            </div>
                          </div>

                          {/* Daily Historical Cards: Stock Accuracy %, Qty Selisih, and Highlight on Lowest Accuracy Date */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                            {p.periodDaily.map((d) => {
                              const isLowest = d.isLowestAccuracyDay;
                              const isHoliday = d.day === 4;
                              const accPct = d.dailyAccuracyPercent ?? 0;

                              return (
                                <div
                                  key={d.day}
                                  className={`rounded-xl p-3 border transition-all ${
                                    isLowest
                                      ? 'border-2 border-rose-500 bg-rose-950/50 shadow-lg shadow-rose-950/40'
                                      : isHoliday
                                      ? 'border-slate-800/50 bg-slate-900/30 opacity-60'
                                      : 'border-slate-800 bg-slate-900/70'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-200">
                                      {d.dateLabel}
                                    </span>
                                    {isLowest && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">
                                        <Flame className="w-2.5 h-2.5" />
                                        TERENDAH
                                      </span>
                                    )}
                                  </div>

                                  {/* Historical Stock Accuracy */}
                                  <div className="mt-2">
                                    <div className="text-[10px] text-slate-400">
                                      Stock Accuracy
                                    </div>
                                    <div
                                      className={`text-lg font-mono tabular-nums font-bold ${
                                        isHoliday
                                          ? 'text-slate-500'
                                          : isLowest
                                          ? 'text-rose-400'
                                          : accPct >= 95
                                          ? 'text-emerald-400'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {isHoliday
                                        ? '-'
                                        : `${accPct.toFixed(2).replace('.', ',')}%`}
                                    </div>
                                  </div>

                                  {/* Historical Qty Selisih, SO, Accurate */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 font-mono tabular-nums text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-sans">Qty Selisih:</span>
                                      <span
                                        className={
                                          isLowest
                                            ? 'text-rose-300 font-bold underline'
                                            : d.selisih > 0
                                            ? 'text-amber-300 font-semibold'
                                            : 'text-emerald-400'
                                        }
                                      >
                                        {d.selisih.toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                      <span className="font-sans">SO Fisik:</span>
                                      <span className="text-slate-200">
                                        {d.so !== null ? d.so.toLocaleString('id-ID') : '-'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                      <span className="font-sans">Accurate:</span>
                                      <span className="text-slate-200">
                                        {d.accurate !== null
                                          ? d.accurate.toLocaleString('id-ID')
                                          : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Linked System Mutations if available */}
                          {itemMutations.length > 0 && (
                            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
                              <div className="font-semibold text-sky-400 mb-1.5">
                                Data Master Histori Mutasi Sistem Terkait ({item.name}):
                              </div>
                              <div className="space-y-1">
                                {itemMutations.map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-slate-300 font-mono tabular-nums"
                                  >
                                    <span>
                                      [{m.date}] <strong>{m.transactionNo}</strong> ({m.transactionType})
                                    </span>
                                    <span>
                                      In: +{m.qtyIn.toLocaleString('id-ID')} | Out: -
                                      {m.qtyOut.toLocaleString('id-ID')} {m.uom} — {m.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
    </section>
  );
};
