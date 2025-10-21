export default interface IQueuesConfig {
  maxRetries: number;
  limitToProcess: number;
  deadLetterExchange: string;
  deadQueue: string;
}
