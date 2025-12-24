<?php
include ("APIhelper.php");
$epacehost = "10.210.100.115:9090";
$apiusername = 'Administrator';
$apipassword = 'pace';

function list_vendors(){
	getVendors( new FindObjectsHelper());
}

function getVendors($findObj) {
  $vendorId = array('name' => 'id', 'xpath' => '@id');
  $name = array('name' => 'name', 'xpath' => '@name');
  $address1 = array('name' => 'address1', 'xpath' => '@address1');
  $city = array('name' => 'city', 'xpath' => '@city');
  

  $fieldDescriptor = array( $vendorId, $name, $address1, $city );
  $vendorDescriptor = array('objectName' => 'Vendor','offset' => 0, 'limit' => 10, 'xpathFilter' => '@active', 'fields' => $fieldDescriptor );
  
  $vendors = $findObj->getObjectList( $vendorDescriptor );
  $data = getDataFromResponse( $vendors );
  
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

function getDataFromResponse( $vendors ){
	$vendorData = array();	
	$vendors = get_object_vars($vendors);
	$totalRecords = $vendors['totalRecords'];
	$objectName = $vendors['objectName'];
	
	if( $totalRecords > 0 )
	{
		$valueObjectsWrap = get_object_vars( $vendors['valueObjects'] );
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
			
			$vendorData[$counter]['primaryKey'] = $primaryKey;
			$vendorData[$counter]['objectName'] = $objectName;
			
			$fieldCounter = 0;
			$fieldsArr = array();
			foreach($valueField as $fieldData )
			{
				$fieldDataArr = get_object_vars( $fieldData );
				$fieldsArr[$fieldCounter] = array( 'name' => $fieldDataArr['name'], 'value' => $fieldDataArr['value'], 'type' => $fieldDataArr['type'], 'xpath' => $fieldDataArr['xpath'] );
				$fieldCounter++;
			}
			$vendorData[$counter]['fields'] = $fieldsArr;
			$counter++;
		}
	}
	$finalData = array(
		'totalRecords' => $totalRecords,
		'objectName' => $objectName,
		'data' => $vendorData
	);
	return $finalData;
}
list_vendors();
?>