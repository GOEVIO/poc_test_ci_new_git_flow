export interface IAlarmTitle {
    code: string;
    message: string;
}

export interface IAlarmDescription {
    code: string;
    message: string;
}

export interface IAlarm {
    title: IAlarmTitle;
    description: IAlarmDescription;
    timestamp: Date;
    type: 'error' | 'warning' | 'info';
    status: 'read' | 'unread';
    userId: string;
    hwId: string;
    plugId: string;
    data: Record<string, any>;
}
