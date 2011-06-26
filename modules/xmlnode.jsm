var EXPORTED_SYMBOLS = ["TextNode", "XMLNode", "Stanza", "$NS"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");

const $NS = {
  xml                       : 'http://www.w3.org/XML/1998/namespace',
  xhtml                     : 'http://www.w3.org/1999/xhtml',
  xhtml_im                  : 'http://jabber.org/protocol/xhtml-im',

  //auth
  client                    : 'jabber:client',
  streams                   : 'http://etherx.jabber.org/streams',
  stream                    : 'urn:ietf:params:xml:ns:xmpp-streams',
  sasl                      : 'urn:ietf:params:xml:ns:xmpp-sasl',
  tls                       : 'urn:ietf:params:xml:ns:xmpp-tls',
  bind                      : 'urn:ietf:params:xml:ns:xmpp-bind',
  session                   : 'urn:ietf:params:xml:ns:xmpp-session',
  auth                      : 'jabber:iq:auth',
  http_bind                 : 'http://jabber.org/protocol/httpbind',
  http_auth                 : 'http://jabber.org/protocol/http-auth',
  xbosh                     : 'urn:xmpp:xbosh',

  private                   : 'jabber:iq:private',
  xdata                     : 'jabber:x:data',

  //roster
  roster                    : 'jabber:iq:roster',
  roster_versioning         : 'urn:xmpp:features:rosterver',
  roster_delimiter          : 'roster:delimiter',

  //privacy lists
  privacy                   : 'jabber:iq:privacy',

  //discovering
  disco_info                : 'http://jabber.org/protocol/disco#info',
  disco_items               : 'http://jabber.org/protocol/disco#items',
  caps                      : 'http://jabber.org/protocol/caps',

  //addressing
  address                   : 'http://jabber.org/protocol/address',

  muc_user                  : 'http://jabber.org/protocol/muc#user',
  muc                       : 'http://jabber.org/protocol/muc',
  register                  : 'jabber:iq:register',
  delay                     : 'jabber:x:delay',
  bookmarks                 : 'storage:bookmarks',
  chatstates                : 'http://jabber.org/protocol/chatstates',
  event                     : 'jabber:x:event',
  stanzas                   : 'urn:ietf:params:xml:ns:xmpp-stanzas',
  vcard                     : 'vcard-temp',
  vcard_update              : 'vcard-temp:x:update',
  ping                      : 'urn:xmpp:ping',

  geoloc                    : 'http://jabber.org/protocol/geoloc',
  geoloc_notify             : 'http://jabber.org/protocol/geoloc+notify',
  mood                      : 'http://jabber.org/protocol/mood',
  tune                      : 'http://jabber.org/protocol/tune',
  nick                      : 'http://jabber.org/protocol/nick',
  nick_notify               : 'http://jabber.org/protocol/nick+notify',
  activity                  : 'http://jabber.org/protocol/activity',
  avatar_data               : 'urn:xmpp:avatar:data',
  avatar_data_notify        : 'urn:xmpp:avatar:data+notify',
  avatar_metadata           : 'urn:xmpp:avatar:metadata',
  avatar_metadata_notify    : 'urn:xmpp:avatar:metadata+notify',
  pubsub                    : 'http://jabber.org/protocol/pubsub',
  pubsub_event              : 'http://jabber.org/protocol/pubsub#event',
};


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

const Stanza = {
  _addChild: function(node, data) {
    if(typeof(data) == 'string') {
      node.addText(data);
    } else {
      node.addChild(data);
      data.parent_node = data;
    }
  },

  _addChildren: function(node, data) {
    if(typeof(data) != 'string' && typeof(data.length) != 'undefined') {
      for(var i = 0; i < data.length; ++i)
        Stanza._addChild(node, data[i]);
    } else {
      Stanza._addChild(node, data);
    }
  },

  presence: function(attr, data) {
    return Stanza.node('presence', null, attr, data);
  },

  parsePresence: function(stanza) {
    var p = {show: Ci.imIStatusInfo.STATUS_AVAILABLE,
             status: null};
    var show = stanza.getChildren('show');
    if(show.length > 0) {
      show = show[0].innerXML();
      if(show == 'away')
        p.show = Ci.imIStatusInfo.STATUS_AWAY;
      else if(show == 'chat')
        p.show = Ci.imIStatusInfo.STATUS_AVAILABLE;
      else if(show == 'dnd')
        p.show = Ci.imIStatusInfo.STATUS_UNAVAILABLE;
      else if(show == 'xa')
        p.show = Ci.imIStatusInfo.STATUS_IDLE;
    }

    var status = stanza.getChildren('status');
    if(status.length > 0) {
      status = status[0].innerXML();
      p.status = status;
    }

    return p;
  },

  parseVCard: function(stanza) {
    var vCard = {jid: null, fullname: null, icon: null};
    debugJSON(stanza.attributes);
    vCard.jid = parseJID(stanza.attributes['from']);
    if(!vCard.jid)
      return null;
    var v = stanza.getChildren('vCard');
    if(v.length <= 0)
      return null;
    v = v[0];
    for(var i = 0; i < v.children.length; ++i) {
      var c = v.children[i];
      if(c.type == 'node') {
        if(c.localName == 'FN')
          vCard.fullname = c.innerXML();
        if(c.localName == 'PHOTO') {
          var icon = saveIcon(vCard.jid.jid,
                   c.getChildren('TYPE')[0].innerXML(),
                   c.getChildren('BINVAL')[0].innerXML());
          vCard.icon = icon;
        }
      }
    }

    return vCard;
  },

  message: function(to, attr, data) {
    if(!attr)
      attr = {};

    attr['to'] = to;

    return Stanza.node('message', null, attr, data);
  },

  parseMessage: function(stanza) {
    var m = {from: null,
             body: ''};
    m.from = parseJID(stanza.attributes['from']);
    var b = stanza.getChildren('body');
    if(b.length > 0)
      m.body = b[0].innerXML();

    return m;
  },

  iq: function(type, id, to, data) {
    var n = new XMLNode(null, null, 'iq', 'iq', null)
    if(id)
      n.attributes['id'] = id;
    if(to)
      n.attributes['to'] = to;

    n.attributes['type'] = type;

    Stanza._addChildren(n, data);

    return n;
  },

  node: function(name, ns, attr, data) {
    var n = new XMLNode(null, ns, name, name, null);
    for(var at in attr) {
      n.attributes[at] = attr[at];
    }

    Stanza._addChildren(n, data);

    return n;
  }
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
  },

  innerXML: function() {
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
  this.cmap = {};

  if(attributes) {
    for(var i = 0; i < attributes.length; ++i) {
      this.attributes[attributes.getQName(i)] = attributes.getValue(i);
    }
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
  
  getElement: function(query) {
   if(query.length == 0)
     return null;
   if(this.qName != query[0])
     return null;
   if(query.length == 1)
     return this;

   var c = this.getChildren(query[1]);
   var nq = query.slice(1);
   for(var i = 0; i < c.length; ++i) {
     var n = c[i].getElement(nq);
     if(n)
       return n;
   }

   return null;
  },

  getElements: function(query) {
   if(query.length == 0)
     return [];
   if(this.qName != query[0])
     return [];
   if(query.length == 1)
     return [this];

   var c = this.getChildren(query[1]);
   var nq = query.slice(1);
   var res = [];
   for(var i = 0; i < c.length; ++i) {
     var n = c[i].getElements(nq);
     res = res.concat(n);
   }

   return res;
  },

  getChildren: function(name) {
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

  _getXmlns: function() {
    if(this.uri)
      return 'xmlns="' + this.uri + '"';
    else
      return '';
  },

  convertToString: function(indent) {
    if(!indent)
      indent = '';

    var s = indent + '<' + this.qName + ' ' + this._getXmlns() + ' ' + this.getAttributeText() + '>\n';

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
    return '<' + this.qName + ' ' + this._getXmlns() + ' ' + this.getAttributeText() + '>' +
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

