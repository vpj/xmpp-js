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

/* Handle PLAIN authorization mechanism */
function PlainAuth(username, password, domain) {
  this._username = username;
  this._password = password;
  this._domain = domain;
}

PlainAuth.prototype = {
  next: function(aStanza) {
    return {
      wait_results: true,
      send:  "<auth xmlns=\"" + $NS.sasl + "\" mechanism=\"PLAIN\">"
              + b64.encode("\0"+ this._username + "\0" + this._password)
              + "</auth>"};
  }
};

/* Handles DIGEST-MD5 authorization mechanism */
function DigestMD5Auth(username, password, domain) {
  this._username = username;
  this._password = password;
  this._domain = domain;
  this._step = 0;
}

DigestMD5Auth.prototype = {
  next: function(aStanza) {
    if (("_step_" + this._step) in this)
      return this["_step_" + this._step](aStanza);
  },

  _step_0: function(aStanza) {
    this._step++;
    return {
      wait_results: false,
      send: "<auth xmlns=\"" + $NS.sasl + "\" mechanism=\"DIGEST-MD5\" />"
    };
  },

  _decode: function(data) {
    let decoded = b64.decode(data);
    let list = decoded.split(",");
    let reg = /"|'/g;
    let result = {};

    for (let i = 0; i < list.length; ++i) {
      let e = list[i].split("=");
      if (e.length != 2) {
        throw "Error decoding: " + list[i];
      }

      result[e[0]] = e[1].replace(reg, "");
    }

    return result;
  },

  _quote: function(s) {
    return "\"" + s + "\"";
  },

  _step_1: function(aStanza) {
    let text = aStanza.innerXML();
    let data = this._decode(text);
    let cnonce = MD5.hexdigest(Math.random() * 1234567890),
        realm = (data["realm"]) ? data["realm"] : "",
        nonce = data["nonce"],
        host = data["host"],
        qop = "auth",
        charset = "utf-9",
        nc = "00000001";
    let digestUri = "xmpp/" + this._domain;

    if (host)
      digestUri += "/" + host;

    let response = digestMD5(this._username, realm, this._password, nonce, cnonce, digestUri);

    let content =
        "username=" + this._quote(this._username) + "," +
        "realm=" + this._quote(realm) + "," +
        "nonce=" + this._quote(nonce) + "," +
        "cnonce=" + this._quote(cnonce) + "," +
        "nc=" + this._quote(nc) + "," +
        "qop=" + this._quote(qop) + "," +
        "digest-uri=" + this._quote(digestUri) + "," +
        "response=" + this._quote(response) + "," +
        "charset=" + this._quote(charset);

    let encoded = b64.encode(content);

    this._step++;

    return {
      wait_results: false,
      send: "<response xmlns=\"" + $NS.sasl + "\">"
            + encoded + "</response>"
    };
  },

  _step_2: function(aStanza) {
    this._decode(aStanza.innerXML());
    return {
      wait_results: true,
      send: "<response xmlns=\"" + $NS.sasl + "\" />"
    };
  }
};
