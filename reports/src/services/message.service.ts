import { sendEmail } from './email.service';
import { IReportRequestMessage } from '../interfaces/report.interface';
import { getReportHandler } from '../registry/report.registry';
import { generatePdf } from './pdf.service';
import { translate } from '../helpers/translation';

export default async function handleIncomingMessage(
  message: IReportRequestMessage,
) {
  try {
    const handler = getReportHandler(message.type);

    if (!handler)
      throw new Error(`No handler found for report type: ${message.type}`);

    const translationKeys = await translate(message.language || 'pt_PT');

    const data = await handler.generate(message);
    const pdf = await generatePdf(message, data, translationKeys);

    sendEmail(message.email, pdf, translationKeys);
  } catch (error) {
    console.error(JSON.stringify(error));
  }
}
