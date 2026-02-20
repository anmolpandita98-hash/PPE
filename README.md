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

1. Push this repo to GitHub (e.g. [anmolpandita98-hash/PPE](https://github.com/anmolpandita98-hash/PPE)).
2. In [Vercel](https://vercel.com), import the GitHub repo.
3. Leave build settings as default (Framework: Next.js, Root Directory: `.`).
4. Deploy. The app will run at `https://your-project.vercel.app`.

**Note:** Camera access requires HTTPS. Vercel provides HTTPS by default.
