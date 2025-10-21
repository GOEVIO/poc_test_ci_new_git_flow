function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [hrs, mins, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

module.exports = { formatDuration };