import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Database,
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
import { StockCardPhotoAnalyzer } from './components/StockCardPhotoAnalyzer';
import { SpreadsheetMatrixTable } from './components/SpreadsheetMatrixTable';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { SystemMutationMasterModal } from './components/SystemMutationMasterModal';
import {
  AnalyzedStockCard,
  PeriodItemAnalysis,
  SystemMutationRecord,
} from './types/inventory';

export default function App() {
  const [csvData, setCsvData] = useState<string>(INITIAL_SPREADSHEET_CSV);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(7);

  // Top 10 is hidden by default ("Opsi Hide - Hanya Muncul Jika di klik")
  const [isTop10Open, setIsTop10Open] = useState<boolean>(false);

  // Master Data Histori Mutasi By Sistem state
  const [systemMutations, setSystemMutations] = useState<SystemMutationRecord[]>(
    INITIAL_SYSTEM_MUTATION_MASTER
  );
  const [isMutationModalOpen, setIsMutationModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Optional Uploaded / Analyzed Foto Kartu Stok state
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

  // Selected item for detailed historical breakdown
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const selectedPeriodItem: PeriodItemAnalysis = useMemo(() => {
    if (selectedItemId) {
      const found = periodData.periodItems.find((p) => p.item.id === selectedItemId);
      if (found) return found;
    }
    return (
      periodData.periodItems.find((p) => p.item.name === 'Dus Besar') ||
      periodData.periodItems.find((p) => p.item.name === 'Beef Patty Small') ||
      periodData.periodItems[0]
    );
  }, [periodData.periodItems, selectedItemId]);

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

  const handleSelectItemAnalysis = (p: PeriodItemAnalysis) => {
    setSelectedItemId(p.item.id);
    const el = document.getElementById('item-historical-analysis');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleUpdateMutationMaster = (
    newRecords: SystemMutationRecord[],
    replaceAll: boolean
  ) => {
    setSystemMutations((prev) => (replaceAll ? newRecords : [...newRecords, ...prev]));
  };

  const handleSaveStockCard = (card: AnalyzedStockCard) => {
    setStockCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.map((c) => (c.id === card.id ? card : c));
      }
      return [card, ...prev];
    });
  };

  const handleDeleteStockCard = (id: string) => {
    setStockCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleJumpToStockCard = () => {
    const el = document.getElementById('stock-card-photo-menu');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones with Simplified Menu Titles */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        {/* Zone 1: Brand Wordmark */}
        <a href="#top-rata-rata" className="text-lg font-bold tracking-tight text-slate-100">
          Bangor Inventory
        </a>

        {/* Zone 2: Simplified Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#top-rata-rata"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Akurasi
          </a>
          <a
            href="#top10-lowest-accuracy"
            onClick={() => setIsTop10Open(true)}
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Top 10
          </a>
          <a
            href="#item-historical-analysis"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Analisa Item
          </a>
          <a
            href="#stock-card-photo-menu"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Kartu Stok
          </a>
          <a
            href="#spreadsheet-matrix"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Tabel SO
          </a>
        </nav>

        {/* Zone 3: 2 Primary Actions */}
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
            <span>Mutasi Sistem</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="top-rata-rata"
        className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6"
      >
        {/* Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-400 font-semibold">Baseline: 100%</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Update: {lastUpdated.toLocaleTimeString('id-ID')} (#{syncCycleCount})
            </span>
            <span aria-hidden="true">·</span>
            <span>Mutasi Sistem: {systemMutations.length} Baris</span>
            <span aria-hidden="true">·</span>
            <span>Kartu Stok: {stockCards.length} Item</span>
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
              onClick={handleJumpToStockCard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Foto Kartu Stok</span>
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

        {/* 1. Rata-Rata Akurasi + Bubble Menu Analisa */}
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
          onSelectItemAnalysis={handleSelectItemAnalysis}
        />

        {/* 2. Top 10 Akurasi Terendah (Default Hidden / Opsi Hide - Hanya Muncul Jika Di-klik) */}
        <Top10ErrorSection
          periodItems={periodData.periodItems}
          startDay={periodData.startDay}
          endDay={periodData.endDay}
          selectedItemId={selectedPeriodItem.item.id}
          onSelectItemAnalysis={handleSelectItemAnalysis}
          systemMutations={systemMutations}
          stockCards={stockCards}
          isOpen={isTop10Open}
          onToggleOpen={() => setIsTop10Open((prev) => !prev)}
        />

        {/* 3. Analisa Item (Hasil Banding Mutasi pada Tanggal Selisih + Rekomendasi Pengecekan) */}
        <TransactionBreakdownPanel
          selectedAnalysis={selectedPeriodItem}
          allPeriodItems={periodData.periodItems.filter(
            (p) => p.periodSelisih > 0 || p.periodSO > 0
          )}
          startDay={periodData.startDay}
          endDay={periodData.endDay}
          onSelectItemAnalysis={(p) => setSelectedItemId(p.item.id)}
          systemMutations={systemMutations}
          stockCards={stockCards}
          onOpenMutationUploadModal={() => setIsMutationModalOpen(true)}
          onJumpToStockCard={handleJumpToStockCard}
        />

        {/* 4. Menu Opsional Upload Foto Kartu Stok & Banding Historical Tracking */}
        <StockCardPhotoAnalyzer
          stockCards={stockCards}
          onSaveStockCard={handleSaveStockCard}
          onDeleteStockCard={handleDeleteStockCard}
          periodItems={periodData.periodItems}
          selectedItem={selectedPeriodItem}
          onSelectItemAnalysis={(p) => setSelectedItemId(p.item.id)}
          systemMutations={systemMutations}
        />

        {/* 5. Master Mutasi Sistem Banner */}
        <section
          id="master-mutation-banner"
          className="border border-sky-500/40 bg-slate-900/80 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Database className="w-4 h-4" />
              <span>Master Data Mutasi Sistem</span>
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Upload Mutasi Sistem ({systemMutations.length} Transaksi Aktif)
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl">
              Unggah file Excel/CSV mutasi sistem Accurate untuk dijadikan Master Data pembanding otomatis pada setiap tanggal selisih.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsMutationModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap self-start lg:self-center"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Mutasi Sistem</span>
          </button>
        </section>

        {/* 6. Tabel SO & Akurasi */}
        <SpreadsheetMatrixTable
          items={parsed.items}
          dailySummaries={parsed.dailySummaries}
          selectedItemId={selectedPeriodItem.item.id}
          onSelectItem={(item) => {
            const found = periodData.periodItems.find((p) => p.item.id === item.id);
            if (found) handleSelectItemAnalysis(found);
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-[1440px] w-full mx-auto">
        <span>Bangor Inventory · Baseline Akurasi 100%</span>
        <span>Auto-Update 30s · Periode: {startDay}–{endDay} Okt</span>
      </footer>

      {/* Modal 1: Upload Mutasi Sistem */}
      <SystemMutationMasterModal
        isOpen={isMutationModalOpen}
        onClose={() => setIsMutationModalOpen(false)}
        records={systemMutations}
        onUpdateRecords={handleUpdateMutationMaster}
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
