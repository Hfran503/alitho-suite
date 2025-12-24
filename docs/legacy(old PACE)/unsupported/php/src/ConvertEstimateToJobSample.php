<?php
include ("APIhelper.php");
$epacehost = "";
$apiusername = '';
$apipassword = '';

main();

function main()
{
		$invokeActionHelper= new InvokeActionHelper();
		$readHelper=new ReadObjectHelper();

		print " Reading estimate with Id : 5706 <BR>";
		$EstimateJob= $readHelper->getObject("estimate","id",5706);

		echo "Estimate number : $EstimateJob->estimateNumber<BR><BR>";

		print " Calculating Estimate. . . . .  <BR>";
		$EstimateJob= $invokeActionHelper->calculateEstimate($EstimateJob);

		print "<BR> Get EstimateConvertToJob. . . . .   <BR>";
		$EstimateConToJob= $invokeActionHelper->getEstimateConvertToJob($EstimateJob);

		$EstimateConToJob->createNewJob = 'true';
		print "<BR> Converting Estimate to job. . . . .   <BR>";
		$Job = $invokeActionHelper->convertEstimateToJob( $EstimateConToJob );

		echo "Job created with Id : $Job->job<BR><BR>";
}

?>