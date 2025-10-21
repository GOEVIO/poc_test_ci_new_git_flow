import User from '../../models/user';

export async function findOneUser(query: any): Promise<any> {
    try {
        const userFound = await User.findOne(query);
        return userFound;
    } catch (error) {
        throw error;
    }
}
