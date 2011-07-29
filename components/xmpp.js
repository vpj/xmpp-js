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

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://xmpp-js/jsProtoHelper.jsm");
Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-session.jsm");

function Conversation(aAccount, aBuddy)
{
  this.buddy = aBuddy;
  this.account = aAccount;
  this._name = aBuddy.contactDisplayName;
  this._observers = [];
  this._opened = false;
  Services.conversations.addConversation(this);
}

Conversation.prototype = {
  __proto__: GenericConvIMPrototype,

  /* Called when the user enters a chat message */
  sendMsg: function (aMsg) {
    this.account.sendMessage(this.buddy.userName, aMsg);
    this.writeMessage("You", aMsg, {outgoing: true});
  },

  /* Called by the account when a messsage is received from the buddy */
  incomingMessage: function(aMsg) {
    this.writeMessage(this.buddy.contactDisplayName, aMsg, {incoming: true});
  },

  /* Called when the user closed the conversation */
  close: function() {
    Services.obs.notifyObservers(this, "closing-conversation", null);
    Services.conversations.removeConversation(this);
    this.account.removeConversation(this.buddy.normalizedName);
  },
};

function TooltipInfo(aType, aLabel, aValue) {
  this._init(aType, aLabel, aValue);
}

TooltipInfo.prototype = GenericTooltipInfo;

function AccountBuddy(aAccount, aBuddy, aTag, aUserName) {
  this._init(aAccount, aBuddy, aTag, aUserName);
}

