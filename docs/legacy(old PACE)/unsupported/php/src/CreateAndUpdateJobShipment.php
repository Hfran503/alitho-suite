<?php
include ("APIhelper.php");

$epacehost = "";
$apiusername = '';
$apipassword = '';

$createObject = new CreateObjectHelper();
$updateObject = new UpdateObjectHelper();

createJobShipment( $createObject, $updateObject );

function createJobShipment( $createObject, $updateObject )
{
		$job_shipment_data = array(
			'job'			   =>'W429',
			'jobPart'		   =>'01',
            'date'             => isset($data['date']) ? $data['date'] : date('m/d/Y'),
            'time'             => isset($data['time']) ? $data['time'] : date('g:i A'),
            'shipmentType'     => isset($data['shipment_type']) ? $data['shipment_type'] : 3,
            'promiseDate'      => isset($data['promise_date']) ? $data['shipment_type'] : date('m/d/Y'),
            'shipped'          => isset($data['shipped']) ? $data['shipped'] : false,
            'notes'            => isset($data['notes']) ? $data['notes'] : '',
            'shipVia'          => isset($data['ship_via']) ? $data['ship_via'] : null,
            'contactFirstName' => $data['contact_first_name'],
            'contactLastName'  => $data['contact_last_name'],
            'cost'             => $data['cost'],
            'quantity'         => $data['quantity'],
            'trackingNumber'   => isset($data['tracking_number']) ? $data['tracking_number'] : null,
            'address1'         => isset($data['address1']) ? $data['address1'] : null,
            'address2'         => isset($data['address2']) ? $data['address2'] : null,
            'address3'         => isset($data['address3']) ? $data['address3'] : null
        );

		//This is create - using CreateService
        $job_shipment = $createObject->createObject("jobShipment", $job_shipment_data, "createJobShipment" );

		$job_shipment['shipped']=true;

		//This is update - using UpdateService
		$job_shipment = $updateObject->updateObject('jobShipment', $job_shipment, 'updateJobShipment');
}

?>
