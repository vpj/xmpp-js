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


var EXPORTED_SYMBOLS = ["log",
                        "debug",
                        "saveIcon",
                        "debugJSON",
                        "b64",
                        "MD5",
                        "parseJID",
                        "normalize",
                        "digestMD5"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

/* Normalize a string
 * Removes all characters except alpha-numerics */
function normalize(aString) aString.replace(/[^a-z0-9]/gi, "").toLowerCase()

/* Parse Jabber ID */
function parseJID(aJid) {
  let res = {};
  if (!aJid)
    return null;

  let v = aJid.split("/");
  if (v.length == 1)
    res.resource = "";
  else
    res.resource = aJid.substr(v[0].length + 1);

  res.jid = v[0];

  v = aJid.split("@");
  res.node = v[0];
  v = v.length > 1 ? v[1] : v[0]
  res.domain = v.split("/")[0];

  return res;
}

/* Save Buddy Icon */
function saveIcon(aJid, aType, aEncodedContent) {
  let content = b64.decode(aEncodedContent);
  let file = FileUtils.getFile("ProfD", ["icons", "xmppj-js", aJid + ".jpg"]);

  if (!file.exists())
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

  let ostream = FileUtils.openSafeFileOutputStream(file);
  let stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"].
             createInstance(Components.interfaces.nsIFileOutputStream);
  stream.init(file, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate
  stream.write(content, content.length);
  if (stream instanceof Components.interfaces.nsISafeOutputStream) {
    stream.finish();
  }
  else {
    stream.close();
  }
  let ios = Cc["@mozilla.org/network/io-service;1"].
                       getService(Components.interfaces.nsIIOService);

  let URI = ios.newFileURI(file);
  return URI.spec;
}

/* Print debugging output */
function debug(aString) {
  dump(aString);
  dump("\n");
}

/* Log */
function log(aString) {
  if (typeof(aString) == "undefined" || !aString)
    aString = "null";

  Services.console.logStringMessage("" + aString);
}

/* Print a object for debugging */
function debugJSON(debugJSON) {
  debug(JSON.stringify(aObject));
}

/* Base 664 encoding and decoding */
const b64 = {
  encode: function(aInput) {
    return btoa(aInput);
  },

  decode : function(aInput) {
    aInput = aInput.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    return atob(aInput);
  }
};


// MD5 -------------------------------------------------------------------------
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
var MD5 = {
  hexdigest: function (s) {
    var hash = this.hash(s);

    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    var r = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");

    return r;
  },

  hash: function (s) {
    var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode */
    let bin = [];
    let mask = (1 << chrsz) - 1;
    for (let i = 0; i < str.length * chrsz; i += chrsz)
        bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);

    var ch = Components.classes["@mozilla.org/security/hash;1"]
                       .createInstance(Components.interfaces.nsICryptoHash);
    ch.init(ch.MD5);
    ch.update(bin, bin.length);
    var hash = ch.finish(false);
    return hash;
  },
};

/* Digest MD5 */
function digestMD5(aName, aRealm, aPassword, aNonce, aCnonce, aDigestUri) {
    let a1 = MD5.hash(aName + ":" + aRealm + ":" + aPassword) +
             ":" + aNonce + ":" + aCnonce;
    let a2 = "AUTHENTICATE:" + aDigestUri;

    return MD5.hexdigest(MD5.hexdigest(a1) + ":" + aNonce + ":00000001:" +
                         aCnonce + ":auth:" + MD5.hexdigest(a2));
}


