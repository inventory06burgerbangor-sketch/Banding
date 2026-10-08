import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import {
  DEFAULT_SHEET_NAME,
  INITIAL_SPREADSHEET_CSV,
  SPREADSHEET_DATA_VERSION,
} from './data/rawSpreadsheetCsv';
import {
  computePeriodDashboardAnalysis,
  INITIAL_SAMPLE_STOCK_CARDS,
  INITIAL_SYSTEM_MUTATION_MASTER,
  parseAndAnalyzeSpreadsheet,
} from './utils/analyzer';
import { PeriodAverageAccuracyHero } from './components/PeriodAverageAccuracyHero';
import { DashboardChartsSection } from './components/DashboardChartsSection';
import { Top10ErrorSection } from './components/Top10ErrorSection';
import { TransactionBreakdownPanel } from './components/TransactionBreakdownPanel';
import { SpreadsheetMatrixTable } from './components/SpreadsheetMatrixTable';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from './types/inventory';

type MainMenuOption = 'dashboard_report' | 'analisa';

const STORAGE_VERSION_KEY = 'bangor_sheet_version';
const STORAGE_CSV_KEY = 'bangor_sheet_csv';
const STORAGE_URL_KEY = 'bangor_sheet_url';
const STORAGE_SHEET_NAME_KEY = 'bangor_sheet_name';

