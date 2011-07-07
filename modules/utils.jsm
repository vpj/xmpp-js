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

var EXPORTED_SYMBOLS = ["async",
                        "log",
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
  var res = {};
  if (!aJid)
    return null;

  var v = aJid.split("/");
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
  var content = b64.decode(aEncodedContent);
  var file = FileUtils.getFile("ProfD", ["icons", "xmppj-js", aJid + ".jpg"]);
 
  if (!file.exists())
    file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

  var ostream = FileUtils.openSafeFileOutputStream(file);
  var stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"].
             createInstance(Components.interfaces.nsIFileOutputStream);
  stream.init(file, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate
  stream.write(content, content.length);
  if (stream instanceof Components.interfaces.nsISafeOutputStream) {
    stream.finish();
  }
  else {
    stream.close();
  }
  var ios = Cc["@mozilla.org/network/io-service;1"].
                       getService(Components.interfaces.nsIIOService);

  var URI = ios.newFileURI(file);
  return URI.spec;
}

function async(aFunction) {
  Cc["@mozilla.org/timer;1"]
      .createInstance(Ci.nsITimer)
      .initWithCallback({notify: function(timer) aFunction() },
                        0,
                        Ci.nsITimer.TYPE_ONE_SHOT);
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

/* Get a JSON string for an object */
function getJSON(aObject) {
  if (typeof(aObject) == "undefined" || !aObject) {
    return "null";
  }

  var res = "";

  if (typeof(aObject) == "object") {
    res = "{"
    for (var v in aObject) {
      res += " " + v + " = " + getJSON(aObject[v]) + "\n";
    }
    res += "}";
  }
  else
    res = "" + aObject;

  return res;
}

/* Print a object for debugging */
function debugJSON(debugJSON) {
  debug(getJSON(aObject));
}

function utf8_encode(aString) {
  aString = aString.replace(/\r\n/g,"\n");
  var utftext = "";

  for (var n = 0; n < aString.length; n++) {
    var c = aString.charCodeAt(n);

    if (c < 128)
      utftext += String.fromCharCode(c);
    else if ((c > 127) && (c < 2048)) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    }
    else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }

  }

  return utftext;
}

//utf8 > iso 8859-1
function utf8_decode(aUtfText) {
  var string = "";
  var i = 0;
  var c, c1, c2;
  c = c1 = c2 = 0;

  while ( i < aUtfText.length ) {
    c = aUtfText.charCodeAt(i);

    if (c < 128) {
      string += String.fromCharCode(c);
      i++;
    }
    else if ((c > 191) && (c < 224)) {
      c2 = aUtfText.charCodeAt(i+1);
      string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    }
    else {
      c2 = aUtfText.charCodeAt(i+1);
      c3 = aUtfText.charCodeAt(i+2);
      string +=
        String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }

  }
  return string;
}

// BASE 64 ---------------------------------------------------------------------
/**
 *  Base 64 encoding and decoding class. If there is internal function, use
 *  them, else use our implemented functions
 */
