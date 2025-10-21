export interface SessionGroup {
  userId: string;
  country: string;
  sessionCount: number;
  totalEnergy: number;
  totalCost: number;
  sessionIds: string[];
}