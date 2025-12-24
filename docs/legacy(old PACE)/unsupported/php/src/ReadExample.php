<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = 'Administrator';
$apipassword = 'pace';

//Connect to the ReadObject webservice and print all fields with
//values for this job id.
print "----BEGIN TEST----<BR>";

testJob(new ReadObjectHelper(),  'A1454');

print "---- END TEST ----<BR>";
//--------------------------------------------------------------

function testJob($readerObj, $id) {
  $job = $readerObj->getObject('job', 'job', $id, 'readJob');
  showAll($job);
}

?>