const b64 = {
  /**
   *  Taken from http://www.webtoolkit.info/
   */
  _key : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  encode: function(aInput) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < aInput.length) {
      chr1 = aInput.charCodeAt(i++);
      chr2 = aInput.charCodeAt(i++);
      chr3 = aInput.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2))
        enc3 = enc4 = 64;
      else if (isNaN(chr3))
        enc4 = 64;

      output = output +
        this._key.charAt(enc1) + this._key.charAt(enc2) +
        this._key.charAt(enc3) + this._key.charAt(enc4);
    }
    return output;
  },

  decode : function(aInput) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    aInput = aInput.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < aInput.length) {
      enc1 = this._key.indexOf(aInput.charAt(i++));
      enc2 = this._key.indexOf(aInput.charAt(i++));
      enc3 = this._key.indexOf(aInput.charAt(i++));
      enc4 = this._key.indexOf(aInput.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 != 64)
        output = output + String.fromCharCode(chr2);
      if (enc4 != 64)
        output = output + String.fromCharCode(chr3);
    }
    return output;
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
var MD5 = (function () {
  /*
   * Configurable variables. You may need to tweak these to be compatible with
   * the server-side, but the defaults work in most cases.
   */
  var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase */
  var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance */
  var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode */

  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  var safe_add = function (x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  };

  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  var bit_rol = function (num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  };

  /*
   * Convert a string to an array of little-endian words
   * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
   */
  var str2binl = function (str) {
    var bin = [];
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
    return bin;
  };

  /*
   * Convert an array of little-endian words to a string
   */
  var binl2str = function (bin) {
    var str = "";
    var mask = (1 << chrsz) - 1;
    for (var i = 0; i < bin.length * 32; i += chrsz)
        str += String.fromCharCode((bin[i>>5] >>> (i % 32)) & mask);
    return str;
  };

  /*
   * Convert an array of little-endian words to a hex string.
   */
  var binl2hex = function (binarray) {
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i++)
      str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
             hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
    return str;
  };

  /*
   * Convert an array of little-endian words to a base-64 string
   */
  var binl2b64 = function (binarray) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    var triplet, j;
    for (var i = 0; i < binarray.length * 4; i += 3)
    {
      triplet = (((binarray[i   >> 2] >> 8 * ( i   %4)) & 0xFF) << 16) |
                (((binarray[i+1 >> 2] >> 8 * ((i+1)%4)) & 0xFF) << 8 ) |
                ((binarray[i+2 >> 2] >> 8 * ((i+2)%4)) & 0xFF);
      for (j = 0; j < 4; j++)
        if (i * 8 + j * 6 > binarray.length * 32)
          str += b64pad;
        else
          str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
    return str;
  };

  /*
   * These functions implement the four basic operations the algorithm uses.
   */
  var md5_cmn = function (q, a, b, x, s, t) {
    return safe_add(bit_rol(safe_add(safe_add(a, q),safe_add(x, t)), s),b);
  };

  var md5_ff = function (a, b, c, d, x, s, t) {
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  };

  var md5_gg = function (a, b, c, d, x, s, t) {
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  };

  var md5_hh = function (a, b, c, d, x, s, t) {
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
  };

  var md5_ii = function (a, b, c, d, x, s, t) {
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
  };

  /*
   * Calculate the MD5 of an array of little-endian words, and a bit length
   */
  var core_md5 = function (x, len) {
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;

    var olda, oldb, oldc, oldd;
    for (var i = 0; i < x.length; i += 16)
    {
      olda = a;
      oldb = b;
      oldc = c;
      oldd = d;

      a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
      d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
      c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
      b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
      a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
      d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
      c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
      b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
      a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
      d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
      c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
      b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
      a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
      d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
      c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
      b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

      a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
      d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
      c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
      b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
      a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
      d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
      c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
      b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
      a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
      d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
      c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
      b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
      a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
      d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
      c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
      b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

      a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
      d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
      c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
      b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
      a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
      d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
      c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
      b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
      a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
      d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
      c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
      b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
      a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
      d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
      c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
      b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

      a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
      d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
      c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
      b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
      a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
      d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
      c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
      b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
      a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
      d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
      c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
      b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
      a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
      d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
      c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
      b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
    }
    return [a, b, c, d];
  };

  /*
   * Calculate the HMAC-MD5, of a key and some data
   */
  var core_hmac_md5 = function (key, data) {
    var bkey = str2binl(key);
    if (bkey.length > 16)
      bkey = core_md5(bkey, key.length * chrsz);

    var ipad = new Array(16), opad = new Array(16);
    for (var i = 0; i < 16; i++)
    {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
    return core_md5(opad.concat(hash), 512 + 128);
  };

  var obj = {
    /*
     * These are the functions you'll usually want to call.
     * They take string arguments and return either hex or base-64 encoded
     * strings.
     */
    hexdigest: function (s) {
      return binl2hex(core_md5(str2binl(s), s.length * chrsz));
    },

    b64digest: function (s) {
      return binl2b64(core_md5(str2binl(s), s.length * chrsz));
    },

    hash: function (s) {
      return binl2str(core_md5(str2binl(s), s.length * chrsz));
    },

    hmac_hexdigest: function (key, data) {
      return binl2hex(core_hmac_md5(key, data));
    },

    hmac_b64digest: function (key, data) {
      return binl2b64(core_hmac_md5(key, data));
    },

    hmac_hash: function (key, data) {
      return binl2str(core_hmac_md5(key, data));
    },
  };

  return obj;
})();

// Digest MD5 ------------------------------------------------------------------
function digestMD5(aName, aRealm, aPassword, aNonce, aCnonce, aDigestUri) {
    var a1 = MD5.hash(aName + ":" + aRealm + ":" + aPassword) +
             ":" + nonce + ":" + aCnonce;
    var a2 = "AUTHENTICATE:" + aDigestUri;

    return MD5.hexdigest(MD5.hexdigest(a1) + ":" + aNonce + ":00000001:" +
                         aCnonce + ":auth:" + MD5.hexdigest(a2));
}


