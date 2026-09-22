# MenuFlow POS Firestore Security Specification

## 1. Data Invariants
1. **Authenticated Access**: All read and write operations require authenticated sessions (`request.auth != null`). Unauthenticated access is denied by default.
2. **User Isolation & Profile Protection**: Users can only read and update their own user profile document (`/users/{userId}` where `userId == request.auth.uid`). Users cannot self-elevate their `role` field.
3. **Admin Privilege**: The project admin (`chrisfbailey.CB@gmail.com`) or users with verified admin status have supervisory access.
4. **ID Sanitization**: All document IDs must adhere to standard alpha-numeric format (`isValidId()`, max 128 characters, matching `^[a-zA-Z0-9_-]+$`).
5. **Payload Bounded Size**: Every string field has strict length bounds (under 128-1024 chars depending on type) to prevent Denial of Wallet resource attacks.
6. **Immutable Historical Audit Logs**: Workflow runs (`/runs/{runId}`) and gate approvals (`/approvals/{approvalId}`) cannot be overwritten or deleted by standard operators once logged.
7. **Connection Test Path**: `/test/{docId}` permits read access for connection heartbeat checking.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Unauthenticated Read on Locations**: An anonymous actor requests `GET /locations/loc_1`. (Must return `PERMISSION_DENIED`).
2. **Unauthenticated Write on Menus**: An anonymous actor attempts `SET /menus/loc_1` with arbitrary menu prices. (Must return `PERMISSION_DENIED`).
3. **Self-Escalation Attack**: A standard authenticated user attempts `UPDATE /users/{userId}` setting `role: "admin"`. (Must return `PERMISSION_DENIED`).
4. **User Profile Impersonation**: User A (`auth.uid: "user_a"`) attempts `SET /users/user_b` to overwrite User B's profile. (Must return `PERMISSION_DENIED`).
5. **ID Poisoning Attack**: An attacker attempts `SET /locations/../../escape` or an ID string exceeding 128 characters or containing illegal characters. (Must return `PERMISSION_DENIED`).
6. **Denial of Wallet Payload**: An attacker attempts to write a 2MB string into `stagingNote` or `summary`. (Must return `PERMISSION_DENIED`).
7. **Ghost Field Injection (Shadow Update)**: An attacker attempts `UPDATE /locations/loc_1` with extra unauthorized field `isPublicBackdoor: true`. (Must return `PERMISSION_DENIED`).
8. **Audit Log Tampering**: An operator attempts `DELETE /runs/run_123` or `UPDATE /runs/run_123` to wipe failure logs. (Must return `PERMISSION_DENIED`).
9. **Gate Approval Forgery**: An unauthorized actor posts an approval with `actor: "admin"` while authenticated as a viewer. (Must return `PERMISSION_DENIED`).
10. **Unverified Email Spoof**: A user claiming admin email with `email_verified: false` attempts to write protected config. (Must return `PERMISSION_DENIED`).
11. **Negative Score Injection**: An attacker attempts to write an audit score of `-999` or non-integer into `/audits/{auditId}`. (Must return `PERMISSION_DENIED`).
12. **Blanket Query Scraping**: A client attempts an unconstrained collection group scan or query without valid tenant scope. (Must return `PERMISSION_DENIED`).

## 3. Security Test Runner
A test suite is defined to validate that rules enforce strict ABAC, prevent shadow updates, and reject all 12 dirty payloads.
