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
 *   Patrick Cloke <clokep@gmail.com>
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

var EXPORTED_SYMBOLS = [
  "setTimeout",
  "clearTimeout",
  "nsSimpleEnumerator",
  "EmptyEnumerator",
  "ClassInfo",
  "GenericAccountPrototype",
  "GenericAccountBuddyPrototype",
  "GenericConvIMPrototype",
  "GenericConvChatPrototype",
  "GenericConvChatBuddyPrototype",
  "GenericProtocolPrototype",
  "ForwardProtocolPrototype",
  "Message",
  "doXHRequest"
];

/*
 TODO
  replace doXHRequest with a more generic 'HTTP' object
*/

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/imServices.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function LOG(aString)
{
  Services.console.logStringMessage(aString);
}

function setTimeout(aFunction, aDelay)
{
  var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  var args = Array.prototype.slice.call(arguments, 2);
  // A reference to the timer should be kept to ensure it won't be
  // GC'ed before firing the callback.
  var callback = {
    _timer: timer,
    notify: function (aTimer) { aFunction.apply(null, args); delete this._timer; }
  };
  timer.initWithCallback(callback, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
  return timer;
}
function clearTimeout(aTimer)
{
  aTimer.cancel();
}

function normalize(aString) aString.replace(/[^a-z0-9]/gi, "").toLowerCase()

/* Common nsIClassInfo and QueryInterface implementation
 * shared by all generic objects implemented in this file. */
function ClassInfo(aInterfaces, aDescription)
{
  if (!(this instanceof ClassInfo))
    return new ClassInfo(aInterfaces, aDescription);

  if (!Array.isArray(aInterfaces))
    aInterfaces = [aInterfaces];
  this._interfaces =
    aInterfaces.map(function (i) typeof i == "string" ? Ci[i] : i);

  this.classDescription = aDescription || "JS Proto Object";
}
ClassInfo.prototype = {
  QueryInterface: function ClassInfo_QueryInterface(iid) {
    if (iid.equals(Ci.nsISupports) || iid.equals(Ci.nsIClassInfo) ||
        this._interfaces.some(function(i) i.equals(iid)))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  getInterfaces: function(countRef) {
    var interfaces =
      [Ci.nsIClassInfo, Ci.nsISupports].concat(this._interfaces);
    countRef.value = interfaces.length;
    return interfaces;
  },
  getHelperForLanguage: function(language) null,
  contractID: null,
  classID: null,
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: 0
};



/**
 * Constructs an nsISimpleEnumerator for the given array of items.
 * Copied from netwerk/test/httpserver/httpd.js
 *
 * @param items : Array
 *   the items, which must all implement nsISupports
 */
function nsSimpleEnumerator(items)
{
  this._items = items;
  this._nextIndex = 0;
}
nsSimpleEnumerator.prototype = {
  hasMoreElements: function() this._nextIndex < this._items.length,
  getNext: function() {
    if (!this.hasMoreElements())
      throw Cr.NS_ERROR_NOT_AVAILABLE;

    dump('getNext!\n');
    return this._items[this._nextIndex++];
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};

const EmptyEnumerator = {
  hasMoreElements: function() false,
  getNext: function() { throw Cr.NS_ERROR_NOT_AVAILABLE; },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};

XPCOMUtils.defineLazyGetter(this, "AccountBase", function()
  Components.Constructor("@instantbird.org/purple/account;1",
                         "purpleIAccountBase")
);

const ForwardAccountPrototype = {
  __proto__: ClassInfo("purpleIAccount", "generic account object"),
  _init: function _init(aProtoInstance, aBase) {
    this._base = aBase;
    this._base.concreteAccount = this;
    this._protocol = aProtoInstance;
  },
  get base() this._base.purpleIAccountBase,

  checkAutoLogin: function() this._base.checkAutoLogin(),
  remove: function() this._base.remove(),
  UnInit: function() this._base.UnInit(),
  connect: function() this._base.connect(),
  disconnect: function() this._base.disconnect(),
  cancelReconnection: function() this._base.cancelReconnection(),
  createConversation: function(aName) this._base.createConversation(aName),
  addBuddy: function(aTag, aName) this._base.addBuddy(aTag, aName),
  loadBuddy: function(aBuddy, aTag) this._base.loadBuddy(aBuddy, aTag),
  getChatRoomFields: function() this._base.getChatRoomFields(),
  getChatRoomDefaultFieldValues: function(aDefaultChatName)
    this._base.getChatRoomDefaultFieldValues(aDefaultChatName),
  joinChat: function(aComponents) this._base.joinChat(aComponents),
  setBool: function(aName, aVal) this._base.setBool(aName, aVal),
  setInt: function(aName, aVal) this._base.setInt(aName, aVal),
  setString: function(aName, aVal) this._base.setString(aName, aVal),
  save: function() this._base.save(),

  // grep attribute purpleIAccount.idl |sed 's/.* //;s/;//;s/\(.*\)/  get \1() this._base.\1,/'
  // Exception: the protocol getter is handled locally.
  get canJoinChat() this._base.canJoinChat,
  get name() this._base.name,
  get normalizedName() this._base.normalizedName,
  get id() this._base.id,
  get numericId() this._base.numericId,
  get protocol() this._protocol,
  get autoLogin() this._base.autoLogin,
  get firstConnectionState() this._base.firstConnectionState,
  get password() this._base.password,
  get rememberPassword() this._base.rememberPassword,
  get alias() this._base.alias,
  get proxyInfo() this._base.proxyInfo,
  get connectionStateMsg() this._base.connectionStateMsg,
  get connectionErrorReason() this._base.connectionErrorReason,
  get reconnectAttempt() this._base.reconnectAttempt,
  get timeOfNextReconnect() this._base.timeOfNextReconnect,
  get timeOfLastConnect() this._base.timeOfLastConnect,
  get connectionErrorMessage() this._base.connectionErrorMessage,
  get connectionState() this._base.connectionState,
  get disconnected() this._base.disconnected,
  get connected() this._base.connected,
  get connecting() this._base.connecting,
  get disconnecting() this._base.disconnecting,
  get HTMLEnabled() this._base.HTMLEnabled,
  get noBackgroundColors() this._base.noBackgroundColors,
  get autoResponses() this._base.autoResponses,
  get singleFormatting() this._base.singleFormatting,
  get noNewlines() this._base.noNewlines,
  get noFontSizes() this._base.noFontSizes,
  get noUrlDesc() this._base.noUrlDesc,
  get noImages() this._base.noImages,

  // grep attribute purpleIAccount.idl |grep -v readonly |sed 's/.* //;s/;//;s/\(.*\)/  set \1(val) { this._base.\1 = val; },/'
  set autoLogin(val) { this._base.autoLogin = val; },
  set firstConnectionState(val) { this._base.firstConnectionState = val; },
  set password(val) { this._base.password = val; },
  set rememberPassword(val) { this._base.rememberPassword = val; },
  set alias(val) { this._base.alias = val; },
  set proxyInfo(val) { this._base.proxyInfo = val; }
};

const GenericAccountPrototype = {
  __proto__: ForwardAccountPrototype,
  _init: function _init(aProtoInstance, aKey, aName) {
    ForwardAccountPrototype._init.call(this, aProtoInstance, new AccountBase());
    this._base.init(aKey, aName, aProtoInstance);
  },

  /* Override this method to add a new buddy on the server
   * This method is called when the user adds a new buddy
   */
  addBuddy: function(aTag, aName) {
    Components.classes["@instantbird.org/purple/contacts-service;1"]
              .getService(Ci.imIContactsService)
              .accountBuddyAdded(new AccountBuddy(this, null, aTag, aName));
  },

  /* Override this method to keep track of buddies
   * This method is called at the startup for each of the buddies in the local buddy list
   */
  loadBuddy: function(aBuddy, aTag) {
   try {
     return new AccountBuddy(this, aBuddy, aTag) ;
   } catch (x) {
     dump(x + "\n");
     return null;
   }
  },

  getChatRoomFields: function() {
    if (!this.chatRoomFields)
      return EmptyEnumerator;

    let fields = [];
    for (let fieldName in this.chatRoomFields)
      fields.push(new ChatRoomField(fieldName, this.chatRoomFields[fieldName]));
    return new nsSimpleEnumerator(fields);
  },
  getChatRoomDefaultFieldValues: function(aDefaultChatName) {
    if (!this.chatRoomFields)
      return EmptyEnumerator;

    let defaultFieldValues = [];
    for (let fieldName in this.chatRoomFields)
      defaultFieldValues[fieldName] = this.chatRoomFields[fieldName].default;

    if (aDefaultChatName && "parseDefaultChatName" in this) {
      let parsedDefaultChatName = this.parseDefaultChatName(aDefaultChatName);
      for (let field in parsedDefaultChatName)
        defaultFieldValues[field] = parsedDefaultChatName[field];
    }

    return new ChatRoomFieldValues(defaultFieldValues);
  },

  getPref: function (aName, aType)
    this.prefs.prefHasUserValue(aName) ?
      this.prefs["get" + aType + "Pref"](aName) :
      this.protocol._getOptionDefault(aName),
  getInt: function(aName) this.getPref(aName, "Int"),
  getString: function(aName) this.getPref(aName, "Char"),
  getBool: function(aName) this.getPref(aName, "Bool"),

  get prefs() this._prefs ||
    (this._prefs = Services.prefs.getBranch("messenger.account." + this.id +
                                            ".options.")),

  get normalizedName() normalize(this.name),
  get proxyInfo() { throw Components.results.NS_ERROR_NOT_IMPLEMENTED; },
  set proxyInfo(val) { throw Components.results.NS_ERROR_NOT_IMPLEMENTED; }
};


const GenericAccountBuddyPrototype = {
  __proto__: ClassInfo("imIAccountBuddy", "generic account buddy object"),
  _init: function(aAccount, aBuddy, aTag, aUserName) {
    if (!aBuddy && !aUserName)
      throw "aUserName is required when aBuddy is null";

    this._tag = aTag;
    this._account = aAccount;
    this._buddy = aBuddy;
    this._userName = aUserName;
  },

  get account() this._account,
  set buddy(aBuddy) {
    if (this._buddy)
      throw Components.results.NS_ERROR_ALREADY_INITIALIZED;
    this._buddy = aBuddy;
  },
  get buddy() this._buddy,
  get tag() this._tag,
  set tag(aNewTag) {
    let oldTag = this._tag;
    this._tag = aNewTag;
    Components.classes["@instantbird.org/purple/contacts-service;1"]
              .getService(Ci.imIContactsService)
              .accountBuddyMoved(this, oldTag, aNewTag);
  },

  _notifyObservers: function(aTopic, aData) {
    this._buddy.observe(this, "account-buddy-" + aTopic, aData);
  },

  _userName: "",
  get userName() this._userName || this._buddy.userName,
  get normalizedName()
    this._userName ? normalize(this._userName) : this._buddy.normalizedName,
  _serverAlias: "",
  get serverAlias() this._serverAlias,
  set serverAlias(aNewAlias) {
    let old = this.displayName;
    this._serverAlias = aNewAlias;
    this._notifyObservers("display-name-changed", old);
  },

  remove: function() {
    Components.classes["@instantbird.org/purple/contacts-service;1"]
              .getService(Ci.imIContactsService)
              .accountBuddyRemoved(this);
  },

  // imIStatusInfo implementation
  get displayName() this.serverAlias || this.userName,
  _buddyIconFileName: "",
  get buddyIconFilename() this._buddyIconFileName,
  set buddyIconFilename(aNewFileName) {
    this._buddyIconFileName = aNewFileName;
    this._notifyObservers("icon-changed");
  },
  _statusType: 0,
  get statusType() this._statusType,
  get online() this._statusType > Ci.imIStatusInfo.STATUS_OFFLINE,
  get available() this._statusType == Ci.imIStatusInfo.STATUS_AVAILABLE,
  get idle() this._statusType == Ci.imIStatusInfo.STATUS_IDLE,
  get mobile() this._statusType == Ci.imIStatusInfo.STATUS_MOBILE,
  _statusText: "",
  get statusText() this._statusText,

  // This is for use by the protocol plugin, it's not exposed in the
  // imIStatusInfo interface.
  // All parameters are optional and will be ignored if they are null
  // or undefined.
  setStatus: function(aStatusType, aStatusText, aAvailabilityDetails) {
    // Ignore omitted parameters.
    if (aStatusType === undefined || aStatusType === null)
      aStatusType = this._statusType;
    if (aStatusText === undefined || aStatusText === null)
      aStatusText = this._statusText;
    if (aAvailabilityDetails === undefined || aAvailabilityDetails === null)
      aAvailabilityDetails = this._availabilityDetails;

    // Decide which notifications should be fired.
    let notifications = [];
    if (this._statusType != aStatusType ||
        this._availabilityDetails != aAvailabilityDetails)
      notifications.push("availability-changed");
    if (this._statusType != aStatusType ||
        this._statusText != aStatusText) {
      notifications.push("status-changed");
      if (this.online && aStatusType <= Ci.imIStatusInfo.STATUS_OFFLINE)
        notifications.push("signed-off");
      if (!this.online && aStatusType > Ci.imIStatusInfo.STATUS_OFFLINE)
        notifications.push("signed-on");
    }

    // Actually change the stored status.
    [this._statusType, this._statusText, this._availabilityDetails] =
      [aStatusType, aStatusText, aAvailabilityDetails];

    // Fire the notifications.
    notifications.forEach(function(aTopic) {
      this._notifyObservers(aTopic);
    }, this);
  },

  _availabilityDetails: 0,
  get availabilityDetails() this._availabilityDetails,

  get canSendMessage() this.online /*|| this.account.canSendOfflineMessage(this) */,

  getTooltipInfo: function() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },
  createConversation: function() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  }
};

// aUserName is required only if aBuddy is null (= we are adding a buddy)
function AccountBuddy(aAccount, aBuddy, aTag, aUserName) {
  this._init(aAccount, aBuddy, aTag, aUserName);
}
AccountBuddy.prototype = GenericAccountBuddyPrototype;


function Message(aWho, aMessage, aObject)
{
  this.id = ++Message.prototype._lastId;
  this.time = Math.round(new Date() / 1000);
  this.who = aWho;
  this.message = aMessage;
  this.originalMessage = aMessage;

  if (aObject)
    for (let i in aObject)
      this[i] = aObject[i];
}
Message.prototype = {
  __proto__: ClassInfo("purpleIMessage", "generic message object"),
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  _lastId: 0,

  _alias: "",
  get alias() this._alias || this.who,
  _conversation: null,
  get conversation() this._conversation,
  set conversation(aConv) {
    this._conversation = aConv;
    aConv.notifyObservers(this, "new-text", null);
    Services.obs.notifyObservers(this, "new-text", null);
  },

  outgoing: false,
  incoming: false,
  system: false,
  autoResponse: false,
  containsNick: false,
  noLog: false,
  error: false,
  delayed: false,
  noFormat: false,
  containsImages: false,
  notification: false,
  noLinkification: false
};


const GenericConversationPrototype = {
  __proto__: ClassInfo("purpleIConversation", "generic conversation object"),
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  _init: function(aAccount, aName) {
    this.account = aAccount;
    this._name = aName;
    this._observers = [];
    Services.conversations.addConversation(this);
  },

  _id: 0,
  get id() this._id,
  set id(aId) {
    if (this._id)
      throw Cr.NS_ERROR_ALREADY_INITIALIZED;
    this._id = aId;
  },

  addObserver: function(aObserver) {
    if (this._observers.indexOf(aObserver) == -1)
      this._observers.push(aObserver);
  },
  removeObserver: function(aObserver) {
    this._observers = this._observers.filter(function(o) o !== aObserver);
  },
  notifyObservers: function(aSubject, aTopic, aData) {
    for each (let observer in this._observers)
      observer.observe(aSubject, aTopic, aData);
  },

  sendMsg: function (aMsg) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },
  close: function() {
    Services.obs.notifyObservers(this, "closing-conversation", null);
    Services.core.removeConversation(this);
  },
  unInit: function() { },

  writeMessage: function(aWho, aText, aProperties) {
    (new Message(aWho, aText, aProperties)).conversation = this;
  },

  get name() this._name,
  get normalizedName() normalize(this.name),
  get title() this.name,
  account: null
};

