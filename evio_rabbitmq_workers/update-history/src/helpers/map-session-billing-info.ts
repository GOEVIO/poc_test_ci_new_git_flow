import { MINIMUM_CHARGE_DURATION, SESSIONS_STATUS_COMPLETED, SESSIONS_STATUS_EXPIRED } from '../constants';

import {
  BillingInfo,
  BillingDescriptions,
  PaymentsMethods,
  PaymentStatusSessions,
  BillingPeriods,
  SalesTariffs
} from 'evio-library-commons';

interface MapSessionBillingInfos {
  condition: (session: any) => any;
  status: BillingInfo;
  description: BillingDescriptions | null;
}

const checkPriceIsGreaterThanZero = (session): boolean => {
  if (session.origin === 'ocpp')
    return (session.totalPrice && session.totalPrice.excl_vat) > 0;
  return (session.total_cost && session.total_cost.excl_vat) > 0;
};

const isInvoiceNotProcessed = (session: any) => {
  if (typeof session.invoice?.processed !== 'undefined') {
    return !session.invoice.processed;
  }
  return !session.invoiceId;
};

const mapSessionBillingInfoForDifferentUserInternalNetwork: MapSessionBillingInfos[] =
  [
    {
      condition: (session) =>
        session.timeCharged <= MINIMUM_CHARGE_DURATION,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod !== PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        isInvoiceNotProcessed(session) &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        isInvoiceNotProcessed(session) &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod !== PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        !isInvoiceNotProcessed(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.NotPay,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_EXPIRED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) => !checkPriceIsGreaterThanZero(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: () => true,
      status: BillingInfo.Unknown,
      description: BillingDescriptions.Unknown,
    },
  ];

const mapSessionBillingInfoForSameUserInternalNetwork: MapSessionBillingInfos[] =
  [
    {
      condition: (session) =>
        session.timeCharged <= MINIMUM_CHARGE_DURATION,
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        ![PaymentsMethods.transfer, PaymentsMethods.NotPay].includes(
          session.paymentMethod,
        ),
      status: BillingInfo.NotPaid,
      description: BillingDescriptions.NotPaid,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod !== BillingPeriods.Adhoc &&
        session?.tariff?.billingType == SalesTariffs.BillingType.ForBilling,
      status: BillingInfo.InBilling,
      description: BillingDescriptions.InBilling,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.FailedBilling,
      description: BillingDescriptions.FailedBillingSupport,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.FailedBilling,
      description: BillingDescriptions.FailedBilling,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        session.billingPeriod !== BillingPeriods.Adhoc &&
        session?.tariff?.billingType == SalesTariffs.BillingType.ForBilling,
      status: BillingInfo.InBilling,
      description: BillingDescriptions.InBillingPaid,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        ![PaymentsMethods.transfer, PaymentsMethods.NotPay].includes(
          session.paymentMethod,
        ),
      status: BillingInfo.MissingPayment,
      description: BillingDescriptions.MissingPayment,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer,
      status: BillingInfo.Invoiced,
      description: null,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Paid,
      status: BillingInfo.InvoicedPaid,
      description: null,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        (session.paymentMethod === PaymentsMethods.NotPay || session.paymentMethod === PaymentsMethods.transfer),
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) => SESSIONS_STATUS_EXPIRED.includes(session.status),
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) => !checkPriceIsGreaterThanZero(session),
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: () => true,
      status: BillingInfo.Unknown,
      description: BillingDescriptions.Unknown,
    },
  ];

