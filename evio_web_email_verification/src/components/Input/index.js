/**
 * Module dependencies.
 */

import './Input.css';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * `Input` component.
 */

const Input = (props) => {
  const { id, className, name, ...rest } = props;

  return (
    <input
      className={classnames('input', className)}
      id={id || name}
      name={ name }
      {...rest}
    />
  )
};

/**
 * Props validation.
 */

Input.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
};

/**
 * Export `Input`.
 */

export default Input;
