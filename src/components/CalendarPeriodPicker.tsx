import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { DailyAccuracySummary } from '../types/inventory';

interface CalendarPeriodPickerProps {
  availableDays: number[];
  startDay: number;
  endDay: number;
  monthLabel?: string;
  dailySummaries?: DailyAccuracySummary[];
  onChangeRange: (start: number, end: number) => void;
}

export const CalendarPeriodPicker: React.FC<CalendarPeriodPickerProps> = ({
  availableDays,
  startDay,
  endDay,
  monthLabel = 'Oktober 2026',
  dailySummaries = [],
  onChangeRange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectingStep, setSelectingStep] = useState<'START' | 'END'>('START');
  const [tempStart, setTempStart] = useState<number>(startDay);
  const [tempEnd, setTempEnd] = useState<number>(endDay);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempStart(startDay);
    setTempEnd(endDay);
  }, [startDay, endDay]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectingStep('START');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const shortMonth = monthLabel.split(' ')[0]?.slice(0, 3) || 'Okt';
  const allDays =
    availableDays.length > 0
      ? availableDays
      : Array.from({ length: 31 }, (_, i) => i + 1);
  const maxAvailableDay = allDays[allDays.length - 1] || 31;
  const minAvailableDay = allDays[0] || 1;

  const summaryMap = new Map<number, DailyAccuracySummary>();
  for (const s of dailySummaries) {
    summaryMap.set(s.day, s);
  }

  const handleDayClick = (day: number) => {
    if (selectingStep === 'START') {
      setTempStart(day);
      setTempEnd(day);
      setSelectingStep('END');
      onChangeRange(day, day);
    } else {
      const s = Math.min(tempStart, day);
      const e = Math.max(tempStart, day);
      setTempStart(s);
      setTempEnd(e);
      setSelectingStep('START');
      onChangeRange(s, e);
    }
  };

  // October 2026 starts on Thursday (3 empty cells for Mon, Tue, Wed)
  const leadingEmptySlots = [0, 1, 2];
  const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const effectivePreviewEnd =
    selectingStep === 'END' && hoverDay !== null ? hoverDay : tempEnd;
  const rangeMin = Math.min(tempStart, effectivePreviewEnd);
  const rangeMax = Math.max(tempStart, effectivePreviewEnd);

  const triggerLabel =
    startDay === endDay
      ? `Tanggal: ${String(startDay).padStart(2, '0')} ${shortMonth} 2026`
      : `Tanggal: ${String(startDay).padStart(2, '0')} ${shortMonth} – ${String(endDay).padStart(
          2,
          '0'
        )} ${shortMonth} 2026`;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSelectingStep('START');
        }}
        className="inline-flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#B8C9BE] bg-white hover:bg-[#F3F7F4] text-[#1E3329] shadow-sm transition-colors whitespace-nowrap"
      >
        <Calendar className="w-4 h-4 text-[#2D5A43]" />
        <span>{triggerLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#526358] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 left-0 sm:left-auto z-50 mt-2 w-[320px] sm:w-[345px] rounded-2xl border border-[#B8C9BE] bg-white p-4 shadow-2xl text-[#1C2822]">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE4]">
            <div>
              <div className="text-xs font-bold text-[#1E3329]">
                Pilih Tanggal Mutasi ({monthLabel})
              </div>
              <div className="text-[11px] text-[#526358]">
                {selectingStep === 'START'
                  ? 'Klik tanggal untuk memilih (klik 2x untuk 1 tanggal)'
                  : `Klik tanggal lagi untuk rentang atau selesai (${tempStart} ${shortMonth})`}
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#2D5A43] bg-[#E6EFE9] px-2 py-1 rounded-md">
              {rangeMin === rangeMax
                ? `${String(rangeMin).padStart(2, '0')} ${shortMonth}`
                : `${String(rangeMin).padStart(2, '0')}–${String(rangeMax).padStart(2, '0')} ${shortMonth}`}
            </span>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#5C6E63] mt-3 mb-1.5">
            {dayNames.map((dn) => (
              <div key={dn} className="py-1">
                {dn}
              </div>
            ))}
          </div>

          {/* All Spreadsheet Dates Grid (1..31) */}
          <div className="grid grid-cols-7 gap-1">
            {leadingEmptySlots.map((slot) => (
              <div key={`empty-${slot}`} className="h-9" />
            ))}
            {allDays.map((day) => {
              const isStart = day === rangeMin;
              const isEnd = day === rangeMax;
              const isInRange = day > rangeMin && day < rangeMax;
              const summary = summaryMap.get(day);
              const hasSheetData =
                summary !== undefined && (summary.stockFisik > 0 || summary.error > 0);
              const hasVariance = summary !== undefined && summary.error > 0;

              return (
                <button
                  key={day}
                  type="button"
                  onMouseEnter={() => setHoverDay(day)}
                  onMouseLeave={() => setHoverDay(null)}
                  onClick={() => handleDayClick(day)}
                  className={`relative h-9 rounded-lg text-xs font-mono tabular-nums font-medium flex flex-col items-center justify-center transition-colors ${
                    isStart || isEnd
                      ? 'bg-[#2D5A43] text-white font-bold shadow-sm'
                      : isInRange
                      ? 'bg-[#DCE9E1] text-[#1E3329] font-semibold'
                      : hasSheetData
                      ? 'bg-[#F2F6F3] hover:bg-[#E2ECE5] text-[#1C2822]'
                      : 'bg-white hover:bg-[#F2F6F3] text-[#64746B]'
                  }`}
                >
                  <span>{day}</span>
                  {hasSheetData && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isStart || isEnd
                          ? 'bg-white'
                          : hasVariance
                          ? 'bg-rose-500'
                          : 'bg-[#2D5A43]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Action Buttons (Without Kolom Periode) */}
          <div className="mt-3 pt-2.5 border-t border-[#E2EAE4] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setTempStart(minAvailableDay);
                setTempEnd(maxAvailableDay);
                setSelectingStep('START');
                onChangeRange(minAvailableDay, maxAvailableDay);
                setIsOpen(false);
              }}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-[#EBF1ED] hover:bg-[#DCE7E0] text-[#1E3329]"
            >
              Semua Tanggal Spreadsheet
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSelectingStep('START');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#2D5A43] text-white hover:bg-[#234735]"
            >
              <Check className="w-3 h-3" />
              <span>Terapkan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
