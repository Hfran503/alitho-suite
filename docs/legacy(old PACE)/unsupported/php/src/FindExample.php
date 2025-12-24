<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

testJobPartFind( "( @job ='A1452' and @jobPart ='01' )" ) ;
testJobPartFind( "( @job ='A1452' )" ) ;

print "---- END TEST ----<BR>";
//--------------------------------------------------------------

function testJob($readerObj, $id) {
  $job = $readerObj->getObject('job', 'job', $id, 'readJob');
  showAll($job);
}


function testJobPartFind( $xpath ) {

  $findObjects = new FindObjectsHelper();
  
  $jobId   = "";
  $jobPart = "";
  
  print($id);
  print("<br>");
  $myJobPartKeyResult = $findObjects->getObjects("JobPart", $xpath );

  //The getObjects call will return an array if more than one result is found.
  //Otherwise we get a string with the id that matches.
  
  if ( is_array($myJobPartKeyResult) ) {
    
    print ($myJobPartKeyResult);
    print("<br>");
    
    reset($myJobPartKeyResult);
    while (list($key, $val) = each($myJobPartKeyResult)) {
      list ($jobId, $jobPartId) = split (':', $val);
      echo "jobId[$jobId] ---  jobPartId[$jobPartId]\n<br>";
    }
    
  } else {

    list ($jobId, $jobPartId) = split (':', $myJobPartKeyResult);
    //  $jobPart = $readObject->getJobPart($jobId, $jobPartId);
    
    print_r ($jobPartId );
    print("<br>");

  }

}

?>
