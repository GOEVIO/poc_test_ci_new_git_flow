import { sleep } from "./sleep";

class ProcessingSessionManager{
    private listMessagesInProcess = new Set();
    private retryDelayMs = 500;
    private maxRetries = 3;

    public async addMessageInProcess(message: string, attempt = 0) {
        if(attempt > this.maxRetries){
            const errorMessage = `Error listMessagesInProcess: ${message} is taking too long to process, resending message to queue`
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
        if(!this.listMessagesInProcess.has(message)){
            this.listMessagesInProcess.add(message);
            return;
        }
        await sleep(this.retryDelayMs); 
        await this.addMessageInProcess(message, attempt + 1);
        return;
    }

    public removeMessageInProcess(message: string) {
        if(this.listMessagesInProcess.has(message)){
            this.listMessagesInProcess.delete(message);
        }
    }

    public removeMessageInProcessDuringCatch(message: string, errorMessage: string) {
        if(this.listMessagesInProcess.has(message) && !errorMessage.includes('listMessagesInProcess')){
            this.listMessagesInProcess.delete(message);
        }
    }
}

export const  processingSessionManager = new ProcessingSessionManager();