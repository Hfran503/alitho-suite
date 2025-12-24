<?php
include ("APIhelper.php");

$epacehost = "";
$apiusername = '';
$apipassword = '';

class Sample
{
	function main()
	{
		$job = $this->CreateJobWithJobPart(new CreateObjectHelper() , "HOUSE" );
	}

	function CreateJobWithJobPart($createrObj, $customer )
	{
			  $new_job['customer']=$customer;
			  $new_job['description']="Example Job";
			  $new_job['description2']="Created By the API.";

			  $newJob = $createrObj->createObject("job",$new_job,"createJob");

			  print (" Job created : ");

			  print  ($newJob['job']);

			  // creating job part for the job , this will be the second part of the job
			  // part 01 created by default while creating the job

			  $jobPart['job'] = $newJob['job'];
			  $jobPart['description'] = "test job part";
			  $jobPart['qtyOrdered'] = 100;

			  // set other required values to the job part

			  $jobPart = $createrObj->createObject("jobPart" , $jobPart , "createJobPart");

			  print ("<BR> Job Part created <BR>");
	}
}

$sample = new Sample();
$sample->main();

?>
