var EXPORTED_SYMBOLS = ["PlainAuth"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");

function PlainAuth(jid, password) {
  this._jid = jid;
  this._password = password;
}

PlainAuth.prototype = {
  next: function(stanza) {
    return {
      wait_results: true,
      send:  '<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">'
              + Base64.encode('\0'+ this._jid + '\0' + this._password)
              + '</auth>'};
  }
};
