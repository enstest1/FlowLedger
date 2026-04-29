# FlowLedger

> **Invoice. Approve. Settle. Privately.**

Private invoice, approval, and payment workflow for Canton Network teams.

FlowLedger is a B2B SaaS tool for Canton ecosystem teams — validators, node operators, app builders, dev shops, grant teams, and consultants. Create private invoices, route them through an approval workflow, settle payments in USDCx or CC on Canton Network, and generate cryptographically verifiable receipts backed by Canton proof-of-transfer.

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
│   │   └── settings/              # Payment config, team members + invite
│   ├── actions/                   # All server-side mutations
│   │   ├── batch.ts               # createBatch, executeBatch (main payment loop)
│   │   ├── export.ts              # exportInvoicesCSV, exportReceiptsCSV
│   │   ├── invoice.ts             # createInvoice, approveInvoice, rejectInvoice
│   │   ├── org.ts                 # createOrg, updateOrgSettings, inviteMember
│   │   ├── user.ts                # linkCantonWallet, updateUserProfile
│   │   └── vendor.ts              # createVendor, updateVendor, renewPreApproval
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
│   └── layout/                    # Sidebar, topbar
└── lib/
    ├── auth.ts                    # NextAuth config
    ├── canton/
    │   ├── types.ts               # CantonAdapter interface — all method signatures
    │   ├── mock-adapter.ts        # Mock implementation (no validator, default for dev)
    │   ├── devnet-adapter.ts      # Real Splice Validator App HTTP API implementation
    │   ├── canton-auth.ts         # Token acquisition: self-signed or OAuth2
    │   ├── wallet-client.ts       # Client-side CIP-103 wallet detection + connect
    │   └── index.ts               # Adapter factory (picks based on CANTON_NETWORK_ENV)
    ├── permissions.ts             # Role → resource → action matrix
    ├── prisma.ts                  # Prisma singleton
    └── utils.ts                   # cn(), truncatePartyId(), formatAmount(), etc.
prisma/
├── schema.prisma                  # Full DB schema (12 models)
└── seed.ts                        # Demo data: 5 vendors, 8 invoices, 1 paid batch
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
http://localhost:3000/api/dev/signin?email=admin@moltmoon.io
```

Or click **Enter as Admin** / **Enter as Approver** on the sign-in page — both go straight to the demo org at `/moltmoon/dashboard`.

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
| `CANTON_NETWORK_ENV` | `mock` / `localnet` / `devnet` / `mainnet` | Selects adapter |
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

**For mock dev:** only `DATABASE_URL` and `NEXTAUTH_SECRET` are needed. `CANTON_NETWORK_ENV=mock` is the default.

---

## Demo Data

| Entity | Details |
|---|---|
| **Admin** | `admin@moltmoon.io` — ADMIN role |
| **Approver** | `approver@moltmoon.io` — APPROVER role |
| **Org** | MoltMoon Labs · slug: `moltmoon` |
| **Vendors** | Alice Chen, Bob Martinez, Carol White (**expired** pre-approval), David Kim, Eva Santos |
| **Invoices** | 8 across all statuses: DRAFT, PENDING\_APPROVAL, APPROVED ×3, PAID, REJECTED |
| **Batch** | 1 executed batch with mock Canton UpdateID in the receipt |

Carol White's pre-approval is intentionally expired to demonstrate the pre-flight batch check blocking execution.

---

## Roles and Permissions

| Role | Capabilities |
|---|---|
| **ADMIN** | Full access — org settings, member management, all operations |
| **TREASURY** | Create/execute batches, manage vendors, create invoices, export |
| **APPROVER** | View vendors and invoices, approve or reject the queue |
| **ACCOUNTANT** | Read-only — invoices, batches, receipts, CSV export |

Permissions enforced server-side in every server action and API route.

---

## Core Workflow

```
1. SETUP
   Admin creates org → gets treasury Canton party ID (from NaaS provider or LocalNet)
   Treasury adds vendors → Canton pre-approval set per vendor (~$1/90 days in CC)

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
     Execute CIP-0056 token transfer with FeaturedAppActivityMarker
     Store UpdateID + TransferObject JSON → create PaymentReceipt
   Batch → PAID (or PARTIAL if any failed)

