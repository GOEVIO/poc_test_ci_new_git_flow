import { Schema, model } from 'mongoose';


const emailChangeRequestSchema = new Schema({
    userId: { type: String },
    oldEmail: { type: String },
    newEmail: { type: String },
    type: { type: String },
    expiresAt: { type: Date, nullable: true },
    clientName: { type: String, default: process.env.clientNameEVIO },
    clientType: { type: String, default: process.env.ClientTypeB2C },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
},
{
    timestamps: true
});

const EmailChangeRequest = model('EmailChangeRequest', emailChangeRequestSchema);
export default EmailChangeRequest;