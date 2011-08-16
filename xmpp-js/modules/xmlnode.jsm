/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["TextNode", "XMLNode", "Stanza", "$NS"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");

const $NS = {
  xml                       : "http://www.w3.org/XML/1998/namespace",
  xhtml                     : "http://www.w3.org/1999/xhtml",
  xhtml_im                  : "http://jabber.org/protocol/xhtml-im",

  //auth
  client                    : "jabber:client",
  streams                   : "http://etherx.jabber.org/streams",
  stream                    : "urn:ietf:params:xml:ns:xmpp-streams",
  sasl                      : "urn:ietf:params:xml:ns:xmpp-sasl",
  tls                       : "urn:ietf:params:xml:ns:xmpp-tls",
  bind                      : "urn:ietf:params:xml:ns:xmpp-bind",
  session                   : "urn:ietf:params:xml:ns:xmpp-session",
  auth                      : "jabber:iq:auth",
  http_bind                 : "http://jabber.org/protocol/httpbind",
  http_auth                 : "http://jabber.org/protocol/http-auth",
  xbosh                     : "urn:xmpp:xbosh",

  private                   : "jabber:iq:private",
  xdata                     : "jabber:x:data",

  //roster
  roster                    : "jabber:iq:roster",
  roster_versioning         : "urn:xmpp:features:rosterver",
  roster_delimiter          : "roster:delimiter",

  //privacy lists
  privacy                   : "jabber:iq:privacy",

  //discovering
  disco_info                : "http://jabber.org/protocol/disco#info",
  disco_items               : "http://jabber.org/protocol/disco#items",
  caps                      : "http://jabber.org/protocol/caps",

  //addressing
  address                   : "http://jabber.org/protocol/address",

  muc_user                  : "http://jabber.org/protocol/muc#user",
  muc                       : "http://jabber.org/protocol/muc",
  register                  : "jabber:iq:register",
  delay                     : "jabber:x:delay",
  bookmarks                 : "storage:bookmarks",
  chatstates                : "http://jabber.org/protocol/chatstates",
  event                     : "jabber:x:event",
  stanzas                   : "urn:ietf:params:xml:ns:xmpp-stanzas",
  vcard                     : "vcard-temp",
  vcard_update              : "vcard-temp:x:update",
  ping                      : "urn:xmpp:ping",

  geoloc                    : "http://jabber.org/protocol/geoloc",
  geoloc_notify             : "http://jabber.org/protocol/geoloc+notify",
  mood                      : "http://jabber.org/protocol/mood",
  tune                      : "http://jabber.org/protocol/tune",
  nick                      : "http://jabber.org/protocol/nick",
  nick_notify               : "http://jabber.org/protocol/nick+notify",
  activity                  : "http://jabber.org/protocol/activity",
  avatar_data               : "urn:xmpp:avatar:data",
  avatar_data_notify        : "urn:xmpp:avatar:data+notify",
  avatar_metadata           : "urn:xmpp:avatar:metadata",
  avatar_metadata_notify    : "urn:xmpp:avatar:metadata+notify",
  pubsub                    : "http://jabber.org/protocol/pubsub",
  pubsub_event              : "http://jabber.org/protocol/pubsub#event",
};


var $FIRST_LEVEL_ELEMENTS = {
  "message"             : "jabber:client",
  "presence"            : "jabber:client",
  "iq"                  : "jabber:client",
  "stream:features"     : "http://etherx.jabber.org/streams",
  "proceed"             : "urn:ietf:params:xml:ns:xmpp-tls",
  "failure"             : ["urn:ietf:params:xml:ns:xmpp-tls",
                           "urn:ietf:params:xml:ns:xmpp-sasl"],
  "success"             : "urn:ietf:params:xml:ns:xmpp-sasl",
  "failure"             : "urn:ietf:params:xml:ns:xmpp-sasl",
  "challenge"           : "urn:ietf:params:xml:ns:xmpp-sasl",
  "error"               : "urn:ietf:params:xml:ns:xmpp-streams",
};

/* Stanza Builder */
const Stanza = {
  /* Create a presence stanza */
  presence: function(aAttr, aData) {
    return Stanza.node("presence", null, aAttr, aData);
  },

  /* Parse a presence stanza */
  parsePresence: function(aStanza) {
    let p = {show: Ci.imIStatusInfo.STATUS_AVAILABLE,
             status: null};
    let show = aStanza.getChildren("show");
    if (show.length > 0) {
      show = show[0].innerXML();
      if (show == "away")
        p.show = Ci.imIStatusInfo.STATUS_AWAY;
      else if (show == "chat")
        p.show = Ci.imIStatusInfo.STATUS_AVAILABLE;
      else if (show == "dnd")
        p.show = Ci.imIStatusInfo.STATUS_UNAVAILABLE;
      else if (show == "xa")
        p.show = Ci.imIStatusInfo.STATUS_IDLE;
    }

    if (aStanza.attributes["type"] == "unavailable") {
      p.show = Ci.imIStatusInfo.STATUS_OFFLINE;
    }

    let status = aStanza.getChildren("status");
    if (status.length > 0) {
      status = status[0].innerXML();
      p.status = status;
    }

    return p;
  },

  /* Parse a vCard */
  parseVCard: function(aStanza) {
    let vCard = {jid: null, fullname: null, icon: null};
    vCard.jid = parseJID(aStanza.attributes["from"]);
    if (!vCard.jid)
      return null;
    let v = aStanza.getChildren("vCard");
    if (v.length <= 0)
      return null;
    v = v[0];
    for each (let c in v.children) {
      if (c.type == "node") {
        if (c.localName == "FN")
          vCard.fullname = c.innerXML();
        if (c.localName == "PHOTO") {
          let icon = saveIcon(vCard.jid.jid,
                   c.getChildren("TYPE")[0].innerXML(),
                   c.getChildren("BINVAL")[0].innerXML());
          vCard.icon = icon;
        }
      }
    }

    return vCard;
  },

  /* Create a message stanza */
  message: function(aTo, aMsg, aState, aAttr, aData) {
    if (!aAttr)
      aAttr = {};

    aAttr["to"] = aTo;
    aAttr["type"] = "chat";

    if(!aData)
      aData = [];

    if(aMsg)
      aData.push(Stanza.node("body", null, {}, aMsg));

    if(aState)
      aData.push(Stanza.node(aState, $NS.chatstates, {}, []));

    return Stanza.node("message", null, aAttr, aData);
  },

  /* Parse a message stanza */
  parseMessage: function(aStanza) {
    let m = {from: null,
             body: null,
             state: null};
    m.from = parseJID(aStanza.attributes["from"]);
    let b = aStanza.getChildren("body");
    if (b.length > 0)
      m.body = b[0].innerXML();

    let s = aStanza.getChildrenByNS($NS.chatstates)
    if(s.length > 0) {
      m.state = s[0].localName;
    }

    return m;
  },

  /* Create a iq stanza */
  iq: function(aType, aId, aTo, aData) {
    let n = new XMLNode(null, null, "iq", "iq", null)
    if (aId)
      n.attributes["id"] = aId;
    if (aTo)
      n.attributes["to"] = aTo;

    n.attributes["type"] = aType;

    Stanza._addChildren(n, aData);

    return n;
  },

  /* Create a XML node */
  node: function(aName, aNs, aAttr, aData) {
    let n = new XMLNode(null, aNs, aName, aName, null);
    for (let at in aAttr) {
      n.attributes[at] = aAttr[at];
    }

    Stanza._addChildren(n, aData);

    return n;
  },

  _addChild: function(aNode, aData) {
    if (typeof(aData) == "string") {
      aNode.addText(aData);
    }
    else {
      aNode.addChild(aData);
      aData.parent_node = aData;
    }
  },

  _addChildren: function(aNode, aData) {
    if (Array.isArray(aData)) {
      for each (let data in aData)
        Stanza._addChild(aNode, data);
    }
    else {
      Stanza._addChild(aNode, aData);
    }
  },
};

/* Text node
 * Contains a text */
function TextNode(text) {
  this.text = text;
}

TextNode.prototype = {
  get type() "text",

  /* Returns a indented XML */
  convertToString: function(aIndent) aIndent + this.text + "\n",

  /* Returns the plain XML */
  getXML: function() this.text,

  /* Returns inner XML */
  innerXML: function() this.text
};

/* XML node */
function XMLNode(aParentNode, aUri, aLocalName, aQName, aAttr) {
  this.parent_node = aParentNode;
  this.uri = aUri;
  this.localName = aLocalName;
  this.qName = aQName;
  this.attributes = {};
  this.children = [];
  this.cmap = {};

  if (aAttr) {
    for (let i = 0; i < aAttr.length; ++i) {
      this.attributes[aAttr.getQName(i)] = aAttr.getValue(i);
    }
  }
}

XMLNode.prototype = {
  get type() "node",

  /* Add a new child node */
  addChild: function(aNode) {
    if (this.cmap.hasOwnProperty(aNode.qName))
     this.cmap[aNode.qName].push(aNode);
    else
     this.cmap[aNode.qName] = [aNode];

    this.children.push(aNode);
  },

  /* Add text node */
  addText: function(aText) {
    this.children.push(new TextNode(aText));
  },

  /* Get child elements by namespace */
  getChildrenByNS: function(aNS) {
    let res = [];

    for each(var c in this.children) {
      if(c.uri == aNS)
      res.push(c);
    }

    return res;
  },

  /* Get an element inside the node using a query */
  getElement: function(aQuery) {
   if (aQuery.length == 0)
     return null;
   if (this.qName != aQuery[0])
     return null;
   if (aQuery.length == 1)
     return this;

   let c = this.getChildren(aQuery[1]);
   let nq = aQuery.slice(1);
   for each (let child in c) {
     let n = child.getElement(nq);
     if (n)
       return n;
   }

   return null;
  },

  /* Get all elements matchign the query */
  getElements: function(aQuery) {
   if (aQuery.length == 0)
     return [];
   if (this.qName != aQuery[0])
     return [];
   if (aQuery.length == 1)
     return [this];

   let c = this.getChildren(aQuery[1]);
   let nq = aQuery.slice(1);
   let res = [];
   for each (let child in c) {
     let n = child.getElements(nq);
     res = res.concat(n);
   }

   return res;
  },

  /* Get immediate children by the node name */
  getChildren: function(aName) {
    if (this.cmap[aName])
      return this.cmap[aName];
    return [];
  },

  /* Test if the node is a stanza */
  isXmppStanza: function() {
    if ($FIRST_LEVEL_ELEMENTS[this.qName] && ($FIRST_LEVEL_ELEMENTS[this.qName] == this.uri ||
       (Array.isArray($FIRST_LEVEL_ELEMENTS[this.qName]) &&
       $FIRST_LEVEL_ELEMENTS[this.qName].indexOf(this.uri) != -1)))
      return true;
    else
      return false;
  },

  /* Returns indented XML */
  convertToString: function(aIndent) {
    if (!aIndent)
      aIndent = "";

    let s = aIndent + "<" + this.qName + " " + this._getXmlns() + " " + this._getAttributeText() + ">\n";

    for each (let child in this.children) {
      s += child.convertToString(aIndent + " ");
    }
    s += aIndent + "</" + this.qName + ">\n";

    return s;
  },

  /* Returns the XML */
  getXML: function() {
    return "<" + this.qName + " " + this._getXmlns() + " " + this._getAttributeText() + ">" +
        this.innerXML() +
        "</" + this.qName + ">";
  },

  /* Returns the inner XML */
  innerXML: function() {
    let s = "";
    for each (let child in this.children) {
      s += child.getXML();
    }

    return s;
  },

  /* Private methods */
  _getXmlns: function() {
    if (this.uri)
      return "xmlns=\"" + this.uri + "\"";
    else
      return "";
  },

  _getAttributeText: function() {
    let s = "";

    for (let name in this.attributes) {
      s += name + "=\"" + this.attributes[name] + "\" ";
    }

    return s;
  },
};

