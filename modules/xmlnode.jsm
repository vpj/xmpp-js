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


function XMLNode(parent_node, uri, localName, qName, attributes) {
  this.parent_node = parent_node;
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

    var s = indent + '<' + this.qName + ' xmlns:' + this.uri + '>\n';
    for(var i = 0; i < this.children.length; ++i) {
      s += this.children[i].convertToString(indent + ' ');
    }
    s += indent + '</ ' + this.qName + '>';

    return s;
  }
};