export default function App() {
  // 2 Opsi Menu Utama: 'dashboard_report' | 'analisa'
  const [activeMenu, setActiveMenu] = useState<MainMenuOption>('dashboard_report');

  const [csvData, setCsvData] = useState<string>(() => {
    try {
      const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
      const savedCsv = localStorage.getItem(STORAGE_CSV_KEY);
      if (savedVersion === SPREADSHEET_DATA_VERSION && savedCsv && savedCsv.trim().length > 20) {
        return savedCsv;
      }
      localStorage.setItem(STORAGE_VERSION_KEY, SPREADSHEET_DATA_VERSION);
      localStorage.setItem(STORAGE_CSV_KEY, INITIAL_SPREADSHEET_CSV);
    } catch {
      // ignore storage errors
    }
    return INITIAL_SPREADSHEET_CSV;
  });

  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_URL_KEY) || '';
    } catch {
      return '';
    }
  });

  const [sheetName, setSheetName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_SHEET_NAME_KEY) || DEFAULT_SHEET_NAME;
    } catch {
      return DEFAULT_SHEET_NAME;
    }
  });

  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(7);

  // Top 10 di Dashboard Report tetap aktifkan mode Hide
  const [isTop10OpenDashboard, setIsTop10OpenDashboard] = useState<boolean>(false);
  const [showMatrixInDashboard, setShowMatrixInDashboard] = useState<boolean>(false);

  // Data Mutasi Sistem & Kartu Stock (Kosong secara default kecuali ada upload)
  const [systemMutations, setSystemMutations] = useState<SystemMutationRecord[]>(
    INITIAL_SYSTEM_MUTATION_MASTER
  );
  const [stockCards, setStockCards] = useState<AnalyzedStockCard[]>(
    INITIAL_SAMPLE_STOCK_CARDS
  );
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Manual Refresh state (Tanpa Auto-Refresh 30 detik)
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshRevision, setRefreshRevision] = useState<number>(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Parse base spreadsheet (Sinkron otomatis setiap kali csvData berubah atau Refresh manual ditekan)
  const parsed = useMemo(
    () => parseAndAnalyzeSpreadsheet(csvData),
    [csvData, refreshRevision]
  );

  // Bila spreadsheet yang baru disinkronkan memiliki tanggal aktif baru yang terisi data (misal tgl 8, 9, dst.),
  // sesuaikan batas tanggal aktif secara otomatis agar data terbaru langsung tampil
  useEffect(() => {
    const populatedSummaries = parsed.dailySummaries.filter(
      (s) => s.stockFisik > 0 || s.error > 0
    );
    if (populatedSummaries.length > 0) {
      const firstPopulated = populatedSummaries[0].day;
      const lastPopulated = populatedSummaries[populatedSummaries.length - 1].day;
      setStartDay((prevStart) =>
        parsed.activeDays.includes(prevStart) ? prevStart : firstPopulated
      );
      setEndDay((prevEnd) => {
        if (!parsed.activeDays.includes(prevEnd) || lastPopulated > prevEnd) {
          return lastPopulated;
        }
        return prevEnd;
      });
    }
  }, [parsed]);

  // Compute analysis dynamically for [startDay .. endDay] with Baseline 100% (dan tanpa 0% sebagai terendah)
  const periodData = useMemo(
    () => computePeriodDashboardAnalysis(parsed, startDay, endDay),
    [parsed, startDay, endDay]
  );

  // Hanya tampilkan analisa untuk item yang di-search
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const selectedPeriodItem: PeriodItemAnalysis | null = useMemo(() => {
    if (!selectedItemId) return null;
    return (
      periodData.periodItems.find((p) => p.item.id === selectedItemId) ||
      periodData.periodItems.find(
        (p) =>
          p.item.name.toLowerCase().trim() ===
          selectedItemId.replace(/^item-\d+-/, '').replace(/-/g, ' ').toLowerCase().trim()
      ) ||
      null
    );
  }, [periodData.periodItems, selectedItemId]);

  const applyAndPersistSpreadsheet = useCallback(
    (newCsv: string, newUrl: string, newSheetName: string = DEFAULT_SHEET_NAME) => {
      setCsvData(newCsv);
      setSheetUrl(newUrl);
      setSheetName(newSheetName || DEFAULT_SHEET_NAME);
      setRefreshRevision((r) => r + 1);
      setLastUpdated(new Date());
      try {
        localStorage.setItem(STORAGE_VERSION_KEY, SPREADSHEET_DATA_VERSION);
        localStorage.setItem(STORAGE_CSV_KEY, newCsv);
        localStorage.setItem(STORAGE_URL_KEY, newUrl);
        localStorage.setItem(STORAGE_SHEET_NAME_KEY, newSheetName || DEFAULT_SHEET_NAME);
      } catch {
        // ignore storage errors
      }
    },
    []
  );

  // Manual Refresh Handler: Sinkronkan ulang data dari Spreadsheet (Sheet rekap Daily)
  const triggerManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSyncNotice(null);
    try {
      if (sheetUrl.trim()) {
        const res = await fetch('/api/fetch-spreadsheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: sheetUrl.trim(),
            sheetName: sheetName || DEFAULT_SHEET_NAME,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.csvText && data.csvText.trim().length > 10) {
            applyAndPersistSpreadsheet(data.csvText, sheetUrl.trim(), sheetName);
            const reParsed = parseAndAnalyzeSpreadsheet(data.csvText);
            setSyncNotice(
              `Data terupdate dari Sheet "${sheetName || DEFAULT_SHEET_NAME}" (${reParsed.items.length} item)`
            );
            setTimeout(() => setSyncNotice(null), 4000);
            return;
          }
        }
      }
      // Jika belum ada link eksternal, pastikan base data terbaru Sheet rekap Daily dievaluasi ulang
      setRefreshRevision((r) => r + 1);
      setLastUpdated(new Date());
      setSyncNotice(
        `Data disinkronkan: Sheet "${sheetName || DEFAULT_SHEET_NAME}" (${parsed.items.length} item)`
      );
      setTimeout(() => setSyncNotice(null), 3500);
    } catch {
      setRefreshRevision((r) => r + 1);
      setLastUpdated(new Date());
    } finally {
      setTimeout(() => setIsRefreshing(false), 180);
    }
  }, [sheetUrl, sheetName, applyAndPersistSpreadsheet, parsed.items.length]);

  const handleSelectItemAndOpenAnalisa = (p: PeriodItemAnalysis) => {
    setSelectedItemId(p.item.id);
    setActiveMenu('analisa');
    setTimeout(() => {
      const el = document.getElementById('item-historical-analysis');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleUpdateMutationMaster = (
    newRecords: SystemMutationRecord[],
    replaceAll: boolean = false
  ) => {
    setSystemMutations((prev) => (replaceAll ? newRecords : [...newRecords, ...prev]));
  };

  const handleSaveStockCard = (card: AnalyzedStockCard) => {
    setStockCards((prev) => {
      const exists = prev.some(
        (c) =>
          c.id === card.id ||
          c.itemName.toLowerCase().trim() === card.itemName.toLowerCase().trim()
      );
      if (exists) {
        return prev.map((c) =>
          c.id === card.id ||
          c.itemName.toLowerCase().trim() === card.itemName.toLowerCase().trim()
            ? card
            : c
        );
      }
      return [card, ...prev];
    });
  };

  return (
    <div className="min-h-screen bg-[#EEF2EE] text-[#1C2822] flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand | 2 Main Menu Options | Manual Refresh & Data Spreadsheet) */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-white/95 backdrop-blur border-b border-[#C5D3C9]">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-[#1E3329]">
            Bangor Inventory
          </span>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#E8EFEA] text-[#2D5A43] border border-[#C5D3C9]">
            Sheet: {sheetName || DEFAULT_SHEET_NAME} ({parsed.items.length} Item)
          </span>
        </div>

        {/* Zone 2: 2 OPSI BESAR MENU UTAMA (Dashboard Report & Analisa) */}
        <nav
          aria-label="Menu Utama"
          className="flex items-center gap-1.5 p-1 bg-[#E6EFE9] border border-[#C5D3C9] rounded-xl"
        >
          <button
            type="button"
            onClick={() => setActiveMenu('dashboard_report')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeMenu === 'dashboard_report'
                ? 'bg-[#2D5A43] text-white shadow-sm'
                : 'text-[#3B5246] hover:text-[#1C2822] hover:bg-[#DCE7E0]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMenu('analisa')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeMenu === 'analisa'
                ? 'bg-[#2D5A43] text-white shadow-sm'
                : 'text-[#3B5246] hover:text-[#1C2822] hover:bg-[#DCE7E0]'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            <span>Analisa</span>
          </button>
        </nav>

        {/* Zone 3: Tombol Refresh Manual & Sumber Spreadsheet */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={triggerManualRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#2D5A43] hover:bg-[#234735] text-white rounded-xl transition-colors whitespace-nowrap shadow-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#E6EFE9] hover:bg-[#DCE7E0] border border-[#B8C9BE] text-[#1E3329] rounded-xl transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2D5A43]" />
            <span>Spreadsheet</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Compact Status Info Strip (Unboxed text metadata with · separators) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4A5D52]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#1E6F43] font-semibold">Baseline Akurasi: 100%</span>
            <span aria-hidden="true">·</span>
            <span>
              Base Data: <strong className="text-[#1E3329]">Sheet {sheetName || DEFAULT_SHEET_NAME}</strong> ({parsed.items.length} Item)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Tanggal Spreadsheet: 1–{parsed.activeDays[parsed.activeDays.length - 1] || 31}{' '}
              {parsed.monthLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Sinkron Terakhir: {lastUpdated.toLocaleTimeString('id-ID')}
            </span>
          </div>

          {syncNotice && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E6F4EA] border border-[#9AD0AE] text-[#1E6F43] font-semibold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{syncNotice}</span>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* OPSI MENU 1: DASHBOARD REPORT (Hasil Analisa, Persentase & Top 10)     */}
        {/* ===================================================================== */}
        {activeMenu === 'dashboard_report' && (
          <div className="space-y-6">
            {/* 1. Persentase Akurasi & Hasil Analisa Rata-Rata + Pilihan Tanggal Mutasi */}
            <PeriodAverageAccuracyHero
              availableDays={parsed.activeDays}
              monthLabel={parsed.monthLabel}
              startDay={periodData.startDay}
              endDay={periodData.endDay}
              onChangeRange={(s, e) => {
                setStartDay(s);
                setEndDay(e);
              }}
              averagePeriodAccuracy={periodData.averagePeriodAccuracy}
              weightedPeriodAccuracy={periodData.weightedPeriodAccuracy}
              periodWape={periodData.periodWape}
              periodTotalFisik={periodData.periodTotalFisik}
              periodTotalError={periodData.periodTotalError}
              gapFromBaseline100={periodData.gapFromBaseline100}
              lowestDaySummary={periodData.lowestDaySummary}
              highestDaySummary={periodData.highestDaySummary}
              periodSummaries={periodData.periodSummaries}
              allDailySummaries={parsed.dailySummaries}
              periodItems={periodData.periodItems}
              onSelectItemAnalysis={handleSelectItemAndOpenAnalisa}
            />

            {/* 2. Grafik Akurasi per Tanggal & Grafik Opsional Per Item (Hanya Muncul Jika Di-Klik) */}
            <DashboardChartsSection
              periodSummaries={periodData.periodSummaries}
              periodItems={periodData.periodItems}
              startDay={periodData.startDay}
              endDay={periodData.endDay}
              monthLabel={parsed.monthLabel}
              lowestDaySummary={periodData.lowestDaySummary}
              onSelectItemAnalysis={handleSelectItemAndOpenAnalisa}
            />

            {/* 3. Top 10 (Mode Hide Aktif - Hanya di Dashboard Report, 0% dikecualikan) */}
            <Top10ErrorSection
              periodItems={periodData.periodItems}
              startDay={periodData.startDay}
              endDay={periodData.endDay}
              selectedItemId={selectedPeriodItem?.item.id || ''}
              onSelectItemAnalysis={handleSelectItemAndOpenAnalisa}
              systemMutations={systemMutations}
              stockCards={stockCards}
              isOpen={isTop10OpenDashboard}
              onToggleOpen={() => setIsTop10OpenDashboard((prev) => !prev)}
            />

            {/* 3. Opsi Buka Tabel Rekap SO & Stock Accuracy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-[#C5D3C9] bg-white rounded-2xl px-5 py-3.5 shadow-sm">
                <span className="text-xs font-semibold text-[#1C2822]">
                  Tabel Rekap Sheet rekap Daily — SO vs Accurate ({startDay}–{endDay} Okt)
                </span>
                <button
                  type="button"
                  onClick={() => setShowMatrixInDashboard((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#E8EFEA] hover:bg-[#DCE7E0] text-[#1E3329] rounded-xl border border-[#B8C9BE]"
                >
                  <span>{showMatrixInDashboard ? 'Sembunyikan Tabel' : 'Tampilkan Tabel SO'}</span>
                  {showMatrixInDashboard ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showMatrixInDashboard && (
                <SpreadsheetMatrixTable
                  items={parsed.items}
                  dailySummaries={parsed.dailySummaries}
                  startDay={periodData.startDay}
                  endDay={periodData.endDay}
                  selectedItemId={selectedPeriodItem?.item.id || ''}
                  onSelectItem={(item) => {
                    const found = periodData.periodItems.find((p) => p.item.id === item.id);
                    if (found) handleSelectItemAndOpenAnalisa(found);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* OPSI MENU 2: ANALISA (Tanpa Top 10)                                   */}
        {/* Urutan:                                                               */}
        {/* 1. Upload Mutasi Sistem & Upload Kartu Stock (Hanya "Upload berhasil")*/}
        {/* 2. Search Bar Item + Pilihan Tanggal Mutasi                           */}
        {/*    + Filter: Tampilkan semua / Tampilkan hanya selisih                */}
        {/*    + Tombol Breakdown per tanggal (Baseline SO tgl 1 - Out tgl 2 = SO tgl 2,*/}
        {/*      Kecocokan Tanggal & Qty IN-OUT, 3 Kemungkinan Perluasan Logika)  */}
        {/* ===================================================================== */}
        {activeMenu === 'analisa' && (
          <TransactionBreakdownPanel
            selectedAnalysis={selectedPeriodItem}
            allPeriodItems={periodData.periodItems}
            availableDays={parsed.activeDays}
            monthLabel={parsed.monthLabel}
            dailySummaries={parsed.dailySummaries}
            startDay={periodData.startDay}
            endDay={periodData.endDay}
            onChangeRange={(s, e) => {
              setStartDay(s);
              setEndDay(e);
            }}
            onSelectItemAnalysis={(p) => setSelectedItemId(p ? p.item.id : '')}
            systemMutations={systemMutations}
            onUpdateMutationRecords={handleUpdateMutationMaster}
            stockCards={stockCards}
            onSaveStockCard={handleSaveStockCard}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D2DED6] px-6 py-4 text-xs text-[#526358] flex flex-col sm:flex-row items-center justify-between max-w-[1440px] w-full mx-auto">
        <span>Bangor Inventory · Sheet rekap Daily · Baseline Akurasi 100%</span>
        <span>
          Tanggal Mutasi: {startDay}–{endDay} {parsed.monthLabel}
        </span>
      </footer>

      {/* Modal Sinkronisasi Spreadsheet */}
      <SpreadsheetSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        currentCsv={csvData}
        sheetUrl={sheetUrl}
        sheetName={sheetName}
        onApplyCsv={(newCsv, newUrl, newSheetName) => {
          applyAndPersistSpreadsheet(newCsv, newUrl, newSheetName);
          const reParsed = parseAndAnalyzeSpreadsheet(newCsv);
          setSyncNotice(
            `Spreadsheet berhasil diupdate (${reParsed.items.length} item — Sheet ${
              newSheetName || DEFAULT_SHEET_NAME
            })`
          );
          setTimeout(() => setSyncNotice(null), 4000);
        }}
        onResetDefault={() => {
          applyAndPersistSpreadsheet(INITIAL_SPREADSHEET_CSV, '', DEFAULT_SHEET_NAME);
          setSyncNotice('Dikembalikan ke Base Data Sheet rekap Daily (137 item)');
          setTimeout(() => setSyncNotice(null), 4000);
        }}
      />
    </div>
  );
}
