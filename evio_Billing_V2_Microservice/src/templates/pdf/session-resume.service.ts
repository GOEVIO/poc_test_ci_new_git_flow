import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Session } from '../../sessions/interfaces/session.interface';
import { getSessionColumns } from './constants/session.config';
const { ChargerTypesMap } = require('evio-library-commons');
import { formatDateToYMD, formatSecondsToHHMMSS, formatTimeHHmm } from '../../utils/date-format';
import { truncateToDecimals } from '../../utils/currency';
import { setTimeout as delay } from 'timers/promises';
import { ExcelTemplateService } from '../excel.template.service';

@Injectable()
export class SessionResumeService {
  private readonly logger = new Logger(SessionResumeService.name);

  constructor(
    private excelTemplateService: ExcelTemplateService,
  ) { }

  async retrievePdfResumeServices(sessions: Session[], clientName: string, network: string, billingPeriod: string): Promise<any> {
    const context = 'retrievePdfResumeServices';
    this.logger.log(`[${context}] Starting process`);

    if (clientName.toUpperCase() !== 'EVIO' && clientName.toUpperCase() !== 'KINTO') {
      clientName = 'WL';
    }

    const networkTotals: Record<string, { price: number; iva: number }> = {};
    for (const session of sessions) {
      const chargerType = session.chargerType;
      let network = ChargerTypesMap[chargerType];

      if (!network) continue;
      if (network == 'INTERNATIONAL NETWORK') {
        network = 'OTHER'
      }
      const inclVat = Number(session.finalPrices?.totalPrice.incl_vat || session.totalPrice?.incl_vat || 0);
      const exclVat = Number(session.finalPrices?.totalPrice.excl_vat || session.totalPrice?.excl_vat || 0);
      const iva = inclVat - exclVat;

      if (!networkTotals[network]) {
        networkTotals[network] = { price: 0, iva: 0 };
      }

      networkTotals[network].price += exclVat;
      networkTotals[network].iva += iva;
    }

    Object.keys(networkTotals).forEach(network => {
      networkTotals[network].price = truncateToDecimals(Number(networkTotals[network].price), 2);
      networkTotals[network].iva = truncateToDecimals(Number(networkTotals[network].iva), 2);
    });

    const key = `${clientName.toUpperCase()}|${network.toUpperCase()}|${billingPeriod.toUpperCase()}`;
    const periodicKey = `${clientName}|*|${billingPeriod}`;

    const handlers = new Map<string, () => Promise<any>>([
      [key, async () => this.buildNetworkResume(networkTotals, context)],
      [periodicKey, async () => this.buildNetworkResume(networkTotals, context)],
    ]);

    try {
      const handler = handlers.get(key) || handlers.get(periodicKey);

      if (!handler) {
        this.logger.warn(`[${context}] No handler found for key: ${key}`);
        throw new BadRequestException(`No processing rule for this combination`);
      }

      return await handler();
    } catch (err) {
      this.logger.error(`[${context}] Error: ${err.stack}`);
      throw new BadRequestException(`The process failed`);
    }
  }

  async buildStations(sessions: Session[]): Promise<any[]> {
    return sessions.map(session => ({
      name: session.location_id || session.hwId,
      city: session.address?.city,
      tension: session.voltageLevel
    }));
  }

