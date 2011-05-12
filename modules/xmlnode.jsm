function XMLNode(parent, uri, localName, qName, attributes) {
  this.parent = parent;
  this.uri = uri;
  this.localName = localName;
  this.qName = qName;
  this.attributes = attributes;
  this.children = [];
  this.text = [];
}

XMLNode.prototype = {
  addChild: function(node) {
    this.children.push(node);
  },

  addText: function(text) {
    this.text.push(text);
  },

  isXmppStanza: function() {
    /* TODO */
  },

  toString: function(indent) {
    if(!indent)
      indent = '';

    var s = indent + '<' + this.qName + ' xmlns:' + this.uri + '>\n';
    for(var i = 0; i < this.children.length; ++i) {
      s += this.children[i].toString(indent + ' ');
    }
    s += indent + '</ ' + this.qName + '>';
  }
};
