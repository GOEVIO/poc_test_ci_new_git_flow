export enum TokenStatus {
    Active = 'active',
    Inactive = 'inactive',
}

export enum TokenHistoryAction {
    Activate = 'ACTIVATE',
    Deactivate = 'DEACTIVATE',
}

export enum EmailTemplate {
    BlockPersonalRfid = 'blockPersonalRfid',
    UnblockPersonalRfid = 'unblockPersonalRfid',
    BlockCompanyRfid = 'blockCompanyRfid',
    UnblockCompanyRfid = 'unblockCompanyRfid',
    CancelCompanyRfid = 'cancelCompanyRfid',
    CancelPersonalRfid = 'cancelPersonalRfid',
    CancelAndRequestPersonalRfid = 'cancelAndRequestPersonalRfid',
    CancelAndRequestCompanyRfid = 'cancelAndRequestCompanyRfid',
}

export enum EmailSubject {
    BlockedCard = 'Blocked Card',
    UnblockedCard = 'Unblocked Card',
    Cancelled = 'Cancelled',
    CancelledAndRequestedNew = 'Cancelled and Requested New',
}

export enum Network {
    Evio = 'EVIO',
    Mobie = 'MobiE',
    Gireve = 'Gireve',
    Internal = 'Internal',
}

export enum TokenType {
    Other = 'OTHER',
    Rfid = 'RFID',
    AppUser = 'APP_USER',
}

export enum TokenStatusServiceCode {
    BlockCardSuccess = 'status.update.block_card.success',
    BlockCardFailure = 'status.update.block_card.failure',
    UnblockCardSuccess = 'status.update.unblock_card.success',
    UnblockCardFailure = 'status.update.unblock_card.failure',
    CancelCardSuccess = 'status.update.cancel_card.success',
    CancelCardFailure = 'status.update.cancel_card.failure',
    CancelAndRequestNewCardSuccess = 'status.update.cancel_and_request_new_card.success',
    CancelAndRequestNewCardFailure = 'status.update.cancel_and_request_new_card.failure',
    UserNotFound = 'status.update.user_not_found',
}