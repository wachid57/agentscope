# Invoice Agent

AgentScope ReActAgent yang membaca data dari file Excel, membuat invoice melalui **priva-invoice**, lalu mengirim notifikasi ke **Telegram**.

## Alur Kerja

```
User  →  Invoice Agent
             │
             ├─ read_excel_invoice(file_path)
             │      ↓ customer_name, phone, items, tax_percent
             │
             ├─ create_invoice(customer_name, items_json, ...)
             │      → POST /api/v1.0/external/invoices  (priva-invoice)
             │      ↓ invoice_id, invoice_number, pdf_url
             │
             └─ send_telegram_message(chat_id, text)
                    → Telegram Bot API sendMessage
```

## File yang Dibuat

| File | Keterangan |
|------|-----------|
| `tools.py` | Tiga fungsi tool: read_excel, create_invoice, send_telegram |
| `main.py` | Quart server standalone (port 5002) |
| `docker-compose.yml` | Jalankan agent sebagai container |
| `.env.example` | Contoh environment variable |
| `create_sample.py` | Script untuk membuat `sample_invoice.xlsx` |

## Format Excel yang Didukung

| Kolom | Wajib | Keterangan |
|-------|-------|-----------|
| `customer_name` | Ya | Nama pelanggan |
| `description` | Ya | Deskripsi item |
| `qty` | Ya | Jumlah |
| `price` | Ya | Harga satuan |
| `phone` | Tidak | Nomor telepon |
| `tax_percent` | Tidak | Persentase pajak, e.g. `11` |

Header baris pertama, data mulai baris kedua. Nilai `customer_name`, `phone`, `tax_percent` cukup diisi di baris pertama data — baris berikutnya bisa dikosongkan.

## Cara Menjalankan

### 1. Siapkan file `.env`

```bash
cp .env.example .env
# Edit .env dengan nilai yang benar
```

### 2. Buat sample Excel (opsional)

```bash
pip install openpyxl
python create_sample.py
```

### 3. Jalankan dengan Docker Compose

```bash
docker compose up --build
```

### 4. Atau jalankan langsung

```bash
pip install openpyxl requests agentscope quart
OPENAI_API_KEY=sk-... INVOICE_API_KEY=... TELEGRAM_BOT_TOKEN=... python main.py
```

## Cara Menggunakan via API

```bash
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Proses invoice dari /data/invoices/march.xlsx dan kirim ke Telegram chat 123456789",
    "user_id": "admin",
    "session_id": "sess-001"
  }'
```

Response menggunakan **Server-Sent Events** (SSE). Setiap `data:` line adalah JSON dari `Msg.to_dict()`.

## Menggunakan melalui AgentScope UI

Tool `read_excel_invoice`, `create_invoice`, dan `send_telegram_message` sudah terdaftar di `agent_server.py`. Untuk menggunakannya via UI AgentScope:

1. Buka `http://localhost:3030/agents`
2. Klik **+ New Agent**
3. Isi **Name**, **Description**, pilih **Agent Type**: `ReActAgent`
4. Di bagian **Tools**, aktifkan:
   - `read_excel_invoice`
   - `create_invoice`
   - `send_telegram_message`
5. Di **System Prompt**, salin prompt dari `main.py → SYSTEM_PROMPT`
6. Simpan dan mulai chat

> **Catatan:** Pastikan environment variable `INVOICE_API_KEY` dan `TELEGRAM_BOT_TOKEN` sudah di-set di container `agentscope-app`.

## Konfigurasi priva-invoice

Dapatkan API key dari priva-invoice:

```bash
# Login dulu
curl -X POST http://localhost:8080/api/v1.0/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Buat API key (gunakan token JWT dari login)
curl -X POST http://localhost:8080/api/v1.0/api-keys \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"invoice-agent"}'
```

## Konfigurasi priva-telegram

Invoice Agent mengirim pesan melalui **priva-telegram** (bukan langsung ke Bot API).
priva-telegram bertanggung jawab atas bot token, pencatatan pesan, dan audit log.

### 1. Pastikan priva-telegram sudah running

```bash
cd /data/docker-data/priva-telegram
docker compose up -d
```

### 2. Buat bot di priva-telegram

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | jq -r .token)

# Buat bot (isi bot_token dari @BotFather)
curl -X POST http://localhost:8080/api/v1/telegram/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invoice Bot",
    "bot_token": "123456789:ABCdef...",
    "webhook_url": "https://yourdomain.com/webhook/telegram"
  }'
# Catat "id" dari response → isi sebagai TELEGRAM_BOT_ID
```

### 3. Isi env vars

```env
TELEGRAM_API_URL=http://localhost:8080
TELEGRAM_JWT_TOKEN=<token dari langkah Login di atas>
TELEGRAM_BOT_ID=<UUID bot dari langkah Buat bot>
```

### 4. Test kirim pesan

```bash
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Proses invoice dari /data/invoices/march.xlsx dan kirim ke Telegram chat 123456789",
    "user_id": "admin",
    "session_id": "sess-001"
  }'
```
