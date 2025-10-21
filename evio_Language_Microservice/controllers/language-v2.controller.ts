import { Request, Response , Router} from 'express';
import { FileParams, TranslationParams } from '../interfaces/file.translaction';
import { FileTranslationService } from '../services/file.translaction';
import commons from 'evio-library-commons';

import Sentry from '@sentry/node';

const { ErrorHandlerCommon , Enums} = commons;
const { StatusCodeHttp } = Enums;

const router = Router();

router.get('/api/public/language/v2/components/:projectName/:componentName/translations/', async (req: Request<TranslationParams>, res: Response) => {
    const context = "GET /api/public/language/v2/components/{projectName}/{componentName}/translations/";
    try {
        const { projectName, componentName } = req.params;
        if(!projectName || !componentName ) { 
            throw ErrorHandlerCommon.BadRequest({
                code: 'server_bad_request',
                message: 'Component or project not found'
            })
        }
            
        const result = await FileTranslationService.retrieveFileTranslationMetadata(componentName, projectName);
        return res.status(StatusCodeHttp.OK).send(result);
    } catch (error) {
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
        
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
    
});

router.get('/api/public/language/v2/components/:projectName/:componentName/:lang/file/', async (req: Request<FileParams>, res: Response) => {
    const context = "GET /api/public/language/v2/components/{projectName}/{componentName}/:lang/file/";
    try {
        const { projectName, componentName, lang } = req.params;
        const clientname: string = req.headers['clientname'] as string;
        const { metadata } = req.query

        if(!projectName || !componentName || !lang ) { 
            throw ErrorHandlerCommon.BadRequest({
                code: 'server_bad_request',
                message: 'Component or project or language not found'
            })
        }

        console.log(`[${context}] projectName ${projectName}, componentName ${componentName}, lang ${lang}, clientname ${clientname}, metadata ${metadata}`);
        const responseMetadata = await FileTranslationService.retrieveAllLanguagesAllowed(clientname);
        console.log(`[${context}] responseMetadata`, responseMetadata);


        let response: Object | undefined = undefined;
        const responseTranslation = await FileTranslationService.retrieveFileTranslationByLanguage(projectName, componentName, lang);
        if(metadata === 'true') {
            response = {
                ...responseMetadata,
                ...responseTranslation
            }
        }

        return res.status(StatusCodeHttp.OK).send(response ?? responseTranslation);
    } catch (error) {
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
            
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});

router.get('/api/public/language/v2/languagesAllowed', async (req: Request<FileParams>, res: Response) => {
    const context = "GET /api/public/language/v2/languagesAllowed";
    try {
        const clientName: string = req.headers['clientname'] as string;

        if(!clientName) { 
            throw ErrorHandlerCommon.BadRequest({
                code: 'server_bad_request',
                message: 'Client name not found'
            })
        }

        const result = await FileTranslationService.retrieveAllLanguagesAllowed(clientName);
        return res.status(StatusCodeHttp.OK).send(result);
    } catch (error) {
        console.error(`[${context}] Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`);
            
        return res.status(error.status || error.statusCode || StatusCodeHttp.INTERNAL_SERVER_ERROR).send({
            auth: error?.auth ?? error?.error?.auth ?? false,
            code: error?.code ?? error?.error?.code ?? 'server_error',
            message: error?.message ?? error?.error?.message ?? 'Server error'
        });
    }
});



export default router;