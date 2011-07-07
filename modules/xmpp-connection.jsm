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
  connected: "connected",
  stream_started: "stream-started",
  stream_ended: "stream-ended"
};

/* XMPPSession will create the  XMPP connection to create sessions (authentication, etc) */
/* This will create the connection, handle proxy, parse xml */

function XMPPSocket(aListener) {
  this.onDataAvailable = aListener.onDataAvailable.bind(aListener);
  this.onConnection = aListener.onConnection.bind(aListener);
  this.onCertProblem = aListener.onCertProblem.bind(aListener);
  this.onConnectionReset = aListener.onConnectionReset.bind(aListener);
  this.onConnectionTimedOut = aListener.onConnectionTimedOut.bind(aListener);
  this.onTransportStatus = aListener.onTransportStatus.bind(aListener);
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
  if (this._security.indexOf("starttls") != -1) {
    this._isStartTLS = true;
  }

  this._proxy = null; // TODO
  this._listener = aListener;

  this._socket = null;

  this._state = CONNECTION_STATE.disconnected;
  this._parser = null;
}

XMPPConnection.prototype = {
  /* Whether the connection supports starttls */
  get isStartTLS() this._isStartTLS,

  /* Connect to the server */
  connect: function() {
    this.setState(CONNECTION_STATE.socket_connecting);

    this._socket = new XMPPSocket(this);
    this.reset();
    this._socket.connect(this._host, this._port, this._security, this._proxy);
  },

  /* Send a message */
  send: function(aMsg) {
    this._socket.sendData(aMsg);
  },

  /* Close connection */
  close: function() {
   this._socket.disconnect();
   this.setState(CONNECTION_STATE.disconnected);
  },

  /* Reset connection */
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

  /* Start TLS */
  startTLS: function() {
    this._socket.startTLS();
  },

  /* XMPPSocket events */
  /* When connection is established */
  onConnection: function() {
    this.setState(CONNECTION_STATE.connected);
    this._listener.onConnection();
  },

  /* When there is a problem with certificates */
  onCertProblem: function(aSocketInfo, aStatus, aTargetSite) {
    /* Open the add excetion dialog and reconnect
      Should this be part of the socket.jsm since
      all plugins using socket.jsm will need it? */
    this._addCertificate();
  },

  /* When incoming data is available to be read */
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    /* No need to handle proxy stuff since it's handled by socket.jsm? */
    try {
      this._parser.onDataAvailable(this._parseReq, null, aInputStream, aOffset, aCount);
    } catch(e) {
      Cu.reportError(e);
      this._listener.onError("parser-exception", e);
    }
  },

  onConnectionReset: function() {
    this.setState(CONNECTION_STATE.disconnected);
    this._listener.onDisconnected("connection-reset");
  },

  onConnectionTimedOut: function() {
    this.setState(CONNECTION_STATE.disconnected);
    this._listener.onDisconnected("connection-timeout");
  },

  onTransportStatus: function(aTransport, aStatus, aProgress, aProgressmax) {
   /* statues == COnNECTED_TO
   is this when we should fire on connection? */
  },

  /* Private methods */
  setState: function(aState) {
    this._state = aState;
  },

  _addCertificate: function() {
    let prmt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Ci.nsIPromptService);
    let add = prmt.confirm(
        null,
        "Bad certificate",
        "Server \"" + this._host + ":" + this._port + "\"");

    if (!add)
     return;

    let args = {
      exceptionAdded: false,
      location: "https://" + this._host + ":" + this._port,
      prefetchCert: true
    };
    let options = "chrome=yes,modal=yes,centerscreen=yes";

    // FIXME: This dialog is giving errors :S
    let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
          .getService(Ci.nsIWindowWatcher)
    let self = this;
    async(function() {
      ww.openWindow(null,
            "chrome://pippki/content/exceptionDialog.xul",
            "",
            "chrome,modal,centerscreen",
            args);
      self.debug("Window closed");
    });
  },

  /* Callbacks from parser */
  /* A stanza received */
  onXmppStanza: function(aName, aStanza) {
    this.debug(aStanza.convertToString());
    this._listener.onXmppStanza(aName, aStanza);
  },

  /* Stream started */
  onStartStream: function() {
    this.setState(CONNECTION_STATE.stream_started);
  },

  /* Stream ended */
  onEndStream: function() {
    this.setState(CONNECTION_STATE.stream_ended);
  },

  onError: function(aError, aException) {
    if(aError != "parsing-characters")
      Cu.reportError(aError + ": " + aException);
    if (aError != "parse-warning" && aError != "parsing-characters") {
      this._listener.onError(aError, aException);
    }
  },

  log: function(aString) {
    debug("connection: " + aString);
  },

  debug: function(aString) {
    debug("connection: " + aString);
  },
};

function readInputStreamToString(aStream, aCount) {
  let sstream = Cc["@mozilla.org/scriptableinputstream;1"]
    .createInstance(Ci.nsIScriptableInputStream);
  sstream.init(aStream);
  return sstream.read(aCount);
}

function createParser(aListener) {
  let parser = Cc["@mozilla.org/saxparser/xmlreader;1"]
              .createInstance(Ci.nsISAXXMLReader);

  parser.errorHandler = {
    error: function(aLocator, aError) {
      aListener.onError("parse-error", aError);
    },

    fatelError: function(aLocator, aError) {
      aListener.onError("parse-fatel-error", aError);
    },

    ignorableWarning: function(aLocator, aError) {
      aListener.onError("parse-warning", aError);
    },

    QueryInterface: function(aInterfaceId) {
      if (!aInterfaceId.equals(Ci.nsiSupports) && !aInterfaceId.equals(Ci.nsiISAXErrorHandler))
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

    startElement: function(aUri, aLocalName, aQName, aAttributes) {
      if (aQName == "stream:stream") {
//        Cu.reportError("stream:stream ignoring");
        return;
      }

      let node = new XMLNode(this._node, aUri, aLocalName, aQName, aAttributes);
      if (this._node) {
        this._node.addChild(node);
      }

      this._node = node;
    },

    characters: function(aCharacters) {
      if (!this._node) {
        aListener.onError("parsing-characters", "No parent for characters: " + aCharacters);
        return;
      }

      this._node.addText(aCharacters);
    },

    endElement: function(aUri, aLocalName, aQName) {
      if (aQName == "stream:stream") {
        return;
      }

      if (!this._node) {
        aListener.onError("parsing-node", "No parent for node : " + aLocalName);
        return;
      }

      if (this._node.isXmppStanza()) {
        aListener.onXmppStanza(aQName, this._node);
      }

      this._node = this._node.parent_node;
    },

    processingInstruction: function(aTarget, aData) {},

    ignorableWhitespace: function(aWhitespace) {},

    startPrefixMapping: function(aPrefix, aUri) {},

    endPrefixMapping: function(aPrefix) {},

    QueryInterface: function(aInterfaceId) {
      if (!aInterfaceId.equals(Ci.nsISupports) && !aInterfaceId.equals(Ci.nsISAXContentHandler))
        throw Cr.NS_ERROR_NO_INTERFACE;
      return this;
    }
  };

  parser.parseAsync(null);
  return parser;
}

