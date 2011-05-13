var EXPORTED_SYMBOLS = ["XMLNode"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

var $FIRST_LEVEL_ELEMENTS = {
  'message'             : 'jabber:client',
  'presence'            : 'jabber:client',
  'iq'                  : 'jabber:client',
  'stream:features'     : 'http://etherx.jabber.org/streams',
  'proceed'             : 'urn:ietf:params:xml:ns:xmpp-tls',
  'failure'             : ['urn:ietf:params:xml:ns:xmpp-tls',
                           'urn:ietf:params:xml:ns:xmpp-sasl'],
  'success'             : 'urn:ietf:params:xml:ns:xmpp-sasl',
  'failure'             : 'urn:ietf:params:xml:ns:xmpp-sasl',
  'challenge'           : 'urn:ietf:params:xml:ns:xmpp-sasl',
  'error'               : 'urn:ietf:params:xml:ns:xmpp-streams',
};

function TextNode(text) {
  this.text = text;
}

TextNode.prototype = {
  get type() "text",

  convertToString: function(indent) {
    return indent + this.text + '\n';
  },

  getXML: function() {
    return this.text;
  }
};

function XMLNode(parent_node, uri, localName, qName, attributes) {
  this.parent_node = parent_node;
  this.uri = uri;
  this.localName = localName;
  this.qName = qName;
  this.attributes = {};
  this.children = [];
  this.cmap = [];

  for(var i = 0; i < attributes.length; ++i) {
    this.attributes[attributes.getQName(i)] = attributes.getValue(i);
  }
}

XMLNode.prototype = {
  get type() "node",

  addChild: function(node) {
    if(this.cmap[node.qName])
     this.cmap[node.qName].push(node);
    else
     this.cmap[node.qName] = [node];

    this.children.push(node);
  },

  addText: function(text) {
    this.children.push(new TextNode(text));
  },

  child: function(name) {
    if(this.cmap[name])
      return this.cmap[name];
    return [];
  },

  isXmppStanza: function() {
//    return true;
    if($FIRST_LEVEL_ELEMENTS[this.qName] && ($FIRST_LEVEL_ELEMENTS[this.qName] == this.uri ||
       ($FIRST_LEVEL_ELEMENTS[this.qName] instanceof Array &&
       $FIRST_LEVEL_ELEMENTS[this.qName].indexOf(this.uri) != -1)))
      return true;
    else
      return false;
    // TODO 
  },

  convertToString: function(indent) {
    if(!indent)
      indent = '';

    var s = indent + '<' + this.qName + ' xmlns:' + this.uri + ' ' + this.getAttributeText() + '>\n';

    for(var i = 0; i < this.children.length; ++i) {
      s += this.children[i].convertToString(indent + ' ');
    }
    s += indent + '</' + this.qName + '>\n';

    return s;
  },

  getAttributeText: function() {
    var s = "";

    for(var name in this.attributes) {
      s += name + '="' + this.attributes[name] + '" ';
    }

    return s;
  },

  getXML: function() {
    return '<' + this.qName + ' xmlns:' + this.uri + ' ' + this.getAttributeText() + '>' +
        this.innerXML() +
        '</' + this.qName + '>';
  },

  innerXML: function() {
    var s = '';
    for(var i = 0; i < this.children.length; ++i) {
      s += this.children[i].getXML();
    }

    return s;
  }
};

