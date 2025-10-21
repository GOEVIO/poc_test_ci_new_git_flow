import { Transform } from "class-transformer";
import { IsDate, isDateString, IsDateString, IsDefined, IsMongoId, IsNumber, IsOptional, IsString, ValidateIf } from "class-validator";

export class InvoiceQueryDto {
    @IsOptional()
    @ValidateIf((obj) => obj.startDate !== undefined)
    @Transform(({ value }) => value ? new Date(value) : value, { toClassOnly: true })
    @IsDate({ message: 'startDate must be a valid date string: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ' })
    startDate?: string;

    @IsOptional()
    @ValidateIf((obj) => obj.endDate !== undefined)
    @Transform(({ value }) => value ? new Date(value) : value, { toClassOnly: true })
    @IsDate({ message: 'endDate must be a valid date string: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ' })
    endDate?: string;

    @IsOptional()
    @IsNumber()
    page?: number;

    @IsOptional()
    @IsNumber()
    limit?: number;
}

export class UserIdDto {
    @IsDefined({ message: 'User ID is required' })
    @IsMongoId({ message: 'Invalid user ID' })
    userId: string;
}