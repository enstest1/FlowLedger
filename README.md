# FlowLedger

> **Invoice. Approve. Settle. Privately.**

Private invoice, approval, and payment workflow for Canton Network teams.

FlowLedger is a B2B SaaS tool for Canton ecosystem teams — validators, node operators, app builders, dev shops, grant teams, and consultants. Create private invoices, route them through an approval workflow, settle payments in USDCx or CC on Canton Network, generate cryptographically verifiable receipts backed by Canton proof-of-transfer, and earn CC rewards on every payment batch via the Canton Featured App program.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Do I Need a Validator? (ELI5)](#do-i-need-a-validator-eli5)
- [Local Development — Mock Mode](#local-development--mock-mode)
- [Authentication](#authentication)
- [Canton Wallet Browser Integration](#canton-wallet-browser-integration)
- [Environment Variables](#environment-variables)
- [Demo Data](#demo-data)
- [Roles and Permissions](#roles-and-permissions)
- [Core Workflow](#core-workflow)
- [Canton Architecture](#canton-architecture)
- [Stage 1 — LocalNet (Docker, no credentials)](#stage-1--localnet-docker-no-credentials)
- [Stage 2 — DevNet (NaaS provider)](#stage-2--devnet-naas-provider)
- [Stage 3 — MainNet](#stage-3--mainnet)
- [Earning CC Rewards](#earning-cc-rewards)
- [Startup Checks](#startup-checks)
- [Launch Checklist — What To Do Right Now](#launch-checklist--what-to-do-right-now)
- [What Is Not Built Yet](#what-is-not-built-yet)
- [Key Canton Resources](#key-canton-resources)

---

## What It Does

| Feature | Description |
|---|---|
| **Vendors** | Add contractors with their Canton party ID. Pre-approval set on-chain so they receive payments automatically. |
| **Invoices** | Create and submit invoices with line items and optional attachments. Routed to approvers based on amount thresholds. |
| **Approvals** | Approvers see a queue sorted by urgency. Approve or reject with notes. Dual-approval supported above threshold. |
| **Payroll Batches** | Group approved invoices into a batch. Pre-flight check validates treasury balance and vendor pre-approvals before execution. |
| **Payments** | Batch execution sends individual CIP-0056 token transfers per vendor. Partial batch support — one failure does not block the rest. |
| **Receipts** | Every payment generates a receipt with Canton UpdateID (cryptographic proof-of-transfer), payer/payee party IDs, and full TransferObject JSON. |
| **Rewards** | Earn CC rewards on every payment batch via FeaturedAppActivityMarker integration. Rewards dashboard shows coupon count, wallet proxy status, and projected earnings. |
| **CSV Export** | Export invoices and receipts with Canton UpdateIDs for accounting. |
| **Audit Trail** | Every action logged with actor, timestamp, and entity. |
| **Team Roles** | ADMIN, TREASURY, APPROVER, ACCOUNTANT — each with scoped permissions. |

---

## Tech Stack

```
Frontend     Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
Backend      Next.js server actions + API routes
Database     Prisma ORM — SQLite (local dev), PostgreSQL (production)
Auth         NextAuth.js v5 — email magic link + Canton wallet (CIP-103)
Canton SDK   @canton-network/dapp-sdk (browser), jose (JWT signing)
Validation   Zod
Exports      csv-writer
Charts       Recharts (dashboard only)

Canton Reward Layer:
  WalletProxyManager   Wraps WalletUserProxy from splice-util-featured-app-proxies
                       Ensures every payment creates a FeaturedAppActivityMarker
  RewardTracker        Reads CC reward state from Canton validator + Scan API
                       Provides coupon counts, minting status, traffic balance,
                       and projected monthly CC earnings
  MainNetCantonAdapter Extends DevNetCantonAdapter with reward earning path —
                       tries proxied transfer first, falls back to direct transfer
  StartupChecks        5-point boot check: featured app status, wallet proxy template,
                       treasury balance, traffic balance, pre-approval status
```

---

## Project Structure

```
src/
├── app/
│   ├── [slug]/                    # Org-scoped pages (auth + membership required)
│   │   ├── dashboard/             # Stats, activity feed, upcoming dues
│   │   ├── vendors/               # Vendor list, add vendor, vendor detail
│   │   ├── invoices/              # Invoice list, create, detail, approve/reject
│   │   ├── approvals/             # Pending approval queue
│   │   ├── batches/               # Batch list, 3-step create wizard, execute
│   │   ├── receipts/              # Receipt list, receipt detail with Canton proof
│   │   ├── exports/               # CSV export with filters
│   │   ├── rewards/               # CC rewards dashboard (ADMIN + TREASURY only)
│   │   └── settings/              # Payment config, team members + invite
│   ├── actions/                   # All server-side mutations
│   │   ├── batch.ts               # createBatch, executeBatch (main payment loop + reward tracking)
│   │   ├── export.ts              # exportInvoicesCSV, exportReceiptsCSV
│   │   ├── invoice.ts             # createInvoice, approveInvoice, rejectInvoice
│   │   ├── org.ts                 # createOrg, updateOrgSettings, inviteMember
│   │   ├── user.ts                # linkCantonWallet, updateUserProfile
│   │   └── vendor.ts              # createVendor (+ WalletProxy setup), updateVendor, renewPreApproval
│   ├── api/
│   │   ├── auth/canton-wallet/    # POST: Canton wallet sign-in
│   │   ├── dev/signin/            # GET: dev-only instant login (no email needed)
│   │   └── orgs/[slug]/           # balance, invoices, meta REST endpoints
│   ├── auth/                      # signin, verify pages
│   ├── onboarding/                # 4-step org setup wizard
│   └── profile/                   # User profile + Canton wallet link
├── components/
│   ├── canton-wallet-connect.tsx  # Wallet connect button + manual party ID fallback
│   ├── party-id.tsx               # Truncated party ID display with copy button
│   ├── status-badge.tsx           # Colored status badges for all entity states
│   └── layout/                    # Sidebar (with Rewards link), topbar
└── lib/
    ├── auth.ts                    # NextAuth config
    ├── canton/
    │   ├── types.ts               # CantonAdapter interface — all method signatures
    │   ├── mock-adapter.ts        # Mock implementation (no validator, default for dev)
    │   ├── devnet-adapter.ts      # Real Splice Validator App HTTP API implementation
    │   ├── mainnet-adapter.ts     # MainNet adapter — proxied transfers + reward earning
    │   ├── wallet-proxy.ts        # WalletProxyManager — WalletUserProxy setup + proxied transfers
    │   ├── reward-tracker.ts      # RewardTracker — coupons, minting status, traffic, estimates
    │   ├── startup-check.ts       # 5-point boot check for Canton integration health
    │   ├── canton-auth.ts         # Token acquisition: self-signed or OAuth2
    │   ├── wallet-client.ts       # Client-side CIP-103 wallet detection + connect
    │   └── index.ts               # Adapter factory (picks based on CANTON_NETWORK_ENV)
    ├── permissions.ts             # Role → resource → action matrix
    ├── prisma.ts                  # Prisma singleton
    └── utils.ts                   # cn(), truncatePartyId(), formatAmount(), etc.
prisma/
├── schema.prisma                  # Full DB schema (13 models incl. RewardSummary)
└── seed.ts                        # Demo data: 5 vendors, 8 invoices, 1 paid batch
daml/
├── daml.yaml                      # Daml SDK config — splice-api-featured-app-v1,
│                                  # splice-util-featured-app-proxies dependencies
└── FeaturedApp.daml               # FlowLedgerAppProvider template — RecordPaymentActivity
                                   # and RecordBatchSettlement choices for CC reward earning
```

---

## Do I Need a Validator? (ELI5)

This is the most common point of confusion. Here is the plain-English version.

### The analogy

Think of Canton Network like a private banking network.

| Canton concept | Real-world analogy |
|---|---|
| Canton Network | The banking network (like SWIFT) |
| Super Validator (SV) | A big bank that runs the network infrastructure. You will never become one of these. |
| **Validator node** | **Your company's bank branch** — where YOUR funds live and YOUR transactions are signed |
| **NaaS provider** | **A bank that lets you open a business account** — they run the branch for you |
| **Party ID** | Your account number |
| **Treasury party** | Your company's main account that holds USDCx/CC |
| **Vendor party** | Your contractor's account at their own bank (their own Canton wallet) |

### Who needs a validator?

**FlowLedger (your company, the payer) — YES, needs a validator.**

Your treasury party must live on a validator node, because the validator is what signs transactions on your behalf when you send payments. Without a validator hosting your treasury party, you cannot hold funds or send transfers.

You have two options:
- **Run your own validator node** — expensive, complex, requires server infrastructure. Most dApp teams do not do this.
- **Use a NaaS provider** — they run a validator for you and give you API credentials. This is like opening a business bank account. You pay a monthly fee and get full access.

**Vendors (your contractors, the payees) — NO, they do not need a validator.**

Vendors are "external parties." They just need a Canton wallet (like a personal bank account). They do not need a validator to receive payments — the pre-approval mechanism handles everything automatically.

### Summary

```
Your company  →  needs a validator  →  use a NaaS provider
Your vendors  →  just need a Canton wallet  →  no validator required
```

### What about right now, in development?

| Stage | Validator needed? | How |
|---|---|---|
| **Mock mode** (current) | No | MockCantonAdapter simulates everything in memory |
| **LocalNet** | No external one | cn-quickstart spins up a fake validator on your laptop via Docker |
| **DevNet** | Yes | Contact a NaaS provider (Launchnodes, Proof Group, Edgevana) |
| **MainNet** | Yes | Same NaaS providers, different credentials |

---

## Local Development — Mock Mode

No Canton credentials, no Docker, no external services. `MockCantonAdapter` returns realistic simulated data for all blockchain calls. This is the default mode.

### Prerequisites

- Node.js 20+

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd CC_FlowLedger
npm install

# 2. Copy env (CANTON_NETWORK_ENV=mock is already set)
cp .env.example .env

# 3. Set up the database with demo data
npx prisma migrate dev --name init
npx prisma db seed

# 4. Start the dev server
npm run dev
```

### Instant Login (Dev Only)

Email is not configured by default. Use the dev bypass instead:

```
http://localhost:3000/api/dev/signin?email=admin@flowledger.io
```

Or click **Enter as Admin** / **Enter as Approver** on the sign-in page — both go straight to the demo org at `/flowledger/dashboard`.

Test onboarding (new user with no org):
```
http://localhost:3000/api/dev/signin?email=anyone@example.com
```

### Reset Demo Data

```bash
npx prisma migrate reset
npx prisma db seed
```

---

## Authentication

### Canton Wallet (primary)

Users connect their Canton wallet via the CIP-103 protocol. `@canton-network/dapp-sdk` detects `window.canton` (injected by a running Canton wallet app). If no wallet is detected, a manual party ID entry form is shown as fallback.

On sign-in, FlowLedger creates or finds a user keyed to their Canton party ID and redirects to their org dashboard (or onboarding if new).

**Important:** As of April 2026, no official Canton browser extension exists in the Chrome or Firefox store. `window.canton` is only available when:
- Running **LocalNet** via cn-quickstart (the local wallet UI injects it)
- A compatible third-party wallet is running

In all other cases — including DevNet before the extension ships — users use the manual party ID entry form. This is correct behaviour and is the expected path for most users right now.

### Email Magic Link

Enter an email address and receive a sign-in link. Requires SMTP configuration. After signing in via email, users connect their Canton wallet from the **Profile** page (click name in the topbar) to save their party ID.

---

## Canton Wallet Browser Integration

Client-side logic lives in `src/lib/canton/wallet-client.ts` using the CIP-103 provider interface:

```typescript
isCantonWalletInstalled(): boolean
connectCantonWallet(): Promise<{ partyId: string, publicKey?: string }>
signChallengeWithWallet(nonce: string): Promise<string>
onWalletAccountChanged(callback): () => void
```

Party ID format: `hint::hexfingerprint` (64+ lowercase hex chars)
Example: `alice-chen::1a2b3c4d5e6f7890abcdef...`

---

## Environment Variables

| Variable | Description | Required for |
|---|---|---|
| `DATABASE_URL` | Prisma DB connection string | All |
| `NEXTAUTH_SECRET` | Session signing secret | All |
| `NEXTAUTH_URL` | App base URL | All |
| `EMAIL_SERVER_*` | SMTP config | Email magic links |
| `EMAIL_FROM` | Sender address | Email magic links |
| `CANTON_NETWORK_ENV` | `mock` / `localnet` / `devnet` / `testnet` / `mainnet` | Selects adapter |
| `CANTON_VALIDATOR_URL` | Validator App HTTP API base URL | LocalNet + |
| `CANTON_LEDGER_URL` | Ledger API v2 base URL | LocalNet + |
| `CANTON_AUTH_MODE` | `self-signed` (LocalNet) or `client-credentials` (DevNet+) | LocalNet + |
| `CANTON_AUTH_SECRET` | HMAC secret for self-signed JWT | LocalNet only |
| `CANTON_AUTH_TOKEN_URL` | OAuth2 token endpoint | DevNet + |
| `CANTON_AUTH_CLIENT_ID` | OAuth2 client ID | DevNet + |
| `CANTON_AUTH_CLIENT_SECRET` | OAuth2 client secret | DevNet + |
| `CANTON_AUTH_AUDIENCE` | JWT audience | LocalNet + |
| `CANTON_PARTY_ID` | Your treasury internal party ID | LocalNet + |
| `CANTON_AMULET_PACKAGE_ID` | Amulet package ID on the network | DevNet + |
| `CANTON_APP_PROVIDER_PARTY` | Your FlowLedger provider party ID (after Featured App approval) | MainNet rewards |
| `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` | FeaturedAppRight contract ID (after approval) | MainNet rewards |
| `CANTON_DSO_PARTY` | Canton Network DSO party (from NaaS provider) | Daml contracts |
| `CANTON_SCAN_URL` | Public Scan API URL for network stats | Reward estimates |
| `CANTON_WALLET_PROXY_TEMPLATE_ID` | WalletUserProxy template ID from NaaS provider | Proxied transfers |
| `CANTON_TESTNET_LEDGER_URL` | TestNet ledger URL | TestNet |
| `CANTON_TESTNET_REGISTRY_URL` | TestNet registry URL | TestNet |
| `CANTON_TESTNET_AUTH_CLIENT_ID` | TestNet OAuth2 client ID | TestNet |
| `CANTON_TESTNET_AUTH_CLIENT_SECRET` | TestNet OAuth2 client secret | TestNet |
| `CANTON_MAINNET_LEDGER_URL` | MainNet ledger URL | MainNet |
| `CANTON_MAINNET_REGISTRY_URL` | MainNet registry URL | MainNet |
| `CANTON_MAINNET_AUTH_CLIENT_ID` | MainNet OAuth2 client ID | MainNet |
| `CANTON_MAINNET_AUTH_CLIENT_SECRET` | MainNet OAuth2 client secret | MainNet |

**For mock dev:** only `DATABASE_URL` and `NEXTAUTH_SECRET` are needed. `CANTON_NETWORK_ENV=mock` is the default.

---

## Demo Data

| Entity | Details |
|---|---|
| **Admin** | `admin@flowledger.io` — ADMIN role |
| **Approver** | `approver@flowledger.io` — APPROVER role |
| **Org** | FlowLedger Demo · slug: `flowledger` |
| **Vendors** | Alice Chen, Bob Martinez, Carol White (**expired** pre-approval), David Kim, Eva Santos |
| **Invoices** | 8 across all statuses: DRAFT, PENDING\_APPROVAL, APPROVED ×3, PAID, REJECTED |
| **Batch** | 1 executed batch with mock Canton UpdateID in the receipt |

Carol White's pre-approval is intentionally expired to demonstrate the pre-flight batch check blocking execution.

---

## Roles and Permissions

| Role | Capabilities |
|---|---|
| **ADMIN** | Full access — org settings, member management, all operations, rewards dashboard |
| **TREASURY** | Create/execute batches, manage vendors, create invoices, export, rewards dashboard |
| **APPROVER** | View vendors and invoices, approve or reject the queue |
| **ACCOUNTANT** | Read-only — invoices, batches, receipts, CSV export |

Permissions enforced server-side in every server action and API route.

The **Rewards** page (`/[slug]/rewards`) is restricted to ADMIN and TREASURY roles.

---

## Core Workflow

```
1. SETUP
   Admin creates org → gets treasury Canton party ID (from NaaS provider or LocalNet)
   Treasury adds vendors → Canton pre-approval set per vendor (~$1/90 days in CC)
   On MainNet: WalletUserProxy created per vendor for reward-earning proxied transfers

2. INVOICE
   Vendor (or treasury on their behalf) creates invoice
   If amount > approval threshold → routes to APPROVER queue
   If amount ≤ threshold → auto-approved

3. APPROVE
   Approver reviews invoice + vendor payment history
   Approve (optional note) or Reject (required note)
   Dual-approval: stays PENDING until second approval if configured

4. BATCH
   Treasury creates payroll batch from approved invoices (single asset per batch)
   Pre-flight: treasury balance ✓, vendor pre-approvals ✓, traffic cost estimate
   Batch saved as READY

5. EXECUTE
   Treasury confirms → for each invoice in batch:
     Select UTXOs explicitly from treasury
     Execute CIP-0056 token transfer via WalletUserProxy (MainNet) or direct (DevNet)
     FeaturedAppActivityMarker created on-chain → earns CC rewards
     Store UpdateID + TransferObject JSON → create PaymentReceipt
     Store activityMarkerContractId on receipt (MainNet)
   Batch → PAID (or PARTIAL if any failed)
   Batch-level reward summary fetched and stored (non-blocking)

6. RECEIPT
   Receipt shows Canton UpdateID, party IDs, full TransferObject JSON
   On MainNet: also shows activityMarkerContractId (proof of reward marker)
   Shareable read-only link · PDF export

7. REWARDS
   /rewards dashboard shows: estimated CC this round, activity marker count,
   active wallet proxies, featured app status, reward history, network stats
```

---

## Canton Architecture

### Party Model

```
Treasury party  →  INTERNAL party on your NaaS validator
                   The validator signs transactions automatically
                   No manual key management required
                   CC rewards auto-mint every 10-minute consensus round

Vendor party    →  EXTERNAL party
                   Vendor holds their own private key in their Canton wallet
                   FlowLedger registers their party ID on your validator
                   Pre-approval → vendor auto-receives payments (1-step transfer)
                   WalletUserProxy → transfers routed through provider for reward earning
                   Vendor keeps full self-custody of all funds
```

### Adapter Pattern

All blockchain calls go through the `CantonAdapter` interface. The factory in `src/lib/canton/index.ts` picks the right implementation based on `CANTON_NETWORK_ENV`:

| `CANTON_NETWORK_ENV` | Adapter | What it does |
|---|---|---|
| `mock` (default) | `MockCantonAdapter` | Returns simulated data, no validator needed |
| `localnet` | `DevNetCantonAdapter` | Calls LocalNet (cn-quickstart on your machine) |
| `devnet` | `DevNetCantonAdapter` | Calls NaaS-hosted DevNet validator |
| `testnet` | `DevNetCantonAdapter` | Calls NaaS-hosted TestNet validator |
| `mainnet` | `MainNetCantonAdapter` | Calls NaaS-hosted MainNet validator with reward earning |

`MainNetCantonAdapter` extends the DevNet behaviour with proxied transfers for reward marker creation. The `tapDevNet` faucet method is only on `DevNetCantonAdapter` — it does not exist on MainNet.

### Token Authentication

`src/lib/canton/canton-auth.ts` handles two modes:

| Mode | Use case | How it works |
|---|---|---|
| `self-signed` | LocalNet | Signs a JWT locally with an HMAC secret. No auth server needed. |
| `client-credentials` | DevNet + MainNet | OAuth2 client credentials grant against your provider's token endpoint. |

Tokens are cached in memory for 55 minutes (1-hour TTL with a 5-minute renewal buffer).

---

## Stage 1 — LocalNet (Docker, no credentials)

LocalNet runs a complete Canton network on your machine. No external accounts, no credentials, no cost. Real Daml contracts, real token transfers, real UpdateIDs — just fully local.

### What you need

- Docker Desktop with **8 GB RAM** allocated
- A Digital Asset Enterprise Evaluation License — free, 6-month renewable, apply at [digitalasset.com](https://www.digitalasset.com) (~24 hours to receive)

### Steps

**1. Get the license and clone cn-quickstart**

```bash
git clone https://github.com/digital-asset/cn-quickstart
cd cn-quickstart
make setup    # downloads Canton Docker images, generates local keys
make build    # compiles the Daml package
make start    # starts: super-validator, validator, wallet UI, Postgres
```

> cn-quickstart no longer connects to DevNet (discontinued July 2025). It runs a fully self-contained local network.

**2. Find your ports and create a treasury party**

Open the cn-quickstart wallet UI (check the Makefile — default is usually around `http://localhost:3000`). Create a party for your FlowLedger treasury and note the party ID.

Default port layout (verify against your cn-quickstart version's Makefile):

```
Validator App HTTP API   →  http://localhost:5003
Ledger API v2            →  http://localhost:3901
Wallet UI                →  http://localhost:3000  ← may conflict with Next.js
```

If the wallet UI takes port 3000, run FlowLedger on a different port:
```bash
PORT=3001 npm run dev
```

**3. Update FlowLedger `.env`**

```bash
CANTON_NETWORK_ENV="localnet"
CANTON_VALIDATOR_URL="http://localhost:5003"
CANTON_LEDGER_URL="http://localhost:3901"
CANTON_AUTH_MODE="self-signed"
CANTON_AUTH_SECRET="localnet-dev-secret"
CANTON_AUTH_AUDIENCE="https://canton.network.global"
CANTON_AUTH_SUBJECT="ledger-api-user"
CANTON_PARTY_ID="<your-treasury-party-id-from-wallet-ui>"
```

**4. Check API paths**

The `DevNetCantonAdapter` uses Splice Validator App API paths from the v0.x docs. Your cn-quickstart version may use slightly different paths. Verify at:
```
http://localhost:5003/docs/openapi
```
If paths differ, update the strings in `src/lib/canton/devnet-adapter.ts`.

**5. Fund your treasury and test**

```bash
# Get test funds from the local faucet (LocalNet only)
curl -X POST http://localhost:5003/v0/wallet/tap \
  -H "Authorization: Bearer <your-self-signed-token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": "10000"}'
```

Then run the full FlowLedger workflow: add vendor → invoice → approve → batch → execute → confirm the receipt shows a real UpdateID.

**6. Daml contracts (optional for MVP)**

The token transfer flow (the part that generates real UpdateIDs) works without custom Daml. The `createInvoiceContract`, `createBatchContract`, and `createReceiptContract` methods in `devnet-adapter.ts` return placeholder IDs until you deploy the FlowLedger Daml package.

To deploy when ready:
```bash
cd daml
daml build
daml ledger upload-dar --host localhost --port 3901 .daml/dist/flowledger-1.0.0.dar
```
Then fill in the TODO bodies in `devnet-adapter.ts`.

---

## Stage 2 — DevNet (NaaS provider)

DevNet is the real shared Canton test network. It is not self-serve — you need a NaaS provider to give you validator access.

### Do you need to build your own validator?

**No.** A NaaS provider runs the validator for you. You just get API credentials. It is like opening a business bank account — you use the bank's infrastructure, you do not build the bank.

### Choosing a NaaS provider

| Provider | Contact | Notes |
|---|---|---|
| **Launchnodes** | canton@launchnodes.com | Most developer-focused, fastest onboarding. Start here. |
| **Proof Group** | ProofGroup-Validator@sync.global | Institutional grade |
| **Edgevana** | [canton.foundation/validators](https://canton.foundation/validators/) | High-performance infra |

Full list of 47 approved providers: [canton.foundation/validators](https://canton.foundation/validators/)

Pricing is not publicly listed. Contact providers directly. Expect a monthly hosting fee.

### What you get from the provider

They give you everything you need to fill in your `.env`:

```
CANTON_VALIDATOR_URL       Your validator's Validator App HTTP API URL
CANTON_LEDGER_URL          Your validator's Ledger API URL
CANTON_AUTH_TOKEN_URL      OAuth2 token endpoint
CANTON_AUTH_CLIENT_ID      OAuth2 client ID
CANTON_AUTH_CLIENT_SECRET  OAuth2 client secret
CANTON_AUTH_AUDIENCE       JWT audience (usually https://canton.network.global)
CANTON_PARTY_ID            Your treasury internal party ID
```

### Steps once you have credentials

**1. Update `.env`**

```bash
CANTON_NETWORK_ENV="devnet"
CANTON_VALIDATOR_URL="<from provider>"
CANTON_LEDGER_URL="<from provider>"
CANTON_AUTH_MODE="client-credentials"
CANTON_AUTH_TOKEN_URL="<from provider>"
CANTON_AUTH_CLIENT_ID="<from provider>"
CANTON_AUTH_CLIENT_SECRET="<from provider>"
CANTON_AUTH_AUDIENCE="https://canton.network.global"
CANTON_PARTY_ID="<from provider>"
```

**2. Switch to PostgreSQL**

SQLite is not suitable for production. Update `.env`:
```
DATABASE_URL="postgresql://user:pass@host:5432/flowledger"
```

Update `prisma/schema.prisma` datasource provider to `postgresql`, then:
```bash
npx prisma migrate deploy
```

**3. Configure email**

Set `EMAIL_SERVER_*` variables for a real provider (Resend, Postmark, SendGrid). The `/api/dev/signin` bypass only runs when `NODE_ENV=development`.

**4. Verify API paths**

Same as LocalNet — check `<CANTON_VALIDATOR_URL>/docs/openapi` and update paths in `devnet-adapter.ts` if your provider's Splice version differs.

**5. DevNet smoke test checklist**

- [ ] Sign in with Canton party ID (manual entry; `window.canton` available if Canton wallet app is running)
- [ ] Create org with treasury party ID from provider
- [ ] Add a vendor with their real Canton party ID — pre-approval confirmed on-chain
- [ ] Create an invoice
- [ ] Approve invoice
- [ ] Create payroll batch — pre-flight shows real treasury balance from Canton
- [ ] Execute batch — real USDCx/CC transfers go through on DevNet
- [ ] Receipt page shows a real Canton UpdateID
- [ ] CSV export includes real UpdateIDs

> DevNet resets approximately every 3 months. Do not rely on it for persistent data.

---

## Stage 3 — MainNet

Once DevNet testing is done, moving to MainNet requires an `.env` update and setting `CANTON_NETWORK_ENV=mainnet`. This selects `MainNetCantonAdapter`, which adds reward earning on top of the core payment flow.

### What is different on MainNet vs DevNet

- Real money (real USDCx, real CC)
- No faucet (`tapDevNet` is not available — the method does not exist on `MainNetCantonAdapter`)
- `MainNetCantonAdapter` is used instead of `DevNetCantonAdapter`
- Proxied transfers via `WalletProxyManager` earn CC rewards per transfer
- Featured App approval required for full CC reward weighting
- Startup checks run automatically on boot
- Your NaaS provider gives you a separate set of MainNet credentials

### Steps

**1. Get MainNet NaaS credentials**

Contact the same providers (Launchnodes, Proof Group, Edgevana) for MainNet access. You receive a new set of credentials pointing at MainNet infrastructure.

**2. Update `.env`**

```bash
CANTON_NETWORK_ENV="mainnet"
CANTON_VALIDATOR_URL="<mainnet url from provider>"
CANTON_LEDGER_URL="<mainnet ledger url>"
CANTON_AUTH_TOKEN_URL="<mainnet oauth2 token url>"
CANTON_AUTH_CLIENT_ID="<mainnet client id>"
CANTON_AUTH_CLIENT_SECRET="<mainnet client secret>"
CANTON_APP_PROVIDER_PARTY="<your provider party id>"
CANTON_SCAN_URL="<scan api url from provider>"
CANTON_WALLET_PROXY_TEMPLATE_ID="<from provider>"
NEXT_PUBLIC_CANTON_NETWORK="mainnet"
```

**3. Apply for Featured App status**

Every payment transfer in FlowLedger emits a `FeaturedAppActivityMarker` on-chain. To earn CC rewards from these markers, you need Featured App approval from the Canton Foundation.

Apply at [canton.foundation/featured-app-request](https://canton.foundation/featured-app-request/) within 2 weeks of your production launch. The application asks for:

- Company background
- App description, party ID, code repo link
- How you use Canton Coin and Activity Markets
- Estimated transaction volumes
- Fraud prevention controls
- Smart contract audit status

Process: submit form → 5-minute presentation to Tokenomics Committee → Committee vote → on-chain governance vote (~2 weeks total).

Once approved, set `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` to the contract ID you receive. The startup check on the next boot will confirm it.

From January 2026, **62% of total network rewards** (~516 million CC/month) are distributed to featured apps proportionally based on transaction activity.

**4. Production deployment checklist**

- [ ] PostgreSQL provisioned and `npx prisma migrate deploy` run
- [ ] `NEXTAUTH_SECRET` set to a strong random value (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` set to your production domain
- [ ] SSL/TLS active on production domain
- [ ] Email provider configured and tested
- [ ] `NODE_ENV=production` set (disables `/api/dev/signin` automatically)
- [ ] Canton MainNet credentials in environment
- [ ] `CANTON_APP_PROVIDER_PARTY` set
- [ ] `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` set (after approval)
- [ ] `CANTON_WALLET_PROXY_TEMPLATE_ID` set (from NaaS provider)
- [ ] Startup checks pass on first boot (check logs)
- [ ] Pre-approval expiry monitoring in place (vendor pre-approvals expire every 90 days)
- [ ] Treasury CC traffic balance monitored (CC is consumed per on-chain operation)
- [ ] Team trained on vendor pre-approval renewal process

---

## Earning CC Rewards

FlowLedger is a Canton featured app. Every payment batch execution earns CC (Amulet) rewards for the FlowLedger provider party, which can be reinvested into treasury operations or shared with org members.

### How It Works

Canton Network distributes 62% of total minted CC each month (~516M CC/month from January 2026) to featured app developers, proportional to their share of total network transaction activity. The mechanism:

1. Each payment transfer is submitted through a `WalletUserProxy` contract
2. The proxy automatically creates a `FeaturedAppActivityMarker` on-chain
3. The Canton DSO counts markers each consensus round (~10 minutes)
4. CC rewards mint into the provider party's wallet each round
5. The validator's reward automation redeems `AppRewardCoupon` contracts automatically

### What Earns Rewards

| Action | Earns Reward |
|---|---|
| Payment batch execution → per-vendor transfer via WalletUserProxy | YES — one FeaturedAppActivityMarker per transfer |
| Batch settlement → FlowLedgerAppProvider.RecordBatchSettlement (Daml) | YES — one marker per batch (belt-and-suspenders) |
| Invoice creation | No — intermediate step only |
| Invoice approval | No — intermediate step only |
| Pre-approval setup | No — administrative operation |
| Vendor registration | No — administrative operation |

### What Does NOT Earn Rewards

Only actual asset transfers earn markers. Workflow steps — creating invoices, approving them, setting pre-approvals, updating statuses — do not create markers and do not consume reward budget.

This is by design: the Canton tokenomics reward apps that drive real economic activity (token transfers) on the network.

### Getting Featured App Status

Without a `FeaturedAppRight` contract, FlowLedger still creates `FeaturedAppActivityMarker` contracts on-chain, but they do NOT earn CC rewards. The Featured App approval is what activates reward earning.

Steps:
1. Launch on MainNet
2. Within 2 weeks, submit the application at [canton.foundation/featured-app-request](https://canton.foundation/featured-app-request/)
3. 5-minute presentation to the Canton Tokenomics Committee
4. Committee vote + on-chain governance vote (~2 weeks total)
5. Receive `FeaturedAppRight` contract ID
6. Set `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` in your environment
7. Restart the app — startup check confirms the contract

### Reward Calculation

```
projected_monthly_CC =
  (app_txns_per_month / (network_tps × 60 × 60 × 24 × 30))
  × 516,000,000 CC

USD_value = projected_monthly_CC × current_CC_rate
```

- Monitor live CC/USD rate at [canton.thetie.io](https://canton.thetie.io)
- The `/rewards` dashboard shows real-time estimates based on actual network TPS from the Scan API
- A conservative USD placeholder of 0.004 USD/CC is used when the Scan API is unreachable

### Switching to MainNet: Reward Readiness Checklist

- [ ] `CANTON_NETWORK_ENV=mainnet` — activates `MainNetCantonAdapter`
- [ ] `CANTON_APP_PROVIDER_PARTY` set — the party that receives rewards
- [ ] `CANTON_WALLET_PROXY_TEMPLATE_ID` set — enables proxied transfers
- [ ] `CANTON_SCAN_URL` set — enables network TPS-based reward estimates
- [ ] Featured App application submitted (within 2 weeks of launch)
- [ ] `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` set after approval — activates reward earning

### Current Reward Status

Reward status is checked on every boot when `CANTON_NETWORK_ENV=mainnet`. Check your server logs for `[Startup]` lines. If `CANTON_FEATURED_APP_RIGHT_CONTRACT_ID` is not set, you will see:

```
[Startup] WARNING: No FeaturedAppRight contract found for party <party>.
Activity markers will be created but rewards will not be earned until
featured app status is approved at canton.foundation/featured-app-request
```

The `/rewards` dashboard also shows the Featured App Status card — amber (PENDING) until the contract ID is set, green (ACTIVE) once it is.

---

## Startup Checks

When `CANTON_NETWORK_ENV` is `mainnet`, `testnet`, `devnet`, or `localnet`, FlowLedger logs five startup checks on boot. All checks are advisory — a failed check logs a warning but never prevents the app from starting.

| Check | What it verifies | Warning threshold |
|---|---|---|
| **Featured App Status** | `FeaturedAppRight` contract exists on the validator | No contract found |
| **Wallet Proxy Template** | `WalletUserProxy` template available on-chain | Template not found |
| **Treasury Balance** | Treasury USDCX and CC balances | USDCX < 100 or CC < 50 |
| **Traffic Balance** | CC traffic budget remaining | < 10 MB remaining |
| **Pre-approval Status** | Vendor pre-approval counts (active / expiring / expired) | Any expired or expiring within 14 days |

Example output on a healthy MainNet boot:

```
[Startup] Running Canton startup checks...
[Startup] Featured App Status: ACTIVE
[Startup] WalletUserProxy template: AVAILABLE
[Startup] Treasury Balance: USDCX 5420.00, CC 284.0021
[Startup] Traffic Balance: 45.20MB remaining
[Startup] Pre-approval Status: 12 active, 1 expiring within 14 days, 0 expired
[Startup] Startup checks complete: 4 OK, 1 WARN, 0 SKIP
[Startup] Review warnings above before processing live payments.
```

If `CANTON_NETWORK_ENV=mock`, checks are skipped (`SKIP` status) since there is no validator to query.

---

## Launch Checklist — What To Do Right Now

The app is fully built. These are the steps to go from code to production earnings, in priority order.

### 1. Deploy to Vercel — do this today (30 min)

You need a live URL before you can do anything else that matters. The Featured App application asks for it. NaaS providers want to see it. It also forces you to set up Postgres and email properly.

```bash
npm i -g vercel
vercel
```

In the Vercel dashboard, set these environment variables:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Vercel Postgres add-on (one click) or Neon/Supabase free tier |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel deployment URL |
| `EMAIL_SERVER_*` | Resend.com — sign up, get API key, 10 minutes |
| `FLOWLEDGER_ADMIN_EMAILS` | Your real email address |
| `CANTON_NETWORK_ENV` | Leave as `mock` until NaaS credentials arrive |

After setting `DATABASE_URL` to Postgres, run:
```bash
npx prisma migrate deploy
```

### 2. Apply for Featured App status — do this this week

Once you have a live URL, apply at **canton.foundation/featured-app-request**. The committee review takes approximately 2 weeks, so submit as early as possible. You do not need to be on MainNet yet — you are applying for the right, not activating it.

The application asks for your code repo (GitHub is ready), your Canton party ID (use a placeholder), and how you use Activity Markers (the Daml contracts and rewards spec cover this).

### 3. Wait for NaaS credentials in parallel

While Vercel is deploying and the Featured App application is in review, Launchnodes or Proof Group sends you credentials. When they arrive, it is literally 5 env vars and a redeploy:

```bash
CANTON_NETWORK_ENV="devnet"
CANTON_VALIDATOR_URL="<from provider>"
CANTON_LEDGER_URL="<from provider>"
CANTON_AUTH_MODE="client-credentials"
CANTON_AUTH_TOKEN_URL="<from provider>"
CANTON_AUTH_CLIENT_ID="<from provider>"
CANTON_AUTH_CLIENT_SECRET="<from provider>"
```

Run the DevNet smoke test checklist, confirm receipts show real UpdateIDs, then flip to `mainnet` with the MainNet credentials.

### 4. Set CANTON_VERIFY_SIGNATURES=true before real users

Once on MainNet, enable wallet signature verification so party ID ownership is cryptographically proven:

```bash
CANTON_VERIFY_SIGNATURES="true"
```

### 5. Set CANTON_DAML_PACKAGE_ID after uploading the DAR

```bash
cd daml
daml build
daml ledger upload-dar --host <validator-host> --port 3901 .daml/dist/flowledger-1.0.0.dar
# Copy the package ID from the build output
CANTON_DAML_PACKAGE_ID="<hash from daml build>"
```

### Pre-approval monitoring (automatic on Vercel)

`vercel.json` configures a daily cron at 09:00 UTC that hits `/api/cron/preapprovals`. It auto-marks expired vendors and logs a warning for any expiring within 14 days. Set `CRON_SECRET` in Vercel to protect the endpoint.

---

## What Is Not Built Yet

Intentionally out of scope for v1:

| Feature | Notes |
|---|---|
| **Vendor portal** (`/vendor/*`) | Vendor dashboard, vendor invoice submission, vendor receipt view |
| **File attachment storage** | Invoice attachment upload UI exists; S3/R2 backend not configured |
| **PDF receipt export** | Download PDF button present; browser print → PDF works as a workaround |
| **Shareable receipt links** | Read-only public receipt URL not implemented |
| **Real-time batch progress** | Uses `router.refresh()` polling — upgrade to SSE for live updates |
| **RewardSummary population** | `RewardSummary` model exists but not yet auto-populated — add a batch-end hook once on MainNet |
| **Recurring payment schedules** | v2 |
| **Payroll tax engine** | v2 |
| **KYC / AML** | v2 |
| **Mobile app** | v2 |

---

## Key Canton Resources

| Resource | URL |
|---|---|
| cn-quickstart (LocalNet) | github.com/digital-asset/cn-quickstart |
| Splice Validator API docs | docs.dev.sync.global/app_dev/validator_api |
| @canton-network/dapp-sdk | npmjs.com/package/@canton-network/dapp-sdk |
| CIP-103 — dApp API spec | github.com/canton-foundation/cips |
| CIP-0056 — token standard | github.com/canton-foundation/cips |
| NaaS provider list | canton.foundation/validators |
| Featured App application | canton.foundation/featured-app-request |
| CC live rate tracker | canton.thetie.io |
| Canton forum | forum.canton.network |
| Digital Asset license | digitalasset.com |

---

*FlowLedger — Canton-native teams only. Real parties, real transfers, real receipts.*
