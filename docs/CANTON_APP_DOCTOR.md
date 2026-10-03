# Canton App Readiness Doctor

`npm run canton:doctor` is a read-only preflight for the application-to-Canton integration boundary.

It checks:
- DPM availability/version;
- Java/JDK readiness;
- `daml/daml.yaml` and SDK version;
- optional local `dpm build`;
- target network mode;
- application Party ID;
- Ledger API, Token Standard registry, Validator, and Scan configuration;
- OAuth client-credentials acquisition without printing the token;
- Ledger API `/v2/version` reachability;
- Token Standard instrument-registry reachability;
- Scan reachability.

The default command never allocates a party, uploads a DAR, taps a faucet, submits a ledger command, or transfers assets.

## Usage

```bash
npm run canton:doctor
npm run canton:doctor -- --json
npm run canton:doctor -- --build
npm run canton:doctor -- --build --json
```
`--json` emits deterministic structured results suitable for CI jobs and support tickets. A non-ready environment exits non-zero.

`--build` adds a local Daml compile to the checks. It may update local build artifacts under `daml/.daml/`, but it still performs no network or ledger mutation.

## Expected gate

A production/DevNet environment should not proceed to an active smoke transaction until the doctor reports:
- a non-mock network;
- a real application Party ID;
- working Ledger API authentication;
- a reachable Token Standard registry;
- a compatible local Daml toolchain and successful build.

A separate explicit smoke-test command should be used for the first DevNet transaction so read-only diagnostics can remain safe to run in CI and support workflows.

## FlowLedger validation

The current FlowLedger checkout has been validated locally with:
- DPM 1.0.22;
- Temurin JDK 17.0.20.1;
- Daml SDK 3.5.2;
- a successful `dpm build` producing `flowledger-1.0.0.dar`;
- Next.js 16.2.4 production build and TypeScript checks.

The remaining failures in mock mode are intentional: no real Canton application Party, Ledger API URL, or Token Standard registry has been issued yet.