const mapSessionBillingInfoForSameUserExternalNetwork: MapSessionBillingInfos[] =
  [
    {
      condition: (session) =>
        session.timeCharged <= MINIMUM_CHARGE_DURATION,
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId === '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid,
      status: BillingInfo.Estimation,
      description: BillingDescriptions.Estimation,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        ![PaymentsMethods.transfer, PaymentsMethods.NotPay].includes(
          session.paymentMethod,
        ),
      status: BillingInfo.NotPaid,
      description: BillingDescriptions.NotPaid,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.InBilling,
      description: BillingDescriptions.InBilling,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.FailedBilling,
      description: BillingDescriptions.FailedBillingSupport,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.FailedBilling,
      description: BillingDescriptions.FailedBilling,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.InBilling,
      description: BillingDescriptions.InBillingPaid,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        ![PaymentsMethods.transfer, PaymentsMethods.NotPay].includes(
          session.paymentMethod,
        ),
      status: BillingInfo.MissingPayment,
      description: BillingDescriptions.MissingPayment,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.transfer,
      status: BillingInfo.Invoiced,
      description: null,
    },
    {
      condition: (session) =>
        !isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid,
      status: BillingInfo.InvoicedPaid,
      description: null,
    },
    {
      condition: (session) =>
        isInvoiceNotProcessed(session) &&
        checkPriceIsGreaterThanZero(session) &&
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        session.paymentMethod === PaymentsMethods.NotPay,
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) => SESSIONS_STATUS_EXPIRED.includes(session.status),
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: (session) => !checkPriceIsGreaterThanZero(session),
      status: BillingInfo.NotBillable,
      description: BillingDescriptions.NotBillable,
    },
    {
      condition: () => true,
      status: BillingInfo.Unknown,
      description: BillingDescriptions.Unknown,
    },
  ];

const mapSessionBillingInfoForDifferentUserExternalNetwork: MapSessionBillingInfos[] =
  [
    {
      condition: (session) =>
        session.timeCharged <= MINIMUM_CHARGE_DURATION,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId === '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session),
      status: BillingInfo.Estimation,
      description: BillingDescriptions.Estimation,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod !== PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        isInvoiceNotProcessed(session) &&
        session.billingPeriod === BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        isInvoiceNotProcessed(session) &&
        session.billingPeriod !== BillingPeriods.Adhoc,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod !== PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.transfer,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Paid &&
        !isInvoiceNotProcessed(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_COMPLETED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session) &&
        session.cdrId !== '-1' &&
        session.paymentStatus === PaymentStatusSessions.Unpaid &&
        !isInvoiceNotProcessed(session) &&
        session.paymentMethod === PaymentsMethods.NotPay,
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) =>
        SESSIONS_STATUS_EXPIRED.includes(session.status) &&
        checkPriceIsGreaterThanZero(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: (session) => !checkPriceIsGreaterThanZero(session),
      status: BillingInfo.Closed,
      description: null,
    },
    {
      condition: () => true,
      status: BillingInfo.Unknown,
      description: BillingDescriptions.Unknown,
    },
  ];

const applyMapRules = (
  mappingRules: MapSessionBillingInfos[],
  session,
  keyToReturnValue: 'differentUser' | 'sameUser',
) => {
  const result = mappingRules.find((rule) => rule.condition(session)) || {
    status: BillingInfo.Unknown,
    description: BillingDescriptions.Unknown,
  };

  return {
    [keyToReturnValue]: {
      status: result.status,
      description: result.description,
    },
  };
};

export const mapSessionBillingInfo = (
  session: any,
  origin: 'ocpi22' | 'ocpp',
) => {
  const sameUserMappedData =
    origin === 'ocpp'
      ? mapSessionBillingInfoForSameUserInternalNetwork
      : mapSessionBillingInfoForSameUserExternalNetwork;
  if (session.userId === session.userIdWillPay) {
    return applyMapRules(
      sameUserMappedData,
      { ...session, origin },
      'sameUser',
    );
  }

  const sameUserData = applyMapRules(
    sameUserMappedData,
    { ...session, origin },
    'sameUser',
  );

  const differentUserMappedData =
    origin === 'ocpp'
      ? mapSessionBillingInfoForDifferentUserInternalNetwork
      : mapSessionBillingInfoForDifferentUserExternalNetwork;

  const differentUserData = applyMapRules(
    differentUserMappedData,
    { ...session, origin },
    'differentUser',
  );

  return {
    ...sameUserData,
    ...differentUserData,
  };
};