const GenericConvIMPrototype = {
  __proto__: GenericConversationPrototype,
  _interfaces: [Ci.purpleIConversation, Ci.purpleIConvIM],
  classDescription: "generic ConvIM object",

  sendTyping: function(aLength) { },

  updateTyping: function(aState) {
    if (aState == this.typingState)
      return;

    if (aState == Ci.purpleIConvIM.NOT_TYPING)
      delete this.typingState;
    else
      this.typingState = aState;
    this.notifyObservers(null, "update-typing", null);
  },

  get isChat() false,
  buddy: null,
  typingState: Ci.purpleIConvIM.NOT_TYPING
};

const GenericConvChatPrototype = {
  __proto__: GenericConversationPrototype,
  _interfaces: [Ci.purpleIConversation, Ci.purpleIConvChat],
  classDescription: "generic ConvChat object",

  _nick: null,
  _topic: null,
  _topicSetter: null,

  _init: function(aAccount, aName, aNick) {
    this._participants = {};
    this._nick = aNick;
    GenericConversationPrototype._init.call(this, aAccount, aName);
  },

  get isChat() true,
  get nick() this._nick,
  get topic() this._topic,
  get topicSetter() this._topicSetter,
  get left() false,

  getParticipants: function()
    new nsSimpleEnumerator([p for each (p in this._participants)]),

  writeMessage: function (aWho, aText, aProperties) {
    aProperties.containsNick = aText.indexOf(this.nick) != -1;
    GenericConversationPrototype.writeMessage.apply(this, arguments);
  }
};

