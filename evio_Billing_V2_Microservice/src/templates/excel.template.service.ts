import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExcelTemplate } from '../invoice/entities/excel-template.entity';
const axios = require('axios');
import { Workbook } from 'exceljs';
import { uploadFileToS3 } from '../utils/aws-s3.util';
import { FileReferenceService } from '../file-reference/file-reference.service';
import { FilePurpose } from '../enums/file-purpose.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import Constants from '../utils/constants';
import { Session } from '../sessions/interfaces/session.interface';
import { InvoiceLayoutType } from '../invoice/invoice-layout/enum/invoice-layout-type.enum';

@Injectable()
export class ExcelTemplateService {
  constructor(
    @InjectRepository(ExcelTemplate)
    private templateExcelRepository: Repository<ExcelTemplate>,
    private readonly fileReferenceService: FileReferenceService,
    private auditLogService: AuditLogService,
  ) { }

  async findAllTemplates(): Promise<ExcelTemplate[]> {
    return this.templateExcelRepository.find();
  }

  async findTemplateById(id: number): Promise<ExcelTemplate | null> {
    return this.templateExcelRepository.findOneBy({ id });
  }

  async findTemplateByLanguage(language: string): Promise<ExcelTemplate | null> {
    return this.templateExcelRepository.findOneBy({ language });
  }

  async generateExcel(language: string, sessions: any[], relatedObjectId: string, documentNumber: string, endDate: string, adhoc: boolean, cdrExtension: any, fileType: InvoiceLayoutType) {
    let activeTemplate = await this.findTemplateByLanguage(language);

    if (!activeTemplate) {
      activeTemplate = await this.findTemplateByLanguage('EN_GB');
    }

    const template = JSON.parse(JSON.stringify(activeTemplate!.template_json));
    const columns = template.columns;

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Relatório');

    worksheet.columns = columns.map((col: any) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    let excelData;
    if (adhoc) {
      excelData = await this.mappingExcelLinesValues(sessions, documentNumber, endDate);
    }
    else {
      excelData = await this.mappingExcelLinesPeriodicValues(sessions, cdrExtension, documentNumber, endDate);
    }

    worksheet.addRows(excelData);

    const buffer = await workbook.xlsx.writeBuffer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const fileName = `detailed_sessions/${year}/${month}/session_invoice_${Date.now()}.xlsx`;

    const fileUrl = await uploadFileToS3(Buffer.from(buffer), fileName);

    console.log('Excel uploaded to:', fileUrl);

    await this.fileReferenceService.saveFileReference({
      related_object_type: fileType,
      related_object_id: relatedObjectId,
      file_type: 'excel',
      file_purpose: FilePurpose.DETAILED_EXCEL,
      file_url: fileUrl,
    });

    await this.auditLogService.logAction({
      objectType: fileType,
      relatedObjectId: relatedObjectId,
      action: 'generate_invoice_excel',
      oldValue: null,
      newValue: JSON.stringify({ file_path: fileUrl }),
      description: `Invoice Excel generated successfully.`,
      triggeredBy: 'system',
    });

    return buffer;
  }

  async mappingExcelLinesValues(sessions: any[], invoiceNumber: string, endDate: string) {
    const context = "Function mappingExcelLinesValues";

    const formatDateTime = (dateStr: string) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date).replace(',', '');
    };

    const sessionDetailFields = [
      "network", "hwId", "durationMin", "totalPower",
      "realTimeCharging", "averagePower", "CO2emitted", "total_exc_vat", "vat", "total_inc_vat",
      "fleetName", "licensePlate", "groupName", "userIdName", "userIdWillPayName",
      "documentNumber", "emissionDate", "dueDate", "billingPeriodStart", "billingPeriodEnd",
      "parkingMin", "activationFee", "energyTariff", "timeTariff", "chargingUseTariff",
      "parkingTariff", "roamingTimeCost", "roamingEnergyCost", "voltageLevel",
      "energyConsumedEmpty", "energyConsumedOutEmpty", "cemeTotalPrice", "unitPriceCEMEEmptyBT",
      "unitPriceCEMEOutEmptyBT", "tar", "unitPriceTAREmptyMT", "unitPriceTAROutEmptyMT",
      "unitPriceTAREmptyBT", "unitPriceTAROutEmptyBT", "opcTotalPrice", "unitPriceOPCTime",
      "unitPriceOPCEnergy", "opcTimeCost", "opcEnergyCost", "opcFlatCost", "mobiEGrant",
      "iec", "partyId", 'flatCost', 'unitPriceRoamingEnergy', 'unitPriceRoamingTime', 'type', 'cardNumber'
    ];

