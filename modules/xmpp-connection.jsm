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

var EXPORTED_SYMBOLS = ["XMPPConnection"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");

const CONNECTION_STATE = {
  disconnected: "disconected",
  connected: "connected"
};

/* XMPPSession will create the  XMPP connection to create sessions (authentication, etc) */
/* This will create the connection, handle proxy, parse xml */

/* Merge these two classes?*/
function XMPPSocket(aListener) {
  this.onDataAvailable = aListener.onDataAvailable.bind(aListener);
  this.onDataReceived = aListener.onDataReceived.bind(aListener);
  this.onConnection = aListener.onConnection.bind(aListener);
  this.onCertProblem = aListener.onCertProblem.bind(aListener);
  this.onConnectionReset = aListener.onConnectionReset.bind(aListener);
}

XMPPSocket.prototype = {
  __proto__: Socket,
  delimiter: "",
  uriScheme: "",
  connectTimeout: 30000,
  readWriteTimeout: 30000,
  log: function(aString) {
    debug("socket: " + aString);
  }
};

function XMPPConnection(aHost, aPort, aSecurity, aListener) {
  this._host = aHost;
  this._port = aPort;
  this._isStartTLS = false;
  this._security = aSecurity;
  if(this._security.indexOf('starttls') != -1) {
    this._isStartTLS = true;
  }

  this._proxy = null; // TODO
  this._listener = aListener;

  this._socket = null;

  this._state = CONNECTION_STATE.disconnected;
  this._parser = null;
}

XMPPConnection.prototype = {
  get isStartTLS() this._isStartTLS,

  connect: function() {
    this.setState(CONNECTION_STATE.socket_connecting);

    this._socket = new XMPPSocket(this);
    this.reset();
    this._socket.connect(this._host, this._port, this._security, this._proxy);
  },

  send: function(aMsg) {
    this._socket.sendData(aMsg);
  },

  close: function() {
   this._socket.disconnect();
   this.setState(CONNECTION_STATE.disconnected);
  },

  reset: function() {
    this._parser = createParser(this);
    this._parseReq = {
      cancel: function(status) {},
      isPending: function() {},
      resume: function() {},
      suspend: function() {}
    };
    this._parser.onStartRequest(this._parseReq, null);
  },

  startTLS: function() {
    this._socket.startTLS();
  },

  // Callbacks
  onConnection: function() {
    this.setState(CONNECTION_STATE.connected);
  },

  setState: function(state) {
    switch(state) {
      case CONNECTION_STATE.connected:
        this._listener.onConnection();
        break;
      default:
    }
  },

  onCertProblem: function(socketInfo, status, targetSite) {
    /* Open the add excetion dialog and reconnect
      Should this be part of the socket.jsm since all plugins using socket.jsm will need it? */
    this._addCertificate();
  },

  _addCertificate: function() {
    var prmt = Cc['@mozilla.org/embedcomp/prompt-service;1']
        .getService(Ci.nsIPromptService);
    var add = prmt.confirm(
        null,
        'Bad certificate',
        'Server "' + this._host + ':' + this._port + '"');

    if(!add)
     return;

    var args = {
      exceptionAdded: false,
      location: 'https://' + this._host + ':' + this._port,
      prefetchCert: true
    };
    var options = 'chrome=yes,modal=yes,centerscreen=yes';

    // FIXME: This dialog is giving errors :S
    var ww = Cc['@mozilla.org/embedcomp/window-watcher;1']
          .getService(Ci.nsIWindowWatcher)
    var self = this;
    async(function() {
      ww.openWindow(null,
            'chrome://pippki/content/exceptionDialog.xul',
            '',
            'chrome,modal,centerscreen',
            args);
      self.log('Window closed');
    });
  },

  // nsIStreamListener methods
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    /* No need to handle proxy stuff since it's handled by socket.jsm? */
    this.log("DataAvailable");
    try {
    this._parser.onDataAvailable(this._parseReq, null, aInputStream, aOffset, aCount);
    } catch(e) {
    debug('++++++++++++++++++++++++++++++++++++++error');
    debug(e);
    }
    //this.log(readInputStreamToString(aInputStream, aCount));
  },

  onConnectionReset: function() {
    this.log("ConnectionReset");
    this.setState(CONNECTION_STATE.disconnected);
  },

  onConnectionTimedOut: function() {
    this.log("ConnectionTimeout");
  },

  onDataReceived: function(data) {
    this.log(data);
    this._listener.handleMessage(data);
  },

  onXmppStanza: function(name, stanza) {
    this.log(stanza.convertToString());
    this._listener.onXmppStanza(name, stanza);
  },

  onStartStream: function() {
    /* Set state?? */
  },

  onEndStream: function() {
    /* Set state?? */
  },

  log: function(aString) {
    debug("connection: " + aString);
  },

  // nsITransportEventSink
  onTransportStatus: function(aTransport, aStatus, aProgress, aProgressmax) {
   /* statues == COnNECTED_TO
   is this when we should fire on connection? */
  }
};

function readInputStreamToString(stream, count) {
  var sstream = Cc['@mozilla.org/scriptableinputstream;1']
    .createInstance(Ci.nsIScriptableInputStream);
  sstream.init(stream);
  return sstream.read(count);
}

function createParser(aListener) {
  var parser = Cc['@mozilla.org/saxparser/xmlreader;1']
              .createInstance(Ci.nsISAXXMLReader);

  parser.errorHandler = {
    error: function() { },
    fatelError: function() { },
    ignorableWarning: function() { },
    QueryInterface: function(iid) {
      if(!iid.equals(Ci.nsiSupports) && !iid.equals(Ci.nsiISAXErrorHandler))
        throw Cr.NS_ERROR_NO_INTERFACE;
      return this;
    }
  };

  parser.contentHandler = {
    startDocument: function() {
      aListener.onStartStream();
    },

    endDocument: function() {
      aListener.onEndStream();
    },

    startElement: function(uri, localName, qName, attributes) {
      if(!this._node) {
      }
      // TODO:Should <stream:stream> be ignored? Otherwise the whole stream will be kept in memory
//      aListener.log('start: ' + qName);

      var node = new XMLNode(this._node, uri, localName, qName, attributes);
      if(this._node) {
        this._node.addChild(node);
      }

      this._node = node;
    },

    characters: function(value) {
      if(!this._node) {
//        aListener.log('char: ' + qName);
        return;
      }

      this._node.addText(value);
    },

    endElement: function(uri, localName, qName) {
      if(!this._node) {
//        aListener.log('end: ' + qName);
        return;
      }

      if(this._node.isXmppStanza()) {
        aListener.onXmppStanza(qName, this._node);
      }

      this._node = this._node.parent_node;
    },

    processingInstruction: function(target, data) {},

    ignorableWhitespace: function(whitespace) {},

    startPrefixMapping: function(prefix, uri) {},

    endPrefixMapping: function(prefix) {},

    QueryInterface: function(iid) {
      if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsISAXContentHandler))
        throw Cr.NS_ERROR_NO_INTERFACE;
      return this;
    }
  };

  parser.parseAsync(null);
  return parser;
}

