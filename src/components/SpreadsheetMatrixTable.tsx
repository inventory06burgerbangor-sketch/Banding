import React, { useMemo, useState } from 'react';
import { Flame, Search } from 'lucide-react';
import { DailyAccuracySummary, InventoryItem } from '../types/inventory';

interface SpreadsheetMatrixTableProps {
  items: InventoryItem[];
  dailySummaries: DailyAccuracySummary[];
  startDay: number;
  endDay: number;
  selectedItemId: string;
  onSelectItem: (item: InventoryItem) => void;
}

export const SpreadsheetMatrixTable: React.FC<SpreadsheetMatrixTableProps> = ({
  items,
  dailySummaries,
  startDay,
  endDay,
  selectedItemId,
  onSelectItem,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'variance_only' | 'spikes_only'>(
    'all'
  );
  const [showAllSpreadsheetDates, setShowAllSpreadsheetDates] = useState<boolean>(false);

  const displayDays = useMemo(() => {
    const allDays = dailySummaries.map((d) => d.day);
    if (showAllSpreadsheetDates) return allDays;
    return allDays.filter((d) => d >= startDay && d <= endDay);
  }, [dailySummaries, showAllSpreadsheetDates, startDay, endDay]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        it.category.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filterMode === 'variance_only') return it.totalSelisih > 0;
      if (filterMode === 'spikes_only') return it.spikeCount > 0;
      return true;
    });
  }, [items, search, filterMode]);

  const displayedSummaries = useMemo(
    () => dailySummaries.filter((d) => displayDays.includes(d.day)),
    [dailySummaries, displayDays]
  );

  const totalDisplayedFisik = useMemo(
    () => displayedSummaries.reduce((s, d) => s + d.stockFisik, 0),
    [displayedSummaries]
  );
  const totalDisplayedError = useMemo(
    () => displayedSummaries.reduce((s, d) => s + d.error, 0),
    [displayedSummaries]
  );
  const displayedWape =
    totalDisplayedFisik > 0
      ? Number(((totalDisplayedError / totalDisplayedFisik) * 100).toFixed(2))
      : 0;
  const displayedAccuracy = Number(Math.max(0, 100 - displayedWape).toFixed(2));

  return (
    <section id="spreadsheet-matrix-section" className="space-y-4">
      <div className="border border-[#C5D3C9] bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#E2EAE4]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#2D5A43] font-medium">
              <span>Sheet rekap Daily</span>
              <span aria-hidden="true">·</span>
              <span>{items.length} Item Terdaftar</span>
            </div>
            <h2 className="text-xl font-bold text-[#1C2822] mt-1">
              Tabel Rekap SO vs Accurate
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#526358] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari item..."
                className="bg-[#F4F7F5] border border-[#B8C9BE] text-[#1C2822] text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#2D5A43] w-48"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#EBF1ED] border border-[#C5D3C9] rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  filterMode === 'all'
                    ? 'bg-[#2D5A43] text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Semua Item ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('variance_only')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  filterMode === 'variance_only'
                    ? 'bg-[#2D5A43] text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Berselisih
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('spikes_only')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  filterMode === 'spikes_only'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'text-[#3B5246] hover:text-[#1C2822]'
                }`}
              >
                Lonjakan Drastis
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAllSpreadsheetDates((v) => !v)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#B8C9BE] bg-[#F4F7F5] hover:bg-[#E4EFE8] text-[#1E3329] transition-colors whitespace-nowrap"
            >
              {showAllSpreadsheetDates
                ? `Tanggal Terpilih (${startDay}–${endDay} Okt)`
                : `Semua Tanggal (1–${dailySummaries.length} Okt)`}
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-4 overflow-x-auto max-h-[540px] border border-[#C5D3C9] rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[#EBF1ED] text-[#1E3329] border-b border-[#C5D3C9]">
              <tr>
                <th
                  rowSpan={2}
                  className="py-2.5 px-3 font-semibold sticky left-0 z-30 bg-[#EBF1ED] border-r border-[#C5D3C9] min-w-[180px]"
                >
                  Nama Item (Satuan)
                </th>
                {displayDays.map((day) => (
                  <th
                    key={`h-day-${day}`}
                    colSpan={3}
                    className="py-2 px-2 text-center font-bold border-r border-[#C5D3C9]"
                  >
                    {day} Okt
                  </th>
                ))}
                <th
                  colSpan={3}
                  className="py-2 px-2 text-center font-bold bg-[#DFECE4] text-[#1E4631]"
                >
                  Total Error per Item
                </th>
              </tr>
              <tr className="border-t border-[#C5D3C9] text-[11px] text-[#4A5D52]">
                {displayDays.map((day) => (
                  <React.Fragment key={`sub-day-${day}`}>
                    <th className="py-1.5 px-2 text-right">SO</th>
                    <th className="py-1.5 px-2 text-right">Acc</th>
                    <th className="py-1.5 px-2 text-right font-semibold text-rose-700 border-r border-[#C5D3C9]">
                      Selisih
                    </th>
                  </React.Fragment>
                ))}
                <th className="py-1.5 px-2.5 text-right bg-[#DFECE4] font-semibold text-rose-700">
                  Total Selisih
                </th>
                <th className="py-1.5 px-2.5 text-right bg-[#DFECE4]">Total SO</th>
                <th className="py-1.5 px-2.5 text-right bg-[#DFECE4] font-semibold text-[#1E4631]">
                  Akurasi Sheet
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E8EFEA] font-mono tabular-nums text-[#1C2822]">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#E4EFE8]' : 'hover:bg-[#F4F7F5]'
                    }`}
                  >
                    <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-white border-r border-[#DCE5DF]">
                      <div className="font-semibold text-[#1C2822] truncate max-w-[190px]">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-[#526358]">{item.uom}</div>
                    </td>

                    {displayDays.map((day) => {
                      const dRec = item.daily.find((d) => d.day === day);
                      const sel = dRec?.selisih ?? 0;
                      const isSpike = dRec?.isSpike;

                      return (
                        <React.Fragment key={`${item.id}-d-${day}`}>
                          <td className="py-2 px-2 text-right text-[#3B5246]">
                            {dRec?.so !== null && dRec?.so !== undefined
                              ? dRec.so.toLocaleString('id-ID')
                              : '-'}
                          </td>
                          <td className="py-2 px-2 text-right text-[#3B5246]">
                            {dRec?.accurate !== null && dRec?.accurate !== undefined
                              ? dRec.accurate.toLocaleString('id-ID')
                              : '-'}
                          </td>
                          <td
                            className={`py-2 px-2 text-right border-r border-[#E8EFEA] font-semibold ${
                              isSpike
                                ? 'bg-rose-100 text-rose-700 font-bold'
                                : sel > 0
                                ? 'text-rose-600'
                                : 'text-[#7A8C81]'
                            }`}
                          >
                            {sel.toLocaleString('id-ID')}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    <td className="py-2 px-2.5 text-right font-bold text-rose-600 bg-[#F4F8F5]">
                      {item.totalSelisih.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-2.5 text-right text-[#1C2822] bg-[#F4F8F5]">
                      {item.totalSO.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-2.5 text-right font-semibold text-[#1E6F43] bg-[#F4F8F5]">
                      {item.sheetRightmostErrorCol}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-20 bg-[#EBF1ED] border-t-2 border-[#2D5A43] font-mono tabular-nums text-[#1C2822]">
              <tr className="border-b border-[#C5D3C9]">
                <td className="py-2 px-3 font-sans font-semibold sticky left-0 bg-[#EBF1ED] border-r border-[#C5D3C9]">
                  Stock Fisik
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  return (
                    <td
                      key={`sf-${day}`}
                      colSpan={3}
                      className="py-2 px-3 text-right font-semibold text-[#1E3329] border-r border-[#C5D3C9]"
                    >
                      {(sum?.stockFisik ?? 0).toLocaleString('id-ID')}
                    </td>
                  );
                })}
                <td colSpan={3} className="py-2 px-3 text-right font-semibold text-[#1E3329]">
                  {totalDisplayedFisik.toLocaleString('id-ID')}
                </td>
              </tr>

              <tr className="border-b border-[#C5D3C9]">
                <td className="py-2 px-3 font-sans font-semibold text-rose-700 sticky left-0 bg-[#EBF1ED] border-r border-[#C5D3C9]">
                  Error (Total Selisih Harian)
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  const isDrastic = sum?.isDrasticDrop;
                  return (
                    <td
                      key={`err-${day}`}
                      colSpan={3}
                      className={`py-2 px-3 text-right font-bold border-r border-[#C5D3C9] ${
                        isDrastic ? 'bg-rose-100 text-rose-700' : 'text-rose-600'
                      }`}
                    >
                      {isDrastic && <Flame className="w-3 h-3 inline mr-1 text-rose-600" />}
                      {(sum?.error ?? 0).toLocaleString('id-ID')}
                    </td>
                  );
                })}
                <td colSpan={3} className="py-2 px-3 text-right font-bold text-rose-600">
                  {totalDisplayedError.toLocaleString('id-ID')}
                </td>
              </tr>

              <tr className="bg-[#DCE9E1]">
                <td className="py-2.5 px-3 font-sans font-bold text-[#1E4631] sticky left-0 bg-[#DCE9E1] border-r border-[#B8C9BE]">
                  Stock Accuracy
                </td>
                {displayDays.map((day) => {
                  const sum = dailySummaries.find((d) => d.day === day);
                  return (
                    <td
                      key={`acc-${day}`}
                      colSpan={3}
                      className={`py-2.5 px-3 text-right font-bold border-r border-[#B8C9BE] ${
                        sum?.isDrasticDrop ? 'bg-rose-100 text-rose-700' : 'text-[#1E6F43]'
                      }`}
                    >
                      {sum?.stockAccuracyStr}
                    </td>
                  );
                })}
                <td colSpan={3} className="py-2.5 px-3 text-right font-bold text-[#1E6F43]">
                  Akurasi: {displayedAccuracy.toFixed(2).replace('.', ',')}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
};
