# 🍿 Movteg - Nonton Film Bareng Pasangan Jarak Jauh (Watch Party)

**Movteg** adalah aplikasi web modern untuk menonton film dan video bersama pasangan dari jarak jauh secara tersinkronisasi waktu nyata (*synchronized playback*), dilengkapi ruang obrolan langsung (*live chat*) dan reaksi emoji romantis yang melayang di layar (*floating reactions*).

---

## ✨ Fitur Utama

- 🎬 **Sinkronisasi Pemutaran Waktu Nyata**:
  - Sinkronisasi otomatis saat salah satu menekan **Play**, **Pause**, atau **Seek / Geser Durasi**.
  - Deteksi dan koreksi *playback drift* jika ada salah satu koneksi yang melambat.
- 🔗 **Mendukung Berbagai Format Video**:
  - **YouTube**: Cukup masukkan link video YouTube (terintegrasi otomatis dengan YouTube IFrame API).
  - **Direct Video Links**: Link langsung file `.mp4`, `.webm`, dan HLS streaming `.m3u8`.
  - **Contoh Film Bawaan**: Disediakan tombol uji coba film pendek animasi beresolusi jernih (*Big Buck Bunny*, *Tears of Steel*, *Sintel*, *Lofi Girl*).
- 💬 **Obrolan Real-Time (Live Chat)**:
  - Ruang chat di samping video dengan bubble obrolan penanda nama pengguna.
  - Notifikasi otomatis aktivitas sistem (misal: "*Ayang menjeda video*", "*Budi melompat ke 04:12*").
- ❤️ **Floating Emoji Reactions**:
  - Kirim reaksi instan (❤️, 🍿, 😂, 🥺, 🔥, 👏, ✨) yang akan melayang manis di atas video pasanganmu.
  - Efek konfeti hati saat mengirim reaksi cinta ❤️.
- 🔒 **Sistem Private Room & Invite Link**:
  - Buat ruangan bioskop pribadi dengan kode unik.
  - Tombol **Salin Tautan Undangan** sekali klik untuk dikirimkan ke pasangan via WhatsApp, Telegram, dll.
- 📱 **Responsif & Desain Bioskop Romantis**:
  - Tampilan Dark Mode modern bernuansa *cozy cinema* yang nyaman di mata baik di laptop maupun smartphone.

---

## 📁 Struktur Folder Proyek

```
Movteg/
├── client/                 # Frontend React + Vite + Tailwind CSS + Lucide Icons
│   ├── src/
│   │   ├── components/     # VideoPlayer, ChatPanel, ReactionsOverlay, Navbar, dll.
│   │   ├── utils/          # socket.js, youtube.js
│   │   ├── App.jsx         # Halaman utama aplikasi
│   │   └── main.jsx
│   ├── package.json
│   └── vercel.json         # Konfigurasi routing untuk Vercel
├── server/                 # Backend Node.js + Express + Socket.IO
│   ├── index.js            # WebSocket server & room state manager
│   └── package.json
├── package.json            # Root script untuk menjalankan client & server
├── vercel.json             # Root konfigurasi deploy Vercel
└── README.md
```

---

## 🚀 Cara Menjalankan di Komputer Lokal (Localhost)

### 1. Jalankan Backend Server
Buka terminal dan masuk ke folder `server`:
```bash
cd server
npm install
npm run dev
```
Server akan berjalan di `http://localhost:4000`.

### 2. Jalankan Frontend Client
Buka terminal baru dan masuk ke folder `client`:
```bash
cd client
npm install
npm run dev
```
Buka browser di alamat yang muncul (biasanya `http://localhost:5173`).

### 3. Cara Menguji Berdua di 1 Laptop:
1. Buka jendela browser biasa, buat Room baru (misal: `cozy-1234`).
2. Buka jendela browser **Incognito (Private)**, buka link yang sama dan masukkan nama pasangan.
3. Coba tekan Play/Pause atau kirim pesan di salah satu jendela, maka jendela lain akan tersinkronisasi secara otomatis!

---

## 📤 Panduan Upload ke GitHub

Jalankan perintah berikut di terminal root proyek `Movteg`:

```bash
# 1. Inisialisasi Git
git init

# 2. Tambahkan semua file
git add .

# 3. Buat commit pertama
git commit -m "feat: initial commit Movteg watch party app"

# 4. Ganti nama branch utama menjadi main
git branch -M main

# 5. Hubungkan ke repository GitHub kamu (buat repo baru di github.com)
git remote add origin https://github.com/USERNAME_KAMU/NAMA_REPO.git

# 6. Push ke GitHub
git push -u origin main
```

---

## 🌐 Panduan Deploy ke Vercel & Hosting Backend

### Mengapa Backend Butuh Server WebSocket?
> **Catatan Penting**: Vercel adalah platform *Serverless* (fungsi API mati setelah beberapa detik) sehingga **tidak mendukung koneksi WebSocket (Socket.IO) yang harus menyala terus-menerus**.
> 
> Oleh karena itu, arsitektur terbaik adalah:
> 1. **Frontend (Client)** di-deploy ke **Vercel** (Gratis & Sangat Cepat).
> 2. **Backend (Server)** di-deploy ke **Render.com** atau **Railway.app** (Gratis & Mendukung WebSocket 24/7).

---

### Langkah 1: Deploy Backend ke Render (Gratis)
1. Buka [render.com](https://render.com) dan login dengan akun GitHub kamu.
2. Klik **New +** -> Pilih **Web Service**.
3. Hubungkan repository GitHub `Movteg` kamu.
4. Isi konfigurasi berikut:
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: `Free`
5. Klik **Create Web Service**.
6. Setelah selesai, Render akan memberikan URL server kamu, contoh:  
   `https://movteg-server.onrender.com`

---

### Langkah 2: Deploy Frontend ke Vercel (Gratis)
1. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub kamu.
2. Klik **Add New...** -> **Project**.
3. Pilih repository `Movteg` dari GitHub kamu.
4. Pada pengaturan project:
   - **Root Directory**: klik Edit dan pilih `client` (atau biarkan default root karena sudah ada `vercel.json`).
   - **Environment Variables**: Tambahkan variabel baru:
     - **Key**: `VITE_SERVER_URL`
     - **Value**: URL backend Render kamu (contoh: `https://movteg-server.onrender.com`)
5. Klik **Deploy**.
6. Selesai! Web kamu sudah aktif online dan bisa langsung dibagikan ke pasangan tercinta! 💕

*(Catatan: Kamu juga bisa mengganti URL server backend sewaktu-waktu langsung dari menu ikon Pengaturan (⚙️) di pojok kanan atas website tanpa perlu build ulang).*
