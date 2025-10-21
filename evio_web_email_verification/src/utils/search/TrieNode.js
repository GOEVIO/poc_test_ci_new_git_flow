/**
 * Export `TrieNode`.
 */

export default class TrieNode {
  constructor(key) {
    this.children = {};
    this.end = false;
    this.key = key;
    this.parent = null;
  }

  getWord() {
    let node = this;
    const output = [];

    while (node !== null) {
      output.unshift(node.key);
      node = node.parent;
    }

    return output.join("");
  }
}
