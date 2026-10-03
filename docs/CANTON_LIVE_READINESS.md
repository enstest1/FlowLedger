# FlowLedger — Real Canton Validator Readiness

Last verified against current Canton/Splice documentation: 2026-10-02.

## Current repo status

`npm run canton:doctor` is the source of truth for connectivity readiness.

At the time this document was created, FlowLedger is **not connected to a real validator**:

- `CANTON_NETWORK_ENV=mock`
- no real `CANTON_PARTY_ID`
- no usable Ledger API URL
- no OAuth/client credential set for a hosted validator
- no Scan URL configured
- current Windows dev machine does not have `dpm` or Java installed, so the Daml package has not been locally recompiled in this verification pass

The Next.js production build itself passes. The blocker is Canton network access and the live integration layer, not the web app.

## Correct 2026 architecture

For application code, prefer these stable integration surfaces:

1. **Ledger API** — private ledger reads and transaction submission for hosted parties.
2. **Canton Network Token Standard (CIP-0056)** — token holdings and transfers.
3. **Scan API** — public/global network state and transaction evidence.
4. **Validator API** — only higher-level validator functionality when specifically needed.

Do not build the payment path around the Validator App's internal wallet REST endpoints. Canton explicitly documents those endpoints as internal APIs without backwards-compatibility guarantees.

## Two ways to obtain a real validator

### A. Approved NaaS provider — recommended first path

The Canton Foundation describes an approved white-label NaaS provider as the fastest way to obtain validator access. The provider should give us the hosted Party ID plus the exact Ledger/Validator endpoints and authentication configuration.

Ask the provider for this bundle, in writing:

```text
Network: DevNet / TestNet / MainNet
Hosted FlowLedger Party ID:
Ledger API base URL:
Validator App API base URL (if exposed):
Scan API URL:
OAuth/token endpoint:
OAuth client ID:
OAuth client secret:
OAuth audience:
OAuth scope (if any):
Client auth method: body or basic
Ledger API user / subject:
Token Standard integration notes:
DAR upload procedure:
Support contact:
```

Do not accept a vague answer such as only a validator hostname; we need a working Ledger API identity and Party ID.

### B. Self-hosted validator — the “weird process”

Self-hosting is a separate infrastructure onboarding process. The key steps are:

- provide the validator's stable egress IP for SV allowlisting;
- wait for the SV allowlist rollout (docs say this commonly takes 2–7 days);
- know the current network `MIGRATION_ID`;
- know the sponsoring `SPONSOR_SV_URL`;
- obtain the one-time `ONBOARDING_SECRET`;
- deploy the validator with the same allowlisted egress IP.

MainNet/TestNet onboarding secrets come from the SV sponsor and expire after 48 hours. A self-served DevNet onboarding secret is valid for only 1 hour.

## Featured App submission gate

The official program is **Featured App** status. Do not submit a placeholder application just to get a “developer tag.” The current form requires concrete deployment information including:

- a real Featured Application Party ID;
- Standalone SV Sponsor;
- validator host / self-hosting answer;
- detailed ledger interaction and reward activity description;
- DevNet/TestNet testing evidence;
- transaction-volume and scaling estimates;
- anti-abuse controls;
- audit status and audit plan/report where applicable;
- testing instructions and test-account access or a walkthrough plan;
- for institutional/both targeting, at least two prospective-customer referrals;
- whether the app has been live on MainNet for at least 14 days, or a detailed exception request.

The Foundation says applications should be submitted when the app is within two weeks of MainNet launch. An incomplete application can be returned without review.

Featured App status can make an eligible app participate in Canton application rewards. It is **not a guaranteed CC airdrop** for submitting an app.

## Reward implementation warning

This repo currently contains `FeaturedAppActivityMarker` / `WalletUserProxy` reward logic based on the older marker model.

CIP-0104 introduced traffic-based application rewards. The current Splice docs say that on networks where CIP-0104 traffic rewards are enabled, marker contracts remain supported but do not earn rewards, and apps should stop creating them. The rollout is network/version dependent, so FlowLedger must detect/confirm the target network behavior before deleting or relying on marker logic.

For now:

- treat `daml/FeaturedApp.daml` as legacy/transition code, not proof of current reward eligibility;
- do not claim a payment earns CC merely because a marker was attempted;
- verify activity attribution from Scan / the target network before making reward claims.

## Exact path from here

1. Obtain DevNet validator access from a NaaS provider, or complete self-hosted validator onboarding.
2. Put the provider-issued values in local `.env` only; never commit secrets.
3. Set `CANTON_NETWORK_ENV=devnet` and run `npm run canton:doctor`.
4. Do not proceed until OAuth + `/v2/version` + Party ID checks pass.
5. Replace the legacy payment adapter path with Ledger API + Token Standard calls.
6. Install the current Digital Asset `dpm` toolchain plus JDK 17+, compile the Daml package, then upload the DAR through the provider-supported Ledger API (`POST /v2/dars/`) or equivalent managed procedure.
7. Execute one bona-fide DevNet payment/settlement and capture its Canton Update ID.
8. Verify the update in Scan and record the testing evidence for the Featured App application.
9. Repeat on TestNet if required by the validator/provider and committee path.
10. Launch MainNet, collect real operational evidence, then submit the complete Featured App request in the permitted launch window.

## Official references

- https://canton.foundation/featured-app-request/
- https://canton.foundation/validators/
- https://docs.dev.sync.global/validator_operator/validator_onboarding.html
- https://docs.dev.sync.global/validator_operator/validator_compose.html
- https://docs.dev.sync.global/app_dev/overview/index.html
- https://docs.dev.sync.global/app_dev/validator_api/index.html
- https://docs.dev.sync.global/app_dev/token_standard/index.html
- https://docs.dev.sync.global/app_dev/daml_api/index.html
- https://github.com/canton-foundation/cips/blob/main/cip-0104/cip-0104.md
