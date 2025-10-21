export enum InvoiceStatusId {
  Created = 20,
  // Excel Generation
  DocumentExcelGenerated = 25,
  DocumentExcelGenerationFailed = 26,
  // Credit Note
  CreditNoteFailed = 27,
  // Retry
  RetryScheduled = 91,
  Retrying = 92,
  RetrySuccessful = 93,
  RetryFailedPermanently = 94,
  // PHC
  SendToThirdPartyError = 30,
  SentToThirdPartySuccessful = 40,
  // PDF Fetch
  GetInvoiceCreditNotePdfSuccessful = 41,
  GetInvoiceCreditNotePdfFailed = 42,
  // Summary PDF
  GenerateSummaryPdf = 43,
  GenerateSummaryPdfFailed = 44,
  // Email
  EmailSent = 45,
  EmailError = 46,
  // Cancellation
  Cancelled = 80
}
