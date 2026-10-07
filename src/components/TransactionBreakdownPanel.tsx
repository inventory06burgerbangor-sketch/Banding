import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Database,
  Flame,
  Target,
} from 'lucide-react';
import { PeriodItemAnalysis, SystemMutationRecord } from '../types/inventory';
import { RAW_ACCURATE_BOTTOM_EXPORT_NOTES } from '../data/rawSpreadsheetCsv';

interface TransactionBreakdownPanelProps {
  selectedAnalysis: PeriodItemAnalysis;
  allPeriodItems: PeriodItemAnalysis[];
  startDay: number;
  endDay: number;
  onSelectItemAnalysis: (itemAnalysis: PeriodItemAnalysis) => void;
  systemMutations: SystemMutationRecord[];
  onOpenMutationUploadModal: () => void;
}

export const TransactionBreakdownPanel: React.FC<TransactionBreakdownPanelProps> = ({
  selectedAnalysis,
  allPeriodItems,
  startDay,
  endDay,
  onSelectItemAnalysis,
  systemMutations,
  onOpenMutationUploadModal,
}) => {
  const { item, periodDaily, lowestAccuracyDayRecord } = selectedAnalysis;
  const rawExportNote = RAW_ACCURATE_BOTTOM_EXPORT_NOTES[item.name];

  const matchingMutations = systemMutations.filter(
    (m) =>
      m.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(m.itemName.toLowerCase())
  );

  return (
    <section
      id="item-historical-analysis"
      className="border border-slate-800 bg-slate-900/80 rounded-2xl p-6 shadow-xl space-y-6"
    >
      {/* Header & Item Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Target className="w-3.5 h-3.5" />
            <span>Analisa Detail Tiap Item (Baseline 100,00%)</span>
            <span aria-hidden="true">·</span>
            <span>
              Periode: {startDay} Okt – {endDay} Okt 2026
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">
            Breakdown Historical Stock Akurasi &amp; Qty Selisih:{' '}
            <span className="text-amber-400">{item.name}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Kategori: {item.category}</span>
            <span aria-hidden="true">·</span>
            <span>Satuan: {item.uom}</span>
            <span aria-hidden="true">·</span>
            <span>
              Rata-Rata Akurasi Item ({startDay}–{endDay} Okt):{' '}
              <strong className="text-rose-400 font-mono">
                {selectedAnalysis.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Total Qty Selisih:{' '}
              <strong className="text-amber-300 font-mono">
                {selectedAnalysis.periodSelisih.toLocaleString('id-ID')} {item.uom}
              </strong>
            </span>
          </div>
        </div>

        {/* Item Switcher */}
        <div className="flex items-center gap-2.5 self-start">
          <label
            htmlFor="select-item-historical"
            className="text-xs text-slate-400 whitespace-nowrap"
          >
            Ganti Item:
          </label>
          <select
            id="select-item-historical"
            value={item.id}
            onChange={(e) => {
              const found = allPeriodItems.find((p) => p.item.id === e.target.value);
              if (found) onSelectItemAnalysis(found);
            }}
            className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-medium"
          >
            {allPeriodItems.map((p) => (
              <option key={p.item.id} value={p.item.id}>
                {p.item.name} — Akurasi: {p.periodAccuracyPercent.toFixed(2).replace('.', ',')}% |
                Selisih: {p.periodSelisih.toLocaleString('id-ID')} {p.item.uom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-Card Summary: Period Accuracy vs 100%, Lowest Accuracy Date Highlight, Root Cause */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Akurasi Item ({startDay}–{endDay} Okt)</span>
            <span className="font-mono text-emerald-400">Baseline: 100,00%</span>
          </div>
          <div className="text-3xl font-mono tabular-nums font-bold text-amber-400 mt-1.5">
            {selectedAnalysis.periodAccuracyPercent.toFixed(2).replace('.', ',')}%
          </div>
          <div className="text-xs font-mono tabular-nums text-rose-400 mt-1">
            Deviasi: {selectedAnalysis.gapFromBaseline100.toFixed(2).replace('.', ',')}% dari 100%
          </div>
          <div className="text-xs text-slate-300 mt-2 pt-2 border-t border-slate-800/80 flex justify-between font-mono tabular-nums">
            <span>Total SO: {selectedAnalysis.periodSO.toLocaleString('id-ID')}</span>
            <span className="text-rose-300 font-semibold">
              Qty Selisih: {selectedAnalysis.periodSelisih.toLocaleString('id-ID')} {item.uom}
            </span>
          </div>
        </div>

        {/* Highlight Tanggal dengan Akurasi Terendah */}
        <div className="border-2 border-rose-500/80 bg-rose-950/30 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
            <span>Highlight Tanggal Akurasi Terendah</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          {lowestAccuracyDayRecord ? (
            <>
              <div className="text-2xl font-mono tabular-nums font-bold text-rose-400 mt-1.5">
                {lowestAccuracyDayRecord.dateLabel} 2026 —{' '}
                {(lowestAccuracyDayRecord.dailyAccuracyPercent ?? 0)
                  .toFixed(2)
                  .replace('.', ',')}
                %
              </div>
              <div className="text-xs font-mono tabular-nums text-rose-200 mt-1">
                Qty Selisih: <strong>{lowestAccuracyDayRecord.selisih.toLocaleString('id-ID')}</strong>{' '}
                {item.uom} (SO: {(lowestAccuracyDayRecord.so ?? 0).toLocaleString('id-ID')} vs Acc:{' '}
                {(lowestAccuracyDayRecord.accurate ?? 0).toLocaleString('id-ID')})
              </div>
              <p className="text-xs text-slate-200 mt-2 pt-2 border-t border-rose-800/60">
                {lowestAccuracyDayRecord.transactionNote}
              </p>
            </>
          ) : (
            <div className="text-sm text-slate-400 mt-2">
              Tidak ada selisih pada periode tanggal ini (Akurasi 100%).
            </div>
          )}
        </div>

        {/* Diagnosa & Action Plan */}
        <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-4">
          <div className="text-xs text-slate-400">Analisa Penyebab &amp; Rekomendasi</div>
          <div className="text-sm font-semibold text-amber-300 mt-1">
            {item.rootCauseCategory}
          </div>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            {item.rootCauseSummary}
          </p>
          <p className="text-xs text-emerald-400 font-medium mt-2 pt-2 border-t border-slate-800">
            Tindakan: {item.recommendedAction}
          </p>
          {rawExportNote && (
            <p className="text-[11px] text-amber-300/90 mt-1.5">{rawExportNote.note}</p>
          )}
        </div>
      </div>

      {/* Visual Historical Stock Accuracy & Qty Selisih Cards across Selected Dates */}
      <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="text-xs font-semibold text-slate-200">
            Visualisasi Historical Stock Accuracy (vs Baseline 100%) &amp; Qty Selisih per Tanggal
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> % Akurasi Harian
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Tanggal Akurasi Terendah
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {periodDaily.map((d) => {
            const isLowest = d.isLowestAccuracyDay;
            const isHoliday = d.day === 4;
            const accPct = d.dailyAccuracyPercent ?? 0;

            return (
              <div
                key={d.day}
                className={`p-3.5 rounded-xl border transition-all ${
                  isLowest
                    ? 'border-2 border-rose-500 bg-rose-950/40 shadow-lg shadow-rose-950/30'
                    : isHoliday
                    ? 'border-slate-800/50 bg-slate-900/30 opacity-60'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{d.dateLabel}</span>
                  {isLowest && (
                    <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5" /> TERENDAH
                    </span>
                  )}
                </div>

                {/* Accuracy Bar relative to 100% Baseline */}
                <div className="mt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-400">Akurasi</span>
                    <span
                      className={`font-mono tabular-nums text-base font-bold ${
                        isHoliday
                          ? 'text-slate-500'
                          : isLowest
                          ? 'text-rose-400'
                          : accPct >= 95
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {isHoliday ? '-' : `${accPct.toFixed(2).replace('.', ',')}%`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full ${
                        isLowest
                          ? 'bg-rose-500'
                          : accPct >= 95
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${isHoliday ? 0 : Math.min(100, Math.max(4, accPct))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 font-mono tabular-nums text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Qty Selisih:</span>
                    <span
                      className={
                        isLowest
                          ? 'text-rose-300 font-bold underline decoration-rose-500'
                          : d.selisih > 0
                          ? 'text-amber-300 font-semibold'
                          : 'text-emerald-400'
                      }
                    >
                      {d.selisih.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">SO:</span>
                    <span className="text-slate-200">
                      {d.so !== null ? d.so.toLocaleString('id-ID') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Accurate:</span>
                    <span className="text-slate-200">
                      {d.accurate !== null ? d.accurate.toLocaleString('id-ID') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="py-3 px-3 font-medium">Tanggal</th>
              <th className="py-3 px-3 font-medium text-right">Stock Accuracy (vs 100%)</th>
              <th className="py-3 px-3 font-medium text-right">Gap dari 100%</th>
              <th className="py-3 px-3 font-medium text-right">Qty Selisih</th>
              <th className="py-3 px-3 font-medium text-right">Stok Fisik (SO)</th>
              <th className="py-3 px-3 font-medium text-right">Mutasi Fisik (&Delta; SO)</th>
              <th className="py-3 px-3 font-medium text-right">Stok Accurate</th>
              <th className="py-3 px-3 font-medium text-right">Mutasi Sistem (&Delta; Acc)</th>
              <th className="py-3 px-3 font-medium">Analisa Histori &amp; Highlight Akurasi Terendah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {periodDaily.map((d) => {
              const isLowest = d.isLowestAccuracyDay;
              const isHoliday = d.day === 4;

              return (
                <tr
                  key={d.day}
                  className={
                    isLowest
                      ? 'bg-rose-950/45 hover:bg-rose-950/60 transition-colors'
                      : isHoliday
                      ? 'bg-slate-950/40 text-slate-500'
                      : 'hover:bg-slate-800/40 transition-colors'
                  }
                >
                  <td className="py-3 px-3 font-mono tabular-nums font-semibold text-slate-200 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{d.dateLabel} 2026</span>
                      {isLowest && (
                        <span className="text-[10px] font-sans font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">
                          AKURASI TERENDAH
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {isHoliday ? (
                      <span className="text-slate-500">-</span>
                    ) : (
                      <span
                        className={`font-bold ${
                          isLowest
                            ? 'text-rose-400 text-base'
                            : (d.dailyAccuracyPercent ?? 100) >= 95
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {(d.dailyAccuracyPercent ?? 0).toFixed(2).replace('.', ',')}%
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs">
                    {isHoliday || d.gapFromBaseline100 === null ? (
                      <span className="text-slate-500">-</span>
                    ) : d.gapFromBaseline100 === 0 ? (
                      <span className="text-emerald-400">0,00% (Klop 100%)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">
                        {d.gapFromBaseline100.toFixed(2).replace('.', ',')}%
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {isLowest ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/25 border border-rose-500 text-rose-200 font-bold">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        {d.selisih.toLocaleString('id-ID')} {item.uom}
                      </span>
                    ) : d.selisih > 0 ? (
                      <span className="text-amber-300 font-semibold">
                        {d.selisih.toLocaleString('id-ID')} {item.uom}
                      </span>
                    ) : (
                      <span className="text-emerald-400">0</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                    {d.so !== null ? d.so.toLocaleString('id-ID') : '-'}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs">
                    {d.deltaSO === null || isHoliday ? (
                      <span className="text-slate-500">-</span>
                    ) : d.deltaSO > 0 ? (
                      <span className="text-emerald-400 inline-flex items-center justify-end gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />+{d.deltaSO.toLocaleString('id-ID')}
                      </span>
                    ) : d.deltaSO < 0 ? (
                      <span className="text-sky-400 inline-flex items-center justify-end gap-0.5">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {d.deltaSO.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>

                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums ${
                      d.accurate !== null && d.accurate < 0
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-200'
                    }`}
                  >
                    {d.accurate !== null ? d.accurate.toLocaleString('id-ID') : 'Kosong'}
                  </td>

                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs">
                    {d.deltaAccurate === null || isHoliday ? (
                      <span className="text-slate-500">-</span>
                    ) : d.deltaAccurate > 0 ? (
                      <span className="text-emerald-400 inline-flex items-center justify-end gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />+
                        {d.deltaAccurate.toLocaleString('id-ID')}
                      </span>
                    ) : d.deltaAccurate < 0 ? (
                      <span className="text-indigo-300 inline-flex items-center justify-end gap-0.5">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {d.deltaAccurate.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-xs leading-relaxed">
                    {isLowest && (
                      <div className="font-semibold text-rose-300 mb-0.5">
                        HIGHLIGHT AKURASI TERENDAH ({d.dateLabel}):{' '}
                        {d.spikeReason || `Akurasi turun ke ${(d.dailyAccuracyPercent ?? 0).toFixed(2)}%`}
                      </div>
                    )}
                    <span className="text-slate-300">{d.transactionNote}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Linked Master Data Histori Mutasi By Sistem for this Item */}
      <div className="border border-slate-800 bg-slate-950/70 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Rekonsiliasi Master Data Histori Mutasi By Sistem ({item.name})</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Menampilkan log transaksi masuk/keluar sistem yang terhubung sebagai Master Data untuk item ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenMutationUploadModal}
            className="px-3 py-1.5 text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 rounded-lg transition-colors whitespace-nowrap self-start"
          >
            Upload / Update Master Mutasi Sistem
          </button>
        </div>

        {matchingMutations.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-2.5">Tanggal</th>
                  <th className="py-2 px-2.5">No. Bukti Sistem</th>
                  <th className="py-2 px-2.5">Tipe Transaksi</th>
                  <th className="py-2 px-2.5 text-right">Qty Masuk (In)</th>
                  <th className="py-2 px-2.5 text-right">Qty Keluar (Out)</th>
                  <th className="py-2 px-2.5 text-right">Saldo Akhir Sistem</th>
                  <th className="py-2 px-2.5">Keterangan Mutasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {matchingMutations.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/60">
                    <td className="py-2 px-2.5 text-slate-200">{m.date}</td>
                    <td className="py-2 px-2.5 text-sky-300 font-semibold">{m.transactionNo}</td>
                    <td className="py-2 px-2.5 font-sans text-slate-300">{m.transactionType}</td>
                    <td className="py-2 px-2.5 text-right text-emerald-400">
                      {m.qtyIn > 0 ? `+${m.qtyIn.toLocaleString('id-ID')}` : '0'}
                    </td>
                    <td className="py-2 px-2.5 text-right text-rose-400">
                      {m.qtyOut > 0 ? `-${m.qtyOut.toLocaleString('id-ID')}` : '0'}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-200">
                      {m.balanceAfter !== null ? m.balanceAfter.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-2 px-2.5 font-sans text-slate-300">{m.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-400 py-3">
            Belum ada baris histori mutasi sistem spesifik untuk <strong>{item.name}</strong> di Master Data. Klik tombol <strong>Upload / Update Master Mutasi Sistem</strong> untuk mengunggah file histori mutasi dari sistem Anda.
          </div>
        )}
      </div>
    </section>
  );
};
