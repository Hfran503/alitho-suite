#!/usr/bin/perl -w

#use SOAP::Lite +trace => [qw(debug)];
use SOAP::WSDL;

my $soap = SOAP::WSDL->new( wsdl => 'http://localhost:8080/rpc/services/readObject?wsdl' )
            ->proxy( 'http://localhost:8080/rpc/services/readObject' );

$soap->servicename( 'readObject' );
$soap->wsdlinit;
$soap->_wsdl_portname( 'readObjectPortType' );

my $som = $soap->call( 'readCustomer' , in0 => 'HOUSE' );
my $customer = $som->result;

print $customer;
