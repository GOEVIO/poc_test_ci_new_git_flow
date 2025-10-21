import libraryLanguage from "evio-library-language";
import commons from 'evio-library-commons';
import { LanguageRepository } from "../repositories/language.repository";

const { ErrorHandlerCommon , Enums} = commons;
const { FileTransaction } = libraryLanguage;

export class FileTranslationService {
    static async retrieveFileTranslationMetadata(projectName: string, componentName: string): Promise<string> {
        const context = "[retrieveFileTranslationMetadata]";
        try {
            return await FileTransaction.retrieveFileTranslationMetadata(projectName, componentName);      
        } catch (error: any) {
            console.error(`[${context}] Error: ${error.message}`);
            throw error;
        }
    }

    static async retrieveFileTranslationByLanguage(projectName: string, componentName: string, lang: string): Promise<Object> {
        const context = "[retrieveFileTranslationByLanguage]";        
        try {      
            const translation = await FileTransaction.retrieveFileTranslationByLanguage({project: projectName, component: componentName, language: lang});
            const hash = await FileTransaction.setupHashTranslation(translation);      
            return {language: hash, translation}      
        } catch (error: any) {
            console.error(`[${context}] Error: ${error.message}`);
            throw error;
        }
    }

    static async retrieveAllLanguagesAllowed(clientName: string | undefined): Promise< any | null> {
        const context = "[retrieveAllLanguagesAllowed]";
        try {
            const appConfigurations = await new LanguageRepository().retrieveAppConfigurations(clientName);

            if(appConfigurations.length === 1 && !appConfigurations[0]?.languagesAllowed) {
                throw ErrorHandlerCommon.NotFound({
                    code: 'server_language_not_found',
                    message: 'Component language not found',
                }, context);
            }
            
            let allLanguagesAllowed: Array<Object> = [];
            for await (const elem of appConfigurations) {
                if(!elem?.languagesAllowed) 
                    continue;

                allLanguagesAllowed.push({
                    clientName: elem.clientName,
                    languagesAllowed: elem.languagesAllowed
                })
            }

            return allLanguagesAllowed.length > 1 ? allLanguagesAllowed : allLanguagesAllowed[0];
        } catch (error: any) {
            console.error(`[${context}] Error: ${error.message}`);
            throw error;
        }
    }
}   