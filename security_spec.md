# MomSub Security Specification

## Data Invariants
1. A Match must always have a valid `parentId` and `nannyId`.
2. A Schedule must belong to a valid Match.
3. Only the users involved in a Match (Parent, Nanny, Admin) can view or modify schedules related to that match.
4. Users cannot change their own roles.
5. Approvals must be signed by the user making the approval.
6. Admin has full access.
7. Any modification to a schedule (actual or planned) requires an explanation if it's an adjustment.
8. Total hours must be a number and correctly calculated (validated by rules where possible, but primarily enforced by logic and checked for type safety).

## The Dirty Dozen Payloads (Attack Vectors)

1. **Role Escalation**: A Nanny attempts to update their own user document to `role: 'ADMIN'`.
2. **Impersonation**: A Parent attempts to create an `Approval` doc with `userId` of the Nanny.
3. **Cross-Match Access**: Parent A attempts to read/write a Schedule belonging to Parent B's Match.
4. **ID Poisoning**: Attempting to create a Match with a 1MB string as the ID.
5. **Shadow Fields**: Creating a User doc with an extra field `isVerified: true` to bypass hypothetical logic.
6. **Orphaned Writes**: Creating a Schedule for a Match ID that doesn't exist.
7. **Temporal Fraud**: Setting `createdAt` to a future date instead of `request.time`.
8. **Negative Hours**: Submitting a Shift with `totalHours: -5`.
9. **Status Fast-Tracking**: Nanny directly updating Schedule status to `APPROVED` without Parent's approval.
10. **Admin Spoofer**: Requesting access using a token with a spoofed email that matches an admin, but without email verification.
11. **PII Leak**: A Nanny attempting to list all `User` documents to find other parents' emails.
12. **Immutable Break**: A Parent trying to change the `parentId` on an existing Match document.

## Test Runner (Draft)
A `firestore.rules.test.ts` will be implemented to verify these.
