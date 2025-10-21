import { IAdjustPreAuthoriseResponse } from 'src/modules/payment/interfaces/adjust-pre-authorise-response.interface'
import { IAptPreAuthoriseResponse } from '../../src/modules/payment/interfaces/apt-pre-authorise-response.interface'
import { ICancelAuthoriseResponse } from 'src/modules/payment/interfaces/cancel-authorise-response'
import { ICaptureResponse } from 'src/modules/payment/interfaces/capture-response.interface'

export const preAuthorisationSuccessResponse: IAptPreAuthoriseResponse = {
  SaleToPOIResponse: {
    MessageHeader: {
      MessageCategory: 'Payment',
      MessageClass: 'Service',
      MessageType: 'Response',
      POIID: 'POS123456',
      ProtocolVersion: '3.0',
      SaleID: 'SALE789',
      ServiceID: 'SERVICE456',
    },
    PaymentResponse: {
      PaymentReceipt: [
        {
          DocumentQualifier: 'CustomerReceipt',
          OutputContent: {
            OutputFormat: 'Text',
            OutputText: [
              {
                EndOfLineFlag: true,
                Text: 'Thank you for your purchase!',
                CharacterStyle: 'Bold',
              },
              {
                EndOfLineFlag: true,
                Text: 'Amount: 20 EUR',
              },
            ],
          },
          RequiredSignatureFlag: false,
        },
      ],
      PaymentResult: {
        AmountsResp: {
          AuthorizedAmount: 20,
          Currency: 'EUR',
        },
        OnlineFlag: true,
        PaymentAcquirerData: {
          AcquirerPOIID: 'ACQ123',
          AcquirerTransactionID: {
            TimeStamp: '2025-08-18T12:00:00Z',
            TransactionID: 'TXN123456',
          },
          ApprovalCode: 'APPROVED',
          MerchantID: 'MERCHANT001',
        },
        PaymentInstrumentData: {
          CardData: {
            CardCountryCode: 'PT',
            EntryMode: ['Chip'],
            MaskedPan: '1234********5678',
            PaymentBrand: 'VISA',
            SensitiveCardData: {
              CardSeqNumb: '01',
              ExpiryDate: '2508',
            },
          },
          PaymentInstrumentType: 'Card',
        },
      },
      POIData: {
        POIReconciliationID: 'RECON123',
        POITransactionID: {
          TimeStamp: '2025-08-18T12:00:00Z',
          TransactionID: 'POITXN789',
        },
      },
      Response: {
        AdditionalResponse:
          'AID=A000000003101002&acquirerResponseCode=APPROVED&adjustAuthorisationData=BQABAQAWqvRt9L1Bt50bfECZHrbsddd1SGTfJfGiyp1wevgEh2u%2fo5afLU9LkN%2ftL3oSpdyPmJGLiGYzQ5Td7olTyzQY7zcKhq66vj72oWGmcFRSkvAp99qYuwqaf%2fH01cE8AQ17CpW21YkQJIwPJK1aKx8qvn2V0qJusuL%2bgZUisKWhSP%2b8wWjLSxm%2beWiHMFXYi6a%2b%2fNwrsXL3oNByRpOekqZE%2biFNqVLJNquNg%2fdQu7pVnIDFMvzlePiKW4INgtKHjDdBaE0Zy2gVm%2f5oolO%2bsa66bMeb%2fP2S547%2fMH8C1j8uYciMf4vKArAiVGkPVNnKwZ%2bW5x067lbEpfshZXDD5jeZDPLTzT2YDz%2fNwDar6wAAM6ND6iXEbdIPKIE2345U0KoJ83C6clx2c8V%2ber1GGvUv%2byEZeKYGvHK7xHq0dKhIk5bWRLmmEKMsgtSrrP%2b9RCeMOm5oNlotte6Sr2cBTToJfoidHWwmPr1uzoUMhHwBHXUVAWkfca67X0J9ri9ub6UWD4WxmTM38cSQxSpevpqdIC8v9eCjFUs4kY0OfspQ8qCxslMiHLOttrjqeFOy%2bC38BI8lP2Ofxlzv22aFV3ZsTizVbEmLjwwGkmxEvHnXkINmtFn8OCdsYm%2f8qBLN%2bXNOFaZfieY5eIul30mFEeoeVAY9al9t7%2bVI9kZV5YhCgP1gACW5ilaD%2fqv87wblP9mPb9zmq%2bEUEGDTT%2bgq03EYtBjQc01BGnwc%2f0bmTZYhawzyVLJuF5jwPp0ulnWzn7GEoqJ%2fFfipb%2bk%2bVRZq3oj%2bZrpyQxb0OsU7vklydnQDvPvK%2bShHeuo7fP3z2gYJRRP9MGnw4Fs040KspLl4n5wfZYrt0ZTctt411LdAT0I6XKxOTE2LiALDG0TllVmBYBSHlA%3d%3d&applicationLabel=VISJAJPNJPY&applicationPreferredName=VISJAJPNJPY&backendGiftcardIndicator=false&cardBin=411111&cardHolderVerificationMethodResults=3F0000&cardIssueNumber=34&cardIssuerCountryId=392&cardScheme=visa&cardSummary=0001&cardType=visa&dcc.dccRefusalReason=Not%20a%20valid%2fconfigured%20Merchant%20Account&expiryMonth=03&expiryYear=2030&giftcardIndicator=false&installments=-1&iso8601TxDate=2025-08-21T12%3a15%3a48.199Z&issuerCountry=JP&merchantReference=0198cc8e-918f-7664-9385-64aa042b3e16&mid=50&offline=false&paymentMethod=visa&paymentMethodVariant=visa&posAmountCashbackValue=0&posAmountGratuityValue=0&posAuthAmountCurrency=EUR&posAuthAmountValue=2000&posEntryMode=CLESS_CHIP&posOriginalAmountValue=2000&posadditionalamounts.originalAmountCurrency=EUR&posadditionalamounts.originalAmountValue=2000&pspReference=T74LH89R85GSKTV5&shopperCountry=PT&store=Mousquetaires-PT&tc=F2162106280F82D1&tid=32202273&transactionReferenceNumber=T74LH89R85GSKTV5&transactionType=GOODS_SERVICES&txdate=21-08-2025&txtime=13%3a15%3a48',
        Result: 'Success',
      },
      SaleData: {
        SaleTransactionID: {
          TimeStamp: '2025-08-18T12:00:00Z',
          TransactionID: 'SALETRAN123',
        },
      },
    },
  },
}

