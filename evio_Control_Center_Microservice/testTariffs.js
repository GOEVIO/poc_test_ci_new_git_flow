const Utils = require("./utils");

/*

  This file has some use cases to test the calculation of the CPO tariffs either when we receive the charging periods attribute, or, when we don't receive it and need 
  to calculate the tariffs based on the total values of charging time and parking time.

  Functions to test :

    - SCENARIO 1 - When there is no charging_periods array --->   testOpcFinalPrices(testTariffObj);

    - SCENARIO 2 - When charging_periods array exists      --->  testOpcTariffsPrices(testChargingPeriodsObj, testTariffObj);

  To test each function:

    Uncomment/comment the function 

    run -> node testTariffs.js 

*/

/* 
    The expected cost is a value calculated by hand, assuming that every tariff is affected by step_size. In OCPI 2.2 (most of these examples are from there), 
    step_size is much more explained and detailed, however, I don't know if in OCPI 2.1.1 it has a different way to be applied. 
    
    i.e, in 2.2, if the TariffType throughout the session changes or if the tariff changes from TIME to PARKING_TIME, the step_size that is used is only the last one. 

    It's actually a bit tricky and confusing at some point in the documentation. We need to see this better, but for now, step_size is applied in all valid charging tariffs as 
    it is said in 2.1.1 , page 56, chapter 11.3.1.1.4 - Complex Tariff example.

*/
// ======================================================================================================================================================== //
// ==================================================== TEST TARIFFS EXAMPLES (- SCENARIO 1 -)============================================================= //
// ======================================================================================================================================================== //

