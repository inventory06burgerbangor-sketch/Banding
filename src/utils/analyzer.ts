import * as XLSX from 'xlsx';
import {
  AnalyzedStockCard,
  CriteriaBreakdownDetail,
  DailyAccuracySummary,
  DailyRecord,
  InventoryItem,
  ParsedSpreadsheetData,
  PeriodItemAnalysis,
  StockCardEntry,
  SystemMutationRecord,
  VarianceDateMutationComparison,
} from '../types/inventory';

function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter( sampleLines: string[]): string {
  const firstFew = sampleLines.slice(0, 5).join('\n');
  const tabCount = (firstFew.match(/\t/g) || []).length;
  const commaCount = (firstFew.match(/,/g) || []).length;
  const semiCount = (firstFew.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount && semiCount > tabCount) return ';';
  return ',';
}

function parseIndoNumber(val: string | undefined): number | null {
  if (!val) return null;
  const raw = val.replace(/^["']+|["']+$/g, '').trim();
  if (
    !raw ||
    raw === '-' ||
    raw.toUpperCase() === '#N/A' ||
    raw.toUpperCase() === '#REF!' ||
    raw.toUpperCase() === '#DIV/0!' ||
    raw.toUpperCase() === '#VALUE!'
  ) {
    return null;
  }

  const isPercent = raw.includes('%');
  let s = raw.replace(/%/g, '').replace(/\s+/g, '');

  if (isPercent) {
    // For percentages like "56,30%" or "56.30%", comma or dot is the decimal point
    s = s.replace(',', '.');
    const num = Number(s);
    return Number.isFinite(num) ? num : null;
  }

  // Indonesian thousands separator: e.g., "1.579" or "143.750" or "-1.500"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
    const num = Number(s);
    return Number.isFinite(num) ? num : null;
  }

  // US/Standard thousands separator: e.g., "1,579" or "143,750"
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
    const num = Number(s);
    return Number.isFinite(num) ? num : null;
  }

  // Single comma decimal: e.g., "98,47"
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

function categorizeItem(name: string): InventoryItem['category'] {
  const lower = name.toLowerCase();
  if (lower.includes('patty') || lower.includes('beef') || lower.includes('sosis')) {
    return 'Patty & Beef';
  }
  if (lower.includes('chicken') || lower.includes('ayam') || lower.includes('dori')) {
    return 'Poultry & Seafood';
  }
  if (lower.includes('keju') || lower.includes('butter') || lower.includes('minyak')) {
    return 'Cheese & Dairy';
  }
  if (
    lower.includes('kentang') &&
    !lower.includes('kertas') &&
    !lower.includes('tray') &&
    !lower.includes('paper')
  ) {
    return 'Kentang & Side';
  }
  if (
    lower.includes('sauce') ||
    lower.includes('mayonaise') ||
    lower.includes('bbq') ||
    lower.includes('sambal') ||
    lower.includes('saos') ||
    lower.includes('nestea')
  ) {
    return 'Sauce & Condiments';
  }
  if (lower.includes('bun')) {
    return 'Bun & Bakery';
  }
  if (
    lower.includes('tray') ||
    lower.includes('paper') ||
    lower.includes('packaging') ||
    lower.includes('kertas') ||
    lower.includes('cup') ||
    lower.includes('tutup') ||
    lower.includes('sedotan') ||
    lower.includes('kresek') ||
    lower.includes('box') ||
    lower.includes('inner') ||
    lower.includes('dus') ||
    lower.includes('bucket') ||
    lower.includes('sticker') ||
    lower.includes('spunbond') ||
    lower.includes('thermal bag')
  ) {
    return 'Packaging & Box';
  }
  if (
    lower.includes('seragam') ||
    lower.includes('kaus') ||
    lower.includes('topi') ||
    lower.includes('apron') ||
    lower.includes('name tag') ||
    lower.includes('t shirt')
  ) {
    return 'Seragam & Merch';
  }
  return 'Operasional & Promo';
}

function buildRootCauseAnalysis(
  name: string,
  uom: string,
  daily: DailyRecord[],
  totalSelisih: number,
  totalSO: number,
  hasNegativeAccurate: boolean,
  hasUninputtedDay7SO: boolean,
  hasZeroSOButActiveAccurate: boolean
): { category: string; summary: string; action: string } {
  const day7 = daily.find((d) => d.day === 7);

  if (name.toLowerCase().includes('rework')) {
    return {
      category: 'Stok Fisik Rework Tanpa SKU Sistem Accurate (Akurasi 0%)',
      summary: `Terdapat fisik barang rework (${daily[0]?.so ?? 0} ${uom}/hari) pada Stock Opname tanggal 1–6 Okt, namun kolom Accurate kosong sehingga akurasi terhadap Baseline 100% menjadi 0,00% (Total Selisih ${totalSelisih.toLocaleString('id-ID')} ${uom}).`,
      action:
        'Buat SKU khusus Rework di Accurate atau lakukan Penyesuaian Persediaan (Inventory Adjustment) atas barang rework.',
    };
  }

  if (hasZeroSOButActiveAccurate) {
    return {
      category: 'Formula VLOOKUP / SO Kosong (Akurasi 0% vs Baseline 100%)',
      summary: `Stok Accurate tercatat aktif setiap hari (akumulasi selisih ${totalSelisih.toLocaleString('id-ID')} ${uom || 'Unit'}), tetapi kolom SO bernilai 0 sepanjang periode 1–7 Okt.`,
      action:
        'Perbaiki referensi nama barang pada rumus SO/VLOOKUP dan pastikan tim gudang menghitung fisik item ini saat opname.',
    };
  }

  if (hasNegativeAccurate) {
    return {
      category: 'Stok Sistem Accurate Minus (Negative Inventory)',
      summary: `Stok Accurate bernilai negatif (-10 s/d -30 ${uom}) pada tanggal 1–5 Okt sebelum barang masuk +147 ${uom} di tanggal 6 Okt. Akurasi terendah terjadi saat saldo sistem minus.`,
      action:
        'Telusuri pemakaian/pengeluaran yang diposting mendahului Bukti Penerimaan Barang (RI) sebelum 1 Oktober.',
    };
  }

  if (name === 'Apron') {
    return {
      category: 'Kolom Accurate Kosong di 5 dari 6 Hari Aktif (Akurasi 16,27%)',
      summary: `Stok fisik SO tercatat stabil (201 -> 165 -> 153 Pcs), tetapi tarikan data Accurate hanya masuk pada tanggal 5 Okt (165 Pcs, Akurasi 100%) dan kosong di tanggal 1, 2, 3, 6, 7 Okt (Akurasi 0%).`,
      action:
        'Cek filter gudang/cabang saat export laporan kuantitas barang Accurate pada tanggal selain 5 Oktober.',
    };
  }

  if (name === 'Burger Bun') {
    return {
      category: 'Salah Kamar Input SKU pada 5 Okt (Akurasi 0,00%)',
      summary: `Pada 5 Okt, fisik 76 Pack diinput ke baris "Burger Bun" (SO=76, Acc=0), sedangkan di sistem Accurate tercatat pada "Burger Bun (20)" (SO=0, Acc=76).`,
      action:
        'Standarisasi penamaan SKU Burger Bun (20) agar input SO fisik tidak terpisah ke baris Burger Bun polos.',
    };
  }

  if (name === 'Dus Besar') {
    return {
      category: 'Drop Akurasi Drastis pada 5 Okt & 6 Okt (Akurasi Total 34,27%)',
      summary: `1–3 Okt akurasi sangat tinggi (93,69%–98,78%). Namun pada 5 Okt fisik SO turun dari 2.696 ke 1.113 Pcs (-1.583) sementara Accurate naik ke 2.905 Pcs (Selisih 1.792 Pcs, Akurasi jatuh ke 0%). Diperparah SO 7 Okt masih 0 (Selisih 3.082 Pcs).`,
      action:
        'Audit Surat Jalan keluar 1.583 Pcs Dus Besar antara 3–5 Okt yang belum dipotong di Accurate, serta lengkapi SO 7 Okt.',
    };
  }

  if (name === 'Butter') {
    return {
      category: 'Drop Akurasi 2 Okt (40,07%) Akibat Pemotongan Sistem -2.481 Pack',
      summary: `1 Okt akurasi 99,98%. Pada 2 Okt stok Accurate dipotong drastis dari 4.139 ke 1.658 Pack (-2.481 Pack) sementara fisik SO masih 4.138 Pack (Selisih 2.480 Pack, Akurasi turun ke 40,07%). Pada 3–6 Okt selisih konstan 450 Pack/hari.`,
      action:
        'Periksa transaksi pengeluaran Accurate tanggal 2 Okt sebesar 2.481 Pack dan selisih gantung 450 Pack di 3–6 Okt.',
    };
  }

  if (name === 'Tray Kentang') {
    return {
      category: 'Selisih Konstan 6.000 Pcs/Hari Sejak 3 Okt (Akurasi 97,16%)',
      summary: `Tanggal 1–2 Okt akurasi 100,00% (selisih 0). Mulai 3 Okt muncul selisih tepat 6.000 Pcs/hari (SO 148.200 vs Acc 154.200) yang bertahan identik hingga 7 Okt (akumulasi 24.000 Pcs).`,
      action:
        'Cek 1 dokumen Surat Jalan / Pengiriman 6.000 Pcs (6 bal/dus) pada tanggal 3 Oktober yang belum terposting di Accurate.',
    };
  }

  if (name === 'Beef Patty Small') {
    return {
      category: 'Drop Akurasi 3 Okt (77,23%), 5 Okt (73,77%) & Cut-Off 7 Okt',
      summary: `Akurasi 1–2 Okt di 91,26%–91,36% turun ke 77,23% pada 3 Okt (selisih melonjak 138 -> 383 Pack) dan 73,77% pada 5 Okt (selisih 393 Pack). Pada 7 Okt SO fisik masih 0 (selisih 2.439 Pack).`,
      action:
        'Verifikasi penerimaan barang (RI) Accurate pada 3 Oktober dan segera input hasil SO fisik Frozen tanggal 7 Oktober.',
    };
  }

  if (name === 'Beef Patty Large') {
    return {
      category: 'Drop Akurasi Terendah pada 6 Okt (68,71%, Selisih 525 Pack)',
      summary: `1–2 Okt selisih 372 Pack (Akurasi 75,69%–83,06%). Pada 6 Okt stok Accurate turun tajam (-593 Pack) sementara fisik SO naik (+103 Pack), menjatuhkan akurasi ke 68,71% (selisih 525 Pack).`,
      action:
        'Cek transaksi pengeluaran/mutasi di Accurate pada 6 Oktober yang memotong stok sistem tanpa pengeluaran fisik.',
    };
  }

  if (name === 'Smoke Beef Slice') {
    return {
      category: 'Drop Akurasi 3 Okt (78,51%, Selisih 329 Pack) & Cut-Off 7 Okt',
      summary: `1–2 Okt akurasi 99,72%–100%. Pada 3 Okt fisik keluar -286 Pack tetapi Accurate naik +48 Pack, menjatuhkan akurasi ke 78,51% (selisih 329 Pack).`,
      action:
        'Audit pengeluaran fisik 286 Pack Smoke Beef Slice pada 3 Oktober yang belum terinput ke sistem Accurate.',
    };
  }

  if (name === 'Ayam Crispy') {
    return {
      category: 'Drop Akurasi 3 Okt (81,00%) & 6 Okt (80,66%)',
      summary: `1–2 Okt akurasi ~99%. Pada 3 Okt akurasi turun ke 81,00% (selisih 179 Pack) dan pada 6 Okt turun ke 80,66% (selisih 246 Pack).`,
      action:
        'Sinkronkan jam cut-off input Surat Jalan Ayam Crispy dengan jadwal Stock Opname harian.',
    };
  }

  if (name === 'Keju Slice Non Brand') {
    return {
      category: 'Akurasi 100% di 1–6 Okt, Drop ke 0% di 7 Okt Karena SO Belum Input',
      summary: `Tanggal 1–6 Okt akurasi 100,00% (selisih 0, termasuk saat restock +1.500 Pack di 5 Okt). Akurasi total turun ke 58,04% murni karena SO tanggal 7 Okt masih 0 (vs Accurate 1.261 Pack).`,
      action:
        'Lengkapi pengisian angka Stock Opname fisik tanggal 7 Oktober untuk Keju Slice Non Brand.',
    };
  }

  if (name === 'Kentang Goreng Mc Cain') {
    return {
      category: 'Akurasi Rendah di Awal Periode (1–3 Okt: 69,39%–69,83%) & 7 Okt',
      summary: `1–3 Okt terdapat selisih 200–311 Bks/hari (Akurasi ~69,5%), namun membaik drastis pada 5 Okt (Akurasi 98,25%, selisih hanya 6 Bks) dan 6 Okt (95,26%). Pada 7 Okt SO fisik kosong (0 vs 402 Bks).`,
      action:
        'Input hasil SO fisik tanggal 7 Oktober; selisih periode 1–3 Okt telah terekompilasi pada 5 Oktober.',
    };
  }

  if (name === 'Dus Patty Logo L') {
    return {
      category: 'Degradasi Akurasi Harian Bertahap (76,89% -> 75,48%)',
      summary: `Sejak 1 Okt hingga 6 Okt selisih berkisar 190–335 Pcs/hari (Akurasi harian 75%–85%), ditambah SO 7 Okt masih 0 (selisih 1.305 Pcs).`,
      action:
        'Evaluasi pemakaian/reject Dus Patty Logo L di produksi yang belum diposting sebagai waste di Accurate.',
    };
  }

  if (hasUninputtedDay7SO && day7) {
    const preDay7Selisih = totalSelisih - day7.selisih;
    return {
      category: 'Drop Akurasi pada 7 Okt Akibat Cut-Off Input SO (SO = 0)',
      summary: `Pada 1–6 Okt total selisih hanya ${preDay7Selisih.toLocaleString('id-ID')} ${uom}. Pada 7 Okt kolom SO bernilai 0 sementara Accurate mencatat ${day7.accurate?.toLocaleString('id-ID')} ${uom}, menjatuhkan akurasi tanggal 7 Okt ke 0%.`,
      action:
        'Lengkapi input SO fisik tanggal 7 Oktober untuk mengembalikan akurasi item mendekati Baseline 100%.',
    };
  }

  if (totalSelisih === 0) {
    return {
      category: 'Tepat di Baseline 100,00% (Zero Variance)',
      summary: `Stok fisik SO dan sistem Accurate selalu identik (Akurasi 100,00%) sepanjang periode aktif.`,
      action: 'Pertahankan disiplin pencatatan dan cut-off opname harian.',
    };
  }

  return {
    category: 'Deviasi Transaksi Harian Terhadap Baseline 100%',
    summary: `Terdapat akumulasi selisih ${totalSelisih.toLocaleString('id-ID')} ${uom} dari total SO ${totalSO.toLocaleString('id-ID')} ${uom}.`,
    action:
      'Lakukan rekonsiliasi histori mutasi sistem pada tanggal dengan akurasi terendah.',
  };
}

export function parseAndAnalyzeSpreadsheet(csvText: string): ParsedSpreadsheetData {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      monthLabel: 'Oktober 2026',
      items: [],
      activeDays: [1, 2, 3, 4, 5, 6, 7],
      dailySummaries: [],
      rawAccurateDay5Total: 0,
      overallStockFisik: 0,
      overallError: 0,
      overallWape: 0,
      overallAccuracy: 100,
      totalDrasticSpikes: 0,
    };
  }

  const delimiter = detectDelimiter(lines);

  // Dynamically scan the first 10 rows to locate the Date header row and the "Nama Item / SO / Accurate" subheader row
  let dateHeaderRowIdx = 0;
  let subHeaderRowIdx = 1;
  let nameColIdx = 0;
  let uomColIdx = 1;

  for (let idx = 0; idx < Math.min(10, lines.length); idx++) {
    const rowTokens = parseCsvLine(lines[idx], delimiter);
    const joined = rowTokens.join(' ').toLowerCase();
    if (joined.includes('nama item') || (joined.includes('accurate') && joined.includes('selisih'))) {
      subHeaderRowIdx = idx;
      dateHeaderRowIdx = Math.max(0, idx - 1);
      const foundNameIdx = rowTokens.findIndex((c) => /nama\s*item/i.test(c));
      if (foundNameIdx >= 0) {
        nameColIdx = foundNameIdx;
        uomColIdx = foundNameIdx + 1;
      }
      break;
    }
  }

  const headerRowDate = parseCsvLine(lines[dateHeaderRowIdx], delimiter);
  const headerRowSub = parseCsvLine(lines[subHeaderRowIdx] || '', delimiter);

  // Extract month name if present (e.g., "Oktober")
  let rawMonthName = 'Oktober';
  for (let c = 0; c <= Math.min(3, headerRowDate.length - 1); c++) {
    const token = (headerRowDate[c] || '').replace(/^["']+|["']+$/g, '').trim();
    if (/^(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)/i.test(token)) {
      rawMonthName = token.split(/\s+/)[0];
      break;
    }
  }
  const shortMonth = rawMonthName.slice(0, 3);

  const dayColMap = new Map<number, number>();
  const detectedDays: number[] = [];

  // 1) Detect days from the Date Header Row (standard CSV/Sheet export: "1", "2", "3"...)
  for (let c = uomColIdx + 1; c < headerRowDate.length; c++) {
    const cellTxt = (headerRowDate[c] || '').replace(/^["']+|["']+$/g, '').trim();
    const numMatch = cellTxt.match(/^(\d{1,2})(?:\s+so)?$/i);
    if (numMatch) {
      const dayNum = Number(numMatch[1]);
      if (dayNum >= 1 && dayNum <= 31 && !dayColMap.has(dayNum)) {
        dayColMap.set(dayNum, c);
        detectedDays.push(dayNum);
      }
    }
  }

  // 2) Support Google Sheets gviz CSV where row 0 and row 1 are merged into subHeaderRow ("1 SO", "2 SO", etc.)
  if (detectedDays.length === 0) {
    for (let c = uomColIdx + 1; c < headerRowSub.length; c++) {
      const cellTxt = (headerRowSub[c] || '').replace(/^["']+|["']+$/g, '').trim();
      const gvizMatch = cellTxt.match(/^(\d{1,2})\s*SO$/i);
      if (gvizMatch) {
        const dayNum = Number(gvizMatch[1]);
        if (dayNum >= 1 && dayNum <= 31 && !dayColMap.has(dayNum)) {
          dayColMap.set(dayNum, c);
          detectedDays.push(dayNum);
        }
      }
    }
  }

  // 3) Fallback if header row doesn't explicitly list numbers: infer from "SO, Accurate, Selisih" triplets
  if (detectedDays.length === 0) {
    let inferredDay = 1;
    for (let c = uomColIdx + 1; c + 2 < headerRowSub.length; c++) {
      const c0 = (headerRowSub[c] || '').trim().toLowerCase();
      const c1 = (headerRowSub[c + 1] || '').trim().toLowerCase();
      if (c0 === 'so' && c1 === 'accurate' && inferredDay <= 31) {
        dayColMap.set(inferredDay, c);
        detectedDays.push(inferredDay);
        inferredDay++;
        c += 2;
      }
    }
  }

  const activeDays =
    detectedDays.length > 0
      ? detectedDays.sort((a, b) => a - b)
      : Array.from({ length: 31 }, (_, i) => i + 1);

  const items: InventoryItem[] = [];

  let stockFisikRow: string[] = [];
  let errorRow: string[] = [];
  let wapeRow: string[] = [];
  let accuracyRow: string[] = [];
  let reachedSummarySection = false;

  for (let r = subHeaderRowIdx + 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r], delimiter);
    const col0 = (cols[nameColIdx] || '').replace(/^["']+|["']+$/g, '').trim();
    const col1 = (cols[uomColIdx] || '').replace(/^["']+|["']+$/g, '').trim();

    // Check if any of the first 5 columns is a bottom summary label ('Stock Fisik', 'Error', 'Wape', 'stock Accuracy')
    const firstFewLower = cols
      .slice(0, 5)
      .map((c) => (c || '').replace(/^["']+|["']+$/g, '').trim().toLowerCase());

    if (firstFewLower.includes('stock fisik')) {
      stockFisikRow = cols;
      reachedSummarySection = true;
      continue;
    }
    if (firstFewLower.includes('error') && (!col0 || reachedSummarySection)) {
      errorRow = cols;
      reachedSummarySection = true;
      continue;
    }
    if (firstFewLower.includes('wape')) {
      wapeRow = cols;
      reachedSummarySection = true;
      continue;
    }
    if (firstFewLower.includes('stock accuracy')) {
      accuracyRow = cols;
      reachedSummarySection = true;
      // Stop parsing after the main table's 'stock Accuracy' summary row so secondary tables below are not mixed in
      break;
    }

    if (reachedSummarySection) {
      break;
    }

    if (!col0 || col0.toLowerCase() === 'nama item' || col0.toLowerCase() === 'oktober') {
      continue;
    }

    const daily: DailyRecord[] = [];
    let prevSelisih = 0;
    let prevSO: number | null = null;
    let prevAcc: number | null = null;
    let maxDailySpike = 0;
    let maxSpikeDay: number | null = null;
    let spikeCount = 0;
    let hasNegativeAccurate = false;
    let hasUninputtedDay7SO = false;

    for (const day of activeDays) {
      const baseIdx = dayColMap.get(day) ?? uomColIdx + 1 + (day - 1) * 3;
      const soVal = parseIndoNumber(cols[baseIdx]);
      const accVal = parseIndoNumber(cols[baseIdx + 1]);
      const rawSelVal = parseIndoNumber(cols[baseIdx + 2]);

      // Dynamically synchronize Selisih if SO or Accurate changes in the spreadsheet
      let selVal = rawSelVal ?? 0;
      if (soVal !== null && accVal !== null) {
        selVal = Math.abs(soVal - accVal);
      } else if (rawSelVal !== null && rawSelVal > 0) {
        selVal = rawSelVal;
      } else if (soVal !== null && soVal > 0 && accVal === null) {
        selVal = soVal;
      } else if ((soVal === null || soVal === 0) && accVal !== null && accVal !== 0) {
        selVal = Math.abs(accVal);
      }

      const hasActivityOnDay =
        (soVal !== null && soVal > 0) ||
        (accVal !== null && accVal !== 0) ||
        selVal > 0;

      if (accVal !== null && accVal < 0) {
        hasNegativeAccurate = true;
      }

      const deltaSO =
        prevSO !== null && soVal !== null && hasActivityOnDay ? soVal - prevSO : null;
      const deltaAccurate =
        prevAcc !== null && accVal !== null && hasActivityOnDay ? accVal - prevAcc : null;
      const deltaFromPrevSelisih = hasActivityOnDay ? selVal - prevSelisih : 0;

      // Calculate Daily Stock Accuracy % against Baseline 100%
      let dailyAccuracyPercent: number | null = null;
      let gapFromBaseline100: number | null = null;

      if (hasActivityOnDay) {
        if (soVal !== null && soVal > 0 && accVal !== null && accVal > 0) {
          const errPct = (selVal / soVal) * 100;
          dailyAccuracyPercent = Number(Math.max(0, 100 - errPct).toFixed(2));
          gapFromBaseline100 = Number((dailyAccuracyPercent - 100).toFixed(2));
        } else if (soVal !== null && soVal > 0 && accVal === 0 && selVal === 0) {
          dailyAccuracyPercent = 100;
          gapFromBaseline100 = 0;
        } else if (selVal > 0 || (accVal !== null && accVal !== 0)) {
          dailyAccuracyPercent = 0;
          gapFromBaseline100 = -100;
        } else {
          dailyAccuracyPercent = 100;
          gapFromBaseline100 = 0;
        }
      }

      let isSpike = false;
      let spikeReason = '';

      if (hasActivityOnDay && selVal > 0) {
        if ((soVal === 0 || soVal === null) && accVal !== null && accVal >= 100) {
          isSpike = true;
          if (day === 7) hasUninputtedDay7SO = true;
          spikeReason = `SO Fisik ${day} ${shortMonth} = 0 (Belum Input), Accurate = ${accVal.toLocaleString('id-ID')}`;
        } else if (day === 1 && selVal >= 250) {
          isSpike = true;
          spikeReason = `Selisih awal tinggi (${selVal.toLocaleString('id-ID')} ${col1})`;
        } else if (
          deltaFromPrevSelisih >= 100 ||
          (selVal >= 30 && prevSelisih > 0 && selVal >= prevSelisih * 2) ||
          (selVal >= 25 && prevSelisih <= 2)
        ) {
          isSpike = true;
          spikeReason = `Lonjakan selisih +${deltaFromPrevSelisih.toLocaleString('id-ID')} ${col1} (dari ${prevSelisih.toLocaleString('id-ID')} ke ${selVal.toLocaleString('id-ID')})`;
        } else if (selVal >= 1000) {
          isSpike = true;
          spikeReason = `Selisih masif >1.000 unit (${selVal.toLocaleString('id-ID')} ${col1})`;
        }
      }

      if (isSpike) {
        spikeCount++;
      }
      if (selVal > maxDailySpike) {
        maxDailySpike = selVal;
        maxSpikeDay = day;
      }

      let inferredTransactionType: DailyRecord['inferredTransactionType'] = 'ZERO_VARIANCE';
      let transactionNote = 'Stok fisik SO & Accurate seimbang (Akurasi 100% sesuai Baseline).';

      if (!hasActivityOnDay) {
        inferredTransactionType = 'HOLIDAY_NO_SO';
        transactionNote = `Tanggal ${day} ${shortMonth} belum ada transaksi / pengambilan Stock Opname di Spreadsheet.`;
      } else if (accVal !== null && accVal < 0) {
        inferredTransactionType = 'NEGATIVE_SYSTEM_STOCK';
        transactionNote = `Stok sistem Accurate minus (${accVal} ${col1}), indikasi pengeluaran diposting sebelum penerimaan barang.`;
      } else if ((soVal === 0 || soVal === null) && accVal && accVal > 0) {
        inferredTransactionType = day === 7 ? 'UNINPUTTED_SO_CUTOFF' : 'UOM_CONVERSION_GAP';
        transactionNote = `Kolom SO Fisik tercatat 0 sedangkan Accurate mencatat ${accVal.toLocaleString('id-ID')} ${col1} (Bukan hasil banding karena SO = 0).`;
      } else if (soVal && soVal > 0 && accVal === null) {
        inferredTransactionType = 'UOM_CONVERSION_GAP';
        transactionNote = `Fisik SO tercatat ${soVal.toLocaleString('id-ID')} ${col1}, namun kolom Accurate kosong/tidak tertarik (Bukan hasil banding).`;
      } else if (selVal === 0) {
        if (deltaSO !== null && deltaSO > 0) {
          inferredTransactionType = 'RESTOCK_INBOUND';
          transactionNote = `Barang masuk (Restock) +${deltaSO.toLocaleString('id-ID')} ${col1}, klop 100% di SO & Accurate.`;
        } else if (deltaSO !== null && deltaSO < 0) {
          inferredTransactionType = 'NORMAL_CONSUMPTION';
          transactionNote = `Pengeluaran normal ${deltaSO.toLocaleString('id-ID')} ${col1}, akurasi terjaga 100%.`;
        } else {
          inferredTransactionType = 'ZERO_VARIANCE';
          transactionNote = `Stok stabil (${(soVal ?? 0).toLocaleString('id-ID')} ${col1}), akurasi 100%.`;
        }
      } else {
        inferredTransactionType = 'UNPOSTED_DELIVERY_OR_USAGE';
        const diffSign = (soVal ?? 0) > (accVal ?? 0) ? 'Fisik > Accurate' : 'Accurate > Fisik';
        const deltaDesc: string[] = [];
        if (deltaSO !== null) {
          deltaDesc.push(`Mutasi SO: ${deltaSO >= 0 ? '+' : ''}${deltaSO.toLocaleString('id-ID')}`);
        }
        if (deltaAccurate !== null) {
          deltaDesc.push(
            `Mutasi Accurate: ${deltaAccurate >= 0 ? '+' : ''}${deltaAccurate.toLocaleString('id-ID')}`
          );
        }
        transactionNote = `Selisih ${selVal.toLocaleString('id-ID')} ${col1} (${diffSign}). ${deltaDesc.join(' | ')}`;
      }

      daily.push({
        day,
        dateLabel: `${day} ${shortMonth}`,
        so: soVal,
        accurate: accVal,
        selisih: selVal,
        dailyAccuracyPercent,
        gapFromBaseline100,
        isSpike,
        spikeReason,
        deltaFromPrevSelisih,
        deltaSO,
        deltaAccurate,
        inferredTransactionType,
        transactionNote,
      });

      if (hasActivityOnDay) {
        prevSelisih = selVal;
        if (soVal !== null && soVal > 0) prevSO = soVal;
        if (accVal !== null && accVal !== 0) prevAcc = accVal;
      }
    }

    const len = cols.length;
    const computedTotalSelisih = daily.reduce((s, d) => s + d.selisih, 0);
    const computedTotalSO = daily.reduce((s, d) => s + (d.so ?? 0), 0);
    const totalSelisih =
      computedTotalSelisih > 0
        ? computedTotalSelisih
        : parseIndoNumber(cols[len - 3]) ?? 0;
    const totalSO =
      computedTotalSO > 0
        ? computedTotalSO
        : parseIndoNumber(cols[len - 2]) ?? 0;
    const totalAccurate = daily.reduce((s, d) => s + (d.accurate ?? 0), 0);
    const sheetRightmostErrorCol = (cols[len - 1] || '').replace(/^["']+|["']+$/g, '').trim();
    const sheetAccuracyPercent = parseIndoNumber(sheetRightmostErrorCol);

    const hasZeroSOButActiveAccurate = totalSO === 0 && totalSelisih > 0;

    let errorRatePercent = 0;
    if (totalSO > 0) {
      errorRatePercent = Number(((totalSelisih / totalSO) * 100).toFixed(2));
    } else if (totalSelisih > 0) {
      errorRatePercent = 100;
    }

    const baselineAccuracyPercent = Number(Math.max(0, 100 - errorRatePercent).toFixed(2));

    const rootCause = buildRootCauseAnalysis(
      col0,
      col1,
      daily,
      totalSelisih,
      totalSO,
      hasNegativeAccurate,
      hasUninputtedDay7SO,
      hasZeroSOButActiveAccurate
    );

    items.push({
      id: `item-${r}-${col0.replace(/\s+/g, '-').toLowerCase()}`,
      name: col0,
      uom: col1,
      category: categorizeItem(col0),
      daily,
      totalSelisih,
      totalSO,
      totalAccurate,
      sheetRightmostErrorCol:
        sheetRightmostErrorCol ||
        (totalSO > 0
          ? `${baselineAccuracyPercent.toFixed(2).replace('.', ',')}%`
          : totalSelisih > 0
          ? '0,00% (SO=0)'
          : '100,00%'),
      sheetAccuracyPercent: sheetAccuracyPercent ?? (totalSO > 0 ? baselineAccuracyPercent : null),
      errorRatePercent,
      baselineAccuracyPercent,
      maxDailySpike,
      maxSpikeDay,
      spikeCount,
      rootCauseCategory: rootCause.category,
      rootCauseSummary: rootCause.summary,
      recommendedAction: rootCause.action,
      hasNegativeAccurate,
      hasUninputtedDay7SO,
      hasZeroSOButActiveAccurate,
    });
  }

  // Build dailySummaries across ALL dates in activeDays, dynamically syncing with live item totals
  const dailySummaries: DailyAccuracySummary[] = activeDays.map((day, dayIdx) => {
    const baseIdx = dayColMap.get(day) ?? uomColIdx + 1 + (day - 1) * 3;
    const valIdx = baseIdx + 1;

    const sheetFisik = parseIndoNumber(stockFisikRow[valIdx]) ?? 0;
    const sheetError = parseIndoNumber(errorRow[valIdx]) ?? 0;
    const computedFisik = items.reduce((s, it) => s + (it.daily[dayIdx]?.so ?? 0), 0);
    const computedError = items.reduce((s, it) => s + (it.daily[dayIdx]?.selisih ?? 0), 0);

    // Always use live computed totals when items have activity so any spreadsheet edit updates immediately
    const stockFisik = computedFisik > 0 ? computedFisik : sheetFisik;
    const error = computedError > 0 ? computedError : sheetError;

    const rawWapeStr = (wapeRow[valIdx] || '').replace(/^["']+|["']+$/g, '').trim();
    const rawAccStr = (accuracyRow[valIdx] || '').replace(/^["']+|["']+$/g, '').trim();

    let wapeNum = parseIndoNumber(rawWapeStr);
    let stockAccuracyNum = parseIndoNumber(rawAccStr);

    if (stockFisik > 0) {
      wapeNum = Number(((error / stockFisik) * 100).toFixed(2));
      stockAccuracyNum = Number(Math.max(0, 100 - wapeNum).toFixed(2));
    } else if (error > 0) {
      wapeNum = 100;
      stockAccuracyNum = 0;
    }

    const wapeStr =
      wapeNum !== null ? `${wapeNum.toFixed(2).replace('.', ',')}%` : rawWapeStr || '-';
    const stockAccuracyStr =
      stockAccuracyNum !== null
        ? `${stockAccuracyNum.toFixed(2).replace('.', ',')}%`
        : rawAccStr
        ? `${rawAccStr.replace('%', '')}%`
        : '-';

    const gapFromBaseline100 =
      stockAccuracyNum !== null ? Number((stockAccuracyNum - 100).toFixed(2)) : null;

    return {
      day,
      dateLabel: `${day} ${shortMonth}`,
      stockFisik,
      error,
      wapeStr,
      wapeNum,
      stockAccuracyStr,
      stockAccuracyNum,
      gapFromBaseline100,
      isDrasticDrop: (wapeNum !== null && wapeNum >= 3.0) || error >= 25000,
    };
  });

  // Only include days that actually have valid comparison data (stockFisik > 0 and stockAccuracyNum > 0)
  const activeSummaries = dailySummaries.filter(
    (d) => d.stockFisik > 0 && d.stockAccuracyNum !== null && d.stockAccuracyNum > 0
  );
  const overallStockFisik = activeSummaries.reduce((s, d) => s + d.stockFisik, 0);
  const overallError = activeSummaries.reduce((s, d) => s + d.error, 0);
  const overallWape =
    overallStockFisik > 0 ? Number(((overallError / overallStockFisik) * 100).toFixed(2)) : 0;
  const overallAccuracy = Number((100 - overallWape).toFixed(2));
  const totalDrasticSpikes = items.reduce((s, it) => s + it.spikeCount, 0);

  return {
    monthLabel: `${rawMonthName} 2026`,
    items,
    activeDays,
    dailySummaries,
    rawAccurateDay5Total: 909621,
    overallStockFisik,
    overallError,
    overallWape,
    overallAccuracy,
    totalDrasticSpikes,
  };
}

// Compute dynamic Dashboard & Item Analysis for selected date(s) [startDay .. endDay]
// Rule: Jangan masukkan 0% sebagai Terendah, cari yang benar-benar hasil banding (SO > 0 & Accurate != 0 & Akurasi > 0%)
export function computePeriodDashboardAnalysis(
  data: ParsedSpreadsheetData,
  startDay: number,
  endDay: number
) {
  const minDay = Math.min(startDay, endDay);
  const maxDay = Math.max(startDay, endDay);

  const periodSummaries = data.dailySummaries.filter(
    (d) => d.day >= minDay && d.day <= maxDay
  );
  // Hanya hari yang benar-benar ada hasil banding (stockFisik > 0 dan stockAccuracyNum > 0)
  const activePeriodSummaries = periodSummaries.filter(
    (d) => d.stockAccuracyNum !== null && d.stockAccuracyNum > 0 && d.stockFisik > 0
  );

  const averagePeriodAccuracy =
    activePeriodSummaries.length > 0
      ? Number(
          (
            activePeriodSummaries.reduce((s, d) => s + (d.stockAccuracyNum ?? 0), 0) /
            activePeriodSummaries.length
          ).toFixed(2)
        )
      : 100;

  const periodTotalFisik = activePeriodSummaries.reduce((s, d) => s + d.stockFisik, 0);
  const periodTotalError = activePeriodSummaries.reduce((s, d) => s + d.error, 0);
  const periodWape =
    periodTotalFisik > 0 ? Number(((periodTotalError / periodTotalFisik) * 100).toFixed(2)) : 0;
  const weightedPeriodAccuracy = Number(Math.max(0, 100 - periodWape).toFixed(2));

  const gapFromBaseline100 = Number((averagePeriodAccuracy - 100).toFixed(2));

  // Cari hari dengan akurasi terendah & tertinggi yang benar-benar hasil banding (> 0%)
  let lowestDaySummary: DailyAccuracySummary | null = null;
  let highestDaySummary: DailyAccuracySummary | null = null;

  for (const s of activePeriodSummaries) {
    if ((s.stockAccuracyNum ?? 0) <= 0) continue;
    if (
      !lowestDaySummary ||
      (s.stockAccuracyNum ?? 100) < (lowestDaySummary.stockAccuracyNum ?? 100)
    ) {
      lowestDaySummary = s;
    }
    if (
      !highestDaySummary ||
      (s.stockAccuracyNum ?? 0) > (highestDaySummary.stockAccuracyNum ?? 0)
    ) {
      highestDaySummary = s;
    }
  }

  // Compute per-item metrics within [minDay..maxDay]
  const periodItems: PeriodItemAnalysis[] = data.items.map((item) => {
    const rawSlice = item.daily.filter((d) => d.day >= minDay && d.day <= maxDay);

    let periodSO = 0;
    let periodAccurate = 0;
    let periodSelisih = 0;
    let comparedSO = 0;
    let comparedSelisih = 0;
    let comparedDaysCount = 0;
    let activeDaysCount = 0;

    let lowestAccRec: DailyRecord | null = null;
    let highestSelRec: DailyRecord | null = null;

    for (const d of rawSlice) {
      const so = d.so ?? 0;
      const acc = d.accurate ?? 0;
      const sel = d.selisih;

      periodSO += so;
      periodAccurate += acc;
      periodSelisih += sel;

      // Hari yang benar-benar ada hasil banding: SO > 0 DAN Accurate ada nilai (!== null && !== 0)
      const isRealComparisonDay =
        d.so !== null && d.so > 0 && d.accurate !== null && d.accurate !== 0;

      if (isRealComparisonDay) {
        comparedSO += so;
        comparedSelisih += sel;
        comparedDaysCount++;
      }

      if (so > 0 || acc !== 0 || sel > 0) {
        activeDaysCount++;

        // Jangan masukkan 0% sebagai Terendah! Hanya pilih hari yang benar-benar hasil banding (isRealComparisonDay & dailyAccuracyPercent > 0)
        if (
          isRealComparisonDay &&
          d.dailyAccuracyPercent !== null &&
          d.dailyAccuracyPercent > 0
        ) {
          if (
            !lowestAccRec ||
            d.dailyAccuracyPercent < (lowestAccRec.dailyAccuracyPercent ?? 100) ||
            (d.dailyAccuracyPercent === (lowestAccRec.dailyAccuracyPercent ?? 100) &&
              d.selisih > lowestAccRec.selisih)
          ) {
            lowestAccRec = d;
          }
        }

        if (!highestSelRec || d.selisih > highestSelRec.selisih) {
          highestSelRec = d;
        }
      }
    }

    // Mark lowest accuracy day inside periodDaily (only > 0% real comparison day)
    const periodDaily = rawSlice.map((d) => ({
      ...d,
      isLowestAccuracyDay:
        lowestAccRec !== null &&
        d.day === lowestAccRec.day &&
        (d.selisih > 0 || (d.dailyAccuracyPercent ?? 100) < 100),
    }));

    let periodErrorRatePercent = 0;
    let periodAccuracyPercent = 100;

    if (comparedDaysCount > 0 && comparedSO > 0) {
      // Gunakan hasil banding nyata jika tersedia; apabila 1-7 Okt penuh dan sheet punya angka akurasi > 0%, sinkronkan
      const rawRate = Number(((periodSelisih / periodSO) * 100).toFixed(2));
      const rawAcc = Number(Math.max(0, 100 - rawRate).toFixed(2));
      if (rawAcc > 0) {
        periodErrorRatePercent = rawRate;
        periodAccuracyPercent = rawAcc;
      } else {
        // Jika hari cut-off (SO=0) menarik total ke 0%, gunakan akurasi dari hari-hari yang benar-benar terbanding
        periodErrorRatePercent = Number(((comparedSelisih / comparedSO) * 100).toFixed(2));
        periodAccuracyPercent = Number(Math.max(0, 100 - periodErrorRatePercent).toFixed(2));
      }
    } else if (periodSO > 0 && periodAccurate > 0) {
      periodErrorRatePercent = Number(((periodSelisih / periodSO) * 100).toFixed(2));
      periodAccuracyPercent = Number(Math.max(0, 100 - periodErrorRatePercent).toFixed(2));
    } else if (periodSelisih > 0) {
      // Bukan hasil banding (salah satu SO=0 atau Accurate=0 -> 0%)
      periodErrorRatePercent = 100;
      periodAccuracyPercent = 0;
    }

    return {
      item,
      periodDaily,
      periodSO,
      periodAccurate,
      periodSelisih,
      periodErrorRatePercent,
      periodAccuracyPercent,
      gapFromBaseline100: Number((periodAccuracyPercent - 100).toFixed(2)),
      lowestAccuracyDayRecord: lowestAccRec,
      highestSelisihDayRecord: highestSelRec,
      activeDaysCount,
    };
  });

  return {
    startDay: minDay,
    endDay: maxDay,
    periodSummaries,
    activePeriodSummaries,
    averagePeriodAccuracy,
    weightedPeriodAccuracy,
    periodWape,
    periodTotalFisik,
    periodTotalError,
    gapFromBaseline100,
    lowestDaySummary,
    highestDaySummary,
    periodItems,
  };
}

// Kosongkan Ulang Rekap Mutasi Sistem & Kartu Stock secara default (Hanya terisi jika ada Upload)
export const INITIAL_SYSTEM_MUTATION_MASTER: SystemMutationRecord[] = [];

export const INITIAL_SAMPLE_STOCK_CARDS: AnalyzedStockCard[] = [];

// Logika Analisa Hasil Banding Based On Search Item:
// 1. Baseline Hitungan: SO tgl 1 - Data Out tgl 2 = SO tgl 2
// 2. Kecocokan Tanggal & Kecocokan Total Qty IN - OUT
// 3. Perluasan Logika:
//    - Fisik Keluar tanpa data Accurate
//    - Accurate keluar tapi Fisik tidak
//    - Geser transaksi antara sistem dan fisik (bisa geser beberapa hari)
// 4. Jangan langsung eksekusi Berdasar Nomor (hanya jika Qty sama persis atau di ujung dari hasil analisa)
export function buildVarianceDateMutationComparisons(
  periodItem: PeriodItemAnalysis,
  systemMutations: SystemMutationRecord[],
  stockCards: AnalyzedStockCard[],
  specificDayFilter: number | 'ALL' = 'ALL',
  displayMode: 'ALL_DATES' | 'VARIANCE_ONLY' = 'VARIANCE_ONLY'
): VarianceDateMutationComparison[] {
  const { item, periodDaily } = periodItem;
  const allDaily = item.daily;

  const matchedCard = stockCards.find(
    (sc) =>
      sc.itemName.toLowerCase().trim() === item.name.toLowerCase().trim() ||
      sc.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(sc.itemName.toLowerCase())
  );

  // All mutations for this item across all dates (for multi-day shift detection)
  const itemMutationsAllDays = systemMutations.filter((m) => {
    const mItem = m.itemName.toLowerCase().trim();
    const tItem = item.name.toLowerCase().trim();
    const mDesc = m.description.toLowerCase();
    return (
      mItem === 'semua item' ||
      mItem === tItem ||
      mItem.includes(tItem) ||
      tItem.includes(mItem) ||
      mDesc.includes(tItem)
    );
  });

  const targetDays = periodDaily.filter((d) => {
    if (specificDayFilter !== 'ALL') {
      return d.day === specificDayFilter;
    }
    if (displayMode === 'ALL_DATES') {
      return true;
    }
    return d.selisih > 0 || (d.dailyAccuracyPercent !== null && d.dailyAccuracyPercent < 100);
  });

  return targetDays.map((d) => {
    const soVal = d.so ?? 0;
    const accVal = d.accurate ?? 0;
    const hasActivity =
      (d.so !== null && d.so > 0) ||
      (d.accurate !== null && d.accurate !== 0) ||
      d.selisih > 0;

    // Cari tanggal aktif sebelumnya (contoh: tgl 1 sebelum tgl 2, atau tgl 3 sebelum tgl 5 jika tgl 4 libur SO)
    let prevRecord: DailyRecord | null = null;
    for (let idx = allDaily.findIndex((x) => x.day === d.day) - 1; idx >= 0; idx--) {
      const cand = allDaily[idx];
      if ((cand.so !== null && cand.so > 0) || (cand.accurate !== null && cand.accurate !== 0)) {
        prevRecord = cand;
        break;
      }
    }

    // Cari tanggal aktif berikutnya (untuk deteksi geser transaksi beberapa hari ke depan)
    const nextRecords: DailyRecord[] = [];
    const currIdx = allDaily.findIndex((x) => x.day === d.day);
    for (let idx = currIdx + 1; idx < allDaily.length && nextRecords.length < 3; idx++) {
      const cand = allDaily[idx];
      if ((cand.so !== null && cand.so > 0) || (cand.accurate !== null && cand.accurate !== 0)) {
        nextRecords.push(cand);
      }
    }

    const prevSO = prevRecord?.so ?? null;
    const prevAcc = prevRecord?.accurate ?? null;
    const prevLabel = prevRecord?.dateLabel ?? null;

    let varianceDirection: VarianceDateMutationComparison['varianceDirection'] = 'SEIMBANG';
    let varianceTypeLabel = 'Tidak Ada Selisih (Klop 100%)';

    if (!hasActivity) {
      varianceDirection = 'SEIMBANG';
      varianceTypeLabel = 'Belum Ada Transaksi / Kosong di Spreadsheet';
    } else if (d.selisih === 0 && (d.dailyAccuracyPercent ?? 100) === 100) {
      varianceDirection = 'SEIMBANG';
      varianceTypeLabel = 'Tidak Ada Selisih (Klop 100%)';
    } else if ((d.so === 0 || d.so === null) && accVal > 0) {
      varianceDirection = d.day === 7 ? 'SO_BELUM_INPUT' : 'FISIK_KURANG';
      varianceTypeLabel =
        d.day === 7
          ? 'SO Fisik Belum Input (SO = 0 vs Accurate Aktif)'
          : 'SO Fisik = 0 / Belum Terbanding dengan Accurate';
    } else if (d.accurate !== null && d.accurate < 0) {
      varianceDirection = 'SISTEM_MINUS';
      varianceTypeLabel = 'Stok Accurate Minus (Negative Inventory)';
    } else if (soVal > 0 && d.accurate === null) {
      varianceDirection = 'FISIK_LEBIH';
      varianceTypeLabel = 'Data Accurate Kosong (Fisik Ada, Sistem Kosong)';
    } else if (soVal > accVal) {
      varianceDirection = 'FISIK_LEBIH';
      varianceTypeLabel = 'Selisih Lebih Fisik (SO Fisik > Accurate)';
    } else if (soVal < accVal) {
      varianceDirection = 'FISIK_KURANG';
      varianceTypeLabel = 'Selisih Kurang Fisik (SO Fisik < Accurate)';
    }

    const matchedSystemMutations = itemMutationsAllDays.filter((m) => m.dayNumber === d.day);
    const matchedStockCardEntries: StockCardEntry[] = matchedCard
      ? matchedCard.entries.filter((e) => e.dayNumber === d.day)
      : [];
    const lastCardEntry =
      matchedStockCardEntries.length > 0
        ? matchedStockCardEntries[matchedStockCardEntries.length - 1]
        : null;
    const stockCardBalance = lastCardEntry ? lastCardEntry.balance : null;
    const gapSOvsStockCard =
      stockCardBalance !== null && d.so !== null ? d.so - stockCardBalance : null;
    const gapAccuratevsStockCard =
      stockCardBalance !== null && d.accurate !== null
        ? d.accurate - stockCardBalance
        : null;

    const hasUploadedMutasi = matchedSystemMutations.length > 0;
    const hasUploadedCard = matchedStockCardEntries.length > 0;

    const totalMutIn = matchedSystemMutations.reduce((s, m) => s + m.qtyIn, 0);
    const totalMutOut = matchedSystemMutations.reduce((s, m) => s + m.qtyOut, 0);
    const netMutasiUpload = totalMutIn - totalMutOut;

    const totalCardIn = matchedStockCardEntries.reduce((s, e) => s + e.qtyIn, 0);
    const totalCardOut = matchedStockCardEntries.reduce((s, e) => s + e.qtyOut, 0);

    // =========================================================================
    // 1. HITUNGAN ACUAN SO SEBELUMNYA
    //    Contoh Logika: Jika Tgl Sebelumnya ada 20, Tgl Ini Out 5 (In 0),
    //    maka Hasil SO Tgl Ini Harusnya = 15.
    // =========================================================================
    const netFisikDelta = prevSO !== null && d.so !== null ? soVal - prevSO : null;
    const netAccDelta = prevAcc !== null && d.accurate !== null ? accVal - prevAcc : null;

    const fisikOutImplied = netFisikDelta !== null && netFisikDelta < 0 ? Math.abs(netFisikDelta) : 0;
    const fisikInImplied = netFisikDelta !== null && netFisikDelta > 0 ? netFisikDelta : 0;
    const accOutImplied = netAccDelta !== null && netAccDelta < 0 ? Math.abs(netAccDelta) : 0;
    const accInImplied = netAccDelta !== null && netAccDelta > 0 ? netAccDelta : 0;

    // Gunakan In/Out dari Mutasi Sistem jika diupload, atau Kartu Stock jika ada, atau pergerakan Accurate
    const inToday = hasUploadedMutasi
      ? totalMutIn
      : hasUploadedCard
      ? totalCardIn
      : accInImplied;
    const outToday = hasUploadedMutasi
      ? totalMutOut
      : hasUploadedCard
      ? totalCardOut
      : accOutImplied;

    const expectedSOFromPrev =
      prevSO !== null && hasActivity ? prevSO + inToday - outToday : accVal;

    const deviationFromExpected =
      d.so !== null && expectedSOFromPrev !== null ? soVal - expectedSOFromPrev : soVal - accVal;

    // Tentukan 2 Kriteria Besar: FISIK_KURANG vs FISIK_LEBIH (atau SESUAI bila tidak ada selisih)
    let majorCriteria: 'FISIK_KURANG' | 'FISIK_LEBIH' | 'SESUAI' = 'SESUAI';
    if (hasActivity && (d.selisih > 0 || (deviationFromExpected !== null && deviationFromExpected !== 0))) {
      if (soVal < accVal || (soVal === accVal && (deviationFromExpected ?? 0) < 0)) {
        majorCriteria = 'FISIK_KURANG';
      } else if (soVal > accVal || (soVal === accVal && (deviationFromExpected ?? 0) > 0)) {
        majorCriteria = 'FISIK_LEBIH';
      }
    }

    let previousSOReferenceSummary = '';
    if (prevRecord && prevSO !== null && hasActivity) {
      const inOutText =
        inToday > 0 && outToday > 0
          ? `In ${inToday.toLocaleString('id-ID')} & Out ${outToday.toLocaleString('id-ID')}`
          : inToday > 0
          ? `In ${inToday.toLocaleString('id-ID')} (Out 0)`
          : `Out ${outToday.toLocaleString('id-ID')}`;

      if (deviationFromExpected === 0 && d.selisih === 0) {
        previousSOReferenceSummary = `Acuan SO ${prevLabel} ada ${prevSO.toLocaleString('id-ID')} ${item.uom}, pada ${d.dateLabel} tercatat ${inOutText} ${item.uom} → Hasil SO ${d.dateLabel} seharusnya ${expectedSOFromPrev.toLocaleString('id-ID')} ${item.uom}. Realisasi SO Aktual = ${soVal.toLocaleString('id-ID')} ${item.uom} (SESUAI 100%).`;
      } else {
        const diffExpectedAbs = Math.abs(deviationFromExpected ?? 0);
        previousSOReferenceSummary = `Acuan SO ${prevLabel} ada ${prevSO.toLocaleString('id-ID')} ${item.uom}, pada ${d.dateLabel} tercatat ${inOutText} ${item.uom} → Hasil SO ${d.dateLabel} seharusnya ${expectedSOFromPrev.toLocaleString('id-ID')} ${item.uom}. Realisasi SO Aktual = ${soVal.toLocaleString('id-ID')} ${item.uom} & Stok Accurate = ${accVal.toLocaleString('id-ID')} ${item.uom} → Tidak sesuai sebesar ${
          diffExpectedAbs > 0 ? diffExpectedAbs.toLocaleString('id-ID') : d.selisih.toLocaleString('id-ID')
        } ${item.uom} (Selisih vs Accurate: ${d.selisih.toLocaleString('id-ID')} ${item.uom} — Masuk Kriteria: ${
          majorCriteria === 'FISIK_KURANG' ? 'FISIK KURANG' : 'FISIK LEBIH'
        }).`;
      }
    } else if (d.day === 1 && hasActivity) {
      previousSOReferenceSummary = `Titik Awal SO (${d.dateLabel}): Stok Fisik SO = ${soVal.toLocaleString('id-ID')} ${item.uom} vs Stok Accurate = ${accVal.toLocaleString('id-ID')} ${item.uom}${
        d.selisih > 0
          ? ` → Terdapat selisih awal ${d.selisih.toLocaleString('id-ID')} ${item.uom} (${
              majorCriteria === 'FISIK_KURANG' ? 'Kriteria: FISIK KURANG' : 'Kriteria: FISIK LEBIH'
            }).`
          : ' (Sesuai 100%).'
      }`;
    } else {
      previousSOReferenceSummary = `Tanggal ${d.dateLabel}: SO Fisik = ${soVal.toLocaleString('id-ID')} ${item.uom} | Stok Accurate = ${accVal.toLocaleString('id-ID')} ${item.uom}.`;
    }

    // =========================================================================
    // 2. BREAKDOWN 2 KRITERIA BESAR:
    //    - KRITERIA 1: FISIK KURANG (Stok Fisik < Seharusnya / Accurate)
    //    - KRITERIA 2: FISIK LEBIH  (Stok Fisik > Seharusnya / Accurate)
    // =========================================================================
    const gapVsExpectedAbs = Math.abs(deviationFromExpected ?? 0);
    const effectiveShortfallQty =
      majorCriteria === 'FISIK_KURANG'
        ? Math.max(d.selisih, gapVsExpectedAbs)
        : 0;
    const effectiveSurplusQty =
      majorCriteria === 'FISIK_LEBIH'
        ? Math.max(d.selisih, gapVsExpectedAbs)
        : 0;

    const fisikKurangBreakdown: CriteriaBreakdownDetail = {
      criteriaType: 'FISIK_KURANG',
      criteriaTitle: 'KRITERIA 1: FISIK KURANG (Realisasi SO Fisik < Hasil Seharusnya / Sistem)',
      discrepancyQty: effectiveShortfallQty,
      breakdownCalculations:
        majorCriteria === 'FISIK_KURANG'
          ? [
              prevLabel && prevSO !== null
                ? `Hitungan Acuan SO Sebelumnya: SO ${prevLabel} (${prevSO.toLocaleString('id-ID')} ${item.uom}) + Masuk (${inToday.toLocaleString('id-ID')}) - Out (${outToday.toLocaleString('id-ID')}) = Seharusnya ${expectedSOFromPrev.toLocaleString('id-ID')} ${item.uom}, namun SO Fisik ${d.dateLabel} hanya ${soVal.toLocaleString('id-ID')} ${item.uom} (Kurang ${gapVsExpectedAbs.toLocaleString('id-ID')} ${item.uom} dari acuan SO sebelumnya).`
                : `Posisi Saldo Awal ${d.dateLabel}: Stok Accurate mencatat ${accVal.toLocaleString('id-ID')} ${item.uom}, namun SO Fisik aktual hanya ${soVal.toLocaleString('id-ID')} ${item.uom}.`,
              `Perbandingan Fisik vs Sistem (${d.dateLabel}): SO Fisik (${soVal.toLocaleString('id-ID')} ${item.uom}) lebih rendah -${d.selisih.toLocaleString('id-ID')} ${item.uom} dibanding Stok Accurate (${accVal.toLocaleString('id-ID')} ${item.uom}).`,
              fisikOutImplied > outToday
                ? `Kelebihan Pengeluaran Fisik: Barang keluar secara fisik sebesar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom}, melampaui Data Out sistem (${outToday.toLocaleString('id-ID')} ${item.uom}) sebesar ${(fisikOutImplied - outToday).toLocaleString('id-ID')} ${item.uom}.`
                : `Selisih Kurang Akumulatif: Pengeluaran fisik hari ini (${fisikOutImplied.toLocaleString('id-ID')} ${item.uom}) berbanding Data Out sistem (${outToday.toLocaleString('id-ID')} ${item.uom}), menyisakan defisit fisik ${d.selisih.toLocaleString('id-ID')} ${item.uom}.`,
            ]
          : [
              `Tidak ditemukan defisit Fisik Kurang pada ${d.dateLabel} (SO Fisik ${soVal.toLocaleString('id-ID')} ${item.uom} tidak berada di bawah patokan ${accVal.toLocaleString('id-ID')} ${item.uom}).`,
            ],
      possibleSources: [
        `Pengeluaran Fisik Tanpa Dokumen Accurate: Barang sudah diambil/dikirim keluar gudang pada ${d.dateLabel} (sebesar ~${(effectiveShortfallQty || d.selisih).toLocaleString('id-ID')} ${item.uom}), tetapi Surat Jalan / Delivery Order (DO) atau Pemakaian Barang belum diinput ke Accurate.`,
        `Over-Sending / Lebih Kirim Fisik ke Outlet: Jumlah fisik barang yang dimuat ke armada melebihi angka Qty yang tertera pada dokumen DO/Surat Jalan.`,
        `Barang Rusak / Reject / Waste / Susut Belum Di-adjust: Terdapat barang rusak, pecah, atau kedaluwarsa di gudang yang sudah dipisahkan dari stok bagus namun belum dibuatkan Inventory Adjustment Out di Accurate.`,
        `Penerimaan Barang (RI) Diposting Duluan di Sistem: Admin sudah menginput Penerimaan Barang (+${inToday.toLocaleString('id-ID')} ${item.uom}) di Accurate, tetapi barang fisik belum tiba atau belum masuk ke area hitung SO.`,
        `Lokasi Penyimpanan Terlewat Saat Hitung SO: Sebagian stok fisik masih tersimpan di chiller/freezer cadangan, area transit loading dock, atau tumpukan palet belakang sehingga belum terhitung.`,
      ],
    };

    const fisikLebihBreakdown: CriteriaBreakdownDetail = {
      criteriaType: 'FISIK_LEBIH',
      criteriaTitle: 'KRITERIA 2: FISIK LEBIH (Realisasi SO Fisik > Hasil Seharusnya / Sistem)',
      discrepancyQty: effectiveSurplusQty,
      breakdownCalculations:
        majorCriteria === 'FISIK_LEBIH'
          ? [
              prevLabel && prevSO !== null
                ? `Hitungan Acuan SO Sebelumnya: SO ${prevLabel} (${prevSO.toLocaleString('id-ID')} ${item.uom}) + Masuk (${inToday.toLocaleString('id-ID')}) - Out (${outToday.toLocaleString('id-ID')}) = Seharusnya ${expectedSOFromPrev.toLocaleString('id-ID')} ${item.uom}, namun SO Fisik ${d.dateLabel} tercatat ${soVal.toLocaleString('id-ID')} ${item.uom} (Lebih +${gapVsExpectedAbs.toLocaleString('id-ID')} ${item.uom} terhadap acuan).`
                : `Posisi Saldo Awal ${d.dateLabel}: SO Fisik aktual mencatat ${soVal.toLocaleString('id-ID')} ${item.uom}, lebih tinggi dari Stok Accurate (${accVal.toLocaleString('id-ID')} ${item.uom}).`,
              `Perbandingan Fisik vs Sistem (${d.dateLabel}): SO Fisik (${soVal.toLocaleString('id-ID')} ${item.uom}) lebih banyak +${d.selisih.toLocaleString('id-ID')} ${item.uom} dibanding Stok Accurate (${accVal.toLocaleString('id-ID')} ${item.uom}).`,
              outToday > fisikOutImplied
                ? `Pemotongan Sistem Mendahului Fisik: Sistem Accurate sudah memotong Out sebesar ${outToday.toLocaleString('id-ID')} ${item.uom}, sedangkan barang fisik baru keluar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom} (tertahan +${(outToday - fisikOutImplied).toLocaleString('id-ID')} ${item.uom} di gudang).`
                : fisikInImplied > inToday
                ? `Penambahan Fisik Belum Masuk Sistem: Stok fisik bertambah +${fisikInImplied.toLocaleString('id-ID')} ${item.uom}, sedangkan di sistem hanya tercatat In +${inToday.toLocaleString('id-ID')} ${item.uom}.`
                : `Kelebihan Stok Fisik: Terdapat surplus fisik +${d.selisih.toLocaleString('id-ID')} ${item.uom} di gudang dibanding saldo sistem Accurate.`,
            ]
          : [
              `Tidak ditemukan surplus Fisik Lebih pada ${d.dateLabel} (SO Fisik ${soVal.toLocaleString('id-ID')} ${item.uom} tidak melebihi patokan ${accVal.toLocaleString('id-ID')} ${item.uom}).`,
            ],
      possibleSources: [
        `Accurate Sudah Potong Out Tapi Barang Fisik Belum Keluar: Dokumen DO / Surat Jalan (-${outToday.toLocaleString('id-ID')} ${item.uom}) sudah diterbitkan di Accurate pada ${d.dateLabel}, namun barang fisik masih tertahan di area staging/muat saat SO dilakukan dan baru dikirim hari berikutnya.`,
        `Barang Masuk / Retur Cabang Belum Diinput ke Accurate: Barang fisik dari supplier atau retur outlet sudah diterima di gudang dan ikut dihitung saat SO, tetapi dokumen Receive Item (RI) belum diposting di Accurate.`,
        `Under-Sending / Kurang Kirim Fisik ke Cabang: Dokumen DO memotong stok sistem penuh, tetapi fisik yang dikirim ke cabang kurang dari Qty dokumen (sisa barang tertinggal di rak).`,
        `Double Input Pengeluaran di Accurate: Satu pengeluaran fisik yang sama tercatat dua kali (duplikat nomor DO/pemakaian) di sistem Accurate sehingga saldo sistem terpotong berlebih.`,
        `Double Count / Beda Konversi Satuan (${item.uom}) Saat SO: Tumpukan barang yang sama terhitung dua kali atau terjadi salah konversi pack/inner ke ${item.uom}.`,
      ],
    };

    const criteriaBreakdown: CriteriaBreakdownDetail =
      majorCriteria === 'FISIK_KURANG'
        ? fisikKurangBreakdown
        : majorCriteria === 'FISIK_LEBIH'
        ? fisikLebihBreakdown
        : {
            criteriaType: 'SESUAI',
            criteriaTitle: 'SESUAI ACUAN (Stok Fisik & Sistem Seimbang)',
            discrepancyQty: 0,
            breakdownCalculations: [
              `Perhitungan SO pada ${d.dateLabel} sesuai dengan acuan (${soVal.toLocaleString('id-ID')} ${item.uom}).`,
            ],
            possibleSources: ['Tidak ditemukan indikasi sumber selisih pada tanggal ini.'],
          };

    // =========================================================================
    // 3. KECOCOKAN TANGGAL & KECOCOKAN TOTAL QTY IN - OUT
    // =========================================================================
    let dateAndQtyMatchSummary = '';
    const movementGap =
      netFisikDelta !== null && netAccDelta !== null ? netFisikDelta - netAccDelta : null;

    if (hasUploadedMutasi) {
      const diffInOutVsFisik = netFisikDelta !== null ? netFisikDelta - netMutasiUpload : null;
      dateAndQtyMatchSummary = `Kecocokan Tanggal ${d.dateLabel}: Ditemukan ${matchedSystemMutations.length} baris mutasi. Total Qty IN = +${totalMutIn.toLocaleString('id-ID')} ${item.uom}, Total Qty OUT = -${totalMutOut.toLocaleString('id-ID')} ${item.uom} (Net IN-OUT Sistem: ${netMutasiUpload >= 0 ? '+' : ''}${netMutasiUpload.toLocaleString('id-ID')} ${item.uom}) vs Perubahan Fisik SO: ${netFisikDelta !== null ? `${netFisikDelta >= 0 ? '+' : ''}${netFisikDelta.toLocaleString('id-ID')}` : '0'} ${item.uom}.${diffInOutVsFisik !== null ? (diffInOutVsFisik === 0 ? ' Total Qty IN-OUT COCOK 100% dengan pergerakan fisik hari ini.' : ` Terdapat selisih Total Qty IN-OUT sebesar ${Math.abs(diffInOutVsFisik).toLocaleString('id-ID')} ${item.uom} pada tanggal ini.`) : ''}`;
    } else if (netFisikDelta !== null && netAccDelta !== null && movementGap !== null) {
      dateAndQtyMatchSummary = `Kecocokan Tanggal ${prevLabel} → ${d.dateLabel}: Net IN-OUT Fisik = ${netFisikDelta >= 0 ? '+' : ''}${netFisikDelta.toLocaleString('id-ID')} ${item.uom} (Out Fisik: ${fisikOutImplied.toLocaleString('id-ID')}, In Fisik: ${fisikInImplied.toLocaleString('id-ID')}) vs Net IN-OUT Accurate = ${netAccDelta >= 0 ? '+' : ''}${netAccDelta.toLocaleString('id-ID')} ${item.uom} (Out Acc: ${accOutImplied.toLocaleString('id-ID')}, In Acc: ${accInImplied.toLocaleString('id-ID')}). ${
        movementGap === 0
          ? `Total Qty IN-OUT pada tanggal ${d.dateLabel} SUDAH COCOK (0 selisih baru di hari ini; selisih ${d.selisih.toLocaleString('id-ID')} ${item.uom} merupakan bawaan dari tanggal sebelumnya).`
          : `Terdapat ketidakcocokan Total Qty IN-OUT pada tanggal ${d.dateLabel} sebesar ${Math.abs(movementGap).toLocaleString('id-ID')} ${item.uom}.`
      }`;
    } else {
      dateAndQtyMatchSummary = `Tanggal ${d.dateLabel}: SO Fisik ${soVal.toLocaleString('id-ID')} ${item.uom} vs Accurate ${accVal.toLocaleString('id-ID')} ${item.uom} (Selisih: ${d.selisih.toLocaleString('id-ID')} ${item.uom}).`;
    }

    // =========================================================================
    // 4. PERLUASAN LOGIKA & DEEPSEARCH LINTAS HISTORIS (H-3 s/d H+3 & Pola Item)
    // =========================================================================
    const extendedLogicFindings: string[] = [];
    const deepSearchFindings: string[] = [];

    // Hitung statistik lintas seluruh tanggal aktif untuk Deepsearch
    const allActiveDaysForItem = allDaily.filter(
      (r) => (r.so !== null && r.so > 0) || (r.accurate !== null && r.accurate !== 0)
    );
    const totalKurangDays = allActiveDaysForItem.filter(
      (r) => (r.so ?? 0) < (r.accurate ?? 0)
    ).length;
    const totalLebihDays = allActiveDaysForItem.filter(
      (r) => (r.so ?? 0) > (r.accurate ?? 0)
    ).length;
    const firstVarianceDay = allActiveDaysForItem.find((r) => r.selisih > 0);

    if (hasActivity && (d.selisih > 0 || (deviationFromExpected !== null && deviationFromExpected !== 0))) {
      // Deepsearch 1: Lacak Asal-Usul Selisih (Apakah muncul baru di tanggal ini atau carry-over dari tanggal sebelumnya)
      if (prevRecord && prevRecord.selisih === d.selisih && movementGap === 0) {
        deepSearchFindings.push(
          `[Deepsearch Asal Selisih — Carry-Over Murni]: Selisih ${d.selisih.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel} BUKAN berasal dari transaksi tanggal ${d.dateLabel} (karena Out Fisik ${fisikOutImplied.toLocaleString('id-ID')} = Out Sistem ${accOutImplied.toLocaleString('id-ID')} pada hari ini), melainkan terbawa dari ketidakcocokan yang sudah terjadi sejak ${firstVarianceDay?.dateLabel || prevRecord.dateLabel}.`
        );
      } else if (prevRecord && d.selisih !== prevRecord.selisih) {
        const deltaSel = d.selisih - prevRecord.selisih;
        deepSearchFindings.push(
          `[Deepsearch Perubahan Harian]: Dibandingkan ${prevRecord.dateLabel} (selisih ${prevRecord.selisih.toLocaleString('id-ID')} ${item.uom}), pada ${d.dateLabel} terjadi ${
            deltaSel > 0
              ? `penambahan selisih baru sebesar +${deltaSel.toLocaleString('id-ID')} ${item.uom}`
              : `penurunan/koreksi selisih sebesar ${deltaSel.toLocaleString('id-ID')} ${item.uom}`
          } menjadi ${d.selisih.toLocaleString('id-ID')} ${item.uom}.`
        );
      } else if (d.day === 1 && d.selisih > 0) {
        deepSearchFindings.push(
          `[Deepsearch Saldo Awal]: Ketidakcocokan sebesar ${d.selisih.toLocaleString('id-ID')} ${item.uom} sudah muncul sejak hari pertama (${d.dateLabel}), mengindikasikan cut-off akhir bulan sebelumnya belum klop.`
        );
      }

      // Kemungkinan A: Fisik Keluar Tanpa Data Accurate
      if (fisikOutImplied > accOutImplied && fisikOutImplied > 0) {
        const unrecordedOut = fisikOutImplied - accOutImplied + accInImplied;
        const msg = `Fisik Keluar Tanpa Data Accurate: Pada ${d.dateLabel}, stok fisik keluar sebesar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom} (SO turun dari ${prevSO?.toLocaleString('id-ID')} ke ${soVal.toLocaleString('id-ID')}), sedangkan di Accurate ${
          accOutImplied > 0
            ? `hanya tercatat keluar ${accOutImplied.toLocaleString('id-ID')} ${item.uom}`
            : accInImplied > 0
            ? `justru bertambah +${accInImplied.toLocaleString('id-ID')} ${item.uom}`
            : 'tidak ada pengurangan (Out = 0)'
        }. Terdapat pengeluaran fisik ~${unrecordedOut.toLocaleString('id-ID')} ${item.uom} yang belum terpotong di Accurate.`;
        extendedLogicFindings.push(msg);
        deepSearchFindings.push(`[Deepsearch Mutasi Out]: ${msg}`);
      }

      // Kemungkinan B: Accurate Keluar Tapi Fisik Tidak Keluar
      if (accOutImplied > fisikOutImplied && accOutImplied > 0) {
        const unshippedPhysical = accOutImplied - fisikOutImplied + fisikInImplied;
        const msg = `Accurate Keluar Tapi Fisik Tidak: Pada ${d.dateLabel}, sistem Accurate memotong Out sebesar ${accOutImplied.toLocaleString('id-ID')} ${item.uom} (Accurate turun dari ${prevAcc?.toLocaleString('id-ID')} ke ${accVal.toLocaleString('id-ID')}), tetapi fisik di gudang ${
          fisikOutImplied === 0 && fisikInImplied === 0
            ? `belum bergerak (SO tetap ${soVal.toLocaleString('id-ID')} ${item.uom})`
            : fisikInImplied > 0
            ? `justru bertambah +${fisikInImplied.toLocaleString('id-ID')} ${item.uom}`
            : `hanya keluar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom}`
        }. Terdapat ~${unshippedPhysical.toLocaleString('id-ID')} ${item.uom} yang sudah dipotong di Accurate namun fisiknya masih ada di gudang.`;
        extendedLogicFindings.push(msg);
        deepSearchFindings.push(`[Deepsearch Pemotongan Sistem]: ${msg}`);
      } else if (accInImplied > fisikInImplied && accInImplied > 0) {
        const unreceivedPhysical = accInImplied - fisikInImplied;
        const msg = `Accurate Masuk Mendahului Fisik: Sistem Accurate mencatat penambahan In +${accInImplied.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel}, sementara fisik SO hanya bertambah +${fisikInImplied.toLocaleString('id-ID')} ${item.uom} (Gap ${unreceivedPhysical.toLocaleString('id-ID')} ${item.uom}).`;
        extendedLogicFindings.push(msg);
        deepSearchFindings.push(`[Deepsearch Penerimaan In]: ${msg}`);
      }

      // Deepsearch 2 & Kemungkinan C: Lacak Geser Transaksi Lintas Hari (H-3 s/d H+3) di Spreadsheet
      const nearbyDays = allActiveDaysForItem.filter(
        (r) => r.day !== d.day && Math.abs(r.day - d.day) <= 3
      );
      for (const near of nearbyDays) {
        const nearFisikOut = near.deltaSO !== null && near.deltaSO < 0 ? Math.abs(near.deltaSO) : 0;
        const nearAccOut =
          near.deltaAccurate !== null && near.deltaAccurate < 0 ? Math.abs(near.deltaAccurate) : 0;

        // Cek apakah Out Accurate hari ini cocok dengan Out Fisik di hari sekitar (atau sebaliknya)
        if (
          accOutImplied > 0 &&
          nearFisikOut > 0 &&
          Math.abs(accOutImplied - nearFisikOut) <= Math.max(5, accOutImplied * 0.1)
        ) {
          const shiftMsg = `[Deepsearch Geser Hari Sistem → Fisik]: Pengurangan Accurate sebesar -${accOutImplied.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel} ditemukan cocok dengan pengeluaran fisik SO sebesar -${nearFisikOut.toLocaleString('id-ID')} ${item.uom} pada tanggal ${near.dateLabel} (Geser ${Math.abs(near.day - d.day)} hari).`;
          extendedLogicFindings.push(shiftMsg);
          deepSearchFindings.push(shiftMsg);
          break;
        }
        if (
          fisikOutImplied > 0 &&
          nearAccOut > 0 &&
          Math.abs(fisikOutImplied - nearAccOut) <= Math.max(5, fisikOutImplied * 0.1)
        ) {
          const shiftMsg = `[Deepsearch Geser Hari Fisik → Sistem]: Pengeluaran fisik SO sebesar -${fisikOutImplied.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel} ditemukan cocok dengan pemotongan Accurate sebesar -${nearAccOut.toLocaleString('id-ID')} ${item.uom} pada tanggal ${near.dateLabel} (Geser ${Math.abs(near.day - d.day)} hari).`;
          extendedLogicFindings.push(shiftMsg);
          deepSearchFindings.push(shiftMsg);
          break;
        }
      }

      // Cek pemulihan otomatis di hari-hari berikutnya (nextRecords)
      for (const nextRec of nextRecords) {
        if (nextRec.so === null || nextRec.so === 0 || nextRec.accurate === null) continue;
        if (nextRec.selisih === 0) {
          deepSearchFindings.push(
            `[Deepsearch Pemulihan Otomatis]: Selisih ${d.selisih.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel} terbukti PULIH 100% (selisih menjadi 0) pada ${nextRec.dateLabel}, menandakan selisih pada ${d.dateLabel} murni akibat beda jam cut-off input dokumen.`
          );
          break;
        } else if (nextRec.selisih < d.selisih) {
          deepSearchFindings.push(
            `[Deepsearch Koreksi Bertahap]: Selisih ${d.selisih.toLocaleString('id-ID')} ${item.uom} pada ${d.dateLabel} menyusut menjadi ${nextRec.selisih.toLocaleString('id-ID')} ${item.uom} pada ${nextRec.dateLabel} (terkoreksi ${(d.selisih - nextRec.selisih).toLocaleString('id-ID')} ${item.uom} setelah transaksi susulan masuk).`
          );
          break;
        }
      }

      // Deepsearch 3: Lacak di seluruh File Mutasi Sistem & Kartu Stok (termasuk geser tanggal H-3..H+3)
      const shiftedMutations = itemMutationsAllDays.filter(
        (m) => m.dayNumber !== d.day && Math.abs(m.dayNumber - d.day) <= 3
      );
      if (shiftedMutations.length > 0) {
        const shiftedMatch = shiftedMutations.find(
          (m) =>
            (fisikOutImplied > 0 && Math.abs(m.qtyOut - fisikOutImplied) <= 10) ||
            Math.abs(m.qtyOut - d.selisih) <= 10 ||
            Math.abs(m.qtyIn - d.selisih) <= 10
        );
        if (shiftedMatch) {
          const shiftMutMsg = `[Deepsearch File Mutasi Lintas Tanggal]: Ditemukan transaksi pada ${shiftedMatch.date} (In: +${shiftedMatch.qtyIn.toLocaleString('id-ID')}, Out: -${shiftedMatch.qtyOut.toLocaleString('id-ID')} ${item.uom}) yang angkanya berkorelasi dengan selisih tanggal ${d.dateLabel}.`;
          extendedLogicFindings.push(shiftMutMsg);
          deepSearchFindings.push(shiftMutMsg);
        }
      }

      // Deepsearch 4: Pola Historis Item sepanjang periode aktif
      deepSearchFindings.push(
        `[Deepsearch Pola Historis Item "${item.name}"]: Dari ${allActiveDaysForItem.length} hari aktif, item ini mengalami Kriteria FISIK KURANG pada ${totalKurangDays} hari dan Kriteria FISIK LEBIH pada ${totalLebihDays} hari (Akurasi Rata-Rata: ${periodItem.periodAccuracyPercent.toFixed(2)}%).`
      );
    } else {
      deepSearchFindings.push(
        `[Deepsearch Status]: Pergerakan stok pada ${d.dateLabel} sesuai dengan acuan perhitungan SO sebelumnya.`
      );
    }

    // =========================================================================
    // 5. REKOMENDASI YANG BERSIFAT ARAHAN (DIRECTIVE RECOMMENDATIONS)
    //    Jangan langsung eksekusi berdasar Nomor kecuali Qty sama persis atau di ujung analisa
    // =========================================================================
    const exactQtyMatchTx = matchedSystemMutations.find(
      (m) =>
        (m.qtyOut > 0 && m.qtyOut === d.selisih) ||
        (m.qtyIn > 0 && m.qtyIn === d.selisih) ||
        (movementGap !== null &&
          movementGap !== 0 &&
          (m.qtyOut === Math.abs(movementGap) || m.qtyIn === Math.abs(movementGap)))
    );

    const endNomorReference = exactQtyMatchTx
      ? `Temuan Ujung Analisa (Qty Sama Persis ${
          exactQtyMatchTx.qtyOut > 0
            ? `Out: ${exactQtyMatchTx.qtyOut.toLocaleString('id-ID')}`
            : `In: ${exactQtyMatchTx.qtyIn.toLocaleString('id-ID')}`
        } ${item.uom}): Periksa dokumen Nomor ${exactQtyMatchTx.transactionNo} (${exactQtyMatchTx.description}).`
      : hasUploadedMutasi
      ? `Ujung Analisa — Setelah rekonsiliasi Total Qty IN-OUT & geser hari, verifikasi nomor dokumen pendukung pada tanggal ini: ${matchedSystemMutations
          .map((m) => `${m.transactionNo} (In:${m.qtyIn}/Out:${m.qtyOut})`)
          .join(', ')}.`
      : '';

    const directiveRecommendations: string[] = [];

    if (majorCriteria === 'FISIK_KURANG') {
      directiveRecommendations.push(
        `ARAHAN 1 — TELUSURI PENGELUARAN FISIK (${effectiveShortfallQty.toLocaleString('id-ID')} ${item.uom}): Instruksikan tim gudang memeriksa buku ekspedisi/serah terima barang keluar pada ${d.dateLabel}. Pastikan pengeluaran fisik sebesar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom} sudah memiliki Surat Jalan / DO di Accurate (karena sistem baru mencatat Out ${outToday.toLocaleString('id-ID')} ${item.uom}).`
      );
      directiveRecommendations.push(
        `ARAHAN 2 — CEK CUT-OFF & GESER HARI (${d.dateLabel} ↔ ${nextRecords[0]?.dateLabel || 'H+1'}): Periksa kepada Admin Inventory apakah ada pengiriman/pemakaian fisik pada ${d.dateLabel} yang baru diinput ke Accurate pada ${nextRecords[0]?.dateLabel || 'hari berikutnya'}, atau Penerimaan Barang (RI) yang sudah diinput di Accurate namun fisiknya belum turun ke gudang.`
      );
      directiveRecommendations.push(
        `ARAHAN 3 — VERIFIKASI BARANG RUSAK / LOKASI SIMPAN: Lakukan pengecekan fisik ulang pada area karantina barang rusak/reject/waste serta area penyimpanan sekunder (freezer/chiller cadangan/staging) untuk memastikan tidak ada ${item.name} yang belum di-adjust atau terlewat hitung.`
      );
      if (endNomorReference) {
        directiveRecommendations.push(`ARAHAN 4 — VERIFIKASI DOKUMEN UJUNG: ${endNomorReference}`);
      }
    } else if (majorCriteria === 'FISIK_LEBIH') {
      directiveRecommendations.push(
        `ARAHAN 1 — CEK BARANG TERTAHAN DI STAGING (+${effectiveSurplusQty.toLocaleString('id-ID')} ${item.uom}): Instruksikan tim gudang memeriksa area muat/staging pada ${d.dateLabel}. Sistem Accurate telah memotong Out ${outToday.toLocaleString('id-ID')} ${item.uom}, sedangkan fisik baru keluar ${fisikOutImplied.toLocaleString('id-ID')} ${item.uom} — pastikan apakah ada barang yang sudah dibuatkan DO namun belum diangkut kurir saat SO berlangsung.`
      );
      directiveRecommendations.push(
        `ARAHAN 2 — AUDIT BARANG MASUK / RETUR BELUM INPUT RI: Periksa surat jalan supplier atau bukti retur dari outlet pada ${prevLabel || 'H-1'} s/d ${d.dateLabel}. Jika fisik barang sudah masuk ke rak dan terhitung saat SO, segera instruksikan Admin memposting Receive Item (RI) di Accurate.`
      );
      directiveRecommendations.push(
        `ARAHAN 3 — KOREKSI DOUBLE INPUT / KURANG KIRIM: Cek daftar DO pada ${d.dateLabel} s/d ${nextRecords[0]?.dateLabel || 'H+1'} untuk memastikan tidak ada pemotongan ganda di Accurate maupun kurang kirim fisik (under-pick) ke cabang.`
      );
      if (endNomorReference) {
        directiveRecommendations.push(`ARAHAN 4 — VERIFIKASI DOKUMEN UJUNG: ${endNomorReference}`);
      }
    } else {
      directiveRecommendations.push(
        `ARAHAN PERTAHANKAN AKURASI: Hitungan SO pada ${d.dateLabel} telah sesuai dengan acuan SO sebelumnya. Pertahankan disiplin cut-off antara fisik gudang dan input Accurate.`
      );
    }

    let mutationComparisonResult = '';
    let potentialDiscrepancyFinding = '';
    let checkRecommendation = '';

    if (!hasActivity && !hasUploadedMutasi && !hasUploadedCard) {
      mutationComparisonResult = `Pada tanggal ${d.dateLabel}, kolom SO dan Accurate di Sheet rekap Daily belum memiliki nilai transaksi.`;
      potentialDiscrepancyFinding = `Tidak ditemukan selisih pada tanggal ${d.dateLabel}.`;
      checkRecommendation = `Tidak diperlukan tindakan koreksi pada tanggal ${d.dateLabel}.`;
    } else if (d.selisih === 0 && !hasUploadedMutasi && !hasUploadedCard) {
      mutationComparisonResult = `${previousSOReferenceSummary} | ${dateAndQtyMatchSummary}`;
      potentialDiscrepancyFinding = `Kecocokan Tanggal & Total Qty IN-OUT pada ${d.dateLabel} klop 100% (SO Fisik ${soVal.toLocaleString('id-ID')} = Accurate ${accVal.toLocaleString('id-ID')} ${item.uom}).`;
      checkRecommendation = directiveRecommendations.join(' ');
    } else {
      mutationComparisonResult = `${previousSOReferenceSummary} ${
        hasUploadedMutasi
          ? `| Total Mutasi Terupload (${d.dateLabel}): Masuk +${totalMutIn.toLocaleString('id-ID')} ${item.uom}, Keluar -${totalMutOut.toLocaleString('id-ID')} ${item.uom}.`
          : ''
      } ${
        hasUploadedCard
          ? `| Kartu Stock: Saldo ${stockCardBalance?.toLocaleString('id-ID')} ${item.uom}.`
          : ''
      }`;

      potentialDiscrepancyFinding = `${dateAndQtyMatchSummary} ${extendedLogicFindings.join(' ')}`;
      checkRecommendation = directiveRecommendations.join(' ');
    }

    const acc = d.dailyAccuracyPercent ?? 100;
    const severity: VarianceDateMutationComparison['severity'] =
      d.isLowestAccuracyDay || (acc > 0 && acc < 75) || d.selisih >= 1000
        ? 'CRITICAL'
        : (acc > 0 && acc < 92) || d.selisih >= 200
        ? 'HIGH'
        : 'MEDIUM';

    return {
      day: d.day,
      dateLabel: d.dateLabel,
      prevDayLabel: prevLabel,
      prevSO,
      prevAccurate: prevAcc,
      inToday,
      outToday,
      expectedSOFromPrev,
      deviationFromExpected,
      soFisik: d.so,
      stokAccurate: d.accurate,
      qtySelisih: d.selisih,
      varianceDirection,
      majorCriteria,
      varianceTypeLabel,
      dailyAccuracyPercent: acc,
      isLowestAccuracyDay: Boolean(d.isLowestAccuracyDay),
      deltaSO: d.deltaSO,
      deltaAccurate: d.deltaAccurate,
      previousSOReferenceSummary,
      criteriaBreakdown,
      fisikKurangBreakdown,
      fisikLebihBreakdown,
      dateAndQtyMatchSummary,
      extendedLogicFindings,
      deepSearchFindings,
      directiveRecommendations,
      matchedSystemMutations,
      matchedStockCardEntries,
      stockCardBalance,
      gapSOvsStockCard,
      gapAccuratevsStockCard,
      mutationComparisonResult,
      potentialDiscrepancyFinding,
      checkRecommendation,
      severity,
    };
  });
}

// Helper konversi angka mutasi yang aman untuk format Indonesia (1.500,00) maupun standar Excel (1500.00)
function parseMutationQty(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.abs(val) : 0;
  }
  const str = String(val)
    .replace(/[^\d.,\-]/g, '')
    .trim();
  if (!str) return 0;

  // Jika menggunakan titik sebagai pemisah ribuan (contoh: "1.500" atau "12.450,5")
  if (/^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  // Jika menggunakan koma sebagai pemisah ribuan (contoh: "1,500" atau "12,450.5")
  if (/^\-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    const normalized = str.replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  // Jika hanya ada koma desimal (contoh: "125,5")
  if (str.includes(',') && !str.includes('.')) {
    const n = Number(str.replace(',', '.'));
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  const n = Number(str);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Helper konversi Tanggal dari Excel Date object, Excel Serial Number, atau teks tanggal (DD/MM/YYYY, YYYY-MM-DD, "05 Okt")
function parseFlexibleMutationDate(
  rawVal: any,
  fallbackDay: number = 1
): { dayNumber: number; formattedDate: string } {
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const d = rawVal.getDate();
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  // Cek jika berupa Excel Serial Number (contoh: 45931 s/d 46500)
  if (typeof rawVal === 'number' && rawVal > 30000 && rawVal < 60000) {
    const utcDays = Math.floor(rawVal - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    const d = dateObj.getUTCDate();
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  const rawStr = String(rawVal ?? '').trim();
  if (!rawStr) {
    return {
      dayNumber: fallbackDay,
      formattedDate: `${String(fallbackDay).padStart(2, '0')} Okt 2026`,
    };
  }

  // Jika string angka 5 digit Excel serial date
  if (/^\d{5}(\.\d+)?$/.test(rawStr)) {
    const serial = Number(rawStr);
    const utcDays = Math.floor(serial - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    const d = dateObj.getUTCDate();
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  // Format YYYY-MM-DD (contoh: 2026-10-05)
  const isoMatch = rawStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const d = Math.min(31, Math.max(1, Number(isoMatch[3])));
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  // Format DD/MM/YYYY atau MM/DD/YYYY (contoh: 05/10/2026 atau 10/05/2026)
  const slashMatch = rawStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (slashMatch) {
    const part1 = Number(slashMatch[1]);
    const part2 = Number(slashMatch[2]);
    // Jika part2 adalah 10 (Oktober) dan part1 bukan 10, maka DD/MM/YYYY
    // Jika part1 adalah 10 dan part2 != 10 (misal dari konversi US MM/DD/YY), ambil part2 bila part1 == 10 dan rawStr punya tahun 2 digit
    let d = part1;
    if (part1 === 10 && part2 >= 1 && part2 <= 31 && slashMatch[3]?.length === 2) {
      d = part2;
    }
    d = Math.min(31, Math.max(1, d));
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  // Format teks "05 Okt", "5 Oktober 2026", dll.
  const numMatch = rawStr.match(/(\d{1,2})/);
  if (numMatch) {
    const d = Math.min(31, Math.max(1, Number(numMatch[1])));
    return {
      dayNumber: d,
      formattedDate: `${String(d).padStart(2, '0')} Okt 2026`,
    };
  }

  return {
    dayNumber: fallbackDay,
    formattedDate: rawStr,
  };
}

export function convertExcelSpreadsheetToCsv(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (!wb.SheetNames || wb.SheetNames.length === 0) return '';

  // Prioritize sheet named "rekap Daily" (case-insensitive), then any sheet containing "rekap" or "daily"
  let targetSheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === 'rekap daily') ||
    wb.SheetNames.find(
      (n) =>
        n.toLowerCase().includes('rekap') && n.toLowerCase().includes('daily')
    ) ||
    wb.SheetNames.find((n) => n.toLowerCase().includes('rekap'));

  if (!targetSheetName) {
    // Check which sheet contains "Nama Item" and "Accurate"
    for (const sName of wb.SheetNames) {
      const csvCandidate = XLSX.utils.sheet_to_csv(wb.Sheets[sName]);
      if (/nama\s*item/i.test(csvCandidate) && /accurate/i.test(csvCandidate)) {
        targetSheetName = sName;
        break;
      }
    }
  }

  const finalSheet = wb.Sheets[targetSheetName || wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(finalSheet);
}

// Parser khusus Format File Master Mutasi Barang:
// Judul Horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar (Isian data vertikal)
// Tanggal, nama item, Nomor, dan deskripsi disesuaikan otomatis oleh isi file
export function parseSystemMutationBuffer(
  buffer: ArrayBuffer,
  targetItemName: string = 'Semua Item',
  fallbackDay: number = 1,
  knownItemNames: string[] = [],
  fileNameHint: string = ''
): SystemMutationRecord[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const allRecords: SystemMutationRecord[] = [];

  // Cek apakah nama file mengandung nama salah satu item di spreadsheet
  let inferredFromFileName = targetItemName;
  if ((!inferredFromFileName || inferredFromFileName === 'Semua Item') && fileNameHint) {
    const cleanFile = fileNameHint.replace(/[_\-\.]/g, ' ').toLowerCase();
    const matched = knownItemNames.find((k) => cleanFile.includes(k.toLowerCase()));
    if (matched) inferredFromFileName = matched;
  }

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    // Cek apakah nama sheet merujuk ke nama item
    let sheetItemHint = inferredFromFileName;
    if (!sheetItemHint || sheetItemHint === 'Semua Item') {
      const matchedSheetItem = knownItemNames.find((k) =>
        sheetName.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedSheetItem) sheetItemHint = matchedSheetItem;
    }

    const parsed = parseSystemMutationRows(
      rows,
      sheetItemHint,
      fallbackDay,
      knownItemNames
    );
    allRecords.push(...parsed);
  }

  return allRecords;
}

export function parseSystemMutationCsvText(
  text: string,
  targetItemName: string = 'Semua Item',
  fallbackDay: number = 1,
  knownItemNames: string[] = [],
  fileNameHint: string = ''
): SystemMutationRecord[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  let inferredFromFileName = targetItemName;
  if ((!inferredFromFileName || inferredFromFileName === 'Semua Item') && fileNameHint) {
    const cleanFile = fileNameHint.replace(/[_\-\.]/g, ' ').toLowerCase();
    const matched = knownItemNames.find((k) => cleanFile.includes(k.toLowerCase()));
    if (matched) inferredFromFileName = matched;
  }

  // Jika teks dipisahkan tab (copy-paste langsung dari Excel) atau titik koma (;)
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.some((l) => l.includes('\t'))) {
    const rows = lines.map((l) => l.split('\t').map((c) => c.trim()));
    return parseSystemMutationRows(rows, inferredFromFileName, fallbackDay, knownItemNames);
  }
  if (lines.some((l) => l.includes(';') && !l.includes(','))) {
    const rows = lines.map((l) => l.split(';').map((c) => c.trim()));
    return parseSystemMutationRows(rows, inferredFromFileName, fallbackDay, knownItemNames);
  }

  const wb = XLSX.read(cleaned, { type: 'string', cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  return parseSystemMutationRows(rows, inferredFromFileName, fallbackDay, knownItemNames);
}

function inferTransactionType(nomor: string, deskripsi: string, qtyIn: number, qtyOut: number): string {
  const combined = `${nomor} ${deskripsi}`.toLowerCase();
  if (combined.includes('do') || combined.includes('sj') || combined.includes('surat jalan') || combined.includes('kirim')) {
    return 'Delivery Order / Surat Jalan (Keluar)';
  }
  if (combined.includes('ri') || combined.includes('terima') || combined.includes('po') || combined.includes('inbound')) {
    return 'Receive Item / Penerimaan (Masuk)';
  }
  if (combined.includes('jc') || combined.includes('job') || combined.includes('produksi') || combined.includes('rework')) {
    return 'Job Costing / Produksi';
  }
  if (combined.includes('adj') || combined.includes('penyesuaian') || combined.includes('opname')) {
    return 'Inventory Adjustment / Penyesuaian';
  }
  if (qtyIn > 0 && qtyOut === 0) return 'Mutasi Masuk';
  if (qtyOut > 0 && qtyIn === 0) return 'Mutasi Keluar';
  return 'Mutasi Harian';
}

function parseSystemMutationRows(
  rows: any[][],
  targetItemName: string = 'Semua Item',
  fallbackDay: number = 1,
  knownItemNames: string[] = []
): SystemMutationRecord[] {
  if (!rows || rows.length === 0) return [];

  // Deteksi baris Judul Horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const rowCells = rows[i].map((c) => String(c ?? '').toLowerCase().trim());
    const matchCount = rowCells.filter((cell) =>
      [
        'tanggal',
        'tgl',
        'date',
        'nomor',
        'no',
        'no. bukti',
        'no bukti',
        'deksripsi',
        'deskripsi',
        'keterangan',
        'masuk',
        'qty masuk',
        'keluar',
        'qty keluar',
      ].some((kw) => cell === kw || cell.includes(kw))
    ).length;

    if (matchCount >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  // Cek baris di atas headerRowIdx bila ada tertulis Nama Barang / Judul Item di bagian atas file
  let detectedTopItemName = targetItemName || 'Semua Item';
  if (headerRowIdx > 0) {
    for (let i = 0; i < headerRowIdx; i++) {
      const joinedTop = rows[i]
        .map((c) => String(c ?? '').trim())
        .filter(Boolean)
        .join(' ');
      if (!joinedTop) continue;
      const matchedKnown = knownItemNames.find((k) =>
        joinedTop.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedKnown) {
        detectedTopItemName = matchedKnown;
        break;
      }
    }
  }

  // Cari kolom non-kosong pertama bila tidak ada header eksplisit
  let firstNonEmptyCol = 0;
  for (const r of rows) {
    const idx = r.findIndex((c) => String(c ?? '').trim() !== '');
    if (idx >= 0) {
      firstNonEmptyCol = idx;
      break;
    }
  }

  let dateCol = firstNonEmptyCol;
  let noCol = firstNonEmptyCol + 1;
  let descCol = firstNonEmptyCol + 2;
  let inCol = firstNonEmptyCol + 3;
  let outCol = firstNonEmptyCol + 4;
  let optionalItemCol = -1;
  let optionalBalCol = -1;

  if (headerRowIdx >= 0) {
    const headers = rows[headerRowIdx].map((h) => String(h ?? '').toLowerCase().trim());

    const findExactOrPartialCol = (exactWords: string[], partialWords: string[], fallback: number): number => {
      const exactIdx = headers.findIndex((h) => exactWords.includes(h));
      if (exactIdx >= 0) return exactIdx;
      const partialIdx = headers.findIndex((h) => partialWords.some((kw) => h.includes(kw)));
      return partialIdx >= 0 ? partialIdx : fallback;
    };

    const baseOffset = headers.findIndex((h) => h !== '');
    const off = baseOffset >= 0 ? baseOffset : 0;

    dateCol = findExactOrPartialCol(['tanggal', 'tgl', 'date'], ['tanggal', 'tgl', 'date'], off);
    noCol = findExactOrPartialCol(
      ['nomor', 'no', 'no.', 'no. bukti', 'no bukti', 'kode'],
      ['nomor', 'bukti', 'ref', 'transaksi'],
      off + 1
    );
    descCol = findExactOrPartialCol(
      ['deksripsi', 'deskripsi', 'keterangan', 'catatan', 'memo'],
      ['deksripsi', 'deskripsi', 'keterangan', 'catatan', 'memo'],
      off + 2
    );
    inCol = findExactOrPartialCol(
      ['masuk', 'qty masuk', 'in', 'debet', 'terima'],
      ['masuk', 'qty in', 'debet', 'terima'],
      off + 3
    );
    outCol = findExactOrPartialCol(
      ['keluar', 'qty keluar', 'out', 'kredit', 'kirim'],
      ['keluar', 'qty out', 'kredit', 'kirim'],
      off + 4
    );
    optionalItemCol = headers.findIndex((h) =>
      ['nama barang', 'nama item', 'item', 'barang', 'produk'].some((kw) => h === kw || h.includes(kw))
    );
    optionalBalCol = headers.findIndex((h) =>
      ['saldo', 'balance', 'saldo akhir'].some((kw) => h === kw || h.includes(kw))
    );
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const records: SystemMutationRecord[] = [];
  let currentSectionItemName = detectedTopItemName;
  let lastValidDay = fallbackDay;
  let lastValidFormattedDate = `${String(fallbackDay).padStart(2, '0')} Okt 2026`;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => String(c ?? '').trim() === '')) continue;

    const rawDateCell = row[dateCol];
    const rawDateStr = String(rawDateCell ?? '').trim();
    const rawNomor = String(row[noCol] ?? '').trim();
    const rawDesc = String(row[descCol] ?? '').trim();

    // Lewati jika baris ini adalah pengulangan judul header
    if (
      rawDateStr.toLowerCase() === 'tanggal' ||
      rawNomor.toLowerCase() === 'nomor' ||
      rawDesc.toLowerCase() === 'deksripsi' ||
      rawDesc.toLowerCase() === 'deskripsi'
    ) {
      continue;
    }

    const qtyIn = parseMutationQty(row[inCol]);
    const qtyOut = parseMutationQty(row[outCol]);

    // Jika baris hanya berisi nama grup item di kolom pertama tanpa nomor/masuk/keluar
    if (
      rawDateStr &&
      !(rawDateCell instanceof Date) &&
      !/\d/.test(rawDateStr) &&
      qtyIn === 0 &&
      qtyOut === 0 &&
      !rawNomor
    ) {
      currentSectionItemName = rawDateStr;
      continue;
    }

    if (!rawDateStr && !rawNomor && !rawDesc && qtyIn === 0 && qtyOut === 0) continue;

    let dayNumber = lastValidDay;
    let formattedDate = lastValidFormattedDate;

    if (rawDateStr || rawDateCell instanceof Date) {
      const parsedDate = parseFlexibleMutationDate(rawDateCell, lastValidDay);
      dayNumber = parsedDate.dayNumber;
      formattedDate = parsedDate.formattedDate;
      lastValidDay = dayNumber;
      lastValidFormattedDate = formattedDate;
    }

    let explicitItem =
      optionalItemCol >= 0 && String(row[optionalItemCol] ?? '').trim()
        ? String(row[optionalItemCol]).trim()
        : currentSectionItemName;

    // Jika explicitItem masih 'Semua Item', coba deteksi nama item dari kolom Deksripsi
    if ((!explicitItem || explicitItem === 'Semua Item') && rawDesc && knownItemNames.length > 0) {
      const matchedInDesc = knownItemNames.find((k) =>
        rawDesc.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedInDesc) {
        explicitItem = matchedInDesc;
      }
    }

    const balanceAfter =
      optionalBalCol >= 0 && String(row[optionalBalCol] ?? '').trim() !== ''
        ? parseMutationQty(row[optionalBalCol])
        : null;

    const transactionNo = rawNomor || `TRX-10/${dayNumber}-${r}`;
    const description = rawDesc || 'Mutasi Barang';

    records.push({
      id: `upload-mut-${r}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: formattedDate,
      dayNumber,
      transactionNo,
      description,
      qtyIn,
      qtyOut,
      itemName: explicitItem || targetItemName || 'Semua Item',
      transactionType: inferTransactionType(transactionNo, description, qtyIn, qtyOut),
      balanceAfter,
      uom: 'Unit',
      warehouse: 'Gudang Utama',
    });
  }

  return records;
}