const GenericConvChatBuddyPrototype = {
  __proto__: ClassInfo("purpleIConvChatBuddy", "generic ConvChatBuddy object"),

  _name: "",
  get name() this._name,
  alias: "",
  buddy: false,

  get noFlags() !(this.voiced || this.halfOp || this.op ||
                  this.founder || this.typing),
  voiced: false,
  halfOp: false,
  op: false,
  founder: false,
  typing: false
};

function purplePref(aName, aLabel, aType, aDefaultValue, aMasked) {
  this.name = aName; // Preference name
  this.label = aLabel; // Text to display
  this.type = aType;
  this._defaultValue = aDefaultValue;
  this.masked = !!aMasked; // Obscured from view, ensure boolean
}
purplePref.prototype = {
  __proto__: ClassInfo("purpleIPref", "generic account option preference"),

  // Default value
  getBool: function() this._defaultValue,
  getInt: function() this._defaultValue,
  getString: function() this._defaultValue,
  getList: function() {
    // Convert a JavaScript object map {"value 1": "label 1", ...}
    let keys = Object.keys(this._defaultValue);
    if (!keys.length)
      return EmptyEnumerator;

    return new nsSimpleEnumerator(
      keys.map(function(key) new purpleKeyValuePair(this[key], key),
               this._defaultValue)
    );
  }
};

