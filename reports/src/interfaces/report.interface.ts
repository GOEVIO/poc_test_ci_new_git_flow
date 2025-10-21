interface IReportRequestFilter {
  startDate: string;
  endDate: string;
  groupBy: 'apt' | 'charger';
}

export interface IReportRequestMessage {
  userId: string;
  language: string;
  email: string;
  type: 'apt';
  filter: IReportRequestFilter;
}

export interface IReportResponse {
  totals: any;
  totalsGroupBy: any[];
}
