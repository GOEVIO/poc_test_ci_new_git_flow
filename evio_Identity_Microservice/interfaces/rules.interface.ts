import { ObjectId, Document, Model, FilterQuery, UpdateQuery } from 'mongoose';
import { IDynamicRules } from './authentication.interface';

type RuleType = 'PROFILE' | 'GROUP' | 'FUNCTIONALITY' | 'SUPER';

export interface IRule {
    name: string,
    slug: string,
    type: RuleType,
    context?: string,
    permission?: string,
    ruleIds?: Array<ObjectId>
}

export interface IRuleDocument extends IRule, Document {}

export interface IRuleModel extends Model<IRuleDocument> {
    getRules: (query?: FilterQuery<IRuleDocument>) => Promise<Array<IRuleDocument>>;
    getRuleBySlug: (slug: string) => Promise<IRuleDocument>;
    getRuleById: (_id: string) => Promise<IRuleDocument>;
    createRule: (newRule: IRule) => Promise<IRuleDocument>;
    updateRule: (
        query: FilterQuery<IRuleDocument>,
        values: UpdateQuery<IRuleDocument>
    ) => Promise<IRuleDocument>;
    disableRuleById: (_id: string) => Promise<IRuleDocument>;
    calculateRules: (
        match: FilterQuery<IRuleDocument>,
        project?: object | null,
        findOne?: boolean,
        getNestedRulesRecursively?: boolean
    ) => Promise<IDynamicRules>
    getRequiredFields: () => Array<string>;
}

export interface IRuleDocumentWithRules extends IRuleDocument {
    rules: Array<IRuleDocument>;
}
