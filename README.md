# Priva Agent

Priva Agent adalah sistem agen AI modular yang dibangun di atas kerangka kerja **AgentScope**. Proyek ini mengintegrasikan core logic berbasis Python dengan backend REST API yang cepat menggunakan Go (Fiber) dan antarmuka pengguna modern berbasis React.

## 🚀 Fitur Utama

- **Multi-LLM Support**: Terhubung dengan berbagai penyedia LLM seperti OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, dan DashScope.
- **Arsitektur Modular**:
  - `core/`: Logika agen AI menggunakan AgentScope.
  - `backend/`: API service menggunakan Go & Fiber.
  - `frontend/`: Dashboard interaktif menggunakan React.
- **Integrasi Pihak Ketiga**: Dukungan bawaan untuk Telegram Bot dan Google Workspace (GWS).
- **Observabilitas**: Pelacakan (tracing) opsional menggunakan Jaeger (OpenTelemetry).
- **Persistence**: Penyimpanan data menggunakan PostgreSQL dan caching menggunakan Redis.

## 🛠️ Struktur Proyek

```text
.
├── backend/          # Backend service (Go/Fiber)
├── core/             # Agent core logic (Python/AgentScope)
├── frontend/         # Dashboard UI (React)
├── docker-compose.yml # Konfigurasi deployment Docker
└── run-apps.sh       # Script pembantu untuk menjalankan aplikasi
```

## ⚙️ Persiapan dan Instalasi

### Prasyarat
- Docker dan Docker Compose
- API Key untuk LLM yang ingin digunakan (OpenRouter, OpenAI, dll.)

### Langkah-Langkah
1. **Salin File Environment**:
   ```bash
   cp .env.example .env
   ```
2. **Konfigurasi `.env`**:
   Buka file `.env`. Sebagian besar konfigurasi seperti API Key bisa diatur langsung melalui antarmuka (UI) aplikasi, namun Anda perlu memastikan kredensial admin awal sudah sesuai:
   - **Username Default**: `admin`
   - **Password Default**: `admin123`
   (Nilai ini bisa Anda ubah di dalam file `.env` sebelum menjalankan aplikasi).

3. **Jalankan Aplikasi**:
   Anda bisa menggunakan script pembantu:
   ```bash
   ./run-apps.sh
   ```
   Atau langsung menggunakan Docker Compose:
   ```bash
   docker-compose up -d
   ```

## 🖥️ Akses Aplikasi

Setelah berhasil dijalankan, layanan dapat diakses di:
- **Frontend (Dashboard)**: `http://localhost:3030`
- **Backend API**: Secara default hanya dapat diakses melalui Frontend (proxy). Jika `BACKEND_PORT_EXPOSE` diaktifkan di `.env`, dapat diakses di `http://localhost:8088`.
- **Jaeger UI**: Tidak dijalankan secara default. Jalankan dengan `./run-apps.sh up --profile debug` jika diperlukan.

## 📝 Catatan Pengembangan

- Gunakan `.claude/` untuk menyimpan catatan atau konfigurasi spesifik Claude (sudah masuk dalam `.gitignore`).
- Pastikan volume Docker terpasang dengan benar untuk persistensi data sesi agen.

---
Dikembangkan dengan ❤️ untuk efisiensi agen AI.
