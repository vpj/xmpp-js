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

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://xmpp-js/jsProtoHelper.jsm");
Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
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

const NSGetFactory = XPCOMUtils.generateNSGetFactory([XMPPProtocol]);

