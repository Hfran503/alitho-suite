#!/usr/bin/perl -w

use SOAP::Lite +trace => [qw(debug)];
use SOAP::WSDL;

print "Will delete $ARGV[0] with key $ARGV[1]\n";

my $soap = SOAP::WSDL->new( wsdl => 'http://localhost:8080/rpc/services/deleteObject?wsdl' )
            ->proxy( 'http://localhost:8080/rpc/services/deleteObject' );

$soap->servicename( 'deleteObject' );
$soap->wsdlinit;
$soap->_wsdl_portname( 'deleteObjectPortType' );

print $soap->call( 'deleteObject' , in1 => $ARGV[0] , in0 => $ARGV[1] );
