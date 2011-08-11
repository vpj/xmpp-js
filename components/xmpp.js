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
Cu.import("resource://xmpp-js/xmppProtoHelper.jsm");

/* Coneversation for chats with buddies */
function Conversation(aAccount, aBuddy)
{
  this._init(aAccount, aBuddy);
}

Conversation.prototype = XMPPConversationPrototype;

/* Tooltips to show buddy information */
function TooltipInfo(aType, aLabel, aValue) {
  this._init(aType, aLabel, aValue);
}

TooltipInfo.prototype = GenericTooltipInfo;

/* Chat buddies */
function AccountBuddy(aAccount, aBuddy, aTag, aUserName) {
  this._init(aAccount, aBuddy, aTag, aUserName);
}

AccountBuddy.prototype = XMPPAccountBuddyPrototype;

/* XMPP Account */
function XMPPAccount(aProtoInstance, aKey, aName) {
  this._init(aProtoInstance, aKey, aName);
}

XMPPAccount.prototype = {
  __proto__: XMPPAccountPrototype,

  /* Connection parameters */
  getConnectionParameters: function() {
    return {server: this.getString("server"),
            port: this.getInt("port"),
            ssl: this.getBool("ssl"),
            starttls: this.getBool("starttls")};
  },

  /* Creates a Conversation */
  constructConversation: function(buddy) {
    return new Conversation(this, buddy);
  },

  /* Creates an Account Buddy */
  constructAccountBuddy: function(aBuddy, aTag, aName) {
    return new AccountBuddy(this, aBuddy, aTag, aName);
  }
};

/* GTalk Chat buddies */
function GTalkAccountBuddy(aAccount, aBuddy, aTag, aUserName) {
  this._init(aAccount, aBuddy, aTag, aUserName);
}

GTalkAccountBuddy.prototype = {
  __proto__: XMPPAccountBuddyPrototype,

  /* Can send messages to buddies who appear offline */
  get canSendMessage() true
};

/* Conversation window to display email notifications from Gmail */
function MailNotificationConversation(aAccount) {
  this._init(aAccount, "New emails");
}

MailNotificationConversation.prototype = {
  __proto__: GenericConversationPrototype,

  /* Cannot send messages in this conversation window */
  sendMsg: function() {
  },

  /* Adds a new email to the new email window */
  appendNewEmail: function(aEmail) {
    dump(aEmail.convertToString());
    /* Get sender List */
    let senders = aEmail.getElements(["mail-thread-info", "senders", "sender"]);
    let senderName = "";
    for each (let sender in senders) {
      if (senderName != "")
        senderName += ", ";

      senderName += sender.attributes["name"] ? sender.attributes["name"] : sender.attributes["address"];
    }

    /* Get subject */
    let subject = aEmail.getElement(["mail-thread-info", "subject"]);
    let subjectText = "";
    if(subject) {
      subjectText = subject.innerXML();
    }
    if(subjectText == "")
      subjectText = "(no subject)";

    /* Get email snippet */
    let snippet = aEmail.getElement(["mail-thread-info", "snippet"]);
    let snippetText = "";
    if(snippet) {
      snippetText = snippet.innerXML();
    }

    this.writeMessage(senderName, "<b>" + subjectText + "</b>: " + snippetText);
  },

  /* Called when the user closes the window */
  close: function() {
    GenericConversationPrototype.close.call(this);
    this.account.removeMailConv();
  }
};

/* GTalk Account */
function GTalkAccount(aProtoInstance, aKey, aName) {
  this._init(aProtoInstance, aKey, aName);
}

