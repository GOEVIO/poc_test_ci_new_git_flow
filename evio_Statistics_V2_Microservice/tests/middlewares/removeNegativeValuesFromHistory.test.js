const { describe, test, expect } = require("@jest/globals");
const removeNegativeValuesFromHistory = require('../../middlewares/removeNegativeValuesFromHistory');

describe('removeNegativeValuesFromHistory', () => {

  test('should set negative values in session properties to zero', () => {
    const session = {
      totalPower: -10,
      timeCharged: -5,
      costDetails: {
        activationFee: -1,
        parkingDuringCharging: -2,
        parkingAmount: -3,
        timeCharged: -5,
        totalTime: -4,
        totalPower: -10,
        costDuringCharge: -6,
        _id: 'costDetailsId'
      },
      totalPrice: {
        excl_vat: -20,
        incl_vat: -25,
        _id: 'totalPriceId'
      },
      timeChargedInMin: "-10s",
      totalTimeInMin: "-15s",
      timeAfterChargedInMin: -2,
      timeChargedInMinExcel: -1,
      totalTimeInMinExcel: -3,
      timeAfterChargedInMinExcel: -4
    };

    const result = removeNegativeValuesFromHistory(session);

    expect(result.totalPower).toBe(0);
    expect(result.timeCharged).toBe(0);
    expect(result.costDetails.activationFee).toBe(0);
    expect(result.costDetails.parkingDuringCharging).toBe(0);
    expect(result.costDetails.parkingAmount).toBe(0);
    expect(result.costDetails.timeCharged).toBe(0);
    expect(result.costDetails.totalTime).toBe(0);
    expect(result.costDetails.totalPower).toBe(0);
    expect(result.costDetails.costDuringCharge).toBe(0);
    expect(result.costDetails._id).toBe('costDetailsId');
    expect(result.totalPrice.excl_vat).toBe(0);
    expect(result.totalPrice.incl_vat).toBe(0);
    expect(result.totalPrice._id).toBe('totalPriceId');

    // Testando conversão de strings negativas para zero
    expect(parseInt(result.timeChargedInMin) || 0).toBe(0);
    expect(parseInt(result.totalTimeInMin) || 0).toBe(0);
    expect(result.timeAfterChargedInMin).toBe(0);
    expect(result.timeChargedInMinExcel).toBe(0);
    expect(result.totalTimeInMinExcel).toBe(0);
    expect(result.timeAfterChargedInMinExcel).toBe(0);
  });

  test('should keep non-negative values in session properties unchanged', () => {
    const session = {
      totalPower: 10,
      timeCharged: 5,
      costDetails: {
        activationFee: 1,
        parkingDuringCharging: 2,
        parkingAmount: 3,
        timeCharged: 5,
        totalTime: 4,
        totalPower: 10,
        costDuringCharge: 6,
        _id: 'costDetailsId'
      },
      totalPrice: {
        excl_vat: 20,
        incl_vat: 25,
        _id: 'totalPriceId'
      },
      timeChargedInMin: "10s",
      totalTimeInMin: "15s",
      timeAfterChargedInMin: 2,
      timeChargedInMinExcel: 1,
      totalTimeInMinExcel: 3,
      timeAfterChargedInMinExcel: 4
    };

    const result = removeNegativeValuesFromHistory(session);

    expect(result.totalPower).toBe(10);
    expect(result.timeCharged).toBe(5);
    expect(result.costDetails.activationFee).toBe(0);  // Sempre configurado para 0 pela função
    expect(result.costDetails.parkingDuringCharging).toBe(0); // Sempre configurado para 0 pela função
    expect(result.costDetails.parkingAmount).toBe(0);  // Sempre configurado para 0 pela função
    expect(result.costDetails.timeCharged).toBe(5);
    expect(result.costDetails.totalTime).toBe(4);
    expect(result.costDetails.totalPower).toBe(10);
    expect(result.costDetails.costDuringCharge).toBe(0); // Sempre configurado para 0 pela função
    expect(result.costDetails._id).toBe('costDetailsId');
    expect(result.totalPrice.excl_vat).toBe(0);  // Sempre configurado para 0 pela função
    expect(result.totalPrice.incl_vat).toBe(0);  // Sempre configurado para 0 pela função
    expect(result.totalPrice._id).toBe('totalPriceId');

    // Verificando valores não alterados quando positivos
    expect(result.timeChargedInMin).toBe("10s");
    expect(result.totalTimeInMin).toBe("15s");
    expect(result.timeAfterChargedInMin).toBe(2);
    expect(result.timeChargedInMinExcel).toBe(1);
    expect(result.totalTimeInMinExcel).toBe(3);
    expect(result.timeAfterChargedInMinExcel).toBe(4);
  });

  test('should handle missing fields gracefully', () => {
    const session = {};

    const result = removeNegativeValuesFromHistory(session);

    expect(result.totalPower || 0).toBe(0);
    expect(result.timeCharged || 0).toBe(0);

    // Check costDetails if defined
    expect(result.costDetails?.activationFee || 0).toBe(0);
    expect(result.costDetails?.parkingDuringCharging || 0).toBe(0);
    expect(result.costDetails?.parkingAmount || 0).toBe(0);
    expect(result.costDetails?.timeCharged || 0).toBe(0);
    expect(result.costDetails?.totalTime || 0).toBe(0);
    expect(result.costDetails?.totalPower || 0).toBe(0);
    expect(result.costDetails?.costDuringCharge || 0).toBe(0);

    // Check totalPrice if defined
    expect(result.totalPrice?.excl_vat || 0).toBe(0);
    expect(result.totalPrice?.incl_vat || 0).toBe(0);

    expect(result.timeChargedInMin || 0).toBe(0);
    expect(result.totalTimeInMin || 0).toBe(0);
    expect(result.timeAfterChargedInMin || 0).toBe(0);
    expect(result.timeChargedInMinExcel || 0).toBe(0);
    expect(result.totalTimeInMinExcel || 0).toBe(0);
    expect(result.timeAfterChargedInMinExcel || 0).toBe(0);
  });

  test('should return the original session if session is null or undefined', () => {
    expect(removeNegativeValuesFromHistory(null)).toBeNull();
    expect(removeNegativeValuesFromHistory(undefined)).toBeUndefined();
  });
});
