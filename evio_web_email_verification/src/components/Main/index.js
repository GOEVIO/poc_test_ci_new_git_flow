/**
 * Module dependencies.
 */

import './Main.css';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * `Main` component.
 */

const Main = (props) => (
  <div className="main">
    {props.children}
  </div>
);

/**
 * Props validation.
 */

Main.propTypes = {
  children: PropTypes.node
};

/**
 * Export `Main` component.
 */

export default Main;
