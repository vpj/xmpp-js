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

var EXPORTED_SYMBOLS = ["XMPPSession"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-connection.jsm");
Cu.import("resource://xmpp-js/xmpp-authmechs.jsm");
Cu.import("resource://xmpp-js/events.jsm");

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
  this._authMechs = {'PLAIN': PlainAuth, 'DIGEST-MD5': DigestMD5Auth};
  this._resource = 'instantbird';
  this._events = new StanzaEventManager();
  this._state = STATE.disconnected;
  this._stanzaId = 0;
}

XMPPSession.prototype = {
  connect: function() {
    this.setState(STATE.connecting);
    this._connection.connect();
  },

  disconnect: function() {
    if(this._state == STATE.session_started) {
      this.send('</stream:stream>');
    }
    this._connection.close();
    this.setState(STATE.disconnected);
  },

  send: function(aMsg) {
    this._connection.send(aMsg);
  },

  sendStanza: function(stanza, callback, obj) {
    stanza.attributes['id'] = this.id();
    if(callback)
      this._events.add(stanza.attributes.id, callback, obj);
    this.send(stanza.getXML());
    return stanza.attributes.id;
  },

  id: function() {
    this._stanzaId++;
    return this._stanzaId;
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
    debug("session: " + aString);
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
            this.sendStanza(n);
            this.setState(STATE.requested_tls);
            break;
          }
        }
        if(starttls == 'required' && !this._connection.isStartTLS) {
          // TODO error
        }

        var mechs = this._getMechanisms(stanza);
        this.log(mechs);
        for(var i = 0; i < mechs.length; ++i) {
          if(this._authMechs[mechs[i]]) {
            // TODO: Parameters
            // TODO: parse the jabber id and get the username
            this._auth = new this._authMechs[mechs[i]](
                this._jid, this._password, this._domain, 'jayasiri');
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
        this.sendStanza(s);
        break;

      case STATE.auth_bind:
        var jid = stanza.getElement(['iq', 'bind', 'jid']);
        this.log("jid = " + jid.innerXML());
        debugJSON(['asdf', 10, 12, 'asdfas']);
        this._fullJID = jid.innerXML();
        this._JID = parseJID(this._fullJID);
        this._resource = this._JID.resource;
        this.setState(STATE.start_session);
        var s = Stanza.iq('set', null, null,
            Stanza.node('session', $NS.session, {}, []));
        this.sendStanza(s);
        break;

      case STATE.start_session:
        this.setState(STATE.session_started);
        this._listener.onConnection();
        break;

      // TODO: Efficient if the method was assigned
      case STATE.session_started:
        if(name == 'presence')
          this._listener.onPresenceStanza(stanza);
        else if(name == 'message')
          this._listener.onMessageStanza(stanza);
        else
          this._listener.onXmppStanza(name, stanza);

        if(stanza.attributes.id)
          this._events.exec(stanza.attributes.id, name, stanza);

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

