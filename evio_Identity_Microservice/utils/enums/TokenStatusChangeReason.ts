export enum TokenStatusChangeReason {
    BlockedCard = 'BLOCKED_CARD',
    BlockedNetwork = 'BLOCKED_NETWORK',
    Debt = 'DEBT',
    DeleteAccount = 'DELETE_ACCOUNT',
    CancelCard = 'CANCEL_CARD',
    CancelAndRequestNewCard = 'CANCEL_AND_REQUEST_NEW_CARD',
    BackofficeDeactivatedUser = 'BACKOFFICE_DEACTIVATED_USER',

    AccountDeletionRequested = 'ACCOUNT_DELETION_REQUESTED',
    AccountDeletionCanceled = 'ACCOUNT_DELETION_CANCELED',
    DebtIncurred = 'DEBT_INCURRED',
    DebtCleared = 'DEBT_CLEARED',
    DeactivationRequestedByUser = 'DEACTIVATION_REQUESTED_BY_USER', 
    ActivationRequestedByUser = 'ACTIVATION_REQUESTED_BY_USER',     
}