require('dotenv-safe').load();
const moment = require('moment');
const Sentry = require('@sentry/node');
const { createClient } = require('webdav');
const Excel = require('exceljs');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { retrieveCountryByCountryCode } = require('evio-library-configs');
const SIBS = require('../models/sibs');
const nodemailerS = require('./../services/nodemailer');
const Constants = require('../utils/constants');

const {
    txtfile_cardnumber_start,
    txtfile_cardnumber_length,
    txtfile_idTagDec_start,
    txtfile_idTagDec_length,
    txtfile_decimalTag_start,
    txtfile_decimalTag_length,
} = Constants.sibs;

const { connectionConfigsPut, connectionConfigs } = Constants;



const extractCardsToProcess = (sibsFileContent, fileName) => {
  const cardToProcess = [];
  const lines = sibsFileContent.split('\n');

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];

    /**
     * In order to make use of the split by space
     * the line must adjusted to transform the multiple spaces into only one
     * */
    line = line.replace(/\s{2,}/g, ' ').trim();

    const columns = line.split(' ');

    if (columns.length > 1) {
      /**
       * This regex is used to extract the Cardnumber and ignore the extra spaces
       * */
      const regexp = /[A-Z\d]{1,}/g;

      const maxPossibleCardNumber = line.substring(
        txtfile_cardnumber_start,
        txtfile_cardnumber_length + txtfile_cardnumber_start,
      );

      const cardNumber = regexp.exec(maxPossibleCardNumber)[0];

      const lastColumn = columns[3].trim();

      const idTagDec = lastColumn.substring(
        txtfile_idTagDec_start,
        txtfile_idTagDec_start + txtfile_idTagDec_length,
      );

      const decimalTag = lastColumn.substring(
        txtfile_decimalTag_start,
        txtfile_decimalTag_start + txtfile_decimalTag_length,
      );

      let idTagHexa = BigInt(decimalTag).toString(16).toUpperCase();

      while (idTagHexa.length < 7 * 2) {
        idTagHexa = `0${idTagHexa}`;
      }

      let idTagHexaInv = '';

      for (let i = idTagHexa.length; i > 0; i -= 2) {
        const sub = String(idTagHexa).substring(i, i - 2);
        idTagHexaInv += sub;
      }

      const card = {
        fileName,
        cardNumber,
        idTagDec,
        idTagHexa,
        idTagHexaInv,
      };

      cardToProcess.push(card);
    }
  }

  return cardToProcess;
};

