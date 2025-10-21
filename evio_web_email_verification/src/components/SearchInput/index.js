/**
 * Module dependencies.
 */

import './SearchInput.css';
import classnames from 'classnames';
import Input from '../Input';
import List from '../List';
import ListItem from '../ListItem';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Classes.
 */

const classes = {
  wrapper: (isFocused) => classnames(
    'input-search-wrapper',
    { focus: isFocused }
  )
}

/**
 * `SearchInput` component.
 */

class SearchInput extends React.Component {
  static propTypes = {
    autoComplete: PropTypes.string,
    name: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
  };

  state = {
    isFocused: false,
  };

  handleFocus = () => {
    this.setState({
      isFocused: true
    });
  };

  handleBlur = () => {
    this.setState({
      isFocused: false
    });
  };

  render() {
    const { isFocused } = this.state;
    const { autoComplete, onChange, placeholder, name } = this.props

    return (
      <div className="input-search-container">
        <div className={classes.wrapper(isFocused)}>
          <Input
            autoComplete={autoComplete}
            className="input-search"
            name={name}
            onBlur={this.handleBlur}
            onChange={onChange}
            onFocus={this.handleFocus}
            placeholder={placeholder}
          />

          {isFocused && <List className="input-search-panel">{this.props.children}</List>}
        </div>
      </div>
    )
  }
}

export const SearchInputItem = (props) => (
  <ListItem className="input-search-results">{props.children}</ListItem>
);

/**
 * Props validation.
 */

SearchInputItem.propTypes = {
  children: PropTypes.node,
};

/**
 * Export `SearchInput`;
 */

export default SearchInput;
