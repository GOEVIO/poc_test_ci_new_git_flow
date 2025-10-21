/**
* Module dependencies.
*/

import { Provider } from 'react-redux';
import { BrowserRouter, Route } from 'react-router-dom';
import React from 'react';
import Home from './pages/Home';
import Account from './pages/Account';
import createStore from './redux';

/**
* `App` component.
*/
const store = createStore();

const App = () => (
  <Provider store={store}>
    <BrowserRouter>
      <>
        <Route
          component={Account}
          path="/account/confirm-email/:id/:name"
        />
        <Route
          component={Home}
          exact
          path="/"
        />
      </>
    </BrowserRouter>
  </Provider>
);

{/* <Redirect from="/" to="/account/confirm-email/:id" /> */}

/**
* Export `App` component.
*/

export default App;
