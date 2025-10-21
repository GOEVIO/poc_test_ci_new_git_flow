import { findBillingProfiles } from 'evio-library-identity'

export type ProjectedBillingProfile = {
  nif: string
  userId: string
}

const projection = {
  _id: 0,
  nif: 1,
  userId: 1,
}

export async function getBillingProfilesMap(
  userIds: string[],
): Promise<Record<string, ProjectedBillingProfile>> {
  const query = { userId: { $in: userIds } }
  const billingProfiles = (await findBillingProfiles(
    query,
    projection,
  )) as ProjectedBillingProfile[]

  return Object.fromEntries(billingProfiles.map((bp) => [bp.userId, bp]))
}
