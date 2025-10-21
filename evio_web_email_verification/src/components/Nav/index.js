import './Nav.css';
import PropTypes from 'prop-types';
import React from 'react';

const Nav = (props) => (
    <div className="nav">
        {props.children}
    </div>
);

Nav.propTypes = {
    children: PropTypes.node
}

export default Nav;
