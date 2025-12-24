<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = '';
$apipassword = '';

class Sample
{
	var $findHelper;
	var $readHelper;
	var $invokeAction;

	var $estimateId = 51908;
	var $qtyOrdered = 8000;

	function main()
	{
		echo "Sample for Converting Estimating To Job<br>";

		$this->findHelper = new FindObjectsHelper();
		$this->readHelper = new ReadObjectHelper();
		$this->invokeAction = new InvokeActionHelper();

		$estQty = $this->findEstimateQuantity();

		$job = $this->calculateAndConvert( $estQty );

		echo "Converted estimate quantity $estQty->id to Job $job->job !!<br>";
	}

	function findEstimateQuantity()
	{
		$keys = $this->findHelper->getObjects('EstimateQuantity', '../../../@id='.$this->estimateId );
		$estQty = $this->readHelper->getObject('estimateQuantity', 'id', 5164);
		if( $estQty == null )
		{
			echo "Creating new estimate quantity <br>";
			$createHelper = new CreateObjectHelper();
			$estQty = $createHelper->createObject('quantityOrdered', $this->qtyOrdered, 'createEstimateQuantity' );
			return $estQty;
		}
	}

	function calculateAndConvert( $estQty )
	{
		$est = $this->readHelper->getObject( 'estimate', 'id', $this->estimateId );
		echo "$est->id <br>";
		//recalculate estimate;
		$est = $this->invokeAction->calculateEstimate( $est );
		//get estimate convert to job object
		$estConvertToJob = $this->invokeAction->getEstimateConvertToJob( $est );
		$estConvertToJob->createNewJob = 'true';
		$estConvertToJob->jobType = $this->readHelper->createLocalObject( 'JobType', 'id', 1 );
		$estConvertToJob->promiseDate = mktime(0, 0, 0, 3, 3, 2014);
		$estConvertToJob->billPartsTogether = false;
		$estConvertToJob->quantityOrdered = 5099;
		$estConvertToJob->lastJob = $this->readHelper->getObject('job', 'job', "10036");
		foreach( $estConvertToJob->estimateConvertToJobParts as $estConvertToJobPart )
		 {
			$estConvertToJobPart->quantityToConvert = $estQty;
		 }

		echo "$estQty <br>";
		//convert estimate to job object
		$job = $this->invokeAction->convertEstimateToJob( $estConvertToJob );

		return $job;
	}
}


$sample = new Sample();
$sample->main();

?>