function purpleKeyValuePair(aName, aValue) {
  this.name = aName;
  this.value = aValue;
}
purpleKeyValuePair.prototype =
  ClassInfo("purpleIKeyValuePair", "generic Key Value Pair");

function UsernameSplit(aValues) {
  this._values = aValues;
}
UsernameSplit.prototype = {
  __proto__: ClassInfo("purpleIUsernameSplit", "username split object"),

  get label() this._values.label,
  get separator() this._values.separator,
  get defaultValue() this._values.defaultValue,
  get reverse() !!this._values.reverse // Ensure boolean
};

function ChatRoomField(aIdentifier, aField) {
  this.identifier = aIdentifier;
  this.label = aField.label;
  this.required = !!aField.required;

  let type = "TEXT";
  if ((typeof aField.default) == "number") {
    type = "INT";
    this.min = aField.min;
    this.max = aField.max;
  }
  else if (aField.isPassword)
    type = "PASSWORD";
  this.type = Ci.purpleIChatRoomField["TYPE_" + type];
}
ChatRoomField.prototype =
  ClassInfo("purpleIChatRoomField", "ChatRoomField object");

function ChatRoomFieldValues(aMap) {
  this.values = aMap;
}
ChatRoomFieldValues.prototype = {
  __proto__: ClassInfo("purpleIChatRoomFieldValues", "ChatRoomFieldValues"),

  getValue: function(aIdentifier)
    this.values.hasOwnProperty(aIdentifier) ? this.values[aIdentifier] : null,
  setValue: function(aIdentifier, aValue) {
    this.values[aIdentifier] = aValue;
  }
};

