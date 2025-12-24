<?php
include ("APIhelper.php");

$epacehost = "localhost";
$apiusername = '';
$apipassword = '';

		$estimateInfo['customer'] = "HOUSE";
		$estimateInfo['estimateDescription'] = "TEST Description" ;

		$estimatePartInfo['FoldPattern'] ="2:1";
		$estimatePartInfo['finalSizeH'] = 12  ;
		$estimatePartInfo['finalSizeW'] = 22  ;
		$estimatePartInfo['eachOf'] =22;
		$estimatePartInfo['numPlies'] =32;
		$estimatePartInfo['grainSpecifications'] =3;
		$estimatePartInfo['bindingMethod'] =1;
		$estimatePartInfo['prepressWorkflow'] =4;
		$estimatePartInfo['product'] ="FL";
		$estimatePartInfo['colorsSide1'] =4;
		$estimatePartInfo['colorsSide2'] =4;
		$estimatePartInfo['totalColors'] =4;
		$estimatePartInfo['inkCoverageFront'] =3;
		$estimatePartInfo['inkCoverageBack'] =3;
		$estimatePartInfo['quantity1'] =1000;
		$estimatePartInfo['quantity2'] =2000;
		$estimatePartInfo['quantity1Desc'] =" qty1 desc ";
		$estimatePartInfo['quantity2Desc'] =" qty2 desc ";

		$estimatePressInfo['primaryPress'] =1;
		$estimatePressInfo['runMethod'] =1;
		$estimatePressInfo['runSizeGrainDirection'] = 1 ;
		$estimatePressInfo['runSizeH'] = 12;
		$estimatePressInfo['runSizeW'] = 22;

		$estimatePaperInfo['materialType'] ="InventoryItem";
		$estimatePaperInfo['inventoryItem'] =1001;
		$estimatePaperInfo['weight'] =5002;
		$estimatePaperInfo['uom'] ="EA";
		$estimatePaperInfo['buySizeGrainDirection'] = 1 ;
		$estimatePaperInfo['buySizeH'] = 12;
		$estimatePaperInfo['buySizeW'] = 22;


		$estimatePartInfo['estimatePaperInfo'] = $estimatePaperInfo ;
		$estimatePartInfo['estimatePressInfo'] = $estimatePressInfo ;

		$estimateInfo['estimatePartInfo'] = $estimatePartInfo ;

	$helper = new InvokeActionHelper();
	$estimate = $helper->createEstimate( $estimateInfo );
	echo "Created estimate -- $estimate->id !!<br>";

?>