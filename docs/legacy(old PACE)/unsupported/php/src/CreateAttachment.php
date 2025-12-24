<?php
include ("APIhelper.php");

$epacehost = "127.0.0.1:8080";
$apiusername = '';
$apipassword = '';


class Sample
{
	function main()
	{
		print "---- BEGIN ----<BR>";

		$this->createrObj = new CreateObjectHelper();

		$this->attachmentCreator = new AttachmentServiceObjectHelper();

		$this->createJobWithAttachment( "HOUSE" );

		print "<BR>---- END ----<BR>";
	}

	function createJobWithAttachment( $customer )
	{
		// creating Job

 		$new_job['customer']=$customer;
 		$new_job['description']="Example Job";
		$new_job['description2']="Created By the API.";
		$new_job['promiseTime']="2015-01-01T15:54:21.000Z";
		$new_job['oversMethod']=1;

		$newJob = $this->createrObj->createObject("job",$new_job,"createJob");

		// Creating attachment
		$file = file_get_contents('./sample.txt', true);

		$attachment['content']= base64_encode($file);
		$attachment['fileExtension'] = "xml";
		$attachment['mimeType'] = "text/xml";
		$attachment['name'] = "test";

		$attachmentKey = $this->attachmentCreator->addAttachment("Job" , $newJob['job'] , $attachment);

		$attachment1 = $this->attachmentCreator->readAttachment($attachmentKey);

		print "<BR> Attachment read : <BR>";

		showAll($attachment1);
	}
}

$sample = new Sample();
$sample->main();
?>
