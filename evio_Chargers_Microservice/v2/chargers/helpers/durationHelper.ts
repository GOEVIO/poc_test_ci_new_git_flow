class DurationHelper {

    public static formatDuration(durationInSeconds: number): string {
        if (isNaN(durationInSeconds) || durationInSeconds <= 0) {
            return '';
        }

        const days = Math.floor(durationInSeconds / (3600 * 24));

        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor((durationInSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((durationInSeconds % 3600) / 60);
            return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
        }
    }
}

export default DurationHelper;
