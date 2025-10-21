export const getLastReadingPoint = (readingPoints: any[]) => {
    if (!readingPoints || readingPoints.length === 0) return null;
    return readingPoints[readingPoints.length - 1];
};
