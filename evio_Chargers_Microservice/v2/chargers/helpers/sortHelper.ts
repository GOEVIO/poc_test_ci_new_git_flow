class SortHelper {
    private static validSortFields = ['chargerId', 'chargerName', 'location', 'state', 'accessibility', 'status', 'plugId', 'qrCode'];

    public static isValidSortField(sort: string): boolean {
        return this.validSortFields.includes(sort);
    }
}

export default SortHelper;
