/**
 * Module dependencies.
 */

import './Account.css';
import * as actions from '../redux/actions';
import { withRouter } from 'react-router';
import Container from '../components/Container';
import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import logo from '../images/ic_launcher.png';
import emailImage from '../images/email.png';
import axios from 'axios';

class Account extends React.Component {

  constructor() {
    super();
    this.state = {
      active: false
    };

  }

  handleClick(id) {
    console.log("Aq");

    let config = {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

    var url = 'http://85.88.143.237:3000/api/private/users/' + id + '/';
    axios.patch(url, {
      'active': 'true'
    }, config).then(res => {
      //console.log(res);
      //alert(res.data.email + ' was successfully validated.');
      this.setState({
        active: true
      });
    })
      .catch(err => {
        console.log(err);
      });
  }


  render() {

    
    const { id, name } = this.props.match.params;
    

    if (this.state.active == false) {
      return (
        <body>
          <div class="container bg">

            <h1 class="py-5 text-center vertical">{`Welcome to evio ${name}`}</h1>
            <img src={logo} alt="evio" class="img-fluid myimg" />
            <p class="py-5 text-center">Please confirm your email address</p>
            <button id="myButton" onClick={() => this.handleClick(id)} type="button" class="btn btn-primary btn-lg"><img class="myIconImage" src={emailImage} />Validate Email</button>
            

          </div>
        </body>
      );
    }
    else {
      return (
        <body>
          <div class="container bg">

            <h1 class="py-5 text-center vertical">{`Welcome to evio ${name}`}</h1>
            <img src={logo} alt="evio" class="img-fluid myimg" />
            <br></br>
            <div class="alert alert-success" role="alert" >
              <h4 class="alert-heading">Well done!</h4>
              <p>Thank you for use evio, you was successfully validated.</p>
              <p class="mb-0">Plase, access your account and enjoy our application</p>
            </div>


          </div>
        </body>
      );
    }
  }
}

export default withRouter(Account);
