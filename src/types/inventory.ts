export interface DailyRecord {
  day: number; // 1 to 31
  dateLabel: string; // e.g., "1 Okt"
  so: number | null;
  accurate: number | null;
  selisih: number;
  dailyAccuracyPercent: number | null; // 0% to 100% (Baseline 100%), null if no activity/holiday
  gapFromBaseline100: number | null; // e.g., -43.70%
  isSpike: boolean;
  isLowestAccuracyDay?: boolean;
  spikeReason?: string;
  deltaFromPrevSelisih: number;
  deltaSO: number | null;
  deltaAccurate: number | null;
  inferredTransactionType:
    | 'NORMAL_CONSUMPTION'
    | 'RESTOCK_INBOUND'
    | 'UNPOSTED_DELIVERY_OR_USAGE'
    | 'UNINPUTTED_SO_CUTOFF'
    | 'NEGATIVE_SYSTEM_STOCK'
    | 'UOM_CONVERSION_GAP'
    | 'HOLIDAY_NO_SO'
    | 'ZERO_VARIANCE';
  transactionNote: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  uom: string;
  category:
    | 'Patty & Beef'
    | 'Poultry & Seafood'
    | 'Cheese & Dairy'
    | 'Kentang & Side'
    | 'Sauce & Condiments'
    | 'Bun & Bakery'
    | 'Packaging & Box'
    | 'Seragam & Merch'
    | 'Operasional & Promo';
  daily: DailyRecord[];
  totalSelisih: number;
  totalSO: number;
  totalAccurate: number;
  sheetRightmostErrorCol: string;
  sheetAccuracyPercent: number | null;
  errorRatePercent: number;
  baselineAccuracyPercent: number; // 100% - errorRatePercent (clamped 0..100)
  maxDailySpike: number;
  maxSpikeDay: number | null;
  spikeCount: number;
  rootCauseCategory: string;
  rootCauseSummary: string;
  recommendedAction: string;
  hasNegativeAccurate: boolean;
  hasUninputtedDay7SO: boolean;
  hasZeroSOButActiveAccurate: boolean;
}

// Computed item metrics for the user's selected Date Range [startDay..endDay]
export interface PeriodItemAnalysis {
  item: InventoryItem;
  periodDaily: DailyRecord[];
  periodSO: number;
  periodAccurate: number;
  periodSelisih: number;
  periodErrorRatePercent: number;
  periodAccuracyPercent: number; // Baseline 100% -> 100 - errorRate
  gapFromBaseline100: number; // periodAccuracyPercent - 100 (negative means below 100% baseline)
  lowestAccuracyDayRecord: DailyRecord | null;
  highestSelisihDayRecord: DailyRecord | null;
  activeDaysCount: number;
}

export interface DailyAccuracySummary {
  day: number;
  dateLabel: string;
  stockFisik: number;
  error: number;
  wapeStr: string;
  wapeNum: number | null;
  stockAccuracyStr: string;
  stockAccuracyNum: number | null;
  gapFromBaseline100: number | null;
  isDrasticDrop: boolean;
}

export interface ParsedSpreadsheetData {
  monthLabel: string;
  items: InventoryItem[];
  activeDays: number[];
  dailySummaries: DailyAccuracySummary[];
  rawAccurateDay5Total: number;
  overallStockFisik: number;
  overallError: number;
  overallWape: number;
  overallAccuracy: number;
  totalDrasticSpikes: number;
}

// Master Data Histori Mutasi By Sistem (Uploaded via Excel/CSV or Paste)
export interface SystemMutationRecord {
  id: string;
  date: string; // e.g., "02 Okt 2026"
  dayNumber: number; // 1..31
  itemName: string;
  transactionNo: string;
  transactionType: string; // e.g., "Delivery Order (DO)", "Receive Item (RI)", "Job Costing / Finishing", "Inventory Adjustment"
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number | null;
  uom: string;
  warehouse: string;
  description: string;
}

// Data Hasil Ekstraksi & Analisa Foto Kartu Stok Fisik (Opsional)
export interface StockCardEntry {
  id: string;
  date: string; // e.g., "03 Okt 2026"
  dayNumber: number; // 1..31
  docNo: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  notes: string;
}

export interface AnalyzedStockCard {
  id: string;
  itemName: string;
  uom: string;
  uploadedAt: string;
  imagePreviewUrl?: string;
  summaryAnalysis: string;
  anomaliesFound: string[];
  entries: StockCardEntry[];
}

// Hasil Banding & History Mutasi pada Tanggal Selisih + Rekomendasi Pengecekan
export interface VarianceDateMutationComparison {
  day: number;
  dateLabel: string;
  soFisik: number | null;
  stokAccurate: number | null;
  qtySelisih: number;
  dailyAccuracyPercent: number;
  isLowestAccuracyDay: boolean;
  deltaSO: number | null;
  deltaAccurate: number | null;
  matchedSystemMutations: SystemMutationRecord[];
  matchedStockCardEntries: StockCardEntry[];
  stockCardBalance: number | null;
  gapSOvsStockCard: number | null;
  gapAccuratevsStockCard: number | null;
  mutationComparisonResult: string; // Hasil Analisa Banding History Mutasi pada tanggal selisih
  checkRecommendation: string; // Rekomendasi Pengecekan spesifik pada tanggal selisih
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

