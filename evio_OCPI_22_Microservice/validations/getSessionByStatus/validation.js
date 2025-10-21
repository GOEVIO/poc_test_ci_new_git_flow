const { getSessionSchema } = require('./schemas/getSession.schema');

const validateGetSessionsByStatus = (req) => {
    try{
        const validationObject = {
            ...req.query, 
            status: Array.isArray(req.query?.status) ? 
                req.query?.status.map(status => status.toUpperCase()) : 
                [req.query?.status?.toUpperCase()],
        }
        if(req.query?.invalidateReason){
            validationObject.invalidateReason = Array.isArray(req.query?.invalidateReason) ? 
                req.query?.invalidateReason.map(reason => reason.toUpperCase()) :
                [req.query?.invalidateReason?.toUpperCase()]
        }
        
        return getSessionSchema.parse(validationObject);
    }catch(error){
        throw error
    }
    
}

module.exports = validateGetSessionsByStatus;