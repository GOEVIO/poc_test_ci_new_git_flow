export const sessionIsNotCompleted = (session: any, origin: "ocpi22" | "ocpp") => {
    const validStatus = {
        ocpi22: ['COMPLETED', 'EXPIRED', 'SUSPENDED'],
        ocpp: ['70', '40']
    }
    return !validStatus[origin].includes(session.status)
}