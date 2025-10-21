export interface IServiceResponse {
    status: number;
    data: {
        auth: boolean;
        code: string;
        message: string;
    } | string;
}