let testTariffObj = {
  /*
    2 euro per hour charging time (not parking). 
    
    Charging of 0.5h (30min) . Expected cost = 1 euro (without VAT)   

    RESULT - 0K!
*/
  1: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 2.0,
            vat: 10.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z",
    endDate: "2021-05-26T16:30:00Z",
    consumedPower: 2, //not relevant here
    plugPower: 36, //not relevant here
    total_charging_time: 0.5,
    total_parking_time: 0, //not relevant here
    expectedCost: 1,
  },
  /*
    Simple Tariff example 0.25 euro per kWh

        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh

    This tariff will result in costs of 5.00 euro (excl. VAT) or 5.50 euro (incl. VAT) when 20 kWh are charged.

    RESULT - 0K!

*/
  2: {
    tariffElements: [
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.25,
            vat: 10.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z", //not relevant here
    endDate: "2021-05-26T16:30:00Z", //not relevant here
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 0.5, //not relevant here
    total_parking_time: 0, //not relevant here
    expectedCost: 5,
  },
  /*
    Tariff example 0.25 euro per kWh + start fee

        • Start or transaction fee
            • 0.50 euro (excl. VAT)
            • 20% VAT

        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh

    This tariff will result in total cost of 5.50 euro (excl. VAT) or 6.10 euro (incl. VAT) when 20 kWh are charged.

    RESULT - 0K!

*/
  3: {
    tariffElements: [
      {
        price_components: [
          {
            type: "FLAT",
            price: 0.5,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "ENERGY",
            price: 0.25,
            vat: 10.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z", //not relevant here
    endDate: "2021-05-26T16:30:00Z", //not relevant here
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 0.5, //not relevant here
    total_parking_time: 0, //not relevant here
    expectedCost: 5.5,
  },
  /*
   Tariff example 0.25 euro per kWh + parking fee + start fee
        • Start or transaction fee
            • 0.50 euro (excl. VAT)
            • 20% VAT
        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh
        • Parking
            • 2.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 15 min (900 seconds)

    For a charging session where 20 kWh are charged and the vehicle is parked for 40 minutes after the session ended, this tariff will
    result in costs of 7.00 euro (excl. VAT) or 7.90 euro (incl. VAT). Because the parking time is billed per 15 minutes, the driver has to
    pay for 45 minutes of parking even though they left 40 minutes after their vehicle stopped charging.

    RESULT - 0K!

*/
  4: {
    tariffElements: [
      {
        price_components: [
          {
            type: "FLAT",
            price: 0.5,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "ENERGY",
            price: 0.25,
            vat: 10.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 2.0,
            vat: 20.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z", //not relevant here
    endDate: "2021-05-26T17:10:00Z", //not relevant here
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 0.5, //not relevant here
    total_parking_time: 40 / 60,
    expectedCost: 7,
  },
  /*
   Simple Tariff example 2 euro per hour

    An example of a tariff where the driver does not pay per kWh, but for the time of using the Charge Point.

    • Charging Time
        • 2.00 euro per hour (excl. VAT)
        • 10% VAT
        • Billed per 1 min (60 seconds)

    As this is tariff only has a TIME price_component, the driver will not be billed for time they are not charging: PARKING_TIME
    For a charging session of 2.5 hours, this tariff will result in costs of 5.00 euro (excl. VAT) or 5.50 euro (incl. VAT).

    RESULT - 0K!

*/
  5: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 2.0,
            vat: 10.0,
            step_size: 60,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z",
    endDate: "2021-05-26T18:30:00Z",
    consumedPower: 20, //not relevant here
    plugPower: 36, //not relevant here
    total_charging_time: 2.5,
    total_parking_time: 40 / 60, //not relevant here
    expectedCost: 5,
  },

  /*
   Simple Tariff example 3 euro per hour, 5 euro per hour parking
    Example of a tariff where the driver pays for the time of using the Charge Point, but pays more when the car is no longer charging,
    to discourage the EV driver of leaving his EV connected when it is already full.
        • Charging Time
            • 3.00 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 1 min (60 seconds)
        • Parking
            • 5.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 5 min (300 seconds)

    A charging session of 2.5 hours (charging), where the vehicle is parked for 42 more minutes after charging ended, results in a total
    session time of 150 minutes (charging) + 42 minutes (parking). This session with this tariff will result in total cost of 11.25 euro
    (excl. VAT) or 12.75 euro (incl. VAT). Because the parking time is billed per 5 minutes, the driver has to pay for 45 minutes of
    parking even though they left 42 minutes after their vehicle stopped charging.

    RESULT - 0K!

*/
  6: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 3.0,
            vat: 10.0,
            step_size: 60,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 5.0,
            vat: 20.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z",
    endDate: "2021-05-26T19:12:00Z",
    consumedPower: 20, //not relevant here
    plugPower: 36, //not relevant here
    total_charging_time: 2.5,
    total_parking_time: 42 / 60,
    expectedCost: 11.25,
  },

  /*
   Complex Tariff example
    • Start or transaction fee
        • 2.50 euro (excl. VAT)
        • 15% VAT

    • Charging Time
        • When charging with less than 32A
            • 1.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 15 min (900 seconds)
        • When charging with more than 32A on weekdays
            • 2.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 10 min (600 seconds)
        • When charging with more than 32A on weekends
            • 1.25 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 10 min (600 seconds)
    • Parking
        • On weekdays between 09:00 and 18:00
            • 5 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 5 min (300 seconds)
        • On Saturday between 10:00 and 17:00
            • 6 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 5 min (300 seconds)

    For a charging session on a Monday morning starting at 09:30 which takes 2:45 hours (165 minutes), where the driver uses a
    maximum of 16kW of power and is parking for additional 42 minutes afterwards, this tariff will result in costs of 9.00 euro (excl. VAT)
    or 10.30 euro (incl. VAT) for a total session time of 165 minutes (charging) + 42 minutes (parking). The driver has to pay
    for 165 minutes charging (2.75 euro excl. VAT) and 45 minutes of parking as its billed per 5 minutes (3.75 euro excl. VAT).

    RESULT - 0K!

    For a charging session on a Saturday afternoon starting at 13:30 which takes 1:54 hours, where the driver uses a minimum of 43kW
    of power (all the time, which is only theoretically possible) and is parking for additional 71 minutes afterwards, this tariff will result in
    a total cost of 12.5 euro (excl. VAT) . Total charging time of 114 minutes (2.5 euro excl. VAT) + 71
    minutes (parking) due to step_size: 75 minutes (7.50 euro excl VAT).

    RESULT - 0K!

*/
  7: {
    tariffElements: [
      {
        price_components: [
          {
            type: "FLAT",
            price: 2.5,
            vat: 15.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 1.0,
            vat: 20.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_power: 32.0,
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.0,
            vat: 20.0,
            step_size: 600,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_power: 32.0,
          day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 1.25,
            vat: 20.0,
            step_size: 600,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_power: 32.0,
          day_of_week: ["SATURDAY", "SUNDAY"],
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 5.0,
            vat: 10.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "09:00",
          end_time: "18:00",
          day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 6.0,
            vat: 10.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "10:00",
          end_time: "17:00",
          day_of_week: ["SATURDAY"],
        },
      },
    ],
    startDate: "2021-05-24T09:30:00Z",
    endDate: "2021-05-24T12:57:00Z",
    consumedPower: 20, //not relevant here
    plugPower: 16,
    total_charging_time: 2.75,
    total_parking_time: 42 / 60,
    expectedCost: 9,
  },

  8: {
    tariffElements: [
      {
        price_components: [
          {
            type: "FLAT",
            price: 2.5,
            vat: 15.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 1.0,
            vat: 20.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_power: 32.0,
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.0,
            vat: 20.0,
            step_size: 600,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_power: 32.0,
          day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 1.25,
            vat: 20.0,
            step_size: 600,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_power: 32.0,
          day_of_week: ["SATURDAY", "SUNDAY"],
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 5.0,
            vat: 10.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "09:00",
          end_time: "18:00",
          day_of_week: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 6.0,
            vat: 10.0,
            step_size: 300,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "10:00",
          end_time: "17:00",
          day_of_week: ["SATURDAY"],
        },
      },
    ],
    startDate: "2021-05-22T13:30:00Z",
    endDate: "2021-05-22T16:35:00Z",
    consumedPower: 20, //not relevant here
    plugPower: 43,
    total_charging_time: 1.9,
    total_parking_time: 71 / 60,
    expectedCost: 12.5,
  },

  /*
   Free of Charge Tariff example

    In this example no VAT is given because it is not necessary (as the price is 0.00). This might not always be the case though and
    it is of course permitted to add a VAT, even if the price is set to zero.

    RESULT - 0K!

*/
  9: {
    tariffElements: [
      {
        price_components: [
          {
            type: "FLAT",
            price: 0.0,
            step_size: 0,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T16:00:00Z",
    endDate: "2021-05-26T19:12:00Z",
    consumedPower: 20, //not relevant here
    plugPower: 36, //not relevant here
    total_charging_time: 2.5,
    total_parking_time: 42 / 60,
    expectedCost: 0,
  },

  /*
   First hour free energy example

    In this example, we have the following scenario:

        • The first hour of parking time is free.
        • From the second to the fourth hour, parking costs 2.00 euro per hour
        • From the fourth hour on, parking costs 3.00 euro per hour.
        • The first kWh of energy is free, every additional kWh costs 0.20 euro.

    Translated into our tariff schema, the pricing model looks like this:
        • Energy
            • First kWh: free
            • Any additional energy
                • 0.20 euro per kWh (excl. VAT)
                • Billed per 1 Wh
        • Parking
            • First hour of parking: free
            • Second to fourth hours of parking
                • 2.00 euro per hour (excl. VAT)
                • Billed per 1 min (60 seconds)
            • Any parking after four hours
                • 3.00 euro per hour (excl. VAT)
                • Billed per 1 min (60 seconds)

    For a charging session where the driver charges 20 kWh and where the vehicle is parked for 2:45 more hours after charging ended,
    this tariff will result in costs of 7.30 euro (excl. VAT).

    Cost breakdown:
        • Energy: 19 kWh (first kWh is free) = 3.80 euro.
        • Parking: 2:45 hours = 1:45 hours of paid parking (105 minutes) = 3.50 euro

    As no VAT information is given, it is not possible to calculate total costs including VAT.

     RESULT - 0K!

*/
  10: {
    tariffElements: [
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 0.0,
            step_size: 60,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_duration: 0,
          max_duration: 3600,
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 2.0,
            step_size: 60,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_duration: 3600,
          max_duration: 10800,
        },
      },
      {
        price_components: [
          {
            type: "PARKING_TIME",
            price: 3.0,
            step_size: 60,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_duration: 10800,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_kwh: 1.0,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.2,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          min_kwh: 1.0,
        },
      },
    ],
    startDate: "2021-05-26T16:00:00Z",
    endDate: "2021-05-26T21:15:00Z",
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 2.5,
    total_parking_time: 2.75,
    expectedCost: 7.3,
  },

  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to different Tariff Element #1
    An EV driver plugs in at 16:55 and charges for 10 minutes (TIME). They then stop charging but stay plugged in for 2 more minutes
    (PARKING_TIME). The total session time is therefore 12 minutes, resulting in the following costs:

        • 5 billable minutes of charging time before 17:00, generating costs of 0.10 euro.
        • 5 billable minutes of charging time after 17:00, generating costs of 0.20 euro. (step_size is not taken into account as we
            are switching to another time based Tariff Element).
        • 5 billable minutes of parking time (due to the step_size, total duration of 12 minutes is rounded to 15 minutes), generating
            costs of 0.083 euro.

    RESULT - 0K!
*/
  11: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 1.2,
            step_size: 1800,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "00:00",
          end_time: "17:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "17:00",
          end_time: "20:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "20:00",
          end_time: "00:00",
        },
      },
    ],
    startDate: "2021-05-26T16:55:00Z",
    endDate: "2021-05-26T17:07:00Z",
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 10 / 60,
    total_parking_time: 2 / 60,
    expectedCost: 1.45,
  },

  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to different Tariff Element #2
    An EV driver plugs in at 16:35 and charges for 35 minutes (TIME). After that they immediately unplug, leaving with a total session
    time of 35 minutes and a bill over the following costs:

        • 25 billable minutes of charging time before 17:00, generating costs of 0.50 euro.
        • 20 billable minutes of charging time after 17:00, generating costs of 0.80 euro. As the Price Component of the last Tariff
            Element being used has a step_size of 15 minutes, the total duration is rounded to up to 45 minutes. When considering
            the already billed 25 minutes of charging time before 17:00, we are left with 20 minutes to bill after 17:00.
        • The total for this charging session is therefore 1.30 euro (excl. VAT).

    
    RESULT - 0K!
*/
  12: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 1.2,
            step_size: 1800,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "00:00",
          end_time: "17:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "17:00",
          end_time: "20:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "20:00",
          end_time: "00:00",
        },
      },
    ],
    startDate: "2021-05-26T16:35:00Z",
    endDate: "2021-05-26T17:10:00Z",
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 35 / 60,
    total_parking_time: 0 / 60,
    expectedCost: 1.2,
  },
  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to Free-of-Charge Tariff Element

    When parking becomes free after 20:00, the new TariffElement after 20:00 will not contain a PARKING_TIME (or TIME)
    PriceComponent. So the last parking period that needs to be paid, which is before 20:00, will be billed according to the
    step_size of the PARKING_TIME PriceComponent before 20:00.

    An EV driver plugs in at 19:40 and charges for 12 minutes (TIME). They then stop charging but stay plugged in for 20 more minutes
    (PARKING_TIME). The total session time is therefore 12 minutes, resulting in the following costs:

        • 12 billable minutes of charging time, generating costs of 0.48 euro.
        • 18 billable minutes of parking time, generating costs of 0.30 euro. As the Price Component of the last Tariff Element being
            used has a step_size of 15 minutes, we bill a total duration of 30 minutes. When considering the already billed 12
            minutes of charging time, we are left with 18 minutes of parking time to bill. The fact that parking is free after 20:00 has no
            impact on step_size
        • The total for this charging session is therefore 0.78 euro (excl. VAT).

    
    RESULT - 0K!
*/
  13: {
    tariffElements: [
      {
        price_components: [
          {
            type: "TIME",
            price: 1.2,
            step_size: 1800,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "00:00",
          end_time: "17:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
          {
            type: "PARKING_TIME",
            price: 1.0,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "17:00",
          end_time: "20:00",
        },
      },
      {
        price_components: [
          {
            type: "TIME",
            price: 2.4,
            step_size: 900,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          start_time: "20:00",
          end_time: "00:00",
        },
      },
    ],
    startDate: "2021-05-26T19:40:00Z",
    endDate: "2021-05-26T20:12:00Z",
    consumedPower: 20,
    plugPower: 36, //not relevant here
    total_charging_time: 12 / 60,
    total_parking_time: 20 / 60,
    expectedCost: 0.85,
  },
  /*
    Example Tariff to explain the max_power Tariff Restriction:

        • Charging fee of 0.20 euro per kWh (excl. VAT) when charging with a power of less than 16 kW.
        • Charging fee of 0.35 euro per kWh (excl. VAT) when charging with a power between 16 and 32 kW.
        • Charging fee of 0.50 euro per kWh (excl. VAT) when charging with a power above 32 kW (implemented as fallback tariff without Restriction).

    For a charging session where the EV charges the first kWh with a power of 6 kW, increases the power to 48 kW for the next 40 kWh
    and reduces it again to 4 kW after that for another 0.5 kWh (probably due to physical limitations, i.e. temperature of the battery), this
    tariff will result in costs of 20.30 euro (excl. VAT). The costs are composed of the following components:

        • 1 kWh at 6 kW: 0.20 euro
        • 40 kWh at 48 kW: 20.00 euro
        • 0.5 kWh at 4 kW: 0.10 euro
    
    RESULT - 0K!
*/
  14: {
    tariffElements: [
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.2,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_power: 16.0,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.35,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_power: 32.0,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.5,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T19:40:00Z",
    endDate: "2021-05-26T19:50:00Z",
    consumedPower: 40,
    plugPower: 50, //not relevant here
    total_charging_time: 10 / 60,
    total_parking_time: 20 / 60,
    expectedCost: 20,
  },
  /*
     Example: Tariff with max_duration Tariff Restrictions

        A supermarket wants to allow their customer to charge for free. As most customers will be out of the store in 20 minutes, they allow
        free charging for 30 minutes. If a customer charges longer than that, they will charge them the normal price per kWh. But as they
        want to discourage long usage of their Charge Points, charging becomes much more expensive after 1 hour:

            • First 30 minutes of charging is free.
            • Charging fee of 0.25 euro per kWh (excl. VAT) after 30 minutes.
            • Charging fee of 0.40 euro per kWh (excl. VAT) after 60 minutes.

        For a charging session with a duration of 40 minutes where 4.65 kWh are charged during the first 30 minutes and another 1.55 kWh in
        the remaining 10 minutes of the session, this tariff will result in costs of 0.30 euro (excl. VAT). The costs are composed of the
        following components:

            • 4.65 kWh for free: 0.00 euro
            • 1.55 kWh at 0.25/kWh: 0.3875 euro
    
      RESULT - OK!
*/
  15: {
    tariffElements: [
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.0,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_duration: 1800,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.25,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
        restrictions: {
          max_duration: 3600,
        },
      },
      {
        price_components: [
          {
            type: "ENERGY",
            price: 0.4,
            vat: 20.0,
            step_size: 1,
            price_round : {
              round_granularity : "HUNDREDTH",
              round_rule : "ROUND_NEAR"
            },
            step_round : {
              round_granularity : "UNIT",
              round_rule : "ROUND_UP"
            }
          },
        ],
      },
    ],
    startDate: "2021-05-26T19:40:00Z",
    endDate: "2021-05-26T20:20:00Z",
    consumedPower: 6.2,
    plugPower: 4, //not relevant here
    total_charging_time: 40 / 60,
    total_parking_time: 0 / 60,
    expectedCost: 0.3875,
  },
};

function testOpcFinalPrices(testTariffsObj) {
  let responseObj = {
    total: Object.keys(testTariffsObj).length,
    passed: 0,
    failed: 0,
    failedTariffs: [],
  };
  for (let key in testTariffObj) {
    // Change here the tariff to test:
    let testTariff = testTariffObj[key];
    // console.log("testTariff.tariffElements" , testTariff.tariffElements)
    // let elem = Utils.createTariffElementsAccordingToRestriction(testTariff.tariffElements ,  testTariff.startDate , testTariff.endDate )
    // elem.forEach(element => {
    //   console.log(element)
    // })
    // console.log(testTariff.tariffElements)
    let [flat, energy, time, parking] = Utils.opcFinalPrices(
      Utils.createTariffElementsAccordingToRestriction(testTariff.tariffElements ,  testTariff.startDate , testTariff.endDate ),
      // testTariff.tariffElements,
      testTariff.startDate,
      testTariff.endDate,
      testTariff.consumedPower,
      testTariff.plugPower,
      testTariff.total_charging_time,
      testTariff.total_parking_time
    );
    let OCP_PRICE_FLAT = flat.price;
    let OCP_PRICE_TIME = time.price;
    let OCP_PRICE_ENERGY = energy.price;
    let OCP_PRICE_PARKING_TIME = parking.price;

    let TOTAL_PRICE =
      OCP_PRICE_FLAT +
      OCP_PRICE_ENERGY +
      OCP_PRICE_TIME +
      OCP_PRICE_PARKING_TIME;

    if (testTariff.expectedCost.toFixed(2) === TOTAL_PRICE.toFixed(2)) {
      responseObj.passed++;
    } else {
      responseObj.failed++;
      responseObj.failedTariffs.push(`Tariff ${key}`);
    }
  }
  console.log();
  console.log(
    "========================== testOpcFinalPrices =========================="
  );
  console.log();
  console.log(" RESULT :", responseObj);
  console.log();
  console.log();
}

// ======================================================================================================================================================== //
// ======================================================== CHARGING PERIODS EXAMPLES (- SCENARIO 2 -)===================================================== //
// ======================================================================================================================================================== //

let testChargingPeriodsObj = {
  /*
    2 euro per hour charging time (not parking). 
    
    Charging of 0.5h (30min) . Expected cost = 1 euro (without VAT)   

*/
  1: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 0.5,
          },
        ],
      },
    ],
  },

  /*
    Simple Tariff example 0.25 euro per kWh

        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh

    This tariff will result in costs of 5.00 euro (excl. VAT) or 5.50 euro (incl. VAT) when 20 kWh are charged.

    RESULT - 0K!

*/
  2: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 20,
          },
        ],
      },
    ],
  },
  /*
    Tariff example 0.25 euro per kWh + start fee

        • Start or transaction fee
            • 0.50 euro (excl. VAT)
            • 20% VAT

        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh

    This tariff will result in total cost of 5.50 euro (excl. VAT) or 6.10 euro (incl. VAT) when 20 kWh are charged.

    RESULT - 0K!

*/
  3: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "FLAT",
            volume: 0.5,
          },
          {
            type: "ENERGY",
            volume: 20,
          },
        ],
      },
    ],
  },

  /*
   Tariff example 0.25 euro per kWh + parking fee + start fee
        • Start or transaction fee
            • 0.50 euro (excl. VAT)
            • 20% VAT
        • Energy
            • 0.25 euro per kWh (excl. VAT)
            • 10% VAT
            • Billed per 1 Wh
        • Parking
            • 2.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 15 min (900 seconds)

    For a charging session where 20 kWh are charged and the vehicle is parked for 40 minutes after the session ended, this tariff will
    result in costs of 7.00 euro (excl. VAT) or 7.90 euro (incl. VAT). Because the parking time is billed per 15 minutes, the driver has to
    pay for 45 minutes of parking even though they left 40 minutes after their vehicle stopped charging.

    RESULT - 0K!

*/
  4: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "FLAT",
            volume: 0.5,
          },
          {
            type: "ENERGY",
            volume: 20,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T16:30:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 2 / 3,
          },
        ],
      },
    ],
  },
  /*
   Simple Tariff example 2 euro per hour

    An example of a tariff where the driver does not pay per kWh, but for the time of using the Charge Point.

    • Charging Time
        • 2.00 euro per hour (excl. VAT)
        • 10% VAT
        • Billed per 1 min (60 seconds)

    As this is tariff only has a TIME price_component, the driver will not be billed for time they are not charging: PARKING_TIME
    For a charging session of 2.5 hours, this tariff will result in costs of 5.00 euro (excl. VAT) or 5.50 euro (incl. VAT).

    RESULT - 0K!

*/
  5: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 2.5,
          },
        ],
      },
    ],
  },

  /*
   Simple Tariff example 3 euro per hour, 5 euro per hour parking
    Example of a tariff where the driver pays for the time of using the Charge Point, but pays more when the car is no longer charging,
    to discourage the EV driver of leaving his EV connected when it is already full.
        • Charging Time
            • 3.00 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 1 min (60 seconds)
        • Parking
            • 5.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 5 min (300 seconds)

    A charging session of 2.5 hours (charging), where the vehicle is parked for 42 more minutes after charging ended, results in a total
    session time of 150 minutes (charging) + 42 minutes (parking). This session with this tariff will result in total cost of 11.25 euro
    (excl. VAT) or 12.75 euro (incl. VAT). Because the parking time is billed per 5 minutes, the driver has to pay for 45 minutes of
    parking even though they left 42 minutes after their vehicle stopped charging.

    RESULT - 0K!

*/
  6: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 2.5,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T18:30:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 42 / 60,
          },
        ],
      },
    ],
  },

  /*
   Complex Tariff example
    • Start or transaction fee
        • 2.50 euro (excl. VAT)
        • 15% VAT

    • Charging Time
        • When charging with less than 32A
            • 1.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 15 min (900 seconds)
        • When charging with more than 32A on weekdays
            • 2.00 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 10 min (600 seconds)
        • When charging with more than 32A on weekends
            • 1.25 euro per hour (excl. VAT)
            • 20% VAT
            • Billed per 10 min (600 seconds)
    • Parking
        • On weekdays between 09:00 and 18:00
            • 5 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 5 min (300 seconds)
        • On Saturday between 10:00 and 17:00
            • 6 euro per hour (excl. VAT)
            • 10% VAT
            • Billed per 5 min (300 seconds)

    For a charging session on a Monday morning starting at 09:30 which takes 2:45 hours (165 minutes), where the driver uses a
    maximum of 16kW of power and is parking for additional 42 minutes afterwards, this tariff will result in costs of 9.00 euro (excl. VAT)
    or 10.30 euro (incl. VAT) for a total session time of 165 minutes (charging) + 42 minutes (parking). The driver has to pay
    for 165 minutes charging (2.75 euro excl. VAT) and 45 minutes of parking as its billed per 5 minutes (3.75 euro excl. VAT).

    RESULT - 0K!

    For a charging session on a Saturday afternoon starting at 13:30 which takes 1:54 hours, where the driver uses a minimum of 43kW
    of power (all the time, which is only theoretically possible) and is parking for additional 71 minutes afterwards, this tariff will result in
    a total cost of 12.5 euro (excl. VAT) . Total charging time of 114 minutes (2.5 euro excl. VAT) + 71
    minutes (parking) due to step_size: 75 minutes (7.50 euro excl VAT).

    RESULT - 0K!

*/
  7: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-24T09:30:00Z",
        dimensions: [
          {
            type: "FLAT",
            volume: 2.5,
          },
          {
            type: "TIME",
            volume: 2.75,
          },
          {
            type: "MIN_CURRENT",
            volume: 69,
          },
        ],
      },
      {
        start_date_time: "2021-05-24T12:15:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 42 / 60,
          },
        ],
      },
    ],
  },
  8: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-22T09:30:00Z",
        dimensions: [
          {
            type: "FLAT",
            volume: 2.5,
          },
          {
            type: "TIME",
            volume: 1.9,
          },
          {
            type: "MAX_CURRENT",
            volume: 187,
          },
        ],
      },
      {
        start_date_time: "2021-05-22T11:24:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 71 / 60,
          },
        ],
      },
    ],
  },

  /*
   Free of Charge Tariff example

    In this example no VAT is given because it is not necessary (as the price is 0.00). This might not always be the case though and
    it is of course permitted to add a VAT, even if the price is set to zero.

    RESULT - 0K!

*/
  9: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "FLAT",
            volume: 0,
          },
        ],
      },
    ],
  },

  /*
   First hour free energy example

    In this example, we have the following scenario:

        • The first hour of parking time is free.
        • From the second to the fourth hour, parking costs 2.00 euro per hour
        • From the fourth hour on, parking costs 3.00 euro per hour.
        • The first kWh of energy is free, every additional kWh costs 0.20 euro.

    Translated into our tariff schema, the pricing model looks like this:
        • Energy
            • First kWh: free
            • Any additional energy
                • 0.20 euro per kWh (excl. VAT)
                • Billed per 1 Wh
        • Parking
            • First hour of parking: free
            • Second to fourth hours of parking
                • 2.00 euro per hour (excl. VAT)
                • Billed per 1 min (60 seconds)
            • Any parking after four hours
                • 3.00 euro per hour (excl. VAT)
                • Billed per 1 min (60 seconds)

    For a charging session where the driver charges 20 kWh and where the vehicle is parked for 2:45 more hours after charging ended,
    this tariff will result in costs of 7.30 euro (excl. VAT).

    Cost breakdown:
        • Energy: 19 kWh (first kWh is free) = 3.80 euro.
        • Parking: 2:45 hours = 1:45 hours of paid parking (105 minutes) = 3.50 euro

    As no VAT information is given, it is not possible to calculate total costs including VAT.

     RESULT - 0K!

*/

  10: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:00:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 1,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T16:07:30Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 19,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T18:30:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 1,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T19:30:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 1.75,
          },
        ],
      },
    ],
  },

  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to different Tariff Element #1
    An EV driver plugs in at 16:55 and charges for 10 minutes (TIME). They then stop charging but stay plugged in for 2 more minutes
    (PARKING_TIME). The total session time is therefore 12 minutes, resulting in the following costs:

        • 5 billable minutes of charging time before 17:00, generating costs of 0.10 euro.
        • 5 billable minutes of charging time after 17:00, generating costs of 0.20 euro. (step_size is not taken into account as we
            are switching to another time based Tariff Element).
        • 5 billable minutes of parking time (due to the step_size, total duration of 12 minutes is rounded to 15 minutes), generating
            costs of 0.083 euro.

    RESULT - 0K!