export const adjustPreAuthorisationSuccessResponse: IAdjustPreAuthoriseResponse = {
  additionalData: {
    authCode: '123456',
    adjustAuthorisationData: 'mocked-blob',
    refusalReasonRaw: '',
  },
  pspReference: 'VPSBFF7C4F7B6R75',
  response: 'Authorised',
}

export const cancelAuthoriseSuccessResponse: ICancelAuthoriseResponse = {
  pspReference: 'VPSBFF7C4F7B6R75',
  response: '[cancel-received]',
}

export const captureSuccessResponse: ICaptureResponse = {
  pspReference: 'VPSBFF7C4F7B6R75',
  response: '[capture-received]',
}

export const identifyUserSuccessResponse = {
  SaleToPOIResponse: {
    CardAcquisitionResponse: {
      POIData: {
        POIReconciliationID: '1000',
        POITransactionID: {
          TimeStamp: '2021-03-26T15:58:45.000Z',
          TransactionID: 'BV0q001616774325000',
        },
      },
      PaymentInstrumentData: {
        CardData: {
          CardCountryCode: '528',
          MaskedPan: '541333 **** 9999',
          PaymentBrand: 'mc',
          PaymentToken: {
            TokenRequestedType: 'Customer',
            TokenValue: 'M469509594859802',
          },
          SensitiveCardData: {
            ExpiryDate: '0228',
          },
        },
        PaymentInstrumentType: 'Card',
      },
      Response: {
        AdditionalResponse:
          'tid=47069832&transactionType=GOODS_SERVICES&backendGiftcardIndicator=false&expiryYear=2028&alias=M469509594859802&posAmountGratuityValue=0&giftcardIndicator=false&paymentMethodVariant=mc&txtime=16%3a58%3a45&iso8601TxDate=2021-03-26T15%3a58%3a45.0000000%2b0000&cardType=mc&posOriginalAmountValue=0&aliasType=Default&txdate=26-03-2021&paymentMethod=mc&merchantReference=68&expiryMonth=02&cardSummary=9999&posadditionalamounts.originalAmountCurrency=EUR&posAuthAmountCurrency=EUR&message=CARD_ACQ_COMPLETED&cardIssuerCountryId=528&posAmountCashbackValue=0&posEntryMode=CLESS_CHIP&fundingSource=CREDIT&issuerCountry=NL&cardScheme=mc&cardBin=541333&posAuthAmountValue=0',
        Result: 'Success',
      },
      SaleData: {
        SaleTransactionID: {
          TimeStamp: '2021-03-26T15:58:44.591Z',
          TransactionID: '382',
        },
      },
    },
    MessageHeader: {
      MessageCategory: 'CardAcquisition',
      MessageClass: 'Service',
      MessageType: 'Response',
      POIID: 'P400Plus-347069832',
      ProtocolVersion: '3.0',
      SaleID: 'POSSystemID12345',
      ServiceID: '282',
    },
  },
}

