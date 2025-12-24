<?php
include ("APIhelper.php");
include ("auth.php");
$epacehost = "epace.customerdomain.com";

print "<----BEGIN TEST----><BR>";

$readService = new ReadObjectHelper();
$findService = new FindObjectsHelper();

$inventoryItemIDs = $findService -> getObjects("InventoryItem", "@customer=1") ;
#$findService -> debug();


foreach ($inventoryItemIDs as $id) {
	$epaceItem = $readService->getObject('inventoryItem', 'id', $id);
		
	if ($epaceItem->active){	
		echo "Item: $epaceItem->id  <br>";
		echo "Addl Desc: $epaceItem->addlDesc  <br>";
		echo "ecommerce Product Description: $epaceItem->U_addlProductDesc   <br><br>";
	}
}

print "<BR><---- END TEST ----><BR>";
?>



