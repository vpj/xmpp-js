const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");

const CONNECTION_STATE = {
  disconnected: "disconected",
  connected: "connected"
};

/* XMPPSession will create the  XMPP connection to create sessions (authentication, etc) */
/* This will create the connection, handle proxy, parse xml */
function XMPPConnection(aHost, aPort, aSecurity, aListener) {
  this._host = aHost;
  this._port = aPort;
  this._security = aSecurity;
  this._proxy = aProxy;
  this._listener = aListener;

  this._socket = null;

  this._state = CONNECTION_STATE.disconnected;
}

XMPPConnection.prototype = {
  connect: function() {
    this.setState(STATE.socket_connecting);

    this._socket = new XMPPSocket(this);
    this._socket.connect(this._host, this._port, this._security, this._proxy);
  },

  send: function(aMsg) {
    this._socket.sendData(aMsg);
  },

  close: function() {
   this._socket.disconnect();
   this.setState(CONNECTION_STATE.disconnected);
  },

  /* Callbacks */
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
  /*
   * nsIStreamListener methods
   */
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    /* No need to handle proxy stuff since it's handled by socket.jsm */
    this._parser.onDataAvailable(this._parseReq, null, aInputStream, aOffset, aCount);
  },

  onConnectionReset: function() {
    this.setState(CONNECTION_STATE.disconnected);
  },

  onXmppStanza: function(node) {
    this.log(node.toString());
  },

  onStartStream: function() {
    /* Set state?? */
  },

  onEndStream: function() {
    /* Set state?? */
  },

/*
  log: function(aString) { },
  onConnectionTimedOut: function() { },
  onConnectionReset: function() { },
  onCertProblem: function(socketInfo, status, targetSite) { },
  onBinaryDataReceived: function(aData) { }, // ArrayBuffer
*/

  // nsITransportEventSink
  onTransportStatus: function(aTransport, aStatus, aProgress, aProgressmax) {
   /* statues == COnNECTED_TO
   is this when we should fire on connection? */
  }
};

function createParser(aListener) {
  var parser = Cc['@mozilla.org/saxparser/xmrreader;1']
               .createInstance(Ci.nsISAXXMLParser);

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
        /* Create an empty node??? wouldn't it keep the whole stream cached? */
      }

      var node = XMLNode(this._node, uri, localName, qName, attributes);
      if(this._node) {
        this._node.addChild(node);
      }

      this._node = node;
    },

    characters: function(value) {
     /* Check */
     this._node.addText(value);
    }

    endElement: function(uri, localName, qName) {
      if(!this._node) {
        // dump
      }

      if(this._node.isXmppStanza()) {
        aListener.onXmppStanza(node);
      }

      this._node = this._node.parent;
    }

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

