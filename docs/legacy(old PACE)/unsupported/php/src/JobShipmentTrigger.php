<?php
include ("APIhelper.php");

$epacehost = "localhost:8080";
$apiusername = '';
$apipassword = '';


// Admin Status of the job is changed by event trigger on change/add of JobShipment/CartonContent

class JobPartStatusChangeEvent
{
	function main()
	{
		$job = $this->JobShipmentEventTrigger(new CreateObjectHelper() , "HOUSE" );
	}

	function JobShipmentEventTrigger($createrObj, $customer )
	{

	// Create Job
			  $new_job['customer']=$customer;
			  $new_job['description']="Example Job";
			  $new_job['description2']="Created By the API.";
			  $new_job['manufacturingLocation']=00;
			  $newJob = $createrObj->createObject("job",$new_job,"createJob");

			  // creating job part for the job , this will be the second part of the job
			  // part 01 created by default while creating the job
	// Create JobPart
			  $jobPart['job'] = $newJob['job'];
			  $jobPart['description'] = "test job part";
			  $jobPart['qtyOrdered'] = 100;
			  $jobPart['productionStatus'] = 'A';

	// Update JobPart
			  $jobPart = $createrObj->createObject("jobPart" , $jobPart , "createJobPart");
			  $findObjects = new FindObjectsHelper();
			  $jobPart = $findObjects->getObjects("JobPart","@job='A428'");
			  $readerObj = new ReadObjectHelper();
			  $jobPart1 = $readerObj->getObject("jobPart", "job jobPart", $jobPart);
  			  $jobPart1['productionStatus'] = 'A';
  			  $updateObject=new UpdateObjectHelper();
			  $jobPart1 = $updateObject->updateObject('jobPart', $jobPart1, 'updateJobPart');
	// Create Shipment
			  $jobShipment['job'] = $newJob['job'];
			  $jobShipment['jobPart'] = $jobPart1['jobPart'];
			  $jobShipment['jobPartKey'] =$jobPart1['jobPart'];
			  $jobShipment['jobContact'] = $jobPart1['shipToJobContact'];
			  $jobShipment['shipmentType'] = 3; // Final Shipment
			  $jobShipment['autoCreated'] = true;
			  $jobShipment['cost'] = 222;
			  $jobShipment['weight'] = 22;
			  $jobShipment['trackingNumber'] = 2345;
			  $jobShipment['shipInNameOf'] = "1";
			  $jobShipment['shipVia'] = "None";
			  $jobShipment['jobContact'] = $jobPart1['shipToJobContact'];
			  $jobShipment = $createrObj->createObject("jobShipment" , $jobShipment , "createJobShipment");
	// Create Carton
  			  $Carton['shipment'] = $jobShipment['id'];
			  $Carton['note'] = 'Carton for ' . $jobShipment['job'] . ':' . $jobShipment['jobPart'];
			  $Carton['count'] = 1; // always ship one carton
			  $Carton['quantity'] = $jobPart1['qtyOrdered'];
			  $Carton['trackingNumber'] = $jobShipment['trackingNumber'];
			  $Carton['weight'] = $jobShipment['weight'];
			  $Carton['cost'] = $jobShipment['cost'];
    		  $Carton = $createrObj->createObject("carton" , $Carton , "createCarton");

	// Create Carton Content
			  $CartonContent['carton'] = $Carton['id'];
			  $CartonContent['job'] = $jobShipment['job'];
			  $CartonContent['jobPart'] = $jobShipment['jobPart'];
			  $CartonContent['quantity'] = $Carton['quantity'];
			  $CartonContent['note'] = 'Content for ' . $jobShipment['job'] . ':' . $jobShipment['jobPart'];
 			  $CartonContent = $createrObj->createObject("cartonContent" , $CartonContent , "createCartonContent");

		}
	}
	$JobPartStatusChangeEvent = new JobPartStatusChangeEvent();
	$JobPartStatusChangeEvent->main();

?>
