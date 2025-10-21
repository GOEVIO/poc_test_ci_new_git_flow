/**
 * Module dependencies.
 */

import axios from 'axios';
import url from 'url';

const API_KEY = '5bc02a5533a6e124377eac87344a5506';

export const patchAccount = (id) => {
  axios.patch('localhost:4000/api/users/' + id + '/', {
    "active": true
  });
}

