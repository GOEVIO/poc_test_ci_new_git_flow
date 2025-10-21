export enum DeletionReason {
    USER_REQUESTED = "User requested deletion",
    USER_SUSPEND_DELETION = "User suspended the deletion request",
    USER_BLOCKED = "Account is blocked",
    USER_BLOCKED_DEBT = "Account is blocked for debt",
    USER_DEBT_CLEARED = "Debt Cleared"
}