import {
    FilterQuery,
    ObjectId,
    Schema,
    UpdateQuery,
    model
} from 'mongoose';
import dotenv from 'dotenv-safe';
import { IRule, IRuleDocument, IRuleModel } from '../interfaces/rules.interface';
import { IDynamicRules } from '../interfaces/authentication.interface';

dotenv.load();

const rulesSchema = new Schema<IRuleDocument>(
    {
        name: { type: String, required: true },
        slug: { type: String, index: true, required: true },
        type: { type: String, required: true },
        context: { type: String },
        permission: { type: String },
        ruleIds: Array<ObjectId>,
    },
    { versionKey: false }
);

rulesSchema.statics.getRequiredFields = function () {
    return Object.keys(this.schema.obj).filter((key) => this.schema.obj[key]?.required);
};

rulesSchema.statics.getRules = async function (
    query: FilterQuery<IRuleDocument> = {}
): Promise<Array<IRuleDocument>> {
    return this.find(query, () => {});
};

rulesSchema.statics.getRuleBySlug = async function (slug: string): Promise<IRuleDocument> {
    return this.findOne({ slug });
};

rulesSchema.statics.getRuleById = async function (_id: string): Promise<IRuleDocument> {
    return this.findById(_id);
};

rulesSchema.statics.createRule = async function (newRule: IRule): Promise<IRuleDocument> {
    return this.create(newRule);
};

rulesSchema.statics.updateRule = async function (
    _id: string,
    values: UpdateQuery<IRuleDocument>
): Promise<IRuleDocument> {
    return this.findOneAndUpdate({ _id }, values, { new: true });
};

rulesSchema.statics.disableRuleById = async function (_id: string): Promise<IRuleDocument> {
    return this.findOneAndUpdate({ _id }, { $set: { active: false } }, { new: true });
};

rulesSchema.statics.calculateRules = async function (
    match: FilterQuery<IRuleDocument>,
    project?: object | null,
    findOne?: boolean,
    getNestedRulesRecursively: boolean = true
): Promise<IDynamicRules> {
    const functionalities:Array<IRuleDocument> = [];
    const matchQuery = { $match: match };
    const graphLookupQuery = {
        $graphLookup: {
            from: 'rules',
            startWith: '$ruleIds',
            connectFromField: 'ruleIds',
            connectToField: '_id',
            as: 'rules',
            maxDepth: getNestedRulesRecursively ? 4 : 0,
        },
    };

    const unsetQuery = { $unset: ['ruleIds', 'rules.ruleIds'] };

    const query: Array<object> = [{ ...matchQuery }];

    if (findOne) query.push({ $limit: 1 });

    query.push({ ...graphLookupQuery }, { ...unsetQuery });

    const rules = await this.aggregate(query);

    if (project) query.push({ $project: project });

    rules.forEach((mainRule) => {
        const subFunctionalities = mainRule?.rules.filter(({ type }) => type === 'FUNCTIONALITY') ?? [];

        if (mainRule.type === 'FUNCTIONALITY') functionalities.push(mainRule);
        if (subFunctionalities.length > 0) functionalities.push(...subFunctionalities);
    });

    return functionalities.reduce((group, { context, permission }) => {
        if (context) group[context]?.push(permission) ?? (group[context] = [permission]);
        return group;
    }, {});
};

const Rule = model<IRuleDocument, IRuleModel>('Rules', rulesSchema);

Rule.createIndexes({ slug: 1 }, (err) => {
    if (err) console.error(err);
});

export default Rule;
