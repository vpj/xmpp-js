var EXPORTED_SYMBOLS = ["StanzaEventManager"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

function StanzaEventManager() {
  this.handlers = new Array();
}

StanzaEventManager.prototype = {
  add: function(id, callback) {
    this.handlers[id] = callback; 
  },

  remove: function(id) {
    delete this.handlers[id];
  },

  exec: function(id, name, stanza) {
    if(!this.handlers[id])
      return;

    handlers[id].call(handlers[id], name, stanza);
  }
};
