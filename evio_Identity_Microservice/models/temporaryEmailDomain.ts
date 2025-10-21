import { Schema, model, Document } from 'mongoose';

interface ITemporaryEmailDomain extends Document {
    domain: string;
}

const TemporaryEmailDomainSchema = new Schema<ITemporaryEmailDomain>({
    domain: { type: String, required: true, unique: true },
});

// @ts-ignore
TemporaryEmailDomainSchema.index({ domain: 1 }, { unique: true });

const TemporaryEmailDomain = model<ITemporaryEmailDomain>(
    'temporaryEmailDomain',
    TemporaryEmailDomainSchema
);

export default TemporaryEmailDomain;
