/**
 * Module dependencies.
 */

import { normalize } from 'normalizr';
import * as selectors from './selectors';
import * as sdk from '../api';
import * as types from './types';
import * as schema from './schema';

export const patchAccount = (id) => async (dispatch) => {
  dispatch({ type: types.PATCH_ACCOUNT_REQUEST });

  const { data } = await sdk.patchAccount(id);

  dispatch({
    type: types.PATCH_ACCOUNT_SUCCESS,
    payload: normalize(data.results, [schema.user]),
  });
}
