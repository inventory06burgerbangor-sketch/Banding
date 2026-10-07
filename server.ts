import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/analyze-stock-card', async (req, res) => {
  try {
    const { imageBase64, mimeType, itemNameHint } = req.body || {};
    if (!imageBase64 || !mimeType) {
      res.status(400).json({ error: 'Data gambar Kartu Stok tidak lengkap.' });
      return;
    }

    const promptText = `Anda adalah auditor gudang F&B. Analisa foto Kartu Stok fisik ini${
      itemNameHint ? ` (indikasi nama barang: "${itemNameHint}")` : ''
    }.
Ekstrak nama item, satuan (UOM), seluruh baris mutasi tanggal (tanggal, angka hari 1-31, nomor bukti/dokumen jika tertulis, qty masuk/in, qty keluar/out, sisa/saldo akhir kartu stok, serta keterangan), lalu berikan kesimpulan analisa isi kartu stok dan temuan anomali pencatatan.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemName: {
              type: Type.STRING,
              description: 'Nama barang yang tertulis pada Kartu Stok.',
            },
            uom: {
              type: Type.STRING,
              description: 'Satuan barang (contoh: Pack, Pcs, Bks, Kg).',
            },
            summaryAnalysis: {
              type: Type.STRING,
              description: 'Ringkasan hasil pembacaan dan analisa pergerakan Kartu Stok.',
            },
            anomaliesFound: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Daftar temuan kejanggalan pada Kartu Stok (jika ada).',
            },
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: {
                    type: Type.STRING,
                    description: 'Tanggal transaksi pada kartu stok (contoh: 03 Okt 2026).',
                  },
                  dayNumber: {
                    type: Type.INTEGER,
                    description: 'Angka tanggal hari (1 sampai 31).',
                  },
                  docNo: {
                    type: Type.STRING,
                    description: 'Nomor bukti/SJ/RI atau referensi yang tertulis.',
                  },
                  qtyIn: {
                    type: Type.NUMBER,
                    description: 'Jumlah barang masuk (0 jika tidak ada).',
                  },
                  qtyOut: {
                    type: Type.NUMBER,
                    description: 'Jumlah barang keluar (0 jika tidak ada).',
                  },
                  balance: {
                    type: Type.NUMBER,
                    description: 'Saldo akhir pada baris kartu stok tersebut.',
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Catatan atau paraf petugas pada baris tersebut.',
                  },
                },
                required: ['date', 'dayNumber', 'qtyIn', 'qtyOut', 'balance', 'notes'],
              },
            },
          },
          required: ['itemName', 'uom', 'summaryAnalysis', 'anomaliesFound', 'entries'],
        },
      },
    });

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText.trim());
    res.json(parsed);
  } catch (error: any) {
    console.error('Error analyzing stock card image:', error);
    res.status(500).json({
      error:
        error?.message ||
        'Gagal menganalisa foto Kartu Stok dengan AI. Anda tetap dapat menggunakan fitur input/simulasi Kartu Stok.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