    try {
      const excelLines: Record<string, any>[] = [];
      const otherNetworksNumber = {
        international: { exists: false, number: 1 },
        whiteLabel: { exists: false, number: 1 }
      };

      for (const session of sessions) {
        let sessionDetail: any;
        const sessionNetwork = session.network || session.source;
        if (sessionNetwork === 'EVIO') {
          sessionDetail = this.buildSessionDetail(session);
        } else {
          const cdrExtension = await this.calculateEnergyInfoFromCdr(session);
          sessionDetail = {
            ...cdrExtension.attach.chargingSessions.lines[0],
            ...cdrExtension.attach.chargingSessions.unitPricesSummary,
            type: session.cdr_token?.type,
            cardNumber: session.cdr_token?.type === 'RFID' ? session.cardNumber : null
          };
        }

        const line: Record<string, any> = {};

        line.startDate = this.insertSessionValue(formatDateTime(session.start_date_time || session.startDate));
        line.stopDate = this.insertSessionValue(formatDateTime(session.end_date_time || session.stopDate));
        line.city = this.insertSessionValue(sessionDetail.city || sessionDetail.country || session.address?.city);
        for (const field of sessionDetailFields) {
          switch (field) {
            case 'network':
              line.network = this.insertSessionValue(sessionDetail.network);
              break;
            case 'documentNumber':
              line[field] = invoiceNumber;
              break;
            case 'emissionDate':
              line[field] = endDate;
              break;
            default:
              line[field] = this.insertSessionValue(sessionDetail[field]);
          }
        }

        if (session.source === 'Gireve') {
          line.network = this.insertSessionValue(
            this.getNetworkToExcel(sessionDetail.network, otherNetworksNumber, "international")
          );
        }

        excelLines.push(line);
      }

      return excelLines;
    } catch (error) {
      console.error(`${context} - Error:`, error);
      throw error;
    }
  }

  private buildExcelLine(
    sessionDetail: any,
    sessionDetailFields: string[],
    documentNumber: string,
    endDate: string,
    otherNetworksNumber: any
  ): Record<string, any> {
    const formatDateTime = (dateStr: string) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    };

    const line: Record<string, any> = {};
    line.startDate = this.insertSessionValue(formatDateTime(sessionDetail.start_date_time || sessionDetail.startDate || sessionDetail.startDateTime));
    line.stopDate = this.insertSessionValue(formatDateTime(sessionDetail.end_date_time || sessionDetail.stopDate || sessionDetail.endDateTime));
    line.city = this.insertSessionValue(sessionDetail.city || sessionDetail.country || sessionDetail.address?.city);

    for (const field of sessionDetailFields) {
      switch (field) {
        case 'network':
          line.network = this.insertSessionValue(sessionDetail.network);
          break;
        case 'documentNumber':
          line[field] = documentNumber;
          break;
        case 'emissionDate':
          line[field] = endDate;
          break;
        default:
          line[field] = this.insertSessionValue(sessionDetail[field]);
      }
    }

    if (sessionDetail.source === 'Gireve') {
      line.network = this.insertSessionValue(
        this.getNetworkToExcel(sessionDetail.network, otherNetworksNumber, "international")
      );
    }

    return line;
  }

  async mappingExcelLinesPeriodicValues(
    sessions: Session[],
    cdrExtension: any,
    documentNumber: string,
    endDate: string
  ) {
    const context = "Function mappingExcelLinesPeriodicValues";
    const sessionDetailFields = [
      "network", "hwId", "durationMin", "totalPower",
      "realTimeCharging", "averagePower", "CO2emitted", "total_exc_vat", "vat", "total_inc_vat",
      "fleetName", "licensePlate", "groupName", "userIdName", "userIdWillPayName",
      "documentNumber", "emissionDate", "dueDate", "billingPeriodStart", "billingPeriodEnd",
      "parkingMin", "activationFee", "energyTariff", "timeTariff", "chargingUseTariff",
      "parkingTariff", "roamingTimeCost", "roamingEnergyCost", "voltageLevel",
      "energyConsumedEmpty", "energyConsumedOutEmpty", "cemeTotalPrice", "unitPriceCEMEEmptyBT",
      "unitPriceCEMEOutEmptyBT", "tar", "unitPriceTAREmptyMT", "unitPriceTAROutEmptyMT",
      "unitPriceTAREmptyBT", "unitPriceTAROutEmptyBT", "opcTotalPrice", "unitPriceOPCTime",
      "unitPriceOPCEnergy", "opcTimeCost", "opcEnergyCost", "opcFlatCost", "mobiEGrant",
      "iec", "partyId", 'flatCost', 'unitPriceRoamingEnergy', 'unitPriceRoamingTime', 'type', 'cardNumber'
    ];

    try {
      const excelLines: Record<string, any>[] = [];
      const otherNetworksNumber = {
        international: { exists: false, number: 1 },
        whiteLabel: { exists: false, number: 1 }
      };

      // EVIO network
      for (const session of sessions) {
        const sessionNetwork = session.network || session.source;
        if (sessionNetwork === 'EVIO') {
          const sessionDetail = this.buildSessionDetail(session);
          excelLines.push(
            this.buildExcelLine(sessionDetail, sessionDetailFields, documentNumber, endDate, otherNetworksNumber)
          );
        }
      }

      if (cdrExtension) {
        // Mobi.E network
        const sessionLinesMobiE = cdrExtension.body.attach.chargingSessions.lines.find((line) => line.network === 'mobie');
        const unitPricesMobiE = cdrExtension.body.attach.chargingSessions.unitPricesSummary["mobie"];
        for (const session of sessionLinesMobiE.values) {
          const sessionDetail = { 
            ...session, 
            ...unitPricesMobiE, 
            type: session.cdr_token?.type,
            cardNumber: session.cdr_token?.type === 'RFID' ? session.cardNumber : null
          };
          excelLines.push(
            this.buildExcelLine(sessionDetail, sessionDetailFields, documentNumber, endDate, otherNetworksNumber)
          );
        }

        // International network
        const sessionLinesInternational = cdrExtension.body.attach.chargingSessions.lines.find((line) => line.network === 'international');
        for (const session of sessionLinesInternational.values) {
          const sessionDetail = { 
            ...session, 
            ...unitPricesMobiE, 
            type: session.cdr_token?.type, 
            cardNumber: session.cdr_token?.type === 'RFID' ? session.cardNumber : null
          };
          excelLines.push(
            this.buildExcelLine(sessionDetail, sessionDetailFields, documentNumber, endDate, otherNetworksNumber)
          );
        }
      }

      return excelLines;
    } catch (error) {
      console.error(`${context} - Error:`, error);
      throw error;
    }
  }

  generateNullFields(fields: string[]) {
    return fields.reduce((acc, field) => {
      acc[field] = this.insertSessionValue(null);
      return acc;
    }, {});
  }

  async calculateEnergyInfoFromCdr(session: any) {
    const context = "calculateEnergyInfoFromCdr";
    try {
      const response = await axios.post(`${Constants.services.ocpi.host}${Constants.services.ocpi.cdrExtension}`, session);
      return response.data;
    } catch (error) {
      console.error(`[Error][${context}]`, error);
      throw error;
    }
  }

  async calculateEnergyInfoFromPeriodicCdr(sessionIds: string[]): Promise<any> {
    const context = "calculateEnergyInfoFromPeriodicCdr";
    try {
      const response = await axios.post(
        `${Constants.services.ocpi.host}${Constants.services.ocpi.cdrExtensionPeriodic}`,
        {
          id: sessionIds,
          filterByInvoiceStatus: false
        }
      );
      return response.data;
    } catch (error) {
      console.error(`[Error][${context}]`, error);
      throw error;
    }
  }

  insertSessionValue(value) {
    const context = "Function insertSessionValue"
    try {
      return value !== null && value !== undefined && value !== "" ? value : "-"
    } catch (error) {
      console.log(`[Error][${context}]`, error.message);
      return "-"
    }
  }

  getNetworkToExcel(session, otherNetworksNumber, network) {

    if (session.clientName === process.env.clientNameHyundai) {
      if (session === process.env.NetworkGoCharge || session === process.env.NetworkInternational || session === process.env.NetworkKLC || session === process.env.NetworkKinto) {
        return `Outras redes ${otherNetworksNumber[network].number}`
      } else {
        return session
      }
    } else if (session.clientName === process.env.clientNameSC) {
      if (session === process.env.NetworkHyundai || session === process.env.NetworkInternational || session === process.env.NetworkKLC || session === process.env.NetworkKinto) {
        return `Outras redes ${otherNetworksNumber[network].number}`
      } else {
        return session
      }
    } else if (session.clientName === process.env.clientNameKLC) {
      if (session === process.env.NetworkHyundai || session === process.env.NetworkInternational || session === process.env.NetworkGoCharge || session === process.env.NetworkKinto) {
        return `Outras redes ${otherNetworksNumber[network].number}`
      } else {
        return session
      }
    } else if (session.clientName === process.env.WhiteLabelKinto) {
      if (session === process.env.NetworkHyundai || session === process.env.NetworkInternational || session === process.env.NetworkGoCharge || session === process.env.NetworkKLC) {
        return `Outras redes ${otherNetworksNumber[network].number}`
      } else {
        return session
      }
    } else {
      if (session === process.env.NetworkHyundai || session === process.env.NetworkGoCharge || session === process.env.NetworkInternational || session === process.env.NetworkKLC || session === process.env.NetworkKinto) {
        return `Outras redes ${otherNetworksNumber[network].number}`
      } else {
        return session
      }
    }

  }

  private buildSessionDetail(session: Session) {
    // Finds the group of drivers for the current session user
    const groupDrivers = session.evDetails
      ? session.evDetails.listOfGroupDrivers.find((group) =>
        group.listOfDrivers.find(
          (driver) => driver._id === session.userIdInfo?._id,
        ),
      )
      : null;

    // Builds the session detail object for Excel export
    return {
      ...session,
      licensePlate: session.evDetails?.licensePlate,
      city: session.address?.city,
      durationMin: ((session.costDetails?.timeCharged ?? 0) + (session.costDetails?.timeDuringParking ?? 0)),
      totalPower: session.costDetails?.totalPower ? (session.costDetails?.totalPower / 1000) : "-",
      realTimeCharging: session.costDetails?.totalPower ? (session.costDetails?.totalPower / 1000) : "-",
      averagePower: session.costDetails?.totalPower && session.costDetails?.timeCharged
        ? (session.costDetails.totalPower / 1000) / (session.costDetails.timeCharged / 3600)
        : "-",
      total_exc_vat: session.totalPrice?.excl_vat?.toFixed(2),
      vat: (((session.fees?.IVA ?? 0) * 100).toString()),
      total_inc_vat: session.totalPrice?.incl_vat?.toFixed(2),
      fleetName: session.fleetDetails?.name,
      userIdName: session?.userIdInfo?.name,
      userIdWillPayName: session?.userIdWillPayInfo?.name,
      groupName: groupDrivers?.name,
      flatCost: session.costDetails?.activationFee ?? 0,
      unitPriceRoamingTime: session.tariff?.tariff?.parkingDuringChargingAmount?.value ?? 0,
      unitPriceRoamingEnergy: session.tariff?.tariff?.chargingAmount?.value ?? 0,
      chargingUseTariff: session.tariff?.tariff?.parkingDuringChargingAmount?.value ?? 0,
      parkingTariff: session.costDetails?.parkingAmount,
      parkingMin: session.costDetails?.timeDuringParking,
      type: session.cdr_token?.type,
      cardNumber: session.cardNumber
    };
  }

}