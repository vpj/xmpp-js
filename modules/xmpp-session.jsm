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
  this._authMechs = {"PLAIN": PlainAuth, "DIGEST-MD5": DigestMD5Auth};
  this._resource = "instantbird";
  this._events = new StanzaEventManager();
  this._state = STATE.disconnected;
  this._stanzaId = 0;
}

XMPPSession.prototype = {
  /* Connect to the server */
  connect: function() {
    this.setState(STATE.connecting);
    this._connection.connect();
  },

  /* Disconnect from the server */
  disconnect: function() {
    if (this._state == STATE.session_started) {
      this.send("</stream:stream>");
    }
    this._connection.close();
    this.setState(STATE.disconnected);
  },

  /* Send a text message to the server */
  send: function(aMsg) {
    this._connection.send(aMsg);
  },

  /* Send a stanza to the server.
   * Can set a callback if required, which will be called
   * when the server responds to the stanza with
   * a stanza of the same id. */
  sendStanza: function(aStanza, aCallback, aObject) {
    aStanza.attributes["id"] = this.id();
    if (aCallback)
      this._events.add(aStanza.attributes.id, aCallback, aObject);
    this.send(aStanza.getXML());
    return aStanza.attributes.id;
  },

  /* Gives an unique id */
  id: function() {
    this._stanzaId++;
    return this._stanzaId;
  },

  /* Start the XMPP stream */
  startStream: function() {
    this.send(STREAM_HEADER.replace("#host#", this._domain));
  },

  /* Log a message */
  log: function(aString) {
    debug("session: " + aString);
  },

  debug: function(aString) {
    debug("session: " + aString);
  },

  /* Set the session state */
  setState: function(aState) {
    this._state = aState;
    this.debug("state = " + aState);
  },


  /* XMPPConnection events */
  /* The connection is established */
  onConnection: function() {
    this.setState(STATE.initializing_stream);
    this.startStream();
  },

  /* The conenction got disconnected */
  onDisconnected: function(aError, aException) {
    this._listener.onError("disconnected-" + aError, "Disconnected: " + aException);
  },

  /* On error in the connection */
  onError: function(aError, aException) {
    this._listener.onError("connection-" + aError, aException);
  },

  /* When a Stanza is received */
  onXmppStanza: function(aName, aStanza) {
    if (aName == "failure") {
      this._listener.onError("failure", "Not authorised");
      return;
    }

    switch(this._state) {
      case STATE.initializing_stream:
        let starttls = this._isStartTLS(aStanza);
        if (this._connection.isStartTLS) {
          if (starttls == "required" || starttls == "optional") {
            let n =  Stanza.node("starttls", $NS.tls, {}, []);
            this.sendStanza(n);
            this.setState(STATE.requested_tls);
            break;
          }
        }
        if (starttls == "required" && !this._connection.isStartTLS) {
          this._listener.onError("starttls", "StartTLS required but the connection does not support");
          return;
        }

        let mechs = this._getMechanisms(aStanza);
        this.debug(mechs);
        for (let i = 0; i < mechs.length; ++i) {
          if (this._authMechs.hasOwnProperty(mechs[i])) {
            this._auth = new this._authMechs[mechs[i]](
                this._jid.node, this._password, this._domain);
            break;
          }
        }

        if (!this._auth) {
          this._listener.onError("no-auth-mech", "None of the authentication mechanisms are supported");
          this.log(mechs);
          return;
        }

      case STATE.auth_starting:
        let res;
        try {
          res = this._auth.next(aStanza);
        } catch(e) {
          this._listener.onError("auth-mech", "Authentication failure: " + e);
          return;
        }

        if (res.send)
          this.send(res.send);
        if (res.wait_results == true)
          this.setState(STATE.auth_waiting_results);
        break;

      case STATE.requested_tls:
        this._connection.reset();
        this._connection.startTLS();
        this.setState(STATE.initializing_stream);
        this.startStream();
        break;

      case STATE.auth_waiting_results:
        this.setState(STATE.auth_success);
        this._connection.reset();
        this.startStream();
        break;

      case STATE.auth_success:
        this.setState(STATE.auth_bind);
        var s = Stanza.iq("set", null, null,
            Stanza.node("bind", $NS.bind, {},
              Stanza.node("resource", null, {}, this._resource)));
        this.sendStanza(s);
        break;

      case STATE.auth_bind:
        let jid = aStanza.getElement(["iq", "bind", "jid"]);
        this.debug("jid = " + jid.innerXML());
        this._fullJID = jid.innerXML();
        this._JID = parseJID(this._fullJID);
        this._resource = this._JID.resource;
        this.setState(STATE.start_session);
        var s = Stanza.iq("set", null, null,
            Stanza.node("session", $NS.session, {}, []));
        this.sendStanza(s);
        break;

      case STATE.start_session:
        this.setState(STATE.session_started);
        this._listener.onConnection();
        break;

      case STATE.session_started:
        if (aName == "presence")
          this._listener.onPresenceStanza(aStanza);
        else if (aName == "message")
          this._listener.onMessageStanza(aStanza);
        else
          this._listener.onXmppStanza(aName, aStanza);

        if (aStanza.attributes.id)
          this._events.exec(aStanza.attributes.id, aName, aStanza);

        break;
    }
  },

  /* Private methods */
  /* Get supported authentication mechanisms */
  _getMechanisms: function(aStanza) {
    if (aStanza.localName != "features")
      return [];
    let mechs = aStanza.getChildren("mechanisms");
    let res = [];
    for (let i = 0; i < mechs.length; ++i) {
      let mech = mechs[i].getChildren("mechanism");
      for (let j = 0; j < mech.length; ++j) {
        res.push(mech[j].innerXML());
      }
    }
    return res;
  },

  /* Check is starttls is required or optional */
  _isStartTLS: function(aStanza) {
    if (aStanza.localName != "features")
      return "";
    let required = false;
    let optional = false;
    let starttls = aStanza.getChildren("starttls");
    for (let i = 0; i < starttls.length; ++i) {
      for (let j = 0; j < starttls[i].children.length; ++j) {
        if (starttls[i].children[j].localName == "required")
          required = true;
        else if (starttls[i].children[j].localName == "optional")
          optional = true;
      }
    }

    if (optional)
      return "optional";
    else if (required)
      return "required";
    else
      return "no";
  }
};