  async buildResumeEvio(sessions: Session[]): Promise<any[]> {
    const networkGroups: Record<string, any> = {};

    for (const session of sessions) {
      const chargerType = session?.chargerType;
      let network = ChargerTypesMap[chargerType];

      if (!network) continue;
      if (network === 'INTERNATIONAL NETWORK') {
        network = 'OTHER';
      }

      const sessionColumns = [
        ...getSessionColumns(network),
        'RATE_PER_MIN_EUR',
        'RATE_PER_KWH_EUR',
        'UNIT_PRICE_OPC_FLAT',
        'UNIT_PRICE_IEC',
        'OPC_ACTIVATION_EUR',
        'FLAT_COST',
        'UNIT_PRICE_ROAMING_TIME',
        'UNIT_PRICE_ROAMING_ENERGY'
      ];

      if (!networkGroups[network]) {
        networkGroups[network] = {
          title: `ANNEX_SERVICES_NETWORK_${network.toUpperCase()}`,
          count: 0,
          totalTime: 0,
          totalEnergy: 0,
          totalExclVat: 0,
          totalInclVat: 0,
          network,
          items: []
        };
      }

      let totalPowerSession: number = 0;
      let timeChargedSession: number = 0;
      let activationFeeSession: number = 0;
      let timeDuringParking: number = 0;

      if (session.costDetails) {
        totalPowerSession = session.costDetails.totalPower ?? 0;
        timeChargedSession = session.costDetails.timeCharged;
        activationFeeSession = session.costDetails.activationFee ?? 0;
        if (session.costDetails.timeDuringParking !== undefined && session.costDetails.timeDuringParking !== null) {
          timeDuringParking = session.costDetails.timeDuringParking;
        }
      } else {
        totalPowerSession = session.totalPower;
        timeChargedSession = session.timeCharged;
      }

      let use_energy: number = 0;
      let use_time: number = 0;
      let evioEnergyCost: number = 0;
      let evioTimeCost: number;

      if (session.tariffId !== "-1") {
        if (session.tariff?.tariffType === 'Energy Based') {
          evioEnergyCost = session.tariff?.tariff?.chargingAmount?.value ?? 0;
          if (session.costDetails)
            use_energy = session.costDetails.costDuringCharge;
        } else {
          evioTimeCost = session.tariff?.tariff.chargingAmount.value ?? 0;
          if (session.costDetails)
            use_time = session.costDetails.costDuringCharge;
        }
      }

      let chargingTariff;
      let parkingTariff;

      if (session.tariff) {
        if (session.tariff.tariff) {
          chargingTariff = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
          parkingTariff = session?.tariff?.tariff?.parkingAmount?.value ?? 0;
        } else {
          chargingTariff = "-";
          parkingTariff = "-";
        }
      } else {
        chargingTariff = "-";
        parkingTariff = "-";
      }

      const group = networkGroups[network];

      group.count += 1;
      group.totalExclVat += session.finalPrices?.totalPrice?.excl_vat || session.total_cost?.excl_vat || session.totalPrice?.excl_vat || 0;
      group.totalInclVat += session.finalPrices?.totalPrice?.incl_vat || session.total_cost?.incl_vat || session.totalPrice?.incl_vat || 0;
      group.totalEnergy += session.totalPower || 0;
      group.totalTime += session.timeCharged || 0;

      const item: Record<string, any> = {};

      for (const col of sessionColumns) {
        switch (col) {
          case 'DATE':
            item["DATE"] = formatDateToYMD(session.startDate);
            break;
          case 'START':
            item["START"] = formatTimeHHmm(session.startDate);
            break;
          case 'DURATION':
            item["DURATION"] = formatSecondsToHHMMSS(session.timeCharged) || "-";
            break;
          case 'CITY':
            item["CITY"] = session.address?.city ?? '-';
            break;
          case 'STATION':
            item["STATION"] = session.hwId || "-";
            break;
          case 'LICENSE_PLATE':
            item["LICENSE_PLATE"] = session.evDetails?.licensePlate || "-";
            break;
          case 'ENERGY_CONSUMED_KWH':
            item["ENERGY_CONSUMED_KWH"] = session.costDetails?.totalPower ? (session.costDetails?.totalPower / 1000) : "-";
            break;
          case 'ENERGY_OFF_PEAK_KWH':
            item["ENERGY_OFF_PEAK_KWH"] = "-";
            break;
          case 'ENERGY_NON_OFF_PEAK_KWH':
            item["ENERGY_NON_OFF_PEAK_KWH"] = "-";
            break;
          case 'CHARGING_DURATION_MIN':
            item["CHARGING_DURATION_MIN"] = formatSecondsToHHMMSS(session.timeCharged) || "-";
            break;
          case 'RATE_PER_KWH_EUR':
            item["RATE_PER_KWH_EUR"] = use_energy;
            break;
          case 'RATE_PER_MIN_EUR':
            item["RATE_PER_MIN_EUR"] = use_time;
            break;
          case 'ACTIVATION_FEE_EUR':
            item["ACTIVATION_FEE_EUR"] = activationFeeSession;
            break;
          case 'CHARGING_USAGE_RATE_EUR_PER_MIN':
            item["CHARGING_USAGE_RATE_EUR_PER_MIN"] = chargingTariff;
            break;
          case 'POST_CHARGING_USAGE_RATE_EUR_PER_MIN':
            item["POST_CHARGING_USAGE_RATE_EUR_PER_MIN"] = parkingTariff;
            break;
          case 'ENERGY_COST_EUR':
            item["ENERGY_COST_EUR"] = "-";
            break;
          case 'TAR_EUR':
            item["TAR_EUR"] = "-";
            break;
          case 'OPC_TIME_EUR':
            item["OPC_TIME_EUR"] = "-";
            break;
          case 'OPC_ENERGY_EUR':
            item["OPC_ENERGY_EUR"] = "-";
            break;
          case 'OPC_ACTIVATION_EUR':
            item["OPC_ACTIVATION_EUR"] = "-";
            break;
          case 'IEC_EUR':
            item["IEC_EUR"] = "-";
            break;
          case 'TOTAL_EXCL_VAT_EUR':
            item["TOTAL_EXCL_VAT_EUR"] = session.finalPrices?.totalPrice?.excl_vat?.toFixed(2) || session.total_cost?.excl_vat?.toFixed(2) || session.totalPrice?.excl_vat?.toFixed(2) || "-";
            break;
          case 'VAT_PERCENT':
            item["VAT_PERCENT"] = (((session.fees?.IVA ?? 0) * 100).toString());
            break;
          case 'TOTAL_INCL_VAT_EUR':
            item["TOTAL_INCL_VAT_EUR"] = session.finalPrices?.totalPrice?.incl_vat?.toFixed(2) || session.total_cost?.incl_vat?.toFixed(2) || session.totalPrice?.incl_vat?.toFixed(2) || "-";
            break;
        }
      }

      group.items.push(item);
    }

    Object.values(networkGroups).forEach((group: any) => {
      group.totalExclVat = truncateToDecimals(group.totalExclVat, 2);
      group.totalInclVat = truncateToDecimals(group.totalInclVat, 2);
      group.totalEnergy = `${group.totalEnergy.toFixed(3)} KWh`;
      group.totalTime = formatSecondsToHHMMSS(group.totalTime);
    });

    return Object.values(networkGroups).filter(group => group.count > 0);
  }

