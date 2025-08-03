# Project

## Setup

1. Copy `.env.example` to `.env` and fill in your Firebase and Roboflow credentials.
   ```bash
   cp .env.example .env
   # edit .env and add your keys
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```

The application relies on the following environment variables:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `ROBOFLOW_API_KEY`

### LEGO board analyzer

The application now uses a grid-based analyzer implemented in
`src/modules/legoBoardAnalyzer.ts`. It segments the LEGO board, performs a
perspective transform to a fixed top view and detects the dominant color in
each grid cell. Results are mapped back onto the original image, so users can
see detected colors directly on their uploaded photo.

Each detected cell goes through a three-stage filter covering color
difference, texture variance and edge count. Tune the thresholds in
`legoBoardAnalyzer.ts` (ΔE 15–25, std‑dev 3–10 and Canny ratio 1%–5%) to
adapt to different lighting and camera setups.

`VisionApp` wraps this analyzer. When the user clicks **Capture**, the app
shows a spinner while processing the frame and then navigates to
`lego-result.html`. The result page displays the annotated image with color
labels overlaid.

The analyzer depends on OpenCV.js and `colorjs.io`. Ensure dependencies are
installed via `npm install`.

These values are loaded using `dotenv` and injected during the webpack build.
