/**
 * Module dependencies.
 */

import { applyMiddleware, createStore, compose } from 'redux';
import reducer from './reducers';
import logger from 'redux-logger';
import thunk from 'redux-thunk';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

/**
 * Export `createStore`.
 */

export default () => createStore(
  reducer,
  composeEnhancers(
    applyMiddleware(thunk, logger)
  )
);
