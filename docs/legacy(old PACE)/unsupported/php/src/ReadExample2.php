<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

//A job with this id must be be created in the system having two or more job parts for this example to work.
//Or change the Job Id that is being passed in.

//testJobPart(new ReadObjectHelper(), 'A1454' );
//testJobParts('A1454');

//This example needs a JobShipment object to be in the system on the first JobPart of this job.
testJobShipment('A1454');

print "---- END TEST ----<BR>";
//--------------------------------------------------------------


function testJobPart($readerObj, $id) {
  //Get a specific job part.
  $jobPart = $readerObj->getCompositeKeyObject('jobPart',array('job' => $id, 'jobPart' => "01"), 'readJobPart');
  showAll($jobPart);
}


function testJobParts($id) {
  //This example combines using the finder service to get a list of key and retrieve each JobPart object in turn.

  $findObjects = new FindObjectsHelper();
  $readerObj = new ReadObjectHelper();
  
  $jobId   = "";
  $jobPart = "";
  
  print($id);
  print("<br>");
  $myJobPartKeyResult = $findObjects->getObjects("JobPart", "( @job ='$id' )" );
  
  if ( is_array($myJobPartKeyResult) ) {
    
    print ($myJobPartKeyResult);
    print("<br>");
    
    reset($myJobPartKeyResult);
    while (list($key, $val) = each($myJobPartKeyResult)) {
      list ($jobId, $jobPartId) = split (':', $val);
      echo "jobId[$jobId] ---  jobPartId[$jobPartId]\n<br>";
      $jobPart = $readerObj->getCompositeKeyObject('jobPart',array('job' => $jobId, 'jobPart' => $jobPartId), 'readJobPart');
      showAll($jobPart);
      
      echo("<br>------------------------------------------------------------\n<br><br>");
    }
    
  } else {
    
    list ($jobId, $jobPartId) = split (':', $myJobPartKeyResult);
    
    $jobPart = $readerObj->getCompositeKeyObject('jobPart',array('job' => $jobId, 'jobPart' => $jobPartId), 'readJobPart');
    showAll($jobPart);
    
    echo("<br>------------------------------------------------------------\n<br><br>");
    
  }




  
}


function testJobShipment($id) {


  $findObjects = new FindObjectsHelper();
  $readerObj = new ReadObjectHelper();
  
  $jobId   = "";
  $jobPart = "";
  
  print($id);
  print("<br>");
  $myResult = $findObjects->getObjects("JobShipment", "( @job ='$id' and @jobPart ='01' )" );
  
  if ( is_array($myResult) ) {
    
    print ($myResult);
    print("<br>");
    
     reset($myResult);
     while (list($key, $val) = each($myResult)) {

       $jobShipment = $readerObj->getObject('jobShipment', 'id', $val, 'readJobShipment');
       showAll($jobShipment);
       
       echo("<br>------------------------------------------------------------\n<br><br>");
      }
    
    
  } else {
    
    print ($myResult);
    //The variable myResult now holds the primary key of the JobShipment on the job part in question.

    $jobShipment = $readerObj->getObject('jobShipment', 'id', $myResult, 'readJobShipment');
    showAll($jobShipment);

    echo("<br>------------------------------------------------------------\n<br><br>");
    
  }


} 


?>
