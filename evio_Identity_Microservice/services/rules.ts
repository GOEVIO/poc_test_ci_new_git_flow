import { isValidObjectId } from 'mongoose';
import axios from 'axios';
import { IRule, IRuleDocument } from "../interfaces/rules.interface";
import Rule from '../models/rules';
import { BadRequest, checkRequiredFields, isValidSlug } from '../utils';

async function revokeUsersCachedRules() {
    const host = `${process.env.HostAuthorization}/api/validTokens/revokeCachedRules`;
    axios.patch(host);
}

function defaultValidation(rule: IRule): Array<string> {
    const requiredFields = Rule.getRequiredFields();

    const errorList = checkRequiredFields(rule, requiredFields);

    if (!isValidSlug(rule.slug?.toLowerCase())) {
        errorList.push('Slug is required and must be valid');
    }

    if (rule?.ruleIds && rule.ruleIds.some((ruleId) => !isValidObjectId(ruleId))) {
        errorList.push('ruleIds must be a list of valid ObjectIds');
    }

    return errorList;
}

async function listRules(): Promise<Array<IRuleDocument>> {
    return Rule.getRules();
}

async function getRuleByIndex(index: string): Promise<IRuleDocument> {
    if (isValidObjectId(index)) {
        return Rule.getRuleById(index);
    }
    return Rule.getRuleBySlug(index);
}

async function createRule(rule: IRule): Promise<IRuleDocument> {
    const errorList = defaultValidation(rule);

    if (errorList.length > 0) throw BadRequest(errorList);

    return Rule.createRule(rule);
}

async function updateRule(rule: IRule, _id: string): Promise<IRuleDocument> {
    const errorList = defaultValidation(rule);

    if (!isValidObjectId(_id)) errorList.push('Rule ID must be a valid objectId');

    if (errorList.length > 0) throw BadRequest(errorList);

    const updatedRule = await Rule.updateRule({ _id }, rule);

    revokeUsersCachedRules();

    return updatedRule;
}

async function patchRule(rule: Partial<IRule>, _id: string): Promise<IRuleDocument> {
    const errorList: Array<string> = [];

    Object.entries(rule).forEach(([param, value]) => {
        if (value == null || value === '') {
            errorList.push(`Param [${param}] must have a value`);
        }

        if (param === 'slug'
            && (!rule.slug || !isValidSlug(rule.slug.toLowerCase()))
        ) {
            errorList.push('Slug is required and must be valid');
        }

        if (param === 'ruleIds'
            && (!Array.isArray(rule.ruleIds)
                || rule.ruleIds.some((ruleId) => !isValidObjectId(ruleId))
            )
        ) {
            errorList.push('ruleIds must be a list of valid ObjectIds');
        }
    });

    if (!isValidObjectId(_id)) errorList.push('Rule ID must be a valid objectId');

    if (errorList.length > 0) throw BadRequest(errorList);

    const patchedRule = await Rule.updateRule({ _id }, rule);

    if (rule.ruleIds || rule.context || rule.permission) revokeUsersCachedRules();

    return patchedRule;
}

async function disableRule(_id: string): Promise<IRuleDocument> {
    if (!isValidObjectId(_id)) throw BadRequest('Rule ID must be a valid objectId');
    const disabledRule = await Rule.disableRuleById(_id);

    revokeUsersCachedRules();

    return disabledRule;
}

export default {
    listRules,
    getRuleByIndex,
    createRule,
    updateRule,
    patchRule,
    disableRule
};
