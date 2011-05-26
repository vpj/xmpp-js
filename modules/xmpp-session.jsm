var EXPORTED_SYMBOLS = ["XMPPSession"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-connection.jsm");
Cu.import("resource://xmpp-js/xmpp-authmechs.jsm");

const STATE = {
  disconnected: "disconected",
  initializing_stream: "initializing_stream",
  requested_tls: "requested_tls",
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
  this._auth = null;
  this._authMechs = {PLAIN: PlainAuth};
  this._resource = 'rabbithole';

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
        //TODO: Check stanzastarttls
        var starttls = this._isStartTLS(stanza);
        if(this._connection.isStartTLS) {
          if(starttls == 'required' || starttls == 'optional') {
            var n =  Stanza.node('starttls', $NS.tls, {}, []);
            this.send(n.getXML());
            this.setState(STATE.requested_tls);
            break;
          }
        }
        if(starttls == 'required' && !this._connection.isStartTLS) {
          // TODO error
        }

        var mechs = this._getMechanisms(stanza);
        dump(mechs);
        for(var i = 0; i < mechs.length; ++i) {
          if(this._authMechs[mechs[i]]) {
            // TODO: Parameters
            this._auth = new this._authMechs[mechs[i]](this._jid, this._password);
            break;
          }
        }

        if(!this._auth) {
        //TODO: fail
        }

      case STATE.auth_starting:
        var res = this._auth.next(stanza);
        if(res.send)
          this.send(res.send);
        if(res.wait_results == true)
          this.setState(STATE.auth_waiting_results);
        break;

      case STATE.requested_tls:
        this._connection.reset();
        this._connection.startTLS();
        this.setState(STATE.initializing_stream);
        this.startStream();
        break;

      case STATE.auth_waiting_results:
        //TODO: check failure
        this.setState(STATE.auth_success);
        this._connection.reset();
        this.startStream();
        break;

      case STATE.auth_success:
        this.setState(STATE.auth_bind);
        var s = Stanza.iq('set', null, null,
            Stanza.node('bind', $NS.bind, {},
              Stanza.node('resource', null, {}, this._resource)));
        this.send(s.getXML());
        break;

      case STATE.auth_bind:
        this.setState(STATE.start_session);
        var s = Stanza.iq('set', 'adfds', null,
            Stanza.node('session', $NS.session, {}, []));
        this.send(s.getXML());
        break;

      case STATE.start_session:
        this.setState(STATE.session_started);
        this._listener.onConnection();
        break;

      // TODO: Efficient if the method was assigned
      case STATE.session_started:
        this._listener.onXmppStanza(name, stanza);
        break;
    }
  },

  _getMechanisms: function(stanza) {
    if(stanza.localName != 'features')
      return [];
    var mechs = stanza.getChildren('mechanisms');
    var res = [];
    for(var i = 0; i < mechs.length; ++i) {
      var mech = mechs[i].getChildren('mechanism');
      for(var j = 0; j < mech.length; ++j) {
        res.push(mech[j].innerXML());
      }
    }
    return res;
  },

  _isStartTLS: function(stanza) {
    if(stanza.localName != 'features')
      return '';
    var required = false;
    var optional = false;
    var starttls = stanza.getChildren('starttls');
    for(var i = 0; i < starttls.length; ++i) {
      for(var j = 0; j < starttls[i].children.length; ++j) {
        if(starttls[i].children[j].localName == 'required')
          required = true;
        else if(starttls[i].children[j].localName == 'optional')
          optional = true;
      }
    }

    if(optional)
      return 'optional';
    else if(required)
      return 'required';
    else
      return 'no';
  }
};

