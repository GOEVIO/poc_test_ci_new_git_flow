/**
* Module dependencies.
*/

import PropTypes from 'prop-types';
import React from 'react';

/**
* `List` component.
*/

const List = (props) => (
  <div className={props.className}>
    {props.children}
  </div>
);

/**
* Props validation.
*/

List.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  className: PropTypes.string,
  items: PropTypes.array,
};

/**
 * Export `List`.
 */

export default List;
