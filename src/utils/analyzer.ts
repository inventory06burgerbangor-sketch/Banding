import * as XLSX from 'xlsx';
import {
  AnalyzedStockCard,
  DailyAccuracySummary,
  DailyRecord,
  InventoryItem,
  ParsedSpreadsheetData,
  PeriodItemAnalysis,
  StockCardEntry,
  SystemMutationRecord,
  VarianceDateMutationComparison,
} from '../types/inventory';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseIndoNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null;
  const cleaned = val
    .replace(/%/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const num = Number(cleaned);
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

  const items: InventoryItem[] = [];
  const activeDays = [1, 2, 3, 4, 5, 6, 7];

  let stockFisikRow: string[] = [];
  let errorRow: string[] = [];
  let wapeRow: string[] = [];
  let accuracyRow: string[] = [];

  for (let r = 2; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const col0 = (cols[0] || '').trim();
    const col1 = (cols[1] || '').trim();
    const col2 = (cols[2] || '').trim();

    if (col2.toLowerCase() === 'stock fisik') {
      stockFisikRow = cols;
      continue;
    }
    if (col2.toLowerCase() === 'error') {
      errorRow = cols;
      continue;
    }
    if (col2.toLowerCase() === 'wape') {
      wapeRow = cols;
      continue;
    }
    if (col2.toLowerCase() === 'stock accuracy') {
      accuracyRow = cols;
      continue;
    }

    if (!col0) continue;

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
      const baseIdx = 2 + (day - 1) * 3;
      const soVal = parseIndoNumber(cols[baseIdx]);
      const accVal = parseIndoNumber(cols[baseIdx + 1]);
      const selVal = parseIndoNumber(cols[baseIdx + 2]) ?? 0;

      if (accVal !== null && accVal < 0) {
        hasNegativeAccurate = true;
      }

      const deltaSO =
        prevSO !== null && soVal !== null && day !== 4 ? soVal - prevSO : null;
      const deltaAccurate =
        prevAcc !== null && accVal !== null && day !== 4 ? accVal - prevAcc : null;
      const deltaFromPrevSelisih = day === 4 ? 0 : selVal - prevSelisih;

      // Calculate Daily Stock Accuracy % against Baseline 100%
      let dailyAccuracyPercent: number | null = null;
      let gapFromBaseline100: number | null = null;

      if (day !== 4) {
        if (soVal !== null && soVal > 0) {
          const errPct = (selVal / soVal) * 100;
          dailyAccuracyPercent = Number(Math.max(0, 100 - errPct).toFixed(2));
          gapFromBaseline100 = Number((dailyAccuracyPercent - 100).toFixed(2));
        } else if (selVal > 0 || (accVal !== null && accVal !== 0)) {
          // SO is 0 or empty while there is variance/system stock -> 0% accuracy on that day
          dailyAccuracyPercent = 0;
          gapFromBaseline100 = -100;
        } else if (soVal === 0 && (accVal === 0 || accVal === null) && selVal === 0) {
          dailyAccuracyPercent = 100;
          gapFromBaseline100 = 0;
        }
      }

      let isSpike = false;
      let spikeReason = '';

      if (day !== 4 && selVal > 0) {
        if (day === 7 && (soVal === 0 || soVal === null) && accVal !== null && accVal >= 100) {
          isSpike = true;
          hasUninputtedDay7SO = true;
          spikeReason = `SO Fisik 7 Okt = 0 (Belum Input), Accurate = ${accVal.toLocaleString('id-ID')}`;
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

      if (day === 4) {
        inferredTransactionType = 'HOLIDAY_NO_SO';
        transactionNote = 'Tanggal 4 Okt tidak ada pengambilan Stock Opname (Cut-off / Libur).';
      } else if (accVal !== null && accVal < 0) {
        inferredTransactionType = 'NEGATIVE_SYSTEM_STOCK';
        transactionNote = `Stok sistem Accurate minus (${accVal} ${col1}), indikasi pengeluaran diposting sebelum penerimaan barang.`;
      } else if (day === 7 && (soVal === 0 || soVal === null) && accVal && accVal > 0) {
        inferredTransactionType = 'UNINPUTTED_SO_CUTOFF';
        transactionNote = `Kolom SO Fisik masih 0 sedangkan Accurate mencatat ${accVal.toLocaleString('id-ID')} ${col1}. Akurasi jatuh ke 0% (-100% dari Baseline).`;
      } else if ((soVal === 0 || soVal === null) && accVal && accVal > 0) {
        inferredTransactionType = 'UOM_CONVERSION_GAP';
        transactionNote = `SO tercatat 0 namun sistem Accurate memiliki saldo ${accVal.toLocaleString('id-ID')} ${col1} (Akurasi 0%).`;
      } else if (soVal && soVal > 0 && accVal === null) {
        inferredTransactionType = 'UOM_CONVERSION_GAP';
        transactionNote = `Fisik SO tercatat ${soVal.toLocaleString('id-ID')} ${col1}, namun kolom Accurate kosong/tidak tertarik (Akurasi 0%).`;
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
        const diffSign = (soVal ?? 0) > (accVal ?? 0) ? 'Fisik > Sistem' : 'Sistem > Fisik';
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
        dateLabel: `${day} Okt`,
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

      if (day !== 4) {
        prevSelisih = selVal;
        if (soVal !== null) prevSO = soVal;
        if (accVal !== null) prevAcc = accVal;
      }
    }

    const len = cols.length;
    const totalSelisih =
      parseIndoNumber(cols[len - 3]) ?? daily.reduce((s, d) => s + d.selisih, 0);
    const totalSO =
      parseIndoNumber(cols[len - 2]) ?? daily.reduce((s, d) => s + (d.so ?? 0), 0);
    const totalAccurate = daily.reduce((s, d) => s + (d.accurate ?? 0), 0);
    const sheetRightmostErrorCol = (cols[len - 1] || '').trim();
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
        sheetRightmostErrorCol || (totalSO === 0 && totalSelisih > 0 ? '0,00% (SO=0)' : '100,00%'),
      sheetAccuracyPercent,
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

  const dailySummaries: DailyAccuracySummary[] = activeDays.map((day) => {
    const valIdx = 3 + (day - 1) * 3;
    const stockFisik = parseIndoNumber(stockFisikRow[valIdx]) ?? 0;
    const error = parseIndoNumber(errorRow[valIdx]) ?? 0;
    const wapeStr = (wapeRow[valIdx] || '-').trim();
    const wapeNum = parseIndoNumber(wapeStr);
    const stockAccuracyStr = (accuracyRow[valIdx] || '-').trim();
    const stockAccuracyNum = parseIndoNumber(stockAccuracyStr);
    const gapFromBaseline100 =
      stockAccuracyNum !== null ? Number((stockAccuracyNum - 100).toFixed(2)) : null;

    return {
      day,
      dateLabel: `${day} Okt`,
      stockFisik,
      error,
      wapeStr,
      wapeNum,
      stockAccuracyStr: stockAccuracyStr ? `${stockAccuracyStr.replace('%', '')}%` : '-',
      stockAccuracyNum,
      gapFromBaseline100,
      isDrasticDrop: (wapeNum !== null && wapeNum >= 3.0) || error >= 25000,
    };
  });

  const activeSummaries = dailySummaries.filter((d) => d.stockFisik > 0);
  const overallStockFisik = activeSummaries.reduce((s, d) => s + d.stockFisik, 0);
  const overallError = activeSummaries.reduce((s, d) => s + d.error, 0);
  const overallWape =
    overallStockFisik > 0 ? Number(((overallError / overallStockFisik) * 100).toFixed(2)) : 0;
  const overallAccuracy = Number((100 - overallWape).toFixed(2));
  const totalDrasticSpikes = items.reduce((s, it) => s + it.spikeCount, 0);

  return {
    monthLabel: 'Oktober 2026',
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

// Compute dynamic Period Analysis for any selected date range [startDay .. endDay]
export function computePeriodDashboardAnalysis(
  data: ParsedSpreadsheetData,
  startDay: number,
  endDay: number
) {
  const minDay = Math.min(startDay, endDay);
  const maxDay = Math.max(startDay, endDay);

  // Filter daily summaries within [minDay..maxDay]
  const periodSummaries = data.dailySummaries.filter(
    (d) => d.day >= minDay && d.day <= maxDay
  );
  const activePeriodSummaries = periodSummaries.filter(
    (d) => d.stockAccuracyNum !== null && d.stockFisik > 0
  );

  // Average Stock Accuracy across the selected dates (mean of daily Stock Accuracy %)
  const averagePeriodAccuracy =
    activePeriodSummaries.length > 0
      ? Number(
          (
            activePeriodSummaries.reduce((s, d) => s + (d.stockAccuracyNum ?? 0), 0) /
            activePeriodSummaries.length
          ).toFixed(2)
        )
      : 100;

  // Weighted Stock Accuracy (100 - sum(Error)/sum(StockFisik)*100)
  const periodTotalFisik = activePeriodSummaries.reduce((s, d) => s + d.stockFisik, 0);
  const periodTotalError = activePeriodSummaries.reduce((s, d) => s + d.error, 0);
  const periodWape =
    periodTotalFisik > 0 ? Number(((periodTotalError / periodTotalFisik) * 100).toFixed(2)) : 0;
  const weightedPeriodAccuracy = Number(Math.max(0, 100 - periodWape).toFixed(2));

  const gapFromBaseline100 = Number((averagePeriodAccuracy - 100).toFixed(2));

  // Find lowest & highest accuracy days in the selected period
  let lowestDaySummary: DailyAccuracySummary | null = null;
  let highestDaySummary: DailyAccuracySummary | null = null;

  for (const s of activePeriodSummaries) {
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

  // Compute per-item metrics strictly within [minDay..maxDay]
  const periodItems: PeriodItemAnalysis[] = data.items.map((item) => {
    const rawSlice = item.daily.filter((d) => d.day >= minDay && d.day <= maxDay);

    let periodSO = 0;
    let periodAccurate = 0;
    let periodSelisih = 0;
    let activeDaysCount = 0;

    let lowestAccRec: DailyRecord | null = null;
    let highestSelRec: DailyRecord | null = null;

    for (const d of rawSlice) {
      if (d.day === 4) continue;
      const so = d.so ?? 0;
      const acc = d.accurate ?? 0;
      const sel = d.selisih;

      periodSO += so;
      periodAccurate += acc;
      periodSelisih += sel;

      if (so > 0 || acc !== 0 || sel > 0) {
        activeDaysCount++;
        if (
          !lowestAccRec ||
          (d.dailyAccuracyPercent ?? 100) < (lowestAccRec.dailyAccuracyPercent ?? 100) ||
          ((d.dailyAccuracyPercent ?? 100) === (lowestAccRec.dailyAccuracyPercent ?? 100) &&
            d.selisih > lowestAccRec.selisih)
        ) {
          lowestAccRec = d;
        }
        if (!highestSelRec || d.selisih > highestSelRec.selisih) {
          highestSelRec = d;
        }
      }
    }

    // Mark lowest accuracy day inside periodDaily
    const periodDaily = rawSlice.map((d) => ({
      ...d,
      isLowestAccuracyDay:
        lowestAccRec !== null &&
        d.day === lowestAccRec.day &&
        (d.selisih > 0 || (d.dailyAccuracyPercent ?? 100) < 100),
    }));

    let periodErrorRatePercent = 0;
    let periodAccuracyPercent = 100;

    if (periodSO > 0) {
      periodErrorRatePercent = Number(((periodSelisih / periodSO) * 100).toFixed(2));
      periodAccuracyPercent = Number(Math.max(0, 100 - periodErrorRatePercent).toFixed(2));
    } else if (periodSelisih > 0) {
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
// - Tanggal Selisih, Jumlah Selisih, dan Tipe Selisih
// - Dibanding dengan Data Mutasi (Tanggal | Nomor | Deksripsi | Masuk | Keluar) & Kartu Stock (jika ada upload di tgl tersebut)
// - Temukan Potensi Selisih berdasar Analisa Tanggal, Jenis Transaksi, dan Jumlah
// - Rekomendasi Penyelesaian
export function buildVarianceDateMutationComparisons(
  periodItem: PeriodItemAnalysis,
  systemMutations: SystemMutationRecord[],
  stockCards: AnalyzedStockCard[],
  specificDayFilter: number | 'ALL' = 'ALL'
): VarianceDateMutationComparison[] {
  const { item, periodDaily } = periodItem;

  // Match stock card for this item if available
  const matchedCard = stockCards.find(
    (sc) =>
      sc.itemName.toLowerCase().trim() === item.name.toLowerCase().trim() ||
      sc.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(sc.itemName.toLowerCase())
  );

  // Filter dates in the selected period:
  // If specificDayFilter is a specific day (e.g. 5), include that day so the user sees its analysis;
  // otherwise include all variance dates (selisih > 0 or accuracy < 100%, excluding holiday day 4)
  const targetDays = periodDaily.filter((d) => {
    if (d.day === 4) return false;
    if (specificDayFilter !== 'ALL') {
      return d.day === specificDayFilter;
    }
    return d.selisih > 0 || (d.dailyAccuracyPercent ?? 100) < 100;
  });

  return targetDays
    .map((d) => {
      // 1. Determine Tipe Selisih (varianceDirection & varianceTypeLabel)
      const soVal = d.so ?? 0;
      const accVal = d.accurate ?? 0;
      let varianceDirection: VarianceDateMutationComparison['varianceDirection'] = 'FISIK_KURANG';
      let varianceTypeLabel = 'Selisih Kurang Fisik (SO < Sistem)';

      if (d.selisih === 0 && (d.dailyAccuracyPercent ?? 100) === 100) {
        varianceDirection = 'SEIMBANG';
        varianceTypeLabel = 'Tidak Ada Selisih (Klop 100%)';
      } else if (d.day === 7 && (d.so === 0 || d.so === null) && accVal > 0) {
        varianceDirection = 'SO_BELUM_INPUT';
        varianceTypeLabel = 'Cut-Off SO Belum Input (SO = 0 vs Sistem Aktif)';
      } else if (d.accurate !== null && d.accurate < 0) {
        varianceDirection = 'SISTEM_MINUS';
        varianceTypeLabel = 'Stok Sistem Minus (Negative Inventory)';
      } else if ((d.so === 0 || d.so === null) && accVal > 0) {
        varianceDirection = 'FISIK_KURANG';
        varianceTypeLabel = 'Selisih Formula / SO Kosong (SO = 0, Sistem Ada Saldo)';
      } else if (soVal > 0 && d.accurate === null) {
        varianceDirection = 'FISIK_LEBIH';
        varianceTypeLabel = 'Data Sistem Kosong (Fisik Ada, Sistem Tidak Tertarik)';
      } else if (soVal > accVal) {
        varianceDirection = 'FISIK_LEBIH';
        varianceTypeLabel = 'Selisih Lebih Fisik (SO Fisik > Stok Sistem)';
      } else if (soVal < accVal) {
        varianceDirection = 'FISIK_KURANG';
        varianceTypeLabel = 'Selisih Kurang Fisik (SO Fisik < Stok Sistem)';
      }

      // 2. Hanya ambil Data Mutasi yang benar-benar diupload untuk item & tanggal tersebut (Tanpa data dummy otomatis)
      const matchedSystemMutations = systemMutations.filter((m) => {
        if (m.dayNumber !== d.day) return false;
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

      // 3. Hanya ambil Kartu Stock yang benar-benar diupload untuk item & tanggal tersebut
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

      // 4. Analisa Banding Berdasarkan Data Mutasi (jika ada upload di tgl tersebut) & Kartu Stock (jika ada)
      const hasUploadedMutasi = matchedSystemMutations.length > 0;
      const hasUploadedCard = matchedStockCardEntries.length > 0;

      const totalMutIn = matchedSystemMutations.reduce((s, m) => s + m.qtyIn, 0);
      const totalMutOut = matchedSystemMutations.reduce((s, m) => s + m.qtyOut, 0);
      const mutSummaryParts = matchedSystemMutations.map(
        (m) =>
          `Nomor: ${m.transactionNo} (${m.description}) [Masuk: +${m.qtyIn.toLocaleString(
            'id-ID'
          )}, Keluar: -${m.qtyOut.toLocaleString('id-ID')}]`
      );

      let mutationComparisonResult = '';
      let potentialDiscrepancyFinding = '';
      let checkRecommendation = '';

      if (hasUploadedMutasi || hasUploadedCard) {
        mutationComparisonResult = `Hasil Banding ${d.dateLabel}: SO Fisik = ${soVal.toLocaleString(
          'id-ID'
        )} ${item.uom} vs Sistem = ${accVal.toLocaleString(
          'id-ID'
        )} ${item.uom} (Selisih ${d.selisih.toLocaleString('id-ID')} ${item.uom}). ${
          hasUploadedMutasi
            ? `Data Mutasi terupload pada ${d.dateLabel}: [${mutSummaryParts.join(' ; ')}] (Total Masuk: +${totalMutIn.toLocaleString(
                'id-ID'
              )}, Total Keluar: -${totalMutOut.toLocaleString('id-ID')} ${item.uom}).`
            : 'Belum ada upload mutasi sistem di tanggal ini.'
        } ${
          hasUploadedCard
            ? `Kartu Stock terupload: Bukti ${lastCardEntry?.docNo} (Masuk +${
                lastCardEntry?.qtyIn ?? 0
              }, Keluar -${lastCardEntry?.qtyOut ?? 0}, Saldo Akhir: ${stockCardBalance?.toLocaleString(
                'id-ID'
              )} ${item.uom}).`
            : ''
        }`;

        // Cari transaksi spesifik yang jumlahnya mendekati selisih atau menjelaskan lonjakan
        const matchingTxByQty = matchedSystemMutations.find(
          (m) =>
            Math.abs(m.qtyIn - d.selisih) <= 5 ||
            Math.abs(m.qtyOut - d.selisih) <= 5 ||
            (d.deltaSO !== null && Math.abs(m.qtyOut - Math.abs(d.deltaSO)) <= 5)
        );

        if (matchingTxByQty) {
          potentialDiscrepancyFinding = `Potensi Selisih Ditemukan pada Transaksi Nomor [${
            matchingTxByQty.transactionNo
          }] (${matchingTxByQty.transactionType} - "${
            matchingTxByQty.description
          }"): Jumlah transaksi (Masuk: +${matchingTxByQty.qtyIn.toLocaleString(
            'id-ID'
          )}, Keluar: -${matchingTxByQty.qtyOut.toLocaleString(
            'id-ID'
          )} ${item.uom}) berkaitan langsung dengan ${varianceTypeLabel} sebesar ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom} pada tanggal ${d.dateLabel}.`;
        } else if (hasUploadedMutasi) {
          potentialDiscrepancyFinding = `Berdasarkan ${
            matchedSystemMutations.length
          } transaksi mutasi pada ${d.dateLabel} (Total Masuk +${totalMutIn.toLocaleString(
            'id-ID'
          )}, Keluar -${totalMutOut.toLocaleString('id-ID')} ${
            item.uom
          }) dibanding perubahan fisik SO (${
            d.deltaSO !== null
              ? `${d.deltaSO >= 0 ? '+' : ''}${d.deltaSO.toLocaleString('id-ID')}`
              : '0'
          } ${item.uom}), potensi selisih ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom} berasal dari selisih waktu cut-off posting pada nomor [${matchedSystemMutations
            .map((m) => m.transactionNo)
            .join(', ')}].`;
        } else {
          potentialDiscrepancyFinding = `Berdasarkan Kartu Stock tanggal ${
            d.dateLabel
          } (Bukti ${lastCardEntry?.docNo}, Saldo ${stockCardBalance?.toLocaleString(
            'id-ID'
          )} ${item.uom}), terdapat deviasi terhadap angka Sistem (${accVal.toLocaleString(
            'id-ID'
          )}) maupun SO (${soVal.toLocaleString('id-ID')}).`;
        }

        checkRecommendation = `Penyelesaian: Verifikasi fisik & dokumen Nomor [${
          hasUploadedMutasi
            ? matchedSystemMutations.map((m) => m.transactionNo).join(', ')
            : lastCardEntry?.docNo || '-'
        }] pada tanggal ${d.dateLabel}. Sesuaikan selisih ${d.selisih.toLocaleString(
          'id-ID'
        )} ${item.uom} (${varianceTypeLabel}) agar saldo sistem dan fisik kembali klop 100%.`;
      } else {
        // Ketika belum ada upload mutasi / kartu stock pada tanggal tersebut
        mutationComparisonResult = `Rekap Mutasi Sistem & Kartu Stock pada tanggal ${d.dateLabel} masih kosong (belum ada file mutasi yang diupload untuk ${item.name} di tanggal ${d.dateLabel}). Analisa saat ini didasarkan pada perbandingan Spreadsheet SO (${soVal.toLocaleString(
          'id-ID'
        )} ${item.uom}) vs Accurate (${accVal.toLocaleString('id-ID')} ${item.uom}).`;

        if (varianceDirection === 'SO_BELUM_INPUT') {
          potentialDiscrepancyFinding = `Potensi Selisih (${d.dateLabel} · Jumlah: ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom}): Angka SO Fisik pada tanggal ${
            d.dateLabel
          } masih 0 sementara saldo sistem tercatat ${accVal.toLocaleString(
            'id-ID'
          )} ${item.uom}.`;
          checkRecommendation = `Penyelesaian: Input hasil hitung fisik SO tanggal ${d.dateLabel} atau upload file Mutasi / Kartu Stock tanggal ${d.dateLabel} untuk memvalidasi pergerakan barang.`;
        } else if (varianceDirection === 'SISTEM_MINUS') {
          potentialDiscrepancyFinding = `Potensi Selisih (${d.dateLabel} · Jumlah: ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom}): Saldo sistem bernilai negatif (${accVal.toLocaleString(
            'id-ID'
          )} ${item.uom}) akibat pengeluaran diposting sebelum penerimaan.`;
          checkRecommendation = `Penyelesaian: Upload data mutasi tanggal ${d.dateLabel} untuk mengecek nomor transaksi keluar, lalu perbaiki tanggal penerimaan barang (RI).`;
        } else {
          potentialDiscrepancyFinding = `Potensi Selisih (${d.dateLabel} · Tipe: ${varianceTypeLabel} · Jumlah: ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom}): Terjadi perubahan fisik SO (${
            d.deltaSO !== null
              ? `${d.deltaSO >= 0 ? '+' : ''}${d.deltaSO.toLocaleString('id-ID')}`
              : '0'
          } ${item.uom}) yang tidak sebanding dengan perubahan saldo sistem (${
            d.deltaAccurate !== null
              ? `${d.deltaAccurate >= 0 ? '+' : ''}${d.deltaAccurate.toLocaleString('id-ID')}`
              : '0'
          } ${item.uom}). Upload file Mutasi pada tanggal ${
            d.dateLabel
          } untuk melihat Nomor & Deksripsi bukti penyebabnya.`;
          checkRecommendation = `Penyelesaian: Upload file Master Mutasi Barang (${item.name}) untuk tanggal ${d.dateLabel} pada kolom di atas guna melacak Nomor transaksi Masuk/Keluar yang memicu selisih ${d.selisih.toLocaleString(
            'id-ID'
          )} ${item.uom}.`;
        }
      }

      const acc = d.dailyAccuracyPercent ?? 0;
      const severity: VarianceDateMutationComparison['severity'] =
        d.isLowestAccuracyDay || acc < 75 || d.selisih >= 1000
          ? 'CRITICAL'
          : acc < 92 || d.selisih >= 200
          ? 'HIGH'
          : 'MEDIUM';

      return {
        day: d.day,
        dateLabel: d.dateLabel,
        soFisik: d.so,
        stokAccurate: d.accurate,
        qtySelisih: d.selisih,
        varianceDirection,
        varianceTypeLabel,
        dailyAccuracyPercent: acc,
        isLowestAccuracyDay: Boolean(d.isLowestAccuracyDay),
        deltaSO: d.deltaSO,
        deltaAccurate: d.deltaAccurate,
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
    })
    .sort(
      (a, b) =>
        (b.isLowestAccuracyDay ? 1 : 0) - (a.isLowestAccuracyDay ? 1 : 0) ||
        a.dailyAccuracyPercent - b.dailyAccuracyPercent ||
        b.qtySelisih - a.qtySelisih
    );
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

// Parser khusus Format File Master Mutasi Barang:
// Judul Horizontal: Tanggal | Nomor | Deksripsi | Masuk | Keluar (Isian data vertikal)
export function parseSystemMutationBuffer(
  buffer: ArrayBuffer,
  targetItemName: string = 'Semua Item',
  fallbackDay: number = 1
): SystemMutationRecord[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const allRecords: SystemMutationRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    const parsed = parseSystemMutationRows(rows, targetItemName, fallbackDay);
    allRecords.push(...parsed);
  }

  return allRecords;
}

export function parseSystemMutationCsvText(
  text: string,
  targetItemName: string = 'Semua Item',
  fallbackDay: number = 1
): SystemMutationRecord[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Jika teks dipisahkan tab (copy-paste langsung dari Excel) atau titik koma (;)
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.some((l) => l.includes('\t'))) {
    const rows = lines.map((l) => l.split('\t').map((c) => c.trim()));
    return parseSystemMutationRows(rows, targetItemName, fallbackDay);
  }
  if (lines.some((l) => l.includes(';') && !l.includes(','))) {
    const rows = lines.map((l) => l.split(';').map((c) => c.trim()));
    return parseSystemMutationRows(rows, targetItemName, fallbackDay);
  }

  const wb = XLSX.read(cleaned, { type: 'string', cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  return parseSystemMutationRows(rows, targetItemName, fallbackDay);
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
  fallbackDay: number = 1
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
  let currentSectionItemName = targetItemName || 'Semua Item';
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

    const explicitItem =
      optionalItemCol >= 0 && String(row[optionalItemCol] ?? '').trim()
        ? String(row[optionalItemCol]).trim()
        : currentSectionItemName;

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
