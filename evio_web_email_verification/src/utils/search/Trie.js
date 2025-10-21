/**
 * Module dependencies.
 */

import TrieNode from './TrieNode';

const findAllWords = (node, arr) => {
  if (node.end) {
    arr.unshift(node.getWord());
  }

  for (var child in node.children) {
    findAllWords(node.children[child], arr);
  }
}

/**
 * Export `Trie`.
 */

export default class Trie {
  root = new TrieNode(null);


  insert(word) {
    let node = this.root; // we start at the root 😬

    for (var i = 0; i < word.length; i++) {
      if (!node.children[word[i]]) {
        node.children[word[i]] = new TrieNode(word[i]);
        node.children[word[i]].parent = node;
      }

      node = node.children[word[i]];

      if (i === word.length - 1) {
        node.end = true;
      }
    }
  }

  contains(word) {
    let node = this.root;

    for (var i = 0; i < word.length; i++) {
      if (node.children[word[i]]) {
        node = node.children[word[i]];
      } else {
        return false;
      }
    }

    return node.end;
  }

  find(prefix) {
    const output = [];
    let node = this.root;

    for (let i = 0; i < prefix.length; i++) {
      if (node.children[prefix[i]]) {
        node = node.children[prefix[i]];
      } else {
        return output;
      }
    }

    findAllWords(node, output);

    return output;
  }
}
