/* This will handle the authentication and start the connection */
function XMPPSession(aHost, aPort, aSecurity, jJID, aPassword) {
  this._host = aHost;
  this._port = aPort;
  this._security = aSecurity;
  this._proxy = aProxy;

  this._connection = XMPPConnection(aHost, aPort, aSecurity);

  this._state = STATE.disconnected;
}

XMPPSession.prototype = {
  send: function(aMsg) {
    this._connection.send(aMsg);
  },

  onConnection: function() {
    /* Start the stream */
    this.send(STREAM_HEADER.replace('#host#', this._jid.domain);
  },

  onXmppStanza: function(name, stanza) {
    /* Test if the parser is working */
  }
};

