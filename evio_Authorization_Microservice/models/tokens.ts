import { Schema, model, FilterQuery } from 'mongoose';
import { ITokenDocument, ITokenModel } from '../interfaces/tokens.interface';

const tokensModel = new Schema<ITokenDocument>(
    {
        userId: { type: String, require: true },
        guestUserId: { type: String, require: true },
        token: { type: String, require: true },
        refreshToken: { type: String },
        rules: { type: Object },
        clientName: { type: String, default: 'EVIO' },
        isMobile: { type: Boolean, require: true },
        expiresAt: { type: Date, default: null }
    },
    {
        timestamps: true,
    }
);

tokensModel.statics.createToken = function (token: ITokenDocument) {
    return token.save();
};

tokensModel.statics.updateToken = function (
    query: FilterQuery<ITokenDocument>,
    values: Partial<ITokenDocument>
) {
    return this.findOneAndUpdate(query, values);
};

tokensModel.statics.removeToken = function (query: FilterQuery<ITokenDocument>) {
    return this.findOneAndRemove(query);
};

tokensModel.statics.removeTokens = function (query: FilterQuery<ITokenDocument>) {
    return this.deleteMany(query);
};

tokensModel.statics.removeRules = function (query: FilterQuery<ITokenDocument>) {
    return this.updateMany(query, { $unset: { rules: 1 } });
};
// Setting TTL key using expiresAt Date Field to automatically remove document
tokensModel.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Token = model<ITokenDocument, ITokenModel>('Tokens', tokensModel);

export default Token;
