import React, { useMemo, useState } from 'react';
import { Flame, Search, ShieldCheck, TrendingDown } from 'lucide-react';
import { DailyAccuracySummary, InventoryItem } from '../types/inventory';

interface SpreadsheetMatrixTableProps {
  items: InventoryItem[];
  dailySummaries: DailyAccuracySummary[];
  selectedItemId: string;
  onSelectItem: (item: InventoryItem) => void;
}

export const SpreadsheetMatrixTable: React.FC<SpreadsheetMatrixTableProps> = ({
  items,
  dailySummaries,
  selectedItemId,
  onSelectItem,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [onlySpikes, setOnlySpikes] = useState<boolean>(false);

  const categories = useMemo(() => {
    const set = new Set<string>(items.map((i) => i.category));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (search && !it.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== 'ALL' && it.category !== categoryFilter) {
        return false;
      }
      if (onlySpikes && it.spikeCount === 0 && it.totalSelisih === 0) {
        return false;
      }
      return true;
    });
  }, [items, search, categoryFilter, onlySpikes]);

  // Visible active days with data (1, 2, 3, 5, 6, 7 - and optional toggle for day 4)
  const displayDays = [1, 2, 3, 5, 6, 7];

  return (
    <section id="spreadsheet-matrix" className="space-y-6">
      <div className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
              <span>Matriks Rekonsiliasi Harian</span>
              <span aria-hidden="true">·</span>
              <span>Highlight Lonjakan Drastis &amp; Baris Bawah Stock Accuracy</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mt-1">
              Tabel Spreadsheet SO vs Accurate (1–7 Oktober) &amp; Total Error Ujung Kanan
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Angka dengan lonjakan selisih drastis diberi highlight merah menyala (<Flame className="w-3.5 h-3.5 inline text-rose-400" />). Klik baris mana pun untuk membuka Breakdown Histori Transaksi di atas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama item..."
                className="bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500 w-48"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlySpikes(!onlySpikes)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                onlySpikes
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              Hanya Item Berselisih ({items.filter((i) => i.totalSelisih > 0).length})
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-4 overflow-x-auto max-h-[640px] overflow-y-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800">
              <tr className="border-b border-slate-800/80 text-slate-300">
                <th
                  rowSpan={2}
                  className="py-2.5 px-3 font-semibold sticky left-0 z-30 bg-slate-950 border-r border-slate-800 min-w-[190px]"
                >
                  Nama Item &amp; UOM
                </th>
                {displayDays.map((day) => (
                  <th
                    key={day}
                    colSpan={3}
                    className={`py-2 px-2 text-center font-semibold border-r border-slate-800 ${
                      day === 7 ? 'bg-rose-950/30 text-rose-300' : 'text-slate-200'
                    }`}
                  >
                    {day} Oktober {day === 7 ? '(Lonjakan Error)' : ''}
                  </th>
                ))}
                <th
                  colSpan={4}
                  className="py-2 px-2 text-center font-semibold bg-amber-500/10 text-amber-300"
                >
                  Bagian Ujung Kanan (Total Error per Item)
                </th>
              </tr>
              <tr className="text-[11px] text-slate-400 bg-slate-950">
                {displayDays.map((day) => (
                  <React.Fragment key={`sub-${day}`}>
                    <th className="py-1.5 px-2 text-right font-normal">SO</th>
                    <th className="py-1.5 px-2 text-right font-normal">Acc</th>
                    <th className="py-1.5 px-2 text-right font-semibold text-amber-300 border-r border-slate-800">
                      Selisih
                    </th>
                  </React.Fragment>
                ))}
                <th className="py-1.5 px-2.5 text-right font-semibold text-rose-400 bg-amber-500/5">
                  Total Selisih
                </th>
                <th className="py-1.5 px-2.5 text-right font-semibold text-slate-200 bg-amber-500/5">
                  Total SO
                </th>
                <th className="py-1.5 px-2.5 text-right font-semibold text-amber-300 bg-amber-500/5">
                  Kolom &quot;Error&quot;
                </th>
                <th className="py-1.5 px-2.5 text-right font-semibold text-rose-300 bg-amber-500/5">
                  % Selisih
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/15 hover:bg-amber-500/20'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-slate-900 border-r border-slate-800">
                      <div className="font-medium text-slate-100 truncate max-w-[180px]" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.uom}</div>
                    </td>

                    {displayDays.map((day) => {
                      const rec = item.daily.find((d) => d.day === day);
                      const so = rec?.so ?? null;
                      const acc = rec?.accurate ?? null;
                      const sel = rec?.selisih ?? 0;
                      const isSpike = rec?.isSpike ?? false;

                      return (
                        <React.Fragment key={`${item.id}-${day}`}>
                          <td className="py-2 px-2 text-right text-slate-300">
                            {so !== null ? so.toLocaleString('id-ID') : '-'}
                          </td>
                          <td
                            className={`py-2 px-2 text-right ${
                              acc !== null && acc < 0
                                ? 'text-rose-400 font-bold bg-rose-950/50'
                                : 'text-slate-300'
                            }`}
                          >
                            {acc !== null ? acc.toLocaleString('id-ID') : '-'}
                          </td>
                          <td
                            title={rec?.spikeReason || undefined}
                            className={`py-2 px-2 text-right border-r border-slate-800 ${
                              isSpike
                                ? 'bg-rose-500/25 text-rose-200 font-bold ring-1 ring-inset ring-rose-500'
                                : sel > 0
                                ? 'text-amber-300 font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            {isSpike ? (
                              <span className="inline-flex items-center justify-end gap-0.5">
                                <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                                {sel.toLocaleString('id-ID')}
                              </span>
                            ) : (
                              sel.toLocaleString('id-ID')
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Rightmost Total Error per Item columns */}
                    <td
                      className={`py-2 px-2.5 text-right font-bold bg-amber-500/5 ${
                        item.totalSelisih >= 1000
                          ? 'text-rose-400'
                          : item.totalSelisih > 0
                          ? 'text-amber-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.totalSelisih.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-200 bg-amber-500/5">
                      {item.totalSO.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-2.5 text-right font-semibold text-amber-300 bg-amber-500/5">
                      {item.sheetRightmostErrorCol}
                    </td>
                    <td
                      className={`py-2 px-2.5 text-right font-bold bg-amber-500/5 ${
                        item.errorRatePercent >= 30
                          ? 'text-rose-400'
                          : item.errorRatePercent > 0
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {item.totalSO === 0 && item.totalSelisih > 0
                        ? 'SO=0'
                        : `${item.errorRatePercent.toFixed(2).replace('.', ',')}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* HIGHLIGHT POIN ACCURACY STOCK DI BAGIAN BAWAH */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-950 border-t-2 border-amber-500 font-mono tabular-nums">
              <tr className="bg-slate-900/95 border-b border-slate-800">
                <td className="py-2.5 px-3 font-sans font-semibold text-slate-200 sticky left-0 bg-slate-900 border-r border-slate-800">
                  Stock Fisik (Total Bawah)
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  return (
                    <td
                      key={`sf-${day}`}
                      colSpan={3}
                      className="py-2.5 px-3 text-right font-semibold text-sky-300 border-r border-slate-800"
                    >
                      {(sum?.stockFisik ?? 0).toLocaleString('id-ID')}
                    </td>
                  );
                })}
                <td colSpan={4} className="py-2.5 px-3 text-right font-semibold text-sky-300">
                  4.148.141 (Akumulasi Fisik)
                </td>
              </tr>

              <tr className="bg-slate-900/95 border-b border-slate-800">
                <td className="py-2.5 px-3 font-sans font-semibold text-rose-300 sticky left-0 bg-slate-900 border-r border-slate-800">
                  Error (Total Selisih Harian)
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  const isDrastic = sum?.isDrasticDrop;
                  return (
                    <td
                      key={`err-${day}`}
                      colSpan={3}
                      className={`py-2.5 px-3 text-right font-bold border-r border-slate-800 ${
                        isDrastic
                          ? 'bg-rose-500/30 text-rose-200 ring-1 ring-inset ring-rose-500'
                          : 'text-rose-400'
                      }`}
                    >
                      {isDrastic && <Flame className="w-3.5 h-3.5 inline mr-1 text-rose-400" />}
                      {(sum?.error ?? 0).toLocaleString('id-ID')}
                    </td>
                  );
                })}
                <td colSpan={4} className="py-2.5 px-3 text-right font-bold text-rose-400">
                  104.508 (Total Error)
                </td>
              </tr>

              <tr className="bg-slate-900/95 border-b border-slate-800">
                <td className="py-2.5 px-3 font-sans font-semibold text-amber-300 sticky left-0 bg-slate-900 border-r border-slate-800">
                  WAPE (Error / Stock Fisik)
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  return (
                    <td
                      key={`wape-${day}`}
                      colSpan={3}
                      className={`py-2.5 px-3 text-right font-bold border-r border-slate-800 ${
                        sum?.isDrasticDrop ? 'text-rose-300 bg-rose-950/50' : 'text-amber-300'
                      }`}
                    >
                      {sum?.wapeStr}
                    </td>
                  );
                })}
                <td colSpan={4} className="py-2.5 px-3 text-right font-bold text-amber-300">
                  Rata-rata WAPE: 2,52%
                </td>
              </tr>

              <tr className="bg-amber-500/15">
                <td className="py-3 px-3 font-sans font-bold text-amber-300 sticky left-0 bg-slate-950 border-r border-slate-800">
                  STOCK ACCURACY (Highlight Bawah)
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  return (
                    <td
                      key={`acc-${day}`}
                      colSpan={3}
                      className={`py-3 px-3 text-right text-sm font-bold border-r border-slate-800 ${
                        sum?.isDrasticDrop
                          ? 'bg-rose-500/30 text-rose-200 ring-1 ring-inset ring-rose-500'
                          : 'text-emerald-400'
                      }`}
                    >
                      {sum?.stockAccuracyStr}
                    </td>
                  );
                })}
                <td colSpan={4} className="py-3 px-3 text-right text-sm font-bold text-emerald-400">
                  Rata-rata Akurasi: 97,48%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dedicated Highlight Poin Accuracy Stock Di Bagian Bawah Card */}
      <div
        id="bottom-accuracy-highlight"
        className="border-2 border-amber-500/80 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Highlight Poin Accuracy Stock (Bagian Bawah Spreadsheet)</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mt-1">
              Rekapitulasi Stock Fisik, Error, WAPE &amp; Stock Accuracy Harian (1–7 Oktober)
            </h3>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Baris ringkasan di bagian bawah spreadsheet menunjukkan akurasi stok sangat terjaga pada 1–6 Oktober (<strong className="text-emerald-400">97,36% – 98,47%</strong>), namun turun drastis pada 7 Oktober ke <strong className="text-rose-400">95,47%</strong> akibat lonjakan Error dari <span className="font-mono">16.405</span> menjadi <span className="font-mono text-rose-300 font-semibold">33.851</span> (+106,3%).
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/90 border border-slate-800 rounded-lg px-4 py-3 shrink-0">
            <div>
              <div className="text-xs text-slate-400">Akurasi 1–6 Okt</div>
              <div className="text-xl font-mono tabular-nums font-bold text-emerald-400">97,93%</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-xs text-rose-300">Drop 7 Okt (Cut-Off)</div>
              <div className="text-xl font-mono tabular-nums font-bold text-rose-400 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                95,47%
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mt-5">
          {dailySummaries.map((d) => {
            const isHoliday = d.day === 4;
            return (
              <div
                key={d.day}
                className={`rounded-lg p-4 border transition-colors ${
                  d.isDrasticDrop
                    ? 'border-rose-500 bg-rose-950/35'
                    : isHoliday
                    ? 'border-slate-800/70 bg-slate-950/40'
                    : 'border-slate-800 bg-slate-950/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">{d.dateLabel} 2026</span>
                  {d.isDrasticDrop && (
                    <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-0.5">
                      <Flame className="w-3.5 h-3.5" /> Drop
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-[11px] text-slate-400">Stock Accuracy</div>
                  <div
                    className={`text-2xl font-mono tabular-nums font-bold mt-0.5 ${
                      d.isDrasticDrop
                        ? 'text-rose-400'
                        : isHoliday
                        ? 'text-slate-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {d.stockAccuracyStr}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">WAPE:</span>
                    <span className={d.isDrasticDrop ? 'text-rose-300 font-bold' : 'text-amber-300'}>
                      {d.wapeStr}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Stock Fisik:</span>
                    <span className="text-slate-200">{d.stockFisik.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Total Error:</span>
                    <span className={d.isDrasticDrop ? 'text-rose-400 font-bold' : 'text-rose-300'}>
                      {d.error.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
