import { ClientTypeType } from '@/shared/types/client-type.type'
import { findUsers } from 'evio-library-identity'

export type ProjectedUser = {
  _id: string
  name: string
  email: string
  clientType: ClientTypeType
}

const projection = {
  _id: 1,
  name: 1,
  email: 1,
  clientType: 1,
}

export async function getUsersMap(
  userIds: string[],
  clientType?: string,
): Promise<Record<string, ProjectedUser>> {
  const query = {
    _id: { $in: userIds },
    ...(clientType ? { clientType } : {}),
  }
  const users = (await findUsers(query, projection)) as ProjectedUser[]
  return Object.fromEntries(users.map((user) => [user._id, user]))
}
