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
    dump("socket" + " " + aString);
  }
};

function XMPPConnection(aHost, aPort, aSecurity, aListener) {
  this._host = aHost;
  this._port = aPort;
  this._security = aSecurity;
  this._proxy = null; // TODO
  this._listener = aListener;

  this._socket = null;

  this._state = CONNECTION_STATE.disconnected;
  this._parser = null;
}

XMPPConnection.prototype = {
  connect: function() {
    this.setState(CONNECTION_STATE.socket_connecting);

    this._socket = new XMPPSocket(this);
    this._parser = createParser(this);
    this._parseReq = {
      cancel: function(status) {},
      isPending: function() {},
      resume: function() {},
      suspend: function() {}
    };
    this._parser.onStartRequest(this._parseReq, null);

    this._socket.connect(this._host, this._port, this._security, this._proxy);
  },

  send: function(aMsg) {
    this._socket.sendData(aMsg);
  },

  close: function() {
   this._socket.disconnect();
   this.setState(CONNECTION_STATE.disconnected);
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
  },

  // nsIStreamListener methods
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    /* No need to handle proxy stuff since it's handled by socket.jsm? */
    this.log("DataAvailable");
    this._parser.onDataAvailable(this._parseReq, null, aInputStream, aOffset, aCount);
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

  onXmppStanza: function(node) {
    this.log(node.convertToString());
    this._listener.handleMessage(node.convertToString());
  },

  onStartStream: function() {
    /* Set state?? */
  },

  onEndStream: function() {
    /* Set state?? */
  },

  log: function(aString) {
    dump(aString);
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
      aListener.log('start: ' + qName);

      var node = new XMLNode(this._node, uri, localName, qName, attributes);
      if(this._node) {
        this._node.addChild(node);
      }

      this._node = node;
    },

    characters: function(value) {
      if(!this._node) {
        aListener.log('char: ' + qName);
        return;
      }

      this._node.addText(value);
    },

    endElement: function(uri, localName, qName) {
      if(!this._node) {
        aListener.log('end: ' + qName);
        return;
      }

      if(this._node.isXmppStanza()) {
        aListener.onXmppStanza(this._node);
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

