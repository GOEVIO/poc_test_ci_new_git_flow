import { findOneThirdPartyProductMap, IInvoiceLinesDetails, isInvalidField } from "evio-library-statistics";
import { TAX_EXEMPTION_REASON_CODE_M40 } from '../constants'

export const createOCPPInvoiceDetails = async (session): Promise<IInvoiceLinesDetails[] | null> => {
    if(!session?.network || isInvalidField(session?.invoiceId)){
        return null
    }

    const query = {
        thirdPartyCode: session?.network === 'EVIO'? 'ISERV21014' : 'ISERV21024'
    }

    const thirdPartyProduct = await findOneThirdPartyProductMap(query);

    if(!thirdPartyProduct){
        return null
    }

    let invoiceDetails : any = {
        code: thirdPartyProduct.code,
        description: thirdPartyProduct?.description,
        unitPrice: session?.totalPrice?.excl_vat,
        uom: "UN",
        quantity: 1,
        vat: session?.fees?.IVA
    }
    if (session?.fees?.IVA == 0) {
        invoiceDetails.taxExemptionReasonCode = TAX_EXEMPTION_REASON_CODE_M40
    }
    return [invoiceDetails]
}