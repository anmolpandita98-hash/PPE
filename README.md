# PPE Monitoring Dashboard

Construction site PPE (Personal Protective Equipment) and safety compliance monitoring with live AI detection.

## Features

- **Live AI Detection** – Human detection, safety helmet compliance, phone usage detection
- **Camera feed** – Webcam-based real-time detection with bounding boxes
- **Violation tracking** – No safety helmet, phone usage; clocked once per person in frame
- **Behavior panels** – Safety Compliance and Behavior Detection overlays

## Tech Stack

- Next.js 14, React 18, TypeScript
- TensorFlow.js (COCO-SSD, Face Detection)
- Tailwind CSS

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Go to `/dashboard` for the detection view.

## Deploy on Vercel

Code is in GitHub: [anmolpandita98-hash/PPE](https://github.com/anmolpandita98-hash/PPE).

1. Go to [vercel.com](https://vercel.com) and sign in (use GitHub).
2. Click **Add New** → **Project**.
3. Import **anmolpandita98-hash/PPE** from your GitHub.
4. Leave settings as default:
   - **Framework Preset:** Next.js  
   - **Root Directory:** `.`  
   - **Build Command:** `next build`  
   - **Output Directory:** (default)
5. Click **Deploy**. Wait for the build to finish.
6. Your app will be live at `https://ppe-xxxx.vercel.app`. Open it and go to **/dashboard** for the Live AI Detection view.

**Note:** Camera access requires HTTPS; Vercel provides it. Future pushes to `main` will trigger automatic redeploys.
