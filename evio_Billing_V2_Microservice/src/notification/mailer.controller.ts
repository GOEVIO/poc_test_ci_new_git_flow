import { Controller, Post, Body } from '@nestjs/common';
import { CustomMailerService } from './mailer.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('email')
export class MailerController {
    constructor(private readonly mailerService: CustomMailerService) { }

}