GTalkAccount.prototype = {
  __proto__: XMPPAccountPrototype,

  _supportSharedStatus: false, // Whether the server supports shared statuses
  _supportMailNotifications: false, // Whther the server supports email notifications

  _mailConv: null, // New mail notification window
  _tid: null, // Thread ID of the last received email notification

  /* Connection parameters */
  getConnectionParameters: function() {
    return {server: "talk.google.com",
            port: 443,
            ssl: true,
            starttls: false};
  },

  /* Creates a conversation */
  constructConversation: function(buddy) {
    return new Conversation(this, buddy);
  },

  /* Creates an account buddy */
  constructAccountBuddy: function(aBuddy, aTag, aName) {
    return new GTalkAccountBuddy(this, aBuddy, aTag, aName);
  },

  /* This is called after receiving the roster */
  rosterReceived: function() {
    let s = Stanza.iq("get", null, "gmail.com",
         Stanza.node("query", $NS.disco_info, {}, []));
    this._connection.sendStanza(s, this.onDiscoItems, this);
  },

  /* This is called when disco items are received */
  onDiscoItems: function(aName, aStanza) {
    /* Extract features */
    let features = aStanza.getElements(["iq", "query", "feature"]);

    for (let i = 0; i < features.length; ++i) {
      if (features[i].attributes["var"] == "google:shared-status")
        this._supportSharedStatus = true;
      if (features[i].attributes["var"] == "google:mail:notify")
        this._supportMailNotifications = true;
    }

    this._setInitialStatus();

    /* GTalk Shared Status */
    if (this._supportSharedStatus) {
      let s = Stanza.iq("get", null, this._JID.jid,
           Stanza.node("query", "google:shared-status", {version: 2}, []));
      this._connection.sendStanza(s, this.onSharedStatus, this);
    }

    /* Email notifications */
    if (this._supportMailNotifications) {
      this._getMail();

      let t = Stanza.iq("set", null, this._JID.jid,
           Stanza.node("usersetting", "google:setting", {},
            Stanza.node("mailnotifications", null, {value: true}, [])));
      this._connection.sendStanza(t);
    }
  },

  /* Get recent emails */
  _getMail: function(tid) {
    let s = Stanza.iq("get", "mail-request-1", this._JID.jid,
         Stanza.node("query", "google:mail:notify", {}, []));
    this._connection.sendStanza(s, this.newMail, this);
  },

  /* Remove new email notification conversation */
  removeMailConv: function() {
    this._mailConv = null;
  },

  /* Called when email information is received */
  newMail: function(aName, aStanza) {
    let mail = aStanza.getElements(["iq", "mailbox", "mail-thread-info"]);
    for (let i = mail.length - 1; i >= 0; --i) {
      if (!this._tid || (this._tid < mail[i].attributes.tid))
        this._tid = mail[i].attributes.tid;
      dump(this._tid);
      if(!this._mailConv) {
        this._mailConv = new MailNotificationConversation(this);
      }

      this._mailConv.appendNewEmail(mail[i]);
    }
  },

  /* Called when an IQ stanza is received */
  onIQStanza: function(aName, aStanza) {
    if (aStanza.attributes["type"] == "set") {
      /* Capture new-email event */
      if (aStanza.getChildren("new-mail").length > 0) {
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

  /* Set the user status on the server */
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
    else if (aStatusType == Ci.imIStatusInfo.STATUS_INVISIBLE) {
      show = "chat";
      invisible = true;
    } else if(aStatusType == Ci.imIStatusInfo.STATUS_OFFLINE) {
      this.disconnect();
    }

    /* Shared status */
    if (!this._supportSharedStatus) {
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

/* XMPP Protocol */
function XMPPProtocol() {
}

XMPPProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get name() "xmpp-js",
  get noPassword() false,
  getAccount: function(aKey, aName) new XMPPAccount(this, aKey, aName),

  classID: Components.ID("{dde786d1-6f59-43d0-9bc8-b505a757fb30}"),

  options: {
    "server": {label: "Server", default: "talk.google.com"},
    "port": {label: "Port", default: 443},
    "ssl": {label: "Use SSL", default: true},
    "starttls": {label: "Use StartTLS", default: false},
  }
};

/* GTalk protocol */
function GTalkProtocol() {
}

GTalkProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get name() "gtalk-js",
  get noPassword() false,
  getAccount: function(aKey, aName) new GTalkAccount(this, aKey, aName),
  classID: Components.ID("{38a224c1-6748-49a9-8ab2-efc362b1000d}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([GTalkProtocol, XMPPProtocol]);

