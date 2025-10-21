import { Module } from '@nestjs/common';
import { PdfPayloadBuilderService } from './pdf-payload-builder.service';
import { ExcelTemplateModule } from '../excel.template.module';
import { SessionResumeModule } from './session-resume.module';

@Module({
    imports: [
        ExcelTemplateModule,
        SessionResumeModule
    ],
    providers: [
        PdfPayloadBuilderService,
    ],
    exports: [PdfPayloadBuilderService],
})
export class PdfPayloadBuilderModule { }