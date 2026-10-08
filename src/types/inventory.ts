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

// Master Data Histori Mutasi Barang (Format Horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar, Data Vertikal)
export interface SystemMutationRecord {
  id: string;
  date: string; // Kolom 1: Tanggal (e.g., "02 Okt 2026")
  dayNumber: number; // 1..31
  transactionNo: string; // Kolom 2: Nomor (e.g., "DO.2026.10.00142" / "RI.2026.10.00088")
  description: string; // Kolom 3: Deksripsi (e.g., "Pengiriman Cabang / Penerimaan Supplier")
  qtyIn: number; // Kolom 4: Masuk
  qtyOut: number; // Kolom 5: Keluar
  itemName: string; // Nama item terkait (terdeteksi dari deskripsi/grup atau item terpilih)
  transactionType: string; // Jenis transaksi yang teridentifikasi dari Nomor & Deksripsi
  balanceAfter: number | null;
  uom: string;
  warehouse: string;
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

export interface CriteriaBreakdownDetail {
  criteriaType: 'FISIK_KURANG' | 'FISIK_LEBIH' | 'SESUAI';
  criteriaTitle: string;
  discrepancyQty: number;
  breakdownCalculations: string[];
  possibleSources: string[];
}

// Hasil Banding & Analisa Berdasarkan Search Item (Acuan SO Sebelumnya, 2 Kriteria Besar: Fisik Kurang & Fisik Lebih, Deepsearch, Rekomendasi Arahan)
export interface VarianceDateMutationComparison {
  day: number;
  dateLabel: string;
  prevDayLabel?: string | null;
  prevSO?: number | null;
  prevAccurate?: number | null;
  inToday: number;
  outToday: number;
  expectedSOFromPrev: number | null; // Hasil SO Seharusnya berdasarkan SO Sebelumnya + In - Out
  deviationFromExpected: number | null; // SO Aktual - SO Seharusnya
  soFisik: number | null;
  stokAccurate: number | null;
  qtySelisih: number;
  varianceDirection: 'FISIK_KURANG' | 'FISIK_LEBIH' | 'SO_BELUM_INPUT' | 'SISTEM_MINUS' | 'SEIMBANG';
  majorCriteria: 'FISIK_KURANG' | 'FISIK_LEBIH' | 'SESUAI';
  varianceTypeLabel: string; // Tipe Selisih
  dailyAccuracyPercent: number;
  isLowestAccuracyDay: boolean;
  deltaSO: number | null;
  deltaAccurate: number | null;
  previousSOReferenceSummary: string; // Acuan Hitungan SO Sebelumnya (Tanpa teks SO tgl 1 - Data Out tgl 2 = SO tgl 2)
  criteriaBreakdown: CriteriaBreakdownDetail; // Breakdown spesifik Kriteria Fisik Kurang / Fisik Lebih + Kemungkinan Sumber Selisih
  fisikKurangBreakdown: CriteriaBreakdownDetail | null;
  fisikLebihBreakdown: CriteriaBreakdownDetail | null;
  dateAndQtyMatchSummary: string; // Kecocokan Tanggal & Total Qty IN - OUT
  extendedLogicFindings: string[]; // Fisik keluar tanpa Accurate, Accurate keluar fisik tidak, Geser beberapa hari
  deepSearchFindings: string[]; // Hasil Deepsearch lintas tanggal, mutasi, pola selisih & geser hari
  directiveRecommendations: string[]; // Rekomendasi yang bersifat arahan (langkah instruktif)
  matchedSystemMutations: SystemMutationRecord[];
  matchedStockCardEntries: StockCardEntry[];
  stockCardBalance: number | null;
  gapSOvsStockCard: number | null;
  gapAccuratevsStockCard: number | null;
  mutationComparisonResult: string; // Hasil Banding dengan Data Mutasi & Kartu Stok
  potentialDiscrepancyFinding: string; // Potensi Selisih
  checkRecommendation: string; // Ringkasan Rekomendasi Arahan
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}
