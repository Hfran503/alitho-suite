<?php
//include("nusoap.php");
include("readObject.php");
include("updateObject.php");

    $epacehost = "localhost:8085";
    $apiusername = 'Administrator';
    $apipassword = 'pace';
    $existingJob="";

    $readObject = new ReadObject();

    $updateObject = new UpdateObject();

    $id = "99999";
    $existingJob = $readObject->getJob($id);
    print("Existing Job info/n");
    print_r($existingJob);
    $existingJob -> promiseDate = null;
    print("NEW JOB SETTTSSSSS");
    print_r($existingJob);
    $updateObject->setJob($existingJob);

?>