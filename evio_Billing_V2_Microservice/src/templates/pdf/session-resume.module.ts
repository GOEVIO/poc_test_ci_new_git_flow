import { Module } from '@nestjs/common';
import { SessionResumeService } from './session-resume.service';
import { ExcelTemplateModule } from '../excel.template.module';

@Module({
    imports: [
        ExcelTemplateModule,
    ],
    providers: [SessionResumeService],
    exports: [SessionResumeService],
})
export class SessionResumeModule { }