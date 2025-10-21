import Infrastructure from '../../../../models/infrastructure'

export type InfrastructureMap = Record<string, string>

const projection = {
  _id: 1,
  name: 1,
}

export async function getInfrastructures(userId: string): Promise<InfrastructureMap> {
  const query = { createUserId: userId }
  const infrastructures = await Infrastructure.find(query, projection).lean()

  return Object.fromEntries(
      infrastructures.map((i) => [i._id.toString(), i.name])
  )
}
