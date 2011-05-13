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
 * The Original Code is the Instantbird messenging client, released
 * 2010.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://xmpp-js/jsProtoHelper.jsm");
Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/socket.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");
Cu.import("resource://xmpp-js/xmpp-session.jsm");

function Conversation(aAccount)
{
  this._init(aAccount);
}
Conversation.prototype = {
  sendMsg: function (aMsg) {
    if (this._disconnected) {
      this.writeMessage("xmpp", "This message could not be sent because the conversation is no longer active: " + aMsg, {system: true, error: true});
      return;
    }

    this.account.sendMessage(aMsg);
    this.writeMessage("You", aMsg, {outgoing: true});
  },
  _disconnected: false,
  _setDisconnected: function() {
    this._disconnected = true;
  },
  close: function() {
    if (!this._disconnected)
      this.account.disconnect(true);
  },

  get name() "X"
};
Conversation.prototype.__proto__ = GenericConvIMPrototype;

function Account(aProtoInstance, aKey, aName)
{
  this._init(aProtoInstance, aKey, aName);
}

Account.prototype = {
  _conv: null,
  _connection: null,

  connect: function() {
    this.base.connecting();
    dump("connecting");

    this._connection = 
        new XMPPSession("talk.google.com", 443, ["ssl"],
        'bluewoody00', 'gmail.com', 'gsoc2011', this);
    this._connection.connect();
  },

  onXmppStanza: function(name, stanza) {
    if(name == 'message') {
      if(stanza.child('body').length > 0)
       this.handleMessage(stanza.child('body')[0].innerXML());
    }
//    this.handleMessage(stanza.convertToString());
  },

  handleMessage: function(aRawMessage) {
    dump(aRawMessage);
//    aRawMessage = aRawMessage.replace('<', '&lt;')
//                             .replace('>', '&gt;');
//      this._conv.writeMessage('recv', aRawMessage, {system: true});
      this._conv.writeMessage('recv', aRawMessage, {system: true});
  },

  _handleCertProblem: function(socketInfo, status, targetSite) {
  },

  sendMessage: function(aMsg) {
  /*
   aMsg = aMsg.replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/<br\/>/g, '');
  */
   this._connection.send('<message to="vpjayasiri@gmail.com" xml:lang="en"><body>' +
   aMsg + '</body></message>');
  },

  onConnection: function() {
    let self = this;
    setTimeout(function() {
     self._conv = new Conversation(self);
     self._conv.writeMessage("xmpp", "You're connected to the server", {system: true});
    }, 0);
  },

  gotDisconnected: function(aError, aErrorMessage) {
    if (aError === undefined)
      aError = this._base.NO_ERROR;
    this.base.disconnecting(aError, aErrorMessage);
    this.base.disconnected();
  },

  disconnect: function(aSilent) {
    this.gotDisconnected();
  },

  onError: function(aException) {
    this.gotDisconnected(this._base.ERROR_OTHER_ERROR, aException.toString());
  }
};

Account.prototype.__proto__ = GenericAccountPrototype;

function XMPPProtocol() {
}
XMPPProtocol.prototype = {
  get name() "xmpp-js",
  get noPassword() true,
  getAccount: function(aKey, aName) new Account(this, aKey, aName),
  classID: Components.ID("{c3eb26eb-eaa2-441f-a695-9512199bdbed}"),
};
XMPPProtocol.prototype.__proto__ = GenericProtocolPrototype;

const NSGetFactory = XPCOMUtils.generateNSGetFactory([XMPPProtocol]);

