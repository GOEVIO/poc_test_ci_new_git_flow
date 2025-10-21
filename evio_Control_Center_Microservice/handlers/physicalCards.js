require('dotenv-safe').load();
const { findUsersByIds, findContracts } = require('evio-library-identity');
const { retrieveCountryByCountryCode } = require('evio-library-configs');
const axiosS = require('../services/axios');

module.exports = {
  get: (req, res) => getPhysicalCards(req, res),
  post: (req, res) => sendPhysicalCards(req, res),
  cancel: (req, res) => cancelCards(req, res),
  changeCard: (req, res) => changeCard(req, res),
};

async function isValidCountryCode(countryCode) {
  return !!(await retrieveCountryByCountryCode(countryCode));
}

async function getPhysicalCards(req, res) {
  const context = 'Function getPhysicalCards';
  try {
    if (req.headers.isadmin) {
      const hostIdentity =
        process.env.HostUser + process.env.PathGetContratsAdmin;

      const physicalCards = await axiosS.axiosGet(hostIdentity, {});

      putAddressInCards(physicalCards);

      return res.status(200).send(physicalCards);
    }

    return res.status(200).send([]);
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

async function sendPhysicalCards(req, res) {
  const context = 'Function sendPhysicalCards';
  try {
    if (req.headers.isadmin) {
      console.log(req.body);

      if (!req.body.cards) return res.status(400).send('Cards are needed');

      const error = await verifyCards(req.body.cards);

      if (error.length != 0) {
        return res.status(400).send(error);
      }

      const { cards } = req.body;
      const cardsNumbers = [];
      const cardCountryMap = {
        portugal: [],
        other: [],
      };
      const userContracts = [];

      for (let i = 0; i != cards.length; i++) {
        cardsNumbers.push(cards[i].cardNumber);
        userContracts.push(cards[i].contractId);
        if (cards[i].address.countryCode === 'PT') {
          cardCountryMap.portugal.push(cards[i]);
        } else cardCountryMap.other.push(cards[i]);
      }

      const contractQuery = {
        contract_id: { $in: userContracts },
      };
      const userIds = await findContracts(contractQuery, {
        userId: 1,
        contract_id: 1,
      });

      const userIdSet = Array.from(new Set(userIds.map((u) => u.userId)));

      const userEmailLanguage = await findUsersByIds(userIdSet, {
        email: 1,
        language: 1,
      });

      userEmailLanguage.forEach((user) => {
        const contract = userIds.find((c) => c.userId === user._id);
        if (contract) {
          user.contract_id = contract.contract_id;
        }
      });

      Object.keys(cardCountryMap).forEach((key) => {
        cardCountryMap[key].forEach((card) => {
          const user = userEmailLanguage.find(
            (u) => u.contract_id === card.contractId,
          );
          if (user && user.language) {
            card.userLanguage = user.language;
          }
        });
      });

      const hostSibs =
        process.env.HostConfigs + process.env.PathToCreateFileSIBS;

      await Promise.all(
        Object.keys(cardCountryMap).map((key) => {
          if (cardCountryMap[key].length > 0) {
            console.log(
              `Sending ${cardCountryMap[key].length} cards to ${key} country`,
            );
            return axiosS.axiosPostBody(hostSibs, {
              cards: cardCountryMap[key],
            });
          }
          return Promise.resolve();
        }),
      );

      const hostIdentity =
        process.env.HostUser + process.env.PathToProcessStatusUpdate;

      const result = await axiosS.axiosPut(hostIdentity, {
        cardsNumbers,
      });

      return res.status(200).send(result);
    }

    return res.status(200).send();
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

async function cancelCards(req, res) {
  const context = 'Function cancelCards';
  try {
    if (req.headers.isadmin) {
      console.log(req.body);

      if (!req.body.cards) return res.status(400).send('Cards are needed');

      const cards = verifyCardsId(req.body.cards);

      const cardsNumbers = [];

      for (let i = 0; i != cards.length; i++)
        cardsNumbers.push(cards[i].cardNumber);

      const hostIdentity =
        process.env.HostUser + process.env.PathCancelPhysicalCards;

      const result = await axiosS.axiosPut(hostIdentity, {
        cardsNumbers,
      });

      return res.status(200).send(result);
    }

    return res.status(200).send();
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

async function changeCard(req, res) {
  const context = 'Function cancelCards';
  try {
    if (req.headers.isadmin) {
      console.log(req.body);

      if (!req.body.cards) return res.status(400).send('Cards are needed');

      const cards = verifyCardsId(req.body.cards);

      let result = [];

      const hostIdentity = process.env.HostUser + process.env.PathToChangeCard;

      if (cards.length > 0) {
        const areCardsValid = validateCard(cards[0]);
        if (areCardsValid) {
          return res.status(422).send(areCardsValid);
        }

        if (cards[0].address) {
          cards[0].shippingAddress = cards[0].address;
          delete cards[0].address;
        }

        result = await axiosS.axiosPut(hostIdentity, { card: cards[0] });
      }
      return res.status(200).send(result);
    }

    return res.status(200).send();
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

async function verifyCards(cards) {
  const context = 'Function verifyCards';
  try {
    const errors = [];

    for (let i = 0; i != cards.length; i++) {
      if (!cards[i].cardNumber) {
        errors.push({
          auth: false,
          code: 'cardNumberNull',
          message: 'The card number cannot be null',
        });
        continue;
      }

      const { cardNumber } = cards[i];

      if (cards[i].cardNumber.length > process.env.cardNumberMaxSize) {
        const error = {};
        error[cardNumber] = {
          auth: false,
          code: 'cardNumber_maximum_size',
          message: 'The card number cannot be longer than 30 characters',
        };
        errors.push(error);
        continue;
      }

      if (!cards[i].cardPhysicalName) {
        const error = {};
        error[cardNumber] = {
          auth: false,
          code: 'cardPhysicalName_null_notification',
          message: 'Company/Client name is required',
        };
        errors.push(error);
        continue;
      }

      if (
        cards[i].cardPhysicalName.length > process.env.cardPhysicalNameMaxSize
      ) {
        const error = {};
        error[cards[i].cardNumber] = {
          auth: false,
          code: 'cardPhysicalName_maximum_size_exceeded_notification',
          message: 'The Card Number should not exceed 30 characters.',
        };
        errors.push(error);
        continue;
      }

      if (cards[i].cardPhysicalLicensePlate) {
        if (
          cards[i].cardPhysicalLicensePlate.length >
          process.env.cardPhysicalLicensePlateMaxSize
        ) {
          const error = {};
          error[cardNumber] = {
            auth: false,
            code: 'cardPhysicalLicensePlate_maximum_size_excedded_notification',
            message:
              'The Card Physical License Plate should not exceed 30 characters.',
          };
          errors.push(error);
          continue;
        }
      }

      if (cards[i].cardPhysicalText) {
        if (
          cards[i].cardPhysicalText.length > process.env.cardPhysicalTextMaxSize
        ) {
          const error = {};
          error[cardNumber] = {
            auth: false,
            code: 'cardPhysicalText_maximum_size_excedded_notification',
            message: 'The Card Physical Text should not exceed 15 characters.',
          };
          errors.push(error);
          continue;
        }
      }

      // Verify country
      if (!cards[i].address) {
        const error = {};
        error[cardNumber] = {
          auth: false,
          code: 'address_null',
          message: 'The address cannot be null',
        };
        errors.push(error);
        continue;
      } else if (
        !cards[i].address.countryCode ||
        !(await isValidCountryCode(cards[i].address.countryCode))
      ) {
        const error = {};
        error[cardNumber] = {
          auth: false,
          code: 'address_countryCode_null_or_invalid',
          message: 'The countryCode cannot be null or invalid',
        };
        errors.push(error);
        continue;
      }
      /*
            DEPRECATED IN 16/08/2023
            countryCode validation is to be done in Indentity and not Language
            else if (await verifyCountryCode(cards[i].address.countryCode) == "") {
                let error = {}
                error[cardNumber] = "address_countryCode_invalid"
                errors.push(error)
                continue;
            } */
    }
    return errors;
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

function verifyCardsId(cards) {
  const context = 'Function verifyCardsId';
  try {
    const comlpeteCards = [];

    for (let i = 0; i != cards.length; i++) {
      if (cards[i].cardNumber /* && TODO more atributes */) {
        comlpeteCards.push(cards[i]);
      }
    }

    return comlpeteCards;
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
}

async function verifyCountryCode(countryCode) {
  const context = 'Function verifyCountryCode';
  try {
    const hostLanguage =
      process.env.HostLanguage + process.env.PathGetContryCode;

    return await axiosS.axiosGet(hostLanguage, { countryCode });
  } catch (error) {
    console.error(`[${context}] Error `, error);
    return '';
  }
}

function putAddressInCards(cards) {
  const context = 'Function verifyCardsId';
  try {
    for (let i = 0; i != cards.length; i++) {
      fileString = '';

      if (cards[i].address) {
        if (cards[i].address.street) fileString += cards[i].address.street;
        if (cards[i].address.number) {
          fileString += `, n.º ${cards[i].address.number.toLowerCase()}`;
          if (cards[i].address.floor)
            fileString += ` - ${cards[i].address.floor.toLowerCase()}`;
        }
        if (cards[i].address.zipCode)
          fileString += `   ${cards[i].address.zipCode}`;
        if (cards[i].address.city) fileString += ` ${cards[i].address.city}`;
        if (cards[i].address.country)
          fileString += `   ${cards[i].address.country}`;
      }

      cards[i].addressFinalString = fileString;
    }

    return cards;
  } catch (error) {
    console.error(`[${context}] Error `, error);
    throw error;
  }
}

function validateCard(card) {
  if (
    card.cardPhysicalLicensePlate &&
    card.cardPhysicalLicensePlate.length > 30
  ) {
    return {
      auth: false,
      code: 'cardPhysicalLicensePlate_length_exceeded',
      message:
        'The Card Physical License Plate should not exceed 30 characters.',
    };
  }

  if (card.cardPhysicalText && card.cardPhysicalText.length > 15) {
    return {
      auth: false,
      code: 'cardPhysicalText_length_exceeded',
      message: 'The Card Physical Text should not exceed 15 characters.',
    };
  }

  if (card.cardPhysicalName && card.cardPhysicalName.length > 30) {
    return {
      auth: false,
      code: 'cardPhysicalName_length_exceeded',
      message: 'The Card Physical Name should not exceed 30 characters.',
    };
  }

  return null;
}
