import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  INITIAL_SYSTEM_MUTATION_MASTER,
  parseAndAnalyzeSpreadsheet,
} from './utils/analyzer';
import { PeriodAverageAccuracyHero } from './components/PeriodAverageAccuracyHero';
import { Top10ErrorSection } from './components/Top10ErrorSection';
import { TransactionBreakdownPanel } from './components/TransactionBreakdownPanel';
import { SpreadsheetMatrixTable } from './components/SpreadsheetMatrixTable';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { SystemMutationMasterModal } from './components/SystemMutationMasterModal';
import { PeriodItemAnalysis, SystemMutationRecord } from './types/inventory';

export default function App() {
  const [csvData, setCsvData] = useState<string>(INITIAL_SPREADSHEET_CSV);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(7);

  // Master Data Histori Mutasi By Sistem state
  const [systemMutations, setSystemMutations] = useState<SystemMutationRecord[]>(
    INITIAL_SYSTEM_MUTATION_MASTER
  );
  const [isMutationModalOpen, setIsMutationModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        {/* Zone 1: Brand Wordmark */}
        <a href="#top-rata-rata" className="text-lg font-bold tracking-tight text-slate-100">
          Bangor Inventory Audit
        </a>

        {/* Zone 2: 4 Clean Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#top-rata-rata"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Rata-Rata Akurasi
          </a>
          <a
            href="#top10-lowest-accuracy"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Top 10 Akurasi Terendah
          </a>
          <a
            href="#item-historical-analysis"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Analisa Tiap Item
          </a>
          <a
            href="#master-mutation-banner"
            className="hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            Master Mutasi Sistem
          </a>
        </nav>

        {/* Zone 3: 2 Primary Actions (30s Auto-Update + Upload Histori Mutasi Sistem) */}
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
            <span>Upload Histori Mutasi Sistem</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="top-rata-rata"
        className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-7"
      >
        {/* Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-400 font-semibold">Baseline Akurasi: 100,00%</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Update Real-Time: {lastUpdated.toLocaleTimeString('id-ID')} (Siklus #{syncCycleCount})
            </span>
            <span aria-hidden="true">·</span>
            <span>Master Mutasi Sistem: {systemMutations.length} Transaksi Aktif</span>
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
              <span>Refresh 30s</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Sumber Spreadsheet SO</span>
            </button>
          </div>
        </div>

        {/* 1. Total Rata-Rata Akurasi Selama Periode Tanggal yang Dapat Dipilih + Opsi Analisa Bubble Menu */}
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

        {/* 2. Top 10 Item dengan Akurasi Terendah sesuai Tanggal yang Dipilih + Opsi Analisa Tiap Item */}
        <Top10ErrorSection
          periodItems={periodData.periodItems}
          startDay={periodData.startDay}
          endDay={periodData.endDay}
          selectedItemId={selectedPeriodItem.item.id}
          onSelectItemAnalysis={handleSelectItemAnalysis}
          systemMutations={systemMutations}
        />

        {/* 3. Analisa Berisi Breakdown Historical Stock Akurasi, Qty Selisih, Highlight Tanggal Akurasi Terendah */}
        <TransactionBreakdownPanel
          selectedAnalysis={selectedPeriodItem}
          allPeriodItems={periodData.periodItems.filter(
            (p) => p.periodSelisih > 0 || p.periodSO > 0
          )}
          startDay={periodData.startDay}
          endDay={periodData.endDay}
          onSelectItemAnalysis={(p) => setSelectedItemId(p.item.id)}
          systemMutations={systemMutations}
          onOpenMutationUploadModal={() => setIsMutationModalOpen(true)}
        />

        {/* 4. Master Data Upload Histori Mutasi By Sistem Banner */}
        <section
          id="master-mutation-banner"
          className="border border-sky-500/40 bg-slate-900/80 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Database className="w-4 h-4" />
              <span>Master Data Upload — Histori Mutasi By Sistem</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Integrasi File Histori Mutasi Sistem ({systemMutations.length} Baris Master Aktif)
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Unggah file Excel (<code>.xlsx</code>, <code>.xls</code>) atau CSV dari sistem Accurate/ERP Anda kapan saja. Ketika format file Anda dikirimkan nanti, skema ini langsung menjadikannya sebagai <strong>Master Data Utama</strong> yang terhubung otomatis ke analisa tiap item di atas.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsMutationModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition-colors whitespace-nowrap shadow-lg"
            >
              <Upload className="w-4 h-4" />
              <span>Upload / Kelola Master Histori Mutasi</span>
            </button>
          </div>
        </section>

        {/* 5. Matriks Spreadsheet Lengkap & Highlight Poin Accuracy Stock di Bagian Bawah */}
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
        <span>Bangor Inventory Stock Accuracy Dashboard · Baseline Akurasi 100,00%</span>
        <span>Auto-Update Real-Time 30 Detik · Periode Aktif: {startDay}–{endDay} Oktober</span>
      </footer>

      {/* Modal 1: Upload Histori Mutasi By Sistem (Master Data) */}
      <SystemMutationMasterModal
        isOpen={isMutationModalOpen}
        onClose={() => setIsMutationModalOpen(false)}
        records={systemMutations}
        onUpdateRecords={handleUpdateMutationMaster}
      />

      {/* Modal 2: Sumber Spreadsheet SO vs Accurate */}
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
