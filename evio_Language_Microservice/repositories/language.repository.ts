import { AppConfigurationReadRepository } from "evio-library-configs";
import commons from 'evio-library-commons';

const { ErrorHandlerCommon , Enums} = commons;

export class LanguageRepository { 

    async retrieveAppConfigurations(clientName: string | undefined) {
        const context = "[retrieveAppConfigurations]";
        const appConfig = clientName ? [await AppConfigurationReadRepository.getAppConfigurationsByClient(clientName)] : await AppConfigurationReadRepository.getAppConfigurations();
        if(!appConfig) {
            throw ErrorHandlerCommon.BadRequest({
                code: 'app_config_not_found',
                message: 'AppConfigurations not found',
            },context );
        }
        return appConfig;
    }
}