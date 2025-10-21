import IdentityLib from 'evio-library-identity';
import { get } from 'evio-library-commons/dist/src/util/function/objects';

export type ProjectedBillingProfileType = {
    userId: string;
    nif?: string;
};

function toEntry(billingProfile: ProjectedBillingProfileType): [string, ProjectedBillingProfileType] {
    return [get('userId', billingProfile), billingProfile];
}

const projection = {
    userId: 1,
    nif: 1,
};

/**
 * Finds billingProfiles by userIds and builds a map that matches the id with the billingProfile
 */
export async function getBillingProfiles(userIds: string[]): Promise<Record<string, any>> {
    if (!userIds.length) {
        return {};
    }
    const query = { userId: { $in: userIds } };

    const billingProfiles = (await IdentityLib.findBillingProfiles(query, projection)) as ProjectedBillingProfileType[];
    return Object.fromEntries(billingProfiles.map(toEntry));
}