  async buildResumePeriodic(sessions: Session[], cdrExtensionPeriodic: any): Promise<any[]> {
    const networkGroups: Record<string, any> = {};

    const sessionLinesMobiE = cdrExtensionPeriodic.body.attach.chargingSessions.lines.find((line) => line.network === 'mobie');
    for (const sessionLineMobiE of sessionLinesMobiE.values) {
      const network = 'MOBIE';
      const sessionColumns = [
        ...getSessionColumns(network),
        'RATE_PER_MIN_EUR',
        'RATE_PER_KWH_EUR',
        'UNIT_PRICE_OPC_FLAT',
        'UNIT_PRICE_IEC',
        'OPC_ACTIVATION_EUR',
        'FLAT_COST',
        'UNIT_PRICE_ROAMING_TIME',
        'UNIT_PRICE_ROAMING_ENERGY'
      ];

      const headerDetail = cdrExtensionPeriodic.body.attach.chargingSessions.header['mobie'];
      const footerDetail = cdrExtensionPeriodic.body.attach.chargingSessions.footer['mobie'];
      if (!networkGroups[network]) {
        networkGroups[network] = {
          title: `ANNEX_SERVICES_NETWORK_${network.toUpperCase()}`,
          count: headerDetail.sessions,
          totalTime: headerDetail.totalTime,
          totalEnergy: headerDetail.totalEnergy,
          totalExclVat: `${truncateToDecimals(footerDetail.total_exc_vat, 2)}€`,
          totalInclVat: `${truncateToDecimals(footerDetail.total_inc_vat, 2)}€`,
          network,
          items: []
        };
      }

      const group = networkGroups[network];

      const item = this.buildSessionItemFromColumns(sessionLineMobiE, sessionColumns);
      group.items.push(item);
    }

    const sessionLinesInternational = cdrExtensionPeriodic.body.attach.chargingSessions.lines.find((line) => line.network === 'international');
    for (const sessionLineInternational of sessionLinesInternational.values) {
      const network = 'OTHER';
      const sessionColumns = [
        ...getSessionColumns(network),
        'RATE_PER_MIN_EUR',
        'RATE_PER_KWH_EUR',
        'UNIT_PRICE_OPC_FLAT',
        'UNIT_PRICE_IEC',
        'OPC_ACTIVATION_EUR',
        'FLAT_COST',
        'UNIT_PRICE_ROAMING_TIME',
        'UNIT_PRICE_ROAMING_ENERGY'
      ];

      const headerDetail = cdrExtensionPeriodic.body.attach.chargingSessions.header['international'];
      const footerDetail = cdrExtensionPeriodic.body.attach.chargingSessions.footer['international'];
      if (!networkGroups[network]) {
        networkGroups[network] = {
          title: `ANNEX_SERVICES_NETWORK_${network.toUpperCase()}`,
          count: headerDetail.sessions,
          totalTime: headerDetail.totalTime,
          totalEnergy: headerDetail.totalEnergy,
          totalExclVat: `${truncateToDecimals(footerDetail.total_exc_vat, 2)}€`,
          totalInclVat: `${truncateToDecimals(footerDetail.total_inc_vat, 2)}€`,
          network,
          items: []
        };
      }

      const group = networkGroups[network];

      const item = this.buildSessionItemFromColumns(sessionLineInternational, sessionColumns);
      group.items.push(item);
    }
    
    this.logger.log(`[retrievePeriodicSessionsResume] Processed ${sessions.length} sessions into ${Object.keys(networkGroups).length} network groups`);
    return Object.values(networkGroups).filter(group => group.count > 0);
  }

