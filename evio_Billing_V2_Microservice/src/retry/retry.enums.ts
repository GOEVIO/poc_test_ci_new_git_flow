export enum RetryStatus {
  Scheduled = 'retry_scheduled',
  Retrying = 'retrying',
  Successful = 'retry_successful',
  Failed = 'retry_failed',
  FailedPermanently = 'retry_failed_permanently',
}

export enum RetryOperation {
  GenerateAttachments = 'generate_attachments',
  CreateInvoice = 'create_invoice',
  SendToPHC = 'send_invoice_to_phc',
  FetchPDF = 'fetch_invoice_pdf',
  FetchCreditoNotePDF = 'fetch_credit_note',
  SendEmail = 'send_invoice_email',
  SendEmailCreditNote = 'send_credit_note_email',
  ProcessCreditNote = 'process_credit_note'
}