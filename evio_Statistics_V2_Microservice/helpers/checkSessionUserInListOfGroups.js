const { captureException } = require('@sentry/node');

module.exports = {
    /**
     * 
     * @param {} charger 
     * @param  userId 
     * @description This function checks if the userId is present in any of the groups within the charger object.
     * It iterates through the list of groups and their respective users to find a match.
     * If the userId is found, it returns true; otherwise, it returns false.
     * If the charger object is invalid or the listOfGroups is empty, it logs a warning and returns false.
     * If an error occurs during the process, it logs the error and captures it using Sentry.
     * @example
     * const charger = {
     *   listOfGroups: [
     *     {
     *       listOfUsers: [
     *         { userId: 'user1' },
     *         { userId: 'user2' }
     *       ]
     *     }
     *  ]
     * };
     * const userId = 'user2';
     * const result = checkSessionUserInListOfGroups(charger, userId);
     * console.log(result); // true
     * @returns {boolean} - Returns true if the userId is found in any group, false otherwise.
     * @throws {Error} - Throws an error if the charger object is invalid or if an error occurs during the process.
     */
    checkSessionUserInListOfGroups: (charger, userId) => {
        const context = "[Helper function checkSessionUserInListOfGroups]";
        try {
            if (!charger?.listOfGroups?.length || !userId) {
                console.warn(`${context} Charger object is invalid or listOfGroups is empty or userId is missing.`);
                return false;
            }
            return charger.listOfGroups.some(group => {
                if (!group?.listOfUsers?.length) {
                    console.warn(`${context} Group object is invalid or listOfUsers is empty.`);
                    return false;
                }
                return group.listOfUsers.some(user => user?.userId === userId);
            });

        } catch (error) {
            console.error(`${context} Error: ${error.message}`);
            captureException(error);
            return false;
        }
    }
}