export const setMetersOcpi = (session: any, updatedHistory: any) => {
    if(session?.readingPoints?.length && session.readingPoints[0]?.totalPower){
        updatedHistory.meterStart = session.readingPoints[0]?.totalPower; 
        updatedHistory.meterStop = session.readingPoints[session.readingPoints.length - 1]?.totalPower; 
    }
    return updatedHistory
}