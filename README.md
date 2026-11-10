# Zunvox Backend: Document Processing & Image Overlay API

A production-ready Node.js & Express backend microservice designed for:
1. **Document Conversion**: Streaming office documents (Word, Excel, PowerPoint, ODT, HTML, etc.) to a local or containerized **Gotenberg** service for conversion to PDF.
2. **Image Processing & Text Overlay**: High-performance image compositing with **Sharp**, overlaying customizable SVG typography, background banners, and branding onto images via memory-efficient streams.
3. **Stream Safety & Zero Disk Leaks**: Fully managed file streams with automatic cleanup of temporary files upon completion, failure, or client aborts.
4. **All-in-One Containerization**: Single production Dockerfile packaging Gotenberg and Node.js together via Supervisord.

---

## Architecture Overview

```
                          ┌──────────────────────────────────────────┐
                          │            Docker Container              │
                          │                                          │
Incoming HTTP Requests ──►│  [Port 5000] Express API (Node.js)       │
(Docs / Images / Health)  │    │                                     │
                          │    ├─► /api/documents/convert ───────────┼──► [Port 3000] Gotenberg
                          │    │     (Multipart File Stream)         │    (LibreOffice / Chromium)
                          │    │                                     │         │
                          │    │                                     │         ▼
                          │    │◄──── (Piped PDF Stream) ────────────┼─────────┘
                          │    │
                          │    └─► /api/images/overlay-text
                          │          (Sharp + Dynamic SVG Compositing)
                          │               │
                          │               ▼
Client Download Stream ◄──┴──────── (Piped Image Stream)
```

---

## Features

- **Document Conversion**:
  - Converts Word (`.docx`, `.doc`), Excel (`.xlsx`, `.xls`), PowerPoint (`.pptx`, `.ppt`), OpenDocument (`.odt`), and HTML files into standard PDF or PDF/A format.
  - Streaming pipeline directly transfers file streams between the client, Node.js, and Gotenberg without loading entire multi-megabyte files into Node.js buffer memory.
- **Image Editing & Text Overlay**:
  - Built with `sharp` for fast C/libvips image transformations.
  - Generates crisp vector SVG text overlays on the fly with XML character escaping, multi-line wrapping, background pills/boxes, custom colors, font families, and anchor positioning.
  - Gravity positioning presets (`north`, `center`, `south`, `southeast`, etc.) and explicit coordinate offsets.
  - Format switching between PNG, JPEG, WebP, and AVIF with configurable compression quality.
- **Production Readiness**:
  - Strict input validation and MIME type allow-listing.
  - Automatic unlinking of uploaded files in `finally` blocks and upon client connection drop (`req.on('close')`).
  - Rate limiting, security headers via `helmet`, CORS, and centralized error logging.
  - Supervisord process supervision with graceful `SIGTERM`/`SIGINT` handling.

---

## Directory Structure

```
.
├── docker/
│   └── supervisord.conf         # Process manager config for Node & Gotenberg
├── src/
│   ├── config/
│   │   └── env.config.js        # Environment validation & defaults
│   ├── controllers/
│   │   ├── document.controller.js  # Gotenberg document streaming
│   │   ├── health.controller.js    # System & Gotenberg health check
│   │   └── image.controller.js     # Sharp text overlay streaming
│   ├── middlewares/
│   │   ├── error.middleware.js     # Centralized error & temp cleanup
│   │   ├── rateLimiter.middleware.js # Express rate limiting
│   │   └── upload.middleware.js    # Multer stream/disk constraints
│   ├── routes/
│   │   ├── document.routes.js
│   │   ├── health.routes.js
│   │   ├── image.routes.js
│   │   └── index.js
│   ├── services/
│   │   ├── gotenberg.service.js    # Multipart streaming to Gotenberg
│   │   └── image.service.js        # Sharp pipeline & SVG compositing
│   ├── utils/
│   │   ├── file.utils.js           # Safe file unlinking & pipelines
│   │   ├── logger.utils.js         # Structured JSON logger
│   │   └── svg.utils.js            # SVG typography generator
│   ├── app.js                      # Express configuration
│   └── server.js                   # HTTP server & shutdown handlers
├── .env.example
├── .gitignore
├── Dockerfile                   # Unified container (Node.js + Gotenberg)
├── Dockerfile.node              # Isolated Node.js container
├── docker-compose.yml           # Multi-container orchestration
├── package.json
└── README.md
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment (`production` or `development`) |
| `PORT` | `5000` | Port for the Express backend |
| `HOST` | `0.0.0.0` | Host binding interface |
| `GOTENBERG_URL` | `http://localhost:3000` | URL of Gotenberg instance |
| `GOTENBERG_TIMEOUT_MS` | `60000` | Gotenberg conversion timeout in ms |
| `MAX_DOCUMENT_SIZE_BYTES` | `52428800` (50MB) | Maximum file size for documents |
| `MAX_IMAGE_SIZE_BYTES` | `20971520` (20MB) | Maximum file size for images |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15m) | Rate limiting time window |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per IP in time window |
| `UPLOAD_TEMP_DIR` | `./uploads/tmp` | Temporary staging folder for uploads |

---

## Quickstart

### Option 1: Docker (Recommended)

