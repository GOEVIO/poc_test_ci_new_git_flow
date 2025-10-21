const mongoose = require('mongoose');
const { Schema } = mongoose;

//Invoice status
//10 - created
//20 - processing
//30 - failed
//40 - closed

const invoiceModel = new Schema(
    {
        id: { type: String, index: true },
        payments: [
            {
                code: { type: String },
                description: { type: String },
                unitPrice: { type: Number },
                uom: { type: String },
                quantity: { type: Number },
                vat: { type: Number },
                discount: { type: Number },
                total: { type: Number },
                currency: { type: String },
                taxExemptionReasonCode: { type: String },
            }
        ],
        userId: { type: String },
        emailUserId: [{ type: String }],
        status: { type: String },
        chargerType: { type: String },
        documentId: { type: String },
        type: { type: String },
        documentNumber: { type: String },
        documentUrl: { type: String },
        pdfDocumentName: { type: String },
        invoiceDocumentName: { type: String },
        summaryDocumentName: { type: String },
        emailStatus: { type: Boolean, default: false },
        paymentId: { type: String },
        attach: { type: Object },
        validationError: { type: Object },
        startDate: { type: String },
        endDate: { type: String },
        invoiceNumber: { type: String },
        billingType: { type: String },
        paymentIdList: [{ type: String }],
        transactionId: { type: String },
        dueDate: { type: String },
        emissionDate: { type: String },
        //WL
        clientName: { type: String, default: "EVIO" },
        authEmail: { type: String },
        authToken: { type: String },
        source: { type: String },
        ceme: { type: String },
        syncToHistory: { type: Boolean, default: false },
        argData: { type: Object },
        creditedInvoice : { type: String },
        billingProfile: { type: Object },
    },
    { timestamps: true }
);

//invoiceModel.index({ _id: 1 });
invoiceModel.index({ userId: 1 });
invoiceModel.index({ status: 1 });
invoiceModel.index({ documentNumber: 1 }, { background: true });

var invoice = (module.exports = mongoose.model("invoice", invoiceModel));

module.exports.createInvoice = function (newInvoice, callback) {
    newInvoice.save(callback);
};

module.exports.updateInvoice = function (query, values, callback) {
    invoice.findOneAndUpdate(query, values, callback);
};
