#!/usr/bin/perl -w

use SOAP::Lite +trace => [qw(debug)];

print SOAP::Lite
    -> service( 'http://localhost:8080/rpc/services/version?wsdl' )
    -> getVersion() . "\n";