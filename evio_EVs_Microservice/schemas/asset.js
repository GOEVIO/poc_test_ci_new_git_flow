const { z } = require('zod');
const ObjectId = require('mongoose').Types.ObjectId;
const Commons = require("evio-library-commons").default;

// ObjectId validation
const objectIdValidation = z.union([
    z.string().refine((val) => ObjectId.isValid(val), {
      message: "Invalid id format. Must be a valid asset id.",
    }),
    z.instanceof(ObjectId), // Allow native ObjectId instances
]);


// Define an update network asset asset schema
const updateNetworkAssetSchema = z.object({
    id: objectIdValidation,
    networks: z.array(z.string().min(1)).nonempty("networks must contain at least one entry"),
    action : z.enum(["ACTIVATE", "DEACTIVATE"], "action is required"),

});



// Define a create asset schema
const createAssetSchema = z.object({
    country: z.string().min(2, "country is required with iso alpha-2 format"),
    generalDesignation: z.string().min(1, "generalDesignation is required"),
    specificDesignation: z.string().min(1, "specificDesignation is required"),
    otherInfo: z.string().optional(),
    rfidTag: z.string().optional(),
    cardNumber: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    version: z.string().optional(),
    dateFrom: z.string().optional(),
    imageContent: z.string().optional(),
    plugPower: z.number().optional(),
    vehicleId: z.number().optional(),
    assetType: z.enum(Commons.Constants.AssetTypes, "assetType is required"),
});

// Define a delete asset schema
const deleteAssetSchema = z.object({
    id: objectIdValidation,
});



// Define an update asset schema
const updateAssetSchema = z.object({
    id: objectIdValidation,
    country: z.string().min(2, "country is required with iso alpha-2 format"),
    generalDesignation: z.string().min(1, "generalDesignation is required"),
    specificDesignation: z.string().min(1, "specificDesignation is required"),
    otherInfo: z.string().optional(),
    rfidTag: z.string().optional(),
    cardNumber: z.string().optional(),
}).strict();



module.exports = {
    updateNetworkAssetSchema,
    createAssetSchema,
    deleteAssetSchema,
    updateAssetSchema
}

