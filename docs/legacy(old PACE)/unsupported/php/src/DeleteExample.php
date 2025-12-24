<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

//testDeleteJob(new DeleteObjectHelper(),  'T5555');
testDeleteJobShipment(new DeleteObjectHelper(), '5421' );

print "---- END TEST ----<BR>";
//--------------------------------------------------------------

function testDeleteJob($deleteObj, $id) {
 
  //System does not allow jobs to be deleted.  This will return an error.
  $job = $deleteObj->deleteObject('Job', $id);
  showAll($job);

}
                      
function testDeleteJobShipment($deleteObj, $id) {
  
  $jobShipment = $deleteObj->deleteObject('JobShipment', $id) ;
  showAll($jobShipment);
  
}
?>
