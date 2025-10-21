import { aptReport } from '../services/report-apt.service';
import { ReportHandler } from '../interfaces/report-handler.interface';

const registry: Record<string, ReportHandler> = {
  apt: aptReport,
};

export function getReportHandler(type: string): ReportHandler | undefined {
  return registry[type];
}
