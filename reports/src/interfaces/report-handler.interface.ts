import { IReportRequestMessage } from './report.interface';

export interface ReportHandler {
  generate(params: IReportRequestMessage): any | Promise<Buffer>;
}
