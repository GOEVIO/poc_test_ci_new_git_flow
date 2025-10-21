/**
 * Module dependencies.
 */

import './Grid.css';
import List from '../List';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * `Grid` component.
 */

const Grid = (props) => (
  <List className="grid">
    {props.children}
  </List>
);

/**
 * Props validation.
 */

Grid.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
};

/**
 * Export `Grid`.
 */

export default Grid;