  async buildResumeAdHoc(sessions: Session[], cdrExtension: any): Promise<any[]> {
    const networkGroups = await sessions.reduce(async (accPromise, session) => {
      const acc = await accPromise;

      const headerDetail = cdrExtension.attach.chargingSessions.header;
      const sessionDetail = cdrExtension.attach.chargingSessions.lines[0];

      const { totalExclVat, totalInclVat } = cdrExtension.attach.chargingSessions.lines.reduce(
        (totals, line) => {
          totals.totalExclVat += line.total_exc_vat || 0;
          totals.totalInclVat += line.total_inc_vat || 0;
          return totals;
        },
        { totalExclVat: 0, totalInclVat: 0 }
      );

      let network = ChargerTypesMap[session.chargerType] || 'Outras';
      if (network === 'INTERNATIONAL NETWORK') {
        network = 'OTHER';
      }
      const sessionColumns = [
        ...getSessionColumns(network),
        'RATE_PER_MIN_EUR',
        'RATE_PER_KWH_EUR',
        'UNIT_PRICE_OPC_FLAT',
        'UNIT_PRICE_IEC',
        'OPC_ACTIVATION_EUR',
        'FLAT_COST',
        'UNIT_PRICE_ROAMING_TIME',
        'UNIT_PRICE_ROAMING_ENERGY'
      ];

      if (!acc[network]) {
        acc[network] = {
          title: `ANNEX_SERVICES_NETWORK_${network.toUpperCase()}`,
          count: 0,
          totalTime: headerDetail.totalTime,
          totalEnergy: headerDetail.totalEnergy,
          totalExclVat,
          totalInclVat,
          network: network,
          items: []
        };
      }
      acc[network].count = 1;
      acc[network].totalExclVat += sessionDetail.excl_vat || 0;
      acc[network].totalInclVat += sessionDetail.incl_vat || 0;
      const item: Record<string, string | number> = {};
      for (const column of sessionColumns) {
        switch (column) {
          case 'DATE':
            item['DATE'] = sessionDetail.date;
            break;
          case 'START':
            item['START'] = sessionDetail.startTime;
            break;
          case 'DURATION':
            item['DURATION'] = sessionDetail.duration;
            break;
          case 'CITY':
            item['CITY'] = sessionDetail.city;
            break;
          case 'STATION':
            item['STATION'] = sessionDetail.hwId;
            break;
          case 'LICENSE_PLATE':
            item['LICENSE_PLATE'] = sessionDetail.licensePlate;
            break;
          case 'ENERGY_CONSUMED_KWH':
            item['ENERGY_CONSUMED_KWH'] = sessionDetail.totalPower ? sessionDetail.totalPower.toFixed(3) : "-";
            break;
          case 'ENERGY_OFF_PEAK_KWH':
            item['ENERGY_OFF_PEAK_KWH'] = sessionDetail.energyConsumedEmpty !== undefined ? sessionDetail.energyConsumedEmpty.toFixed(3) : "-";
            break;
          case 'ENERGY_NON_OFF_PEAK_KWH':
            item['ENERGY_NON_OFF_PEAK_KWH'] = sessionDetail.energyConsumedOutEmpty !== undefined ? sessionDetail.energyConsumedOutEmpty.toFixed(3) : "-";
            break;
          case 'CHARGING_DURATION_MIN':
            item['CHARGING_DURATION_MIN'] = sessionDetail.realTimeCharging;
            break;
          case 'POST_CHARGING_DURATION_MIN':
            item['POST_CHARGING_DURATION_MIN'] = sessionDetail.postChargingDuration ? sessionDetail.postChargingDuration : "-";
            break;
          case 'RATE_PER_KWH_EUR':
            item['RATE_PER_KWH_EUR'] = sessionDetail.unitPriceOPCEnergy?.toFixed(2) ?? "-";
            break;
          case 'RATE_PER_MIN_EUR':
            item['RATE_PER_MIN_EUR'] = sessionDetail.unitPriceOPCTime?.toFixed(2) ?? "-";
            break;
          case 'ACTIVATION_FEE_EUR':
            item['ACTIVATION_FEE_EUR'] = sessionDetail.activationFee?.toFixed(4) || sessionDetail.flatCost || "-0.0100";
            break;
          case 'CHARGING_USAGE_RATE_EUR_PER_MIN':
            item['CHARGING_USAGE_RATE_EUR_PER_MIN'] = sessionDetail.unitPriceOPCTime?.toFixed(3) ?? "-";
            break;
          case 'POST_CHARGING_USAGE_RATE_EUR_PER_MIN':
            item['POST_CHARGING_USAGE_RATE_EUR_PER_MIN'] = sessionDetail.postChargingUsageTariff?.toFixed(3) ?? "-";
            break;
          case 'ENERGY_COST_EUR':
            item['ENERGY_COST_EUR'] = sessionDetail.energyCost?.toFixed(2) ?? "-";
            break;
          case 'TAR_EUR':
            item['TAR_EUR'] = sessionDetail.tar?.toFixed(2) ?? "-";
            break;
          case 'OPC_TIME_EUR':
            item['OPC_TIME_EUR'] = sessionDetail.opcTimeCost?.toFixed(2) ?? "-";
            break;
          case 'OPC_ENERGY_EUR':
            item['OPC_ENERGY_EUR'] = sessionDetail.opcEnergyCost?.toFixed(2) ?? "-";
            break;
          case 'OPC_ACTIVATION_EUR':
            item['OPC_ACTIVATION_EUR'] = sessionDetail.opcFlatCost?.toFixed(2) ?? "-";
            break;
          case 'IEC_EUR':
            item['IEC_EUR'] = sessionDetail.iec?.toFixed(2) ?? "-";
            break;
          case 'TOTAL_EXCL_VAT_EUR':
            item['TOTAL_EXCL_VAT_EUR'] = sessionDetail.total_exc_vat?.toFixed(2) ?? "-";
            break;
          case 'VAT_PERCENT':
            item['VAT_PERCENT'] = sessionDetail.vat ?? "23";
            break;
          case 'TOTAL_INCL_VAT_EUR':
            item['TOTAL_INCL_VAT_EUR'] = sessionDetail.total_inc_vat?.toFixed(2) ?? "-";
            break;
          case 'UNIT_PRICE_OPC_FLAT':
            item['UNIT_PRICE_OPC_FLAT'] = sessionDetail.unitPriceOPCFlat?.toFixed(2) ?? "-";
            break;
          case 'UNIT_PRICE_IEC':
            item['UNIT_PRICE_IEC'] = sessionDetail.unitPriceIEC?.toFixed(3) ?? "-";
            break;
          case '':
            item['FLAT_COST'] = sessionDetail.flatCost?.toFixed(2) ?? "-";
            break;
          case '':
            item['UNIT_PRICE_ROAMING_TIME'] = sessionDetail.unitPriceRoamingTime?.toFixed(2) ?? "-";
            break;
          case '':
            item['UNIT_PRICE_ROAMING_ENERGY'] = sessionDetail.unitPriceRoamingEnergy?.toFixed(2) ?? "-";
            break;
          default:
            item[column] = "-";
        }
      }

      acc[network].items.push(item);
      return acc;
    }, Promise.resolve({}));

    Object.values(networkGroups).forEach((group: any) => {
      group.totalTime = group.totalTime;
      group.totalEnergy = group.totalEnergy;
      group.totalExclVat = `${group.totalExclVat}€`;
      group.totalInclVat = `${group.totalInclVat}€`;
    });

    return Object.values(networkGroups);
  }