6. RECEIPT
   Receipt shows Canton UpdateID, party IDs, full TransferObject JSON
   Shareable read-only link · PDF export
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
                   Vendor keeps full self-custody of all funds
```

### Adapter Pattern

All blockchain calls go through the `CantonAdapter` interface. The factory in `src/lib/canton/index.ts` picks the right implementation based on `CANTON_NETWORK_ENV`:

| `CANTON_NETWORK_ENV` | Adapter | What it does |
|---|---|---|
| `mock` (default) | `MockCantonAdapter` | Returns simulated data, no validator needed |
| `localnet` | `DevNetCantonAdapter` | Calls LocalNet (cn-quickstart on your machine) |
| `devnet` | `DevNetCantonAdapter` | Calls NaaS-hosted DevNet validator |
| `mainnet` | `DevNetCantonAdapter` | Calls NaaS-hosted MainNet validator |

The same `DevNetCantonAdapter` handles all three real environments — only the URLs and credentials differ.

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

Once DevNet testing is done, moving to MainNet is an `.env` change — no code changes required.

### What is different on MainNet vs DevNet

- Real money (real USDCx, real CC)
- No faucet (`tapDevNet` is disabled)
- Featured app approval required for full CC reward weighting
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
NEXT_PUBLIC_CANTON_NETWORK="mainnet"
```

**3. Apply for Featured App status**

Every payroll batch in FlowLedger is tagged with `FeaturedAppActivityMarker`. To earn CC rewards from this, you need Featured App approval from the Canton Foundation.

Apply at [canton.foundation/featured-app-request](https://canton.foundation/featured-app-request/) within 2 weeks of your production launch. The application asks for:

- Company background
- App description, party ID, code repo link
- How you use Canton Coin and Activity Markets
- Estimated transaction volumes
- Fraud prevention controls
- Smart contract audit status

Process: submit form → 5-minute presentation to Tokenomics Committee → Committee vote → on-chain governance vote (~2 weeks total).

From January 2026, **62% of total network rewards** (~516 million CC/month) are distributed to featured apps proportionally based on transaction activity.

**4. Production deployment checklist**

- [ ] PostgreSQL provisioned and `npx prisma migrate deploy` run
- [ ] `NEXTAUTH_SECRET` set to a strong random value (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` set to your production domain
- [ ] SSL/TLS active on production domain
- [ ] Email provider configured and tested
- [ ] `NODE_ENV=production` set (disables `/api/dev/signin` automatically)
- [ ] Canton MainNet credentials in environment
- [ ] Featured App approval obtained
- [ ] Pre-approval expiry monitoring in place (vendor pre-approvals expire every 90 days)
- [ ] Treasury CC traffic balance monitored (CC is consumed per on-chain operation)
- [ ] Team trained on vendor pre-approval renewal process

---

## What Is Not Built Yet

Intentionally out of scope for v1:

| Feature | Notes |
|---|---|
| **Vendor portal** (`/vendor/*`) | Vendor dashboard, vendor invoice submission, vendor receipt view |
| **Canton wallet signature verification** | `/api/auth/canton-wallet` currently trusts party ID format only — add `verifyCantonSignature()` before production |
| **Daml contract bodies** | `createInvoiceContract`, `createBatchContract`, `createReceiptContract` in `devnet-adapter.ts` have TODO stubs — implement after Daml package is deployed |
| **Pre-approval expiry cron job** | Currently checked at batch time — needs a scheduled job for proactive monitoring and alerts |
| **File attachment storage** | Invoice attachment upload UI exists; S3/R2 backend not configured |
| **PDF receipt export** | Download PDF button present; browser print → PDF works as a workaround |
| **Shareable receipt links** | Read-only public receipt URL not implemented |
| **Real-time batch progress** | Uses `router.refresh()` polling — upgrade to SSE for live updates |
| **Recurring payment schedules** | v2 |
| **Payroll tax engine** | v2 |
| **KYC / AML** | v2 |
| **Mobile app** | v2 |
| **Super-admin panel** (`/admin`) | Route placeholder exists, not implemented |

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
| Canton forum | forum.canton.network |
| Digital Asset license | digitalasset.com |

---

*FlowLedger — Canton-native teams only. Real parties, real transfers, real receipts.*
