<?php
include ("APIhelper.php");
$epacehost = "10.210.100.115:9090";
$apiusername = 'Administrator';
$apipassword = 'pace';

function list_jobs(){
	getJobs( new FindObjectsHelper());
}

function getJobs($findObj) {
  $jobId = array('name' => 'jobId', 'xpath' => '@job');
  $description = array('name' => 'description', 'xpath' => '@description');
  $promiseDate = array('name' => 'promiseDate', 'xpath' => '@promiseDate');
  $customer = array('name' => 'customer', 'xpath' => '@customer');
  

  $fieldDescriptor = array( $jobId, $description, $promiseDate, $customer );
  $jobDescriptor = array('objectName' => 'Job','offset' => 0, 'limit' => 10, 'xpathFilter' => 'adminStatus/@openJob', 'fields' => $fieldDescriptor );
  
  $jobs = $findObj->getObjectList( $jobDescriptor );
  $data = fetchJobs( $jobs );
  
  displayData($data);
}

function displayData($data){
  echo "Total Records : ".$data['totalRecords']."<br>";
  echo "Object Name : ".$data['objectName']."<br>";

  echo "<table>";
  $recordCount = 1;
  foreach( $data['data'] as $record )
  {
	echo "<br>*** ".$record['objectName']." PK:".$record['primaryKey']." ***<br>";
	foreach($record['fields'] as $col){
		echo 'Field: Name='.$col['name'].', Type='.$col['type'].', Value='.$col['value'].', XPath='.$col['xpath'].'<br>';
	}
	echo "<br>----------------------------------<br>";
	$recordCount++;	
  }
}

function fetchJobs( $jobs ){
	$jobData = array();	
	$jobs = get_object_vars($jobs);
	$totalJobs = $jobs['totalRecords'];
	$objectName = $jobs['objectName'];
	
	if( $totalJobs > 0 )
	{
		$valueObjectsWrap = get_object_vars( $jobs['valueObjects'] );
		$valueObjects = $valueObjectsWrap['ValueObject'];
		$count = sizeof($valueObjects);
		$counter = 0;
		foreach($valueObjects as $data)
		{
			$dataArr = get_object_vars($data);
			$fields = $dataArr['fields'];
			$objectName = $dataArr['objectName'];
			$primaryKey = $dataArr['primaryKey'];
			$fieldsArr = get_object_vars( $fields );
			$valueField = $fieldsArr['ValueField'];
			
			$jobData[$counter]['primaryKey'] = $primaryKey;
			$jobData[$counter]['objectName'] = $objectName;
			
			$fieldCounter = 0;
			$fieldsArr = array();
			foreach($valueField as $fieldData )
			{
				$fieldDataArr = get_object_vars( $fieldData );
				$fieldsArr[$fieldCounter] = array( 'name' => $fieldDataArr['name'], 'value' => $fieldDataArr['value'], 'type' => $fieldDataArr['type'], 'xpath' => $fieldDataArr['xpath'] );
				$fieldCounter++;
			}
			$jobData[$counter]['fields'] = $fieldsArr;
			$counter++;
		}
	}
	$finalData = array(
		'totalRecords' => $totalJobs,
		'objectName' => $objectName,
		'data' => $jobData
	);
	return $finalData;
}
list_jobs();
?>