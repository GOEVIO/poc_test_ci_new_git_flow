declare module 'mongoose' {
    namespace Types {
        interface ObjectIdConstructor {
            new (id?: string | number | any): ObjectId;
            (id?: string | number | any): ObjectId;
            isValid(id: any): boolean;
            equals(otherId: any): boolean;
        }
    }
    interface UpdateWriteOpResult {
        nModified?: number;
    }
}
