# Welcome to Xeinon

Xeinon is a real-time on-chain discovery platform that detects, indexes, and tracks newly created tokens on Base — including creator coins, factory-deployed tokens, and contracts discovered via bytecode scanning.

Unlike traditional token trackers that rely only on DEX listings, Xeinon surfaces tokens from the moment they are created, then continuously enriches them as pricing, liquidity, and trading data becomes available.

What Xeinon does:
	•	Detects new token deployments in real time (WebSocket + backfill)
	•	Indexes factory-created and non-factory tokens
	•	Classifies tokens by lifecycle stage (created → traded)
	•	Tracks market data once available (price, volume, liquidity)
	•	Separates recently detected tokens from actively traded ones
	•	Provides a clean, Dex-style interface before tokens hit major DEXs

# Demo
Live demo: https://xeinon.com


# Installation
Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

**How Xeinon Works (High-Level)**
    1. On-chain detection
        - WebSocket listeners monitor factory events (e.g. Zora)
        - Bytecode scanning backfills missed contracts

    2. Canonical indexing
        - All detections pass through a raw intake layer
        - Tokens are normalized into a single canonical record

    3. Lifecycle tracking
        - Tokens move through stages:
        created → discovered → priced → liquid → traded → dead
        
    4. Market enrichment
        - Price, volume, liquidity, and holders are attached once available

    5. Frontend classification
        - Pending tokens — early discovery
        - Active tokens — real market activity

This project is built with:
	•	Vite
	•	TypeScript
	•	React
	•	shadcn/ui
	•	Tailwind CSS
	•	Supabase (Postgres + Realtime)
	•	On-chain WebSockets & indexers