module.exports = {
  getDirectoryFiles() {
    const context = 'Function getDirectoryFiles';
    return new Promise(async (resolve, reject) => {
      try {
        const client = createClient(connectionConfigs.address, {
          username: connectionConfigs.username,
          password: connectionConfigs.password,
        });

        const directoryItems = await client.getDirectoryContents('/');

        if (!directoryItems) {
          reject('Empty directory');
        }

        resolve(directoryItems);
      } catch (error) {
        console.error(`[${context}] Error `, error.message);
        reject(error);
      }
    });
  },

  async getSIBSFilesOLD() {
    const context = 'Function getSIBSFiles';
    return new Promise((resolve, reject) => {
      getLastSentFile()
        .then(async (last_file) => {
          const client = createClient(connectionConfigs.address, {
            username: connectionConfigs.username,
            password: connectionConfigs.password,
          });

          const directoryItems = await client.getDirectoryContents('/');
          const { filestoRetrieve, lastModifiedFile, firstModifiedFile } =
            await filterLastModifiedFiles(directoryItems, last_file);

          if (filestoRetrieve.length === 0) {
            reject({ message: 'No new documents to process' });
          } else {
            let filesInfo = '';
            const filesToProcess = [];

            for (let index = 0; index < filestoRetrieve.length; index++) {
              filesToProcess.push(
                new Promise((resolve) => {
                  const file = filestoRetrieve[index];

                  client
                    .getFileContents(file.filename)
                    .then((buff) => {
                      filesInfo += buff.toString();
                      resolve();
                    })
                    .catch((err) => {
                      console.log(`[Error][getFileContents] ${err.message}`);
                      resolve();
                    });
                }),
              );
            }

            Promise.all(filesToProcess)
              .then(async () => {
                const excelLines = [];
                const linesToProcess = [];

                const lines = filesInfo.split('\n');

                for (let index = 0; index < lines.length; index++) {
                  let line = lines[index];

                  line = line.replace(/\s{2,}/g, ' ').trim();
                  const columns = line.split(' ');

                  if (columns.length > 1) {
                    const firstColumn = columns[0].trim();
                    const cardNumber = firstColumn.substring(26, 47);

                    const lastColumn = columns[3].trim();
                    const inverseDecimalTag = lastColumn.substring(36, 53);

                    const decimalTag = lastColumn.substring(59, 75);

                    if (cardNumber.includes('PTEVIO900')) {
                      excelLines.push({
                        cartao: cardNumber,
                        inverseDecimal: inverseDecimalTag,
                        decimal: decimalTag,
                        status: 'B2B',
                      });
                    } else {
                      try {
                        const response = await createMobieRFIDToken(
                          cardNumber,
                          decimalTag,
                          inverseDecimalTag,
                        );

                        await sleep(10000);

                        if (response) {
                          excelLines.push({
                            cartao: cardNumber,
                            inverseDecimal: inverseDecimalTag,
                            decimal: decimalTag,
                            status: 'Registado',
                          });
                        } else {
                          excelLines.push({
                            cartao: cardNumber,
                            inverseDecimal: inverseDecimalTag,
                            decimal: decimalTag,
                            status: 'Falha',
                          });
                        }
                      } catch (err) {
                        await sleep(10000);

                        excelLines.push({
                          cartao: cardNumber,
                          inverseDecimal: inverseDecimalTag,
                          decimal: decimalTag,
                          status: 'Falha',
                        });
                      }
                    }
                  }
                }

                const excelBuffer = await createExcelBuffer(excelLines);

                sendEmail(excelBuffer, lastModifiedFile, firstModifiedFile)
                  .then(() => {
                    const newValues = { $set: lastModifiedFile };
                    const query = { _id: last_file._id };
                    updateSibsFile(query, newValues)
                      .then(() => {
                        console.log('Last modified SIBS db file was updated');
                        resolve('Email sent with success');
                      })
                      .catch((err) => {
                        console.log(err);
                        reject();
                      });
                  })
                  .catch((err) => {
                    console.log(err);
                    reject();
                  });
              })
              .catch((err) => {
                console.log(`[Error][getFileContents] ${err.message}`);
                reject();
              });
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  },

  async getSIBSFiles() {
    const context = 'Function getSIBSFiles';
    return new Promise((resolve, reject) => {
      getLastSentFile()
        .then(async (last_file) => {
          const client = createClient(connectionConfigs.address, {
            username: connectionConfigs.username,
            password: connectionConfigs.password,
          });

          const directoryItems = await client.getDirectoryContents('/');
          const { filestoRetrieve, lastModifiedFile, firstModifiedFile } =
            await filterLastModifiedFiles(directoryItems, last_file);

          if (filestoRetrieve.length === 0) {
            reject({ message: 'No new documents to process' });
          } else {
            let filesInfo = '';
            const filesToProcess = [];
            const filesNames = [];

            for (let index = 0; index < filestoRetrieve.length; index++) {
              filesToProcess.push(
                new Promise((resolve) => {
                  const file = filestoRetrieve[index];

                  filesNames.push(file.filename);

                  client
                    .getFileContents(file.filename)
                    .then((buff) => {
                      filesInfo += buff.toString();
                      resolve();
                    })
                    .catch((err) => {
                      console.log(`[Error][getFileContents] ${err.message}`);
                      resolve();
                    });
                }),
              );
            }

            Promise.all(filesToProcess)
              .then(async () => {
                const cardToProcess = extractCardsToProcess(
                  filesInfo,
                  filesNames[0],
                );

                console.log(
                  `[${context}][Cards Extracted From Sibs] ${cardToProcess.length}`,
                  { cardToProcess },
                );

                const host =
                  process.env.HostUsers + process.env.PathCreateMobieRFIDToken;

                try {
                  const response = await axios.post(host, {
                    cards: cardToProcess,
                  });

                  if (response) {
                    console.log(
                      `[${context}][axios.patch] Mobie RFID Token created with success for cards ${cardToProcess.length}`,
                    );

                    const newValues = { $set: lastModifiedFile };
                    const query = { _id: last_file._id };
                    updateSibsFile(query, newValues)
                      .then(() => {
                        console.log('Last modified SIBS db file was updated');
                        resolve('Email sent with success');
                      })
                      .catch((err) => {
                        Sentry.captureException(err);
                        console.log(err);
                        reject();
                      });

                    resolve();
                  } else {
                    console.error(
                      `[${context}][Error] Mobie RFID Token creation failed for cards ${cardToProcess.length}`,
                    );
                    reject();
                  }
                } catch (error) {
                  Sentry.captureException(error);
                  console.error(
                    `[${context}][Error] Mobie RFID Token creation failed for cards ${error.message} ${cardToProcess.length}`,
                  );
                  reject(error);
                }

                resolve();
              })
              .catch((err) => {
                Sentry.captureException(err);
                console.log(`[Error][getFileContents] ${err.message}`);
                reject();
              });
          }
        })
        .catch((err) => {
          Sentry.captureException(err);
          reject(err);
        });
    });
  },

  async putSIBSCards(cardsInformationArray) {
    const client = createClient(connectionConfigsPut.address, {
      username: connectionConfigs.username,
      password: connectionConfigs.password,
    });

    let fileString = '';

    for (let i = 0; i != cardsInformationArray.length; i++) {
      const country = await retrieveCountryByCountryCode(
        cardsInformationArray[i].address.countryCode,
      );
      console.log(country);
      if (fileString != '') fileString += '\n';

      // N_CARTAO // NOME_DA_EMPRESA_CLIENTE_A_GRAVAR // [MATRICULA_A_GRAVAR]  // [OUTRO_TEXTO_A_GRAVAR] // [NAME][, ao cuidado de SENDTO - ] street, number[ - floor] // zipCode city[, state] // country  )

      // 18/08/2023
      // N_CARTAO // NOME_DA_EMPRESA_CLIENTE_A_GRAVAR // [MATRICULA_A_GRAVAR]  // [OUTRO_TEXTO_A_GRAVAR] // [NAME] // [A/c  SENDTO] // street[, n.º number][ - floor] // [zipCode][ city] // country

      // number and andar in lowercase

      if (!cardsInformationArray[i].cardNumber) {
        throw new Error('cardNumber is necessary');
      }

      fileString += cardsInformationArray[i].cardNumber;

      fileString += '\t';
      if (cardsInformationArray[i].cardPhysicalName)
        fileString += cardsInformationArray[i].cardPhysicalName;
      else if (cardsInformationArray[i].cardName)
        fileString += cardsInformationArray[i].cardName;
      else {
        throw new Error('cardName OR cardPhysicalName is necessary');
      }

      fileString += '\t';
      if (cardsInformationArray[i].cardPhysicalLicensePlate)
        fileString += cardsInformationArray[i].cardPhysicalLicensePlate;

      fileString += '\t';
      if (cardsInformationArray[i].cardPhysicalText)
        fileString += cardsInformationArray[i].cardPhysicalText;

      fileString += '\t';
      if (cardsInformationArray[i].address) {
        if (
          cardsInformationArray[i].cardPhysicalSendTo &&
          cardsInformationArray[i].cardPhysicalSendTo != ''
        )
          fileString += cardsInformationArray[i].cardPhysicalSendTo;
        else if (cardsInformationArray[i].name)
          fileString += cardsInformationArray[i].name;

        fileString += '\t';

        if (
          cardsInformationArray[i].cardPhysicalInTheCareOf &&
          cardsInformationArray[i].cardPhysicalInTheCareOf != ''
        )
          fileString += `A/c ${cardsInformationArray[i].cardPhysicalInTheCareOf}`;

        fileString += '\t';

        if (cardsInformationArray[i].address.street)
          fileString += cardsInformationArray[i].address.street;
        if (cardsInformationArray[i].address.number) {
          fileString += `, n.º ${cardsInformationArray[
            i
          ].address.number.toLowerCase()}`;
          if (cardsInformationArray[i].address.floor) {
            fileString += ` - ${cardsInformationArray[
              i
            ].address.floor.toLowerCase()}`;
          }
        }

        fileString += '\t';

        if (cardsInformationArray[i].address.zipCode)
          fileString += cardsInformationArray[i].address.zipCode;
        if (cardsInformationArray[i].address.city)
          fileString += ` ${cardsInformationArray[i].address.city}`;

        fileString += `\t${country.countryName}`;

        fileString += `\t${
          Constants.cardCodes[cardsInformationArray[i].userLanguage || 'default']
        }`;
        fileString += `\t${country.numericCode}`;
      }
    }

    let fileName =(cardsInformationArray[0].address.countryCode === 'PT' ? Constants.SIBSFileNamePT : Constants.SIBSFileNameOther ) + moment().format('YYYYMMDD');

    const oldFiles = await SIBS.find({ filename: { $regex: fileName } });

    const index = oldFiles.length + 1;

    if (index < 100) fileName += '0';
    if (index < 10) fileName += '0';

    fileName += index;

    const cc = [];

    fileName += '.txt';

    if (['production', 'pre-production'].includes(process.env.NODE_ENV)) {
      // let result = await client.putFileContents("/" + fileName, fileString, { format: "text" });

      // if (!result) {
      //    throw new Error("File failed to sent to SIBS!");
      // }
      cc.push(process.env.EMAIL_TEST);
      await nodemailerS.sendEmailFromSupport(
        process.env.EMAIL_USER,
        [fileString],
        [fileName],
        'File to Sibs',
        '',
        cc,
      );

      console.log('File sent to SIBS');
    } else {
      await nodemailerS.sendEmailFromSupport(
        process.env.EMAIL_TEST,
        [fileString],
        [fileName],
        'File to Sibs',
        '',
        [],
      );
      console.log('Only send file to SIBS in production');
    }

    console.log('fileName');
    console.log(fileName);

    console.log('fileString');
    console.log(fileString);

    const newSibsFile = new SIBS({
      basename: `/${fileName}`,
      filename: fileName,
      type: process.env.SIBSFileUploadType,
    });

    newSibsFile.save();
  },
};

function getLastSentFile() {
  return new Promise((resolve, reject) => {
    SIBS.find({ type: { $ne: 'uploadFile' } }, (err, result) => {
      if (err) {
        console.log(`[${context}][] Error `, err.message);
        reject(err);
      } else if (result.length === 1) {
        resolve(result[0]);
      } else {
        reject({ message: 'Invalid number of files exists in the DB' });
      }
    });
  });
}

async function filterLastModifiedFiles(files, last_file) {
  let lastModifiedFile;
  let lastModifiedFileDateDiff;

  let firstModifiedFile;
  let firstModifiedFileDateDiff;

  const filestoRetrieve = [];

  const currentDate = moment();
  const last_file_date = moment(
    filterGMTFromDate(last_file.lastmod),
    'ddd, DD MMM YYYY hh:mm:ss',
  );

  files.forEach((file) => {
    const file_date = moment(
      filterGMTFromDate(file.lastmod),
      'ddd, DD MMM YYYY hh:mm:ss',
    );

    if (file_date > last_file_date) {
      filestoRetrieve.push(file);

      const date_diff = currentDate.diff(file_date);

      if (
        lastModifiedFile === undefined ||
        date_diff < lastModifiedFileDateDiff
      ) {
        lastModifiedFile = file;
        lastModifiedFileDateDiff = date_diff;
      }

      if (
        firstModifiedFile === undefined ||
        date_diff > firstModifiedFileDateDiff
      ) {
        firstModifiedFile = file;
        firstModifiedFileDateDiff = date_diff;
      }
    }
  });

  if (lastModifiedFile === undefined) {
    lastModifiedFile = last_file;
  }

  if (firstModifiedFile === undefined) {
    firstModifiedFile = last_file;
  }

  return { filestoRetrieve, lastModifiedFile, firstModifiedFile };
}

function filterGMTFromDate(date) {
  const dateArray = date.split(' ');
  const new_dateArray = dateArray.splice(0, dateArray.length - 1, 1);

  let new_date = '';
  new_dateArray.forEach((date_element) => {
    new_date += `${date_element.trim()} `;
  });

  return new_date.trim();
}

function updateSibsFile(query, newValues) {
  const context = 'Function updateSibsFile';
  return new Promise((resolve, reject) => {
    SIBS.updateSibsEntry(query, newValues, (err, result) => {
      if (err) {
        console.log(`[${context}][updateSibsFile] Error `, err.message);
        reject(err.message);
      } else if (result) {
        resolve({ _id: result._id, status: 'updated' });
      } else {
        resolve({ _id: query._id, status: 'not updated' });
      }
    });
  });
}

async function createExcelBuffer(lines) {
  const context = 'Function createExcelBuffer';
  try {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Hello');

    worksheet.columns = [
      { header: 'Número do cartão', key: 'cartao' },
      { header: 'Tag decimal inverso', key: 'inverseDecimal' },
      { header: 'Tag decimal', key: 'decimal' },
      { header: 'Estado', key: 'status' },
    ];

    const data = lines;
    data.forEach((e) => {
      worksheet.addRow(e);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return null;
  }
}

function sendEmail(excelBuffer, lastModifiedFile, firstModifiedFile) {
  const context = 'Function sendEmail';
  return new Promise((resolve, reject) => {
    let emailToSend;
    if (process.env.NODE_ENV === 'production') {
      emailToSend = process.env.EVIOMAIL;
    } else if (process.env.NODE_ENV === 'pre-production') {
      emailToSend = process.env.EVIOMAILQA;
    } else {
      emailToSend = process.env.EVIOMAILQA;
    }

    const transporter = nodemailer.createTransport({
      maxConnections: 2,
      maxMessages: 1,
      pool: true,
      host: 'smtp.office365.com',
      port: 587,
      auth: {
        user: process.env.EVIOMAIL,
        pass: process.env.EVIOPASSWORD,
      },
    });

    const filename = lastModifiedFile.filename.split('-');
    const finalFilename = filename[2].substring(0, filename[2].length - 4);

    const firstFilename = firstModifiedFile.filename.split('-');
    const finalFirstFilename = firstFilename[2].substring(
      0,
      firstFilename[2].length - 4,
    );

    const mailOptions = {
      source: `"EVIO support" <${process.env.EVIOMAIL}>`,
      from: `"EVIO support" <${process.env.EVIOMAIL}>`, // sender address
      to: emailToSend,
      subject: `Informação SIBS entre ${finalFirstFilename} e ${finalFilename}`,
      html: `Dados dos cartões entre os ficheiros ${firstModifiedFile.basename} e ${lastModifiedFile.basename}.`,
      attachments: [
        {
          filename: `sibs_${finalFirstFilename}_${finalFilename}.xlsx`,
          content: excelBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    };

    transporter.verify((error, success) => {
      if (error) {
        console.log(error);
      } else {
        console.log('Server is ready to take our messages');
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(`Email not sent: ${error}`);
            reject();
          } else if (info) {
            console.log('Email sent with success');
            resolve();
          }
        });
      }
    });
  });
}

function createMobieRFIDToken(cardNumber, idTagDec, idTagDecInv) {
  const context = 'Function createMobieRFIDToken';
  return new Promise(async (resolve, reject) => {
    let hexa = BigInt(idTagDec).toString(16).toUpperCase();
    while (hexa.length < 7 * 2) {
      hexa = `0${hexa}`;
    }

    let hexaInvert = '';
    for (let i = hexa.length; i > 0; i -= 2) {
      const sub = String(hexa).substring(i, i - 2);
      hexaInvert += sub;
    }

    const data = {
      cardNumber,
      idTagDec: idTagDecInv,
      idTagHexa: hexa,
      idTagHexaInv: hexaInvert,
    };

    const host =
      process.env.HostUsers + process.env.PathCreateMobieRFIDTokenOLD;

    try {
      const response = await axios.patch(host, data);

      if (response) {
        console.log(
          `[${context}][axios.patch] Mobie RFID Token created with success for card ${cardNumber}`,
        );
        resolve();
      } else {
        console.error(
          `[${context}][Error] Mobie RFID Token creation failed for card ${cardNumber}`,
        );
        reject();
      }
    } catch (error) {
      console.error(
        `[${context}][Error] Mobie RFID Token creation failed for card ${error.message} ${cardNumber}`,
      );
      reject(error);
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
