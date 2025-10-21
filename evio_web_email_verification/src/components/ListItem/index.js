/**
 * Module dependencies.
 */

import PropTypes from 'prop-types';
import React from 'react';

/**
 * `ListItem` component.
 */

const ListItem = (props) => (
  <div className={props.className}>
    {props.children}
  </div>
);

/**
 * Props validation.
 */

ListItem.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * Export `ListItem`.
 */

export default ListItem;