  async buildFooter(cdrExtension: any, adhoc: boolean): Promise<any> {
    let unitPrices;
    if (adhoc) {
        unitPrices = cdrExtension.attach?.chargingSessions?.unitPricesSummary;
    } else {
        unitPrices = cdrExtension.body?.attach?.chargingSessions?.unitPricesSummary["mobie"];
    }

    this.logger.log(`Retrieving footer resume with adhoc: ${adhoc}`);

    return {
        summaryText: true,
        priceTable: adhoc
            ? unitPrices
                ? {
                    unitPriceCEMEOutEmptyBT: unitPrices.unitPriceCEMEOutEmptyBT,
                    unitPriceCEMEEmptyBT: unitPrices.unitPriceCEMEEmptyBT,
                    unitPriceTAROutEmptyBT: unitPrices.unitPriceTAROutEmptyBT,
                    unitPriceTAREmptyBT: unitPrices.unitPriceTAREmptyBT,
                    unitPriceCEMEOutEmptyMT: unitPrices.unitPriceCEMEOutEmptyMT,
                    unitPriceCEMEEmptyMT: unitPrices.unitPriceCEMEEmptyMT,
                    unitPriceTAROutEmptyMT: unitPrices.unitPriceTAROutEmptyMT,
                    unitPriceTAREmptyMT: unitPrices.unitPriceTAREmptyMT,
                }
                : null
            : undefined,
        activationFee: unitPrices?.activationFee,
        activationFeeAdHoc: unitPrices?.activationFeeAdHoc,
    };
  }

