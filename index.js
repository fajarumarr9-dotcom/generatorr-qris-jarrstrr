const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// KONFIGURASI
const FEE = 123;
const API_KEY = "5ae1b80d10924b84b11101ba97e9e1889d8c9f47aa6248f4b127b9fd67b6c33e";
const API_BASE = "https://temanqris.com/api/qris";

let transaksi = [];

// HALAMAN UTAMA
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generator QRIS</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-green-50 to-green-100 min-h-screen">
      <div class="container mx-auto px-4 py-8 max-w-md">
        <div class="bg-white rounded-2xl shadow-xl p-6">
          <div class="text-center mb-6">
            <i class="fa fa-qrcode text-5xl text-green-500 mb-2"></i>
            <h1 class="text-2xl font-bold text-gray-800">Generator QRIS</h1>
            <p class="text-gray-500 text-sm">Otomatis + Rp 123</p>
          </div>

          <form action="/buat" method="POST" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nominal Pembayaran</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <input 
                  type="number" 
                  name="nominal" 
                  min="1" 
                  required 
                  placeholder="Masukkan nominal"
                  class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
              </div>
              <p class="text-xs text-gray-500 mt-1">Total = Nominal + Rp 123</p>
            </div>
            <button type="submit" class="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg transition">
              Buat QRIS
            </button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

// PROSES BUAT QRIS
app.post('/buat', async (req, res) => {
  try {
    const nominalAwal = parseInt(req.body.nominal);
    
    // Hanya cek apakah angka valid dan tidak nol/negatif
    if (isNaN(nominalAwal) || nominalAwal <= 0) {
      return res.send(`<div class="p-6 text-center"><h3 class="text-red-500">❌ Masukkan nominal yang valid (minimal Rp 1)</h3><a href="/" class="text-green-600">Kembali</a></div>`);
    }

    const nominalTotal = nominalAwal + FEE;

    // Panggil API
    const response = await axios.post(
      `${API_BASE}/generate`,
      {
        amount: nominalTotal,
        note: `Pembayaran ${nominalAwal} + Fee ${FEE}`
      },
      {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    if (!response.data || response.data.success !== true) {
      throw new Error(response.data?.message || "Gagal terhubung ke layanan");
    }

    const data = response.data.data;
    const id = data?.id || data?.transaction_id;
    const qrisUrl = data?.qris_image_url || data?.qr_code;

    if (!id || !qrisUrl) {
      throw new Error("Data QRIS tidak lengkap. Pastikan QRIS sudah diunggah di akun TemanQRIS.");
    }

    transaksi.push({
      id,
      nominalAwal,
      fee: FEE,
      nominalTotal,
      qrisUrl,
      waktu: Date.now(),
      status: "pending"
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QRIS Siap</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
        <script>
          let cek = setInterval(async () => {
            try {
              const res = await fetch('/cek/${id}');
              const hasil = await res.json();
              if (hasil.status === 'paid') {
                document.getElementById('status').innerHTML = '<div class="bg-green-100 p-3 rounded text-center">✅ SUDAH DIBAYAR!</div>';
                clearInterval(cek);
              }
            } catch (e) {}
          }, 3000);
        </script>
      </head>
      <body class="bg-gradient-to-br from-green-50 to-green-100 min-h-screen">
        <div class="container mx-auto px-4 py-8 max-w-md">
          <div class="bg-white rounded-2xl shadow-xl p-6 text-center">
            <h2 class="text-xl font-bold text-green-600 mb-4">✅ QRIS Berhasil Dibuat</h2>

            <div id="status" class="mb-4">
              <div class="bg-yellow-100 p-3 rounded text-center">⏳ Menunggu Pembayaran...</div>
            </div>

            <div class="bg-gray-50 p-4 rounded text-left mb-4">
              <p>Nominal: Rp ${nominalAwal.toLocaleString('id-ID')}</p>
              <p>Fee: Rp ${FEE.toLocaleString('id-ID')}</p>
              <p class="font-bold text-lg">Total: Rp ${nominalTotal.toLocaleString('id-ID')}</p>
              <p class="text-xs text-gray-500">ID: ${id}</p>
            </div>

            <img src="${qrisUrl}" alt="QRIS" class="mx-auto mb-4 border rounded-lg w-64 h-64">
            <br>
            <a href="/" class="inline-block bg-green-500 text-white px-6 py-2 rounded">Buat Lagi</a>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    res.send(`
      <div class="p-6 text-center">
        <h3 class="text-red-500 mb-2">❌ ${err.message}</h3>
        <p class="text-sm text-gray-600 mb-4">
          Pastikan:<br>
          • API Key benar<br>
          • QRIS statis sudah diunggah di akun TemanQRIS<br>
          • Saldo mencukupi
        </p>
        <a href="/" class="text-green-600">Kembali</a>
      </div>
    `);
  }
});

// CEK STATUS
app.get('/cek/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const trx = transaksi.find(t => t.id === id);
    if (!trx) return res.json({ status: "not_found" });

    const response = await axios.get(`${API_BASE}/check/${id}`, {
      headers: { "X-API-Key": API_KEY },
      timeout: 10000
    });

    if (response.data?.status) trx.status = response.data.status;

    if (Date.now() - trx.waktu > 15 * 60 * 1000) {
      transaksi = transaksi.filter(t => t.id !== id);
      return res.json({ status: "expired" });
    }

    res.json({ status: trx.status });
  } catch {
    res.json({ status: "pending" });
  }
});

module.exports = app;
