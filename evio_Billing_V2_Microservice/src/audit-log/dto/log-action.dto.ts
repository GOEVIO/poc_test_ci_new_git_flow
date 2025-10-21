export class LogActionDto {
    objectType: string; 
    relatedObjectId: string; 
    action: string;
    oldValue?: any | null;
    newValue: any; 
    description: string;
    triggeredBy: string; 
}