// the name getter needs to be implemented
const GenericProtocolPrototype = {
  __proto__: ClassInfo("purpleIProtocol", "Generic protocol object"),

  get id() "prpl-" + this.normalizedName,
  get normalizedName() normalize(this.name),
  get iconBaseURI() "chrome://instantbird/skin/prpl-generic/",

  getAccount: function(aKey, aName) { throw Cr.NS_ERROR_NOT_IMPLEMENTED; },

  _getOptionDefault: function(aName) {
    if (this.options && this.options.hasOwnProperty(aName))
      return this.options[aName].default;
    throw aName + " has no default value in " + this.id + ".";
  },
  getOptions: function() {
    if (!this.options)
      return EmptyEnumerator;

    const types =
      {boolean: "Bool", string: "String", number: "Int", object: "List"};

    let purplePrefs = [];
    for (let optionName in this.options) {
      let option = this.options[optionName];
      if (!((typeof option.default) in types))
        throw "Invalid type for preference: " + optionName + ".";

      let type = Ci.purpleIPref["type" + types[typeof option.default]];
      purplePrefs.push(new purplePref(optionName, option.label, type,
                                      option.default, option.masked));
    }
    return new nsSimpleEnumerator(purplePrefs);
  },
  getUsernameSplit: function() {
    if (!this.usernameSplits || !this.usernameSplits.length)
      return EmptyEnumerator;

    return new nsSimpleEnumerator(
      this.usernameSplits.map(function(split) new UsernameSplit(split)));
  },

  registerCommands: function() {
    if (!this.commands)
      return;

    this.commands.forEach(function(command) {
      if (!command.hasOwnProperty("name") || !command.hasOwnProperty("run"))
          throw "Every command must have a name and a run function.";
      if (!command.hasOwnProperty("priority"))
        command.priority = Ci.imICommand.PRIORITY_PRPL;
      Services.cmd.registerCommand(command, this.id);
    }, this)
  },

  // NS_ERROR_XPC_JSOBJECT_HAS_NO_FUNCTION_NAMED errors are too noisy
  get usernameEmptyText() "",
  accountExists: function() false, //FIXME

  get uniqueChatName() false,
  get chatHasTopic() false,
  get noPassword() false,
  get newMailNotification() false,
  get imagesInIM() false,
  get passwordOptional() true,
  get usePointSize() true,
  get registerNoScreenName() false,
  get slashCommandsNative() false,
  get usePurpleProxy() false,

  get classDescription() this.name + " Protocol",
  get contractID() "@instantbird.org/purple/" + this.normalizedName + ";1"
};

