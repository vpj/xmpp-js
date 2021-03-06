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
 * The Original Code is Instantbird.
 *
 * The Initial Developer of the Original Code is
 * Varuna JAYASIRI <vpjayasiri@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var EXPORTED_SYMBOLS = ["XMPPConversationPrototype",
                        "XMPPAccountBuddyPrototype",
                        "XMPPAccountPrototype"];

const {interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://xmpp-js/jsProtoHelper.jsm");
Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-session.jsm");

/* Helper class for buddy conversations */
const XMPPConversationPrototype = {
  __proto__: GenericConvIMPrototype,

  _opened: false,
  _typingTimer: null,
  _supportChatStateNotifications: true,
  _typingState: "active",

  _init: function(aAccount, aBuddy) {
    this.buddy = aBuddy;
    this.account = aAccount;
    this._name = aBuddy.contactDisplayName;
    this._observers = [];
    Services.conversations.addConversation(this);
  },

  set supportChatStateNotifications(val) {
    this._supportChatStateNotifications = val; },

  /* Called when the user is typing a message
   * aLength - length of the typed message */
  sendTyping: function(aLength) {
    if(!this._supportChatStateNotifications)
      return;

    if(this._typingTimer) {
      clearTimeout(this._typingTimer);
    }

    let self = this;

    this._typingTimer = setTimeout(function() {
      self.finishedComposing();
      }, 10000);

    if(this._typingState != "composing") {
      /* to, msg, state, attrib, data */
      let s = Stanza.message(this.buddy.userName, null, "composing");

      this.account.sendStanza(s);
      this._typingState = "composing";
    }
  },

  /* Send a finished composing message */
  finishedComposing: function() {
    if(!this._supportChatStateNotifications)
      return;

    if(this._typingState != "paused") {
      let s = Stanza.message(this.buddy.userName, null, "paused");

      this.account.sendStanza(s);
      this._typingState = "paused";
    }
  },

  /* Called when the user enters a chat message */
  sendMsg: function (aMsg) {
    if(this._typingTimer) {
      clearTimeout(this._typingTimer);
    }

    let cs = null;

    if(this._supportChatStateNotifications) {
      cs = "active";
    }

    let s = Stanza.message(this.buddy.userName, aMsg, cs);

    this.account.sendStanza(s);
    this.writeMessage("You", aMsg, {outgoing: true});
    this._typingState = "active";
  },

  /* Called by the account when a messsage is received from the buddy */
  incomingMessage: function(aMsg) {
    this.writeMessage(this.buddy.contactDisplayName, aMsg, {incoming: true});
  },

  /* Called when the user closed the conversation */
  close: function() {
    GenericConvIMPrototype.close.call(this);
    this.account.removeConversation(this.buddy.normalizedName);
  }
};

/* Helper class for buddies */
const XMPPAccountBuddyPrototype = {
  __proto__: GenericAccountBuddyPrototype,

  /* Returns a list of TooltipInfo objects to be displayed when the user hovers over the buddy */
  getTooltipInfo: function() {
    return null;
    //return new nsSimpleEnumerator([new TooltipInfo("pair", "name", "vpj")]);
  },

  /* Display name of the buddy */
  get contactDisplayName() this.buddy.contact.displayName || this.displayName,

  /* Called when the user wants to chat with the buddy */
  createConversation: function() {
    return this._account.createConversation(this.normalizedName);
  }
};

/* Helper class for account */
const XMPPAccountPrototype = {
  __proto__: GenericAccountPrototype,

  _jid: null, // Jabber ID
  _password: null, // password
  _server: null, // server domain
  _port: null, // port
  _connection: null, // XMPP Connection
  _security: null, // Conneciton security

  _connected: false, // Whether the session is connected
  _disconnectedBecuaseStatus: false,

  _statusShow: "chat",
  _statusMsg: "",

  _init: function(aProtoInstance, aKey, aName) {
    GenericAccountPrototype._init.call(this, aProtoInstance, aKey, aName);

    /* A map of on going conversations */
    this._conv = {},

    /* Map of buddies */
    this._buddies = {},

    Services.obs.addObserver(this, "status-changed", false);
  },

  /* Events */
  observe: function(aSubject, aTopic, aMsg) {
    this._statusChanged(aSubject.currentStatusType, aSubject.currentStatusMessage);
  },

  /* This funciton should be overridden */
  getConnectionParameters: function() {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    /*return {server: "",
            port: 0,
            ssl: false,
            starttls: false};*/
  },

  /* GenericAccountPrototype events */
  /* Connect to the server */
  connect: function() {
    this.base.connecting();

    var params = this.getConnectionParameters();
    this._jid = params.jid;
    this._JID = parseJID(this._jid);
    this._password = params.password;
    this._server = params.server;
    this._port = params.port;
    this._security = params.security;

    this._connection =
        new XMPPSession(this._server, this._port, this._security,
        this._JID, this._JID.domain, this._password,
        this);

    this._connection.connect();
    this._connected = true;
  },

  /* Disconnect from the server */
  disconnect: function(aSilent) {
    this._disconnect();
    this.gotDisconnected();
  },

  /* Loads a buddy from the local storage.
   * Called for each buddy locally stored before connecting
   * to the server. */
  loadBuddy: function(aBuddy, aTag) {
    let buddy = this.constructAccountBuddy(aBuddy, aTag);
    this._buddies[buddy.normalizedName] = buddy;
    return buddy;
  },

  /* XMPPSession events */
  /* Called when the XMPP session is started */
  onConnection: function() {
    this.base.connected();

    let s = Stanza.iq("get", null, null,
        Stanza.node("query", $NS.roster, {}, []));

    /* Set the call back onRoster */
    this._connection.sendStanza(s, this.onRoster, this);
  },


  /* Called whenever a stanza is received */
  onXmppStanza: function(aName, aStanza) {
  },

  /* Called when a iq stanza is received */
  onIQStanza: function(aName, aStanza) {
  },

  /* Called when a presence stanza is received */
  onPresenceStanza: function(aStanza) {
    let from = aStanza.attributes["from"];
    from = parseJID(from).jid;
    debug(from);
    let buddy = this._buddies[normalize(from)];
    if (!buddy) {
      debug("buddy not present: " + from);
      return;
    }

    let p = Stanza.parsePresence(aStanza);
    debug(buddy._buddy.id);
    buddy.setStatus(p.show, p.status);
  },

  /* Called when a message stanza is received */
  onMessageStanza: function(aStanza) {
    let m = Stanza.parseMessage(aStanza);
    let norm = normalize(m.from.jid);
    if (!this.createConversation(norm))
      return;

    /* TODO: Chat statues */
    if(m.body)
      this._conv[norm].incomingMessage(m.body);

    if(m.state) {
      debug(m.state);
      if(m.state == "active")
       this._conv[norm].updateTyping(Ci.purpleIConvIM.NOT_TYPING);
      else if(m.state == "composing")
       this._conv[norm].updateTyping(Ci.purpleIConvIM.TYPING);
      else if(m.state == "paused")
       this._conv[norm].updateTyping(Ci.purpleIConvIM.TYPED);
    }
    else {
      this._conv[norm].supportChatStateNotifications = false;
    }
  },

  /* Called when there is an error in the xmpp session */
  onError: function(aError, aException) {
    Cu.reportError(aException);
    this._disconnect();
    this.gotDisconnected(this._base.ERROR_OTHER_ERROR, aException.toString());
  },

  /* Callbacks for Query stanzas */
  /* When a vCard is recieved */
  onVCard: function(aName, aStanza) {
    let self = this;

    setTimeout(function() {
      let vCard = null;
      try {
        vCard = Stanza.parseVCard(aStanza);
      } catch(e) {
        debug(e);
      }

      if (!vCard)
        return;

      if (self._buddies.hasOwnProperty(normalize(vCard.jid.jid))) {
        let b = self._buddies[normalize(vCard.jid.jid)];
        if (vCard.fullname)
          b.serverAlias = vCard.fullname;
        if (vCard.icon) {
//          Cu.reportError(vCard.icon);
          b.buddyIconFilename = vCard.icon;
        }
      }
    }, 0);
  },

  /* When the roster is received */
  onRoster: function(aName, aStanza) {
    let q = aStanza.getChildren("query");
    for each (let qe in q) {
      if (qe.uri == $NS.roster) {
        let items = qe.getChildren("item");
        for each (let item in items) {
          this._addBuddy("friends", item.attributes["jid"], item.attributes["name"]);
        }
      }
    }

    this.rosterReceived();
  },

  rosterReceived: function() {
    this._setInitialStatus();
  },

  _setInitialStatus: function() {
    let s = Stanza.presence({"xml:lang": "en"},
         [Stanza.node("show", null, null, this._statusShow),
          Stanza.node("status", null, null, this._statusMsg)]);
    this._connection.sendStanza(s);
  },

  /* When the sesion gets disconnection */
  gotDisconnected: function(aError, aErrorMessage) {
    if (aError === undefined)
      aError = this._base.NO_ERROR;
    this.base.disconnecting(aError, aErrorMessage);
    this.base.disconnected();
  },


  /* Public methods */
  /* Send a stanza to a buddy */
  sendStanza: function(aStanza) {
    this._connection.sendStanza(aStanza);
  },

  /* Returns a conversation object
     Should be overridden */
  constructConversation: function(buddy) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /* Returns an account buddy object
     Should be overridden */
  constructAccountBuddy: function(aBuddy, aTag, aName) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /* Create a new conversation */
  createConversation: function(aNormalizedName) {
    if (!this._buddies.hasOwnProperty(aNormalizedName)) {
      Cu.reportError("Trying to create a conversation; buddy not present: " + aNormalizedName);
      return null;
    }

    if (!this._conv.hasOwnProperty(aNormalizedName)) {
      this._conv[aNormalizedName] = this.constructConversation(this._buddies[aNormalizedName]);
    }

    return this._conv[aNormalizedName];
  },

  /* Remove an existing conversation */
  removeConversation: function(aNormalizedName) {
    delete this._conv[aNormalizedName];
  },

  /* Private methods */

  /* Disconnect from the server */
  _disconnect: function() {
    for (let b in this._buddies) {
      this._buddies[b].setStatus(Ci.imIStatusInfo.STATUS_OFFLINE, "");
    }

    this._connection.disconnect();
    this._connected = false;
    this._disconnectedBecuaseStatus = false;
  },


  /* Create a tag - helper function */
  _createTag: function(aTagName) {
    return Services.tags.createTag(aTagName);
  },

  /* Retrieves a buddy - helper function */
  _getBuddy: function(normalizedName) {
    return Services.contacts
               .getBuddyByNameAndProtocol(normalizedName, this.protocol);
  },

  /* Add a new buddy to the local storage */
  _addBuddy: function(aTagName, aName, aAlias) {
    let s = Stanza.iq("get", null, aName,
        Stanza.node("vCard", "vcard-temp", {}, []));
    this._connection.sendStanza(s, this.onVCard, this);

    if (this._buddies.hasOwnProperty(normalize(aName)))
      return;

    let self = this;

    setTimeout(function() {
      let tag = self._createTag(aTagName);
      let buddy = self.constructAccountBuddy(null, tag, aName);

      Services.contacts.accountBuddyAdded(buddy);

      if (aAlias)
        buddy.serverAlias = aAlias;
      self._buddies[normalize(aName)] = buddy;
    }, 0);
  },

  statusOnline: function(aOnline) {
    if(aOnline && !this._connected && this._disconnectedBecuaseStatus) {
      this.connect();
      return false;
    }

    if(!aOnline && this.connected) {
      this.disconnect();
      this._disconnectedBecuaseStatus = true;
      return false;
    }

    return true;
  },

  /* Set the user statue on the server */
  _statusChanged: function(aStatusType, aMsg) {
    let show = "";
    let setPresence = true;

    aMsg = aMsg || "";
    if (aStatusType == Ci.imIStatusInfo.STATUS_AVAILABLE) {
      show = "chat";
      setPresence = this.statusOnline(true);
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_UNAVAILABLE) {
      show = "dnd";
      setPresence = this.statusOnline(true);
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_AWAY) {
      show = "away";
      setPresence = this.statusOnline(true);
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_OFFLINE) {
      setPresence = this.statusOnline(false);
    }
    if(setPresence) {
      let s = Stanza.presence({"xml:lang": "en"},
           [Stanza.node("show", null, null, show),
            Stanza.node("status", null, null, aMsg)]);
      this._connection.sendStanza(s);
    }

    this._statusShow = show;
    this._statusMsg = aMsg;
  },
};

