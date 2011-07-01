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

var EXPORTED_SYMBOLS = ["PlainAuth", "DigestMD5Auth"];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://xmpp-js/utils.jsm");
Cu.import("resource://xmpp-js/xmlnode.jsm");

function PlainAuth(jid, password, domain, name) {
  this._jid = jid;
  this._password = password;
  this._domain = domain;
  this._name = name;
}

PlainAuth.prototype = {
  next: function(stanza) {
    return {
      wait_results: true,
      send:  '<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">'
              + b64.encode('\0'+ this._jid + '\0' + this._password)
              + '</auth>'};
  }
};

function DigestMD5Auth(jid, password, domain, name) {
  this._jid = jid;
  this._password = password;
  this._domain = domain;
  this._name = name;
  this._step = 0;
}

DigestMD5Auth.prototype = {
  next: function(stanza) {
    if(this['_step_' + this._step])
      return this['_step_' + this._step](stanza);
  },

  _step_0: function(stanza) {
    this._step++;
    return {
      wait_results: false,
      send: '<auth xmlns="' + $NS.sasl + '" mechanism="DIGEST-MD5" />'
    };
  },

  _decode: function(data) {
    var decoded = b64.decode(data);
    var list = decoded.split(',');
    var reg = /"|'/g;
    var result = {};

    for(var i = 0; i < list.length; ++i) {
      var e = list[i].split('=');
        // TODO: Exception
      result[e[0]] = e[1].replace(reg, '');
    }

    return result;
  },

  _quote: function(s) {
    return '"' + s + '"';
  },

  _step_1: function(stanza) {
    //TODO: check failure
    var text = stanza.innerXML();
    var data = this._decode(text);
    var cnonce = MD5.hexdigest(Math.random() * 1234567890),
        realm = (data['realm']) ? data['realm'] : '',
        nonce = data['nonce'],
        host = data['host'],
        qop = 'auth',
        charset = 'utf-9',
        nc = '00000001';
    var digestUri = 'xmpp/' + this._domain;

    if(host)
      digestUri += '/' + host;

    var response = digestMD5(this._name, realm, this._password, nonce, cnonce, digestUri);

    var content = 
        'username=' + this._quote(this._name) + ',' +
        'realm=' + this._quote(realm) + ',' +
        'nonce=' + this._quote(nonce) + ',' +
        'cnonce=' + this._quote(cnonce) + ',' +
        'nc=' + this._quote(nc) + ',' + 
        'qop=' + this._quote(qop) + ',' + 
        'digest-uri=' + this._quote(digestUri) + ',' +
        'response=' + this._quote(response) + ',' +
        'charset=' + this._quote(charset);

    var encoded = b64.encode(content);

    this._step++;

    return {
      wait_results: false,
      send: '<response xmlns="' + $NS.sasl + '">'
            + encoded + '</response>'
    };
  },

  _step_2: function(stanza) {
    this._decode(stanza.innerXML());
    return {
      wait_results: true,
      send: '<response xmlns="' + $NS.sasl + '" />'
    };
  }
};