*/

  11: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:55:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 5 / 60,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T17:00:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 5 / 60,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T17:05:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 2 / 60,
          },
        ],
      },
    ],
  },

  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to different Tariff Element #2
    An EV driver plugs in at 16:35 and charges for 35 minutes (TIME). After that they immediately unplug, leaving with a total session
    time of 35 minutes and a bill over the following costs:

        • 25 billable minutes of charging time before 17:00, generating costs of 0.50 euro.
        • 20 billable minutes of charging time after 17:00, generating costs of 0.80 euro. As the Price Component of the last Tariff
            Element being used has a step_size of 15 minutes, the total duration is rounded to up to 45 minutes. When considering
            the already billed 25 minutes of charging time before 17:00, we are left with 20 minutes to bill after 17:00.
        • The total for this charging session is therefore 1.30 euro (excl. VAT).

    
    RESULT - 0K!
*/
  12: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T16:35:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 25 / 60,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T17:00:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 10 / 60,
          },
        ],
      },
    ],
  },
  /*
    • Charging fee of 1.20 euro per hour (excl. VAT) before 17:00 with a step_size of 30 minutes (1800 seconds)
    • Charging fee of 2.40 euro per hour (excl. VAT) after 17:00 with a step_size of 15 minutes (900 seconds)
    • Parking fee of 1.00 euro per hour (excl. VAT) before 20:00 with a step_size of 15 minutes (900 seconds)

    Example: switching to Free-of-Charge Tariff Element

    When parking becomes free after 20:00, the new TariffElement after 20:00 will not contain a PARKING_TIME (or TIME)
    PriceComponent. So the last parking period that needs to be paid, which is before 20:00, will be billed according to the
    step_size of the PARKING_TIME PriceComponent before 20:00.

    An EV driver plugs in at 19:40 and charges for 12 minutes (TIME). They then stop charging but stay plugged in for 20 more minutes
    (PARKING_TIME). The total session time is therefore 12 minutes, resulting in the following costs:

        • 12 billable minutes of charging time, generating costs of 0.48 euro.
        • 18 billable minutes of parking time, generating costs of 0.30 euro. As the Price Component of the last Tariff Element being
            used has a step_size of 15 minutes, we bill a total duration of 30 minutes. When considering the already billed 12
            minutes of charging time, we are left with 18 minutes of parking time to bill. The fact that parking is free after 20:00 has no
            impact on step_size
        • The total for this charging session is therefore 0.78 euro (excl. VAT).

    
    RESULT - 0K!
*/
  13: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T19:40:00Z",
        dimensions: [
          {
            type: "TIME",
            volume: 12 / 60,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T19:52:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 8 / 60,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T20:00:00Z",
        dimensions: [
          {
            type: "PARKING_TIME",
            volume: 12 / 60,
          },
        ],
      },
    ],
  },

  /*
    Example Tariff to explain the max_power Tariff Restriction:

        • Charging fee of 0.20 euro per kWh (excl. VAT) when charging with a power of less than 16 kW.
        • Charging fee of 0.35 euro per kWh (excl. VAT) when charging with a power between 16 and 32 kW.
        • Charging fee of 0.50 euro per kWh (excl. VAT) when charging with a power above 32 kW (implemented as fallback tariff without Restriction).

    For a charging session where the EV charges the first kWh with a power of 6 kW, increases the power to 48 kW for the next 40 kWh
    and reduces it again to 4 kW after that for another 0.5 kWh (probably due to physical limitations, i.e. temperature of the battery), this
    tariff will result in costs of 20.30 euro (excl. VAT). The costs are composed of the following components:

        • 1 kWh at 6 kW: 0.20 euro
        • 40 kWh at 48 kW: 20.00 euro
        • 0.5 kWh at 4 kW: 0.10 euro
    
    RESULT - 0K!
*/

  14: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T19:40:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 1,
          },
          {
            type: "MIN_CURRENT",
            volume: 27,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T20:10:30Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 40,
          },
          {
            type: "MIN_CURRENT",
            volume: 209,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T22:10:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 0.5,
          },
          {
            type: "MIN_CURRENT",
            volume: 24,
          },
        ],
      },
    ],
    expectedCost: 20.3,
  },
  /*
     Example: Tariff with max_duration Tariff Restrictions

        A supermarket wants to allow their customer to charge for free. As most customers will be out of the store in 20 minutes, they allow
        free charging for 30 minutes. If a customer charges longer than that, they will charge them the normal price per kWh. But as they
        want to discourage long usage of their Charge Points, charging becomes much more expensive after 1 hour:

            • First 30 minutes of charging is free.
            • Charging fee of 0.25 euro per kWh (excl. VAT) after 30 minutes.
            • Charging fee of 0.40 euro per kWh (excl. VAT) after 60 minutes.

        For a charging session with a duration of 40 minutes where 4.65 kWh are charged during the first 30 minutes and another 1.55 kWh in
        the remaining 10 minutes of the session, this tariff will result in costs of 0.30 euro (excl. VAT). The costs are composed of the
        following components:

            • 4.65 kWh for free: 0.00 euro
            • 1.55 kWh at 0.25/kWh: 0.3875 euro
    
    RESULT - OK!
*/
  15: {
    chargingPeriods: [
      {
        start_date_time: "2021-05-26T19:40:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 4.65,
          },
        ],
      },
      {
        start_date_time: "2021-05-26T20:10:00Z",
        dimensions: [
          {
            type: "ENERGY",
            volume: 1.55,
          },
        ],
      },
    ],
    expectedCost: 0.3875,
  },
  // 15: {
  //   tariffElements: [
  //     {
  //       price_components: [
  //         {
  //           type: "ENERGY",
  //           price: 0.0,
  //           vat: 20.0,
  //           step_size: 1,
  //         },
  //       ],
  //       restrictions: {
  //         max_duration: 1800,
  //       },
  //     },
  //     {
  //       price_components: [
  //         {
  //           type: "ENERGY",
  //           price: 0.25,
  //           vat: 20.0,
  //           step_size: 1,
  //         },
  //       ],
  //       restrictions: {
  //         max_duration: 3600,
  //       },
  //     },
  //     {
  //       price_components: [
  //         {
  //           type: "ENERGY",
  //           price: 0.4,
  //           vat: 20.0,
  //           step_size: 1,
  //         },
  //       ],
  //     },
  //   ],
  //   startDate: "2021-05-26T19:40:00Z",
  //   endDate: "2021-05-26T20:20:00Z",
  //   consumedPower: 6.2,
  //   plugPower: 50, //not relevant here
  //   total_charging_time: 40 / 60,
  //   total_parking_time: 0 / 60,
  //   expectedCost: 0.3875,
  // },
};