export const preAuthorisationFailureResponse: IAptPreAuthoriseResponse = {
  SaleToPOIResponse: {
    MessageHeader: {
      MessageCategory: 'Payment',
      MessageClass: 'Service',
      MessageType: 'Response',
      POIID: 'POS123456',
      ProtocolVersion: '3.0',
      SaleID: 'SALE789',
      ServiceID: 'SERVICE456',
    },
    PaymentResponse: {
      PaymentReceipt: [
        {
          DocumentQualifier: 'CustomerReceipt',
          OutputContent: {
            OutputFormat: 'Text',
            OutputText: [
              {
                EndOfLineFlag: true,
                Text: 'Thank you for your purchase!',
                CharacterStyle: 'Bold',
              },
              {
                EndOfLineFlag: true,
                Text: 'Amount: 20 EUR',
              },
            ],
          },
          RequiredSignatureFlag: false,
        },
      ],
      PaymentResult: {
        AmountsResp: {
          AuthorizedAmount: 20,
          Currency: 'EUR',
        },
        OnlineFlag: true,
        PaymentAcquirerData: {
          AcquirerPOIID: 'ACQ123',
          AcquirerTransactionID: {
            TimeStamp: '2025-08-18T12:00:00Z',
            TransactionID: 'TXN123456',
          },
          ApprovalCode: 'APPROVED',
          MerchantID: 'MERCHANT001',
        },
        PaymentInstrumentData: {
          CardData: {
            CardCountryCode: 'PT',
            EntryMode: ['Chip'],
            MaskedPan: '1234********5678',
            PaymentBrand: 'VISA',
            SensitiveCardData: {
              CardSeqNumb: '01',
              ExpiryDate: '2508',
            },
          },
          PaymentInstrumentType: 'Card',
        },
      },
      POIData: {
        POIReconciliationID: 'RECON123',
        POITransactionID: {
          TimeStamp: '2025-08-18T12:00:00Z',
          TransactionID: 'POITXN789',
        },
      },
      Response: {
        AdditionalResponse: 'Approved;AuthCode=123456',
        Result: 'Unauthorised',
      },
      SaleData: {
        SaleTransactionID: {
          TimeStamp: '2025-08-18T12:00:00Z',
          TransactionID: 'SALETRAN123',
        },
      },
    },
  },
}

export const adjustPreAuthorisationFailureResponse: IAdjustPreAuthoriseResponse = {
  additionalData: {
    authCode: '123456',
    adjustAuthorisationData: 'mocked-blob',
    refusalReasonRaw: '',
  },
  pspReference: 'VPSBFF7C4F7B6R75',
  response: 'Unauthorised',
}

export const cancelAuthoriseFailureResponse: ICancelAuthoriseResponse = {
  pspReference: 'VPSBFF7C4F7B6R75',
  response: '[cancel-error]',
}

export const captureFailureResponse: ICaptureResponse = {
  pspReference: 'VPSBFF7C4F7B6R75',
  response: '[capture-error]',
}
