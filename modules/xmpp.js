const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");

function XMPPConnection(aHost, aPort, aSecurity) {
  this._host = aHost;
  this._port = aPort;
  this._security = aSecurity;
  this._proxy = aProxy;

  this._socket = null;

  this._state = STATE.disconnected;
}

XMPPConnection.prototype = {
  connect: function() {
    this._state = STATE.socket_connecting;

    this._socket = new XMPPSocket(this);
    this._socket.connect(this._host, this._port, this._security, this._proxy);
  },

  send: function(aMsg) {
    this._socket.sendData(aMsg);
  },

  /* Callbacks */
  onConnection: function(aJID, password) {
    this._jid = aJID;
    this._password = password;
    this.setState(STATE.socket_connected);

    this.send(STREAM_HEADER.replace('#host#', this._jid.domain);
  },

  onDataReceived: function(aData) {
    
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