function testOpcTariffsPrices(testChargingPeriodsObj, testTariffsObj) {
  let responseObj = {
    total: Object.keys(testChargingPeriodsObj).length,
    passed: 0,
    failed: 0,
    failedTariffs: [],
  };
  for (let key in testChargingPeriodsObj) {
    // Change here the tariff to test:

    let testChargingPeriod = testChargingPeriodsObj[key];
    let testTariff = testTariffsObj[key];

    let [flat, energy, time, parking] = Utils.opcTariffsPrices(
      testChargingPeriod.chargingPeriods,
      testTariff.tariffElements,
      testTariff.startDate,
      testTariff.endDate,
      0,
      testTariff.plugPower,
      230,
      testTariff.consumedPower,
      testTariff.total_charging_time,
      testTariff.total_parking_time
    );

    let OCP_PRICE_FLAT = flat.price;
    let OCP_PRICE_TIME = time.price;
    let OCP_PRICE_ENERGY = energy.price;
    let OCP_PRICE_PARKING_TIME = parking.price;

    let TOTAL_PRICE =
      OCP_PRICE_FLAT +
      OCP_PRICE_ENERGY +
      OCP_PRICE_TIME +
      OCP_PRICE_PARKING_TIME;

    if (
      testChargingPeriod.expectedCost !== undefined &&
      testChargingPeriod.expectedCost !== null
    ) {
      if (
        testChargingPeriod.expectedCost.toFixed(2) === TOTAL_PRICE.toFixed(2)
      ) {
        responseObj.passed++;
      } else {
        responseObj.failed++;
        responseObj.failedTariffs.push(`Tariff ${key}`);
      }
    } else {
      if (testTariff.expectedCost.toFixed(2) === TOTAL_PRICE.toFixed(2)) {
        responseObj.passed++;
      } else {
        responseObj.failed++;
        responseObj.failedTariffs.push(`Tariff ${key}`);
      }
    }
  }
  console.log();
  console.log(
    "========================== testOpcTariffsPrices =========================="
  );
  console.log();
  console.log(" RESULT :", responseObj);
  console.log();
  console.log();
}

// ====================== UNCOMMENT FOLLOWING FUNCTIONS TO TEST THEM  ====================== //

testOpcFinalPrices(testTariffObj);

testOpcTariffsPrices(testChargingPeriodsObj, testTariffObj);
