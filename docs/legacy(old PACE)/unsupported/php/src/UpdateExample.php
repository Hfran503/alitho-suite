<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

testUpdateJob(new ReadObjectHelper(), new UpdateObjectHelper(),  'T5555');

print "---- END TEST ----<BR>";
//--------------------------------------------------------------

function testUpdateJob($readerObj, $updateObj, $id) {
  
  $job = $readerObj->getObject('job', 'job', $id, 'readJob');
  showAll($job);
  print "----UPDATING ----<BR>";
  
  $job -> description = "REPLACE ORIGINAL DESC WITH THIS.";
  showAll($job);
  
  $updateObj->updateObject('job', $job, 'updateJob');

}

?>