Build and run the unified container (both Gotenberg and Node.js run inside one container):

```bash
# Build the Docker image
docker build -t zunvox-backend:latest .

# Run the container
docker run -d -p 5000:5000 --name zunvox-backend zunvox-backend:latest
```

Or using Docker Compose:

```bash
docker compose up -d
```

Check health:
```bash
curl http://localhost:5000/health
```

---

### Option 2: Local Development

1. **Start Gotenberg locally via Docker**:
   ```bash
   docker run --rm -p 3000:3000 gotenberg/gotenberg:8
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Express server**:
   ```bash
   # Development (with auto-reload)
   npm run dev

   # Production
   npm start
   ```

---

## API Endpoints & Usage

### 1. Document Conversion

**Endpoint:** `POST /api/documents/convert`  
**Content-Type:** `multipart/form-data`

#### Parameters:
- `file` *(Required)*: The document file (`.docx`, `.doc`, `.xlsx`, `.pptx`, `.odt`, `.html`, etc.).
- `pdfFormat` *(Optional)*: Target PDF standard (e.g., `PDF/A-1b`, `PDF/A-2b`, `PDF/A-3b`).
- `landscape` *(Optional)*: `true` or `false` for page orientation.
- `pageRanges` *(Optional)*: e.g., `"1-5"` to extract a specific page slice.

#### cURL Examples:

**Convert a Word document to PDF:**
```bash
curl -X POST http://localhost:5000/api/documents/convert \
  -F "file=@/path/to/contract.docx" \
  --output "contract.pdf"
```

**Convert an HTML file to PDF:**
```bash
curl -X POST http://localhost:5000/api/documents/convert \
  -F "file=@/path/to/invoice.html" \
  --output "invoice.pdf"
```

---

### 2. Image Text Overlay

**Endpoint:** `POST /api/images/overlay-text`  
**Content-Type:** `multipart/form-data`

#### Parameters:
- `image` *(Required)*: The input image (`.jpg`, `.png`, `.webp`, `.avif`, `.tiff`).
- `text` *(Required)*: The text string to overlay. Multi-line text is supported using `\n`.
- `fontSize` *(Optional)*: Size in pixels (default: automatically scaled to ~4.5% of image width).
- `fontColor` *(Optional)*: Hex or CSS color string (default: `#ffffff`).
- `fontFamily` *(Optional)*: Font family (default: `Arial, Helvetica, sans-serif`).
- `backgroundColor` *(Optional)*: Background pill color (default: `rgba(0, 0, 0, 0.6)`, set to `transparent` for none).
- `gravity` *(Optional)*: Placement anchor: `north`, `northeast`, `east`, `southeast`, `south`, `southwest`, `west`, `northwest`, `center` (default: `south`).
- `x`, `y` *(Optional)*: Explicit pixel offsets for pinpoint positioning.
- `padding` *(Optional)*: Padding around the text inside the background pill.
- `borderRadius` *(Optional)*: Pill corner radius (default: `8`).
- `format` *(Optional)*: Target output format: `png`, `jpeg`, `webp`, `avif` (default: source format or `png`).
- `quality` *(Optional)*: Compression quality `1` - `100` for lossy formats (default: `85`).

#### cURL Examples:

**Bottom banner overlay (default):**
```bash
curl -X POST http://localhost:5000/api/images/overlay-text \
  -F "image=@photo.jpg" \
  -F "text=Shot on Zunvox Camera" \
  --output "watermarked.jpg"
```

**Custom watermark (top-right corner, custom font & styling):**
```bash
curl -X POST http://localhost:5000/api/images/overlay-text \
  -F "image=@banner.png" \
  -F "text=CONFIDENTIAL\nDO NOT DISTRIBUTE" \
  -F "gravity=northeast" \
  -F "fontSize=28" \
  -F "fontColor=#ff4444" \
  -F "backgroundColor=rgba(255, 255, 255, 0.85)" \
  -F "format=png" \
  --output "banner_watermarked.png"
```

---

### 3. Health Check

**Endpoint:** `GET /health`

Returns the operational status of the Node.js API, uptime, memory statistics, and the connectivity status to Gotenberg.

```bash
curl http://localhost:5000/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-11T01:15:00.000Z",
  "uptimeSeconds": 1420,
  "memory": {
    "rss": 42475520,
    "heapTotal": 20455424,
    "heapUsed": 15284304
  },
  "services": {
    "api": "healthy",
    "gotenberg": {
      "status": "healthy",
      "details": {
        "status": "up"
      }
    }
  }
}
```

---

## Stream & Resource Management Guarantees

1. **Backpressure & Memory Preservation**: Neither large documents nor high-resolution photos are buffered in Node.js V8 heap memory. Files stream from disk directly into Gotenberg or Sharp pipelines, and results stream straight out to the client HTTP socket.
2. **Deterministic Cleanup**:
   - Every uploaded temporary file is recorded and unlinked upon normal response completion (`res.on('finish')`).
   - If a client disconnects mid-upload or mid-download, the request `close` event cancels upstream transfers and destroys active streams immediately, unlinking temporary files without disk leakage.
   - Any unhandled exception during routing, Multer parsing, or pipeline execution triggers the centralized error middleware to safely clean up any associated files.

