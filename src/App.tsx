import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileSpreadsheet,
  Pause,
  Play,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { INITIAL_SPREADSHEET_CSV } from './data/rawSpreadsheetCsv';
import {
  computePeriodDashboardAnalysis,
  INITIAL_SAMPLE_STOCK_CARDS,
  INITIAL_SYSTEM_MUTATION_MASTER,
  parseAndAnalyzeSpreadsheet,
} from './utils/analyzer';
import { PeriodAverageAccuracyHero } from './components/PeriodAverageAccuracyHero';
import { Top10ErrorSection } from './components/Top10ErrorSection';
import { TransactionBreakdownPanel } from './components/TransactionBreakdownPanel';
import { SpreadsheetMatrixTable } from './components/SpreadsheetMatrixTable';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { SystemMutationMasterModal } from './components/SystemMutationMasterModal';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from './types/inventory';

type MainMenuOption = 'dashboard_report' | 'analisa';

export default function App() {
  // 2 Opsi Menu Utama: 'dashboard_report' | 'analisa'
  const [activeMenu, setActiveMenu] = useState<MainMenuOption>('dashboard_report');

  const [csvData, setCsvData] = useState<string>(INITIAL_SPREADSHEET_CSV);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(7);

  // Top 10 tetap aktifkan mode Hide (Default: false / hanya muncul jika diklik)
  const [isTop10OpenDashboard, setIsTop10OpenDashboard] = useState<boolean>(false);
  const [isTop10OpenAnalisa, setIsTop10OpenAnalisa] = useState<boolean>(false);
  const [showMatrixInDashboard, setShowMatrixInDashboard] = useState<boolean>(false);

  // Rekap Mutasi Sistem & Kartu Stock dikosongkan ulang secara default (Hanya terisi jika ada Upload)
  const [systemMutations, setSystemMutations] = useState<SystemMutationRecord[]>(
    INITIAL_SYSTEM_MUTATION_MASTER
  );
  const [isMutationModalOpen, setIsMutationModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Data Kartu Stock Opsional (Kosong secara default kecuali diupload)
  const [stockCards, setStockCards] = useState<AnalyzedStockCard[]>(
    INITIAL_SAMPLE_STOCK_CARDS
  );

  // Real-time 30s Auto-Update state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(30);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [syncCycleCount, setSyncCycleCount] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Parse base spreadsheet
  const parsed = useMemo(() => parseAndAnalyzeSpreadsheet(csvData), [csvData]);

  // Compute period analysis dynamically for [startDay .. endDay] with Baseline 100%
  const periodData = useMemo(
    () => computePeriodDashboardAnalysis(parsed, startDay, endDay),
    [parsed, startDay, endDay]
  );

  // Hanya tampilkan analisa untuk item yang di-search (Default: '' / null sampai user melakukan search atau klik item)
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const selectedPeriodItem: PeriodItemAnalysis | null = useMemo(() => {
    if (!selectedItemId) return null;
    return periodData.periodItems.find((p) => p.item.id === selectedItemId) || null;
  }, [periodData.periodItems, selectedItemId]);

  const availableItemNames = useMemo(
    () => periodData.periodItems.map((p) => p.item.name),
    [periodData.periodItems]
  );

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (sheetUrl) {
        const res = await fetch(sheetUrl, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 20) {
            setCsvData(text);
          }
        }
      }
      setLastUpdated(new Date());
      setSyncCycleCount((c) => c + 1);
      setCountdown(30);
    } catch {
      setLastUpdated(new Date());
      setCountdown(30);
    } finally {
      setTimeout(() => setIsRefreshing(false), 180);
    }
  }, [sheetUrl]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, triggerRefresh]);

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
    replaceAll: boolean
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

  const handleClearAllUploads = () => {
    setSystemMutations([]);
    setStockCards([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: Ringkas Menjadi 2 Opsi Menu Besar (1. Dashboard Report | 2. Analisa) */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-slate-100">
            Bangor Inventory
          </span>
        </div>

        {/* Zone 2: 2 OPSI BESAR MENU UTAMA (Dashboard Report & Analisa) */}
        <nav
          aria-label="Menu Utama"
          className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl"
        >
          <button
            type="button"
            onClick={() => setActiveMenu('dashboard_report')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeMenu === 'dashboard_report'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
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
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            <span>Analisa</span>
          </button>
        </nav>

        {/* Zone 3: Real-time 30s Auto-Update & Upload Mutasi */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled((v) => !v)}
            title={autoRefreshEnabled ? 'Jeda Auto-Update 30s' : 'Aktifkan Auto-Update 30s'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              autoRefreshEnabled
                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {autoRefreshEnabled ? (
              <Pause className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-mono tabular-nums">
              {autoRefreshEnabled ? `${String(countdown).padStart(2, '0')}s` : 'Paused'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsMutationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Mutasi</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Compact Status & Period Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-400 font-semibold">Baseline: 100%</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Auto-Update: {lastUpdated.toLocaleTimeString('id-ID')} (#{syncCycleCount})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Rekap Mutasi: {systemMutations.length} Baris · Kartu Stock: {stockCards.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`}
              />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Data SO</span>
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* OPSI MENU 1: DASHBOARD REPORT (Hasil Analisa, Persentase & Top 10)     */}
        {/* ===================================================================== */}
        {activeMenu === 'dashboard_report' && (
          <div className="space-y-6">
            {/* 1. Persentase Akurasi & Hasil Analisa Rata-Rata */}
            <PeriodAverageAccuracyHero
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
              periodItems={periodData.periodItems}
              onSelectItemAnalysis={handleSelectItemAndOpenAnalisa}
            />

            {/* 2. Top 10 (Mode Hide Aktif - Hanya Muncul Jika Diklik) */}
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

            {/* 3. Opsi Buka Tabel Rekap SO & Akurasi Bawah */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-slate-800 bg-slate-900/60 rounded-xl px-5 py-3.5">
                <span className="text-xs font-semibold text-slate-300">
                  Tabel Rekap Spreadsheet SO vs Accurate (1–7 Oktober)
                </span>
                <button
                  type="button"
                  onClick={() => setShowMatrixInDashboard((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
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
        {/* OPSI MENU 2: ANALISA                                                  */}
        {/* Berisi:                                                               */}
        {/* - Top 10 (Tetap Aktifkan Mode Hide)                                   */}
        {/* - Opsi Pilihan Tanggal & Nama Item                                    */}
        {/* - Kolom Upload Mutasi (Tanggal | Nomor | Deksripsi | Masuk | Keluar)  */}
        {/* - Kolom Upload Kartu Stock Opsional                                   */}
        {/* - Kolom Hasil Analisa (Hanya untuk Item yang di-Search)               */}
        {/* ===================================================================== */}
        {activeMenu === 'analisa' && (
          <div className="space-y-6">
            {/* 1. Top 10 (Tetap aktifkan mode Hide - Hanya muncul jika diklik) */}
            <Top10ErrorSection
              periodItems={periodData.periodItems}
              startDay={periodData.startDay}
              endDay={periodData.endDay}
              selectedItemId={selectedPeriodItem?.item.id || ''}
              onSelectItemAnalysis={(p) => {
                setSelectedItemId(p.item.id);
                const el = document.getElementById('item-historical-analysis');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              systemMutations={systemMutations}
              stockCards={stockCards}
              isOpen={isTop10OpenAnalisa}
              onToggleOpen={() => setIsTop10OpenAnalisa((prev) => !prev)}
            />

            {/* 2. Pilihan Tanggal & Nama Item + Kolom Upload Mutasi + Kolom Upload Kartu Stock + Hasil Analisa Hanya Item Search */}
            <TransactionBreakdownPanel
              selectedAnalysis={selectedPeriodItem}
              allPeriodItems={periodData.periodItems.filter(
                (p) => p.periodSelisih > 0 || p.periodSO > 0
              )}
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
              onClearAllUploads={handleClearAllUploads}
              onOpenMutationUploadModal={() => setIsMutationModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-[1440px] w-full mx-auto">
        <span>Bangor Inventory · Baseline Akurasi 100%</span>
        <span>Auto-Update 30s · Periode: {startDay}–{endDay} Okt</span>
      </footer>

      {/* Modal 1: Upload Master Mutasi Barang (5 Kolom Horizontal) */}
      <SystemMutationMasterModal
        isOpen={isMutationModalOpen}
        onClose={() => setIsMutationModalOpen(false)}
        records={systemMutations}
        onUpdateRecords={handleUpdateMutationMaster}
        defaultTargetItem={selectedPeriodItem?.item.name || 'Semua Item'}
        defaultDay={selectedPeriodItem?.lowestAccuracyDayRecord?.day || 5}
        availableItemNames={availableItemNames}
      />

      {/* Modal 2: Data SO */}
      <SpreadsheetSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        currentCsv={csvData}
        sheetUrl={sheetUrl}
        onApplyCsv={(newCsv, newUrl) => {
          setCsvData(newCsv);
          setSheetUrl(newUrl);
          setLastUpdated(new Date());
          setSyncCycleCount((c) => c + 1);
          setCountdown(30);
        }}
        onResetDefault={() => {
          setCsvData(INITIAL_SPREADSHEET_CSV);
          setSheetUrl('');
          setLastUpdated(new Date());
          setCountdown(30);
        }}
      />
    </div>
  );
}
