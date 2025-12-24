#!/usr/bin/perl -w
#author Jerry DuVal jduval@pace2020.com
#depends on libsoap-lite-perl

use Data::Dumper;

# append +trace => [qw(debug)] to debug packets
use SOAP::Lite +on_fault => sub { my($soap, $res) = @_; 
    die ref $res ? $res->faultstring : $soap->transport->status, "\n"; };

# user name pswd authenication for talking to ePace
sub SOAP::Transport::HTTP::Client::get_basic_credentials { 
    return 'Enter User Name' => 'Password';
}

#inspection soap service  
my $service = SOAP::Lite -> proxy('http://Enter User Name:Password@localhost:8080/rpc/services/SystemInspector?wsdl', timeout => 10000 )
						 -> uri('urn://pace2020.com/epace/sdk/SystemInspector') ;

my @GLOBAL_INSPECTION_TARGETS;
 
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace Mobile]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace Mobile]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace (UI 3.0)]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[eService]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace (UI 3.0)]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.web.form.ValidFormInspectionTarget[eService]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodel.inspection.XPathFieldValueVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodel.inspection.XPathReportParameterVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace Mobile]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodelmetadata.XPathCalculatedFieldVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[eService]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace (UI 3.0)]';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodelmetadata.OnCreateXPathDefaultVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodelmetadata.XPathConditionVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.objectmodelmetadata.OnPersistXPathDefaultVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.event.EventHandlerDefinitionXPathVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.reporting.ReportPrinterConditionVerificationInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.reporting.ReportFileInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.reporting.ReportFileDeprecatedFieldUsageTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.reporting.CustomReportFileInspectionTarget';
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.epace.blocks.reporting.CustomReportFileDeprecatedFieldUsageTarget';

#use this for customization count
push @GLOBAL_INSPECTION_TARGETS , 'com.pace2020.appbox.blocks.inspection.targets.CustomizationsVerificationInspectionTarget';

foreach my $inspectionTarget ( @GLOBAL_INSPECTION_TARGETS )
{
    print "Currently inspecting $inspectionTarget \n";
	&inspect($service, $inspectionTarget);
} 

# inspect target , requires a target and service
sub inspect
{
    my ($service,$inspectionTarget) = @_;	
	my $results;
	my @targetResults;
	
	eval{
			$results = $service->call(SOAP::Data->name('inspect')->attr({xmlns => 'urn://pace2020.com/epace/sdk/SystemInspector'})
								=> SOAP::Data->type('string')->name('in0')->value($inspectionTarget));
		} or $results = 0;	warn $@ if $@;	
				
    if( $results eq '1' )
	{	
	    # perfect, it has the results
		my @messages = $results->current()->[2]->[0]->[2]->[0]->[2]->[0]->[2];
				
		foreach my $message ( @messages ){
			foreach my $messageInfo ( @$message ){
			    my $targetMessage = $messageInfo->[2];
				print "$targetMessage \n";
			    push @targetResults, $targetMessage ;
			}
		}
	}
	else
	{ 
	    # oops something happened, just put a message about not getting the results in the return array
		my $targetMessage = "Unable to get results";
		print "$targetMessage \n";
	    push @targetResults, $targetMessage;
	}
	return @targetResults;
}	
	
 