function ForwardAccount(aProtocol, aBaseAccount)
{
  this._init(aProtocol, aBaseAccount);
}
ForwardAccount.prototype = ForwardAccountPrototype;

// the baseId property should be set to the prpl id of the base protocol plugin
// and the name getter is required.
const ForwardProtocolPrototype = {
  __proto__: GenericProtocolPrototype,

  get base() {
    if (!this.hasOwnProperty("_base")) {
      this._base =
        Cc["@instantbird.org/purple/core;1"].getService(Ci.purpleICoreService)
                                            .getProtocolById(this.baseId);

    }
    return this._base;
  },
  getAccount: function(aKey, aName)
    new ForwardAccount(this, this.base.getAccount(aKey, aName)),

  get iconBaseURI() this.base.iconBaseURI,
  getOptions: function() this.base.getOptions(),
  getUsernameSplit: function() this.base.getUsernameSplit(),
  accountExists: function(aName) this.base.accountExists(aName),
  get uniqueChatName() this.base.uniqueChatName,
  get chatHasTopic() this.base.chatHasTopic,
  get noPassword() this.base.noPassword,
  get newMailNotification() this.base.newMailNotification,
  get imagesInIM() this.base.imagesInIM,
  get passwordOptional() this.base.passwordOptional,
  get usePointSize() this.base.usePointSize,
  get registerNoScreenName() this.base.registerNoScreenName,
  get slashCommandsNative() this.base.slashCommandsNative
};

