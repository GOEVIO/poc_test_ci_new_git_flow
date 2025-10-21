import { DeviceTypes } from 'evio-library-commons';
import { EmailTypeEnum } from '../enums/email-type.enum';

export interface ISendEmail {
  strategy: DeviceTypes;
  data: object;
  type: EmailTypeEnum;
}