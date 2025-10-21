/**
 * Module dependencies.
 */

import './Container.css';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * `Container` component.
 */

const Container = (props) => (
  <div className="container">
    ZZZ
    {props.children}
  </div>
);

/**
 * Props validation.
 */

Container.propTypes = {
  children: PropTypes.node
};

/**
 * Export `Container`.
 */

export default Container;
