var EXPORTED_SYMBOLS = ["XMPPSession"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-connection.jsm");

const STATE = {
  disconnected: "disconected",
  initializing_stream: "initializing_stream",
  auth_waiting_results: "auth_waiting_results",
  auth_success: "auth_success",
  auth_bind: "auth_bind",
  start_session: "start_session",
  session_started: "session_started",
  connected: "connected"
};

// This will handle the authentication and start the connection

const STREAM_HEADER = "<?xml version=\"1.0\"?><stream:stream to=\"#host#\" xmlns=\"jabber:client\" xmlns:stream=\"http://etherx.jabber.org/streams\"  version=\"1.0\">";

function XMPPSession(aHost, aPort, aSecurity, aJID, aDomain, aPassword, aListener) {
  this._host = aHost;
  this._port = aPort;
  this._security = aSecurity;
  this._proxy = null; //TODO
  this._connection = new XMPPConnection(aHost, aPort, aSecurity, this);
  this._jid = aJID;
  this._domain = aDomain;
  this._password = aPassword;
  this._listener = aListener;

  this._state = STATE.disconnected;
}

XMPPSession.prototype = {
  connect: function() {
    this.setState(STATE.connecting);
    this._connection.connect();
  },

  send: function(aMsg) {
    this._connection.send(aMsg);
  },

  onConnection: function() {
    // Start the stream
    this.setState(STATE.initializing_stream);
    this.startStream();
  },

  startStream: function() {
    this.send(STREAM_HEADER.replace('#host#', this._domain));
  },

  log: function(aString) {
    dump(aString);
  },

  setState: function(state) {
    this._state = state;
    this.log("state = " + state);
  },

  onXmppStanza: function(name, stanza) {
    this.log("onStanza");
    switch(this._state) {
      case STATE.initializing_stream:
        //TODO: Check stanza features
        // Hard coded for PLAIN
        this.setState(STATE.auth_waiting_results);
        this.send("<auth xmlns=\"urn:ietf:params:xml:ns:xmpp-sasl\" mechanism=\"PLAIN\">"
            + Base64.encode("\0" + this._jid + "\0" + this._password)
            + "</auth>");
        break;

      case STATE.auth_waiting_results:
        //TODO: check failure
        this.setState(STATE.auth_success);
        this._connection.reset();
        this.startStream();
        break;

      case STATE.auth_success:
        this.setState(STATE.auth_bind);
        this.send('<iq id="c1h4r9rx" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>testinstantbird</resource></bind></iq>');
        break;

      case STATE.auth_bind:
        this.setState(STATE.start_session);
        this.send('<iq id="vyq6z751" type="set"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>');
        break;

      case STATE.start_session:
        this.setState(STATE.session_started);
        this._listener.onConnection();
        break;

      // TODO: Efficient the method was assigned
      case STATE.session_started:
        this._listener.onXmppStanza(name, stanza);
        break;
    }
  }
};