  buildNetworkResume(
    networkTotals: Record<string, { price: number; iva: number }>,
    context: string
  ): any[] {
    const result: any[] = [];

    for (const [networkName, values] of Object.entries(networkTotals)) {
      const description = `SERVICES_NETWORK_${networkName.toUpperCase()}`;

      result.push({
        description,
        price: values.price,
        vat: values.iva,
      });
    }

    if (result.length === 0) {
      console.warn(`[${context}] No sessions matched any known network`);
    }

    return this.completeServiceEntries(result);
  }

  completeServiceEntries(
    existing: { description: string; price: string; vat: string }[]
  ): { description: string; price: string; vat: string }[] {
    const map = new Map(existing.map(e => [e.description, e]));

    const ALL_SERVICES = [
      "SERVICES_NETWORK_EVIO",
      "SERVICES_NETWORK_MOBIE",
      "SERVICES_NETWORK_OTHER"
    ];


    for (const desc of ALL_SERVICES) {
      if (!map.has(desc)) {
        map.set(desc, {
          description: desc,
          price: "0",
          vat: "0"
        });
      }
    }

    return Array.from(map.values());
  }

  /**
 * Builds a session item object from session data and columns.
 * @param sessionData Data for a single session line (e.g., sessionLineMobiE)
 * @param sessionColumns Array of column names to process
 * @returns Record<string, any> representing the session item
 */
private buildSessionItemFromColumns(sessionData: any, sessionColumns: string[]): Record<string, any> {
    const item: Record<string, any> = {};

    for (const col of sessionColumns) {
        switch (col) {
            case 'DATE':
                item["DATE"] = sessionData.date;
                break;
            case 'START':
                item["START"] = sessionData.startTime;
                break;
            case 'DURATION':
                item["DURATION"] = sessionData.duration;
                break;
            case 'CITY':
                item["CITY"] = sessionData.city;
                break;
            case 'STATION':
                item["STATION"] = sessionData.hwId;
                break;
            case 'LICENSE_PLATE':
                item["LICENSE_PLATE"] = sessionData.licensePlate;
                break;
            case 'ENERGY_CONSUMED_KWH':
                item["ENERGY_CONSUMED_KWH"] = sessionData.totalPower?.toFixed(3) ?? "-";
                break;
            case 'ENERGY_OFF_PEAK_KWH':
                item["ENERGY_OFF_PEAK_KWH"] = sessionData.energyConsumedEmpty?.toFixed(3) ?? "-";
                break;
            case 'ENERGY_NON_OFF_PEAK_KWH':
                item["ENERGY_NON_OFF_PEAK_KWH"] = sessionData.energyConsumedOutEmpty?.toFixed(3) ?? "-";
                break;
            case 'CHARGING_DURATION_MIN':
                item["CHARGING_DURATION_MIN"] = sessionData.realTimeCharging;
                break;
            case 'RATE_PER_KWH_EUR':
                item["RATE_PER_KWH_EUR"] = sessionData.unitPriceOPCEnergy?.toFixed(2) ?? "-";
                break;
            case 'RATE_PER_MIN_EUR':
                item["RATE_PER_MIN_EUR"] = sessionData.unitPriceOPCTime?.toFixed(2) ?? "-";
                break;
            case 'ACTIVATION_FEE_EUR':
                item["ACTIVATION_FEE_EUR"] = sessionData.activationFee?.toFixed(4) ?? "-0.0100";
                break;
            case 'CHARGING_USAGE_RATE_EUR_PER_MIN':
                item["CHARGING_USAGE_RATE_EUR_PER_MIN"] = sessionData.unitPriceOPCTime?.toFixed(3) ?? "-";
                break;
            case 'POST_CHARGING_USAGE_RATE_EUR_PER_MIN':
                item["POST_CHARGING_USAGE_RATE_EUR_PER_MIN"] = sessionData.postChargingUsageTariff?.toFixed(3) ?? "-";
                break;
            case 'ENERGY_COST_EUR':
                item["ENERGY_COST_EUR"] = sessionData.energyCost?.toFixed(2) ?? "-";
                break;
            case 'TAR_EUR':
                item["TAR_EUR"] = sessionData.tar?.toFixed(2) ?? "-";
                break;
            case 'OPC_TIME_EUR':
                item["OPC_TIME_EUR"] = sessionData.opcTimeCost?.toFixed(2) ?? "-";
                break;
            case 'OPC_ENERGY_EUR':
                item["OPC_ENERGY_EUR"] = sessionData.opcEnergyCost?.toFixed(2) ?? "-";
                break;
            case 'OPC_ACTIVATION_EUR':
                item["OPC_ACTIVATION_EUR"] = sessionData.opcFlatCost?.toFixed(2) ?? "-";
                break;
            case 'IEC_EUR':
                item["IEC_EUR"] = sessionData.iec?.toFixed(2) ?? "-";
                break;
            case 'TOTAL_EXCL_VAT_EUR':
                item["TOTAL_EXCL_VAT_EUR"] = sessionData.total_exc_vat?.toFixed(2) ?? "-";
                break;
            case 'VAT_PERCENT':
                item["VAT_PERCENT"] = sessionData.vat?.toString() ?? "23";
                break;
            case 'TOTAL_INCL_VAT_EUR':
                item["TOTAL_INCL_VAT_EUR"] = sessionData.total_inc_vat?.toFixed(2) ?? "-";
                break;
            case 'UNIT_PRICE_OPC_FLAT':
                item['UNIT_PRICE_OPC_FLAT'] = sessionData.unitPriceOPCFlat?.toFixed(2) ?? "-";
                break;
            case 'UNIT_PRICE_IEC':
                item['UNIT_PRICE_IEC'] = sessionData.unitPriceIEC?.toFixed(3) ?? "-";
                break;
            case 'FLAT_COST':
                item['FLAT_COST'] = sessionData.flatCost?.toFixed(2) ?? "-";
                break;
            case 'UNIT_PRICE_ROAMING_TIME':
                item['UNIT_PRICE_ROAMING_TIME'] = sessionData.unitPriceRoamingTime?.toFixed(2) ?? "-";
                break;
            case 'UNIT_PRICE_ROAMING_ENERGY':
                item['UNIT_PRICE_ROAMING_ENERGY'] = sessionData.unitPriceRoamingEnergy?.toFixed(2) ?? "-";
                break;
            default:
                item[col] = "-";
        }
    }

    return item;
}
}