AccountBuddy.prototype = {
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

function Account(aProtoInstance, aKey, aName)
{
  this._init(aProtoInstance, aKey, aName);

  /* A map of on going conversations */
  this._conv = {},

  /* Map of buddies */
  this._buddies = {},

  Services.obs.addObserver(this, "status-changed", false);
}

Account.prototype = {
  __proto__: GenericAccountPrototype,

  _jid: null,
  _password: null,
  _server: null,
  _port: null,
  _connection: null, /* XMPP Connection */
  _security: null,

  /* Events */
  observe: function(aSubject, aTopic, aMsg) {
    this._statusChanged(aSubject.currentStatusType, aSubject.currentStatusMessage);
  },

  /* GenericAccountPrototype events */
  /* Connect to the server */
  connect: function() {
    this.base.connecting();

    this._jid = this.name;
    this._JID = parseJID(this._jid);
    this._password = this.password;
    this._server = this.getString("server");
    this._port = this.getInt("port");
    this._security = [];
    if (this.getBool("ssl")) {
      this._security.push("ssl");
    }
    if (this.getBool("starttls")) {
      this._security.push("starttls");
    }

    this._connection =
        new XMPPSession(this._server, this._port, this._security,
        this._JID, this._JID.domain, this._password,
        this);

    this._connection.connect();
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
    let buddy = new AccountBuddy(this, aBuddy, aTag);
    this._buddies[buddy.normalizedName] = buddy;
    debug("loadBuddy " + buddy.normalizedName);
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

    this._conv[norm].incomingMessage(m.body);
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
    let vCard = null;
    try {
      vCard = Stanza.parseVCard(aStanza);
    } catch(e) {
      debug(e);
    }

    if (!vCard)
      return;

    //FIXME: Bug buddies dissappear when their name is set while their are online
    if (this._buddies.hasOwnProperty(normalize(vCard.jid.jid))) {
      let b = this._buddies[normalize(vCard.jid.jid)];
      if (vCard.fullname)
        b.serverAlias = vCard.fullname;
      if (vCard.icon) {
        b.buddyIconFilename = vCard.icon;
      }
    }
  },

  /* When the roster is received */
  onRoster: function(aName, aStanza) {
    let q = aStanza.getChildren("query");
    for (let i = 0; i < q.length; ++i) {
      if (q[i].uri == $NS.roster) {
        let items = q[i].getChildren("item");
        for (let j = 0; j < items.length; ++j) {
          this._addBuddy("friends", items[j].attributes["jid"], items[j].attributes["name"]);
        }
      }
    }

    this._rosterReceived();
  },

  _rosterReceived: function() {
    this._setInitialStatus();
  },

  _setInitialStatus: function() {
    let s = Stanza.presence({"xml:lang": "en"},
         [Stanza.node("show", null, null, "chat"),
          Stanza.node("status", null, null, "")]);
    this._connection.sendStanza(s);
  },

  gotDisconnected: function(aError, aErrorMessage) {
    if (aError === undefined)
      aError = this._base.NO_ERROR;
    this.base.disconnecting(aError, aErrorMessage);
    this.base.disconnected();
  },


  /* Public methods */
  /* Send a message to a buddy */
  sendMessage: function(aTo, aMsg) {
    let s = Stanza.message(aTo, null,
        Stanza.node("body", null, {}, aMsg));

    this._connection.sendStanza(s);
  },

  /* Create a new conversation */
  createConversation: function(aNormalizedName) {
    if (!this._buddies.hasOwnProperty(aNormalizedName)) {
      debug("No buddy: " + aNormalizedName);
      return null;
    }

    if (!this._conv.hasOwnProperty(aNormalizedName)) {
      this._conv[aNormalizedName] = new Conversation(this, this._buddies[aNormalizedName]);
    }

    return this._conv[aNormalizedName];
  },

  /* Remove an existing conversation */
  removeConversation: function(aNormalizedName) {
    this._conv[aNormalizedName] = null;
  },

  /* Private methods */

  /* Disconnect from the server */
  _disconnect: function() {
    for (let b in this._buddies) {
      this._buddies[b].setStatus(Ci.imIStatusInfo.STATUS_OFFLINE, "");
    }

    this._connection.disconnect();
  },


  /* Create a tag - helper function */
  _createTag: function(aTagName) {
    return Components.classes["@instantbird.org/purple/tags-service;1"]
                     .getService(Ci.imITagsService)
                     .createTag(aTagName);
  },

  /* Retrieves a buddy - helper function */
  _getBuddy: function(normalizedName) {
    return Components.classes["@instantbird.org/purple/contacts-service;1"]
              .getService(Ci.imIContactsService)
              .getBuddyByNameAndProtocol(normalizedName, this.protocol);
  },

  /* Add a new buddy to the local storage */
  _addBuddy: function(aTagName, aName, aAlias) {
    let s = Stanza.iq("get", null, aName,
        Stanza.node("vCard", "vcard-temp", {}, []));
    this._connection.sendStanza(s, this.onVCard, this);

    if (this._buddies.hasOwnProperty(normalize(aName))) {
      debug("locally present");
      return;
    }
    let self = this;

    setTimeout(function() {
      let tag = self._createTag(aTagName);
      let buddy = new AccountBuddy(self, null, tag, aName);

      Components.classes["@instantbird.org/purple/contacts-service;1"]
                .getService(Ci.imIContactsService)
                .accountBuddyAdded(buddy);

      if (aAlias)
        buddy.serverAlias = aAlias;
      self._buddies[normalize(aName)] = buddy;
    }, 0);
  },

  /* Set the user statue on the server */
  _statusChanged: function(aStatusType, aMsg) {
    let show = "";

    aMsg = aMsg || "";
    if (aStatusType == Ci.imIStatusInfo.STATUS_AVAILABLE) {
      show = "chat";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_UNAVAILABLE) {
      show = "dnd";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_AWAY) {
      show = "away";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_OFFLINE) {
      //TODO: disconnect
      show = "xa";
    }
    let s = Stanza.presence({"xml:lang": "en"},
         [Stanza.node("show", null, null, show),
          Stanza.node("status", null, null, aMsg)]);
    this._connection.sendStanza(s);
  },
};

function GTalkAccount(aProtoInstance, aKey, aName)
{
  this._init(aProtoInstance, aKey, aName);

  /* A map of on going conversations */
  this._conv = {},

  /* Map of buddies */
  this._buddies = {},

  Services.obs.addObserver(this, "status-changed", false);
}

GTalkAccount.prototype = {
  __proto__: Account.prototype,
  _supportSharedStatus: false,
  _supportMailNotifications: false,
  _mailConv: null,
  _tid: null,

  _rosterReceived: function() {
    let s = Stanza.iq("get", null, "gmail.com",
         Stanza.node("query", $NS.disco_info, {}, []));
    this._connection.sendStanza(s, this.onDiscoItems, this);
  },

  onDiscoItems: function(aName, aStanza) {
    let features = aStanza.getElements(["iq", "query", "feature"]);
    for(let i = 0; i < features.length; ++i) {
      if(features[i].attributes["var"] == "google:shared-status")
        this._supportSharedStatus = true;
      if(features[i].attributes["var"] == "google:mail:notify")
        this._supportMailNotifications = true;
    }

    this._setInitialStatus();

    if(this._supportSharedStatus) {
      let s = Stanza.iq("get", null, this._JID.jid,
           Stanza.node("query", "google:shared-status", {version: 2}, []));
      this._connection.sendStanza(s, this.onSharedStatus, this);
    }

    if(this._supportMailNotifications) {
      this._getMail();

      let t = Stanza.iq("set", null, this._JID.jid,
           Stanza.node("usersetting", "google:setting", {},
            Stanza.node("mailnotifications", null, {value: true}, [])));
      this._connection.sendStanza(t);
    }
  },

  _getMail: function(tid) {
    let s = Stanza.iq("get", "mail-request-1", this._JID.jid,
         Stanza.node("query", "google:mail:notify", {}, []));
    this._connection.sendStanza(s, this.newMail, this);
  },

  newMail: function(aName, aStanza) {
    let mail = aStanza.getElements(["iq", "mailbox", "mail-thread-info"]);
    for(let i = mail.length - 1; i >= 0; --i) {
      /* TODO: notify mail */
      dump(mail[i].convertToString());
      if(!this._tid || (this._tid < mail[i].attributes.tid))
        this._tid = mail[i].attributes.tid;
      dump(this._tid);
    }
  },

  onIQStanza: function(aName, aStanza) {
    if(aStanza.attributes["type"] == "set") {
      if(aStanza.getChildren("new-mail").length > 0) {
        let s = Stanza.iq("result", aStanza.attributes.id, this._JID.jid, []);
        this._connection.sendStanza(s);
        this._getMail();
      }
    }
  },

  onSharedStatus: function(aName, aStanza) {
    /* Append to list of statuses */
    let s = Stanza.iq("set", null, null,
         Stanza.node("query", "google:shared-status", {version: 2},
           [Stanza.node("status", null, {}, ""),
            Stanza.node("show", null, {}, "default"),
            Stanza.node("invisible", null, {value:false}, [])]));
    this._connection.sendStanza(s);
  },

  /* Set the user statue on the server */
  _statusChanged: function(aStatusType, aMsg) {
    let show = "";
    let invisible = false;

    aMsg = aMsg || "";
    if (aStatusType == Ci.imIStatusInfo.STATUS_AVAILABLE) {
      show = "chat";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_UNAVAILABLE) {
      show = "dnd";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_AWAY) {
      show = "away";
    }
    else if (aStatusType == Ci.imIStatusInfo.STATUS_OFFLINE) {
      show = "chat";
      invisible = true;
    }
    if(!this._supportSharedStatus) {
      let s = Stanza.presence({"xml:lang": "en"},
           [Stanza.node("show", null, null, show),
            Stanza.node("status", null, null, aMsg)]);
      this._connection.sendStanza(s);
    }
    else {
      let s = Stanza.iq("set", null, null,
           Stanza.node("query", "google:shared-status", {version: 2},
             [Stanza.node("status", null, {}, aMsg),
              Stanza.node("show", null, {}, show),
              Stanza.node("invisible", null, {value:invisible}, [])]));
      this._connection.sendStanza(s);
    }
  },
};

function XMPPProtocol() {
}

XMPPProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get name() "xmpp-js",
  get noPassword() false,
  getAccount: function(aKey, aName) new Account(this, aKey, aName),
  classID: Components.ID("{c3eb26eb-eaa2-441f-a695-9512199bdbed}"),
/*
  usernameSplits: [
    {label: "Server", separator: "@", defaultValue: "irc.freenode.com",
     reverse: true}
  ],
*/
  options: {
    "server": {label: "Server", default: "talk.google.com"},
    "port": {label: "Port", default: 443},
    "ssl": {label: "Use SSL", default: true},
    "starttls": {label: "Use StartTLS", default: false},
  }
};

function GTalkProtocol() {
}

GTalkProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get name() "gtalk-js",
  get noPassword() false,
  getAccount: function(aKey, aName) new GTalkAccount(this, aKey, aName),
  classID: Components.ID("{c4eb26eb-eaa2-441f-a695-9512199bdbed}"),
/*
  usernameSplits: [
    {label: "Server", separator: "@", defaultValue: "irc.freenode.com",
     reverse: true}
  ],
*/
  options: {
    "server": {label: "Server", default: "talk.google.com"},
    "port": {label: "Port", default: 443},
    "ssl": {label: "Use SSL", default: true},
    "starttls": {label: "Use StartTLS", default: false},
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([GTalkProtocol, XMPPProtocol]);

