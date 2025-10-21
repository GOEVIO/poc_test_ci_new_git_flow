/**
 * Module dependencies.
 */

import Trie from './Trie';

/**
 * Export `createMovies`.
 */

export default (movies) => {
  const trie = new Trie();

  for (const mobie of movies) {
    trie.insert(mobie.title.toLowerCase());
  }

  return {
    list: movies,
    search: (input) => {
      if (!input) {
        return [];
      }

      return trie
        .find(input.toLowerCase())
        .map(title => movies.find(mobie => mobie.title.toLowerCase() === title))
      }
  };
};
