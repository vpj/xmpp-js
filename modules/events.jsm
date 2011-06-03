var EXPORTED_SYMBOLS = ["StanzaEventManager"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

function StanzaEventManager() {
  this.handlers = new Array();
}

StanzaEventManager.prototype = {
  add: function(id, callback, obj) {
    if(!obj)
      obj = callback;
    this.handlers[id] = {cb: callback, obj: obj}; 
  },

  remove: function(id) {
    delete this.handlers[id];
  },

  exec: function(id, name, stanza) {
    if(!this.handlers[id])
      return;

    this.handlers[id].cb.call(this.handlers[id].obj, name, stanza);
  }
};
