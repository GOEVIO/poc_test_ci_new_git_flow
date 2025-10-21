/**
 * Module dependencies.
 */

import merge from 'lodash/merge';
import get from 'lodash/get';

/**
 * Export `entities` reducer.
 */

export default (state = {}, action = {}) => {
  if (get(action, 'payload.entities')) {
    return merge({}, state, action.payload.entities);
  }

  return state;
}
