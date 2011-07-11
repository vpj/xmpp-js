#Javascript implementation of XMPP protocol for Instantbird

##Installation Instructions (for Linux):

Install latest version of Instantbir. Download the binaries from http://instantbird.com.

Clone the git repository on your local computer

    git clone git://github.com/vpj/xmpp-js.git

Place a file named "xmpp-js@vpj" (without quotes) in the extensions folder inside intantbird profile (which is usually ~/.instantbird/[some hashcode].default/). If the folder extensions does not exists you need to create one. The file xmpp-js@vpj should contain the path to the cloned git folder.

Start Instantbird and view addons. If everything worked fine there should be an extension named XMPP in Javascript.

When you want to upgrade the extension with new code committed go to the folder where you cloned the git repository and run the following command

    git pull

##Testing the protocol plugin

Create a new account - Go to Account and click New Account

Select xmpp-js as your protocol.

###For a gtalk account
For the username enter your email address (e.g. john@gmail.com), and then the password.

Then for xmpp-js options enter the server "talk.google.com" (without quotes)and port "443" (without quotes), and select "Use SSL" option.

###For a facebook account

For usernam enter the facebook handle followed by "@chat.facebook.com" (e.g.john@chat.facebook.com)

For xmpp-js options, server should be "chat.facebook.com" and port "433" and deselect the "Use SSL" option.

