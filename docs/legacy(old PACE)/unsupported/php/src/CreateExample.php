<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

testCreateJob(new CreateObjectHelper() , 'T5555', 15 );


print "---- END TEST ----<BR>";
//--------------------------------------------------------------

function testCreateJob($createrObj, $job, $customer ) {

  $new_job['customer']=$customer;
  $new_job['description']="Example Job";
  $new_job['description2']="Created By the API.";

  //comment out the next line to have system auto-generate the job id.
  $new_job['job']=$job;


  // Other initial values may be set when creating an object, but only the required fields that
  // do not have system generated defaults must be provided.

      /*
    $new_job['adminStatus']=O;
    $new_job['shipVia']=1;
    $new_job['terms']=1;
    $new_job['dateSetup']="2008-07-24T04:00:00.000Z";
    $new_job['timeSetUp']="1970-01-01T22:20:20.000Z";
    $new_job['poNum']="4-22-08";
    $new_job['promiseDate']="2008-04-24T05:00:00.000Z";
    $new_job['promiseTime']="1970-01-01T15:54:21.000Z";
    $new_job['scheduledShipDate']="2008-04-24T05:00:00.000Z";
    $new_job['priceList']=1;
    $new_job['oversMethod']=1;
    $new_job['shipInNameOf']=1;
    //$new_job['numbersGuaranteed']=
    //$new_job['convertingToJob']=
    //$new_job['paceConnectOrderID']=1260;
    //$new_job['paceConnectUserId']=65;
    $new_job['comboJobPercentageCalculationType']=1;
    $new_job['altCurrency']="USD";
    $new_job['altCurrencyRate']=1.000000;
    $new_job['comboTotal']=0;
    $new_job['currentStatus']="000 - NewJob/No Activity";
    $new_job['totalPriceAllParts']=0.000000;
      */

  $newJob = $createrObj->createObject("job",$new_job,"createJob");
  showAll($newJob);
  
}

?>