function doXHRequest(aUrl, aHeaders, aPOSTData, aOnLoad, aOnError, aThis) {
  var xhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                      .createInstance(Ci.nsIXMLHttpRequest);
  xhr.mozBackgroundRequest = true; // no error dialogs
  xhr.open(aPOSTData ? "POST" : "GET", aUrl);
  xhr.channel.loadFlags = Ci.nsIChannel.LOAD_ANONYMOUS | // don't send cookies
                          Ci.nsIChannel.LOAD_BYPASS_CACHE |
                          Ci.nsIChannel.INHIBIT_CACHING;
  xhr.onerror = function(aProgressEvent) {
    if (aOnError) {
      // adapted from toolkit/mozapps/extensions/nsBlocklistService.js
      let request = aProgressEvent.target;
      let status;
      try {
        // may throw (local file or timeout)
        status = request.status;
      }
      catch (e) {
        request = request.channel.QueryInterface(Ci.nsIRequest);
        status = request.status;
      }
      // When status is 0 we don't have a valid channel.
      let statusText = status ? request.statusText
                              : "nsIXMLHttpRequest channel unavailable";
      aOnError.call(aThis, statusText);
    }
  };
  xhr.onload = function (aRequest) {
    try {
      let target = aRequest.target;
      LOG("Received response: " + target.responseText);
      if (target.status != 200)
        throw target.status + " - " + target.statusText;
      if (aOnLoad)
        aOnLoad.call(aThis, target.responseText);
    } catch (e) {
      Components.utils.reportError(e);
      if (aOnError)
        aOnError.call(aThis, e, aRequest.target.responseText);
    }
  };

  if (aHeaders) {
    aHeaders.forEach(function(header) {
      xhr.setRequestHeader(header[0], header[1]);
    });
  }

  let POSTData = "";
  if (aPOSTData) {
    xhr.setRequestHeader("Content-Type",
                         "application/x-www-form-urlencoded; charset=utf-8");
    POSTData = aPOSTData.map(function(p) p[0] + "=" + encodeURIComponent(p[1]))
                        .join("&");
  }

  LOG("sending request to " + aUrl + " (POSTData = " + POSTData + ")");
  xhr.send(POSTData);
  return xhr;
}
