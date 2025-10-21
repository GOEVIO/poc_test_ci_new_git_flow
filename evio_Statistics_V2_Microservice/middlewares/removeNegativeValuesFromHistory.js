function removeNegativeValuesFromHistory(session) {
  if (!session) return session;

  if (session.timeCharged <= 0 || session.totalPower <= 0) {

    if ('totalPower' in session) session.totalPower = session.totalPower <= 0 ? 0 : session.totalPower;
    if ('timeCharged' in session) session.timeCharged = session.timeCharged <= 0 ? 0 : session.timeCharged;

    if (session.costDetails) {
      if ('activationFee' in session.costDetails) session.costDetails.activationFee = 0;
      if ('parkingDuringCharging' in session.costDetails) session.costDetails.parkingDuringCharging = 0;
      if ('parkingAmount' in session.costDetails) session.costDetails.parkingAmount = 0;
      if ('costDuringCharge' in session.costDetails) session.costDetails.costDuringCharge = 0;

      if ('timeCharged' in session.costDetails) session.costDetails.timeCharged = session.timeCharged <= 0 ? 0 : session.costDetails.timeCharged;
      if ('totalTime' in session.costDetails) session.costDetails.totalTime = session.timeCharged <= 0 ? 0 : session.costDetails.totalTime;
      if ('totalPower' in session.costDetails) session.costDetails.totalPower = session.totalPower <= 0 ? 0 : session.costDetails.totalPower;

      if ('timeChargedInMin' in session) session.timeChargedInMin = session.timeCharged <= 0 ? "0s" : (session.timeCharged / 60).toString();
      if ('timeChargedInMinExcel' in session) session.timeChargedInMinExcel = session.timeCharged <= 0 ? 0 : (Math.round(session.timeCharged * 60 * 1000) / 1000);
      if ('totalTimeInMin' in session) session.totalTimeInMin = session.timeCharged <= 0 ? 0 : (session.costDetails.totalTime / 60);
      if ('timeAfterChargedInMin' in session) session.timeAfterChargedInMin = session.timeCharged <= 0 ? 0 : ((session.costDetails.totalTime / 60) - (session.costDetails.timeCharged / 60));
    }

    if (session.totalPrice) {
      if ('excl_vat' in session.totalPrice) session.totalPrice.excl_vat = 0;
      if ('incl_vat' in session.totalPrice) session.totalPrice.incl_vat = 0;
    }

    if (session.purchaseTariffDetails) {
      if ('excl_vat' in session.purchaseTariffDetails) session.purchaseTariffDetails.excl_vat = session.totalPower <= 0 ? 0 : session.purchaseTariffDetails.excl_vat;
      if ('incl_vat' in session.purchaseTariffDetails) session.purchaseTariffDetails.incl_vat = session.totalPower <= 0 ? 0 : session.purchaseTariffDetails.incl_vat;
    }

    if ('totalTimeInMinExcel' in session) session.totalTimeInMinExcel = session.timeCharged <= 0 ? 0 : (Math.round(session.timeCharged * 60 * 1000) / 1000);
    if ('timeAfterChargedInMinExcel' in session) session.timeAfterChargedInMinExcel = session.timeCharged <= 0 ? 0 : session.timeAfterChargedInMinExcel;

    if ('activationFee' in session) session.activationFee = 0;

    if (session.costPerkWh) {
       session.costPerkWh = session.totalPower <= 0 ? { excl_vat: 0, incl_vat: 0 } : session.costPerkWh;
    }

  }

  return session;
}

module.exports = removeNegativeValuesFromHistory;
